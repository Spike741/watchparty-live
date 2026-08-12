package com.watchparty1.live

import android.content.Context
import androidx.appcompat.app.AppCompatDelegate

/**
 * Manages the user-selected appearance mode (Dark / Light / System).
 * Call [apply] early in Application or Activity onCreate so the correct
 * mode is set before any view inflation.
 */
object ThemeManager {

    private const val PREFS_NAME = "watchparty_prefs"
    private const val KEY_NIGHT_MODE = "night_mode"

    const val MODE_DARK   = AppCompatDelegate.MODE_NIGHT_YES
    const val MODE_LIGHT  = AppCompatDelegate.MODE_NIGHT_NO
    const val MODE_SYSTEM = AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM

    /** Returns the saved mode (defaults to dark so existing users keep their experience). */
    fun getSavedMode(context: Context): Int {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getInt(KEY_NIGHT_MODE, MODE_DARK)
    }

    /** Persists and immediately applies the chosen mode app-wide. */
    fun setMode(context: Context, mode: Int) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putInt(KEY_NIGHT_MODE, mode)
            .apply()
        
        if (AppCompatDelegate.getDefaultNightMode() != mode) {
            AppCompatDelegate.setDefaultNightMode(mode)
        }
    }

    /** Call once per Application/Activity creation to restore the saved mode safely. */
    fun apply(context: Context) {
        val targetMode = getSavedMode(context)
        if (AppCompatDelegate.getDefaultNightMode() != targetMode) {
            AppCompatDelegate.setDefaultNightMode(targetMode)
        }
    }
}
