import React, { useState } from 'react';
import { EQBand } from '../types';
import { X, RotateCcw, Save, Trash2 } from 'lucide-react';
import { getBuiltInPresets, saveEQPreset, loadEQPresets, deleteEQPreset } from '../utils/persistence';

interface EqualizerProps {
  bands: EQBand[];
  onBandChange: (index: number, value: number) => void;
  onReset: () => void;
  onClose: () => void;
  onLoadPreset: (bands: EQBand[]) => void;
}

const Equalizer: React.FC<EqualizerProps> = ({ bands, onBandChange, onReset, onClose, onLoadPreset }) => {
  const [userPresets, setUserPresets] = useState(loadEQPresets());
  const [newPresetName, setNewPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const builtInPresets = getBuiltInPresets();

  // Stop gestures from bubbling up to the main app container
  const stopPropagation = (e: React.SyntheticEvent) => {
      e.stopPropagation();
  };

  const handleSavePreset = () => {
    if (newPresetName.trim()) {
      saveEQPreset(newPresetName.trim(), bands);
      setUserPresets(loadEQPresets());
      setNewPresetName('');
      setShowSaveInput(false);
    }
  };

  const handleDeletePreset = (name: string) => {
    deleteEQPreset(name);
    setUserPresets(loadEQPresets());
  };

  return (
    <div 
        className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onMouseDown={stopPropagation}
        onTouchStart={stopPropagation}
        onMouseUp={stopPropagation}
        onTouchEnd={stopPropagation}
        onClick={stopPropagation}
    >
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-2xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                Equalizer
                <span className="text-xs font-normal text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">10-Band</span>
            </h3>
            <div className="flex items-center gap-2">
                <button
                    onClick={onReset}
                    className="p-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-zinc-800"
                    title="Reset Flat"
                >
                    <RotateCcw size={18} />
                </button>
                <button
                    onClick={onClose}
                    className="p-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-zinc-800"
                >
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* Presets */}
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500">Built-in:</span>
            {Object.entries(builtInPresets).map(([name, presetBands]) => (
              <button
                key={name}
                onClick={() => onLoadPreset(presetBands as EQBand[])}
                className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors"
              >
                {name}
              </button>
            ))}
          </div>

          {Object.keys(userPresets).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-500">Custom:</span>
              {Object.entries(userPresets).map(([name, presetBands]) => (
                <div key={name} className="flex items-center gap-1">
                  <button
                    onClick={() => onLoadPreset(presetBands as EQBand[])}
                    className="text-xs px-2 py-1 bg-cyan-900/30 hover:bg-cyan-800/40 text-cyan-300 rounded-l-md transition-colors"
                  >
                    {name}
                  </button>
                  <button
                    onClick={() => handleDeletePreset(name)}
                    className="text-xs px-1.5 py-1 bg-red-900/30 hover:bg-red-800/40 text-red-300 rounded-r-md transition-colors"
                    title="Delete preset"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            {!showSaveInput ? (
              <button
                onClick={() => setShowSaveInput(true)}
                className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors flex items-center gap-1"
              >
                <Save size={12} />
                Save Current as Preset
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                  placeholder="Preset name..."
                  className="text-xs px-2 py-1 bg-zinc-800 text-white border border-zinc-700 rounded-md focus:outline-none focus:border-cyan-500"
                  autoFocus
                />
                <button
                  onClick={handleSavePreset}
                  className="text-xs px-2 py-1 bg-cyan-700 hover:bg-cyan-600 text-white rounded-md transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => { setShowSaveInput(false); setNewPresetName(''); }}
                  className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-end gap-2 h-64 px-2 overflow-x-auto pb-2">
            {bands.map((band, index) => (
                <div key={band.frequency} className="flex flex-col items-center gap-3 h-full group min-w-[40px]">
                    <div className="relative flex-1 w-2 bg-zinc-800 rounded-full">
                        <input
                            type="range"
                            min="-12"
                            max="12"
                            step="0.5"
                            value={band.gain}
                            onChange={(e) => onBandChange(index, parseFloat(e.target.value))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none"
                            style={{ writingMode: 'vertical-lr', direction: 'rtl' } as any} // Firefox/Standard fallback
                        />
                        {/* Visual Track */}
                        <div 
                            className="absolute bottom-1/2 w-full bg-cyan-500 rounded-b-full transition-all duration-75 group-hover:bg-cyan-400"
                            style={{ 
                                height: `${Math.abs(band.gain) * (50/12)}%`,
                                bottom: band.gain > 0 ? '50%' : `calc(50% - ${Math.abs(band.gain) * (50/12)}%)`,
                                top: band.gain > 0 ? `calc(50% - ${Math.abs(band.gain) * (50/12)}%)` : '50%',
                                borderRadius: band.gain > 0 ? '4px 4px 0 0' : '0 0 4px 4px'
                            }}
                        />
                        {/* Thumb Indicator */}
                        <div 
                            className="absolute w-4 h-4 bg-white rounded-full left-1/2 -translate-x-1/2 shadow-md pointer-events-none transition-all duration-75"
                            style={{ bottom: `calc(50% + ${(band.gain / 12) * 50}% - 8px)` }}
                        />
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 transform -rotate-45 origin-left translate-x-2 mt-2">
                        {band.frequency >= 1000 ? `${band.frequency/1000}K` : band.frequency}
                    </div>
                    <div className="text-[10px] font-bold text-zinc-600">
                        {band.gain > 0 ? '+' : ''}{Math.round(band.gain)}
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Equalizer;