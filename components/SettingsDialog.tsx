import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import type { Translation } from '../translations';
import type { AudioSettings } from '../hooks/useAudioPlayer';
import { loadPreferences, savePreferences } from '../utils/preferences';
import { DEFAULT_TRACKERS, parseIceServers } from '../utils/network';
import { format } from '../utils/i18n';
import { Modal, primaryButton, secondaryButton } from './Modal';

interface SettingsDialogProps {
  t: Translation;
  audio: AudioSettings;
  onAudioChange: (patch: Partial<AudioSettings>) => void;
  onClose: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3">
    <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</h4>
    {children}
  </section>
);

const textareaClass = 'w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500';

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ t, audio, onAudioChange, onClose }) => {
  const prefs = loadPreferences();
  const [trackers, setTrackers] = useState(prefs.customTrackers.join('\n'));
  const [onlyCustom, setOnlyCustom] = useState(prefs.onlyCustomTrackers);
  const [iceServers, setIceServers] = useState(prefs.customIceServers);
  const networkChanged =
    trackers !== prefs.customTrackers.join('\n') || onlyCustom !== prefs.onlyCustomTrackers || iceServers !== prefs.customIceServers;

  const saveNetwork = () => {
    savePreferences({
      customTrackers: trackers.split(/\r?\n/).map(s => s.trim()).filter(Boolean),
      onlyCustomTrackers: onlyCustom,
      customIceServers: iceServers,
    });
    // The WebTorrent client and rooms read these when they start
    window.location.reload();
  };

  const invalidIce = iceServers.trim() && !parseIceServers(iceServers);

  return (
    <Modal title={t.settings} icon={<Settings size={20} className="text-cyan-500" />} onClose={onClose} closeLabel={t.close} wide>
      <Section title={t.settingsPlayback}>
        <label className="block space-y-2">
          <span className="flex justify-between text-sm text-zinc-300">
            {t.crossfade}
            <span className="text-cyan-400 font-mono" data-crossfade-value>
              {audio.crossfade === 0 ? t.crossfadeOff : format(t.secondsShort, { seconds: audio.crossfade })}
            </span>
          </span>
          <input
            type="range" min={0} max={12} step={1}
            value={audio.crossfade}
            onChange={e => onAudioChange({ crossfade: Number(e.target.value) })}
            className="w-full accent-cyan-500"
            data-crossfade
          />
          <span className="block text-xs text-zinc-500">{t.crossfadeDesc}</span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={audio.normalize}
            onChange={e => onAudioChange({ normalize: e.target.checked })}
            className="mt-1 accent-cyan-500"
            data-normalize
          />
          <span>
            <span className="block text-sm text-zinc-300">{t.normalize}</span>
            <span className="block text-xs text-zinc-500">{t.normalizeDesc}</span>
          </span>
        </label>
      </Section>

      <Section title={t.settingsNetwork}>
        <p className="text-xs text-zinc-400">{t.networkDesc}</p>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-500">{t.customTrackers}</span>
          <textarea value={trackers} onChange={e => setTrackers(e.target.value)} rows={3} placeholder="wss://tracker.example.org" className={textareaClass} />
          <span className="block text-[11px] text-zinc-600">{format(t.defaultTrackersNote, { trackers: DEFAULT_TRACKERS.join(', ') })}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
          <input type="checkbox" checked={onlyCustom} onChange={e => setOnlyCustom(e.target.checked)} className="accent-cyan-500" />
          {t.onlyCustomTrackers}
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-500">{t.customIceServers}</span>
          <textarea
            value={iceServers}
            onChange={e => setIceServers(e.target.value)}
            rows={3}
            placeholder={'stun:stun.example.org:3478\nturn:turn.example.org:3478 username password'}
            className={textareaClass}
          />
          <span className={`block text-[11px] ${invalidIce ? 'text-amber-400' : 'text-zinc-600'}`}>
            {invalidIce ? t.iceInvalid : t.iceServersNote}
          </span>
        </label>
        {networkChanged && (
          <div className="flex gap-2">
            <button onClick={saveNetwork} className={primaryButton}>{t.saveAndReload}</button>
            <button
              onClick={() => { setTrackers(prefs.customTrackers.join('\n')); setOnlyCustom(prefs.onlyCustomTrackers); setIceServers(prefs.customIceServers); }}
              className={secondaryButton}
            >
              {t.cancel}
            </button>
          </div>
        )}
      </Section>
    </Modal>
  );
};
