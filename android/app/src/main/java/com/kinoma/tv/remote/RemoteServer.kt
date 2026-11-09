package com.kinoma.tv.remote

import android.content.SharedPreferences
import android.content.res.AssetManager
import android.util.Log
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.OutputStream
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Phone remote (v1.2.4): a tiny HTTP server on the TV's local network. A phone on the same Wi-Fi opens
 * http://<tv-ip>:<port>/ (the QR on Connect Phone), enters or carries the 8-character pairing code and
 * sends remote keys, text, volume and "open" requests. Nothing leaves the local network.
 *
 * Every /api call must carry the pairing code (X-Panda-Code). Eight wrong codes from one address lock that
 * address out for five minutes. "Disconnect phones" makes a new code, which unpairs every phone.
 */
class RemoteServer(
    private val assets: AssetManager,
    private val prefs: SharedPreferences,
    private val listener: Listener
) {
    interface Listener {
        fun onKey(name: String): Boolean
        fun onText(text: String)
        fun onOpen(path: String): Boolean
        fun onVolume(direction: String): Boolean
        fun onPhoneConnected(count: Int)
        fun deviceName(): String
        fun state(): String
    }

    companion object {
        private const val TAG = "PandaRemote"
        const val FIRST_PORT = 8765
        private const val LAST_PORT = 8775
        private const val MAX_BODY = 4096
        private const val MAX_FAILS = 8
        private const val LOCK_MS = 5 * 60_000L
        private const val PHONE_TTL_MS = 2 * 60_000L
        private const val ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ" // Crockford base32, no I L O U
        private val KEYS = setOf("up", "down", "left", "right", "ok", "back", "home", "playpause", "rewind", "forward", "menu")

        /** Normalise what a person types: upper case, dashes and spaces dropped, O→0, I/L→1. */
        fun normalise(code: String): String = code.uppercase().filter { !it.isWhitespace() && it != '-' }
            .map { when (it) { 'O' -> '0'; 'I', 'L' -> '1'; else -> it } }.joinToString("")

        fun localIpv4(): String? = try {
            NetworkInterface.getNetworkInterfaces()?.toList().orEmpty()
                .filter { it.isUp && !it.isLoopback && !it.isVirtual }
                .sortedBy { if (it.name.startsWith("wlan") || it.name.startsWith("eth")) 0 else 1 }
                .flatMap { it.inetAddresses.toList() }
                .filterIsInstance<Inet4Address>()
                .firstOrNull { it.isSiteLocalAddress }
                ?.hostAddress
        } catch (e: Exception) { null }
    }

    @Volatile private var server: ServerSocket? = null
    @Volatile var port: Int = 0
        private set
    private var pool = Executors.newFixedThreadPool(4)
    private val phones = ConcurrentHashMap<String, Long>()
    private val fails = ConcurrentHashMap<String, LongArray>() // [count, lockedUntil]
    private val random = SecureRandom()

    val running: Boolean get() = server?.isClosed == false

    val code: String
        get() = prefs.getString("remote_code", null)?.takeIf { it.length == 8 } ?: newCode()

    /** A fresh pairing code; every phone paired with the old one is disconnected. */
    @Synchronized fun newCode(): String {
        val c = (1..8).map { ALPHABET[random.nextInt(ALPHABET.length)] }.joinToString("")
        prefs.edit().putString("remote_code", c).apply()
        phones.clear()
        return c
    }

    fun phoneCount(): Int {
        val now = System.currentTimeMillis()
        val it = phones.entries.iterator()
        while (it.hasNext()) if (now - it.next().value > PHONE_TTL_MS) it.remove()
        return phones.size
    }

    @Synchronized fun start(): Boolean {
        if (running) return true
        if (pool.isShutdown) pool = Executors.newFixedThreadPool(4)
        for (p in FIRST_PORT..LAST_PORT) {
            try {
                val s = ServerSocket()
                s.reuseAddress = true
                s.bind(InetSocketAddress(p), 16)
                server = s
                port = p
                Thread({ acceptLoop(s) }, "panda-remote").apply { isDaemon = true }.start()
                Log.i(TAG, "phone remote listening on port $p")
                return true
            } catch (e: Exception) {
                Log.w(TAG, "port $p unavailable: ${e.message}")
            }
        }
        return false
    }

    @Synchronized fun stop() {
        try { server?.close() } catch (_: Exception) {}
        server = null
        port = 0
        pool.shutdownNow()
        try { pool.awaitTermination(200, TimeUnit.MILLISECONDS) } catch (_: Exception) {}
    }

    private fun acceptLoop(s: ServerSocket) {
        while (!s.isClosed) {
            val client = try { s.accept() } catch (_: Exception) { break }
            try { pool.execute { handle(client) } } catch (_: Exception) { try { client.close() } catch (_: Exception) {} }
        }
    }

    private class Request(val method: String, val path: String, val headers: Map<String, String>, val body: String)

    private fun read(socket: Socket): Request? {
        socket.soTimeout = 5000
        val input = BufferedInputStream(socket.getInputStream())
        val head = ByteArrayOutputStream()
        var last4 = 0
        while (head.size() < 8192) {
            val b = input.read()
            if (b < 0) return null
            head.write(b)
            last4 = (last4 shl 8) or b
            if (last4 == 0x0D0A0D0A) break
        }
        val lines = head.toString("ISO-8859-1").split("\r\n")
        val parts = lines.firstOrNull()?.split(" ") ?: return null
        if (parts.size < 2) return null
        val headers = HashMap<String, String>()
        for (line in lines.drop(1)) {
            val i = line.indexOf(':')
            if (i > 0) headers[line.substring(0, i).trim().lowercase()] = line.substring(i + 1).trim()
        }
        val length = headers["content-length"]?.toIntOrNull() ?: 0
        if (length < 0 || length > MAX_BODY) return Request(parts[0], "/__too_large", headers, "")
        val body = ByteArray(length)
        var off = 0
        while (off < length) {
            val n = input.read(body, off, length - off)
            if (n < 0) break
            off += n
        }
        return Request(parts[0].uppercase(), parts[1].substringBefore('?'), headers, String(body, 0, off, Charsets.UTF_8))
    }

    private fun send(out: OutputStream, status: Int, type: String, body: ByteArray, extra: Map<String, String> = emptyMap()) {
        val reason = when (status) { 200 -> "OK"; 400 -> "Bad Request"; 401 -> "Unauthorized"; 404 -> "Not Found"; 405 -> "Method Not Allowed"; 413 -> "Payload Too Large"; 429 -> "Too Many Requests"; else -> "Error" }
        val sb = StringBuilder("HTTP/1.1 $status $reason\r\n")
        sb.append("Content-Type: $type\r\nContent-Length: ${body.size}\r\nConnection: close\r\nCache-Control: no-store\r\n")
        sb.append("X-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\n")
        for ((k, v) in extra) sb.append("$k: $v\r\n")
        sb.append("\r\n")
        out.write(sb.toString().toByteArray(Charsets.ISO_8859_1))
        out.write(body)
        out.flush()
    }

    private fun json(out: OutputStream, status: Int, obj: JSONObject) =
        send(out, status, "application/json; charset=utf-8", obj.toString().toByteArray(Charsets.UTF_8))

    private fun error(out: OutputStream, status: Int, code: String, extra: (JSONObject) -> Unit = {}) =
        json(out, status, JSONObject().put("ok", false).put("error", code).also(extra))

    private fun handle(socket: Socket) {
        socket.use { s ->
            try {
                val req = read(s) ?: return
                val out = s.getOutputStream()
                val ip = s.inetAddress?.hostAddress ?: "?"
                when {
                    req.path == "/__too_large" -> error(out, 413, "TOO_LARGE")
                    req.method == "GET" && (req.path == "/" || req.path == "/index.html") -> page(out)
                    req.path.startsWith("/api/") -> api(out, req, ip)
                    else -> error(out, 404, "NOT_FOUND")
                }
            } catch (e: Exception) {
                Log.w(TAG, "request failed: ${e.message}")
            }
        }
    }

    private fun page(out: OutputStream) {
        val html = assets.open("remote/index.html").use { it.readBytes() }
        send(out, 200, "text/html; charset=utf-8", html, mapOf(
            "Content-Security-Policy" to "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https://image.tmdb.org data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
            "X-Frame-Options" to "DENY"
        ))
    }

    private fun sameCode(given: String?): Boolean {
        if (given == null) return false
        val a = normalise(given).toByteArray()
        val b = code.toByteArray()
        return MessageDigest.isEqual(a, b)
    }

    private fun api(out: OutputStream, req: Request, ip: String) {
        if (req.method != "POST") return error(out, 405, "POST_ONLY")
        val now = System.currentTimeMillis()
        val f = fails[ip]
        if (f != null && f[1] > now) return error(out, 429, "LOCKED") { it.put("retryAfter", (f[1] - now) / 1000) }
        if (!sameCode(req.headers["x-panda-code"])) {
            val entry = fails.getOrPut(ip) { longArrayOf(0, 0) }
            entry[0] += 1
            val left = MAX_FAILS - entry[0]
            if (left <= 0) { entry[0] = 0; entry[1] = now + LOCK_MS }
            return error(out, 401, "WRONG_CODE") { it.put("triesLeft", maxOf(0L, left)) }
        }
        fails.remove(ip)
        val isNew = phones.put(ip, now) == null
        if (isNew) listener.onPhoneConnected(phoneCount())
        val body = try { if (req.body.isBlank()) JSONObject() else JSONObject(req.body) } catch (e: Exception) { return error(out, 400, "BAD_JSON") }
        val ok = when (req.path) {
            "/api/hello", "/api/state" -> true
            "/api/key" -> body.optString("k").let { it in KEYS && listener.onKey(it) }
            "/api/text" -> { val t = body.optString("t").take(120); listener.onText(t); true }
            "/api/open" -> listener.onOpen(body.optString("path").take(200))
            "/api/volume" -> listener.onVolume(body.optString("d"))
            else -> return error(out, 404, "NOT_FOUND")
        }
        if (!ok) return error(out, 400, "REFUSED")
        val state = try { JSONObject(listener.state()) } catch (_: Exception) { JSONObject() }
        json(out, 200, JSONObject().put("ok", true).put("device", listener.deviceName()).put("state", state))
    }
}
