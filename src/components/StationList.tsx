import { RefreshCw, Search, Star } from 'lucide-react';
import type { PlaybackStatus, RadioStation, StationFilter } from '../types/radio';
import { filterStations, getKeralaIstTime } from '../utils/radioLogic';

interface StationListProps {
  stations: RadioStation[];
  selectedStationId: string;
  playbackStatus: PlaybackStatus;
  liveStatuses: Record<string, 'live' | 'off-air'>;
  isCheckingHealth: boolean;
  stationFilter: StationFilter;
  searchQuery: string;
  favoriteIds: string[];
  onStationFilterChange: (filter: StationFilter) => void;
  onSearchChange: (q: string) => void;
  onSelectStation: (station: RadioStation) => void;
  onToggleFavorite: (stationId: string) => void;
  onRefreshHealth: () => void;
}

const FILTER_TABS: { id: StationFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'AKASHVANI', label: 'Akashvani' },
  { id: 'KERALA_FM', label: 'Kerala FM' },
  { id: 'FAVORITES', label: 'Saved' },
];

export function StationList({
  stations,
  selectedStationId,
  playbackStatus,
  liveStatuses,
  isCheckingHealth,
  stationFilter,
  searchQuery,
  favoriteIds,
  onStationFilterChange,
  onSearchChange,
  onSelectStation,
  onToggleFavorite,
  onRefreshHealth,
}: StationListProps) {
  const filtered = filterStations(stations, stationFilter, searchQuery, favoriteIds);
  const ist = getKeralaIstTime();
  const liveCount = Object.values(liveStatuses).filter((s) => s === 'live').length;

  return (
    <aside
      id="stations"
      aria-label="Kerala Radio Stations"
      className="bg-[#2A2E35] border border-[#3A404B] rounded-3xl p-5 sm:p-6 flex flex-col h-full"
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#F3F5F8]">Kerala Stations</h2>
          <p className="mt-0.5 text-xs text-[#A9B0BC] font-mono tabular-nums">
            {ist.formatted}
            {liveCount > 0 ? ` · ${liveCount} on air now` : ` · ${stations.length} stations`}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefreshHealth}
          disabled={isCheckingHealth}
          aria-label="Check which stations are live right now"
          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-semibold text-[#F3F5F8] bg-[#323740] hover:bg-[#3B414D] border border-[#434A57] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="mt-4 flex flex-col gap-3">
        <div
          role="tablist"
          aria-label="Filter stations"
          className="grid grid-cols-4 gap-1 p-1 bg-[#1B1E24] border border-[#3A404B] rounded-xl"
        >
          {FILTER_TABS.map((tab) => {
            const active = stationFilter === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => onStationFilterChange(tab.id)}
                className={`py-2 px-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#F3F5F8] text-[#181B20]'
                    : 'text-[#A9B0BC] hover:text-[#F3F5F8]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <label htmlFor="station-search" className="sr-only">
            Search Kerala stations
          </label>
          <Search
            className="w-4 h-4 text-[#8F97A6] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="station-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search Akashvani, Mango, Yesudas, Kochi..."
            className="w-full h-11 pl-10 pr-3.5 text-sm bg-[#1B1E24] border border-[#3A404B] rounded-xl text-[#F3F5F8] placeholder:text-[#7E8695] focus:outline-none focus:border-[#A9B0BC] transition-colors"
          />
        </div>
      </div>

      {/* Station Rows */}
      <div className="mt-4 -mx-2 flex-1 overflow-y-auto max-h-[430px] divide-y divide-[#343A45] pr-1">
        {filtered.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <p className="text-sm font-medium text-[#F3F5F8]">No stations match your filter</p>
            <p className="mt-1 text-xs text-[#A9B0BC]">
              {stationFilter === 'FAVORITES'
                ? 'Tap the star next to any station to save it here.'
                : 'Try clearing the search box or switching back to All.'}
            </p>
          </div>
        ) : (
          filtered.map((station) => {
            const isSelected = station.id === selectedStationId;
            const isPlayingThis = isSelected && playbackStatus === 'playing';
            const isFav = favoriteIds.includes(station.id);
            const liveState = liveStatuses[station.id];

            const statusCopy = isPlayingThis
              ? 'Playing'
              : liveState === 'live'
                ? 'On Air'
                : liveState === 'off-air'
                  ? station.schedule === 'daytime'
                    ? 'Daytime'
                    : 'Offline'
                  : station.schedule === 'daytime'
                    ? 'Daytime'
                    : '24x7';

            return (
              <div
                key={station.id}
                className={`flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-xl transition-colors ${
                  isSelected
                    ? 'bg-[#363C47] border border-[#5A6272]/60'
                    : 'hover:bg-[#313640]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectStation(station)}
                  className="flex-1 min-w-0 text-left min-h-[48px] flex flex-col justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F3F5F8] rounded-lg"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-semibold truncate ${
                        isSelected ? 'text-[#FFFFFF]' : 'text-[#E6E9EF]'
                      }`}
                    >
                      {station.name}
                    </span>
                    <span
                      className={`font-mono text-[11px] shrink-0 ${
                        isPlayingThis
                          ? 'text-[#FFFFFF] font-semibold'
                          : liveState === 'live'
                            ? 'text-[#D0D5DF] font-medium'
                            : 'text-[#88909E]'
                      }`}
                    >
                      {statusCopy}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#A2AAB7] truncate">
                    <span className="font-mono tabular-nums">{station.frequency}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{station.city}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleFavorite(station.id)}
                  aria-label={
                    isFav
                      ? `Remove ${station.name} from saved stations`
                      : `Save ${station.name} to favorites`
                  }
                  aria-pressed={isFav}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#3F4653] transition-colors shrink-0 cursor-pointer"
                >
                  <Star
                    className={`w-4 h-4 ${
                      isFav ? 'fill-[#F3F5F8] text-[#F3F5F8]' : 'text-[#777F8E]'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
