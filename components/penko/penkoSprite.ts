// Penko mascot sprite and the Penko Tune costume.
// Mirrors penko-software-hub (penko_anim/idle.ts, components/penkoColors.ts and the
// 'tune' case in components/PenkoIcon.tsx) so the app matches its Penko Plaza icon.
// Plain TS with no imports: also loaded by generate-icons.js under Node.

// 0=transparent, 1=black, 2=white, 3=blue-gray, 4=orange, 5=red, 6=yellow/gold,
// 7=blue, 8=green, 9=purple, 10=pink, 11=brown, 12=cyan, 13=gray
export const PENKO_COLORS: Record<number, string> = {
  0: 'transparent',
  1: '#111',
  2: '#fff',
  3: '#64748b',
  4: '#f97316',
  5: '#ef4444',
  6: '#fbbf24',
  7: '#3b82f6',
  8: '#22c55e',
  9: '#a855f7',
  10: '#ec4899',
  11: '#8B4513',
  12: '#06b6d4',
  13: '#9ca3af',
};

type Frame = number[][];

const PENKO_IDLE: Frame[] = [
  // Frame 0: normal stance
  [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,1,1,3,3,3,3,3,3,1,1,0,0,0],
    [0,0,1,3,3,3,3,3,3,3,3,3,3,1,0,0],
    [0,0,1,3,2,2,1,3,3,1,2,2,3,1,0,0],
    [0,0,1,3,2,2,1,3,3,1,2,2,3,1,0,0],
    [0,0,1,3,3,3,4,4,4,4,3,3,3,1,0,0],
    [0,1,3,3,3,3,3,3,3,3,3,3,3,3,1,0],
    [0,1,3,3,2,2,2,2,2,2,2,2,3,3,1,0],
    [0,1,3,3,2,2,2,2,2,2,2,2,3,3,1,0],
    [0,1,3,3,2,2,2,2,2,2,2,2,3,3,1,0],
    [0,1,3,3,3,3,3,3,3,3,3,3,3,3,1,0],
    [0,0,1,3,3,3,3,1,1,3,3,3,3,1,0,0],
    [0,0,0,1,4,4,1,0,0,1,4,4,1,0,0,0],
    [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  // Frame 1: breathing (belly expands)
  [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,1,1,3,3,3,3,3,3,1,1,0,0,0],
    [0,0,1,3,3,3,3,3,3,3,3,3,3,1,0,0],
    [0,0,1,3,2,2,1,3,3,1,2,2,3,1,0,0],
    [0,0,1,3,2,2,1,3,3,1,2,2,3,1,0,0],
    [0,0,1,3,3,3,4,4,4,4,3,3,3,1,0,0],
    [0,1,3,3,3,3,3,3,3,3,3,3,3,3,1,0],
    [0,1,3,2,2,2,2,2,2,2,2,2,2,3,1,0],
    [0,1,3,2,2,2,2,2,2,2,2,2,2,3,1,0],
    [0,1,3,3,2,2,2,2,2,2,2,2,3,3,1,0],
    [0,1,3,3,3,3,3,3,3,3,3,3,3,3,1,0],
    [0,0,1,3,3,3,3,1,1,3,3,3,3,1,0,0],
    [0,0,0,1,4,4,1,0,0,1,4,4,1,0,0,0],
    [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
];

/** Studio headphones and a vinyl record: the Penko Tune costume. */
const applyTuneCostume = (frame: Frame): Frame => {
  const m = frame.map(row => [...row]);
  for (let x = 3; x <= 12; x++) {
    m[1][x] = 1; m[2][x] = 1; // headphone band
  }
  for (let y = 3; y <= 6; y++) {
    m[y][2] = 9; m[y][3] = 9; // left earcup
    m[y][12] = 9; m[y][13] = 9; // right earcup
  }
  // Vinyl record: outer ring and gold label
  m[8][2] = 1; m[9][1] = 1; m[10][1] = 1; m[11][2] = 1; m[12][3] = 1;
  m[12][4] = 1; m[11][5] = 1; m[10][6] = 1; m[9][6] = 1; m[8][5] = 1;
  m[10][3] = 6; m[10][4] = 6;
  return m;
};

export const PENKO_TUNE_FRAMES: Frame[] = PENKO_IDLE.map(applyTuneCostume);

/** Merge horizontal runs of one colour into a single rect, offset by `pad` pixels. */
export const spriteRects = (frame: Frame, pad = 0) => {
  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  frame.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === c) w++;
      if (c !== 0) rects.push({ x: x + pad, y: y + pad, w, fill: PENKO_COLORS[c] });
      x += w;
    }
  });
  return rects;
};
