import React from 'react';
import { X, Compass, ChevronDown, Plus, HardDrive, Users, Settings as SettingsIcon, Disc3, Mic2, Layout as LayoutIcon, Sliders, Mic, Timer, Globe, Layout, List, Activity, Languages } from 'lucide-react';
import { PlayerState, ViewMode, VisualizerMode } from '../types';
import { Language, Translation, languageNames } from '../translations';
import { VISUALIZER_OPTIONS } from './visualizerOptions';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  t: Translation;
  expandedSection: string | null;
  setExpandedSection: (section: string | null) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleKaraoke: () => void;
  playerState: PlayerState;
  onShowEQ: () => void;
  onShowSleepTimer: () => void;
  onShowNetworkStream: () => void;
  onShowStorage: () => void;
  onShowSettings: () => void;
  onShowView: (view: string | null) => void;
  onShowListen: () => void;
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
  onFileUpload,
  onToggleKaraoke,
  playerState,
  onShowEQ,
  onShowSleepTimer,
  onShowNetworkStream,
  onShowStorage,
  onShowSettings,
  onShowView,
  onShowListen,
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
        <h2 className="text-xl font-bold text-white">{t.menu}</h2>
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
              <div className="grid grid-cols-3 gap-2">
                {([[null, LayoutIcon, t.allTracks], ['albums', Disc3, t.albums], ['artists', Mic2, t.artists]] as const).map(([view, Icon, label]) => (
                  <button
                    key={label}
                    onClick={() => { onShowView(view); onClose(); }}
                    className="flex flex-col items-center gap-1 p-3 bg-zinc-900 rounded-xl border border-zinc-800 active:bg-zinc-800 text-zinc-300"
                  >
                    <Icon size={20} className="text-cyan-400" />
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
              <label className="w-full flex items-center gap-3 p-4 bg-zinc-900 rounded-xl active:bg-zinc-800 border border-zinc-800 cursor-pointer">
                <Plus size={24} className="text-cyan-400" />
                <span className="font-medium text-white">{t.addFiles}</span>
                <input
                  type="file"
                  accept="audio/*,image/*,.flac,.ogg,.m4a,.aac,.lrc"
                  multiple
                  onChange={(e) => { onFileUpload(e); onClose(); }}
                  className="hidden"
                />
              </label>
              <button onClick={() => { onShowListen(); onClose(); }} className="w-full flex items-center gap-3 p-4 bg-zinc-900 rounded-xl active:bg-zinc-800 border border-zinc-800">
                <Users size={24} className="text-cyan-400" />
                <span className="font-medium text-white">{t.listenTogether}</span>
              </button>
              <button onClick={() => { onShowStorage(); onClose(); }} className="w-full flex items-center gap-3 p-4 bg-zinc-900 rounded-xl active:bg-zinc-800 border border-zinc-800">
                <HardDrive size={24} className="text-cyan-400" />
                <span className="font-medium text-white">{t.storageTitle}</span>
              </button>
              <button onClick={() => { onShowSettings(); onClose(); }} className="w-full flex items-center gap-3 p-4 bg-zinc-900 rounded-xl active:bg-zinc-800 border border-zinc-800">
                <SettingsIcon size={24} className="text-cyan-400" />
                <span className="font-medium text-white">{t.settings}</span>
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
                   {VISUALIZER_OPTIONS.map(({ mode, icon: Icon, labelKey }) => (
                     <button
                       key={mode}
                       onClick={() => { setVisualizerMode(mode); onClose(); }}
                       className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border aspect-square transition-all ${visualizerMode === mode ? 'bg-zinc-800 border-cyan-500/50 text-cyan-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                     >
                       <Icon size={20} />
                       <span className="text-[9px] font-medium">{t[labelKey]}</span>
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
              {(Object.keys(languageNames) as Language[]).map(code => (
                <button
                  key={code}
                  onClick={() => { setCurrentLanguage(code); onClose(); }}
                  title={languageNames[code]}
                  className={`py-2 rounded-lg text-xs font-bold border uppercase ${currentLanguage === code ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                >
                  {code}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}