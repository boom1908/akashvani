import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampSeekTarget,
  filterStations,
  formatDuration,
  formatSeekOffset,
  getKeralaIstTime,
  getNextStreamUrl,
  isAllowedBroadcastHost,
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
    frequency: '576 kHz',
    schedule: '24x7',
    description: 'Primary MW service',
    streamUrl: 'https://radio.wavespb.com/live/primary.m3u8',
    fallbackUrls: ['https://air.pc.cdn.bitgravity.com/air/live/pbaudio230/playlist.m3u8'],
  },
  {
    id: 'kochi',
    name: 'Akashvani Kochi',
    malayalamName: 'ആകാശവാണി കൊച്ചി',
    city: 'Kochi',
    band: 'FM',
    frequency: '102.3 MHz',
    schedule: '24x7',
    description: 'Central Kerala FM',
    streamUrl: 'https://radio.wavespb.com/live/kochi.m3u8',
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

test('IST clock & daytime station schedule checks work accurately', () => {
  // 02:30 UTC = 08:00 AM IST -> Daytime stations ON AIR
  const morningUtc = new Date('2026-11-18T02:30:00Z');
  assert.equal(getKeralaIstTime(morningUtc).formatted, '8:00 AM IST');
  assert.equal(isKeralaDaytimeStationOnAir(morningUtc), true);

  // 20:30 UTC = 02:00 AM IST -> Daytime stations OFF AIR overnight
  const nightUtc = new Date('2026-11-18T20:30:00Z');
  assert.equal(getKeralaIstTime(nightUtc).formatted, '2:00 AM IST');
  assert.equal(isKeralaDaytimeStationOnAir(nightUtc), false);
});

test('filterStations filters by band, favorites, and search query', () => {
  assert.equal(filterStations(SAMPLE_STATIONS, 'MW', '', []).length, 1);
  assert.equal(filterStations(SAMPLE_STATIONS, 'FM', '', []).length, 1);
  assert.equal(filterStations(SAMPLE_STATIONS, 'FAVORITES', '', ['kochi']).length, 1);
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

test('isAllowedBroadcastHost permits Prasar Bharati CDNs and rejects arbitrary hosts', () => {
  assert.equal(isAllowedBroadcastHost('https://radio.wavespb.com/live/abc/abc.m3u8'), true);
  assert.equal(isAllowedBroadcastHost('https://air.pc.cdn.bitgravity.com/air/live/pbaudio229/playlist.m3u8'), true);
  assert.equal(isAllowedBroadcastHost('https://d3r9rhourdc02u.cloudfront.net/assets/radio/a.m3u8'), true);
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
