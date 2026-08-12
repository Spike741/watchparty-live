import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Copy, Plus, Activity, Sparkles, LogOut, Check, Eye, Users, X, Wifi, WifiOff } from 'lucide-react';
import { getFlagUrl, formatDate, getEventIcon } from './LobbyView';

interface MatchEvent {
  id: string;
  type: 'goal' | 'yellow_card' | 'red_card' | 'penalty';
  team: 'home' | 'away';
  player: string;
  minute: number;
}

interface FifaMatch {
  id: string;
  teamA: string;
  flagA: string;
  teamB: string;
  flagB: string;
  time: string;
  stadium: string;
  status: 'upcoming' | 'live_score' | 'streaming' | 'finished';
  scoreA: number;
  scoreB: number;
  elapsedMinute: number;
  events: MatchEvent[];
}

interface CustomStream {
  id: string;
  title: string;
  hlsUrl: string;
  active: boolean;
}

interface AdminDashboardProps {
  defaultHlsUrl: string;
  matches: FifaMatch[];
  activeFifaMatchId: string | null;
  customStreams: CustomStream[];
  onStartFifaStream: (matchId: string, streamUrl: string) => void;
  onEndFifaStream: () => void;
  onStartCustomStream: (title: string, hlsUrl: string) => void;
  onEndCustomStream: (streamId: string) => void;
  onAddMatchEvent: (matchId: string, type: string, team: string, player: string, minute: number) => void;
  onDeleteMatchEvent: (matchId: string, eventId: string) => void;
  onWatchStream: (url: string) => void;
  onLogout: () => void;
  onSendBroadcastAlert?: (text: string) => void;
  liveViewerCount?: number;
  liveUsers?: { user: string; color: string }[];
}

export function AdminDashboard({
  defaultHlsUrl,
  matches,
  activeFifaMatchId,
  customStreams,
  onStartFifaStream,
  onEndFifaStream,
  onStartCustomStream,
  onEndCustomStream,
  onAddMatchEvent,
  onDeleteMatchEvent,
  onWatchStream,
  onLogout,
  onSendBroadcastAlert,
  liveViewerCount = 0,
  liveUsers = []
}: AdminDashboardProps) {
  const [streamUrl, setStreamUrl] = useState(defaultHlsUrl);
  const [customTitle, setCustomTitle] = useState('');
  const [customUrl, setCustomUrl] = useState(defaultHlsUrl);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [alertText, setAlertText] = useState('');
  const [alertSuccess, setAlertSuccess] = useState(false);
  const [showViewersList, setShowViewersList] = useState(false);
  const viewersBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showViewersList) return;
    const handler = (e: MouseEvent) => {
      if (viewersBtnRef.current && !viewersBtnRef.current.closest('.viewers-popover-container')?.contains(e.target as Node)) {
        setShowViewersList(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showViewersList]);

  const [logType, setLogType] = useState<'goal' | 'penalty' | 'yellow_card' | 'red_card'>('goal');
  const [logTeam, setLogTeam] = useState<'home' | 'away'>('home');
  const [logPlayer, setLogPlayer] = useState('');
  const [logMinute, setLogMinute] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active_upcoming'>('active_upcoming');

  const filteredMatches = matches.filter(m => {
    if (filterType === 'active_upcoming') {
      return m.status === 'streaming' || m.status === 'live_score' || m.status === 'upcoming';
    }
    return true;
  });

  const activeFifaMatch = matches.find(m => m.id === activeFifaMatchId);

  const getInviteLink = (streamId: string) =>
    `${window.location.protocol}//${window.location.host}/?streamId=${streamId}`;

  const handleCopyLink = (streamId: string) => {
    const link = getInviteLink(streamId);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link)
        .then(() => { setCopiedId(streamId); setTimeout(() => setCopiedId(null), 2000); })
        .catch(() => fallbackCopy(link, streamId));
    } else {
      fallbackCopy(link, streamId);
    }
  };

  const fallbackCopy = (text: string, streamId: string) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      if (document.execCommand('copy')) { setCopiedId(streamId); setTimeout(() => setCopiedId(null), 2000); }
      document.body.removeChild(ta);
    } catch (_) { /* silent */ }
  };

  const handleCustomHost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;
    onStartCustomStream(customTitle.trim(), customUrl.trim());
    setCustomTitle('');
  };

  // Shared input style
  const inputCls = "w-full bg-white/5 border border-white/10 focus:border-violet-500/50 focus:outline-none rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 transition";
  const selectCls = "w-full bg-white/5 border border-white/10 focus:border-violet-500/50 focus:outline-none rounded-xl px-3 py-2 text-xs text-white transition";

  return (
    <div
      className="h-screen bg-[#080810] text-white flex flex-col overflow-hidden font-['Roboto','Inter',sans-serif]"
      style={{ height: 'var(--visual-height, 100vh)' }}
    >
      {/* ── Navbar ── */}
      <header className="h-14 bg-white/[0.03] border-b border-white/[0.06] backdrop-blur-sm flex items-center justify-between px-6 flex-shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-600/20">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-bold text-sm tracking-tight text-white">Watch Party Console</h1>
          <span className="text-[9px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
            Super Admin
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Live viewers */}
          <div className="relative viewers-popover-container">
            <button
              ref={viewersBtnRef}
              onClick={() => setShowViewersList(v => !v)}
              className="flex items-center gap-1.5 bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 text-gray-300 hover:text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-xl transition duration-200"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{liveViewerCount}</span>
              <span className="text-[9px] text-emerald-500 font-bold uppercase">Live</span>
            </button>

            {showViewersList && (
              <div className="absolute right-0 top-11 w-64 bg-[#111118] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-emerald-500" />
                    <p className="text-xs font-bold text-white uppercase tracking-wider">Live Viewers</p>
                  </div>
                  <button onClick={() => setShowViewersList(false)} className="text-gray-500 hover:text-white transition">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {liveUsers.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 text-xs">No viewers registered yet</div>
                ) : (
                  <ul className="max-h-64 overflow-y-auto divide-y divide-white/[0.04]">
                    {liveUsers.map((u, i) => (
                      <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: u.color + '22', color: u.color, border: `1.5px solid ${u.color}44` }}
                        >
                          {u.user.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-200 font-medium truncate">{u.user}</span>
                        <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />
                      </li>
                    ))}
                  </ul>
                )}
                <div className="px-4 py-2 border-t border-white/[0.06] text-[10px] text-gray-600 text-right">
                  {liveUsers.length} user{liveUsers.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => onWatchStream(streamUrl || defaultHlsUrl)}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-violet-500/10 border border-white/10 hover:border-violet-500/30 text-gray-300 hover:text-violet-400 text-xs font-semibold px-3 py-1.5 rounded-xl transition duration-200"
          >
            <Eye className="w-3.5 h-3.5" />
            Watch Stream
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-gray-300 hover:text-red-400 text-xs font-semibold px-3 py-1.5 rounded-xl transition duration-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            Exit Console
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-grow overflow-y-auto p-6 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent]">

        {/* LEFT: FIFA CONTROLS */}
        <div className="lg:col-span-2 flex flex-col space-y-5">

          {/* Current Broadcast Card */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xs uppercase tracking-widest text-gray-400">Current Stream Broadcast</h2>
              {activeFifaMatchId ? (
                <span className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                  Streaming Live
                </span>
              ) : (
                <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-gray-500 text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  <WifiOff className="w-3 h-3" />
                  Inactive
                </span>
              )}
            </div>

            {activeFifaMatch ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Active match info */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">FIFA Match #{activeFifaMatch.id}</p>
                    <h3 className="font-bold text-sm flex items-center gap-2 flex-wrap">
                      {getFlagUrl(activeFifaMatch.teamA)
                        ? <img src={getFlagUrl(activeFifaMatch.teamA) || ''} alt="" className="w-6 h-4 object-cover rounded shadow" />
                        : '⚽'}
                      <span>{activeFifaMatch.teamA}</span>
                      <span className="text-violet-400 font-bold px-1">{activeFifaMatch.scoreA} – {activeFifaMatch.scoreB}</span>
                      {getFlagUrl(activeFifaMatch.teamB)
                        ? <img src={getFlagUrl(activeFifaMatch.teamB) || ''} alt="" className="w-6 h-4 object-cover rounded shadow" />
                        : '⚽'}
                      <span>{activeFifaMatch.teamB}</span>
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Clock: <span className="text-red-400 font-bold">{activeFifaMatch.elapsedMinute}'</span> · {activeFifaMatch.stadium}
                    </p>
                  </div>
                  <button
                    onClick={onEndFifaStream}
                    className="flex-shrink-0 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-red-600/20"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    Stop Stream
                  </button>
                </div>

                {/* Event Logger */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                    Log Live Match Event
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">Event Type</label>
                      <select value={logType} onChange={e => setLogType(e.target.value as any)} className={selectCls}>
                        <option value="goal">⚽ Goal</option>
                        <option value="penalty">⚽ (P) Penalty</option>
                        <option value="yellow_card">🟨 Yellow Card</option>
                        <option value="red_card">🟥 Red Card</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">Team</label>
                      <select value={logTeam} onChange={e => setLogTeam(e.target.value as any)} className={selectCls}>
                        <option value="home">{activeFifaMatch.teamA} (Home)</option>
                        <option value="away">{activeFifaMatch.teamB} (Away)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">Player Name</label>
                      <input
                        type="text" value={logPlayer} onChange={e => setLogPlayer(e.target.value)}
                        placeholder="e.g. Messi" className={inputCls}
                      />
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-grow">
                        <label className="block text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">Minute</label>
                        <input
                          type="number" value={logMinute} onChange={e => setLogMinute(e.target.value)}
                          placeholder="45" min="1" max="120" className={inputCls}
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (!logPlayer.trim() || !logMinute.trim()) return;
                          onAddMatchEvent(activeFifaMatch.id, logType, logTeam, logPlayer.trim(), parseInt(logMinute) || 0);
                          setLogPlayer(''); setLogMinute('');
                        }}
                        disabled={!logPlayer.trim() || !logMinute.trim()}
                        className="bg-violet-600 hover:bg-violet-700 disabled:bg-white/5 disabled:text-gray-600 disabled:cursor-not-allowed text-white text-xs font-bold h-9 px-4 rounded-xl transition flex items-center gap-1 flex-shrink-0 shadow shadow-violet-600/20"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Log
                      </button>
                    </div>
                  </div>

                  {activeFifaMatch.events.filter(ev => ev.id.startsWith('custom')).length > 0 && (
                    <div className="mt-4 pt-3.5 border-t border-white/[0.06] space-y-2">
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Admin Logged Events</p>
                      <div className="flex flex-wrap gap-2">
                        {activeFifaMatch.events.filter(ev => ev.id.startsWith('custom')).map(ev => (
                          <div key={ev.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-gray-300">
                            <span>{getEventIcon(ev.type)}</span>
                            <span className="font-semibold">{ev.player} ({ev.minute}')</span>
                            <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/15 px-1.5 py-0.5 rounded-full uppercase font-bold">{ev.team === 'home' ? 'Home' : 'Away'}</span>
                            <button
                              onClick={() => onDeleteMatchEvent(activeFifaMatch.id, ev.id)}
                              className="text-gray-600 hover:text-red-400 transition ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600 text-xs border border-white/[0.06] border-dashed rounded-xl">
                No FIFA stream currently broadcasting. Select a match below to host a watch party.
              </div>
            )}

            {/* HLS URL */}
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">HLS Source Stream URL</label>
              <input type="text" value={streamUrl} onChange={e => setStreamUrl(e.target.value)} className={inputCls} placeholder="HLS URL (.m3u8)" />
            </div>

            {/* Broadcast Alert */}
            {onSendBroadcastAlert && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Send Alert Popup to All Viewers</label>
                <div className="flex gap-2">
                  <input
                    type="text" value={alertText} onChange={e => setAlertText(e.target.value)}
                    className={inputCls} placeholder="Type popup message (e.g. Goal Scored!)" maxLength={150}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!alertText.trim()) return;
                      onSendBroadcastAlert(alertText.trim());
                      setAlertText(''); setAlertSuccess(true);
                      setTimeout(() => setAlertSuccess(false), 2000);
                    }}
                    className="bg-violet-600 hover:bg-violet-700 active:scale-95 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition flex items-center gap-1 flex-shrink-0 shadow-lg shadow-violet-600/20"
                  >
                    Send Alert
                  </button>
                </div>
                {alertSuccess && <p className="text-[10px] text-emerald-400 font-bold mt-1.5 pl-1">✓ Alert sent to all viewers!</p>}
              </div>
            )}
          </div>

          {/* FIFA Matches Grid */}
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-bold text-xs uppercase tracking-widest text-gray-400">Chronological FIFA Matches</h2>
              <div className="flex bg-white/[0.03] p-1 rounded-xl border border-white/[0.06] gap-1">
                <button
                  onClick={() => setFilterType('active_upcoming')}
                  className={`text-[9px] font-bold px-2.5 py-1 rounded-lg transition ${filterType === 'active_upcoming' ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/30' : 'text-gray-400 hover:text-white'}`}
                >
                  Live / Upcoming
                </button>
                <button
                  onClick={() => setFilterType('all')}
                  className={`text-[9px] font-bold px-2.5 py-1 rounded-lg transition ${filterType === 'all' ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/30' : 'text-gray-400 hover:text-white'}`}
                >
                  All ({matches.length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredMatches.map(match => {
                const isCurrent = match.id === activeFifaMatchId;
                return (
                  <div
                    key={match.id}
                    className={`bg-white/[0.03] border rounded-2xl p-4 flex flex-col justify-between shadow-md transition relative ${isCurrent ? 'border-violet-500/40 shadow-violet-600/5 shadow-lg' : 'border-white/[0.06] hover:border-white/10'}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-gray-600 font-mono">#{match.id}</span>
                        {match.status === 'finished' ? (
                          <span className="bg-white/5 border border-white/10 text-gray-500 text-[9px] font-bold px-2 py-0.5 rounded-full">FT</span>
                        ) : match.status === 'live_score' ? (
                          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                            <span className="w-1 h-1 bg-emerald-500 rounded-full" />{match.elapsedMinute}'
                          </span>
                        ) : match.status === 'streaming' ? (
                          <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
                        ) : (
                          <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-bold px-2 py-0.5 rounded-full">Upcoming</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 font-bold text-xs mt-1 flex-wrap">
                        {getFlagUrl(match.teamA)
                          ? <img src={getFlagUrl(match.teamA) || ''} alt="" className="w-6 h-4 object-cover rounded shadow" />
                          : '⚽'}
                        <span>{match.teamA}</span>
                        <span className="text-gray-400 font-mono px-1">{match.scoreA} – {match.scoreB}</span>
                        {getFlagUrl(match.teamB)
                          ? <img src={getFlagUrl(match.teamB) || ''} alt="" className="w-6 h-4 object-cover rounded shadow" />
                          : '⚽'}
                        <span>{match.teamB}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2 truncate">{match.stadium}</p>
                      <p className="text-[10px] text-gray-500 mt-1">{formatDate(match.time)}</p>

                      {match.events.length > 0 && (
                        <div className="mt-3 bg-white/[0.03] border border-white/[0.06] p-2 rounded-xl">
                          <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider mb-1.5 text-center">Match Events</p>
                          <div className="grid grid-cols-2 gap-x-3 text-[10px] divide-x divide-white/[0.06]">
                            <div className="space-y-1 pr-1">
                              {match.events.filter(ev => ev.team === 'home' || ev.id.startsWith('home')).map(ev => (
                                <div key={ev.id} className="flex items-center gap-1 text-gray-300">
                                  <span>{getEventIcon(ev.type)}</span>
                                  <span className="truncate">{ev.player}</span>
                                  <span className="text-[8px] text-gray-600 ml-auto font-mono">{ev.minute}'</span>
                                </div>
                              ))}
                              {match.events.filter(ev => ev.team === 'home' || ev.id.startsWith('home')).length === 0 && (
                                <div className="text-[9px] text-gray-700 italic text-center">–</div>
                              )}
                            </div>
                            <div className="space-y-1 pl-3">
                              {match.events.filter(ev => ev.team === 'away' || ev.id.startsWith('away')).map(ev => (
                                <div key={ev.id} className="flex items-center gap-1 text-gray-300">
                                  <span>{getEventIcon(ev.type)}</span>
                                  <span className="truncate">{ev.player}</span>
                                  <span className="text-[8px] text-gray-600 ml-auto font-mono">{ev.minute}'</span>
                                </div>
                              ))}
                              {match.events.filter(ev => ev.team === 'away' || ev.id.startsWith('away')).length === 0 && (
                                <div className="text-[9px] text-gray-700 italic text-center">–</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex justify-end">
                      {isCurrent ? (
                        <button
                          onClick={onEndFifaStream}
                          className="bg-red-600 hover:bg-red-700 active:scale-95 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition shadow shadow-red-600/20"
                        >
                          <Square className="w-3 h-3 fill-white" />
                          Stop Broadcast
                        </button>
                      ) : (
                        <button
                          onClick={() => onStartFifaStream(match.id, streamUrl)}
                          disabled={match.status === 'finished'}
                          className="bg-violet-600/10 hover:bg-violet-600 disabled:opacity-30 disabled:pointer-events-none border border-violet-500/20 hover:border-transparent text-violet-400 hover:text-white text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition shadow hover:shadow-violet-600/20"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Start Broadcast
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: CUSTOM STREAMS */}
        <div className="flex flex-col space-y-5">

          {/* Host Custom Stream */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="font-bold text-xs uppercase tracking-widest text-gray-300">Host Custom Watch Party</h2>
            </div>

            <form onSubmit={handleCustomHost} className="space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Stream Title</label>
                <input
                  type="text" value={customTitle} onChange={e => setCustomTitle(e.target.value)}
                  className={inputCls} placeholder="e.g. Opening Ceremony / FIFA Gaming" required
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Custom HLS Stream URL</label>
                <input
                  type="text" value={customUrl} onChange={e => setCustomUrl(e.target.value)}
                  className={inputCls} placeholder="HLS URL (.m3u8)"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-95 text-white text-xs font-semibold py-2.5 rounded-xl transition duration-200 flex items-center justify-center gap-1.5 shadow-lg shadow-violet-600/20"
              >
                <Plus className="w-4 h-4" />
                Launch Custom Party
              </button>
            </form>
          </div>

          {/* Active Custom Streams */}
          <div className="flex flex-col space-y-3">
            <h2 className="font-bold text-xs uppercase tracking-widest text-gray-400 px-1">Active Custom Watch Parties</h2>

            {customStreams.length === 0 ? (
              <div className="text-center py-8 text-gray-600 text-xs border border-white/[0.06] border-dashed rounded-2xl bg-white/[0.02]">
                No custom streams currently active.
              </div>
            ) : (
              <div className="space-y-3">
                {customStreams.map(stream => (
                  <div key={stream.id} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 flex flex-col justify-between shadow-md">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                        <h4 className="font-bold text-xs truncate">{stream.title}</h4>
                      </div>
                      <p className="text-[10px] text-gray-600 font-mono">ID: {stream.id}</p>

                      <div className="mt-3 bg-white/[0.03] border border-white/[0.06] rounded-xl p-2 flex items-center justify-between gap-2 overflow-hidden">
                        <span className="text-[9px] text-gray-500 font-mono truncate flex-grow select-all">
                          {getInviteLink(stream.id)}
                        </span>
                        <button
                          onClick={() => handleCopyLink(stream.id)}
                          className="p-1.5 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition flex-shrink-0"
                          title="Copy Invite Link"
                        >
                          {copiedId === stream.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex justify-end">
                      <button
                        onClick={() => onEndCustomStream(stream.id)}
                        className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-600 hover:text-white hover:border-transparent text-[10px] font-bold py-1.5 px-3 rounded-lg transition"
                      >
                        Terminate Stream
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
