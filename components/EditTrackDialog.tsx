import React, { useRef, useState } from 'react';
import { Pencil, FileText } from 'lucide-react';
import type { Track } from '../types';
import type { Translation } from '../translations';
import { Modal, primaryButton, secondaryButton } from './Modal';

export type TrackEdits = Pick<Track, 'name' | 'artist' | 'album' | 'trackNumber' | 'discNumber' | 'year' | 'genre' | 'lyrics'>;

interface EditTrackDialogProps {
  t: Translation;
  track: Track;
  onSave: (edits: TrackEdits) => void;
  onClose: () => void;
}

const inputClass = 'w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500';

/** Edit how a track appears in Penko Tune. The audio file itself is never modified. */
export const EditTrackDialog: React.FC<EditTrackDialogProps> = ({ t, track, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: track.name,
    artist: track.artist ?? '',
    album: track.album ?? '',
    trackNumber: track.trackNumber?.toString() ?? '',
    discNumber: track.discNumber?.toString() ?? '',
    year: track.year?.toString() ?? '',
    genre: track.genre ?? '',
    lyrics: track.lyrics ?? '',
  });
  const lrcRef = useRef<HTMLInputElement>(null);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));
  const num = (value: string) => (value.trim() && !isNaN(Number(value)) ? Number(value) : undefined);
  const text = (value: string) => value.trim() || undefined;

  const save = () => {
    onSave({
      name: form.name.trim() || track.name,
      artist: text(form.artist),
      album: text(form.album),
      trackNumber: num(form.trackNumber),
      discNumber: num(form.discNumber),
      year: num(form.year),
      genre: text(form.genre),
      lyrics: text(form.lyrics),
    });
    onClose();
  };

  const field = (key: keyof typeof form, label: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="block space-y-1">
      <span className="text-xs text-zinc-500">{label}</span>
      <input value={form[key]} onChange={set(key)} className={inputClass} {...extra} />
    </label>
  );

  return (
    <Modal
      title={t.editInfo}
      icon={<Pencil size={18} className="text-cyan-500" />}
      onClose={onClose}
      closeLabel={t.close}
      wide
      footer={
        <>
          <button onClick={onClose} className={secondaryButton}>{t.cancel}</button>
          <button onClick={save} className={primaryButton} data-save-edits>{t.save}</button>
        </>
      }
    >
      <p className="text-xs text-zinc-500">{t.editInfoNote}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field('name', t.colTitle, { autoFocus: true })}
        {field('artist', t.fieldArtist)}
        {field('album', t.colAlbum)}
        {field('genre', t.fieldGenre)}
        <div className="grid grid-cols-3 gap-2">
          {field('trackNumber', t.fieldTrack, { inputMode: 'numeric' })}
          {field('discNumber', t.fieldDisc, { inputMode: 'numeric' })}
          {field('year', t.fieldYear, { inputMode: 'numeric' })}
        </div>
      </div>
      <label className="block space-y-1">
        <span className="flex items-center justify-between text-xs text-zinc-500">
          {t.lyrics}
          <button type="button" onClick={() => lrcRef.current?.click()} className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300">
            <FileText size={12} /> {t.loadLrc}
          </button>
        </span>
        <textarea
          value={form.lyrics}
          onChange={set('lyrics')}
          rows={8}
          placeholder={t.lyricsPlaceholder}
          className={`${inputClass} font-mono text-xs`}
        />
        <input
          ref={lrcRef}
          type="file"
          accept=".lrc,.txt,text/plain"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) {
              const lyrics = await file.text();
              setForm(prev => ({ ...prev, lyrics }));
            }
          }}
        />
      </label>
    </Modal>
  );
};
