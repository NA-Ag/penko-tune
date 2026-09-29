// Listen together: the host broadcasts what they're playing, live, to friends in a private room.
// Rooms are found through the same free public WebTorrent trackers (via Trystero), and the
// room password encrypts the connection handshake; audio flows device to device over WebRTC.
// Everyone hears the host's output (after EQ), so nobody needs a copy of the files.
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Room } from '@trystero-p2p/torrent';
import type { Track } from '../types';
import { PUBLIC_WEBSOCKET_TRACKERS } from '../utils/webtorrent';
import { generateShareKey, toBase64Url } from '../utils/shareCrypto';

const APP_ID = 'penko-tune-listen-together';

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

/**
 * WebRTC defaults Opus to mono at voice bitrates. Advertising stereo and a music bitrate in the
 * remote description makes the sending side encode full-quality stereo.
 */
class HiFiPeerConnection extends RTCPeerConnection {
  setRemoteDescription(description: RTCSessionDescriptionInit) {
    if (description?.sdp) {
      const opus = /a=rtpmap:(\d+) opus\/48000\/2/i.exec(description.sdp);
      if (opus) {
        description = {
          ...description,
          sdp: description.sdp.replace(
            new RegExp(`(a=fmtp:${opus[1]} [^\\r\\n]*)`),
            '$1;stereo=1;sprop-stereo=1;maxaveragebitrate=256000'
          ),
        };
      }
    }
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
  const roomRef = useRef<Room | null>(null);
  const sendNowPlayingRef = useRef<((np: NowPlaying, target?: string) => void) | null>(null);
  const guestAudioRef = useRef<HTMLAudioElement | null>(null);

  const nowPlaying: NowPlaying | null = currentTrack
    ? { name: currentTrack.name, artist: currentTrack.artist, album: currentTrack.album, coverArtUrl: currentTrack.coverArtUrl, isPlaying }
    : null;
  const nowPlayingRef = useRef(nowPlaying);
  nowPlayingRef.current = nowPlaying;

  const openRoom = async (roomId: string, password: string): Promise<Room> => {
    const { joinRoom } = await import('@trystero-p2p/torrent');
    return joinRoom(
      { appId: APP_ID, password, relayConfig: { urls: PUBLIC_WEBSOCKET_TRACKERS }, rtcPolyfill: HiFiPeerConnection },
      roomId
    );
  };

  const leave = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    sendNowPlayingRef.current = null;
    if (guestAudioRef.current) {
      guestAudioRef.current.pause();
      guestAudioRef.current.srcObject = null;
    }
    setState({ role: 'idle' });
    await room?.leave();
  }, []);

  useEffect(() => () => { roomRef.current?.leave(); }, []);

  /** Start a room and broadcast what's playing. Resolves to the invite link. */
  const host = useCallback(async () => {
    if (roomRef.current) await leave();
    const roomId = randomId(16);
    const password = toBase64Url(generateShareKey());
    const stream = getOutputStream();
    const room = await openRoom(roomId, password);
    roomRef.current = room;

    const npAction = room.makeAction<NowPlaying | null>('np');
    sendNowPlayingRef.current = (np, target) => { npAction.send(np, target ? { target } : undefined); };

    const countListeners = () => {
      if (roomRef.current !== room) return;
      setState(prev => (prev.role === 'hosting' ? { ...prev, listeners: Object.keys(room.getPeers()).length } : prev));
    };
    room.onPeerJoin = peerId => {
      room.addStream(stream, { target: peerId });
      npAction.send(nowPlayingRef.current, { target: peerId });
      countListeners();
      addToast('A friend joined your session');
    };
    room.onPeerLeave = countListeners;

    const link = buildRoomLink(roomId, password);
    setState({ role: 'hosting', link, listeners: 0 });
    return link;
  }, [getOutputStream, leave, addToast]);

  // Tell listeners what's playing whenever it changes
  const npKey = nowPlaying ? `${nowPlaying.name}|${nowPlaying.artist}|${nowPlaying.isPlaying}|${nowPlaying.coverArtUrl?.length}` : '';
  useEffect(() => {
    if (state.role === 'hosting') sendNowPlayingRef.current?.(nowPlayingRef.current as NowPlaying);
  }, [npKey, state.role]);

  /** Join a friend's room from an invite link. Must be called from a click (starts audio). */
  const join = useCallback(async (roomId: string, password: string) => {
    if (roomRef.current) await leave();
    onJoin();
    setState({ role: 'joining' });

    const audio = guestAudioRef.current ?? new Audio();
    guestAudioRef.current = audio;
    audio.volume = guestVolume;
    audio.play().catch(() => {}); // unlock playback while we still have the user gesture

    const room = await openRoom(roomId, password);
    roomRef.current = room;
    const npAction = room.makeAction<NowPlaying | null>('np');
    npAction.onMessage = np => {
      setState(prev => (prev.role === 'listening' ? { ...prev, nowPlaying: np } : { role: 'listening', nowPlaying: np, hostConnected: true }));
    };
    room.onPeerStream = stream => {
      audio.srcObject = stream;
      audio.play().catch(err => console.warn('[Listen] Autoplay blocked', err));
      setState(prev => ({ role: 'listening', nowPlaying: prev.role === 'listening' ? prev.nowPlaying : null, hostConnected: true }));
    };
    room.onPeerLeave = () => {
      if (Object.keys(room.getPeers()).length === 0) {
        setState(prev => (prev.role === 'listening' ? { ...prev, hostConnected: false } : prev));
      }
    };
  }, [leave, onJoin, guestVolume]);

  const changeGuestVolume = useCallback((volume: number) => {
    setGuestVolume(volume);
    if (guestAudioRef.current) guestAudioRef.current.volume = volume;
  }, []);

  return { room: state, host, join, leave, guestVolume, changeGuestVolume };
}
