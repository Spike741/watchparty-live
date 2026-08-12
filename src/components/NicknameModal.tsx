import React, { useState } from 'react';

interface NicknameModalProps {
  onJoin: (nickname: string, color: string) => void;
}

// Premium color options for user nicknames in chat
const PRESET_COLORS = [
  '#ec4899', // pink-500
  '#a855f7', // purple-500
  '#6366f1', // indigo-500
  '#3b82f6', // blue-500
  '#0ea5e9', // sky-500
  '#10b981', // emerald-500
  '#eab308', // yellow-500
  '#f97316', // orange-500
];

export const NicknameModal: React.FC<NicknameModalProps> = ({ onJoin }) => {
  const [nickname, setNickname] = useState('');
  const [selectedColor, setSelectedColor] = useState(
    PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
  );
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nickname.trim();
    if (!cleanName) {
      setError('Please enter a nickname.');
      return;
    }
    if (cleanName.length > 20) {
      setError('Nickname must be under 20 characters.');
      return;
    }
    setError('');
    
    // Save to localStorage
    localStorage.setItem('watchparty_nickname', cleanName);
    localStorage.setItem('watchparty_color', selectedColor);
    
    onJoin(cleanName, selectedColor);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 dark:bg-black/60 backdrop-blur-md p-4 font-sans">
      <div className="w-full max-w-md bg-[var(--bg-modal)] border border-[var(--border-modal)] rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[95vh] overflow-y-auto custom-scrollbar">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-tr from-violet-500 to-indigo-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-3 shadow-md">
            🎬
          </div>
          <h2 className="text-xl font-bold text-[var(--text-main)] text-center">Watch Party</h2>
          <p className="text-[var(--text-muted)] text-xs mt-1 text-center">
            Pick a temporary nickname to join the live watch chat.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Your Nickname
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. MovieLover123"
              className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:outline-none transition"
              maxLength={20}
              autoFocus
            />
            {error && <p className="text-red-500 text-xs mt-1.5 font-medium">{error}</p>}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
              Choose Nickname Color
            </label>
            <div className="grid grid-cols-4 gap-3.5">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`aspect-square rounded-full transition transform active:scale-90 ${
                    selectedColor === color
                      ? 'ring-4 ring-indigo-500 dark:ring-violet-400 scale-105 shadow-md'
                      : 'hover:scale-105 border border-black/10 dark:border-white/10'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md hover:shadow-indigo-500/10 active:scale-[0.98] transition duration-200 mt-2 cursor-pointer"
          >
            Join Watch Party
          </button>
        </form>
      </div>
    </div>
  );
};
