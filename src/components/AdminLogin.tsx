import React, { useState } from 'react';
import { Shield, AlertCircle, Lock } from 'lucide-react';
import { InteractiveBackground } from './InteractiveBackground';

interface AdminLoginProps {
  onLogin: (token: string) => void;
  backendUrl: string;
}

export function AdminLogin({ onLogin, backendUrl }: AdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (response.ok && data.success && data.token) {
        setError(null);
        onLogin(data.token);
      } else {
        setError(data.error || 'Invalid credentials. Please try again.');
      }
    } catch {
      setError('Cannot connect to authentication server. Check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ height: 'var(--visual-height, 100dvh)' }}>
      <InteractiveBackground isDark={true} />

      <div className="relative z-10 w-full max-w-sm">
        {/* Glow accent */}
        <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-violet-600/20 via-transparent to-indigo-600/20 blur-xl pointer-events-none" />

        <div className="relative bg-white/[0.04] border border-white/[0.08] backdrop-blur-2xl rounded-3xl p-8 shadow-2xl overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

          {/* Icon + Title */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mb-4 shadow-xl shadow-violet-600/30">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Admin Portal</h1>
            <p className="text-xs text-gray-500 mt-1 text-center">Watch Party Console · Super Admin Access</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl flex items-start gap-2.5 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 transition"
                placeholder="Enter username"
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 transition"
                placeholder="Enter password"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-xl transition duration-200 shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {loading ? 'Authenticating…' : 'Authenticate Admin'}
            </button>
          </form>

          {/* Bottom decoration */}
          <p className="text-center text-[10px] text-gray-700 mt-6">Authorized personnel only</p>
        </div>
      </div>
    </div>
  );
}
