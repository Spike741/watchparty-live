package com.watchparty1.live

import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.watchparty1.live.adapter.MatchCardAdapter
import com.watchparty1.live.databinding.ActivityLobbyBinding
import com.watchparty1.live.model.FifaMatch
import com.watchparty1.live.network.SocketManager
import io.socket.emitter.Emitter
import org.json.JSONObject
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class LobbyActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLobbyBinding
    private lateinit var adapter: MatchCardAdapter
    private val gson = Gson()

    private var allMatches = listOf<FifaMatch>()
    private var showOnlyLive = true
    private var viewerCount = 0
    private var partyMembers = 1
    private var socketConnected = false

    private val colors = arrayOf("#38bdf8", "#4ade80", "#f43f5e", "#fb923c", "#a78bfa", "#f472b6", "#fbbf24")

    private var nickname: String
        get() = getSharedPreferences("watchparty", MODE_PRIVATE).getString("nickname", "") ?: ""
        set(v) = getSharedPreferences("watchparty", MODE_PRIVATE).edit().putString("nickname", v).apply()

    private var userColor: String
        get() = getSharedPreferences("watchparty", MODE_PRIVATE).getString("color", colors.random()) ?: colors[0]
        set(v) = getSharedPreferences("watchparty", MODE_PRIVATE).edit().putString("color", v).apply()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLobbyBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Handle top status bar insets to prevent header overlap with the notch/status bar
        ViewCompat.setOnApplyWindowInsetsListener(binding.header) { view, insets ->
            val statusBarInsets = insets.getInsets(WindowInsetsCompat.Type.statusBars())
            view.setPadding(
                view.paddingLeft,
                statusBarInsets.top,
                view.paddingRight,
                view.paddingBottom
            )
            val params = view.layoutParams
            params.height = (56 * resources.displayMetrics.density).toInt() + statusBarInsets.top
            view.layoutParams = params
            insets
        }

        setupRecyclerView()
        setupFilterChips()
        setupNicknameButton()
        setupSocket()
        setupAppearanceToggle()
        requestNotificationPermission()

        // Prompt for nickname if not set
        if (nickname.isEmpty()) showNicknameDialog()
        else updateNicknameButton()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        val savedMode = ThemeManager.getSavedMode(this)
        if (savedMode == AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM) {
            val intent = Intent(this, LobbyActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            }
            startActivity(intent)
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
            finish()
        }
    }



    private fun setupAppearanceToggle() {
        val currentMode = ThemeManager.getSavedMode(this)
        updateAppearanceToggleUI(currentMode)

        binding.btnThemeDark.setOnClickListener   { applyTheme(AppCompatDelegate.MODE_NIGHT_YES) }
        binding.btnThemeLight.setOnClickListener  { applyTheme(AppCompatDelegate.MODE_NIGHT_NO) }
        binding.btnThemeSystem.setOnClickListener { applyTheme(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM) }
    }

    private fun applyTheme(mode: Int) {
        ThemeManager.setMode(this, mode)
        val intent = Intent(this, LobbyActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        }
        startActivity(intent)
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        finish()
    }

    private fun updateAppearanceToggleUI(activeMode: Int) {
        val activeBg   = R.drawable.bg_filter_active
        val inactiveBg = android.R.color.transparent
        binding.btnThemeDark.setBackgroundResource(
            if (activeMode == AppCompatDelegate.MODE_NIGHT_YES) activeBg else inactiveBg)
        binding.btnThemeLight.setBackgroundResource(
            if (activeMode == AppCompatDelegate.MODE_NIGHT_NO) activeBg else inactiveBg)
        binding.btnThemeSystem.setBackgroundResource(
            if (activeMode == AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM) activeBg else inactiveBg)
    }

    private val notifPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* silently accept or deny — notifications are non-critical */ }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this, android.Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                notifPermLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun setupRecyclerView() {
        adapter = MatchCardAdapter(emptyList()) { match ->
            if (nickname.isEmpty()) {
                showNicknameDialog()
                return@MatchCardAdapter
            }
            val intent = Intent(this, StreamActivity::class.java).apply {
                putExtra("matchId", match.id)
                putExtra("teamA", match.teamA)
                putExtra("teamB", match.teamB)
                putExtra("status", match.status)
                putExtra("nickname", nickname)
                putExtra("userColor", userColor)
            }
            startActivity(intent)
        }
        binding.rvMatches.layoutManager = LinearLayoutManager(this)
        binding.rvMatches.adapter = adapter
    }

    private fun setupFilterChips() {
        binding.btnFilterLive.setOnClickListener {
            showOnlyLive = true
            binding.btnFilterLive.setBackgroundResource(R.drawable.bg_filter_active)
            binding.btnFilterLive.setTextColor(Color.WHITE)
            binding.btnFilterAll.setBackgroundResource(R.drawable.bg_filter_inactive)
            binding.btnFilterAll.setTextColor(Color.parseColor("#6b7280"))
            refreshList()
        }
        binding.btnFilterAll.setOnClickListener {
            showOnlyLive = false
            binding.btnFilterAll.setBackgroundResource(R.drawable.bg_filter_active)
            binding.btnFilterAll.setTextColor(Color.WHITE)
            binding.btnFilterLive.setBackgroundResource(R.drawable.bg_filter_inactive)
            binding.btnFilterLive.setTextColor(Color.parseColor("#6b7280"))
            refreshList()
        }
    }

    private fun setupNicknameButton() {
        binding.btnNickname.setOnClickListener { showNicknameDialog() }
    }

    private fun updateNicknameButton() {
        binding.btnNickname.text = "● $nickname"
        try {
            binding.btnNickname.setTextColor(Color.parseColor(userColor))
        } catch (e: Exception) {
            binding.btnNickname.setTextColor(Color.parseColor("#38bdf8"))
        }
    }

    private fun updateViewerCount() {
        val count = maxOf(viewerCount, partyMembers)
        binding.tvViewerCount.text = count.toString()
    }

    private fun setupSocket() {
        SocketManager.disconnect()
        val socket = SocketManager.getSocket()

        // Clear existing listeners to prevent duplicates and crashes
        socket.off(io.socket.client.Socket.EVENT_CONNECT)
        socket.off(io.socket.client.Socket.EVENT_DISCONNECT)
        socket.off("matches_update")
        socket.off("party_stats")

        socket.on(io.socket.client.Socket.EVENT_CONNECT, Emitter.Listener {
            socketConnected = true
            runOnUiThread {
                binding.viewConnectionDot.setBackgroundResource(R.drawable.bg_dot_green)
            }
        })

        socket.on(io.socket.client.Socket.EVENT_DISCONNECT, Emitter.Listener {
            socketConnected = false
            runOnUiThread {
                binding.viewConnectionDot.setBackgroundResource(R.drawable.bg_dot_amber)
            }
        })

        socket.on("matches_update", Emitter.Listener { args ->
            if (args.isEmpty()) return@Listener
            try {
                val data = args[0] as JSONObject
                val matchesJson = data.getJSONArray("matches").toString()
                val type = object : TypeToken<List<FifaMatch>>() {}.type
                allMatches = gson.fromJson(matchesJson, type)
                runOnUiThread { refreshList() }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        })

        socket.on("party_stats", Emitter.Listener { args ->
            if (args.isEmpty()) return@Listener
            try {
                val data = args[0] as JSONObject
                partyMembers = data.optInt("activeMembers", 1)
                runOnUiThread { updateViewerCount() }
            } catch (e: Exception) { }
        })

        SocketManager.connect()
    }

    override fun onDestroy() {
        super.onDestroy()
        val socket = SocketManager.getSocket()
        socket.off(io.socket.client.Socket.EVENT_CONNECT)
        socket.off(io.socket.client.Socket.EVENT_DISCONNECT)
        socket.off("matches_update")
        socket.off("party_stats")
    }

    private fun refreshList() {
        val filtered = if (showOnlyLive) {
            allMatches.filter { it.status == "streaming" || it.status == "live_score" || it.status == "upcoming" }
        } else allMatches

        val total = allMatches.size
        binding.btnFilterAll.text = "All ($total)"

        if (filtered.isEmpty()) {
            binding.rvMatches.visibility = View.GONE
            binding.tvEmpty.visibility = View.VISIBLE
        } else {
            binding.rvMatches.visibility = View.VISIBLE
            binding.tvEmpty.visibility = View.GONE
            adapter.updateMatches(filtered)
        }
    }

    private fun showNicknameDialog() {
        val dialogView = LayoutInflater.from(this).inflate(android.R.layout.simple_list_item_1, null)
        val input = EditText(this).apply {
            hint = "Enter your nickname"
            setHintTextColor(Color.parseColor("#6b7280"))
            setTextColor(Color.WHITE)
            setPadding(48, 32, 48, 32)
            setText(nickname)
            setBackgroundColor(Color.TRANSPARENT)
        }
        AlertDialog.Builder(this)
            .setTitle("👋 Join the Watch Party")
            .setMessage("Choose a display name to chat during the stream")
            .setView(input)
            .setCancelable(nickname.isNotEmpty())
            .setPositiveButton("Join") { _, _ ->
                val name = input.text.toString().trim()
                if (name.isEmpty()) {
                    Toast.makeText(this, "Please enter a nickname", Toast.LENGTH_SHORT).show()
                    showNicknameDialog()
                } else {
                    nickname = name
                    updateNicknameButton()
                }
            }
            .show()
    }

}
