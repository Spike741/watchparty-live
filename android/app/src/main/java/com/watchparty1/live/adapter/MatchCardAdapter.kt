package com.watchparty1.live.adapter

import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.watchparty1.live.R
import com.watchparty1.live.databinding.ItemMatchCardBinding
import com.watchparty1.live.model.FifaMatch
import androidx.core.content.ContextCompat
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.*

class MatchCardAdapter(
    private var matches: List<FifaMatch>,
    private val onJoinClick: (FifaMatch) -> Unit
) : RecyclerView.Adapter<MatchCardAdapter.VH>() {

    inner class VH(val b: ItemMatchCardBinding) : RecyclerView.ViewHolder(b.root)

    private val flagCodes = mapOf(
        "Mexico" to "mx", "South Africa" to "za", "South Korea" to "kr",
        "Czech Republic" to "cz", "Paraguay" to "py", "Canada" to "ca",
        "Germany" to "de", "Australia" to "au", "Turkey" to "tr",
        "Qatar" to "qa", "Switzerland" to "ch", "USA" to "us",
        "United States" to "us", "Argentina" to "ar", "France" to "fr",
        "Brazil" to "br", "Spain" to "es", "Italy" to "it",
        "England" to "gb-eng", "Japan" to "jp", "Uruguay" to "uy",
        "Colombia" to "co", "Netherlands" to "nl", "Senegal" to "sn",
        "Portugal" to "pt", "Ghana" to "gh", "Morocco" to "ma",
        "Croatia" to "hr", "Belgium" to "be", "Honduras" to "hn",
        "Costa Rica" to "cr", "Panama" to "pa", "Saudi Arabia" to "sa",
        "Poland" to "pl", "Ecuador" to "ec", "Denmark" to "dk",
        "Tunisia" to "tn", "Wales" to "gb-wls", "Iran" to "ir",
        "Serbia" to "rs", "Cameroon" to "cm", "Scotland" to "gb-sct",
        "Ukraine" to "ua", "Sweden" to "se", "Austria" to "at",
        "Peru" to "pe", "Chile" to "cl", "Algeria" to "dz",
        "Nigeria" to "ng", "Egypt" to "eg", "Ivory Coast" to "ci",
        "Cote d'Ivoire" to "ci", "Côte d'Ivoire" to "ci",
        "New Zealand" to "nz", "Jamaica" to "jm", "Venezuela" to "ve",
        "Bolivia" to "bo", "Norway" to "no", "Iraq" to "iq",
        "Jordan" to "jo", "Uzbekistan" to "uz",
        "Bosnia and Herzegovina" to "ba", "Cape Verde" to "cv",
        "Curaçao" to "cw", "Curacao" to "cw",
        "Democratic Republic of the Congo" to "cd", "DR Congo" to "cd",
        "Haiti" to "ht", "Greece" to "gr", "Russia" to "ru", "Iceland" to "is"
    )

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val b = ItemMatchCardBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return VH(b)
    }

    override fun getItemCount() = matches.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        val match = matches[position]
        val b = holder.b
        val ctx = b.root.context

        b.tvMatchId.text = "Match #${match.id}"
        b.tvTeamA.text = match.teamA ?: "TBD"
        b.tvTeamB.text = match.teamB ?: "TBD"
        b.tvStadium.text = "📍 ${match.stadium}"

        // Format time
        b.tvTime.text = formatMatchTime(match.time)

        // Load flags via Glide
        loadFlag(b.imgFlagA, match.teamA)
        loadFlag(b.imgFlagB, match.teamB)

        // Status badge + score
        val primaryColor = ContextCompat.getColor(ctx, R.color.text_primary)
        val secondaryColor = ContextCompat.getColor(ctx, R.color.text_secondary)
        val mutedColor = ContextCompat.getColor(ctx, R.color.text_muted)
        val bgSurfaceColor = ContextCompat.getColor(ctx, R.color.bg_surface)

        when (match.status) {
            "streaming" -> {
                b.tvStatus.text = "● STREAMING LIVE"
                b.tvStatus.setBackgroundResource(R.drawable.bg_live_badge)
                b.tvStatus.setTextColor(Color.WHITE)
                if (match.scoreA != 0 || match.scoreB != 0) {
                    b.tvScore.text = "${match.scoreA} : ${match.scoreB}"
                    b.tvScore.setTextColor(primaryColor)
                } else {
                    b.tvScore.text = "VS"
                    b.tvScore.setTextColor(secondaryColor)
                }
                b.tvMinute.visibility = View.GONE

                // CTA button: red, join watch party
                b.btnJoin.text = "Join Watch Party (Live Now)"
                b.btnJoin.backgroundTintList = android.content.res.ColorStateList.valueOf(ContextCompat.getColor(ctx, R.color.red_live))
                b.btnJoin.setTextColor(Color.WHITE)
                b.btnJoin.visibility = View.VISIBLE
                b.btnJoin.setOnClickListener { onJoinClick(match) }
            }
            "live_score" -> {
                b.tvStatus.text = "● LIVE SCORE (${match.elapsedMinute}')"
                b.tvStatus.setBackgroundResource(R.drawable.bg_green_badge)
                b.tvStatus.setTextColor(Color.WHITE)
                b.tvScore.text = "${match.scoreA} : ${match.scoreB}"
                b.tvScore.setTextColor(primaryColor)
                b.tvMinute.text = "${match.elapsedMinute}'"
                b.tvMinute.visibility = View.VISIBLE
                b.tvMinute.setTextColor(ContextCompat.getColor(ctx, R.color.green_live))

                // CTA button: green, join chat room
                b.btnJoin.text = "Join Chat Room (Live Score)"
                b.btnJoin.backgroundTintList = android.content.res.ColorStateList.valueOf(ContextCompat.getColor(ctx, R.color.green_live))
                b.btnJoin.setTextColor(Color.WHITE)
                b.btnJoin.visibility = View.VISIBLE
                b.btnJoin.setOnClickListener { onJoinClick(match) }
            }
            "finished" -> {
                b.tvStatus.text = "FINAL SCORE"
                b.tvStatus.setBackgroundResource(R.drawable.bg_pill)
                b.tvStatus.setTextColor(mutedColor)
                b.tvScore.text = "${match.scoreA} : ${match.scoreB}"
                b.tvScore.setTextColor(secondaryColor)
                b.tvMinute.visibility = View.GONE

                // CTA: disabled "Match Completed"
                b.btnJoin.text = "Match Completed"
                b.btnJoin.backgroundTintList = android.content.res.ColorStateList.valueOf(bgSurfaceColor)
                b.btnJoin.setTextColor(mutedColor)
                b.btnJoin.isEnabled = false
                b.btnJoin.visibility = View.VISIBLE
            }
            else -> { // upcoming
                b.tvStatus.text = "SCHEDULED"
                b.tvStatus.setBackgroundResource(R.drawable.bg_pill)
                b.tvStatus.setTextColor(mutedColor)
                b.tvScore.text = "VS"
                b.tvScore.setTextColor(secondaryColor)
                b.tvMinute.visibility = View.GONE

                // CTA: dimmed, shows time
                val timeLabel = match.time?.let { formatMatchTime(it).substringAfter("•").trim() } ?: "Scheduled"
                b.btnJoin.text = "Starts at $timeLabel"
                b.btnJoin.backgroundTintList = android.content.res.ColorStateList.valueOf(bgSurfaceColor)
                b.btnJoin.setTextColor(mutedColor)
                b.btnJoin.isEnabled = false
                b.btnJoin.visibility = View.VISIBLE
            }
        }

        // Bind match events
        val events = match.events
        if (events != null && events.isNotEmpty()) {
            b.layoutEventsContainer.visibility = View.VISIBLE
            b.layoutEventsHome.removeAllViews()
            b.layoutEventsAway.removeAllViews()

            val homeEvents = events.filter { it.team == "home" || it.id.startsWith("home") }
            val awayEvents = events.filter { it.team == "away" || it.id.startsWith("away") }

            // Inflate and populate home events
            if (homeEvents.isEmpty()) {
                val tvEmpty = TextView(ctx).apply {
                    text = "-"
                    textSize = 10f
                    setTextColor(ContextCompat.getColor(ctx, R.color.text_muted))
                    gravity = Gravity.CENTER
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    )
                }
                b.layoutEventsHome.addView(tvEmpty)
            } else {
                for (ev in homeEvents) {
                    val tvEvent = TextView(ctx).apply {
                        text = "${getEventEmoji(ev.type)} ${ev.player} (${ev.minute}')"
                        textSize = 11f
                        setTextColor(primaryColor)
                        setPadding(0, 2, 0, 2)
                        layoutParams = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.WRAP_CONTENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        )
                    }
                    b.layoutEventsHome.addView(tvEvent)
                }
            }

            // Inflate and populate away events
            if (awayEvents.isEmpty()) {
                val tvEmpty = TextView(ctx).apply {
                    text = "-"
                    textSize = 10f
                    setTextColor(ContextCompat.getColor(ctx, R.color.text_muted))
                    gravity = Gravity.CENTER
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    )
                }
                b.layoutEventsAway.addView(tvEmpty)
            } else {
                for (ev in awayEvents) {
                    val tvEvent = TextView(ctx).apply {
                        text = "${getEventEmoji(ev.type)} ${ev.player} (${ev.minute}')"
                        textSize = 11f
                        setTextColor(primaryColor)
                        setPadding(0, 2, 0, 2)
                        layoutParams = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.WRAP_CONTENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        )
                    }
                    b.layoutEventsAway.addView(tvEvent)
                }
            }
        } else {
            b.layoutEventsContainer.visibility = View.GONE
        }
    }

    private fun getEventEmoji(type: String?): String {
        return when (type) {
            "penalty" -> "⚽ (P)"
            "yellow_card" -> "🟨"
            "red_card" -> "🟥"
            else -> "⚽"
        }
    }

    private fun loadFlag(imageView: android.widget.ImageView, teamName: String?) {
        val cleanName = teamName?.trim() ?: ""
        val code = flagCodes[cleanName]
        if (code != null) {
            Glide.with(imageView.context)
                .load("https://flagcdn.com/w80/$code.png")
                .placeholder(imageView.context.getDrawable(R.drawable.bg_flag))
                .into(imageView)
        } else {
            imageView.setImageResource(R.drawable.bg_flag)
        }
    }

    private fun formatMatchTime(isoTime: String?): String {
        if (isoTime == null) return "📅 Scheduled"
        return try {
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            sdf.timeZone = TimeZone.getTimeZone("UTC")
            val date = sdf.parse(isoTime)
            val outSdf = SimpleDateFormat("EEE, MMM d • h:mm a", Locale.US)
            outSdf.timeZone = TimeZone.getTimeZone("Asia/Kolkata")
            "📅 ${outSdf.format(date!!)} IST"
        } catch (e: Exception) {
            "📅 $isoTime"
        }
    }

    fun updateMatches(newMatches: List<FifaMatch>) {
        matches = newMatches
        notifyDataSetChanged()
    }
}
