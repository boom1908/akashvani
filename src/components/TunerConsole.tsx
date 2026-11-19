import {
  AlertCircle,
  Loader2,
  Moon,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Star,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import type { PlaybackErrorInfo, PlaybackStatus, RadioStation, SeekState } from '../types/radio';
import { formatDuration, formatSeekOffset } from '../utils/radioLogic';

interface TunerConsoleProps {
  station: RadioStation;
  stationIndex: number;
  totalStations: number;
  status: PlaybackStatus;
  errorInfo: PlaybackErrorInfo | null;
  isOnline: boolean;
  usingFallback: boolean;
  volume: number;
  isMuted: boolean;
  seekState: SeekState;
  sleepSecondsLeft: number | null;
  reconnectCount: number;
  audioLevels: number[];
  isFavorite: boolean;
  onToggleFavorite: (stationId: string) => void;
  onTogglePlayPause: () => void;
  onRetry: () => void;
  onSeekBy: (deltaSeconds: number) => void;
  onSeekToOffsetFromEnd: (secondsBehindLive: number) => void;
  onJumpToLive: () => void;
  onVolumeChange: (value: number) => void;
  onToggleMute: () => void;
  onSetSleepMinutes: (minutes: number | null) => void;
  onSwitchToPrimary24x7: () => void;
}

const SLEEP_PRESETS = [
  { label: 'Off', minutes: null },
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '60m', minutes: 60 },
] as const;

export function TunerConsole({
  station,
  stationIndex,
  totalStations,
  status,
  errorInfo,
  isOnline,
  usingFallback,
  volume,
  isMuted,
  seekState,
  sleepSecondsLeft,
  reconnectCount,
  audioLevels,
  isFavorite,
  onToggleFavorite,
  onTogglePlayPause,
  onRetry,
  onSeekBy,
  onSeekToOffsetFromEnd,
  onJumpToLive,
  onVolumeChange,
  onToggleMute,
  onSetSleepMinutes,
  onSwitchToPrimary24x7,
}: TunerConsoleProps) {
  const isPlaying = status === 'playing';
  const isBusy = status === 'loading' || status === 'reconnecting';

  const statusLabel = (() => {
    if (!isOnline) {
      return 'No internet connection';
    }
    switch (status) {
      case 'playing':
        return seekState.isAtLiveEdge
          ? usingFallback
            ? 'On Air · Backup'
            : 'On Air · Live'
          : 'On Air · Rewind';
      case 'loading':
        return usingFallback ? 'Switching to backup link...' : `Connecting to ${station.name}...`;
      case 'reconnecting':
        return reconnectCount > 0
          ? `Reconnecting (try ${reconnectCount} of 3)...`
          : 'Trying backup stream...';
      case 'paused':
        return 'Paused';
      case 'error':
        return errorInfo?.title ?? 'Station unavailable';
      default:
        return 'Ready to tune';
    }
  })();

  // Needle position along the classic tuner scale (10% to 90%)
  const needlePercent =
    totalStations > 1 ? 10 + (stationIndex / (totalStations - 1)) * 80 : 50;

  // Scrubber slider goes from 0 (oldest buffered point) to bufferSeconds (live edge)
  const sliderMax = Math.max(1, Math.round(seekState.bufferSeconds));
  const sliderValue = seekState.canSeek
    ? Math.max(0, Math.min(sliderMax, Math.round(sliderMax - seekState.secondsBehindLive)))
    : sliderMax;

  const volumePercent = isMuted ? 0 : Math.round(volume * 100);

  return (
    <section
      id="tuner"
      aria-label="Live Radio Tuner"
      data-playback-status={status}
      className="flex-1 bg-[#2A2E35] border border-[#3A404B] rounded-3xl p-5 sm:p-8 flex flex-col justify-between gap-5 sm:gap-7"
    >
      {/* Top Station Identity & Unboxed Metadata */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#A9B0BC]">
            <span className="font-mono font-semibold text-[#F3F5F8]">{station.band}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{station.frequency}</span>
            <span aria-hidden="true">·</span>
            <span>{station.city}</span>
          </div>

          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#F3F5F8] [text-wrap:balance]">
            {station.name}
          </h1>

          <p className="mt-1 text-base text-[#A9B0BC]">{station.malayalamName}</p>
        </div>

        <button
          type="button"
          onClick={() => onToggleFavorite(station.id)}
          aria-label={
            isFavorite
              ? `Remove ${station.name} from saved stations`
              : `Save ${station.name} to favorites`
          }
          aria-pressed={isFavorite}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#3F4652] bg-[#323740] hover:border-[#6B7382] hover:bg-[#3A404B] transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F3F5F8]"
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              isFavorite ? 'fill-[#F3F5F8] text-[#F3F5F8]' : 'text-[#8F97A6]'
            }`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Machined Broadcast Dial Window & Real-Time VU Meter */}
      <div className="bg-[#1B1E24] border border-[#343A45] text-[#F3F5F8] rounded-2xl px-5 py-4">
        <div className="flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 font-mono tracking-wide">
            <Radio
              className={`w-3.5 h-3.5 ${
                isPlaying ? 'text-[#F3F5F8]' : 'text-[#7F8796]'
              }`}
              aria-hidden="true"
            />
            <span className={isPlaying ? 'text-[#F3F5F8] font-medium' : 'text-[#A0A8B6]'}>
              {statusLabel}
            </span>
          </div>

          {/* Live Audio Level Bars */}
          <div
            className="flex items-end gap-1 h-5"
            aria-hidden="true"
            data-testid="audio-vu-meter"
          >
            {audioLevels.map((level, idx) => (
              <span
                key={idx}
                style={{
                  transform: `scaleY(${isPlaying ? level : 0.16})`,
                  transformOrigin: 'bottom',
                }}
                className={`w-1 h-full rounded-full transition-transform duration-100 ${
                  isPlaying ? 'bg-[#E5E9F0]' : 'bg-[#3C424F]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Classic Akashvani Frequency Dial Scale */}
        <div className="mt-4 pt-2 pb-1">
          <div className="relative">
            <div className="flex items-end justify-between h-5 border-b border-white/15 px-1">
              {Array.from({ length: 25 }).map((_, i) => (
                <span
                  key={i}
                  className={`w-px ${
                    i % 4 === 0 ? 'h-4 bg-white/45' : 'h-2 bg-white/18'
                  }`}
                />
              ))}
            </div>
            {/* Crisp Monochromatic Tuning Needle confined strictly to the tick scale */}
            <div
              style={{ left: `${needlePercent}%` }}
              className="absolute -top-1.5 bottom-0 w-0.5 bg-[#F3F5F8] transition-all duration-300 ease-out"
              aria-hidden="true"
            >
              <span className="block w-2 h-2 -ml-[3px] rounded-full bg-[#F3F5F8]" />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-[#8E96A5] tabular-nums">
            <span>576 kHz</span>
            <span className="hidden sm:inline">684 kHz</span>
            <span>101.9 FM</span>
            <span className="hidden sm:inline">103.6 FM</span>
            <span>107.5 FM</span>
          </div>
        </div>
      </div>

      {/* Primary Focal Anchor: HUGE Monochromatic Play / Pause Button + Flanking Seek Jumps */}
      <div className="py-2 flex flex-col items-center justify-center gap-5">
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          <button
            type="button"
            onClick={() => onSeekBy(-15)}
            disabled={!seekState.canSeek}
            aria-label="Rewind 15 seconds"
            className="w-14 h-14 rounded-full border border-[#434A57] bg-[#323740] hover:bg-[#3C424E] disabled:opacity-35 disabled:cursor-not-allowed flex flex-col items-center justify-center text-[#F3F5F8] transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F3F5F8]"
          >
            <RotateCcw className="w-5 h-5" aria-hidden="true" />
            <span className="font-mono text-[10px] font-semibold mt-0.5">15s</span>
          </button>

          <button
            type="button"
            onClick={onTogglePlayPause}
            aria-label={isPlaying || isBusy ? `Pause ${station.name}` : `Play ${station.name}`}
            data-testid="huge-play-button"
            className={`w-36 h-36 sm:w-40 sm:h-40 rounded-full flex flex-col items-center justify-center gap-1.5 shadow-lg transition-all duration-150 active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#F3F5F8] cursor-pointer ${
              isPlaying
                ? 'bg-[#363C47] hover:bg-[#414856] text-[#F3F5F8] border-2 border-[#E5E9F0] shadow-black/30'
                : 'bg-[#F3F5F8] hover:bg-[#E1E5EC] text-[#181B20] shadow-black/35'
            }`}
          >
            {isBusy ? (
              <>
                <Loader2 className="w-12 h-12 animate-spin" aria-hidden="true" />
                <span className="text-xs font-semibold tracking-wide">Tuning</span>
              </>
            ) : isPlaying ? (
              <>
                <Pause className="w-14 h-14 fill-current" aria-hidden="true" />
                <span className="text-xs font-semibold tracking-wide">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-14 h-14 fill-current translate-x-1" aria-hidden="true" />
                <span className="text-xs font-semibold tracking-wide">Play Live</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSeekBy(15)}
            disabled={!seekState.canSeek || seekState.isAtLiveEdge}
            aria-label="Forward 15 seconds"
            className="w-14 h-14 rounded-full border border-[#434A57] bg-[#323740] hover:bg-[#3C424E] disabled:opacity-35 disabled:cursor-not-allowed flex flex-col items-center justify-center text-[#F3F5F8] transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F3F5F8]"
          >
            <RotateCw className="w-5 h-5" aria-hidden="true" />
            <span className="font-mono text-[10px] font-semibold mt-0.5">15s</span>
          </button>
        </div>

        {/* Live Rewind / Timeshift Scrubber */}
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-2">
            <span className="text-[#A9B0BC]">
              {!seekState.isHlsStream
                ? 'Continuous live FM broadcast'
                : seekState.canSeek
                  ? `Rewind window ${formatDuration(seekState.bufferSeconds)}`
                  : 'Press Play to build live rewind buffer'}
            </span>
            <div className="flex items-center gap-3">
              <span
                data-testid="seek-offset-label"
                className={`font-semibold ${
                  seekState.isAtLiveEdge && isPlaying ? 'text-[#F3F5F8]' : 'text-[#C2C8D4]'
                }`}
              >
                {formatSeekOffset(seekState.secondsBehindLive)}
              </span>
              {seekState.canSeek && !seekState.isAtLiveEdge && (
                <button
                  type="button"
                  onClick={onJumpToLive}
                  className="text-xs font-sans font-semibold text-[#F3F5F8] underline underline-offset-4 hover:text-[#D5DAE3] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Jump to Live
                </button>
              )}
            </div>
          </div>

          <input
            type="range"
            aria-label="Seek within live broadcast buffer"
            min={0}
            max={sliderMax}
            value={sliderValue}
            disabled={!seekState.canSeek}
            onChange={(e) => {
              const target = Number(e.target.value);
              const behind = Math.max(0, sliderMax - target);
              onSeekToOffsetFromEnd(behind);
            }}
            style={{
              background: seekState.canSeek
                ? `linear-gradient(to right, #E5E9F0 ${(sliderValue / sliderMax) * 100}%, #3E4552 ${(sliderValue / sliderMax) * 100}%)`
                : '#3E4552',
            }}
            className="broadcast-scrubber w-full h-1.5 rounded-full disabled:opacity-45"
          />

          <p className="mt-2 text-xs text-[#9098A6]">
            {seekState.isHlsStream
              ? 'Akashvani streams start with ~50 seconds of rewind and keep up to 5 minutes as you listen.'
              : 'This FM station streams live audio continuously (rewind is available on Akashvani & HLS stations).'}
          </p>
        </div>
      </div>

      {/* Honest Offline / Exact Failure Diagnosis Card (Monochromatic High-Contrast) */}
      {(!isOnline || errorInfo) && (
        <div
          role="alert"
          data-testid="playback-error-banner"
          data-error-code={!isOnline ? 'offline' : errorInfo?.code}
          className="rounded-2xl border border-[#5B6373] bg-[#323740] p-4 flex flex-col gap-3"
        >
          <div className="flex items-start gap-3">
            {!isOnline || errorInfo?.code === 'offline' ? (
              <WifiOff className="w-5 h-5 text-[#F3F5F8] shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-5 h-5 text-[#F3F5F8] shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#F3F5F8]">
                {!isOnline
                  ? 'No internet connection'
                  : (errorInfo?.title ?? 'Station unavailable')}
              </p>
              <p className="mt-0.5 text-sm text-[#C8CED8] leading-relaxed">
                {!isOnline
                  ? 'Check your Wi-Fi or mobile data. Playback will start again automatically as soon as your internet returns.'
                  : errorInfo?.detail}
              </p>
            </div>
          </div>

          {isOnline && (
            <div className="flex flex-wrap items-center gap-2 pl-8">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-[#F3F5F8] bg-[#242830] hover:bg-[#1B1E24] border border-[#4D5463] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Try Again</span>
              </button>
              {station.id !== 'akashvani-kerala' && (
                <button
                  type="button"
                  onClick={onSwitchToPrimary24x7}
                  className="px-3.5 py-2 min-h-[38px] text-xs font-semibold text-[#181B20] bg-[#F3F5F8] hover:bg-[#DFE3EA] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Tune Akashvani Kerala (24x7)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Volume & Sleep Timer Bar */}
      <div
        id="sleep-timer"
        className="pt-5 border-t border-[#3A404B] flex flex-col sm:flex-row sm:items-center justify-between gap-5"
      >
        {/* Volume */}
        <div className="flex items-center gap-3 sm:w-48">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute radio' : 'Mute radio'}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-[#343942] text-[#F3F5F8] transition-colors cursor-pointer"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-5 h-5 text-[#8F97A6]" aria-hidden="true" />
            ) : (
              <Volume2 className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
          <input
            type="range"
            aria-label="Volume"
            min={0}
            max={100}
            value={volumePercent}
            onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
            style={{
              background: `linear-gradient(to right, #E5E9F0 ${volumePercent}%, #3E4552 ${volumePercent}%)`,
            }}
            className="broadcast-scrubber flex-1 h-1.5 rounded-full"
          />
        </div>

        {/* Sleep Timer Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#A9B0BC] mr-1">
            <Moon className="w-4 h-4 text-[#A9B0BC]" aria-hidden="true" />
            <span>Sleep</span>
            {sleepSecondsLeft !== null && (
              <span
                data-testid="sleep-countdown"
                className="font-mono font-semibold text-[#F3F5F8] tabular-nums ml-1"
              >
                {formatDuration(sleepSecondsLeft)}
              </span>
            )}
          </div>

          <div
            role="group"
            aria-label="Sleep timer presets"
            className="flex items-center gap-1 p-1 bg-[#1B1E24] rounded-xl border border-[#3A404B]"
          >
            {SLEEP_PRESETS.map((preset) => {
              const isActive =
                preset.minutes === null
                  ? sleepSecondsLeft === null
                  : sleepSecondsLeft !== null &&
                    Math.ceil(sleepSecondsLeft / 60) === preset.minutes;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onSetSleepMinutes(preset.minutes)}
                  className={`px-2.5 py-1.5 min-h-[32px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#F3F5F8] text-[#181B20]'
                      : 'text-[#A9B0BC] hover:text-[#F3F5F8]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
