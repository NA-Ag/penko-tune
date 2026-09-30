import React from 'react';
import { Timer, X } from 'lucide-react';
import type { Translation } from '../translations';
import { formatTime } from '../utils/formatters';
import { format } from '../utils/i18n';
import { Modal } from './Modal';

const OPTIONS = [15, 30, 45, 60, 90, 120];

interface SleepTimerDialogProps {
  t: Translation;
  active: boolean;
  remainingMs: number;
  onStart: (minutes: number) => void;
  onCancel: () => void;
  onClose: () => void;
}

export const SleepTimerDialog: React.FC<SleepTimerDialogProps> = ({ t, active, remainingMs, onStart, onCancel, onClose }) => (
  <Modal title={t.sleepTimer} icon={<Timer size={20} className="text-cyan-500" />} onClose={onClose} closeLabel={t.close}>
    {active ? (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-zinc-400 mb-2">{t.timerActive}</p>
          <p className="text-4xl font-bold text-cyan-400 font-mono">{formatTime(Math.ceil(remainingMs / 1000))}</p>
          <p className="text-xs text-zinc-600 mt-2">{t.timerEndsPause}</p>
        </div>
        <button
          onClick={onCancel}
          className="w-full px-4 py-3 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <X size={16} />
          {t.cancelTimer}
        </button>
      </div>
    ) : (
      <>
        <p className="text-xs text-zinc-500">{t.sleepTimerDesc}</p>
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map(minutes => (
            <button
              key={minutes}
              onClick={() => onStart(minutes)}
              className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors text-sm"
            >
              {format(t.minutesShort, { minutes })}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full px-4 py-2 text-sm text-zinc-400 hover:text-white">
          {t.close}
        </button>
      </>
    )}
  </Modal>
);
