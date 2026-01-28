import React, { useState } from 'react';
import { Globe, Search, Loader2, Play, Plus } from 'lucide-react';
import { useNetworkStream } from '../hooks/useNetworkStream';
import { Track } from '../types';

interface NetworkStreamModalProps {
  onClose: () => void;
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  playTrack: (track: Track) => void;
  addToast: (message: string, type?: 'error' | 'info') => void;
  t: any;
}

export function NetworkStreamModal({ onClose, setTracks, playTrack, addToast, t }: NetworkStreamModalProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'url'>('search');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    networkUrl,
    setNetworkUrl,
    isLoadingStream,
    addNetworkStream,
    searchNetwork,
    searchResults,
    isSearching
  } = useNetworkStream({
    setTracks,
    playTrack,
    addToast,
    onClose
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchNetwork(searchQuery);
  };

  const handleResultClick = (url: string) => {
    setNetworkUrl(`https://youtube.com${url}`);
    // Small timeout to allow state to update before triggering add
    setTimeout(() => addNetworkStream(), 0);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Globe size={20} className="text-cyan-500" />
            {t.openNetworkStream}
          </h3>
          <div className="flex bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('search')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === 'search' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Search
            </button>
            <button
              onClick={() => setActiveTab('url')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === 'url' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Direct URL
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'search' ? (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for songs, artists..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-cyan-500"
                  autoFocus
                />
              </form>

              {isSearching ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-cyan-500" size={32} />
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((result, index) => (
                    <button
                      key={index}
                      onClick={() => handleResultClick(result.url)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800 transition-colors text-left group"
                    >
                      <div className="w-12 h-12 bg-zinc-800 rounded overflow-hidden flex-shrink-0">
                        <img src={result.thumbnail} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-white truncate">{result.title}</h4>
                        <p className="text-xs text-zinc-400 truncate">{result.uploaderName}</p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 p-2 bg-cyan-500/20 text-cyan-400 rounded-full">
                        <Play size={16} fill="currentColor" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500">{t.networkStreamDesc}</p>
              <input 
                type="text"
                value={networkUrl}
                onChange={(e) => setNetworkUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or .mp3 link"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">
                  {t.cancel}
                </button>
                <button onClick={() => addNetworkStream()} disabled={isLoadingStream} className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50">
                  {isLoadingStream ? <Loader2 size={16} className="animate-spin" /> : t.openStream}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}