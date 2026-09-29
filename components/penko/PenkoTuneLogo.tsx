import React, { useEffect, useMemo, useState } from 'react';
import { PENKO_TUNE_FRAMES, spriteRects } from './penkoSprite';

interface PenkoTuneLogoProps {
  size?: number;
  className?: string;
  /** Idle "breathing" animation; respects prefers-reduced-motion. */
  animated?: boolean;
}

export const PenkoTuneLogo: React.FC<PenkoTuneLogoProps> = React.memo(({ size = 40, className = '', animated = false }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!animated || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = setInterval(() => setFrame(f => (f + 1) % PENKO_TUNE_FRAMES.length), 500);
    return () => clearInterval(interval);
  }, [animated]);

  const rects = useMemo(() => spriteRects(PENKO_TUNE_FRAMES[frame]), [frame]);

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      role="img"
      aria-label="Penko Tune"
    >
      {rects.map(r => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
});
