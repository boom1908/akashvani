package com.akashvani.malayalam

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Calendar
import java.util.TimeZone

enum class PlaybackErrorCode {
    NONE,
    OFFLINE,
    DAYTIME_OFF_AIR,
    NOT_FOUND,
    BLOCKED,
    TIMEOUT,
    SERVER_ERROR,
    STALLED,
    UNKNOWN
}

data class DiagnosticsState(
    val isOnline: Boolean = true,
    val errorCode: PlaybackErrorCode = PlaybackErrorCode.NONE,
    val errorTitle: String? = null,
    val errorDetail: String? = null,
    val isReconnecting: Boolean = false,
    val reconnectAttempt: Int = 0,
    val usingFallback: Boolean = false
)

data class AppUpdateInfo(
    val latestTag: String,
    val latestBuildNumber: Int,
    val releasePageUrl: String
)

object PlaybackDiagnostics {
    private val _state = MutableStateFlow(DiagnosticsState())
    val state: StateFlow<DiagnosticsState> = _state.asStateFlow()

    fun setOnline(online: Boolean) {
        val current = _state.value
        if (!online) {
            _state.value = current.copy(
                isOnline = false,
                isReconnecting = false,
                errorCode = PlaybackErrorCode.OFFLINE,
                errorTitle = "No internet connection",
                errorDetail = "Check Wi-Fi or mobile data. Playback will resume automatically as soon as your internet returns."
            )
        } else {
            val clearOffline = current.errorCode == PlaybackErrorCode.OFFLINE
            _state.value = current.copy(
                isOnline = true,
                errorCode = if (clearOffline) PlaybackErrorCode.NONE else current.errorCode,
                errorTitle = if (clearOffline) null else current.errorTitle,
                errorDetail = if (clearOffline) null else current.errorDetail
            )
        }
    }

    fun clearError(usingFallback: Boolean = false) {
        _state.value = _state.value.copy(
            errorCode = PlaybackErrorCode.NONE,
            errorTitle = null,
            errorDetail = null,
            isReconnecting = false,
            reconnectAttempt = 0,
            usingFallback = usingFallback
        )
    }

    fun setReconnecting(attempt: Int, usingFallback: Boolean) {
        _state.value = _state.value.copy(
            isReconnecting = true,
            reconnectAttempt = attempt,
            usingFallback = usingFallback,
            errorCode = PlaybackErrorCode.NONE,
            errorTitle = null,
            errorDetail = null
        )
    }

    fun reportFailure(
        stationName: String,
        schedule: String,
        isOnline: Boolean,
        httpStatus: Int? = null,
        isTimeout: Boolean = false,
        isStalled: Boolean = false
    ) {
        if (!isOnline) {
            setOnline(false)
            return
        }

        val ist = getCurrentIstTime()
        val daytimeOffAir = schedule == "daytime" && !ist.isDaytimeOnAir

        val (code, title, detail) = when {
            daytimeOffAir && httpStatus != 403 && httpStatus != 401 -> Triple(
                PlaybackErrorCode.DAYTIME_OFF_AIR,
                "$stationName is off air right now",
                "This regional station broadcasts 5:55 AM – 11:00 PM IST (it is currently ${ist.formatted}). Tap below for 24-hour Akashvani Kerala."
            )
            httpStatus == 401 || httpStatus == 403 -> Triple(
                PlaybackErrorCode.BLOCKED,
                "Broadcast server blocked this link (Error $httpStatus)",
                "$stationName's server rejected the connection. Try another station while the link is updated."
            )
            httpStatus == 404 || httpStatus == 410 -> Triple(
                PlaybackErrorCode.NOT_FOUND,
                "Station link is offline or moved (Error $httpStatus)",
                "$stationName is not airing on this link right now. Try again later or play Akashvani Kerala."
            )
            httpStatus == 504 || isTimeout -> Triple(
                PlaybackErrorCode.TIMEOUT,
                "Slow signal — server did not reply in time",
                "Connecting to $stationName timed out. Check your signal strength or tap Try Again."
            )
            httpStatus != null && httpStatus >= 500 -> Triple(
                PlaybackErrorCode.SERVER_ERROR,
                "Broadcast server is temporarily down (Error $httpStatus)",
                "$stationName's server is having a temporary issue. Wait a minute and tap Try Again."
            )
            isStalled -> Triple(
                PlaybackErrorCode.STALLED,
                "Broadcast paused or stopped sending sound",
                "$stationName froze for 15 seconds without audio. Tap Try Again or choose another station."
            )
            else -> Triple(
                PlaybackErrorCode.UNKNOWN,
                "Could not connect to $stationName",
                "The radio server could not be reached right now. Tap Try Again or switch to Akashvani Kerala."
            )
        }

        _state.value = _state.value.copy(
            isOnline = true,
            isReconnecting = false,
            errorCode = code,
            errorTitle = title,
            errorDetail = detail
        )
    }

    private data class IstClock(val formatted: String, val isDaytimeOnAir: Boolean)

    private fun getCurrentIstTime(): IstClock {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("Asia/Kolkata"))
        val hour24 = cal.get(Calendar.HOUR_OF_DAY)
        val minute = cal.get(Calendar.MINUTE)
        val minuteOfDay = hour24 * 60 + minute
        val isDaytime = minuteOfDay in (5 * 60 + 55)..(23 * 60 + 5)
        val period = if (hour24 >= 12) "PM" else "AM"
        val hour12 = when {
            hour24 % 12 == 0 -> 12
            else -> hour24 % 12
        }
        val formatted = "%d:%02d %s IST".format(hour12, minute, period)
        return IstClock(formatted = formatted, isDaytimeOnAir = isDaytime)
    }

    /**
     * Checks GitHub Releases for a newer APK build without ever crashing or blocking playback.
     */
    suspend fun checkLatestGithubRelease(
        currentVersionCode: Int,
        githubRepo: String
    ): AppUpdateInfo? = withContext(Dispatchers.IO) {
        if (githubRepo.isBlank() || !githubRepo.contains("/")) return@withContext null
        try {
            val apiUrl = "https://api.github.com/repos/$githubRepo/releases/latest"
            val conn = (URL(apiUrl).openConnection() as HttpURLConnection).apply {
                connectTimeout = 5000
                readTimeout = 5000
                setRequestProperty("Accept", "application/vnd.github+json")
                setRequestProperty("User-Agent", "AkashvaniAndroid/$currentVersionCode")
            }
            if (conn.responseCode == 200) {
                val raw = conn.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(raw)
                val tag = json.optString("tag_name", "")
                val htmlUrl = json.optString("html_url", "")
                // Tag format: v1.0.<run_number>
                val buildNum = tag.substringAfterLast(".", "").toIntOrNull()
                if (buildNum != null && buildNum > currentVersionCode && htmlUrl.startsWith("https://")) {
                    return@withContext AppUpdateInfo(
                        latestTag = tag,
                        latestBuildNumber = buildNum,
                        releasePageUrl = htmlUrl
                    )
                }
            }
        } catch (_: Exception) {
            // Silently ignore if offline or rate-limited
        }
        null
    }
}
