// Where peers find each other. Defaults are free public WebTorrent trackers; people who run
// their own (e.g. a school running `bittorrent-tracker`) can add or substitute them in Settings.
import { loadPreferences } from './preferences';

export const DEFAULT_TRACKERS = [
  'wss://tracker.webtorrent.dev',
  'wss://tracker.openwebtorrent.com',
];

/** Trackers used for share links and listen-together rooms. Changes apply after a reload. */
export const getTrackers = (): string[] => {
  const { customTrackers, onlyCustomTrackers } = loadPreferences();
  const custom = customTrackers.map(t => t.trim()).filter(t => /^wss?:\/\//i.test(t));
  if (onlyCustomTrackers && custom.length) return custom;
  return [...new Set([...custom, ...DEFAULT_TRACKERS])];
};

/**
 * Optional STUN/TURN servers, one per line: "stun:host:port" or "turn:host:port username password".
 * Returns undefined to keep the libraries' defaults. A TURN relay lets peers connect even on
 * networks that block direct connections.
 */
export const parseIceServers = (text: string): RTCIceServer[] | undefined => {
  const servers = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^(stun|stuns|turn|turns):/i.test(line))
    .map(line => {
      const [urls, username, credential] = line.split(/\s+/);
      return username ? { urls, username, credential } : { urls };
    });
  return servers.length ? servers : undefined;
};

export const getIceServers = (): RTCIceServer[] | undefined => parseIceServers(loadPreferences().customIceServers);
