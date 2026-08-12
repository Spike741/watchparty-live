package com.watchparty1.live

import android.app.PictureInPictureParams
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Rational
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.ArrayAdapter
import android.widget.GridView
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.annotation.OptIn
import androidx.annotation.RequiresApi
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.watchparty1.live.adapter.ChatAdapter
import com.watchparty1.live.databinding.ActivityStreamBinding
import com.watchparty1.live.model.ChatMessage
import com.watchparty1.live.model.FifaMatch
import com.watchparty1.live.network.SocketManager
import io.socket.emitter.Emitter
import org.json.JSONObject


class StreamActivity : AppCompatActivity() {

    private lateinit var binding: ActivityStreamBinding
    private lateinit var chatAdapter: ChatAdapter
    private lateinit var player: ExoPlayer
    private val gson = Gson()
    private val handler = Handler(Looper.getMainLooper())

    private var isFullscreen = false
    private var isMuted = true
    private var isPlaying = false
    private var streamOffline = false
    private var videoFitMode = "contain" // "contain" or "cover"

    // Snapshot of UI state saved just before entering PiP — restored on PiP exit
    private data class PrePipState(
        val chatVisible: Boolean,
        val wasLandscape: Boolean,
        val wasFullscreen: Boolean
    )
    private var prePipState: PrePipState? = null

    private val HLS_URL by lazy { intent.getStringExtra("hlsUrl") ?: "http://10.0.2.2:8888/live/party/index.m3u8" }

    private val matchId: String by lazy { intent.getStringExtra("matchId") ?: "" }
    private val teamA: String by lazy { intent.getStringExtra("teamA") ?: "Home" }
    private val teamB: String by lazy { intent.getStringExtra("teamB") ?: "Away" }
    private val matchStatus: String by lazy { intent.getStringExtra("status") ?: "streaming" }
    private val nickname: String by lazy { intent.getStringExtra("nickname") ?: "Guest" }
    private val userColor: String by lazy { intent.getStringExtra("userColor") ?: "#38bdf8" }

    private val controlsHideRunnable = Runnable {
        if (isPlaying) hideControls()
    }

    // True when chat panel is visible
    private val isChatVisible get() = binding.chatContainer.visibility == View.VISIBLE
    // PiP tracking
    private var isInPipMode = false

    private fun closeChatOverlay() {
        val isLand = resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        val animator = binding.chatContainer.animate()
        
        if (isLand) {
            val width = binding.chatContainer.width.toFloat().takeIf { it > 0 } ?: 400f
            animator.translationX(width)
        } else {
            val height = binding.chatContainer.height.toFloat().takeIf { it > 0 } ?: 800f
            animator.translationY(height)
        }
        
        animator.alpha(0f)
            .setDuration(250)
            .withEndAction {
                binding.chatContainer.visibility = View.GONE
                binding.chatContainer.translationX = 0f
                binding.chatContainer.translationY = 0f
                binding.chatContainer.alpha = 1f
                applyLayoutConstraints(isLand)
            }.start()
    }

    private fun showChatOverlay() {
        val isLand = resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        binding.chatContainer.visibility = View.VISIBLE
        binding.chatContainer.alpha = 0f
        
        if (isLand) {
            val width = binding.chatContainer.width.toFloat().takeIf { it > 0 } ?: 400f
            binding.chatContainer.translationX = width
            binding.chatContainer.translationY = 0f
        } else {
            val height = binding.chatContainer.height.toFloat().takeIf { it > 0 } ?: 800f
            binding.chatContainer.translationY = height
            binding.chatContainer.translationX = 0f
        }
        
        applyLayoutConstraints(isLand)
        
        binding.chatContainer.animate()
            .translationX(0f)
            .translationY(0f)
            .alpha(1f)
            .setDuration(250)
            .start()
    }

    @OptIn(UnstableApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 1. Enable drawing under status bar, navigation bar and notch
        //    + Keep screen on while watching the stream
        window.addFlags(
            WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = android.graphics.Color.TRANSPARENT
        window.navigationBarColor = android.graphics.Color.TRANSPARENT
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isNavigationBarContrastEnforced = false
            window.isStatusBarContrastEnforced = false
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode = 
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }

        val insetsController = WindowCompat.getInsetsController(window, window.decorView)
        insetsController.isAppearanceLightStatusBars = false
        insetsController.isAppearanceLightNavigationBars = false
        
        binding = ActivityStreamBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // 2. Adjust paddings so system bars and keyboard don't cover text/buttons
        ViewCompat.setOnApplyWindowInsetsListener(binding.rootStream) { _, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            val density = resources.displayMetrics.density
            val isLand = resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
            
            if (!isLand) {
                // Portrait: pad root from top so video does not go under status bar / notch
                binding.rootStream.setPadding(0, systemBars.top, 0, 0)
                // Set top bar padding without systemBars.top since root is already pushed down
                binding.controlsTopBar.setPadding(
                    binding.controlsTopBar.paddingLeft,
                    (12 * density).toInt(),
                    binding.controlsTopBar.paddingRight,
                    binding.controlsTopBar.paddingBottom
                )
            } else {
                // Landscape: allow video to go fullscreen under status bar
                binding.rootStream.setPadding(0, 0, 0, 0)
                // Pad controlsTopBar to avoid notch collision
                binding.controlsTopBar.setPadding(
                    binding.controlsTopBar.paddingLeft,
                    systemBars.top + (12 * density).toInt(),
                    binding.controlsTopBar.paddingRight,
                    binding.controlsTopBar.paddingBottom
                )
            }
            
            // Pad the bottom to avoid keyboard/layout collision (10dp base)
            val bottomPadding = if (ime.bottom > 0) ime.bottom else systemBars.bottom
            binding.chatInputBar.setPadding(
                binding.chatInputBar.paddingLeft,
                binding.chatInputBar.paddingTop,
                binding.chatInputBar.paddingRight,
                bottomPadding + (10 * density).toInt()
            )
            insets
        }

        setupStream()
        setupChat()
        setupControls()
        connectSocket()
        setupPipGesture()

        // Back gesture / button logic:
        // If landscape + chat open → close chat
        // If landscape + chat closed → rotate to portrait first
        // If portrait → finish()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val isLand = resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
                when {
                    isChatVisible -> closeChatOverlay()
                    isLand -> {
                        // Animate to portrait, then let next back finish
                        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                        val ctrl = WindowInsetsControllerCompat(window, window.decorView)
                        ctrl.show(WindowInsetsCompat.Type.systemBars())
                        isFullscreen = false
                        binding.btnFullscreen.setImageResource(R.drawable.ic_fullscreen)
                    }
                    else -> {
                        isEnabled = false
                        overridePendingTransition(0, android.R.anim.slide_out_right)
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        })

        // If socket was already connected (reused from Lobby), manually bootstrap data
        val socket = SocketManager.getSocket()
        if (socket.connected()) {
            val joinData = JSONObject().apply {
                put("user", nickname)
                put("color", userColor)
            }
            socket.emit("join_party", joinData)
            socket.emit("request_chat_history")
        }

        val isLand = resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        applyLayoutConstraints(isLand)
    }

    @OptIn(UnstableApi::class)
    private fun setupStream() {
        val isScoreOnly = matchStatus == "live_score"

        if (isScoreOnly) {
            // Score-only mode: hide player, show score header in title
            binding.playerView.visibility = View.GONE
            binding.controlsOverlay.visibility = View.GONE
            binding.chatDivider.visibility = View.GONE
            binding.tvStreamTitle.text = "⚽ $teamA vs $teamB — Live Score"
        } else {
            // Full streaming mode
            binding.tvStreamTitle.text = "🔴 $teamA vs $teamB"
            initExoPlayer()
        }
    }

    @OptIn(UnstableApi::class)
    private fun initExoPlayer() {
        player = ExoPlayer.Builder(this).build()
        binding.playerView.player = player
        binding.playerView.useController = false

        val mediaItem = MediaItem.fromUri(HLS_URL)
        player.setMediaItem(mediaItem)
        player.prepare()
        player.volume = 0f // start muted
        isMuted = true
        updateMuteIcon()
        player.playWhenReady = true

        binding.progressLoading.visibility = View.VISIBLE

        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                when (state) {
                    Player.STATE_READY -> {
                        isPlaying = player.playWhenReady
                        binding.progressLoading.visibility = View.GONE
                        binding.layoutOffline.visibility = View.GONE
                        updatePlayPauseIcon()
                        resetControlsTimeout()
                    }
                    Player.STATE_BUFFERING -> {
                        binding.progressLoading.visibility = View.VISIBLE
                    }
                    Player.STATE_ENDED, Player.STATE_IDLE -> {
                        binding.progressLoading.visibility = View.GONE
                    }
                }
            }

            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
                updatePlayPauseIcon()
            }

            override fun onPlayerError(error: PlaybackException) {
                binding.progressLoading.visibility = View.GONE
                binding.layoutOffline.visibility = View.VISIBLE
                streamOffline = true
            }
        })
    }

    private fun setupControls() {
        binding.btnPlayPause.setOnClickListener {
            if (::player.isInitialized) {
                if (isPlaying) player.pause() else player.play()
                resetControlsTimeout()
            }
        }

        binding.btnMute.setOnClickListener {
            if (::player.isInitialized) {
                isMuted = !isMuted
                player.volume = if (isMuted) 0f else 1f
                updateMuteIcon()
                // Bounce animation for tactile feedback
                binding.btnMute.animate()
                    .scaleX(1.25f).scaleY(1.25f).setDuration(80)
                    .withEndAction {
                        binding.btnMute.animate().scaleX(1f).scaleY(1f).setDuration(80).start()
                    }.start()
                resetControlsTimeout()
            }
        }

        binding.btnFullscreen.setOnClickListener {
            toggleFullscreen()
            resetControlsTimeout()
        }

        binding.btnVideoScale.setOnClickListener {
            if (videoFitMode == "contain") {
                videoFitMode = "cover"
                binding.btnVideoScale.text = "FIT"
                binding.playerView.resizeMode = androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_ZOOM
            } else {
                videoFitMode = "contain"
                binding.btnVideoScale.text = "FILL"
                binding.playerView.resizeMode = androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FIT
            }
            resetControlsTimeout()
        }

        binding.btnChatToggle.setOnClickListener {
            if (isChatVisible) closeChatOverlay()
            else showChatOverlay()
            resetControlsTimeout()
        }

        binding.controlsOverlay.setOnClickListener {
            if (binding.btnPlayPause.visibility == View.VISIBLE) {
                hideControls()
            } else {
                showControls()
                resetControlsTimeout()
            }
        }

        // Back button in top-bar: close chat if open, else landscape→portrait, else go back
        binding.btnBack.setOnClickListener {
            onBackPressedDispatcher.onBackPressed()
        }

        binding.btnRetry.setOnClickListener {
            binding.layoutOffline.visibility = View.GONE
            if (::player.isInitialized) {
                player.prepare()
                player.playWhenReady = true
            }
        }

        binding.etMessage.setOnEditorActionListener { _, _, _ ->
            sendMessage()
            true
        }

        binding.btnSend.setOnClickListener { sendMessage() }

        // Reaction Button Click Listeners
        binding.btnReactionGoal.setOnClickListener { sendReaction("⚽") }
        binding.btnReactionCry.setOnClickListener { sendReaction("😢") }
        binding.btnReactionLove.setOnClickListener { sendReaction("❤️") }
        binding.btnReactionHappy.setOnClickListener { sendReaction("😊") }
        binding.btnReactionSuspicious.setOnClickListener { sendReaction("🤨") }
        binding.btnReactionYellowCard.setOnClickListener { sendReaction("🟨") }
        binding.btnReactionRedCard.setOnClickListener { sendReaction("🟥") }
        binding.btnFullEmoji.setOnClickListener { showFullEmojiPicker() }
    }

    private fun showControls() {
        binding.btnPlayPause.visibility = View.VISIBLE
        binding.controlsTopBar.visibility = View.VISIBLE
        binding.controlsBottomBar.visibility = View.VISIBLE
        binding.controlsOverlay.setBackgroundResource(R.drawable.bg_gradient_controls)
    }

    private fun hideControls() {
        binding.btnPlayPause.visibility = View.GONE
        binding.controlsTopBar.visibility = View.GONE
        binding.controlsBottomBar.visibility = View.GONE
        binding.controlsOverlay.background = null
    }

    private fun resetControlsTimeout() {
        showControls()
        handler.removeCallbacks(controlsHideRunnable)
        handler.postDelayed(controlsHideRunnable, 3000)
    }

    private fun updatePlayPauseIcon() {
        binding.btnPlayPause.setImageResource(
            if (isPlaying) R.drawable.ic_pause
            else R.drawable.ic_play
        )
    }

    /** Updates the mute button icon, tint, background and label to reflect current mute state */
    private fun updateMuteIcon() {
        if (isMuted) {
            binding.btnMute.setImageResource(R.drawable.ic_mute)
            binding.btnMute.setColorFilter(android.graphics.Color.parseColor("#FF4444"))
            binding.btnMute.setBackgroundResource(R.drawable.bg_circle_button)
            binding.tvMuteLabel.text = "MUTED"
            binding.tvMuteLabel.setTextColor(android.graphics.Color.parseColor("#FF4444"))
        } else {
            binding.btnMute.setImageResource(R.drawable.ic_unmute)
            binding.btnMute.setColorFilter(android.graphics.Color.WHITE)
            binding.btnMute.setBackgroundResource(R.drawable.bg_circle_button)
            binding.tvMuteLabel.text = "ON"
            binding.tvMuteLabel.setTextColor(android.graphics.Color.parseColor("#4ade80"))
        }
        // Brief alpha flash to draw attention to the state change
        binding.tvMuteLabel.alpha = 0f
        binding.tvMuteLabel.animate().alpha(1f).setDuration(200).start()
    }

    private fun toggleFullscreen() {
        isFullscreen = !isFullscreen
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        if (isFullscreen) {
            // Force screen rotation to landscape for video playback
            requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            
            // Hide status bar and navigation bar completely
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            binding.btnFullscreen.setImageResource(R.drawable.ic_fullscreen_exit)
        } else {
            // Restore screen rotation to follow user preference
            requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            
            // Show status bar and navigation bar
            controller.show(WindowInsetsCompat.Type.systemBars())
            binding.btnFullscreen.setImageResource(R.drawable.ic_fullscreen)
        }

        val isLand = resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
        applyLayoutConstraints(isLand)
        ViewCompat.requestApplyInsets(binding.rootStream)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        
        // Handle system theme change relaunch if in system theme mode
        val savedMode = ThemeManager.getSavedMode(this)
        if (savedMode == androidx.appcompat.app.AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM) {
            val intent = android.content.Intent(this, StreamActivity::class.java).apply {
                addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK)
                putExtra("matchId", matchId)
                putExtra("teamA", teamA)
                putExtra("teamB", teamB)
                putExtra("status", matchStatus)
                putExtra("nickname", nickname)
                putExtra("userColor", userColor)
            }
            startActivity(intent)
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
            finish()
            return
        }

        val isLand = newConfig.orientation == Configuration.ORIENTATION_LANDSCAPE
        applyLayoutConstraints(isLand)
        ViewCompat.requestApplyInsets(binding.rootStream)
        // Re-update PiP params when orientation changes
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && isInPipMode) updatePipParams()
    }

    /** Enters PiP mode — saves current UI state first, then enters 16:9 PiP */
    private fun enterPipMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Snapshot state before UI is stripped for PiP
            prePipState = PrePipState(
                chatVisible = isChatVisible,
                wasLandscape = resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE,
                wasFullscreen = isFullscreen
            )
            updatePipParams()
        }
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private fun updatePipParams() {
        val params = PictureInPictureParams.Builder()
            .setAspectRatio(Rational(16, 9))
            .apply {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    setSeamlessResizeEnabled(true)
                    setAutoEnterEnabled(false)
                }
            }
            .build()
        enterPictureInPictureMode(params)
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        isInPipMode = isInPictureInPictureMode
        if (isInPictureInPictureMode) {
            // Strip all UI chrome — just show the raw video in PiP window
            binding.controlsOverlay.visibility = View.INVISIBLE
            binding.chatContainer.visibility = View.GONE
            binding.broadcastAlertBanner.visibility = View.GONE
        } else {
            // --- Restore exactly the state that existed before PiP was entered ---
            binding.controlsOverlay.visibility = View.VISIBLE
            val saved = prePipState
            if (saved != null) {
                // Restore orientation
                isFullscreen = saved.wasFullscreen
                if (saved.wasLandscape) {
                    requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                    val ctrl = WindowInsetsControllerCompat(window, window.decorView)
                    if (saved.wasFullscreen) {
                        ctrl.hide(WindowInsetsCompat.Type.systemBars())
                        ctrl.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    } else {
                        ctrl.show(WindowInsetsCompat.Type.systemBars())
                    }
                    binding.btnFullscreen.setImageResource(
                        if (saved.wasFullscreen) R.drawable.ic_fullscreen_exit else R.drawable.ic_fullscreen
                    )
                } else {
                    requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                    WindowInsetsControllerCompat(window, window.decorView)
                        .show(WindowInsetsCompat.Type.systemBars())
                    binding.btnFullscreen.setImageResource(R.drawable.ic_fullscreen)
                }
                // Restore chat panel
                if (saved.chatVisible) {
                    binding.chatContainer.visibility = View.VISIBLE
                } else {
                    binding.chatContainer.visibility = View.GONE
                }
                prePipState = null
            }
            val isLand = resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
            applyLayoutConstraints(isLand)
            ViewCompat.requestApplyInsets(binding.rootStream)
        }
    }

    /** Sets up swipe-up gesture on the root view to enter PiP */
    private fun setupPipGesture() {
        val gestureDetector = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            private val SWIPE_UP_THRESHOLD = 120
            private val SWIPE_VELOCITY_THRESHOLD = 400
            override fun onFling(e1: MotionEvent?, e2: MotionEvent, vX: Float, vY: Float): Boolean {
                if (e1 == null) return false
                val deltaY = e2.y - e1.y
                if (deltaY < -SWIPE_UP_THRESHOLD && Math.abs(vY) > SWIPE_VELOCITY_THRESHOLD) {
                    enterPipMode()
                    return true
                }
                return false
            }
        })
        binding.rootStream.setOnTouchListener { v, event ->
            gestureDetector.onTouchEvent(event)
            // Still pass touches to children
            v.performClick()
            false
        }
    }

    private fun applyLayoutConstraints(isLand: Boolean) {
        val playerParams = binding.playerView.layoutParams as androidx.constraintlayout.widget.ConstraintLayout.LayoutParams
        val dividerParams = binding.chatDivider.layoutParams as androidx.constraintlayout.widget.ConstraintLayout.LayoutParams
        val chatParams = binding.chatContainer.layoutParams as androidx.constraintlayout.widget.ConstraintLayout.LayoutParams
        val overlayParams = binding.controlsOverlay.layoutParams as androidx.constraintlayout.widget.ConstraintLayout.LayoutParams

        // Helper to reset constraints
        fun resetParams(p: androidx.constraintlayout.widget.ConstraintLayout.LayoutParams) {
            p.topToTop = -1
            p.topToBottom = -1
            p.bottomToTop = -1
            p.bottomToBottom = -1
            p.startToStart = -1
            p.startToEnd = -1
            p.endToStart = -1
            p.endToEnd = -1
        }

        resetParams(playerParams)
        resetParams(dividerParams)
        resetParams(chatParams)
        resetParams(overlayParams)

        val isChatVisible = binding.chatContainer.visibility == View.VISIBLE

        if (isLand) {
            if (isChatVisible) {
                // Landscape normal/split: 60% video on left, 40% chat on right
                binding.chatDivider.visibility = View.VISIBLE

                playerParams.width = 0
                playerParams.height = 0
                playerParams.dimensionRatio = null
                playerParams.topToTop = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                playerParams.bottomToBottom = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                playerParams.startToStart = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                playerParams.endToStart = binding.guidelineLandscape.id

                dividerParams.width = (1 * resources.displayMetrics.density).toInt()
                dividerParams.height = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.MATCH_PARENT
                dividerParams.topToTop = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                dividerParams.bottomToBottom = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                dividerParams.startToStart = binding.guidelineLandscape.id
                dividerParams.endToEnd = binding.guidelineLandscape.id

                chatParams.width = 0
                chatParams.height = 0
                chatParams.topToTop = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                chatParams.bottomToBottom = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                chatParams.startToEnd = binding.guidelineLandscape.id
                chatParams.endToEnd = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
            } else {
                // Landscape full: 100% video, hide chat/divider
                binding.chatDivider.visibility = View.GONE

                playerParams.width = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.MATCH_PARENT
                playerParams.height = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.MATCH_PARENT
                playerParams.dimensionRatio = null
                
                playerParams.topToTop = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                playerParams.bottomToBottom = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                playerParams.startToStart = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                playerParams.endToEnd = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
            }
        } else {
            if (isChatVisible) {
                // Portrait split: 16:9 video on top, chat below
                binding.chatDivider.visibility = View.VISIBLE

                playerParams.width = 0
                playerParams.height = 0
                playerParams.dimensionRatio = "H,16:9"
                playerParams.topToTop = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                playerParams.startToStart = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                playerParams.endToEnd = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID

                dividerParams.width = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.MATCH_PARENT
                dividerParams.height = (1 * resources.displayMetrics.density).toInt()
                dividerParams.topToBottom = binding.playerView.id
                dividerParams.startToStart = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                dividerParams.endToEnd = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID

                chatParams.width = 0
                chatParams.height = 0
                chatParams.topToBottom = binding.chatDivider.id
                chatParams.bottomToBottom = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                chatParams.startToStart = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                chatParams.endToEnd = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
            } else {
                // Portrait full: 16:9 video centered vertically, hide chat/divider
                binding.chatDivider.visibility = View.GONE

                playerParams.width = 0
                playerParams.height = 0
                playerParams.dimensionRatio = "H,16:9"
                playerParams.topToTop = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                playerParams.bottomToBottom = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                playerParams.startToStart = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
                playerParams.endToEnd = androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.PARENT_ID
            }
        }

        binding.playerView.layoutParams = playerParams
        binding.chatDivider.layoutParams = dividerParams
        binding.chatContainer.layoutParams = chatParams

        // Bind controlsOverlay constraints to playerView
        overlayParams.width = 0
        overlayParams.height = 0
        overlayParams.topToTop = binding.playerView.id
        overlayParams.bottomToBottom = binding.playerView.id
        overlayParams.startToStart = binding.playerView.id
        overlayParams.endToEnd = binding.playerView.id
        binding.controlsOverlay.layoutParams = overlayParams
    }

    private fun setupChat() {
        chatAdapter = ChatAdapter(mutableListOf(), nickname)
        binding.rvChat.layoutManager = LinearLayoutManager(this).apply {
            stackFromEnd = true
        }
        binding.rvChat.adapter = chatAdapter
    }

    private fun sendMessage() {
        val text = binding.etMessage.text.toString().trim()
        if (text.isEmpty()) return

        val socket = SocketManager.getSocket()
        val data = JSONObject().apply {
            put("user", nickname)
            put("text", text)
            put("color", userColor)
        }
        socket.emit("send_message", data)
        binding.etMessage.setText("")
    }

    private fun connectSocket() {
        val socket = SocketManager.getSocket()

        // Clear existing listeners first to prevent duplicates/leaks on recreation
        socket.off("chat_history")
        socket.off("receive_message")
        socket.off("party_stats")
        socket.off("kick_stream")
        socket.off("receive_reaction")
        socket.off("receive_broadcast_alert")
        socket.off("connect")
        socket.off("matches_update")

        socket.on("chat_history", Emitter.Listener { args ->
            if (args.isEmpty()) return@Listener
            try {
                val type = object : com.google.gson.reflect.TypeToken<List<ChatMessage>>() {}.type
                val messages: List<ChatMessage> = gson.fromJson(args[0].toString(), type)
                runOnUiThread {
                    chatAdapter.setMessages(messages)
                    binding.rvChat.scrollToPosition(chatAdapter.itemCount - 1)
                }
            } catch (e: Exception) { e.printStackTrace() }
        })

        socket.on("receive_message", Emitter.Listener { args ->
            if (args.isEmpty()) return@Listener
            try {
                val msg = gson.fromJson(args[0].toString(), ChatMessage::class.java)
                runOnUiThread {
                    chatAdapter.addMessage(msg)
                    binding.rvChat.scrollToPosition(chatAdapter.itemCount - 1)
                }
            } catch (e: Exception) { e.printStackTrace() }
        })

        socket.on("party_stats", Emitter.Listener { args ->
            if (args.isEmpty()) return@Listener
            try {
                val data = args[0] as JSONObject
                val count = data.optInt("activeMembers", 1)
                runOnUiThread { binding.tvStreamViewers.text = count.toString() }
            } catch (e: Exception) { }
        })

        socket.on("receive_broadcast_alert", Emitter.Listener { args ->
            if (args.isEmpty()) return@Listener
            try {
                val data = args[0] as JSONObject
                val text = data.optString("text")
                runOnUiThread { showBroadcastBanner(text) }
            } catch (e: Exception) { e.printStackTrace() }
        })

        socket.on("kick_stream", Emitter.Listener { args ->
            if (args.isEmpty()) return@Listener
            try {
                val data = args[0] as JSONObject
                val id = data.optString("id")
                if (id == matchId) {
                    runOnUiThread {
                        android.app.AlertDialog.Builder(this)
                            .setTitle("Stream Ended")
                            .setMessage("The watch party stream has been terminated by the host.")
                            .setPositiveButton("OK") { _, _ -> finish() }
                            .setCancelable(false)
                            .show()
                    }
                }
            } catch (e: Exception) { }
        })
        // Listen for reactions from other clients and show floating emoji locally
        socket.on("receive_reaction", Emitter.Listener { args ->
            if (args.isEmpty()) return@Listener
            try {
                val data = args[0] as JSONObject
                val emoji = data.optString("emoji", "⚽")
                runOnUiThread { triggerEmojiFlood(emoji) }
            } catch (e: Exception) { e.printStackTrace() }
        })

        // Listen for match updates to refresh scores and match minutes in real-time
        socket.on("matches_update", Emitter.Listener { args ->
            if (args.isEmpty()) return@Listener
            try {
                val data = args[0] as JSONObject
                val matchesJson = data.getJSONArray("matches").toString()
                val type = object : com.google.gson.reflect.TypeToken<List<com.watchparty1.live.model.FifaMatch>>() {}.type
                val matches: List<com.watchparty1.live.model.FifaMatch> = gson.fromJson(matchesJson, type)
                
                val activeMatch = matches.find { it.id == matchId }
                if (activeMatch != null) {
                    runOnUiThread {
                        updateLiveScoreUI(activeMatch)
                    }
                }
            } catch (e: Exception) { e.printStackTrace() }
        })

        // If newly connected here, emit join_party now
        socket.on("connect", Emitter.Listener {
            val joinData = JSONObject().apply {
                put("user", nickname)
                put("color", userColor)
            }
            socket.emit("join_party", joinData)
        })
    }

    override fun onPause() {
        super.onPause()
        // Keep playing video in PiP; pause otherwise
        if (!isInPipMode) {
            if (::player.isInitialized) player.pause()
        }
    }

    override fun onResume() {
        super.onResume()
        if (!isInPipMode && ::player.isInitialized && !streamOffline) player.play()
    }



    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        // Auto-enter PiP when user presses home button
        if (::player.isInitialized && isPlaying) enterPipMode()
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        if (::player.isInitialized) {
            player.release()
        }
        SocketManager.getSocket().off("chat_history")
        SocketManager.getSocket().off("receive_message")
        SocketManager.getSocket().off("party_stats")
        SocketManager.getSocket().off("kick_stream")
        SocketManager.getSocket().off("receive_reaction")
        SocketManager.getSocket().off("receive_broadcast_alert")
        SocketManager.getSocket().off("connect")
        SocketManager.getSocket().off("matches_update")
    }

    private fun updateLiveScoreUI(match: com.watchparty1.live.model.FifaMatch) {
        val timeLabel = when (match.status) {
            "finished" -> "FT"
            "upcoming" -> ""
            else -> "${match.elapsedMinute}'"
        }
        val suffix = if (timeLabel.isNotEmpty()) " ($timeLabel)" else ""
        
        val isScoreOnly = match.status == "live_score"
        val prefix = if (isScoreOnly) "⚽" else "🔴"
        
        binding.tvStreamTitle.text = "$prefix ${match.teamA}  ${match.scoreA} - ${match.scoreB}  ${match.teamB}$suffix"
    }

    private fun sendReaction(emoji: String) {
        // Show emoji flooding locally immediately (don't wait for server round-trip)
        triggerEmojiFlood(emoji)
        // Broadcast to everyone else
        val socket = SocketManager.getSocket()
        val data = JSONObject().apply {
            put("emoji", emoji)
        }
        socket.emit("send_reaction", data)
    }

    /** Shows a sliding broadcast alert banner (like the browser popup) and auto-dismisses after 8s */
    private fun showBroadcastBanner(text: String) {
        binding.tvBroadcastText.text = text
        binding.broadcastAlertBanner.visibility = View.VISIBLE
        binding.broadcastAlertBanner.alpha = 0f
        binding.broadcastAlertBanner.translationY = 30f
        binding.broadcastAlertBanner.animate()
            .alpha(1f).translationY(0f).setDuration(300).start()
        // Auto-dismiss after 8 seconds
        handler.removeCallbacksAndMessages("broadcast")
        handler.postDelayed({
            binding.broadcastAlertBanner.animate()
                .alpha(0f).translationY(20f).setDuration(300)
                .withEndAction { binding.broadcastAlertBanner.visibility = View.GONE }
                .start()
        }, 8000)
    }

    /** Spawns multiple floating emojis with staggered delays — like browser flood */
    private fun triggerEmojiFlood(emoji: String) {
        val count = 6
        for (i in 0 until count) {
            handler.postDelayed({ floatEmojiOnScreen(emoji) }, (i * 120L))
        }
    }

    /** Spawns a floating emoji that rises up over the video player and fades out */
    private fun floatEmojiOnScreen(emoji: String) {
        val container = binding.controlsOverlay
        val tv = TextView(this).apply {
            text = emoji
            textSize = 28f
            // Random horizontal position in the left 80% of the container
            val containerWidth = container.width.takeIf { it > 0 } ?: 600
            val xPos = (Math.random() * containerWidth * 0.75).toFloat()
            translationX = xPos
            // Start from the bottom of the container
            translationY = container.height.toFloat()
            alpha = 1f
        }
        container.addView(tv, ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ))

        val distance = (container.height * 0.85f)
        val moveUp = ObjectAnimator.ofFloat(tv, "translationY",
            container.height.toFloat(), container.height.toFloat() - distance)
        moveUp.duration = 2200

        val fadeOut = ObjectAnimator.ofFloat(tv, "alpha", 1f, 0f)
        fadeOut.duration = 700
        fadeOut.startDelay = 1500

        val set = AnimatorSet()
        set.playTogether(moveUp, fadeOut)
        set.addListener(object : AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: Animator) {
                container.removeView(tv)
            }
        })
        set.start()
    }

    private fun showFullEmojiPicker() {
        val dialog = BottomSheetDialog(this)
        val dialogView = layoutInflater.inflate(R.layout.dialog_emoji_picker, null)
        
        val allEmojis = listOf(
            // Category: Smileys
            "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘",
            "😋", "😛", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "🥺",
            // Category: Hands/People
            "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "👏", "🙌", "👐", "🙏", "💪", "🧠", "👀",
            // Category: Football / Fun
            "⚽", "🥅", "🟨", "🟥", "🏆", "🥇", "🥈", "🥉", "🏅", "📣", "📢", "🔥", "💥", "🌟", "✨", "💯"
        )
        
        val gridView = dialogView.findViewById<GridView>(R.id.emojiGrid)
        gridView.adapter = object : ArrayAdapter<String>(this, android.R.layout.simple_list_item_1, allEmojis) {
            override fun getView(position: Int, convertView: android.view.View?, parent: android.view.ViewGroup): android.view.View {
                val tv = super.getView(position, convertView, parent) as TextView
                tv.text = getItem(position)
                tv.textSize = 24f
                tv.gravity = android.view.Gravity.CENTER
                tv.setPadding(0, 16, 0, 16)
                tv.setTextColor(android.graphics.Color.WHITE)
                return tv
            }
        }
        
        gridView.setOnItemClickListener { _, _, position, _ ->
            val emoji = allEmojis[position]
            sendReaction(emoji)
            dialog.dismiss()
        }
        
        dialog.setContentView(dialogView)
        dialog.show()
    }
}
