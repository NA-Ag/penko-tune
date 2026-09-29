import { BarChart2, Waves, Activity, Disc, Sparkles, TrendingUp, Radio, Dna, type LucideIcon } from 'lucide-react';
import { VisualizerMode } from '../types';
import type { Translation } from '../translations';

export const VISUALIZER_OPTIONS: { mode: VisualizerMode; icon: LucideIcon; labelKey: keyof Translation }[] = [
  { mode: VisualizerMode.BARS, icon: BarChart2, labelKey: 'visBars' },
  { mode: VisualizerMode.SPECTRUM, icon: TrendingUp, labelKey: 'visSpec' },
  { mode: VisualizerMode.WAVE, icon: Waves, labelKey: 'visWave' },
  { mode: VisualizerMode.CIRCLE, icon: Activity, labelKey: 'visCircle' },
  { mode: VisualizerMode.SPIRAL, icon: Disc, labelKey: 'visSpiral' },
  { mode: VisualizerMode.PARTICLES, icon: Sparkles, labelKey: 'visStars' },
  { mode: VisualizerMode.RINGS, icon: Radio, labelKey: 'visRings' },
  { mode: VisualizerMode.DNA, icon: Dna, labelKey: 'visDNA' },
];
