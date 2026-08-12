package com.watchparty1.live.model

data class ChatMessage(
    val id: String,
    val user: String,
    val text: String,
    val color: String,
    val timestamp: String
)
