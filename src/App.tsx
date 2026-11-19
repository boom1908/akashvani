import { useCallback, useEffect, useState } from 'react';
import initialCatalog from '../stations.json';
import type { RadioStation, StationCatalog, StationFilter } from './types/radio';
import { useRadioPlayer } from './hooks/useRadioPlayer';
import { Header } from './components/Header';
import { TunerConsole } from './components/TunerConsole';
import { StationList } from './components/StationList';
import { AndroidExportSection } from './components/AndroidExportSection';

const FAVORITES_KEY = 'akashvani_favorites_v1';
const LAST_STATION_KEY = 'akashvani_last_station_v1';

const SEED_STATIONS = (initialCatalog as StationCatalog).stations;

function loadStoredFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) return ['akashvani-kerala', 'akashvani-kochi'];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return ['akashvani-kerala', 'akashvani-kochi'];
  }
}

function loadInitialStationId(stations: RadioStation[]): string {
  try {
    const saved = window.localStorage.getItem(LAST_STATION_KEY);
    if (saved && stations.some((s) => s.id === saved)) {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return stations[0]?.id ?? 'akashvani-kerala';
}

export default function App() {
  const [stations, setStations] = useState<RadioStation[]>(SEED_STATIONS);
  const [selectedId, setSelectedId] = useState<string>(() => loadInitialStationId(SEED_STATIONS));
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadStoredFavorites());
  const [stationFilter, setStationFilter] = useState<StationFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [liveStatuses, setLiveStatuses] = useState<Record<string, 'live' | 'off-air'>>({});
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);

  const selectedStation =
    stations.find((s) => s.id === selectedId) ?? stations[0] ?? SEED_STATIONS[0];
  const selectedIndex = Math.max(
    0,
    stations.findIndex((s) => s.id === selectedStation.id)
  );

  const player = useRadioPlayer(selectedStation);

  // Sync catalog from server (/api/stations) on mount
  useEffect(() => {
    fetch('/api/stations')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StationCatalog | null) => {
        if (data?.stations?.length) {
          setStations(data.stations);
        }
      })
      .catch(() => {
        // Seed catalog already loaded
      });
  }, []);

  const checkHealth = useCallback(async (forceRefresh = false) => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch(`/api/station-status${forceRefresh ? '?refresh=1' : ''}`);
      if (res.ok) {
        const data = (await res.json()) as { statuses?: Record<string, 'live' | 'off-air'> };
        if (data.statuses) {
          setLiveStatuses(data.statuses);
        }
      }
    } catch {
      // ignore transient probe errors
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    checkHealth(false);
  }, [checkHealth]);

  // Persist favorites and last tuned station
  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds));
    } catch {
      // ignore storage errors
    }
  }, [favoriteIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_STATION_KEY, selectedId);
    } catch {
      // ignore storage errors
    }
  }, [selectedId]);

  // Spacebar play/pause and arrow seeking when not typing in search input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        player.togglePlayPause(selectedStation);
      } else if (e.code === 'ArrowLeft') {
        player.seekBy(-15);
      } else if (e.code === 'ArrowRight') {
        player.seekBy(15);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [player, selectedStation]);

  const handleSelectStation = useCallback(
    (station: RadioStation) => {
      setSelectedId(station.id);
      player.playStation(station);
    },
    [player]
  );

  const handleToggleFavorite = useCallback((stationId: string) => {
    setFavoriteIds((prev) =>
      prev.includes(stationId) ? prev.filter((id) => id !== stationId) : [...prev, stationId]
    );
  }, []);

  const handleNavigate = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleSwitchToPrimary24x7 = useCallback(() => {
    const primary = stations.find((s) => s.id === 'akashvani-kerala') ?? stations[0];
    if (primary) {
      handleSelectStation(primary);
    }
  }, [stations, handleSelectStation]);

  return (
    <div className="min-h-screen flex flex-col bg-[#22252B] text-[#F3F5F8]">
      <Header onNavigate={handleNavigate} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-8">
        {/* Main 2-Column Broadcast Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 flex flex-col">
            <TunerConsole
              station={selectedStation}
              stationIndex={selectedIndex}
              totalStations={stations.length}
              status={player.status}
              errorInfo={player.errorInfo}
              isOnline={player.isOnline}
              usingFallback={player.usingFallback}
              volume={player.volume}
              isMuted={player.isMuted}
              seekState={player.seekState}
              sleepSecondsLeft={player.sleepSecondsLeft}
              reconnectCount={player.reconnectCount}
              audioLevels={player.audioLevels}
              isFavorite={favoriteIds.includes(selectedStation.id)}
              onToggleFavorite={handleToggleFavorite}
              onTogglePlayPause={() => player.togglePlayPause(selectedStation)}
              onRetry={player.retryCurrentStation}
              onSeekBy={player.seekBy}
              onSeekToOffsetFromEnd={player.seekToOffsetFromEnd}
              onJumpToLive={player.jumpToLive}
              onVolumeChange={player.setVolume}
              onToggleMute={player.toggleMute}
              onSetSleepMinutes={player.setSleepMinutes}
              onSwitchToPrimary24x7={handleSwitchToPrimary24x7}
            />
          </div>

          <div className="lg:col-span-5 flex flex-col">
            <StationList
              stations={stations}
              selectedStationId={selectedStation.id}
              playbackStatus={player.status}
              liveStatuses={liveStatuses}
              isCheckingHealth={isCheckingHealth}
              stationFilter={stationFilter}
              searchQuery={searchQuery}
              favoriteIds={favoriteIds}
              onStationFilterChange={setStationFilter}
              onSearchChange={setSearchQuery}
              onSelectStation={handleSelectStation}
              onToggleFavorite={handleToggleFavorite}
              onRefreshHealth={() => checkHealth(true)}
            />
          </div>
        </div>

        {/* Native Android APK + GitHub Releases Export Section */}
        <AndroidExportSection />
      </main>

      <footer className="border-t border-[#363C47] py-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#8F97A6]">
          <span>Akashvani (ആകാശവാണി) · Live Malayalam Radio Tuner</span>
          <span>Space to Play/Pause · Left/Right arrows to seek ±15s</span>
        </div>
      </footer>
    </div>
  );
}
