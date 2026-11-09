package com.kinoma.tv.ui

import android.net.Uri

/**
 * v1.2.4 deep links. Only these shapes open anything; every other link is ignored.
 *
 *   pandafun://title/movie/550                    → /title/movie/550
 *   pandafun://sync/XXXX-XXXX-XXXX                → /settings/sync?code=XXXX-XXXX-XXXX (Restore from code)
 *   pandafun://remote                             → /connect-phone
 *   https://apikinoma.vercel.app/p/tv/1399        → /title/tv/1399 (public share link)
 *   https://apikinoma.vercel.app/p/sync#CODE      → /settings/sync?code=CODE (sync QR)
 */
object DeepLinks {
    private const val SHARE_HOST = "apikinoma.vercel.app"
    private val TYPE_ID = Regex("^/?(movie|tv)/([0-9]{1,9})$")
    private val CODE = Regex("^[0-9A-Za-z]{4}-?[0-9A-Za-z]{4}-?[0-9A-Za-z]{4}$")
    private val REMOTE_PATH = Regex("^/(|search\\?q=[^#]{0,300}|title/(movie|tv)/[0-9]{1,9}|my-space|new|movies|tv|categories|settings|connect-phone)$")

    fun path(uri: Uri?): String? {
        if (uri == null) return null
        return when (uri.scheme?.lowercase()) {
            "pandafun" -> when (uri.host?.lowercase()) {
                "title" -> title(uri.path)
                "sync" -> sync(uri.path?.trim('/'))
                "remote" -> "/connect-phone"
                else -> null
            }
            "https" -> if (uri.host?.lowercase() == SHARE_HOST) {
                val p = uri.path ?: return null
                when {
                    p == "/p/sync" -> sync(uri.fragment)
                    p.startsWith("/p/") -> title(p.removePrefix("/p"))
                    else -> null
                }
            } else null
            else -> null
        }
    }

    private fun title(p: String?): String? {
        val m = TYPE_ID.matchEntire(p ?: return null) ?: return null
        return "/title/${m.groupValues[1]}/${m.groupValues[2]}"
    }

    private fun sync(code: String?): String? {
        if (code == null || !CODE.matches(code)) return null
        val c = code.uppercase().replace("-", "")
        return "/settings/sync?code=${c.substring(0, 4)}-${c.substring(4, 8)}-${c.substring(8)}"
    }

    /** Paths a paired phone may open on the TV. */
    fun isRemotePath(path: String): Boolean = REMOTE_PATH.matches(path)
}
