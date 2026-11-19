export type StationBand = 'MW' | 'FM';

export type StationSchedule = '24x7' | 'daytime';

export interface RadioStation {
  id: string;
  name: string;
  malayalamName: string;
  city: string;
  band: StationBand;
  frequency: string;
  schedule: StationSchedule;
  description: string;
  streamUrl: string;
  fallbackUrls: string[];
}

export interface StationCatalog {
  version: number;
  updatedAt: string;
  stations: RadioStation[];
}

export type PlaybackStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'reconnecting'
  | 'error';

export type BandFilter = 'ALL' | 'MW' | 'FM' | 'FAVORITES';

export interface SeekState {
  /** Total seekable duration currently buffered in seconds (e.g. 50s -> 300s) */
  bufferSeconds: number;
  /** Seconds behind the live broadcast edge (0 = at LIVE) */
  secondsBehindLive: number;
  /** Whether the user is currently near the live edge (<= 4s behind) */
  isAtLiveEdge: boolean;
  /** True once HLS manifest provides seekable timeline */
  canSeek: boolean;
}
