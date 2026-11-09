package com.kinoma.tv.shield

import android.content.Context
import android.net.Uri
import android.util.Log
import android.webkit.WebResourceResponse
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.util.zip.GZIPInputStream

/**
 * Native layers of the Panda ad shield (docs/AD_SHIELD.md, layers 3 and 4).
 *
 * - Host blocklist: StevenBlack/hosts "unified" list (MIT), refreshed at build time by
 *   scripts/update-blocklist.mjs into assets/shield/hosts.txt.gz, plus Panda's own observed
 *   provider ad hosts. Requests to a listed host (or any parent domain) get an empty 204.
 * - Hosts the app and its two providers need are never blocked, whatever the list says.
 * - Every blocked attempt is queued as {source, kind, host} for the web app; no URLs, paths or
 *   user data are kept.
 */
object AdShield {
    private const val TAG = "PandaShield"

    /** Hosts Panda itself and the playback providers need (suffix match). */
    private val ALLOW = listOf(
        "appassets.androidplatform.net", "apikinoma.vercel.app", "api.github.com", "github.com",
        "objects.githubusercontent.com", "release-assets.githubusercontent.com",
        "image.tmdb.org", "api.themoviedb.org", "youtube.com", "youtube-nocookie.com", "ytimg.com",
        "googlevideo.com", "gstatic.com", "cinesrc.st", "vidy.st", "vidlink.pro"
    )

    /** Ad / click-tracker hosts seen in provider embeds during Panda's instrumented tests (2026-11-08). */
    private val OBSERVED = listOf(
        "adexchangerapid.com", "usrpubtrk.com", "roadster24.com", "offer.alibaba.com",
        // VidLink embed, measured 2026-11-09 (docs/SOURCES.md)
        "adsco.re", "rapidadexchange.com", "usrpubtrck.com"
    )

    @Volatile private var hosts: HashSet<String> = HashSet(OBSERVED)
    @Volatile var activeSource: String = ""
    private val events = ArrayList<JSONObject>()

    fun load(context: Context) {
        Thread {
            try {
                val set = HashSet<String>(OBSERVED)
                context.assets.open("shield/hosts.txt.gz").use { raw ->
                    GZIPInputStream(raw).bufferedReader().forEachLine { line ->
                        val l = line.trim()
                        if (l.isEmpty() || l.startsWith("#")) return@forEachLine
                        val parts = l.split(Regex("\\s+"))
                        val h = (if (parts.size >= 2 && (parts[0] == "0.0.0.0" || parts[0] == "127.0.0.1")) parts[1] else parts[0]).lowercase()
                        if (h.contains('.') && h != "localhost" && h != "0.0.0.0") set.add(h)
                    }
                }
                hosts = set
                Log.i(TAG, "Blocklist loaded: ${set.size} hosts")
            } catch (e: Exception) {
                Log.w(TAG, "Blocklist unavailable, using built-in hosts only: ${e.message}")
            }
        }.start()
    }

    private fun allowed(host: String) = ALLOW.any { host == it || host.endsWith(".$it") }

    fun isBlockedHost(host: String?): Boolean {
        val h = host?.lowercase() ?: return false
        if (allowed(h)) return false
        var d = h
        while (true) {
            if (hosts.contains(d)) return true
            val i = d.indexOf('.')
            if (i < 0 || i == d.length - 1) return false
            d = d.substring(i + 1)
            if (!d.contains('.')) return false
        }
    }

    fun emptyResponse(): WebResourceResponse =
        WebResourceResponse("text/plain", "utf-8", 204, "Blocked", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(ByteArray(0)))

    /** http(s) to the app or a provider; everything else (intent:, market:, other apps, ad pages) is blocked. */
    /**
     * Clean trailers (docs/TRAILERS.md): a trailer frame may never become youtube.com, a watch page,
     * a channel or youtu.be. Only the youtube-nocookie.com embed itself is allowed to load.
     */
    fun isYouTubeExit(uri: Uri): Boolean {
        val h = uri.host?.lowercase() ?: return false
        if (h == "youtu.be") return true
        if (h == "youtube.com" || h.endsWith(".youtube.com")) return !(uri.path ?: "").startsWith("/embed/")
        return false
    }

    fun isAllowedNavigation(uri: Uri, appHost: String): Boolean {
        val scheme = uri.scheme?.lowercase() ?: return false
        if (scheme != "https" && scheme != "http") return false
        return uri.host == appHost
    }

    @Synchronized
    fun record(kind: String, uri: Uri?) {
        val host = try { uri?.host ?: uri?.scheme ?: "" } catch (_: Exception) { "" }
        if (events.size >= 200) events.removeAt(0)
        events.add(JSONObject().put("source", activeSource.ifEmpty { "app" }).put("kind", kind).put("host", host ?: ""))
        Log.i(TAG, "blocked $kind ${host ?: ""} (source=${activeSource.ifEmpty { "app" }})")
    }

    /** Events since the last call, then cleared (the web app keeps the running totals). */
    @Synchronized
    fun drain(): String {
        val out = JSONObject().put("events", JSONArray(events))
        events.clear()
        return out.toString()
    }
}
