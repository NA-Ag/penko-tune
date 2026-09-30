import React, { useEffect, useState } from 'react';
import { BarChart2, Sliders, Globe, ChevronDown, Check, Mic, Timer, Download, Languages, BookOpen, Menu, List, Users, Settings } from 'lucide-react';
import { ViewMode, VisualizerMode } from '../types';
import { languageNames, Language, Translation } from '../translations';
import { VISUALIZER_OPTIONS } from './visualizerOptions';
import { PenkoTuneLogo } from './penko/PenkoTuneLogo';

interface AppHeaderProps {
  t: Translation;
  canInstall: boolean;
  onInstall: () => void;
  karaokeMode: boolean;
  onToggleKaraoke: () => void;
  eqOpen: boolean;
  onToggleEQ: () => void;
  sleepTimerActive: boolean;
  sleepTimerOpen: boolean;
  onToggleSleepTimer: () => void;
  listening: boolean;
  onShowListen: () => void;
  networkStreamOpen: boolean;
  onToggleNetworkStream: () => void;
  onShowSettings: () => void;
  onOpenMobileMenu: () => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  visualizerMode: VisualizerMode;
  onVisualizerModeChange: (mode: VisualizerMode) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  t, canInstall, onInstall, karaokeMode, onToggleKaraoke, eqOpen, onToggleEQ,
  sleepTimerActive, sleepTimerOpen, onToggleSleepTimer, listening, onShowListen,
  networkStreamOpen, onToggleNetworkStream, onShowSettings, onOpenMobileMenu,
  language, onLanguageChange, viewMode, onViewModeChange, visualizerMode, onVisualizerModeChange,
}) => {
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showVisMenu, setShowVisMenu] = useState(false);
  const CurrentVisIcon = VISUALIZER_OPTIONS.find(o => o.mode === visualizerMode)?.icon ?? BarChart2;

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showLanguageMenu && !showVisMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.language-menu-container')) setShowLanguageMenu(false);
      if (!target.closest('#vis-menu-container')) setShowVisMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLanguageMenu, showVisMenu]);

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950 shrink-0 relative z-20">
      <div className="flex items-center gap-2">
        <PenkoTuneLogo size={40} animated />
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent hidden sm:block">Penko Tune</h1>
      </div>

      <button className="md:hidden p-2 text-zinc-400 hover:text-white" onClick={onOpenMobileMenu}>
        <Menu size={24} />
      </button>

      {/* Desktop Controls */}
      <div className="hidden md:flex items-center gap-4">
        {canInstall && (
          <button
            onClick={onInstall}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-cyan-500/20"
            title={t.installPWA}
          >
            <Download size={16} />
            <span className="hidden sm:inline">{t.installPWA}</span>
          </button>
        )}

        {/* Tools */}
        <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          <button
            onClick={onToggleKaraoke}
            className={`p-2 rounded-md transition-all ${karaokeMode ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            title={t.vocalReduction}
          >
            <Mic size={18} />
          </button>
          <button
            onClick={onToggleEQ}
            className={`p-2 rounded-md transition-all ${eqOpen ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            title={t.equalizer}
          >
            <Sliders size={18} />
          </button>
          <button
            onClick={onToggleSleepTimer}
            className={`p-2 rounded-md transition-all relative ${sleepTimerActive || sleepTimerOpen ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            title={t.sleepTimer}
          >
            <Timer size={18} />
            {sleepTimerActive && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full animate-pulse" />
            )}
          </button>
          <button
            onClick={onShowListen}
            className={`p-2 rounded-md transition-all relative ${listening ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            title={t.listenTogether}
          >
            <Users size={18} />
            {listening && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full animate-pulse" />
            )}
          </button>
          <button
            onClick={onToggleNetworkStream}
            className={`p-2 rounded-md transition-all ${networkStreamOpen ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            title={t.networkStream}
          >
            <Globe size={18} />
          </button>
          <button
            onClick={onShowSettings}
            className="p-2 rounded-md transition-all text-zinc-500 hover:text-zinc-300"
            title={t.settings}
          >
            <Settings size={18} />
          </button>
          <a
            href="https://github.com/NA-Ag/penko-tune#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-md transition-all text-zinc-500 hover:text-zinc-300"
            title={t.userManual}
          >
            <BookOpen size={18} />
          </a>

          {/* Language Switcher */}
          <div className="relative language-menu-container">
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className={`p-2 rounded-md transition-all flex items-center gap-1 ${showLanguageMenu ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              title={t.changeLanguage}
            >
              <Languages size={18} />
              <span className="text-xs font-mono uppercase">{language}</span>
            </button>
            {showLanguageMenu && (
              <div className="absolute top-full right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-2 z-50 min-w-[160px]">
                {(Object.keys(languageNames) as Language[]).map(code => (
                  <button
                    key={code}
                    onClick={() => {
                      onLanguageChange(code);
                      setShowLanguageMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md transition-all flex items-center justify-between ${
                      language === code ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    <span>{languageNames[code]}</span>
                    {language === code && <Check size={16} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* View Toggles */}
        <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800 ml-2 relative">
          <button
            onClick={() => onViewModeChange(ViewMode.LIST)}
            className={`p-2 rounded-md transition-all ${viewMode === ViewMode.LIST ? 'bg-zinc-800 text-cyan-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            title={t.listView}
          >
            <List size={18} />
          </button>

          <div className="flex items-center border-l border-zinc-800 ml-1 pl-1 gap-1 relative" id="vis-menu-container">
            <button
              onClick={() => {
                onViewModeChange(ViewMode.VISUALIZER);
                setShowVisMenu(!showVisMenu);
              }}
              className={`p-2 rounded-md transition-all flex gap-1 items-center ${viewMode === ViewMode.VISUALIZER ? 'bg-zinc-800 text-cyan-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              title={t.visualizerMode}
            >
              <CurrentVisIcon size={18} />
              <ChevronDown size={14} className={`ml-1 transition-transform ${showVisMenu ? 'rotate-180' : ''}`} />
            </button>

            {showVisMenu && (
              <div className="absolute top-full right-0 mt-2 w-44 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col p-1 animate-in fade-in slide-in-from-top-2 duration-200">
                {VISUALIZER_OPTIONS.map(({ mode, icon: Icon, labelKey }) => (
                  <button
                    key={mode}
                    onClick={() => {
                      onVisualizerModeChange(mode);
                      onViewModeChange(ViewMode.VISUALIZER);
                      setShowVisMenu(false);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${visualizerMode === mode ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                  >
                    <span className="flex items-center gap-2"><Icon size={16} /> {t[labelKey]}</span>
                    {visualizerMode === mode && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
