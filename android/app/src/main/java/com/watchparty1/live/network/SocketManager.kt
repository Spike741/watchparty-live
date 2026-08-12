package com.watchparty1.live.network

import io.socket.client.IO
import io.socket.client.Socket
import java.net.URI

object SocketManager {

    var BACKEND_URL = "http://10.0.2.2:5000"

    private var socket: Socket? = null

    fun getSocket(url: String = BACKEND_URL): Socket {
        if (socket == null || BACKEND_URL != url) {
            BACKEND_URL = url
            val opts = IO.Options().apply {
                transports = arrayOf("websocket", "polling")
                reconnection = true
                reconnectionAttempts = 10
                reconnectionDelay = 2000
            }
            socket = IO.socket(URI.create(BACKEND_URL), opts)
        }
        return socket!!
    }

    fun connect() {
        getSocket().connect()
    }

    fun disconnect() {
        socket?.disconnect()
        socket = null
    }
}
