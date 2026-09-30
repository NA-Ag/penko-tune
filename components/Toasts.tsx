import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { Toast } from '../hooks/useToasts';

/** Stacked notifications above the player bar. */
export const Toasts: React.FC<{ toasts: Toast[] }> = ({ toasts }) => (
  <div data-toasts role="status" aria-live="polite" className="fixed bottom-44 md:bottom-28 right-4 md:right-6 left-4 md:left-auto z-[110] flex flex-col items-end gap-2 pointer-events-none">
    {toasts.map(toast => (
      <div key={toast.id} className={`bg-zinc-900 border ${toast.type === 'error' ? 'border-red-500/50 text-red-100' : 'border-zinc-700 text-zinc-100'} px-4 py-3 rounded-lg shadow-xl animate-in slide-in-from-bottom-4 fade-in duration-300 flex items-center gap-2 max-w-sm`}>
        <AlertCircle size={16} className={toast.type === 'error' ? 'text-red-500' : 'text-cyan-500'} />
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    ))}
  </div>
);
