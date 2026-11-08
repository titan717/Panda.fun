package com.kinoma.tv.data

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Environment
import androidx.core.content.FileProvider
import com.kinoma.tv.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import java.io.File

object UpdateChecker {
    /** Stable releases are published by .github/workflows/build-apk.yml as GitHub Releases. */
    private const val LATEST_RELEASE_URL = "https://api.github.com/repos/titan717/Panda.fun/releases/latest"
    private val client by lazy { OkHttpClient() }

    /** Silent background check: returns null when up to date or when anything goes wrong. */
    suspend fun checkForUpdate(): UpdateInfo? {
        return try {
            checkForUpdateOrThrow()
        } catch (e: Exception) {
            null
        }
    }

    /** Same check, but failures are thrown so the Settings screen can tell "up to date" from "offline". */
    suspend fun checkForUpdateOrThrow(): UpdateInfo? = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url(LATEST_RELEASE_URL)
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "Panda.fun-Android/${BuildConfig.VERSION_NAME}")
            .build()
        val release = client.newCall(request).execute().use { response ->
            if (response.code == 404) return@withContext null
            if (!response.isSuccessful) throw java.io.IOException("GitHub returned ${response.code}.")
            val body = response.body?.string()?.trim()
            if (body.isNullOrEmpty()) throw java.io.IOException("Release information was empty.")
            Gson().fromJson(body, GitHubRelease::class.java) ?: throw java.io.IOException("Release information could not be read.")
        }
        val version = release.tagName.removePrefix("v").removePrefix("V")
        if (compareVersions(version, BuildConfig.VERSION_NAME) <= 0) return@withContext null
        val apk = release.assets.firstOrNull { it.name.endsWith(".apk", ignoreCase = true) }
            ?: throw java.io.IOException("The latest release has no APK attached.")
        val shaAsset = release.assets.firstOrNull { it.name.equals("${apk.name}.sha256", ignoreCase = true) }
            ?: release.assets.firstOrNull { it.name.endsWith(".sha256", ignoreCase = true) }
            ?: throw java.io.IOException("The latest release has no checksum attached.")
        val sha = client.newCall(Request.Builder().url(shaAsset.downloadUrl).build()).execute().use { r ->
            if (!r.isSuccessful) throw java.io.IOException("Checksum download failed (${r.code}).")
            r.body?.string()?.trim()?.split(Regex("\\s+"))?.firstOrNull().orEmpty()
        }
        UpdateInfo(
            latestVersionCode = 0,
            latestVersionName = version,
            apkUrl = apk.downloadUrl,
            releaseNotes = readableNotes(release.body.orEmpty(), version).ifEmpty { "Panda.fun $version" },
            mandatory = false,
            sha256 = sha,
            apkSize = apk.size
        )
    }

    /**
     * Plain-text notes for the update dialog: the bullets under "## What's new in X" when present,
     * otherwise the notes with Markdown, build details and the changelog link removed.
     */
    fun readableNotes(body: String, version: String): String {
        val lines = body.replace("\r", "").lines()
        val start = lines.indexOfFirst { it.trim().equals("## What's new in $version", ignoreCase = true) }
        val picked = if (start >= 0) {
            lines.drop(start + 1).takeWhile { !it.trimStart().startsWith("#") && !it.contains("**Full Changelog**") }
        } else {
            lines.filterNot { l ->
                val t = l.trim()
                t.startsWith("#") || t.contains("Full Changelog") || t.startsWith("- Version code") || t.contains("SHA-256") || t.startsWith("- APK:")
            }
        }
        return picked.map { l ->
            l.trim().replace(Regex("^[-*]\\s+"), "• ").replace("**", "").replace(Regex("`([^`]*)`"), "$1")
                .replace(Regex("\\[([^\\]]+)]\\([^)]*\\)"), "$1")
        }.joinToString("\n").replace(Regex("\n{3,}"), "\n\n").trim()
    }

    /** Semantic version compare; stable releases rank above pre-releases of the same core version. */
    fun compareVersions(a: String, b: String): Int {
        fun parse(v: String): Pair<List<Int>, String?> {
            val parts = v.trim().removePrefix("v").split("-", limit = 2)
            val nums = parts[0].split(".").map { it.toIntOrNull() ?: 0 }.toMutableList()
            while (nums.size < 3) nums.add(0)
            return nums to parts.getOrNull(1)
        }
        val (x, xp) = parse(a)
        val (y, yp) = parse(b)
        for (i in 0 until 3) if (x[i] != y[i]) return x[i].compareTo(y[i])
        if (xp == yp) return 0
        if (xp == null) return 1
        if (yp == null) return -1
        return xp.compareTo(yp)
    }

    fun downloadAndInstall(
        context: Context,
        apkUrl: String,
        expectedSha256: String,
        onProgress: (Int) -> Unit,
        onComplete: (Uri) -> Unit,
        onError: (String) -> Unit
    ) {
        try {
            if (apkUrl.isBlank()) {
                onError("Update package URL is missing.")
                return
            }

            if (!expectedSha256.matches(Regex("(?i)^[a-f0-9]{64}$"))) {
                onError("Update checksum is invalid.")
                return
            }

            val destination = File(
                context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
                "Panda.fun-update.apk"
            )
            if (destination.exists()) destination.delete()

            val request = DownloadManager.Request(Uri.parse(apkUrl))
                .setTitle("Panda.fun update")
                .setDescription("Downloading the latest Panda.fun release…")
                .setMimeType("application/vnd.android.package-archive")
                .setDestinationInExternalFilesDir(
                    context,
                    Environment.DIRECTORY_DOWNLOADS,
                    destination.name
                )
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(true)
                .setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                )

            val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val downloadId = manager.enqueue(request)

            Thread {
                val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
                var finished = false

                while (!finished) {
                    try {
                        val query = DownloadManager.Query().setFilterById(downloadId)
                        manager.query(query).use { cursor ->
                            if (!cursor.moveToFirst()) {
                                mainHandler.post { onError("Update download disappeared.") }
                                return@Thread
                            }

                            val status = cursor.getInt(
                                cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)
                            )

                            when (status) {
                                DownloadManager.STATUS_SUCCESSFUL -> {
                                    finished = true
                                    if (destination.exists() && verifySha256(destination, expectedSha256)) {
                                        val uri = FileProvider.getUriForFile(
                                            context,
                                            "${context.packageName}.fileprovider",
                                            destination
                                        )
                                        mainHandler.post { onComplete(uri) }
                                    } else {
                                        destination.delete()
                                        mainHandler.post { onError("Update verification failed.") }
                                    }
                                }

                                DownloadManager.STATUS_FAILED -> {
                                    finished = true
                                    val reason = cursor.getInt(
                                        cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)
                                    )
                                    mainHandler.post {
                                        onError("Download failed (code $reason).")
                                    }
                                }

                                DownloadManager.STATUS_RUNNING,
                                DownloadManager.STATUS_PENDING -> {
                                    val total = cursor.getLong(
                                        cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)
                                    )
                                    val soFar = cursor.getLong(
                                        cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
                                    )
                                    if (total > 0L) {
                                        val progress = ((soFar * 100L) / total).toInt().coerceIn(0, 100)
                                        mainHandler.post { onProgress(progress) }
                                    } else {
                                        mainHandler.post { onProgress(0) }
                                    }
                                }
                                else -> {
                                    finished = true
                                    mainHandler.post { onError("Unknown update download status: $status") }
                                }
                            }
                        }
                    } catch (e: Exception) {
                        finished = true
                        mainHandler.post { onError(e.message ?: "Update download failed.") }
                    }

                    if (!finished) Thread.sleep(750)
                }
            }.start()
        } catch (e: Exception) {
            onError(e.message ?: "Update download failed.")
        }
    }

    private fun verifySha256(file: File, expectedSha256: String): Boolean {
        return try {
            val digest = java.security.MessageDigest.getInstance("SHA-256")
            file.inputStream().use { inputStream ->
                val buffer = ByteArray(8192)
                var bytesRead: Int
                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                    digest.update(buffer, 0, bytesRead)
                }
            }
            val hash = digest.digest().joinToString("") { "%02x".format(it) }
            hash.equals(expectedSha256, ignoreCase = true)
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}

data class GitHubRelease(
    @SerializedName("tag_name") val tagName: String,
    @SerializedName("name") val name: String?,
    @SerializedName("body") val body: String?,
    @SerializedName("assets") val assets: List<GitHubAsset>
)

data class GitHubAsset(
    @SerializedName("name") val name: String,
    @SerializedName("browser_download_url") val downloadUrl: String,
    @SerializedName("size") val size: Long
)
