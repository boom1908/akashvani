import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampSeekTarget,
  classifyPlaybackFailure,
  filterStations,
  formatDuration,
  formatSeekOffset,
  getKeralaIstTime,
  getNextStreamUrl,
  isAllowedBroadcastHost,
  isHlsUrl,
  isKeralaDaytimeStationOnAir,
  rewriteHlsPlaylist,
} from './radioLogic';
import type { RadioStation } from '../types/radio';

const SAMPLE_STATIONS: RadioStation[] = [
  {
    id: 'kerala',
    name: 'Akashvani Kerala',
    malayalamName: 'ആകാശവാണി കേരളം',
    city: 'Thiruvananthapuram / Alappuzha',
    band: 'MW',
    category: 'akashvani',
    frequency: '576 kHz',
    schedule: '24x7',
    description: 'Primary MW service',
    streamUrl: 'https://radio.wavespb.com/live/primary.m3u8',
    fallbackUrls: ['https://air.pc.cdn.bitgravity.com/air/live/pbaudio230/playlist.m3u8'],
  },
  {
    id: 'mango',
    name: 'Radio Mango 91.9',
    malayalamName: 'റേഡിയോ മാംഗോ',
    city: 'Kochi',
    band: 'FM',
    category: 'kerala-fm',
    frequency: '91.9 MHz',
    schedule: '24x7',
    description: 'Kerala FM',
    streamUrl: 'https://stream.radiomango.ai/listen/radio_mango_ai/radio.mp3',
    fallbackUrls: [],
  },
  {
    id: 'thrissur',
    name: 'Akashvani Thrissur',
    malayalamName: 'ആകാശവാണി തൃശ്ശൂർ',
    city: 'Thrissur',
    band: 'MW',
    category: 'akashvani',
    frequency: '630 kHz',
    schedule: 'daytime',
    description: 'Daytime MW service',
    streamUrl: 'https://radio.wavespb.com/live/thrissur.m3u8',
    fallbackUrls: [],
  },
];

test('formatSeekOffset labels near-live positions as LIVE and formats rewind offsets', () => {
  assert.equal(formatSeekOffset(0), 'LIVE');
  assert.equal(formatSeekOffset(2.6), 'LIVE');
  assert.equal(formatSeekOffset(15), '-00:15');
  assert.equal(formatSeekOffset(125), '-02:05');
  assert.equal(formatSeekOffset(-10), 'LIVE');
});

test('formatDuration formats MM:SS accurately', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(50), '00:50');
  assert.equal(formatDuration(905), '15:05');
});

test('clampSeekTarget stays strictly within seekable live window', () => {
  assert.equal(clampSeekTarget(100, -15, 60, 110), 85);
  assert.equal(clampSeekTarget(65, -15, 60, 110), 60);
  assert.equal(clampSeekTarget(105, 15, 60, 110), 110);
});

test('isHlsUrl distinguishes .m3u8 playlists from direct MP3/AAC streams', () => {
  assert.equal(isHlsUrl('https://radio.wavespb.com/live/abc/abc.m3u8'), true);
  assert.equal(isHlsUrl('https://d3caeelfr0kslf.cloudfront.net/radiokochi.m3u8?token=1'), true);
  assert.equal(isHlsUrl('https://stream.radiomango.ai/listen/radio_mango_ai/radio.mp3'), false);
  assert.equal(isHlsUrl('https://cast1.my-control-panel.com/proxy/radiomattoli/stream'), false);
});

test('IST clock & daytime station schedule checks work accurately', () => {
  const morningUtc = new Date('2026-11-18T02:30:00Z');
  assert.equal(getKeralaIstTime(morningUtc).formatted, '8:00 AM IST');
  assert.equal(isKeralaDaytimeStationOnAir(morningUtc), true);

  const nightUtc = new Date('2026-11-18T20:30:00Z');
  assert.equal(getKeralaIstTime(nightUtc).formatted, '2:00 AM IST');
  assert.equal(isKeralaDaytimeStationOnAir(nightUtc), false);
});

test('filterStations filters by Akashvani, Kerala FM, favorites, and search query', () => {
  assert.equal(filterStations(SAMPLE_STATIONS, 'AKASHVANI', '', []).length, 2);
  assert.equal(filterStations(SAMPLE_STATIONS, 'KERALA_FM', '', []).length, 1);
  assert.equal(filterStations(SAMPLE_STATIONS, 'FAVORITES', '', ['mango']).length, 1);
  assert.equal(filterStations(SAMPLE_STATIONS, 'ALL', 'alappuzha', []).length, 1);
  assert.equal(filterStations(SAMPLE_STATIONS, 'ALL', 'unknown', []).length, 0);
});

test('getNextStreamUrl falls back to backup streams in order', () => {
  const tried = new Set<string>();
  const first = getNextStreamUrl(SAMPLE_STATIONS[0], tried);
  assert.equal(first, 'https://radio.wavespb.com/live/primary.m3u8');
  tried.add(first!);

  const second = getNextStreamUrl(SAMPLE_STATIONS[0], tried);
  assert.equal(second, 'https://air.pc.cdn.bitgravity.com/air/live/pbaudio230/playlist.m3u8');
  tried.add(second!);

  assert.equal(getNextStreamUrl(SAMPLE_STATIONS[0], tried), null);
});

test('isAllowedBroadcastHost permits Akashvani and verified Kerala FM hosts and rejects others', () => {
  assert.equal(isAllowedBroadcastHost('https://radio.wavespb.com/live/abc/abc.m3u8'), true);
  assert.equal(isAllowedBroadcastHost('https://stream.radiomango.ai/listen/radio_mango_ai/radio.mp3'), true);
  assert.equal(isAllowedBroadcastHost('https://cast1.my-control-panel.com/proxy/radiomattoli/stream'), true);
  assert.equal(isAllowedBroadcastHost('https://stream.zeno.fm/anrf216cu68uv'), true);
  assert.equal(isAllowedBroadcastHost('http://127.0.0.1:8080/secret'), false);
  assert.equal(isAllowedBroadcastHost('https://evil.example.com/stream.m3u8'), false);
});

test('rewriteHlsPlaylist rewrites relative segments and tag URIs to local proxy', () => {
  const raw = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-KEY:METHOD=AES-128,URI="key.bin"',
    '#EXTINF:8.333,',
    'chunk_001.ts',
    'https://radio.wavespb.com/live/abc/chunk_002.ts',
  ].join('\n');

  const rewritten = rewriteHlsPlaylist(raw, 'https://radio.wavespb.com/live/abc/index.m3u8');
  assert.match(rewritten, /URI="\/api\/stream-proxy\?url=https%3A%2F%2Fradio\.wavespb\.com%2Flive%2Fabc%2Fkey\.bin"/);
  assert.match(rewritten, /^\/api\/stream-proxy\?url=https%3A%2F%2Fradio\.wavespb\.com%2Flive%2Fabc%2Fchunk_001\.ts$/m);
  assert.match(rewritten, /^\/api\/stream-proxy\?url=https%3A%2F%2Fradio\.wavespb\.com%2Flive%2Fabc%2Fchunk_002\.ts$/m);
});

test('classifyPlaybackFailure pinpoints exact failure reasons accurately', () => {
  const kerala = SAMPLE_STATIONS[0];
  const thrissur = SAMPLE_STATIONS[2];
  const nightUtc = new Date('2026-11-18T20:30:00Z'); // 2:00 AM IST
  const morningUtc = new Date('2026-11-18T04:30:00Z'); // 10:00 AM IST

  // 1. Offline always wins
  const offline = classifyPlaybackFailure({ station: kerala, isOnline: false, httpStatus: 404 });
  assert.equal(offline.code, 'offline');
  assert.match(offline.title, /No internet/i);

  // 2. Daytime station at 2 AM IST => off air overnight
  const offAir = classifyPlaybackFailure({
    station: thrissur,
    isOnline: true,
    httpStatus: 404,
    nowUtc: nightUtc,
  });
  assert.equal(offAir.code, 'daytime_off_air');
  assert.match(offAir.detail, /2:00 AM IST/);

  // 3. Daytime station at 10 AM IST with 404 => link offline/moved, NOT overnight off-air
  const dayBroken = classifyPlaybackFailure({
    station: thrissur,
    isOnline: true,
    httpStatus: 404,
    nowUtc: morningUtc,
  });
  assert.equal(dayBroken.code, 'not_found');

  // 4. 403 blocked
  const blocked = classifyPlaybackFailure({ station: kerala, isOnline: true, httpStatus: 403 });
  assert.equal(blocked.code, 'blocked');

  // 5. 503 server error
  const serverDown = classifyPlaybackFailure({ station: kerala, isOnline: true, httpStatus: 503 });
  assert.equal(serverDown.code, 'server_error');

  // 6. 504 / timeout
  const timedOut = classifyPlaybackFailure({ station: kerala, isOnline: true, httpStatus: 504 });
  assert.equal(timedOut.code, 'timeout');

  // 7. Buffering stall watchdog
  const stalled = classifyPlaybackFailure({ station: kerala, isOnline: true, reason: 'stalled' });
  assert.equal(stalled.code, 'stalled');
});
