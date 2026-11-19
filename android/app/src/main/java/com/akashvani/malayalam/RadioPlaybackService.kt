package com.akashvani.malayalam

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.HttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import java.net.SocketTimeoutException

class RadioPlaybackService : MediaSessionService() {

    companion object {
        const val EXTRA_STATION_NAME = "station_name"
        const val EXTRA_STATION_SCHEDULE = "station_schedule"
        const val EXTRA_PRIMARY_URL = "primary_url"
        const val EXTRA_FALLBACK_URLS = "fallback_urls"
        private const val STALL_WATCHDOG_MS = 15_000L
        private const val MAX_RETRIES = 4
    }

    private var mediaSession: MediaSession? = null
    private var player: ExoPlayer? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var isOnline = true
    private var resumeWhenOnline = false

    private var reconnectAttempts = 0
    private var activeStationName = "Akashvani Kerala"
    private var activeStationSchedule = "24x7"
    private var candidateUrls: List<String> = emptyList()
    private var currentUrlIndex = 0
    private var isSwitchingFallback = false

    private val stallWatchdogRunnable = Runnable {
        val exo = player ?: return@Runnable
        if (exo.playbackState == Player.STATE_BUFFERING && exo.playWhenReady) {
            handleStreamFailure(
                exo = exo,
                httpStatus = null,
                isTimeout = false,
                isStalled = true
            )
        }
    }

    @OptIn(UnstableApi::class)
    override fun onCreate() {
        super.onCreate()

        // Present official Akashvani web player headers so Prasar Bharati CDN never blocks playback
        val httpFactory = DefaultHttpDataSource.Factory()
            .setUserAgent(
                "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
            )
            .setDefaultRequestProperties(
                mapOf(
                    "Referer" to "https://akashvani.gov.in/",
                    "Origin" to "https://akashvani.gov.in"
                )
            )
            .setConnectTimeoutMs(10_000)
            .setReadTimeoutMs(15_000)
            .setAllowCrossProtocolRedirects(true)

        val audioAttributes = AudioAttributes.Builder()
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .setUsage(C.USAGE_MEDIA)
            .build()

        // Audio focus (auto-pause for phone calls) + noisy handling (auto-pause if headphones unplug)
        val exoPlayer = ExoPlayer.Builder(this)
            .setMediaSourceFactory(DefaultMediaSourceFactory(httpFactory))
            .setAudioAttributes(audioAttributes, true)
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build()

        exoPlayer.addListener(object : Player.Listener {
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                if (mediaItem == null) return
                if (isSwitchingFallback) {
                    isSwitchingFallback = false
                    return
                }
                val extras = mediaItem.mediaMetadata.extras
                activeStationName = extras?.getString(EXTRA_STATION_NAME)
                    ?: mediaItem.mediaMetadata.title?.toString()
                    ?: "Akashvani"
                activeStationSchedule = extras?.getString(EXTRA_STATION_SCHEDULE) ?: "24x7"

                val primary = extras?.getString(EXTRA_PRIMARY_URL)
                    ?: mediaItem.localConfiguration?.uri?.toString()
                val fallbacks = extras?.getStringArrayList(EXTRA_FALLBACK_URLS) ?: arrayListOf()

                val all = mutableListOf<String>()
                if (!primary.isNullOrBlank()) all.add(primary)
                fallbacks.filter { it.isNotBlank() && it != primary }.forEach { all.add(it) }

                candidateUrls = all
                currentUrlIndex = 0
                reconnectAttempts = 0
                resumeWhenOnline = false
                if (isOnline) {
                    PlaybackDiagnostics.clearError(usingFallback = false)
                }
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                cancelStallWatchdog()
                when (playbackState) {
                    Player.STATE_BUFFERING -> {
                        if (exoPlayer.playWhenReady) {
                            armStallWatchdog()
                        }
                    }
                    Player.STATE_READY -> {
                        reconnectAttempts = 0
                        resumeWhenOnline = false
                        PlaybackDiagnostics.clearError(usingFallback = currentUrlIndex > 0)
                    }
                    Player.STATE_IDLE, Player.STATE_ENDED -> {
                        cancelStallWatchdog()
                    }
                }
            }

            override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
                if (!playWhenReady) {
                    cancelStallWatchdog()
                    if (isOnline) {
                        resumeWhenOnline = false
                    }
                } else if (exoPlayer.playbackState == Player.STATE_BUFFERING) {
                    armStallWatchdog()
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                cancelStallWatchdog()
                val httpStatus = extractHttpStatusCode(error)
                val isTimeout = isTimeoutException(error)
                handleStreamFailure(
                    exo = exoPlayer,
                    httpStatus = httpStatus,
                    isTimeout = isTimeout,
                    isStalled = false
                )
            }
        })

        player = exoPlayer
        mediaSession = MediaSession.Builder(this, exoPlayer).build()
        setupNetworkMonitoring()
    }

    private fun setupNetworkMonitoring() {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        connectivityManager = cm
        isOnline = checkCurrentConnectivity(cm)
        PlaybackDiagnostics.setOnline(isOnline)

        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                mainHandler.post {
                    val wasOffline = !isOnline
                    isOnline = true
                    PlaybackDiagnostics.setOnline(true)
                    val exo = player
                    if (wasOffline && resumeWhenOnline && exo != null && exo.mediaItemCount > 0) {
                        resumeWhenOnline = false
                        reconnectAttempts = 0
                        PlaybackDiagnostics.setReconnecting(attempt = 1, usingFallback = currentUrlIndex > 0)
                        exo.prepare()
                        exo.playWhenReady = true
                    }
                }
            }

            override fun onLost(network: Network) {
                mainHandler.post {
                    val stillOnline = checkCurrentConnectivity(cm)
                    if (!stillOnline) {
                        isOnline = false
                        cancelStallWatchdog()
                        mainHandler.removeCallbacksAndMessages(null)
                        val exo = player
                        if (exo != null && (exo.isPlaying || exo.playWhenReady)) {
                            resumeWhenOnline = true
                        }
                        PlaybackDiagnostics.setOnline(false)
                    }
                }
            }
        }

        networkCallback = callback
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        try {
            cm.registerNetworkCallback(request, callback)
        } catch (_: Exception) {
            // Safe fallback if ROM restricts network callbacks
        }
    }

    private fun checkCurrentConnectivity(cm: ConnectivityManager): Boolean {
        val active = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(active) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun armStallWatchdog() {
        mainHandler.removeCallbacks(stallWatchdogRunnable)
        mainHandler.postDelayed(stallWatchdogRunnable, STALL_WATCHDOG_MS)
    }

    private fun cancelStallWatchdog() {
        mainHandler.removeCallbacks(stallWatchdogRunnable)
    }

    private fun handleStreamFailure(
        exo: ExoPlayer,
        httpStatus: Int?,
        isTimeout: Boolean,
        isStalled: Boolean
    ) {
        val onlineNow = connectivityManager?.let { checkCurrentConnectivity(it) } ?: isOnline
        if (!onlineNow) {
            isOnline = false
            resumeWhenOnline = true
            PlaybackDiagnostics.setOnline(false)
            return
        }

        // 1. Immediately switch to next backup stream URL if available
        if (currentUrlIndex + 1 < candidateUrls.size) {
            currentUrlIndex++
            val backupUrl = candidateUrls[currentUrlIndex]
            val currentItem = exo.currentMediaItem
            if (currentItem != null) {
                PlaybackDiagnostics.setReconnecting(attempt = reconnectAttempts, usingFallback = true)
                isSwitchingFallback = true
                val backupItem = currentItem.buildUpon().setUri(backupUrl).build()
                exo.setMediaItem(backupItem)
                exo.prepare()
                exo.playWhenReady = true
                return
            }
        }

        // 2. Retry up to MAX_RETRIES with backoff (cycling back to primary URL)
        if (reconnectAttempts < MAX_RETRIES) {
            reconnectAttempts++
            val delayMs = (reconnectAttempts * 2500L).coerceAtMost(10_000L)
            PlaybackDiagnostics.setReconnecting(attempt = reconnectAttempts, usingFallback = false)
            mainHandler.postDelayed({
                if (!isOnline) return@postDelayed
                if (candidateUrls.isNotEmpty() && currentUrlIndex != 0) {
                    currentUrlIndex = 0
                    val currentItem = exo.currentMediaItem
                    if (currentItem != null) {
                        isSwitchingFallback = true
                        exo.setMediaItem(currentItem.buildUpon().setUri(candidateUrls[0]).build())
                    }
                }
                exo.prepare()
                exo.playWhenReady = true
            }, delayMs)
            return
        }

        // 3. All backup links & retries exhausted — report exact plain-English diagnosis
        PlaybackDiagnostics.reportFailure(
            stationName = activeStationName,
            schedule = activeStationSchedule,
            isOnline = true,
            httpStatus = httpStatus,
            isTimeout = isTimeout,
            isStalled = isStalled
        )
    }

    @OptIn(UnstableApi::class)
    private fun extractHttpStatusCode(error: PlaybackException): Int? {
        var cause: Throwable? = error.cause
        var depth = 0
        while (cause != null && depth < 6) {
            if (cause is HttpDataSource.InvalidResponseCodeException) {
                return cause.responseCode
            }
            cause = cause.cause
            depth++
        }
        return null
    }

    private fun isTimeoutException(error: PlaybackException): Boolean {
        if (error.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT) {
            return true
        }
        var cause: Throwable? = error.cause
        var depth = 0
        while (cause != null && depth < 6) {
            if (cause is SocketTimeoutException) return true
            cause = cause.cause
            depth++
        }
        return false
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    override fun onDestroy() {
        cancelStallWatchdog()
        mainHandler.removeCallbacksAndMessages(null)
        networkCallback?.let { cb ->
            try {
                connectivityManager?.unregisterNetworkCallback(cb)
            } catch (_: Exception) {
            }
        }
        networkCallback = null
        mediaSession?.run {
            player.release()
            release()
            mediaSession = null
        }
        player = null
        super.onDestroy()
    }
}
