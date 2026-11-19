import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import type { PlaybackErrorInfo, PlaybackStatus, RadioStation, SeekState } from '../types/radio';
import {
  clampSeekTarget,
  classifyPlaybackFailure,
  getNextStreamUrl,
  isHlsUrl,
} from '../utils/radioLogic';

interface UseRadioPlayerResult {
  status: PlaybackStatus;
  errorInfo: PlaybackErrorInfo | null;
  isOnline: boolean;
  usingFallback: boolean;
  volume: number;
  isMuted: boolean;
  seekState: SeekState;
  sleepSecondsLeft: number | null;
  activeStreamHost: string | null;
  reconnectCount: number;
  audioLevels: number[];
  playStation: (station: RadioStation) => void;
  retryCurrentStation: () => void;
  togglePlayPause: (station: RadioStation) => void;
  seekBy: (deltaSeconds: number) => void;
  seekToOffsetFromEnd: (secondsBehindLive: number) => void;
  jumpToLive: () => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  setSleepMinutes: (minutes: number | null) => void;
}

const DEFAULT_SEEK: SeekState = {
  bufferSeconds: 0,
  secondsBehindLive: 0,
  isAtLiveEdge: true,
  canSeek: false,
  isHlsStream: true,
};

const STALL_WATCHDOG_MS = 15_000;

interface FailureContext {
  httpStatus?: number | null;
  reason?: 'timeout' | 'stalled' | 'unsupported' | 'network' | 'unknown';
}

export function useRadioPlayer(selectedStation: RadioStation | null): UseRadioPlayerResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const stationRef = useRef<RadioStation | null>(selectedStation);
  const currentIsHlsRef = useRef<boolean>(true);
  const loadedStationIdRef = useRef<string | null>(null);
  const triedUrlsRef = useRef<Set<string>>(new Set());
  const reconnectTimerRef = useRef<number | null>(null);
  const stallTimerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const directErrorHandlerRef = useRef<(() => void) | null>(null);
  const stallTriggerRef = useRef<(() => void) | null>(null);
  const wasActiveBeforeOfflineRef = useRef<boolean>(false);
  const loadStreamRef = useRef<((station: RadioStation, url: string, isFallback?: boolean) => void) | null>(null);

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [errorInfo, setErrorInfo] = useState<PlaybackErrorInfo | null>(null);
  const [usingFallback, setUsingFallback] = useState<boolean>(false);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [seekState, setSeekState] = useState<SeekState>(DEFAULT_SEEK);
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState<number | null>(null);
  const [activeStreamHost, setActiveStreamHost] = useState<string | null>(null);
  const [reconnectCount, setReconnectCount] = useState<number>(0);
  const [audioLevels, setAudioLevels] = useState<number[]>([
    0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1,
  ]);

  const statusRef = useRef<PlaybackStatus>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    stationRef.current = selectedStation;
  }, [selectedStation]);

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (stallTimerRef.current) {
      window.clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  const armStallWatchdog = useCallback(() => {
    if (stallTimerRef.current) {
      window.clearTimeout(stallTimerRef.current);
    }
    stallTimerRef.current = window.setTimeout(() => {
      if (statusRef.current === 'loading' || statusRef.current === 'reconnecting') {
        stallTriggerRef.current?.();
      }
    }, STALL_WATCHDOG_MS);
  }, []);

  const clearStallWatchdog = useCallback(() => {
    if (stallTimerRef.current) {
      window.clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  // Real-time online/offline failsafe with automatic resume when internet returns
  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      clearTimers();
      const active =
        statusRef.current === 'playing' ||
        statusRef.current === 'loading' ||
        statusRef.current === 'reconnecting';
      if (active) {
        wasActiveBeforeOfflineRef.current = true;
        audioRef.current?.pause();
        setStatus('error');
        if (stationRef.current) {
          setErrorInfo(
            classifyPlaybackFailure({
              station: stationRef.current,
              isOnline: false,
            })
          );
        }
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      if (wasActiveBeforeOfflineRef.current && stationRef.current) {
        wasActiveBeforeOfflineRef.current = false;
        triedUrlsRef.current.clear();
        setReconnectCount(0);
        setErrorInfo(null);
        loadStreamRef.current?.(stationRef.current, stationRef.current.streamUrl, false);
      } else {
        setErrorInfo((prev) => (prev?.code === 'offline' ? null : prev));
        setStatus((prev) => (prev === 'error' ? 'idle' : prev));
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [clearTimers]);

  // Initialize hidden <audio> element once
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.volume = volume;
    audioRef.current = audio;

    const handlePlaying = () => {
      clearStallWatchdog();
      setStatus('playing');
      setErrorInfo(null);
      setReconnectCount(0);
    };

    const handlePause = () => {
      clearStallWatchdog();
      setStatus((prev) => (prev === 'idle' || prev === 'error' ? prev : 'paused'));
    };

    const handleWaiting = () => {
      setStatus((prev) => {
        if (prev === 'playing') {
          armStallWatchdog();
          return 'loading';
        }
        return prev;
      });
    };

    const handleError = () => {
      if (!currentIsHlsRef.current && directErrorHandlerRef.current) {
        directErrorHandlerRef.current();
      }
    };

    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('error', handleError);
      clearTimers();
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      hlsRef.current?.destroy();
      audio.pause();
      audio.src = '';
    };
  }, [armStallWatchdog, clearStallWatchdog, clearTimers]);

  // Sync volume & mute to audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const ensureAnalyser = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || analyserRef.current) return;
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = new AudioContextCtor();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      // Fallback safely if Web Audio API cannot attach
    }
  }, []);

  // Real-time audio level bars when playing
  useEffect(() => {
    if (status !== 'playing') {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      setAudioLevels(new Array(12).fill(0.08));
      return;
    }

    const dataArray = new Uint8Array(32);
    let lastTick = 0;

    const tick = (now: number) => {
      if (now - lastTick >= 70) {
        lastTick = now;
        const analyser = analyserRef.current;
        if (analyser) {
          analyser.getByteFrequencyData(dataArray);
          const next = Array.from({ length: 12 }, (_, idx) => {
            const raw = dataArray[idx + 1] / 255;
            return Math.max(0.12, Math.min(1, raw * 1.25));
          });
          setAudioLevels(next);
        } else {
          const next = Array.from({ length: 12 }, (_, idx) => {
            const wave = Math.sin(now / 260 + idx * 0.75) * 0.25 + 0.45;
            return Math.max(0.15, Math.min(0.85, wave));
          });
          setAudioLevels(next);
        }
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [status]);

  // Poll seekable buffer & live offset every 500ms (for HLS streams)
  useEffect(() => {
    const interval = window.setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;

      if (!currentIsHlsRef.current) {
        setSeekState((prev) =>
          prev.isHlsStream
            ? {
                bufferSeconds: 0,
                secondsBehindLive: 0,
                isAtLiveEdge: true,
                canSeek: false,
                isHlsStream: false,
              }
            : prev
        );
        return;
      }

      const seekable = audio.seekable;
      if (seekable && seekable.length > 0) {
        const start = seekable.start(0);
        const end = seekable.end(seekable.length - 1);
        const span = Math.max(0, end - start);
        const behind = Math.max(0, end - audio.currentTime);
        setSeekState({
          bufferSeconds: span,
          secondsBehindLive: behind,
          isAtLiveEdge: behind <= 4,
          canSeek: span >= 5,
          isHlsStream: true,
        });
      }
    }, 500);

    return () => window.clearInterval(interval);
  }, []);

  // Sleep timer countdown with gentle 5-second fade-out
  useEffect(() => {
    if (sleepSecondsLeft === null) return;
    if (sleepSecondsLeft <= 0) {
      audioRef.current?.pause();
      setStatus('paused');
      setSleepSecondsLeft(null);
      if (audioRef.current) {
        audioRef.current.volume = isMuted ? 0 : volume;
      }
      return;
    }

    const timer = window.setTimeout(() => {
      const next = sleepSecondsLeft - 1;
      if (next <= 5 && next > 0 && audioRef.current && !isMuted) {
        audioRef.current.volume = Math.max(0.05, volume * (next / 5));
      }
      setSleepSecondsLeft(next);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [sleepSecondsLeft, volume, isMuted]);

  const loadStreamUrl = useCallback(
    (station: RadioStation, targetUrl: string, isFallback = false) => {
      const audio = audioRef.current;
      if (!audio) return;

      clearTimers();

      const currentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      setIsOnline(currentlyOnline);
      if (!currentlyOnline) {
        wasActiveBeforeOfflineRef.current = true;
        hlsRef.current?.destroy();
        hlsRef.current = null;
        audio.pause();
        setStatus('error');
        setErrorInfo(classifyPlaybackFailure({ station, isOnline: false }));
        return;
      }

      hlsRef.current?.destroy();
      hlsRef.current = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();

      const hlsMode = isHlsUrl(targetUrl);
      currentIsHlsRef.current = hlsMode;
      loadedStationIdRef.current = station.id;
      setUsingFallback(isFallback);

      triedUrlsRef.current.add(targetUrl);
      try {
        setActiveStreamHost(new URL(targetUrl).hostname);
      } catch {
        setActiveStreamHost(null);
      }

      const proxiedUrl = `/api/stream-proxy?url=${encodeURIComponent(targetUrl)}`;
      setStatus('loading');
      setErrorInfo(null);
      setSeekState({
        ...DEFAULT_SEEK,
        isHlsStream: hlsMode,
      });

      ensureAnalyser();
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }

      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: station.name,
          artist: `${station.city} · ${station.frequency}`,
          album: 'Akashvani · Kerala Live Radio',
        });
      }

      const handleFatalFailure = (ctx: FailureContext = {}) => {
        clearStallWatchdog();

        const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;
        if (!onlineNow) {
          setIsOnline(false);
          wasActiveBeforeOfflineRef.current = true;
          setStatus('error');
          setErrorInfo(classifyPlaybackFailure({ station, isOnline: false }));
          return;
        }

        // 1. Try backup/fallback URLs immediately before showing an error
        const nextUrl = getNextStreamUrl(station, triedUrlsRef.current);
        if (nextUrl) {
          setStatus('reconnecting');
          loadStreamUrl(station, nextUrl, true);
          return;
        }

        // 2. Retry with exponential backoff (up to 3 retries)
        setReconnectCount((prev) => {
          const attempt = prev + 1;
          if (attempt <= 3) {
            setStatus('reconnecting');
            const delay = Math.min(attempt * 2500, 8000);
            reconnectTimerRef.current = window.setTimeout(() => {
              triedUrlsRef.current.clear();
              loadStreamUrl(station, station.streamUrl, false);
            }, delay);
          } else {
            setStatus('error');
            setErrorInfo(
              classifyPlaybackFailure({
                station,
                isOnline: true,
                httpStatus: ctx.httpStatus,
                reason: ctx.reason,
              })
            );
          }
          return attempt;
        });
      };

      stallTriggerRef.current = () => {
        handleFatalFailure({ reason: 'stalled' });
      };
      armStallWatchdog();

      // For direct MP3/AAC streams, quickly probe the proxy on error to discover exact HTTP code
      directErrorHandlerRef.current = () => {
        const probeController = new AbortController();
        const probeTimeout = window.setTimeout(() => probeController.abort(), 3500);
        fetch(proxiedUrl, { signal: probeController.signal })
          .then((res) => {
            window.clearTimeout(probeTimeout);
            const reasonHeader = res.headers.get('X-Stream-Error-Reason');
            res.body?.cancel().catch(() => {});
            handleFatalFailure({
              httpStatus: res.ok ? null : res.status,
              reason: reasonHeader === 'timeout' ? 'timeout' : 'network',
            });
          })
          .catch(() => {
            window.clearTimeout(probeTimeout);
            handleFatalFailure({ reason: 'timeout' });
          });
      };

      if (!hlsMode) {
        audio.src = proxiedUrl;
        audio.play().catch(() => {
          clearStallWatchdog();
          setStatus('paused');
        });
        return;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 300,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 6,
          manifestLoadingTimeOut: 10000,
          levelLoadingTimeOut: 10000,
          fragLoadingTimeOut: 12000,
        });

        hlsRef.current = hls;
        hls.loadSource(proxiedUrl);
        hls.attachMedia(audio);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          audio.play().catch(() => {
            clearStallWatchdog();
            setStatus('paused');
          });
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }

          const httpStatus =
            typeof data.response?.code === 'number' && data.response.code > 0
              ? data.response.code
              : null;
          const isTimeout =
            data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
            data.details === Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT ||
            data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT;

          handleFatalFailure({
            httpStatus,
            reason: isTimeout ? 'timeout' : 'network',
          });
        });
      } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        audio.src = proxiedUrl;
        audio.play().catch(() => {
          clearStallWatchdog();
          setStatus('paused');
        });
      } else {
        clearStallWatchdog();
        setStatus('error');
        setErrorInfo(
          classifyPlaybackFailure({
            station,
            isOnline: true,
            reason: 'unsupported',
          })
        );
      }
    },
    [armStallWatchdog, clearStallWatchdog, clearTimers, ensureAnalyser]
  );

  useEffect(() => {
    loadStreamRef.current = loadStreamUrl;
  }, [loadStreamUrl]);

  const playStation = useCallback(
    (station: RadioStation) => {
      wasActiveBeforeOfflineRef.current = false;
      triedUrlsRef.current.clear();
      setReconnectCount(0);
      loadStreamUrl(station, station.streamUrl, false);
    },
    [loadStreamUrl]
  );

  const retryCurrentStation = useCallback(() => {
    if (!stationRef.current) return;
    playStation(stationRef.current);
  }, [playStation]);

  const togglePlayPause = useCallback(
    (station: RadioStation) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (status === 'playing' || status === 'loading' || status === 'reconnecting') {
        wasActiveBeforeOfflineRef.current = false;
        clearTimers();
        audio.pause();
        setStatus('paused');
        return;
      }

      if (
        status === 'paused' &&
        loadedStationIdRef.current === station.id &&
        currentIsHlsRef.current &&
        hlsRef.current &&
        isOnline
      ) {
        if (audioCtxRef.current?.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
        audio.play().catch(() => {
          playStation(station);
        });
        return;
      }

      playStation(station);
    },
    [clearTimers, isOnline, status, playStation]
  );

  const seekBy = useCallback((deltaSeconds: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.seekable || audio.seekable.length === 0) return;
    const min = audio.seekable.start(0);
    const max = audio.seekable.end(audio.seekable.length - 1);
    const target = clampSeekTarget(audio.currentTime, deltaSeconds, min, max);
    audio.currentTime = target;
    setSeekState((prev) => ({
      ...prev,
      secondsBehindLive: Math.max(0, max - target),
      isAtLiveEdge: max - target <= 4,
    }));
  }, []);

  const seekToOffsetFromEnd = useCallback((secondsBehindLive: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.seekable || audio.seekable.length === 0) return;
    const min = audio.seekable.start(0);
    const max = audio.seekable.end(audio.seekable.length - 1);
    const target = clampSeekTarget(max, -secondsBehindLive, min, max);
    audio.currentTime = target;
    setSeekState((prev) => ({
      ...prev,
      secondsBehindLive: Math.max(0, max - target),
      isAtLiveEdge: max - target <= 4,
    }));
  }, []);

  const jumpToLive = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.seekable || audio.seekable.length === 0) return;
    const max = audio.seekable.end(audio.seekable.length - 1);
    const target = Math.max(audio.seekable.start(0), max - 1.5);
    audio.currentTime = target;
    setSeekState((prev) => ({
      ...prev,
      secondsBehindLive: 0,
      isAtLiveEdge: true,
    }));
  }, []);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolumeState(clamped);
    if (clamped > 0) setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const setSleepMinutes = useCallback((minutes: number | null) => {
    if (minutes === null || minutes <= 0) {
      setSleepSecondsLeft(null);
      return;
    }
    setSleepSecondsLeft(minutes * 60);
  }, []);

  return {
    status,
    errorInfo,
    isOnline,
    usingFallback,
    volume,
    isMuted,
    seekState,
    sleepSecondsLeft,
    activeStreamHost,
    reconnectCount,
    audioLevels,
    playStation,
    retryCurrentStation,
    togglePlayPause,
    seekBy,
    seekToOffsetFromEnd,
    jumpToLive,
    setVolume,
    toggleMute,
    setSleepMinutes,
  };
}
