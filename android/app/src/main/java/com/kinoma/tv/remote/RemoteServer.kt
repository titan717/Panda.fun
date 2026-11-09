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
 * Pairing (v1.2.7, SECURITY A127-8): /api/hello trades the pairing code (X-Panda-Code) for a random 256-bit
 * session token bound to the phone's address. Every other /api call carries only that token (X-Panda-Session).
 * Sessions end after 2 hours idle or 24 hours in total, when the phone's address changes, or when "Disconnect
 * phones" makes a new code. Eight wrong codes from one address lock that address out for five minutes; 30 wrong
 * codes in ten minutes from anywhere pause pairing for five minutes. Only private/link-local addresses are served,
 * the Host header must be an IP literal (DNS-rebinding guard), and each address is limited to 20 requests a second.
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
        const val SESSION_IDLE_MS = 2 * 60 * 60_000L
        const val SESSION_MAX_MS = 24 * 60 * 60_000L
        private const val MAX_SESSIONS = 8
        private const val GLOBAL_FAILS = 30
        private const val GLOBAL_WINDOW_MS = 10 * 60_000L
        private const val RATE_PER_SEC = 20.0
        private const val RATE_BURST = 40.0
        private const val ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ" // Crockford base32, no I L O U
        private val KEYS = setOf("up", "down", "left", "right", "ok", "back", "home", "playpause", "rewind", "forward", "menu")

        /** Normalise what a person types: upper case, dashes and spaces dropped, O→0, I/L→1. */
        fun normalise(code: String): String = code.uppercase().filter { !it.isWhitespace() && it != '-' }
            .map { when (it) { 'O' -> '0'; 'I', 'L' -> '1'; else -> it } }.joinToString("")

        /** LAN only: loopback, RFC 1918 / link-local IPv4, and fe80::/fc00::/7 IPv6. Anything else is refused. */
        fun isLocalAddress(a: java.net.InetAddress?): Boolean {
            if (a == null) return false
            if (a.isLoopbackAddress || a.isSiteLocalAddress || a.isLinkLocalAddress) return true
            val b = a.address
            if (a is java.net.Inet6Address && b.isNotEmpty() && (b[0].toInt() and 0xFE) == 0xFC) return true // unique local
            if (a is Inet4Address && b.size == 4 && (b[0].toInt() and 0xFF) == 100 && (b[1].toInt() and 0xC0) == 64) return true // CGNAT hotspots
            return false
        }

        /** The Host header must be an IP literal (optionally with :port); a hostname means a DNS-rebinding page. */
        fun isIpHost(host: String?): Boolean {
            if (host.isNullOrBlank() || host.length > 64) return false
            if (host.startsWith("[")) return Regex("^\\[[0-9a-fA-F:.]+(%[0-9A-Za-z_.]+)?](:\\d{1,5})?$").matches(host)
            val name = host.substringBefore(':')
            return name == "localhost" || Regex("^\\d{1,3}(\\.\\d{1,3}){3}$").matches(name)
        }

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
    private class Session(val ip: String, val created: Long, @Volatile var seen: Long)
    private val sessions = ConcurrentHashMap<String, Session>()
    private val buckets = ConcurrentHashMap<String, DoubleArray>() // [tokens, lastRefillMs]
    private val globalFails = java.util.ArrayDeque<Long>()
    @Volatile private var pairingPausedUntil = 0L
    private val random = SecureRandom()

    val running: Boolean get() = server?.isClosed == false

    val code: String
        get() = prefs.getString("remote_code", null)?.takeIf { it.length == 8 } ?: newCode()

    /** A fresh pairing code; every phone paired with the old one is disconnected. */
    @Synchronized fun newCode(): String {
        val c = (1..8).map { ALPHABET[random.nextInt(ALPHABET.length)] }.joinToString("")
        prefs.edit().putString("remote_code", c).apply()
        phones.clear()
        sessions.clear()
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
        val reason = when (status) { 200 -> "OK"; 400 -> "Bad Request"; 401 -> "Unauthorized"; 403 -> "Forbidden"; 404 -> "Not Found"; 405 -> "Method Not Allowed"; 413 -> "Payload Too Large"; 429 -> "Too Many Requests"; else -> "Error" }
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
                    !isLocalAddress(s.inetAddress) -> error(out, 403, "LAN_ONLY")
                    !isIpHost(req.headers["host"]) -> error(out, 403, "BAD_HOST")
                    !allow(ip) -> error(out, 429, "SLOW_DOWN") { it.put("retryAfter", 1) }
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

    /** Token bucket per address: 20 requests a second, bursts of 40 (holding a key on the phone stays well under). */
    private fun allow(ip: String): Boolean {
        val now = System.currentTimeMillis().toDouble()
        if (buckets.size > 256) buckets.entries.removeIf { now - it.value[1] > 60_000 }
        val b = buckets.getOrPut(ip) { doubleArrayOf(RATE_BURST, now) }
        synchronized(b) {
            b[0] = minOf(RATE_BURST, b[0] + (now - b[1]) / 1000.0 * RATE_PER_SEC)
            b[1] = now
            if (b[0] < 1.0) return false
            b[0] -= 1.0
            return true
        }
    }

    private fun newSession(ip: String, now: Long): String {
        sessions.entries.removeIf { expired(it.value, now) }
        if (sessions.size >= MAX_SESSIONS) sessions.entries.minByOrNull { it.value.seen }?.let { sessions.remove(it.key) }
        val bytes = ByteArray(32).also { random.nextBytes(it) }
        val token = bytes.joinToString("") { "%02x".format(it) }
        sessions[token] = Session(ip, now, now)
        return token
    }

    private fun expired(s: Session, now: Long) = now - s.seen > SESSION_IDLE_MS || now - s.created > SESSION_MAX_MS

    /** Constant-time lookup: compare against every live token so timing doesn't reveal prefixes. */
    private fun findSession(token: String?, ip: String, now: Long): Session? {
        if (token == null || token.length != 64) return null
        val given = token.lowercase().toByteArray()
        var hit: Session? = null
        for ((k, v) in sessions) if (MessageDigest.isEqual(k.toByteArray(), given)) hit = v
        if (hit == null) return null
        if (hit.ip != ip || expired(hit, now)) { sessions.values.remove(hit); return null }
        hit.seen = now
        return hit
    }

    @Synchronized private fun noteGlobalFail(now: Long) {
        globalFails.addLast(now)
        while (globalFails.isNotEmpty() && now - globalFails.first() > GLOBAL_WINDOW_MS) globalFails.removeFirst()
        if (globalFails.size >= GLOBAL_FAILS) { pairingPausedUntil = now + LOCK_MS; globalFails.clear() }
    }

    private fun api(out: OutputStream, req: Request, ip: String) {
        if (req.method != "POST") return error(out, 405, "POST_ONLY")
        if (req.headers["content-type"]?.startsWith("application/json") != true) return error(out, 400, "JSON_ONLY")
        val now = System.currentTimeMillis()
        var token: String? = null
        if (req.path == "/api/hello") {
            val f = fails[ip]
            if (f != null && f[1] > now) return error(out, 429, "LOCKED") { it.put("retryAfter", (f[1] - now) / 1000) }
            if (pairingPausedUntil > now) return error(out, 429, "LOCKED") { it.put("retryAfter", (pairingPausedUntil - now) / 1000) }
            if (!sameCode(req.headers["x-panda-code"])) {
                noteGlobalFail(now)
                val entry: LongArray = fails.getOrPut(ip) { longArrayOf(0L, 0L) }
                entry[0] = entry[0] + 1L
                val left: Long = MAX_FAILS - entry[0]
                if (left <= 0) { entry[0] = 0; entry[1] = now + LOCK_MS }
                return error(out, 401, "WRONG_CODE") { it.put("triesLeft", maxOf(0L, left)) }
            }
            fails.remove(ip)
            token = newSession(ip, now)
        } else if (findSession(req.headers["x-panda-session"], ip, now) == null) {
            return error(out, 401, "SESSION_EXPIRED")
        }
        val isNew = phones.put(ip, now) == null
        if (isNew) listener.onPhoneConnected(phoneCount())
        val body = try { if (req.body.isBlank()) JSONObject() else JSONObject(req.body) } catch (e: Exception) { return error(out, 400, "BAD_JSON") }
        val ok = when (req.path) {
            "/api/hello", "/api/state" -> true
            "/api/key" -> body.optString("k").let { it in KEYS && listener.onKey(it) }
            "/api/text" -> { val t = body.optString("t").take(120).filter { it >= ' ' }; listener.onText(t); true }
            "/api/open" -> body.optString("path").take(200).let { it.startsWith("/") && !it.startsWith("//") && !it.contains('\\') && listener.onOpen(it) }
            "/api/volume" -> body.optString("d").let { (it == "up" || it == "down" || it == "mute") && listener.onVolume(it) }
            else -> return error(out, 404, "NOT_FOUND")
        }
        if (!ok) return error(out, 400, "REFUSED")
        val state = try { JSONObject(listener.state()) } catch (_: Exception) { JSONObject() }
        val reply = JSONObject().put("ok", true).put("device", listener.deviceName()).put("state", state)
        if (token != null) reply.put("session", token).put("idleSeconds", SESSION_IDLE_MS / 1000).put("maxSeconds", SESSION_MAX_MS / 1000)
        json(out, 200, reply)
    }
}
