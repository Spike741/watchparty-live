package com.watchparty1.live

import android.app.Application

class WatchPartyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialize/apply the saved theme mode once on app launch before any activity starts
        ThemeManager.apply(this)
    }
}
