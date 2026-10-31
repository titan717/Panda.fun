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
    private const val DOWNLOAD_STALL_TIMEOUT_MS = 3 * 60 * 1000L

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
            if (updateInfo.latestVersionCode > BuildConfig.VERSION_CODE) updateInfo else null
        }
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
                "MyPanda-update.apk"
            )
            if (destination.exists()) destination.delete()

            val request = DownloadManager.Request(Uri.parse(apkUrl))
                .setTitle("MyPanda Update")
                .setDescription("Downloading the latest MyPanda release...")
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
                var lastBytesDownloaded = -1L
                var lastProgressAt = System.currentTimeMillis()

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
                                    val now = System.currentTimeMillis()
                                    if (soFar > lastBytesDownloaded) {
                                        lastBytesDownloaded = soFar
                                        lastProgressAt = now
                                    } else if (now - lastProgressAt > DOWNLOAD_STALL_TIMEOUT_MS) {
                                        finished = true
                                        manager.remove(downloadId)
                                        destination.delete()
                                        mainHandler.post { onError("Download stalled. Check your connection and try again.") }
                                        return@Thread
                                    }
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
