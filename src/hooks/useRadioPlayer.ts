import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import type { PlaybackStatus, RadioStation, SeekState } from '../types/radio';
import { clampSeekTarget, getNextStreamUrl } from '../utils/radioLogic';

interface UseRadioPlayerResult {
  status: PlaybackStatus;
  errorMessage: string | null;
  volume: number;
  isMuted: boolean;
  seekState: SeekState;
  sleepSecondsLeft: number | null;
  activeStreamHost: string | null;
  reconnectCount: number;
  audioLevels: number[];
  playStation: (station: RadioStation) => void;
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
};

export function useRadioPlayer(selectedStation: RadioStation | null): UseRadioPlayerResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const stationRef = useRef<RadioStation | null>(selectedStation);
  const triedUrlsRef = useRef<Set<string>>(new Set());
  const reconnectTimerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [seekState, setSeekState] = useState<SeekState>(DEFAULT_SEEK);
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState<number | null>(null);
  const [activeStreamHost, setActiveStreamHost] = useState<string | null>(null);
  const [reconnectCount, setReconnectCount] = useState<number>(0);
  const [audioLevels, setAudioLevels] = useState<number[]>([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);

  useEffect(() => {
    stationRef.current = selectedStation;
  }, [selectedStation]);

  // Initialize hidden <audio> element once
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.volume = volume;
    audioRef.current = audio;

    const handlePlaying = () => {
      setStatus('playing');
      setErrorMessage(null);
      setReconnectCount(0);
    };

    const handlePause = () => {
      setStatus((prev) => (prev === 'idle' || prev === 'error' ? prev : 'paused'));
    };

    const handleWaiting = () => {
      setStatus((prev) => (prev === 'playing' ? 'loading' : prev));
    };

    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('waiting', handleWaiting);

    return () => {
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('waiting', handleWaiting);
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      hlsRef.current?.destroy();
      audio.pause();
      audio.src = '';
    };
  }, []);

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
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
          // Gentle cadence if analyser is unavailable
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

  // Poll seekable buffer & live offset every 500ms
  useEffect(() => {
    const interval = window.setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;

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
    (station: RadioStation, targetUrl: string) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      hlsRef.current?.destroy();
      hlsRef.current = null;

      triedUrlsRef.current.add(targetUrl);
      try {
        setActiveStreamHost(new URL(targetUrl).hostname);
      } catch {
        setActiveStreamHost(null);
      }

      const proxiedUrl = `/api/stream-proxy?url=${encodeURIComponent(targetUrl)}`;
      setStatus('loading');
      setErrorMessage(null);
      setSeekState(DEFAULT_SEEK);

      ensureAnalyser();
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }

      // Register OS lock-screen / media notification metadata
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: station.name,
          artist: `${station.city} · ${station.frequency}`,
          album: 'Akashvani · All India Radio Kerala',
        });
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          // Keep up to 5 minutes of listened broadcast in memory so users can rewind!
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
            setStatus('paused');
          });
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }

          // Try backup URL first if available
          const nextUrl = getNextStreamUrl(station, triedUrlsRef.current);
          if (nextUrl) {
            setStatus('reconnecting');
            loadStreamUrl(station, nextUrl);
            return;
          }

          // Otherwise schedule automatic reconnect up to 4 times
          setReconnectCount((prev) => {
            const attempt = prev + 1;
            if (attempt <= 4) {
              setStatus('reconnecting');
              const delay = Math.min(attempt * 2500, 10000);
              reconnectTimerRef.current = window.setTimeout(() => {
                triedUrlsRef.current.clear();
                loadStreamUrl(station, station.streamUrl);
              }, delay);
            } else {
              setStatus('error');
              setErrorMessage(
                station.schedule === 'daytime'
                  ? `${station.name} broadcasts 5:55 AM – 11:00 PM IST and appears off-air right now.`
                  : `Could not connect to ${station.name}. Check your connection or try another Kerala station.`
              );
            }
            return attempt;
          });
        });
      } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        audio.src = proxiedUrl;
        audio.play().catch(() => setStatus('paused'));
      } else {
        setStatus('error');
        setErrorMessage('Your browser does not support HLS live radio playback.');
      }
    },
    [ensureAnalyser]
  );

  const playStation = useCallback(
    (station: RadioStation) => {
      triedUrlsRef.current.clear();
      setReconnectCount(0);
      loadStreamUrl(station, station.streamUrl);
    },
    [loadStreamUrl]
  );

  const togglePlayPause = useCallback(
    (station: RadioStation) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (status === 'playing' || status === 'loading' || status === 'reconnecting') {
        if (reconnectTimerRef.current) {
          window.clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        audio.pause();
        setStatus('paused');
        return;
      }

      if (status === 'paused' && hlsRef.current && stationRef.current?.id === station.id) {
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
    [status, playStation]
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
    errorMessage,
    volume,
    isMuted,
    seekState,
    sleepSecondsLeft,
    activeStreamHost,
    reconnectCount,
    audioLevels,
    playStation,
    togglePlayPause,
    seekBy,
    seekToOffsetFromEnd,
    jumpToLive,
    setVolume,
    toggleMute,
    setSleepMinutes,
  };
}
