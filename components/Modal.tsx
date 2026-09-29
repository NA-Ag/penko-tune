import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  closeLabel: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}

/** Shared dialog shell: backdrop, header with close button, Escape to close. */
export const Modal: React.FC<ModalProps> = ({ title, icon, onClose, closeLabel, children, footer, wide }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`}
      >
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
          {icon}
          <h3 className="text-lg font-bold text-white flex-1">{title}</h3>
          <button onClick={onClose} className="p-2 -mr-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800" title={closeLabel}>
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};

export const primaryButton = 'px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors';
export const secondaryButton = 'px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors';
