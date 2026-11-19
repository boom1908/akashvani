package com.akashvani.malayalam

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Forward10
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Replay10
import androidx.compose.material.icons.rounded.SystemUpdate
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import kotlinx.coroutines.delay

// Medium-Dark Monochromatic ("Machined Graphite") Palette
private val CanvasBg = Color(0xFF22252B)
private val CardSurface = Color(0xFF2A2E35)
private val RecessedBg = Color(0xFF1B1E24)
private val ElevatedBg = Color(0xFF343942)
private val SelectedBg = Color(0xFF363C47)
private val InkPrimary = Color(0xFFF3F5F8)
private val InkSecondary = Color(0xFFA9B0BC)
private val InkMuted = Color(0xFF88909E)
private val InkOnLight = Color(0xFF181B20)
private val Hairline = Color(0xFF3A404B)
private val HairlineStrong = Color(0xFF5A6272)
private val TrackInactive = Color(0xFF3E4552)

private val AkashvaniMonoColorScheme = darkColorScheme(
    primary = InkPrimary,
    onPrimary = InkOnLight,
    background = CanvasBg,
    onBackground = InkPrimary,
    surface = CardSurface,
    onSurface = InkPrimary,
    outline = HairlineStrong
)

class MainActivity : ComponentActivity() {

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* optional for Android 13+ notification controls */ }

    // Lock system font scaling to 1.0x so large phone font settings never crowd buttons
    override fun attachBaseContext(newBase: Context) {
        val config = Configuration(newBase.resources.configuration).apply {
            fontScale = 1.0f
        }
        super.attachBaseContext(newBase.createConfigurationContext(config))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        setContent {
            val currentDensity = LocalDensity.current
            // Enforce 1.0f fontScale inside Jetpack Compose as well
            CompositionLocalProvider(
                LocalDensity provides Density(
                    density = currentDensity.density,
                    fontScale = 1.0f
                )
            ) {
                MaterialTheme(colorScheme = AkashvaniMonoColorScheme) {
                    Surface(modifier = Modifier.fillMaxSize(), color = CanvasBg) {
                        AkashvaniAppScreen()
                    }
                }
            }
        }
    }
}

@Composable
private fun AkashvaniLogoMark(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val corner = w * 0.25f

        // Graphite emblem plate
        drawRoundRect(
            color = Color(0xFF2B3039),
            cornerRadius = CornerRadius(corner, corner)
        )
        drawRoundRect(
            color = Color(0xFF4D5462),
            cornerRadius = CornerRadius(corner, corner),
            style = Stroke(width = w * 0.045f)
        )

        val cx = w * 0.5f
        val cy = h * 0.46f

        // Outer broadcast arcs (brushed silver)
        val outerR = w * 0.30f
        drawArc(
            color = Color(0xFF949CA9),
            startAngle = 140f,
            sweepAngle = 80f,
            useCenter = false,
            topLeft = Offset(cx - outerR, cy - outerR),
            size = Size(outerR * 2f, outerR * 2f),
            style = Stroke(width = w * 0.055f, cap = StrokeCap.Round)
        )
        drawArc(
            color = Color(0xFF949CA9),
            startAngle = -40f,
            sweepAngle = 80f,
            useCenter = false,
            topLeft = Offset(cx - outerR, cy - outerR),
            size = Size(outerR * 2f, outerR * 2f),
            style = Stroke(width = w * 0.055f, cap = StrokeCap.Round)
        )

        // Inner broadcast arcs (crisp alabaster)
        val innerR = w * 0.19f
        drawArc(
            color = InkPrimary,
            startAngle = 140f,
            sweepAngle = 80f,
            useCenter = false,
            topLeft = Offset(cx - innerR, cy - innerR),
            size = Size(innerR * 2f, innerR * 2f),
            style = Stroke(width = w * 0.058f, cap = StrokeCap.Round)
        )
        drawArc(
            color = InkPrimary,
            startAngle = -40f,
            sweepAngle = 80f,
            useCenter = false,
            topLeft = Offset(cx - innerR, cy - innerR),
            size = Size(innerR * 2f, innerR * 2f),
            style = Stroke(width = w * 0.058f, cap = StrokeCap.Round)
        )

        // Transmitter dot & mast
        drawCircle(
            color = InkPrimary,
            radius = w * 0.075f,
            center = Offset(cx, cy)
        )
        drawLine(
            color = InkPrimary,
            start = Offset(cx, cy + w * 0.075f),
            end = Offset(cx, h * 0.78f),
            strokeWidth = w * 0.06f,
            cap = StrokeCap.Round
        )
        drawLine(
            color = InkPrimary,
            start = Offset(w * 0.38f, h * 0.78f),
            end = Offset(w * 0.62f, h * 0.78f),
            strokeWidth = w * 0.06f,
            cap = StrokeCap.Round
        )
    }
}

@Composable
private fun AkashvaniAppScreen() {
    val context = LocalContext.current
    val diagnostics by PlaybackDiagnostics.state.collectAsState()

    var stations by remember { mutableStateOf(StationRepository.builtInStations) }
    // Default station is always Akashvani Kerala (#1)
    var currentStation by remember { mutableStateOf(StationRepository.builtInStations.first()) }
    var selectedTab by remember { mutableStateOf("all") }
    var isPlaying by remember { mutableStateOf(false) }
    var isBuffering by remember { mutableStateOf(false) }
    var statusText by remember { mutableStateOf("Ready to tune") }
    var updateInfo by remember { mutableStateOf<AppUpdateInfo?>(null) }

    // Live HLS timeshift window state
    var windowDurationMs by remember { mutableLongStateOf(0L) }
    var currentPositionMs by remember { mutableLongStateOf(0L) }
    var isSeekable by remember { mutableStateOf(false) }

    // Sleep timer state (in seconds)
    var sleepSecondsLeft by remember { mutableLongStateOf(0L) }
    var showSleepMenu by remember { mutableStateOf(false) }

    var controller by remember { mutableStateOf<MediaController?>(null) }

    // Sync remote stations.json and check GitHub Releases for app updates on startup
    LaunchedEffect(Unit) {
        stations = StationRepository.fetchStationsRemoteOrFallback()
        updateInfo = PlaybackDiagnostics.checkLatestGithubRelease(
            currentVersionCode = BuildConfig.VERSION_CODE,
            githubRepo = BuildConfig.GITHUB_REPO
        )
    }

    // Bind to background Media3 RadioPlaybackService
    DisposableEffect(context) {
        val sessionToken = SessionToken(
            context,
            ComponentName(context, RadioPlaybackService::class.java)
        )
        val future: ListenableFuture<MediaController> =
            MediaController.Builder(context, sessionToken).buildAsync()

        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
                if (playing) statusText = "On Air"
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                isBuffering = playbackState == Player.STATE_BUFFERING
                statusText = when (playbackState) {
                    Player.STATE_BUFFERING -> "Connecting..."
                    Player.STATE_READY -> if (controller?.isPlaying == true) "On Air" else "Paused"
                    Player.STATE_ENDED -> "Reconnecting..."
                    else -> "Ready to tune"
                }
            }
        }

        future.addListener({
            val mediaController = future.get()
            controller = mediaController
            mediaController.addListener(listener)
            isPlaying = mediaController.isPlaying
        }, ContextCompat.getMainExecutor(context))

        onDispose {
            controller?.removeListener(listener)
            MediaController.releaseFuture(future)
        }
    }

    // Poll HLS live window & sleep timer once per second
    LaunchedEffect(controller) {
        while (true) {
            controller?.let { player ->
                val dur = player.duration.coerceAtLeast(0L)
                val pos = player.currentPosition.coerceIn(0L, dur.coerceAtLeast(1L))
                windowDurationMs = dur
                currentPositionMs = pos
                isSeekable = player.isCurrentMediaItemSeekable && dur > 5_000L
            }
            if (sleepSecondsLeft > 0L) {
                delay(1000L)
                sleepSecondsLeft = (sleepSecondsLeft - 1L).coerceAtLeast(0L)
                if (sleepSecondsLeft == 0L) {
                    controller?.pause()
                    statusText = "Paused by Sleep Timer"
                }
            } else {
                delay(1000L)
            }
        }
    }

    fun playStation(station: RadioStation) {
        currentStation = station
        val player = controller ?: return
        if (!diagnostics.isOnline) {
            PlaybackDiagnostics.setOnline(false)
        } else {
            PlaybackDiagnostics.clearError(usingFallback = false)
        }

        val extras = Bundle().apply {
            putString(RadioPlaybackService.EXTRA_STATION_NAME, station.name)
            putString(RadioPlaybackService.EXTRA_STATION_SCHEDULE, station.schedule)
            putString(RadioPlaybackService.EXTRA_PRIMARY_URL, station.streamUrl)
            putStringArrayList(
                RadioPlaybackService.EXTRA_FALLBACK_URLS,
                ArrayList(station.fallbackUrls)
            )
        }

        val metadata = MediaMetadata.Builder()
            .setTitle(station.name)
            .setArtist("${station.city} · ${station.frequency}")
            .setDisplayTitle(station.name)
            .setExtras(extras)
            .build()
        val item = MediaItem.Builder()
            .setMediaId(station.id)
            .setUri(station.streamUrl)
            .setMediaMetadata(metadata)
            .build()
        player.setMediaItem(item)
        player.prepare()
        player.play()
        statusText = "Connecting to ${station.name}..."
    }

    fun togglePlayPause() {
        val player = controller ?: return
        if (player.mediaItemCount == 0 || diagnostics.errorCode != PlaybackErrorCode.NONE) {
            playStation(currentStation)
        } else if (player.isPlaying) {
            player.pause()
            statusText = "Paused"
        } else {
            player.play()
            statusText = "Resuming..."
        }
    }

    fun seekBy(deltaMs: Long) {
        val player = controller ?: return
        if (!isSeekable) return
        val target = (player.currentPosition + deltaMs).coerceIn(0L, windowDurationMs)
        player.seekTo(target)
    }

    val secondsBehindLive = ((windowDurationMs - currentPositionMs).coerceAtLeast(0L) / 1000L)
    val isLiveEdge = secondsBehindLive <= 4L

    val displayStatus = when {
        !diagnostics.isOnline -> "No internet"
        diagnostics.isReconnecting && diagnostics.usingFallback -> "Trying backup stream..."
        diagnostics.isReconnecting -> "Reconnecting (${diagnostics.reconnectAttempt}/4)..."
        diagnostics.errorCode != PlaybackErrorCode.NONE -> "Station unavailable"
        isPlaying && diagnostics.usingFallback -> "On Air (Backup)"
        else -> statusText
    }

    val filteredStations = remember(stations, selectedTab) {
        when (selectedTab) {
            "akashvani" -> stations.filter { it.category == "akashvani" }
            "kerala-fm" -> stations.filter { it.category == "kerala-fm" }
            else -> stations
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp),
        contentPadding = PaddingValues(top = 24.dp, bottom = 36.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    AkashvaniLogoMark(modifier = Modifier.size(38.dp))
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "Akashvani",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = InkPrimary,
                            maxLines = 1
                        )
                        Text(
                            text = "ആകാശവാണി · Kerala Live Radio",
                            fontSize = 12.sp,
                            color = InkSecondary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                Spacer(Modifier.width(10.dp))

                OutlinedButton(
                    onClick = { showSleepMenu = !showSleepMenu },
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, if (sleepSecondsLeft > 0L) InkPrimary else HairlineStrong),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Timer,
                        contentDescription = "Sleep Timer",
                        modifier = Modifier.size(18.dp),
                        tint = InkPrimary
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = if (sleepSecondsLeft > 0L) formatTime(sleepSecondsLeft) else "Sleep",
                        color = InkPrimary,
                        fontSize = 13.sp,
                        maxLines = 1,
                        softWrap = false
                    )
                }
            }
        }

        // Optional In-App Update Notice (opens GitHub Release to update in place without uninstalling)
        updateInfo?.let { update ->
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(ElevatedBg)
                        .border(1.dp, HairlineStrong, RoundedCornerShape(14.dp))
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        modifier = Modifier.weight(1f),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.SystemUpdate,
                            contentDescription = "Update available",
                            tint = InkPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "Update ready (${update.latestTag})",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = InkPrimary,
                                maxLines = 1
                            )
                            Text(
                                text = "Updates directly without uninstalling",
                                fontSize = 12.sp,
                                color = InkSecondary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(update.releasePageUrl))
                            context.startActivity(intent)
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = InkPrimary,
                            contentColor = InkOnLight
                        ),
                        shape = RoundedCornerShape(9.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text("Update", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, softWrap = false)
                    }
                }
            }
        }

        if (showSleepMenu) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(RecessedBg)
                        .border(1.dp, Hairline, RoundedCornerShape(14.dp))
                        .padding(8.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf(0 to "Off", 15 to "15m", 30 to "30m", 45 to "45m", 60 to "60m").forEach { (mins, label) ->
                        val active = if (mins == 0) {
                            sleepSecondsLeft == 0L
                        } else {
                            sleepSecondsLeft > 0L && ((sleepSecondsLeft + 59) / 60).toInt() == mins
                        }
                        Button(
                            onClick = {
                                sleepSecondsLeft = mins * 60L
                                showSleepMenu = false
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (active) InkPrimary else CardSurface,
                                contentColor = if (active) InkOnLight else InkSecondary
                            ),
                            contentPadding = PaddingValues(horizontal = 4.dp, vertical = 8.dp),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, softWrap = false)
                        }
                    }
                }
            }
        }

        // Main Receiver Card with HUGE Monochromatic Play/Pause Button, Live Seek Bar & Failure Diagnosis
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(CardSurface)
                    .border(1.dp, Hairline, RoundedCornerShape(24.dp))
                    .padding(22.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "${currentStation.band} · ${currentStation.frequency} · $displayStatus",
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    color = if (isPlaying) InkPrimary else InkSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(Modifier.height(8.dp))

                Text(
                    text = currentStation.name,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = InkPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                if (currentStation.malayalamName.isNotBlank()) {
                    Text(
                        text = currentStation.malayalamName,
                        fontSize = 15.sp,
                        color = InkSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(Modifier.height(26.dp))

                // HUGE Monochromatic Play / Pause Focal Button (138dp)
                Box(
                    modifier = Modifier
                        .size(138.dp)
                        .clip(CircleShape)
                        .background(if (isPlaying) ElevatedBg else InkPrimary)
                        .then(
                            if (isPlaying) {
                                Modifier.border(2.dp, InkPrimary, CircleShape)
                            } else {
                                Modifier
                            }
                        )
                        .clickable { togglePlayPause() },
                    contentAlignment = Alignment.Center
                ) {
                    if (isBuffering || diagnostics.isReconnecting) {
                        CircularProgressIndicator(
                            color = if (isPlaying) InkPrimary else InkOnLight,
                            strokeWidth = 4.dp,
                            modifier = Modifier.size(44.dp)
                        )
                    } else {
                        Icon(
                            imageVector = if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                            contentDescription = if (isPlaying) "Pause" else "Play",
                            tint = if (isPlaying) InkPrimary else InkOnLight,
                            modifier = Modifier.size(68.dp)
                        )
                    }
                }

                // Exact Plain-English Offline / Error Diagnosis Card (Monochromatic High-Contrast)
                if (!diagnostics.isOnline || diagnostics.errorTitle != null) {
                    Spacer(Modifier.height(20.dp))
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(ElevatedBg)
                            .border(1.dp, HairlineStrong, RoundedCornerShape(14.dp))
                            .padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.Top,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(
                                imageVector = if (!diagnostics.isOnline) Icons.Rounded.WifiOff else Icons.Rounded.ErrorOutline,
                                contentDescription = null,
                                tint = InkPrimary,
                                modifier = Modifier.size(20.dp)
                            )
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = diagnostics.errorTitle ?: "No internet connection",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = InkPrimary
                                )
                                Spacer(Modifier.height(2.dp))
                                Text(
                                    text = diagnostics.errorDetail
                                        ?: "Check Wi-Fi or mobile data. Playback will resume automatically when internet returns.",
                                    fontSize = 13.sp,
                                    color = InkSecondary,
                                    lineHeight = 18.sp
                                )
                            }
                        }

                        if (diagnostics.isOnline) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                OutlinedButton(
                                    onClick = { playStation(currentStation) },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(10.dp),
                                    border = BorderStroke(1.dp, HairlineStrong),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Refresh,
                                        contentDescription = null,
                                        tint = InkPrimary,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(Modifier.width(6.dp))
                                    Text(
                                        text = "Try Again",
                                        fontSize = 13.sp,
                                        color = InkPrimary,
                                        maxLines = 1,
                                        softWrap = false
                                    )
                                }

                                if (currentStation.id != "akashvani-kerala") {
                                    Button(
                                        onClick = {
                                            val primary = stations.firstOrNull { it.id == "akashvani-kerala" }
                                                ?: stations.first()
                                            playStation(primary)
                                        },
                                        modifier = Modifier.weight(1f),
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = InkPrimary,
                                            contentColor = InkOnLight
                                        ),
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)
                                    ) {
                                        Text(
                                            text = "Akashvani Kerala",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            maxLines = 1,
                                            softWrap = false
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(Modifier.height(24.dp))

                // Live Timeshift Seek Controls
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isSeekable) {
                            "Buffer ${formatTime(windowDurationMs / 1000L)}"
                        } else if (currentStation.streamUrl.contains(".m3u8")) {
                            "Live Broadcast"
                        } else {
                            "Live FM Stream"
                        },
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        color = InkSecondary,
                        maxLines = 1
                    )

                    Text(
                        text = if (isLiveEdge) "LIVE" else "-${formatTime(secondsBehindLive)}",
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.SemiBold,
                        color = if (isLiveEdge) InkPrimary else InkSecondary,
                        maxLines = 1
                    )
                }

                Slider(
                    value = if (windowDurationMs > 0L) currentPositionMs.toFloat() else 1f,
                    onValueChange = { newPos ->
                        if (isSeekable) {
                            currentPositionMs = newPos.toLong()
                            controller?.seekTo(newPos.toLong())
                        }
                    },
                    valueRange = 0f..(windowDurationMs.coerceAtLeast(1L).toFloat()),
                    enabled = isSeekable,
                    colors = SliderDefaults.colors(
                        thumbColor = InkPrimary,
                        activeTrackColor = InkPrimary,
                        inactiveTrackColor = TrackInactive,
                        disabledThumbColor = InkMuted,
                        disabledActiveTrackColor = HairlineStrong,
                        disabledInactiveTrackColor = TrackInactive
                    )
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { seekBy(-15_000L) }, enabled = isSeekable) {
                        Icon(
                            Icons.Rounded.Replay10,
                            contentDescription = "Rewind 15 seconds",
                            tint = if (isSeekable) InkPrimary else InkMuted
                        )
                    }

                    OutlinedButton(
                        onClick = { controller?.seekToDefaultPosition() },
                        enabled = isSeekable && !isLiveEdge,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, if (isSeekable && !isLiveEdge) HairlineStrong else Hairline),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = "Jump to Live",
                            fontSize = 13.sp,
                            color = if (isSeekable && !isLiveEdge) InkPrimary else InkMuted,
                            maxLines = 1,
                            softWrap = false
                        )
                    }

                    IconButton(onClick = { seekBy(15_000L) }, enabled = isSeekable && !isLiveEdge) {
                        Icon(
                            Icons.Rounded.Forward10,
                            contentDescription = "Forward 15 seconds",
                            tint = if (isSeekable && !isLiveEdge) InkPrimary else InkMuted
                        )
                    }
                }
            }
        }

        // Category Filter Tabs: All / Akashvani / Kerala FM
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "Kerala Stations (${filteredStations.size})",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = InkPrimary,
                    maxLines = 1,
                    modifier = Modifier.padding(top = 4.dp)
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(RecessedBg)
                        .border(1.dp, Hairline, RoundedCornerShape(12.dp))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    listOf(
                        "all" to "All",
                        "akashvani" to "Akashvani",
                        "kerala-fm" to "Kerala FM"
                    ).forEach { (tabId, label) ->
                        val active = selectedTab == tabId
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(9.dp))
                                .background(if (active) InkPrimary else Color.Transparent)
                                .clickable { selectedTab = tabId }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (active) InkOnLight else InkSecondary,
                                maxLines = 1,
                                softWrap = false
                            )
                        }
                    }
                }
            }
        }

        items(filteredStations, key = { it.id }) { station ->
            val selected = station.id == currentStation.id
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (selected) SelectedBg else CardSurface)
                    .border(
                        width = 1.dp,
                        color = if (selected) InkPrimary.copy(alpha = 0.65f) else Hairline,
                        shape = RoundedCornerShape(14.dp)
                    )
                    .clickable { playStation(station) }
                    .padding(horizontal = 16.dp, vertical = 14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = station.name,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = InkPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = "${station.city} · ${station.frequency}",
                            fontSize = 12.sp,
                            color = InkSecondary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = if (selected && isPlaying) {
                            "Playing"
                        } else if (station.schedule == "daytime") {
                            "Daytime"
                        } else {
                            "Live"
                        },
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                        color = if (selected) InkPrimary else InkMuted,
                        maxLines = 1,
                        softWrap = false
                    )
                }
            }
            HorizontalDivider(color = Color.Transparent, modifier = Modifier.height(2.dp))
        }
    }
}

private fun formatTime(totalSeconds: Long): String {
    val safe = totalSeconds.coerceAtLeast(0L)
    val mins = safe / 60L
    val secs = safe % 60L
    return "%02d:%02d".format(mins, secs)
}
