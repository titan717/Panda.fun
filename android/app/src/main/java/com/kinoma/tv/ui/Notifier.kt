package com.kinoma.tv.ui

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.kinoma.tv.R

/** New-episode and release notifications posted for the web app (v1.1.7). */
object Notifier {
    const val CHANNEL = "panda_episodes"
    const val EXTRA_PATH = "panda_path"

    fun permission(context: Context): String = when {
        Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED -> "default"
        !NotificationManagerCompat.from(context).areNotificationsEnabled() -> "denied"
        else -> "granted"
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        if (nm.getNotificationChannel(CHANNEL) != null) return
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "New episodes and releases", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "New episodes of shows you follow and titles you set a reminder for"
        })
    }

    fun show(context: Context, tag: String, title: String, body: String, path: String) {
        if (permission(context) != "granted") return
        ensureChannel(context)
        val safePath = if (path.startsWith("/") && path.length < 200) path else "/calendar"
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_PATH, safePath)
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
        val pi = PendingIntent.getActivity(context, tag.hashCode(), intent, flags)
        val n = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_panda)
            .setColor(0xFF1F80E0.toInt())
            .setContentTitle(title.take(120))
            .setContentText(body.take(240))
            .setStyle(NotificationCompat.BigTextStyle().bigText(body.take(240)))
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
            .build()
        try { NotificationManagerCompat.from(context).notify(tag, 1, n) } catch (_: SecurityException) { }
    }
}
