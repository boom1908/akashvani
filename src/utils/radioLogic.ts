import type { RadioStation, StationFilter } from '../types/radio';

/**
 * Formats seconds behind the live edge into a clear radio timecode.
 * Returns "LIVE" when within 3 seconds of the live broadcast edge.
 */
export function formatSeekOffset(secondsBehindLive: number): string {
  const safe = Math.max(0, Math.round(secondsBehindLive));
  if (safe <= 3) {
    return 'LIVE';
  }
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `-${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Formats a duration in seconds as MM:SS for sleep timers and buffer windows.
 */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Clamps a seek target strictly within the available HLS seekable window.
 */
export function clampSeekTarget(
  currentTime: number,
  deltaSeconds: number,
  minSeekable: number,
  maxSeekable: number
): number {
  if (maxSeekable <= minSeekable) {
    return minSeekable;
  }
  const candidate = currentTime + deltaSeconds;
  return Math.min(maxSeekable, Math.max(minSeekable, candidate));
}

/**
 * Returns true if the URL points to an HLS (.m3u8) playlist stream.
 */
export function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url);
}

/**
 * Computes current India Standard Time (UTC+5:30) hours and minutes.
 */
export function getKeralaIstTime(nowUtc: Date = new Date()): {
  hours: number;
  minutes: number;
  formatted: string;
} {
  const istOffsetMinutes = 5 * 60 + 30;
  const totalMinutesUtc = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes();
  const totalMinutesIst = (totalMinutesUtc + istOffsetMinutes) % (24 * 60);
  const hours = Math.floor(totalMinutesIst / 60);
  const minutes = totalMinutesIst % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  const formatted = `${displayHour}:${String(minutes).padStart(2, '0')} ${period} IST`;
  return { hours, minutes, formatted };
}

/**
 * Daytime-only regional Akashvani stations (Thrissur, Kannur, Manjeri, Devikulam)
 * generally broadcast between 05:55 AM and 11:05 PM IST.
 */
export function isKeralaDaytimeStationOnAir(nowUtc: Date = new Date()): boolean {
  const { hours, minutes } = getKeralaIstTime(nowUtc);
  const minuteOfDay = hours * 60 + minutes;
  const startMinute = 5 * 60 + 55; // 05:55 IST
  const endMinute = 23 * 60 + 5; // 23:05 IST
  return minuteOfDay >= startMinute && minuteOfDay <= endMinute;
}

/**
 * Filters stations by category/favorites and optional text search.
 */
export function filterStations(
  stations: RadioStation[],
  filter: StationFilter,
  query: string,
  favoriteIds: string[]
): RadioStation[] {
  const normalizedQuery = query.trim().toLowerCase();
  const favSet = new Set(favoriteIds);

  return stations.filter((station) => {
    if (filter === 'FAVORITES' && !favSet.has(station.id)) {
      return false;
    }
    if (filter === 'AKASHVANI' && station.category !== 'akashvani') {
      return false;
    }
    if (filter === 'KERALA_FM' && station.category !== 'kerala-fm') {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const haystack = `${station.name} ${station.malayalamName} ${station.city} ${station.frequency} ${station.band} ${station.description}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

/**
 * Selects the next untried stream URL (primary or fallback) for automatic failover.
 */
export function getNextStreamUrl(
  station: RadioStation,
  triedUrls: Set<string>
): string | null {
  const candidates = [station.streamUrl, ...station.fallbackUrls];
  for (const url of candidates) {
    if (url && !triedUrls.has(url)) {
      return url;
    }
  }
  return null;
}

/**
 * Validates that a proxied stream URL belongs to an allowed Akashvani or verified Kerala FM host.
 */
export function isAllowedBroadcastHost(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    const allowedSuffixes = [
      // Prasar Bharati / Akashvani CDNs
      'wavespb.com',
      'bitgravity.com',
      'cloudfront.net',
      'prasarbharati.org',
      'prasarbharati.gov.in',
      'akashvani.gov.in',
      'newsonair.gov.in',
      // Verified Kerala & Malayalam FM radio hosts
      'radiomango.ai',
      'streamtheworld.com',
      'tritondigital.com',
      'my-control-panel.com',
      'autopo.st',
      'securenetsystems.net',
      'zeno.fm',
      'zenomedia.com',
      'digitalmalayali.in',
      'qfmradio.qa',
    ];
    return allowedSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

/**
 * Rewrites relative and absolute URLs inside an HLS .m3u8 manifest
 * so every sub-playlist and audio segment routes cleanly through our local proxy.
 */
export function rewriteHlsPlaylist(
  manifest: string,
  sourceUrl: string,
  proxyPath = '/api/stream-proxy'
): string {
  const wrapUrl = (uri: string): string => {
    const resolved = new URL(uri, sourceUrl).toString();
    return `${proxyPath}?url=${encodeURIComponent(resolved)}`;
  };

  return manifest
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        if (trimmed.includes('URI="')) {
          return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
            return `URI="${wrapUrl(uri)}"`;
          });
        }
        return line;
      }

      return wrapUrl(trimmed);
    })
    .join('\n');
}

export interface FailureDiagnosisInput {
  station: RadioStation;
  isOnline: boolean;
  httpStatus?: number | null;
  reason?: 'timeout' | 'stalled' | 'unsupported' | 'network' | 'unknown';
  nowUtc?: Date;
}

/**
 * Translates network status, HTTP codes, and Kerala IST broadcast schedules into
 * a clear, honest plain-English diagnosis for listeners.
 */
export function classifyPlaybackFailure({
  station,
  isOnline,
  httpStatus,
  reason = 'unknown',
  nowUtc = new Date(),
}: FailureDiagnosisInput): import('../types/radio').PlaybackErrorInfo {
  if (!isOnline) {
    return {
      code: 'offline',
      title: 'No internet connection',
      detail:
        'Check your Wi-Fi or mobile data. Playback will start again automatically as soon as your internet returns.',
    };
  }

  if (reason === 'unsupported') {
    return {
      code: 'unsupported',
      title: 'Browser cannot play this stream',
      detail: 'Try opening this page in Chrome, Safari, or Edge, or use the Android app.',
    };
  }

  const daytimeOffAirNow =
    station.schedule === 'daytime' && !isKeralaDaytimeStationOnAir(nowUtc);

  if (daytimeOffAirNow && httpStatus !== 403 && httpStatus !== 401) {
    const { formatted } = getKeralaIstTime(nowUtc);
    return {
      code: 'daytime_off_air',
      title: `${station.name} is off air right now`,
      detail: `This regional station only broadcasts 5:55 AM – 11:00 PM IST (it is currently ${formatted}). Switch to Akashvani Kerala for 24-hour live radio.`,
      httpStatus: httpStatus ?? undefined,
    };
  }

  if (httpStatus === 401 || httpStatus === 403) {
    return {
      code: 'blocked',
      title: `Broadcast server blocked this link (Error ${httpStatus})`,
      detail: `${station.name}'s server rejected the connection. You can try another station while the link is updated.`,
      httpStatus,
    };
  }

  if (httpStatus === 404 || httpStatus === 410) {
    return {
      code: 'not_found',
      title: `Stream link is currently offline or moved (Error ${httpStatus})`,
      detail: `${station.name} is not airing on this link right now. Try again later or switch to Akashvani Kerala.`,
      httpStatus,
    };
  }

  if (httpStatus === 504 || reason === 'timeout') {
    return {
      code: 'timeout',
      title: 'Slow connection — server did not reply in time',
      detail: `Connecting to ${station.name} timed out. Your signal may be weak or the broadcast server is busy.`,
      httpStatus: httpStatus ?? undefined,
    };
  }

  if (httpStatus && httpStatus >= 500) {
    return {
      code: 'server_error',
      title: `Broadcast server is temporarily down (Error ${httpStatus})`,
      detail: `${station.name}'s server is having a temporary problem. Wait a minute and tap Try Again.`,
      httpStatus,
    };
  }

  if (reason === 'stalled') {
    return {
      code: 'stalled',
      title: 'Broadcast stopped sending audio',
      detail: `${station.name} froze for 15 seconds without sending sound. Tap Try Again or pick another station.`,
    };
  }

  return {
    code: 'unknown',
    title: `Could not connect to ${station.name}`,
    detail:
      'The station server could not be reached right now. Check your internet signal, tap Try Again, or switch to Akashvani Kerala.',
    httpStatus: httpStatus ?? undefined,
  };
}
