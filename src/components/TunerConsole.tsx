import {
  Loader2,
  Moon,
  Pause,
  Play,
  Radio,
  RotateCcw,
  RotateCw,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { PlaybackStatus, RadioStation, SeekState } from '../types/radio';
import { formatDuration, formatSeekOffset } from '../utils/radioLogic';

interface TunerConsoleProps {
  station: RadioStation;
  stationIndex: number;
  totalStations: number;
  status: PlaybackStatus;
  errorMessage: string | null;
  volume: number;
  isMuted: boolean;
  seekState: SeekState;
  sleepSecondsLeft: number | null;
  reconnectCount: number;
  audioLevels: number[];
  isFavorite: boolean;
  onToggleFavorite: (stationId: string) => void;
  onTogglePlayPause: () => void;
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
  errorMessage,
  volume,
  isMuted,
  seekState,
  sleepSecondsLeft,
  reconnectCount,
  audioLevels,
  isFavorite,
  onToggleFavorite,
  onTogglePlayPause,
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
    switch (status) {
      case 'playing':
        return seekState.isAtLiveEdge ? 'On Air · Live' : 'Playing · Time-shifted';
      case 'loading':
        return 'Connecting to Akashvani...';
      case 'reconnecting':
        return `Reconnecting (attempt ${reconnectCount})...`;
      case 'paused':
        return 'Paused';
      case 'error':
        return 'Station unavailable';
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
      className="flex-1 bg-white border border-[#E2E5EB] rounded-3xl p-5 sm:p-8 flex flex-col justify-between gap-5 sm:gap-7"
    >
      {/* Top Station Identity & Unboxed Metadata */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#5A6070]">
            <span className="font-mono font-semibold text-[#111318]">{station.band}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{station.frequency}</span>
            <span aria-hidden="true">·</span>
            <span>{station.city}</span>
          </div>

          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#111318] [text-wrap:balance]">
            {station.name}
          </h1>

          <p className="mt-1 text-base text-[#525866]">{station.malayalamName}</p>
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
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#E2E5EB] hover:border-[#C8232C]/40 hover:bg-[#F6F7F9] transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8232C]"
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              isFavorite ? 'fill-[#C8232C] text-[#C8232C]' : 'text-[#6B7280]'
            }`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Machined Broadcast Dial Window & Real-Time VU Meter */}
      <div className="bg-[#15181F] text-white rounded-2xl px-5 py-4">
        <div className="flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 font-mono tracking-wide">
            <Radio
              className={`w-3.5 h-3.5 ${
                isPlaying ? 'text-[#EF4444]' : 'text-[#8B92A5]'
              }`}
              aria-hidden="true"
            />
            <span className={isPlaying ? 'text-white font-medium' : 'text-[#A0A7B8]'}>
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
                  isPlaying ? 'bg-[#EF4444]' : 'bg-[#3A4050]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Classic Akashvani Frequency Dial Scale */}
        <div className="mt-4 relative pt-3 pb-1">
          <div className="flex items-end justify-between h-5 border-b border-white/15 px-1">
            {Array.from({ length: 25 }).map((_, i) => (
              <span
                key={i}
                className={`w-px ${
                  i % 4 === 0 ? 'h-4 bg-white/45' : 'h-2 bg-white/20'
                }`}
              />
            ))}
          </div>
          {/* Crimson Broadcast Tuning Needle */}
          <div
            style={{ left: `${needlePercent}%` }}
            className="absolute top-1 bottom-0.5 w-0.5 bg-[#EF4444] transition-all duration-300 ease-out"
            aria-hidden="true"
          >
            <span className="block w-2 h-2 -ml-[3px] rounded-full bg-[#EF4444]" />
          </div>
          <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-[#9098AC] tabular-nums">
            <span>576 kHz</span>
            <span>684 kHz</span>
            <span>101.9 FM</span>
            <span>103.6 FM</span>
            <span>107.5 FM</span>
          </div>
        </div>
      </div>

      {/* Primary Focal Anchor: HUGE Play / Pause Button + Flanking Seek Jumps */}
      <div className="py-2 flex flex-col items-center justify-center gap-5">
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          <button
            type="button"
            onClick={() => onSeekBy(-15)}
            disabled={!seekState.canSeek}
            aria-label="Rewind 15 seconds"
            className="w-14 h-14 rounded-full border border-[#E2E5EB] bg-[#F6F7F9] hover:bg-[#ECEEF3] disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center text-[#111318] transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8232C]"
          >
            <RotateCcw className="w-5 h-5" aria-hidden="true" />
            <span className="font-mono text-[10px] font-semibold mt-0.5">15s</span>
          </button>

          <button
            type="button"
            onClick={onTogglePlayPause}
            aria-label={isPlaying || isBusy ? `Pause ${station.name}` : `Play ${station.name}`}
            data-testid="huge-play-button"
            className={`w-36 h-36 sm:w-40 sm:h-40 rounded-full flex flex-col items-center justify-center gap-1.5 text-white shadow-lg transition-all duration-150 active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#C8232C] cursor-pointer ${
              isPlaying
                ? 'bg-[#111318] hover:bg-[#1E222C] shadow-[#111318]/20'
                : 'bg-[#C8232C] hover:bg-[#B11D25] shadow-[#C8232C]/25'
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
            className="w-14 h-14 rounded-full border border-[#E2E5EB] bg-[#F6F7F9] hover:bg-[#ECEEF3] disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center text-[#111318] transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8232C]"
          >
            <RotateCw className="w-5 h-5" aria-hidden="true" />
            <span className="font-mono text-[10px] font-semibold mt-0.5">15s</span>
          </button>
        </div>

        {/* Live Rewind / Timeshift Scrubber */}
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-2">
            <span className="text-[#5A6070]">
              {seekState.canSeek
                ? `Rewind window ${formatDuration(seekState.bufferSeconds)}`
                : 'Press Play to build live rewind buffer'}
            </span>
            <div className="flex items-center gap-3">
              <span
                data-testid="seek-offset-label"
                className={`font-semibold ${
                  seekState.isAtLiveEdge && isPlaying ? 'text-[#C8232C]' : 'text-[#111318]'
                }`}
              >
                {formatSeekOffset(seekState.secondsBehindLive)}
              </span>
              {seekState.canSeek && !seekState.isAtLiveEdge && (
                <button
                  type="button"
                  onClick={onJumpToLive}
                  className="text-xs font-sans font-semibold text-[#C8232C] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
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
                ? `linear-gradient(to right, #C8232C ${(sliderValue / sliderMax) * 100}%, #E2E5EB ${(sliderValue / sliderMax) * 100}%)`
                : '#E2E5EB',
            }}
            className="broadcast-scrubber w-full h-1.5 rounded-full disabled:opacity-45"
          />

          <p className="mt-2 text-xs text-[#646B7A]">
            Live radio starts with ~50 seconds of rewind and keeps up to 5 minutes as you listen.
          </p>
        </div>
      </div>

      {/* Honest Error / Overnight Off-Air Notice */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-2xl border border-[#C8232C]/25 bg-[#FDF4F4] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <p className="text-sm text-[#7F1D1D]">{errorMessage}</p>
          {station.id !== 'akashvani-kerala' && (
            <button
              type="button"
              onClick={onSwitchToPrimary24x7}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#C8232C] hover:bg-[#B11D25] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              Tune Akashvani Kerala (24x7)
            </button>
          )}
        </div>
      )}

      {/* Volume & Sleep Timer Bar */}
      <div
        id="sleep-timer"
        className="pt-5 border-t border-[#E2E5EB] flex flex-col sm:flex-row sm:items-center justify-between gap-5"
      >
        {/* Volume */}
        <div className="flex items-center gap-3 sm:w-48">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute radio' : 'Mute radio'}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-[#F6F7F9] text-[#111318] transition-colors cursor-pointer"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-5 h-5 text-[#646B7A]" aria-hidden="true" />
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
              background: `linear-gradient(to right, #111318 ${volumePercent}%, #E2E5EB ${volumePercent}%)`,
            }}
            className="broadcast-scrubber flex-1 h-1.5 rounded-full"
          />
        </div>

        {/* Sleep Timer Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#525866] mr-1">
            <Moon className="w-4 h-4 text-[#525866]" aria-hidden="true" />
            <span>Sleep</span>
            {sleepSecondsLeft !== null && (
              <span
                data-testid="sleep-countdown"
                className="font-mono font-semibold text-[#C8232C] tabular-nums ml-1"
              >
                {formatDuration(sleepSecondsLeft)}
              </span>
            )}
          </div>

          <div
            role="group"
            aria-label="Sleep timer presets"
            className="flex items-center gap-1 p-1 bg-[#F6F7F9] rounded-xl border border-[#E2E5EB]"
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
                      ? 'bg-[#111318] text-white'
                      : 'text-[#525866] hover:text-[#111318]'
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
