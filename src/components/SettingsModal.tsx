import React, { useState } from 'react';
import { X, Globe, Radio, Server, Monitor, Sun, Moon } from 'lucide-react';

interface SettingsModalProps {
  currentUrl: string;
  defaultUrl: string;
  onSave: (url: string) => void;
  onClose: () => void;
  currentNickname: string;
  onChangeNickname: () => void;
  theme: 'system' | 'light' | 'dark';
  onThemeChange: (theme: 'system' | 'light' | 'dark') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUrl,
  defaultUrl,
  onSave,
  onClose,
  currentNickname,
  onChangeNickname,
  theme,
  onThemeChange
}) => {
  const [backendUrl, setBackendUrl] = useState(currentUrl);
  const [error, setError] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = backendUrl.trim().replace(/\/$/, ''); // Remove trailing slash
    
    if (!cleanUrl) {
      setError('Backend URL cannot be empty.');
      return;
    }

    try {
      const urlObj = new URL(cleanUrl);
      if (urlObj.protocol !== 'http:') {
        setError('Warning: Using HTTP is highly recommended for compatibility (e.g. http://ip:5000)');
      }
    } catch {
      setError('Please enter a valid URL (e.g. http://localhost:5000)');
      return;
    }

    setError('');
    localStorage.setItem('watchparty_backend_url', cleanUrl);
    onSave(cleanUrl);
    onClose();
  };

  const handleReset = () => {
    setBackendUrl(defaultUrl);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 dark:bg-black/60 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-[var(--bg-modal)] border border-[var(--border-modal)] rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-glass)] mb-5">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-500 dark:text-violet-400" />
            <h3 className="text-base font-bold text-[var(--text-main)]">Party Settings</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Current Member Profile
            </label>
            <div className="flex items-center justify-between bg-black/5 dark:bg-black/30 border border-[var(--border-glass)] rounded-xl px-4 py-3">
              <span className="text-[var(--text-main)] font-semibold text-sm">{currentNickname}</span>
              <button
                type="button"
                onClick={onChangeNickname}
                className="text-xs text-indigo-600 dark:text-violet-400 hover:text-indigo-700 dark:hover:text-violet-300 font-semibold cursor-pointer"
              >
                Change Nickname
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Appearance Theme
            </label>
            <div className="grid grid-cols-3 gap-2 bg-black/5 dark:bg-black/30 border border-[var(--border-glass)] rounded-xl p-1 font-sans">
              {(['system', 'light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onThemeChange(t)}
                  className={`text-[10px] font-extrabold py-2.5 rounded-lg transition capitalize cursor-pointer flex items-center justify-center gap-1.5 ${
                    theme === t
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-650 text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {t === 'system' && <Monitor className="w-3 h-3" />}
                  {t === 'light' && <Sun className="w-3 h-3" />}
                  {t === 'dark' && <Moon className="w-3 h-3" />}
                  <span>{t}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Chat Backend API URL
            </label>
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => {
                setBackendUrl(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. http://localhost:5000"
              className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:outline-none transition"
            />
            {error && <p className="text-red-500 text-xs mt-1.5 font-medium">{error}</p>}
            <p className="text-[var(--text-muted)] text-[10px] mt-2 leading-relaxed">
              * The backend handles live chat syncing. If you run the backend on a local PC and connect from a mobile phone, change this to your PC's LAN IP address (e.g. <code className="bg-black/5 dark:bg-black/20 px-1 py-0.5 rounded font-mono text-[var(--text-main)]">http://192.168.1.50:5000</code>).
            </p>
          </div>

          {/* Network details */}
          <div className="bg-black/5 dark:bg-black/30 rounded-xl p-3 border border-[var(--border-glass)] space-y-2 text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-emerald-500" />
              <span>HLS Stream: <code className="text-[var(--text-main)] font-semibold">live/party</code> (Port 8888)</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-sky-500" />
              <span>MediaMTX Stats: Port 9997</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 bg-slate-200 dark:bg-slate-800 text-[var(--text-main)] hover:bg-slate-300 dark:hover:bg-slate-700 font-semibold text-xs py-3 px-4 rounded-xl transition cursor-pointer"
            >
              Reset
            </button>
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold text-xs py-3 px-4 rounded-xl shadow-md cursor-pointer active:scale-[0.98] transition"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
