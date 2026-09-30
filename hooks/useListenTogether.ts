// Listen together: the host broadcasts what they're playing, live, to friends in a private room.
// Peers find each other through Trystero over two free signalling networks at once, public
// Nostr relays (fast, reliable) and WebTorrent trackers, and the first to connect wins. With
// "Use only my trackers" set, only the user's own trackers are used. The room password
// encrypts the connection handshake; audio flows device to device over WebRTC.
// Everyone hears the host's output (after EQ), so nobody needs a copy of the files.
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Room } from '@trystero-p2p/torrent';
import type { Track } from '../types';
import { getTrackers, getIceServers } from '../utils/network';
import { loadPreferences } from '../utils/preferences';
import { generateShareKey, toBase64Url } from '../utils/shareCrypto';
import { tr } from '../utils/i18n';

const APP_ID = 'penko-tune-listen-together';
const JOIN_TIMEOUT_MS = 60_000;

// A type alias (not an interface) so it satisfies Trystero's JSON payload constraint
export type NowPlaying = {
  name: string;
  artist?: string;
  album?: string;
  coverArtUrl?: string;
  isPlaying: boolean;
};

export type RoomState =
  | { role: 'idle' }
  | { role: 'hosting'; link: string; listeners: number }
  | { role: 'joining' }
  | { role: 'listening'; nowPlaying: NowPlaying | null; hostConnected: boolean };

const MUSIC_OPUS_PARAMS: Record<string, string> = { stereo: '1', 'sprop-stereo': '1', maxaveragebitrate: '256000' };

/**
 * Set music-quality Opus parameters on the fmtp line, merging with what's there. (Firefox
 * already sends stereo=1; appending a duplicate makes Chrome reject the description.)
 */
export const withMusicOpus = (sdp: string): string => {
  const opus = /a=rtpmap:(\d+) opus\/48000\/2/i.exec(sdp);
  if (!opus) return sdp;
  return sdp.replace(new RegExp(`a=fmtp:${opus[1]} ([^\\r\\n]*)`), (_, params: string) => {
    const merged = new Map(
      params.split(';').map(p => p.trim()).filter(Boolean).map(p => {
        const [k, ...v] = p.split('=');
        return [k.trim(), v.join('=').trim()] as [string, string];
      })
    );
    for (const [k, v] of Object.entries(MUSIC_OPUS_PARAMS)) merged.set(k, v);
    return `a=fmtp:${opus[1]} ${[...merged].map(([k, v]) => `${k}=${v}`).join(';')}`;
  });
};

/**
 * WebRTC defaults Opus to mono at voice bitrates. Advertising stereo and a music bitrate in the
 * remote description makes the sending side encode full-quality stereo.
 */
class HiFiPeerConnection extends RTCPeerConnection {
  setRemoteDescription(description: RTCSessionDescriptionInit) {
    if (description?.sdp) description = { ...description, sdp: withMusicOpus(description.sdp) };
    return super.setRemoteDescription(description);
  }
}

export const buildRoomLink = (roomId: string, password: string) =>
  `${location.origin}${location.pathname}#listen=${roomId}.${password}`;

export const parseRoomHash = (hash: string): { roomId: string; password: string } | null => {
  const match = /^#listen=([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(hash);
  return match ? { roomId: match[1], password: match[2] } : null;
};

const randomId = (bytes: number) => toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));

interface UseListenTogetherProps {
  getOutputStream: () => MediaStream;
  currentTrack: Track | null;
  isPlaying: boolean;
  /** Pause local playback when joining someone else's room. */
  onJoin: () => void;
  addToast: (message: string, type?: 'error' | 'info') => void;
}

export function useListenTogether({ getOutputStream, currentTrack, isPlaying, onJoin, addToast }: UseListenTogetherProps) {
  const [state, setState] = useState<RoomState>({ role: 'idle' });
  const [guestVolume, setGuestVolume] = useState(1);
  const roomsRef = useRef<Room[]>([]);
  const sendNowPlayingRef = useRef<((np: NowPlaying | null) => void) | null>(null);
  const guestAudioRef = useRef<HTMLAudioElement | null>(null);

  const nowPlaying: NowPlaying | null = currentTrack
    ? { name: currentTrack.name, artist: currentTrack.artist, album: currentTrack.album, coverArtUrl: currentTrack.coverArtUrl, isPlaying }
    : null;
  const nowPlayingRef = useRef(nowPlaying);
  nowPlayingRef.current = nowPlaying;

  /** Join the room on every available signalling network (one Trystero room per network). */
  const openRooms = async (roomId: string, password: string): Promise<Room[]> => {
    const iceServers = getIceServers();
    const common = { appId: APP_ID, password, rtcPolyfill: HiFiPeerConnection, ...(iceServers && { rtcConfig: { iceServers } }) };
    const opening: Promise<Room>[] = [
      import('@trystero-p2p/torrent').then(m => m.joinRoom({ ...common, relayConfig: { urls: getTrackers() } }, `${roomId}-t`)),
    ];
    if (!loadPreferences().onlyCustomTrackers) {
      opening.push(import('@trystero-p2p/nostr').then(m => m.joinRoom(common, `${roomId}-n`)));
    }
    return Promise.all(opening);
  };

  const leave = useCallback(async () => {
    const rooms = roomsRef.current;
    roomsRef.current = [];
    sendNowPlayingRef.current = null;
    if (guestAudioRef.current) {
      guestAudioRef.current.pause();
      guestAudioRef.current.srcObject = null;
    }
    setState({ role: 'idle' });
    await Promise.all(rooms.map(room => room.leave()));
  }, []);

  useEffect(() => () => { roomsRef.current.forEach(room => room.leave()); }, []);

  /** Start a session and broadcast what's playing. Resolves to the invite link. */
  const host = useCallback(async () => {
    if (roomsRef.current.length) await leave();
    const roomId = randomId(16);
    const password = toBase64Url(generateShareKey());
    const stream = getOutputStream();
    const rooms = await openRooms(roomId, password);
    roomsRef.current = rooms;

    const npActions = rooms.map(room => room.makeAction<NowPlaying | null>('np'));
    sendNowPlayingRef.current = np => npActions.forEach(action => action.send(np));

    const countListeners = () => {
      if (roomsRef.current !== rooms) return;
      const listeners = rooms.reduce((n, room) => n + Object.keys(room.getPeers()).length, 0);
      setState(prev => (prev.role === 'hosting' ? { ...prev, listeners } : prev));
    };
    rooms.forEach((room, i) => {
      room.onPeerJoin = peerId => {
        room.addStream(stream, { target: peerId });
        npActions[i].send(nowPlayingRef.current, { target: peerId });
        countListeners();
        addToast(tr('toastFriendJoined'));
      };
      room.onPeerLeave = countListeners;
    });

    const link = buildRoomLink(roomId, password);
    setState({ role: 'hosting', link, listeners: 0 });
    return link;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getOutputStream, leave, addToast]);

  // Tell listeners what's playing whenever it changes
  const npKey = nowPlaying ? `${nowPlaying.name}|${nowPlaying.artist}|${nowPlaying.isPlaying}|${nowPlaying.coverArtUrl?.length}` : '';
  useEffect(() => {
    if (state.role === 'hosting') sendNowPlayingRef.current?.(nowPlayingRef.current);
  }, [npKey, state.role]);

  /** Join a friend's session from an invite link. Must be called from a click (starts audio). */
  const join = useCallback(async (roomId: string, password: string) => {
    if (roomsRef.current.length) await leave();
    onJoin();
    setState({ role: 'joining' });

    const audio = guestAudioRef.current ?? new Audio();
    guestAudioRef.current = audio;
    audio.volume = guestVolume;
    audio.play().catch(() => {}); // unlock playback while we still have the user gesture

    const rooms = await openRooms(roomId, password);
    roomsRef.current = rooms;
    let connected: Room | null = null;

    rooms.forEach(room => {
      room.makeAction<NowPlaying | null>('np').onMessage = np => {
        if (connected && connected !== room) return;
        setState(prev => (prev.role === 'listening' ? { ...prev, nowPlaying: np } : { role: 'listening', nowPlaying: np, hostConnected: true }));
      };
      room.onPeerStream = stream => {
        if (connected) return;
        connected = room;
        // First network to deliver the host's audio wins; drop the others
        const others = rooms.filter(r => r !== room);
        roomsRef.current = [room];
        others.forEach(r => r.leave());
        audio.srcObject = stream;
        audio.play().catch(err => console.warn('[Listen] Autoplay blocked', err));
        setState(prev => ({ role: 'listening', nowPlaying: prev.role === 'listening' ? prev.nowPlaying : null, hostConnected: true }));
      };
      room.onPeerLeave = () => {
        if (connected === room && Object.keys(room.getPeers()).length === 0) {
          setState(prev => (prev.role === 'listening' ? { ...prev, hostConnected: false } : prev));
        }
      };
    });

    setTimeout(() => {
      if (connected || roomsRef.current !== rooms) return; // connected, or the user left
      setState({ role: 'listening', nowPlaying: null, hostConnected: false });
    }, JOIN_TIMEOUT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leave, onJoin, guestVolume]);

  const changeGuestVolume = useCallback((volume: number) => {
    setGuestVolume(volume);
    if (guestAudioRef.current) guestAudioRef.current.volume = volume;
  }, []);

  return { room: state, host, join, leave, guestVolume, changeGuestVolume };
}
