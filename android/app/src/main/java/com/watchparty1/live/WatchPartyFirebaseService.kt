package com.watchparty1.live

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import com.watchparty1.live.network.SocketManager

class WatchPartyFirebaseService : FirebaseMessagingService() {

    companion object {
        const val CHANNEL_ID = "watchparty_stream_alerts"
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val title = remoteMessage.notification?.title
            ?: remoteMessage.data["title"]
            ?: "⚽ Match Live!"

        val body = remoteMessage.notification?.body
            ?: remoteMessage.data["body"]
            ?: "A match is live — Hop in!!!!"

        showNotification(title, body)
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Re-register the new token whenever it refreshes
        Thread {
            try {
                val client = OkHttpClient()
                val json = JSONObject().apply { put("token", token) }
                val body = json.toString().toRequestBody("application/json".toMediaTypeOrNull())
                val request = Request.Builder()
                    .url("${SocketManager.BACKEND_URL}/api/fcm/register")
                    .post(body)
                    .build()
                client.newCall(request).execute().close()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }.start()
    }

    private fun showNotification(title: String, body: String) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create channel if needed (Android 8+)
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Stream Alerts",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notifications when a FIFA match goes live"
            enableVibration(true)
        }
        notificationManager.createNotificationChannel(channel)

        // Tap notification → open LobbyActivity
        val intent = Intent(this, LobbyActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setColor(getColor(R.color.red_live))
            .build()

        notificationManager.notify(1001, notification)
    }
}
