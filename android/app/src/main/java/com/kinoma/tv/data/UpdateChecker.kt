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
import java.io.File

object UpdateChecker {
    @Volatile private var activeDownloadId: Long? = null
    @Volatile private var cancelledDownloadId: Long? = null
    // Public beta/stable manifest maintained in the Panda.fun repository
    private const val UPDATE_JSON_URL = "https://raw.githubusercontent.com/titan717/Panda.fun/main/update/latest.json"

    /** Silent background check: returns null when up to date or when anything goes wrong. */
    suspend fun checkForUpdate(context: Context? = null, force: Boolean = false): UpdateInfo? {
        return try {
            checkForUpdateOrThrow()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /** Same check, but failures are thrown so the Settings screen can tell "up to date" from "offline". */
    suspend fun checkForUpdateOrThrow(): UpdateInfo? = withContext(Dispatchers.IO) {
        val client = OkHttpClient()
        val request = Request.Builder().url(UPDATE_JSON_URL).build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw java.io.IOException("Update server returned ${response.code}.")
            val body = response.body?.string()?.trim()
            if (body.isNullOrEmpty()) throw java.io.IOException("Update manifest was empty.")
            if (!body.startsWith("{")) throw java.io.IOException("Update manifest was not valid.")
            val updateInfo = Gson().fromJson(body, UpdateInfo::class.java)
                ?: throw java.io.IOException("Update manifest could not be read.")
            if (updateInfo.latestVersionCode <= 0) throw java.io.IOException("Update manifest versionCode is invalid.")
            if (updateInfo.latestVersionName.isBlank()) throw java.io.IOException("Update manifest versionName is missing.")
            if (!updateInfo.apkUrl.startsWith("https://")) throw java.io.IOException("Update package URL must use HTTPS.")
            if (!updateInfo.sha256.matches(Regex("(?i)^[a-f0-9]{64}$"))) throw java.io.IOException("Update manifest checksum is invalid.")
            if (updateInfo.channel !in setOf("stable", "beta")) throw java.io.IOException("Update manifest release channel is missing or invalid.")
            // Beta builds can receive beta updates; production builds must never receive prereleases.
            val installedIsPrerelease = BuildConfig.VERSION_NAME.contains("beta", ignoreCase = true)
            val channelMatches = if (installedIsPrerelease) {
                updateInfo.channel == "beta" && updateInfo.prerelease
            } else {
                updateInfo.channel == "stable" && !updateInfo.prerelease
            }
            if (!channelMatches) {
                throw java.io.IOException(if (installedIsPrerelease) "No matching beta release is currently published." else "No stable production release is currently published.")
            }
            if (updateInfo.latestVersionCode < BuildConfig.VERSION_CODE) {
                throw java.io.IOException("The published update is older than this installation. Update manifest versionCode must increase.")
            }
            if (updateInfo.latestVersionCode == BuildConfig.VERSION_CODE) null else updateInfo
        }
    }

    fun cancelDownload(context: Context) {
        val id = activeDownloadId ?: return
        cancelledDownloadId = id
        try {
            (context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).remove(id)
        } finally {
            activeDownloadId = null
        }
    }

    fun downloadAndInstall(
        context: Context,
        apkUrl: String,
        expectedSha256: String,
        onProgress: (Int, Long, Long) -> Unit,
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
                .setTitle("Panda.fun")
                .setDescription("Downloading the latest Panda.fun release...")
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
            cancelledDownloadId = null
            val downloadId = manager.enqueue(request)
            activeDownloadId = downloadId

            Thread {
                val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
                var finished = false

                while (!finished) {
                    if (cancelledDownloadId == downloadId) {
                        finished = true
                        activeDownloadId = null
                        cancelledDownloadId = null
                        return@Thread
                    }
                    try {
                        val query = DownloadManager.Query().setFilterById(downloadId)
                        manager.query(query).use { cursor ->
                            if (!cursor.moveToFirst()) {
                                activeDownloadId = null
                                if (cancelledDownloadId == downloadId) {
                                    cancelledDownloadId = null
                                    return@Thread
                                }
                                mainHandler.post { onError("Update download disappeared.") }
                                return@Thread
                            }

                            val status = cursor.getInt(
                                cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)
                            )

                            when (status) {
                                DownloadManager.STATUS_SUCCESSFUL -> {
                                    finished = true
                                    activeDownloadId = null
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
                                    activeDownloadId = null
                                    val wasCancelled = cancelledDownloadId == downloadId
                                    cancelledDownloadId = null
                                    if (!wasCancelled) {
                                        val reason = cursor.getInt(
                                            cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)
                                        )
                                        mainHandler.post { onError("Download failed (code $reason).") }
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
                                        mainHandler.post { onProgress(progress, soFar, total) }
                                    } else {
                                        mainHandler.post { onProgress(0, soFar, total) }
                                    }
                                }
                                else -> {
                                    finished = true
                                    activeDownloadId = null
                                    mainHandler.post { onError("Unknown update download status: $status") }
                                }
                            }
                        }
                    } catch (e: Exception) {
                        finished = true
                        activeDownloadId = null
                        mainHandler.post { onError(e.message ?: "Update download failed.") }
                    }

                    if (!finished) Thread.sleep(750)
                }
            }.start()
        } catch (e: Exception) {
            activeDownloadId = null
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
