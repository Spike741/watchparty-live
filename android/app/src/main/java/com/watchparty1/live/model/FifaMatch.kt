package com.watchparty1.live.model

data class MatchEvent(
    val id: String,
    val type: String,        // "goal", "yellow_card", "red_card", "penalty"
    val team: String,        // "home" or "away"
    val player: String,
    val minute: Int
)

data class FifaMatch(
    val id: String,
    val teamA: String,
    val flagA: String,
    val teamB: String,
    val flagB: String,
    val time: String?,
    val stadium: String,
    val status: String,      // "upcoming", "live_score", "streaming", "finished"
    val scoreA: Int,
    val scoreB: Int,
    val elapsedMinute: Int,
    val events: List<MatchEvent>
)
