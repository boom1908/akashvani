import type { BandFilter, RadioStation } from '../types/radio';

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
 * Filters stations by band/favorites and optional text search.
 */
export function filterStations(
  stations: RadioStation[],
  band: BandFilter,
  query: string,
  favoriteIds: string[]
): RadioStation[] {
  const normalizedQuery = query.trim().toLowerCase();
  const favSet = new Set(favoriteIds);

  return stations.filter((station) => {
    if (band === 'FAVORITES' && !favSet.has(station.id)) {
      return false;
    }
    if ((band === 'MW' || band === 'FM') && station.band !== band) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const haystack = `${station.name} ${station.malayalamName} ${station.city} ${station.frequency} ${station.description}`.toLowerCase();
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
 * Validates that a proxied stream URL belongs to an allowed Akashvani/Prasar Bharati CDN host.
 */
export function isAllowedBroadcastHost(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    const allowedSuffixes = [
      'wavespb.com',
      'bitgravity.com',
      'cloudfront.net',
      'prasarbharati.org',
      'prasarbharati.gov.in',
      'akashvani.gov.in',
      'newsonair.gov.in',
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

      // Rewrite URI="..." attributes inside HLS tags (e.g. EXT-X-KEY, EXT-X-MEDIA, EXT-X-MAP)
      if (trimmed.startsWith('#')) {
        if (trimmed.includes('URI="')) {
          return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
            return `URI="${wrapUrl(uri)}"`;
          });
        }
        return line;
      }

      // Non-comment line is a playlist or segment URL
      return wrapUrl(trimmed);
    })
    .join('\n');
}
