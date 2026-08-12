package com.watchparty1.live

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.google.firebase.messaging.FirebaseMessaging
import com.watchparty1.live.network.SocketManager
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        // Register FCM token with our backend so server can send push notifications
        registerFcmToken()

        // Go straight to lobby
        startActivity(Intent(this, LobbyActivity::class.java))
        finish()
    }

    private fun registerFcmToken() {
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            if (token.isNotEmpty()) {
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
        }
    }
}
