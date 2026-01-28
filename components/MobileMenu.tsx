import React from 'react';
import { X, Compass, ChevronDown, Upload, Sliders, Mic, Timer, Globe, Layout, List, Activity, BarChart2, Waves, Disc, Sparkles, TrendingUp, Radio, Dna, Languages } from 'lucide-react';
import { PlayerState, ViewMode, VisualizerMode } from '../types';
import { Language } from '../translations';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  t: any;
  expandedSection: string | null;
  setExpandedSection: (section: string | null) => void;
  onShowBrowseMusic: () => void;
  onShowArtistPortal: () => void;
  onToggleKaraoke: () => void;
  playerState: PlayerState;
  onShowEQ: () => void;
  onShowSleepTimer: () => void;
  onShowNetworkStream: () => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  visualizerMode: VisualizerMode;
  setVisualizerMode: (mode: VisualizerMode) => void;
  currentLanguage: Language;
  setCurrentLanguage: (lang: Language) => void;
}

export function MobileMenu({
  isOpen,
  onClose,
  t,
  expandedSection,
  setExpandedSection,
  onShowBrowseMusic,
  onShowArtistPortal,
  onToggleKaraoke,
  playerState,
  onShowEQ,
  onShowSleepTimer,
  onShowNetworkStream,
  viewMode,
  setViewMode,
  visualizerMode,
  setVisualizerMode,
  currentLanguage,
  setCurrentLanguage
}: MobileMenuProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-xl flex flex-col animate-in slide-in-from-right duration-200">
      <div className="flex items-center justify-between p-6 border-b border-zinc-800">
        <h2 className="text-xl font-bold text-white">Menu</h2>
        <button 
          onClick={onClose}
          className="p-2 text-zinc-400 hover:text-white"
        >
          <X size={24} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {/* Navigation */}
        <div className="border-b border-zinc-800">
          <button 
            onClick={() => setExpandedSection(expandedSection === 'navigation' ? null : 'navigation')}
            className="w-full flex items-center justify-between p-4 text-left font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors"
          >
            <span className="flex items-center gap-2"><Compass size={18} /> {t.menuNavigation}</span>
            <ChevronDown size={16} className={`transition-transform duration-200 ${expandedSection === 'navigation' ? 'rotate-180' : ''}`} />
          </button>
          
          {expandedSection === 'navigation' && (
            <div className="p-4 grid grid-cols-1 gap-3 bg-zinc-900/30">
              <button onClick={() => { onShowBrowseMusic(); onClose(); }} className="w-full flex items-center gap-3 p-4 bg-zinc-900 rounded-xl active:bg-zinc-800 border border-zinc-800">
                <Compass size={24} className="text-cyan-400" />
                <div className="flex flex-col items-start">
                  <span className="font-medium text-white">{t.browseMusic.split(' - ')[0]}</span>
                  <span className="text-xs text-zinc-500">{t.discoverArtists}</span>
                </div>
              </button>
              <button onClick={() => { onShowArtistPortal(); onClose(); }} className="w-full flex items-center gap-3 p-4 bg-zinc-900 rounded-xl active:bg-zinc-800 border border-zinc-800">
                <Upload size={24} className="text-purple-400" />
                <div className="flex flex-col items-start">
                  <span className="font-medium text-white">{t.artistPortal.split(' - ')[0]}</span>
                  <span className="text-xs text-zinc-500">{t.uploadYourMusic}</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Tools */}
        <div className="border-b border-zinc-800">
          <button 
            onClick={() => setExpandedSection(expandedSection === 'tools' ? null : 'tools')}
            className="w-full flex items-center justify-between p-4 text-left font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors"
          >
            <span className="flex items-center gap-2"><Sliders size={18} /> {t.menuTools}</span>
            <ChevronDown size={16} className={`transition-transform duration-200 ${expandedSection === 'tools' ? 'rotate-180' : ''}`} />
          </button>
          
          {expandedSection === 'tools' && (
            <div className="p-4 grid grid-cols-4 gap-3 bg-zinc-900/30">
              <button onClick={() => { onToggleKaraoke(); onClose(); }} className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border aspect-square ${playerState.karaokeMode ? 'bg-zinc-800 border-cyan-500/50 text-cyan-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
                <Mic size={24} />
                <span className="text-[10px] font-medium">{t.karaokeShort}</span>
              </button>
              <button onClick={() => { onShowEQ(); onClose(); }} className="flex flex-col items-center justify-center gap-2 p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-zinc-400 active:bg-zinc-800 aspect-square">
                <Sliders size={24} />
                <span className="text-[10px] font-medium">{t.eqShort}</span>
              </button>
              <button onClick={() => { onShowSleepTimer(); onClose(); }} className="flex flex-col items-center justify-center gap-2 p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-zinc-400 active:bg-zinc-800 aspect-square">
                <Timer size={24} />
                <span className="text-[10px] font-medium">{t.sleepShort}</span>
              </button>
              <button onClick={() => { onShowNetworkStream(); onClose(); }} className="flex flex-col items-center justify-center gap-2 p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-zinc-400 active:bg-zinc-800 aspect-square">
                <Globe size={24} />
                <span className="text-[10px] font-medium">{t.streamShort}</span>
              </button>
            </div>
          )}
        </div>

        {/* View Mode */}
        <div className="border-b border-zinc-800">
          <button 
            onClick={() => setExpandedSection(expandedSection === 'view' ? null : 'view')}
            className="w-full flex items-center justify-between p-4 text-left font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors"
          >
            <span className="flex items-center gap-2"><Layout size={18} /> {t.menuView}</span>
            <ChevronDown size={16} className={`transition-transform duration-200 ${expandedSection === 'view' ? 'rotate-180' : ''}`} />
          </button>
          
          {expandedSection === 'view' && (
            <div className="p-4 space-y-4 bg-zinc-900/30">
              <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
                <button 
                  onClick={() => { setViewMode(ViewMode.LIST); onClose(); }}
                  className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${viewMode === ViewMode.LIST ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}
                >
                  <List size={16} /> {t.listShort}
                </button>
                <button 
                  onClick={() => { setViewMode(ViewMode.VISUALIZER); }}
                  className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${viewMode === ViewMode.VISUALIZER ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}
                >
                  <Activity size={16} /> {t.visualizerShort}
                </button>
              </div>

              {/* Visualizer Options Grid */}
              {viewMode === ViewMode.VISUALIZER && (
                <div className="grid grid-cols-4 gap-2 animate-in fade-in slide-in-from-top-2">
                   {[
                     { mode: VisualizerMode.BARS, icon: BarChart2, label: t.visBars },
                     { mode: VisualizerMode.WAVE, icon: Waves, label: t.visWave },
                     { mode: VisualizerMode.CIRCLE, icon: Activity, label: t.visCircle },
                     { mode: VisualizerMode.SPIRAL, icon: Disc, label: t.visSpiral },
                     { mode: VisualizerMode.PARTICLES, icon: Sparkles, label: t.visStars },
                     { mode: VisualizerMode.SPECTRUM, icon: TrendingUp, label: t.visSpec },
                     { mode: VisualizerMode.RINGS, icon: Radio, label: t.visRings },
                     { mode: VisualizerMode.DNA, icon: Dna, label: t.visDNA },
                   ].map(({ mode, icon: Icon, label }) => (
                     <button
                       key={mode}
                       onClick={() => { setVisualizerMode(mode); onClose(); }}
                       className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border aspect-square transition-all ${visualizerMode === mode ? 'bg-zinc-800 border-cyan-500/50 text-cyan-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                     >
                       <Icon size={20} />
                       <span className="text-[9px] font-medium">{label}</span>
                     </button>
                   ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Language */}
        <div className="border-b border-zinc-800">
          <button 
            onClick={() => setExpandedSection(expandedSection === 'language' ? null : 'language')}
            className="w-full flex items-center justify-between p-4 text-left font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors"
          >
            <span className="flex items-center gap-2"><Languages size={18} /> {t.menuLanguage}</span>
            <ChevronDown size={16} className={`transition-transform duration-200 ${expandedSection === 'language' ? 'rotate-180' : ''}`} />
          </button>
          
          {expandedSection === 'language' && (
            <div className="p-4 grid grid-cols-4 gap-2 bg-zinc-900/30">
              {[
                   { code: 'en', name: 'EN' },
                   { code: 'es', name: 'ES' },
                   { code: 'pt', name: 'PT' },
                   { code: 'fr', name: 'FR' },
                   { code: 'de', name: 'DE' },
                   { code: 'it', name: 'IT' },
                   { code: 'ru', name: 'RU' },
                   { code: 'uk', name: 'UK' },
                   { code: 'ja', name: 'JA' },
                   { code: 'ko', name: 'KO' },
                   { code: 'zh', name: 'ZH' },
                 ].map(lang => (
                <button
                  key={lang.code}
                  onClick={() => { setCurrentLanguage(lang.code as Language); onClose(); }}
                  className={`py-2 rounded-lg text-xs font-bold border ${currentLanguage === lang.code ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}