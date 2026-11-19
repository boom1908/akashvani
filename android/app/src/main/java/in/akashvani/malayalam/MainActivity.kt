package `in`.akashvani.malayalam

import android.Manifest
import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material.icons.rounded.Forward10
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Replay10
import androidx.compose.material.icons.rounded.Timer
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
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

private val CanvasBg = Color(0xFFF6F7F9)
private val CardSurface = Color(0xFFFFFFFF)
private val InkDark = Color(0xFF111318)
private val InkMuted = Color(0xFF5A6070)
private val Hairline = Color(0xFFE2E5EB)
private val AkashvaniRed = Color(0xFFC8232C)

class MainActivity : ComponentActivity() {

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* optional for Android 13+ notification controls */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = CanvasBg) {
                    AkashvaniAppScreen()
                }
            }
        }
    }
}

@Composable
private fun AkashvaniAppScreen() {
    val context = LocalContext.current

    var stations by remember { mutableStateOf(StationRepository.builtInStations) }
    var currentStation by remember { mutableStateOf(StationRepository.builtInStations.first()) }
    var isPlaying by remember { mutableStateOf(false) }
    var isBuffering by remember { mutableStateOf(false) }
    var statusText by remember { mutableStateOf("Ready to tune") }

    // Live HLS timeshift window state
    var windowDurationMs by remember { mutableLongStateOf(0L) }
    var currentPositionMs by remember { mutableLongStateOf(0L) }
    var isSeekable by remember { mutableStateOf(false) }

    // Sleep timer state (in seconds)
    var sleepSecondsLeft by remember { mutableLongStateOf(0L) }
    var showSleepMenu by remember { mutableStateOf(false) }

    var controller by remember { mutableStateOf<MediaController?>(null) }

    // Sync remote stations.json from GitHub on startup
    LaunchedEffect(Unit) {
        stations = StationRepository.fetchStationsRemoteOrFallback()
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
                    Player.STATE_BUFFERING -> "Connecting to Akashvani..."
                    Player.STATE_READY -> if (controller?.isPlaying == true) "On Air" else "Paused"
                    Player.STATE_ENDED -> "Stream ended"
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
    LaunchedEffect(controller, sleepSecondsLeft) {
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
        val metadata = MediaMetadata.Builder()
            .setTitle(station.name)
            .setArtist("${station.city} · ${station.frequency}")
            .setDisplayTitle(station.name)
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
        if (player.mediaItemCount == 0) {
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

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp),
        contentPadding = PaddingValues(top = 24.dp, bottom = 36.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Akashvani",
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Bold,
                        color = InkDark
                    )
                    Text(
                        text = "ആകാശവാണി · Kerala Live Radio",
                        fontSize = 13.sp,
                        color = InkMuted
                    )
                }

                OutlinedButton(
                    onClick = { showSleepMenu = !showSleepMenu },
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Timer,
                        contentDescription = "Sleep Timer",
                        modifier = Modifier.size(18.dp),
                        tint = if (sleepSecondsLeft > 0L) AkashvaniRed else InkDark
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = if (sleepSecondsLeft > 0L) formatTime(sleepSecondsLeft) else "Sleep",
                        color = if (sleepSecondsLeft > 0L) AkashvaniRed else InkDark,
                        fontSize = 13.sp
                    )
                }
            }
        }

        if (showSleepMenu) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(CardSurface)
                        .border(1.dp, Hairline, RoundedCornerShape(14.dp))
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    listOf(0 to "Off", 15 to "15m", 30 to "30m", 45 to "45m", 60 to "60m").forEach { (mins, label) ->
                        Button(
                            onClick = {
                                sleepSecondsLeft = mins * 60L
                                showSleepMenu = false
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (sleepSecondsLeft > 0L && mins > 0 && sleepSecondsLeft <= mins * 60L) AkashvaniRed else CanvasBg,
                                contentColor = if (sleepSecondsLeft > 0L && mins > 0 && sleepSecondsLeft <= mins * 60L) Color.White else InkDark
                            ),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(label, fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        // Main Receiver Card with HUGE Play/Pause Button & Live Seek Bar
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(CardSurface)
                    .border(1.dp, Hairline, RoundedCornerShape(24.dp))
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "${currentStation.band} · ${currentStation.frequency} · $statusText",
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    color = if (isPlaying) AkashvaniRed else InkMuted
                )

                Spacer(Modifier.height(8.dp))

                Text(
                    text = currentStation.name,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = InkDark,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                if (currentStation.malayalamName.isNotBlank()) {
                    Text(
                        text = currentStation.malayalamName,
                        fontSize = 15.sp,
                        color = InkMuted
                    )
                }

                Spacer(Modifier.height(28.dp))

                // HUGE Play / Pause Focal Button (136dp)
                Box(
                    modifier = Modifier
                        .size(136.dp)
                        .clip(CircleShape)
                        .background(if (isPlaying) InkDark else AkashvaniRed)
                        .clickable { togglePlayPause() },
                    contentAlignment = Alignment.Center
                ) {
                    if (isBuffering) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 4.dp,
                            modifier = Modifier.size(44.dp)
                        )
                    } else {
                        Icon(
                            imageVector = if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                            contentDescription = if (isPlaying) "Pause" else "Play",
                            tint = Color.White,
                            modifier = Modifier.size(68.dp)
                        )
                    }
                }

                Spacer(Modifier.height(28.dp))

                // Live Timeshift Seek Controls
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isSeekable) "Buffer ${formatTime(windowDurationMs / 1000L)}" else "Live Broadcast",
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        color = InkMuted
                    )

                    Text(
                        text = if (isLiveEdge) "LIVE" else "-${formatTime(secondsBehindLive)}",
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.SemiBold,
                        color = if (isLiveEdge) AkashvaniRed else InkDark
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
                        thumbColor = AkashvaniRed,
                        activeTrackColor = AkashvaniRed,
                        inactiveTrackColor = Hairline
                    )
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { seekBy(-15_000L) }, enabled = isSeekable) {
                        Icon(Icons.Rounded.Replay10, contentDescription = "Rewind 15 seconds", tint = InkDark)
                    }

                    OutlinedButton(
                        onClick = { controller?.seekToDefaultPosition() },
                        enabled = isSeekable && !isLiveEdge,
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text("Jump to Live", fontSize = 13.sp, color = if (!isLiveEdge) AkashvaniRed else InkMuted)
                    }

                    IconButton(onClick = { seekBy(15_000L) }, enabled = isSeekable && !isLiveEdge) {
                        Icon(Icons.Rounded.Forward10, contentDescription = "Forward 15 seconds", tint = InkDark)
                    }
                }
            }
        }

        item {
            Text(
                text = "Kerala Stations",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = InkDark,
                modifier = Modifier.padding(top = 4.dp)
            )
        }

        items(stations, key = { it.id }) { station ->
            val selected = station.id == currentStation.id
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (selected) Color(0xFFFDF2F3) else CardSurface)
                    .border(
                        width = 1.dp,
                        color = if (selected) AkashvaniRed else Hairline,
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
                            color = if (selected) AkashvaniRed else InkDark
                        )
                        Text(
                            text = "${station.city} · ${station.band} ${station.frequency}",
                            fontSize = 12.sp,
                            color = InkMuted
                        )
                    }
                    Text(
                        text = if (selected && isPlaying) "Playing" else if (station.schedule == "daytime") "Daytime" else "24x7",
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        color = if (selected) AkashvaniRed else InkMuted
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
