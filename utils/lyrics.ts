// Lyrics: plain text or LRC ("[mm:ss.xx] line") with optional [offset:+/-ms].

export interface LyricLine {
  time: number | null; // seconds; null for unsynced lyrics
  text: string;
}

export interface ParsedLyrics {
  synced: boolean;
  lines: LyricLine[];
}

const TIMESTAMP = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
const META_TAG = /^\[(ar|ti|al|au|by|length|re|ve|#):.*\]$/i;

export const parseLyrics = (text: string): ParsedLyrics => {
  const offsetMatch = /\[offset:\s*([+-]?\d+)\]/i.exec(text);
  const offset = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0;
  const synced: LyricLine[] = [];
  const plain: LyricLine[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || META_TAG.test(line) || /^\[offset:/i.test(line)) continue;
    const stamps = [...line.matchAll(TIMESTAMP)];
    const content = line.replace(TIMESTAMP, '').trim();
    if (stamps.length === 0) {
      plain.push({ time: null, text: line });
      continue;
    }
    // A line can carry several timestamps when it repeats (e.g. a chorus)
    for (const [, min, sec] of stamps) {
      const time = Number(min) * 60 + Number(sec.replace(':', '.')) - offset;
      synced.push({ time: Math.max(0, time), text: content });
    }
  }

  if (synced.length) {
    synced.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
    return { synced: true, lines: synced };
  }
  return { synced: false, lines: plain };
};

/** Index of the line being sung at `time` (the last line that has started), or -1. */
export const activeLineIndex = (lyrics: ParsedLyrics, time: number): number => {
  if (!lyrics.synced) return -1;
  let index = -1;
  for (let i = 0; i < lyrics.lines.length; i++) {
    if ((lyrics.lines[i].time ?? 0) <= time + 0.15) index = i;
    else break;
  }
  return index;
};

/** File name without its extension, lowercased, for matching song.mp3 with song.lrc. */
export const baseName = (name: string) => name.replace(/\.[^/.]+$/, '').toLowerCase();
