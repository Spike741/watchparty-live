import { useState } from 'react';
import { 
  Users, 
  MessageSquare, 
  Tv, 
  Calendar, 
  MapPin, 
  Sparkles,
  RefreshCw,
  Award,
  Settings
} from 'lucide-react';

const codes: Record<string, string> = {
  "Mexico": "mx", "South Africa": "za", "South Korea": "kr", "Czech Republic": "cz",
  "Paraguay": "py", "Canada": "ca", "Germany": "de", "Australia": "au",
  "Turkey": "tr", "Qatar": "qa", "Switzerland": "ch", "USA": "us",
  "United States": "us", "Argentina": "ar", "France": "fr", "Brazil": "br",
  "Spain": "es", "Italy": "it", "England": "gb-eng", "Japan": "jp",
  "Uruguay": "uy", "Colombia": "co", "Netherlands": "nl", "Senegal": "sn",
  "Portugal": "pt", "Ghana": "gh", "Morocco": "ma", "Croatia": "hr",
  "Belgium": "be", "Honduras": "hn", "Costa Rica": "cr", "Panama": "pa",
  "Saudi Arabia": "sa", "Poland": "pl", "Ecuador": "ec", "Denmark": "dk",
  "Tunisia": "tn", "Wales": "gb-wls", "Iran": "ir", "Serbia": "rs",
  "Cameroon": "cm", "Scotland": "gb-sct", "Ukraine": "ua", "Sweden": "se",
  "Austria": "at", "Peru": "pe", "Chile": "cl", "Algeria": "dz",
  "Nigeria": "ng", "Egypt": "eg", "Ivory Coast": "ci", "Cote d'Ivoire": "ci",
  "New Zealand": "nz", "Jamaica": "jm", "Venezuela": "ve", "Bolivia": "bo",
  "Bosnia and Herzegovina": "ba", "Cape Verde": "cv", "Curaçao": "cw",
  "Democratic Republic of the Congo": "cd", "Haiti": "ht", "Iraq": "iq",
  "Jordan": "jo", "Norway": "no", "Uzbekistan": "uz"
};

export function getFlagUrl(teamName: string | undefined | null): string | null {
  if (!teamName || typeof teamName !== 'string') return null;
  const code = codes[teamName.trim()];
  if (code) {
    return `https://flagcdn.com/w80/${code}.png`;
  }
  return null;
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return 'Scheduled';
  try {
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return dateStr;

    const dateFormatted = dateObj.toLocaleDateString('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const timeFormatted = dateObj.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return `${dateFormatted} • ${timeFormatted} IST`;
  } catch (e) {
    return dateStr;
  }
}

export function getEventIcon(type: string): string {
  switch (type) {
    case 'penalty': return '⚽ (P)';
    case 'yellow_card': return '🟨';
    case 'red_card': return '🟥';
    default: return '⚽';
  }
}

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

interface LobbyViewProps {
  matches: FifaMatch[];
  nickname: string;
  userColor: string;
  onChangeNickname: () => void;
  onJoinFifaStream: (matchId: string) => void;
  invitedStream: { title: string; id: string } | null;
  onJoinCustomStream: (streamId: string) => void;
  viewerCount: number;
  partyMembers: number;
  socketConnected: boolean;
  onOpenSettings?: () => void;
}

export function LobbyView({
  matches,
  nickname,
  userColor,
  onChangeNickname,
  onJoinFifaStream,
  invitedStream,
  onJoinCustomStream,
  viewerCount,
  partyMembers,
  socketConnected,
  onOpenSettings
}: LobbyViewProps) {
  // Filter toggle state (defaults to only showing active and upcoming matches)
  const [filterType, setFilterType] = useState<'all' | 'active_upcoming'>('active_upcoming');

  // Filter matches based on selection
  const filteredMatches = matches.filter(m => {
    if (filterType === 'active_upcoming') {
      return m.status === 'streaming' || m.status === 'live_score' || m.status === 'upcoming';
    }
    return true;
  });

  return (
    <div 
      className="h-screen bg-transparent text-[var(--text-main)] flex flex-col font-sans select-none overflow-hidden"
      style={{ 
        height: 'var(--visual-height, 100vh)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)'
      }}
    >
      
      {/* 1. Header Area */}
      <header className="h-16 bg-[var(--bg-header)] border-b border-[var(--border-header)] backdrop-blur-md flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-20">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm uppercase tracking-wider animate-pulse-live">
            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
            LIVE
          </div>
          <h1 className="font-extrabold text-xs sm:text-sm tracking-tight text-[var(--text-main)]">
            FIFA 2026 Watch Party
          </h1>
          <span 
            className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-500 shadow-sm' : 'bg-amber-500 animate-pulse'}`} 
            title={socketConnected ? 'Lobby Synced' : 'Syncing lobby...'} 
          />
        </div>

        {/* User Profile display */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-black/5 dark:bg-white/5 px-2.5 py-1.5 rounded-xl border border-[var(--border-glass)] flex-shrink-0">
            <Users className="w-3.5 h-3.5 text-violet-500" />
            <span>{Math.max(viewerCount, partyMembers)}</span>
          </div>

          <button 
            onClick={onChangeNickname}
            className="flex items-center gap-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-[var(--border-glass)] px-3 py-1.5 rounded-xl transition duration-200 active:scale-95 text-xs font-semibold flex-shrink-0 cursor-pointer text-[var(--text-main)]"
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: userColor }} />
            <span className="truncate max-w-[80px] sm:max-w-[120px]">{nickname}</span>
          </button>

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-1.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-[var(--border-glass)] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] transition duration-200 active:scale-95 flex-shrink-0 cursor-pointer"
              title="Configure Server Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. Scrollable Dashboard */}
      <main className="smooth-scroll flex-grow p-4 sm:p-6 max-w-[94%] xl:max-w-[1440px] w-full mx-auto space-y-6 custom-scrollbar z-10">
        
        {/* Custom Stream Invitation Banner */}
        {invitedStream && (
          <div className="bg-gradient-to-r from-violet-500/5 to-indigo-500/5 border border-violet-500/25 rounded-2xl p-5 shadow-sm relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500"></div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-full flex-shrink-0 animate-bounce">
                  <Sparkles className="w-5 h-5 text-violet-500" />
                </div>
                <div>
                  <p className="text-[9px] text-violet-500 font-bold uppercase tracking-wider">Watch Party Invitation</p>
                  <h2 className="text-sm font-bold mt-0.5 text-[var(--text-main)]">{invitedStream.title}</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Click the link below to hop straight into the custom watch party chat!</p>
                </div>
              </div>
              <button
                onClick={() => onJoinCustomStream(invitedStream.id)}
                className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-semibold px-5 py-3 rounded-xl transition duration-200 flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              >
                <Tv className="w-4 h-4" />
                Join Custom Party
              </button>
            </div>
          </div>
        )}

        {/* Lobby Greeting Hero Card */}
        <div className="bg-gradient-to-br from-indigo-500/[0.04] to-violet-500/[0.02] dark:from-white/[0.03] dark:to-transparent border border-[var(--border-glass)] rounded-2xl p-6 shadow-sm relative overflow-hidden flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2 text-[var(--text-main)]">
              Welcome, {nickname}! <span className="animate-pulse">👋</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)] max-w-lg leading-relaxed">
              Explore the upcoming FIFA 2026 schedules below. Tap on any match card to join the watch party stream or room.
            </p>
          </div>
          <div className="hidden md:flex items-center justify-center w-16 h-16 opacity-10">
            <Award className="w-full h-full text-[var(--text-main)]" />
          </div>
        </div>

        {/* Chronological Grid FIFA Matches */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 gap-2 flex-wrap">
            <h3 className="font-bold text-[10px] uppercase tracking-wider text-[var(--text-muted)]">FIFA 2026 Match Schedules</h3>
            
            <div className="flex items-center gap-3">
              <div className="flex bg-black/5 dark:bg-black/20 p-1 rounded-xl border border-[var(--border-glass)] gap-1">
                <button
                  onClick={() => setFilterType('active_upcoming')}
                  className={`text-[9px] font-bold px-3 py-1 rounded-lg transition cursor-pointer ${filterType === 'active_upcoming' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                >
                  Live / Upcoming
                </button>
                <button
                  onClick={() => setFilterType('all')}
                  className={`text-[9px] font-bold px-3 py-1 rounded-lg transition cursor-pointer ${filterType === 'all' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                >
                  All ({matches.length})
                </button>
              </div>

              <div className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Real-time Sync</span>
              </div>
            </div>
          </div>

          {filteredMatches.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-muted)] text-sm border border-[var(--border-glass)] border-dashed rounded-2xl bg-black/[0.01] dark:bg-white/[0.01]">
              No active or upcoming matches scheduled right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredMatches.map((match) => {
                const isStreaming = match.status === 'streaming';
                const isLiveScore = match.status === 'live_score';
                const isFinished = match.status === 'finished';

                return (
                  <div 
                    key={match.id}
                    className={`
                      match-card glass-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group
                      ${isStreaming 
                        ? 'ring-1 ring-violet-500/20' 
                        : isLiveScore 
                          ? 'ring-1 ring-cyan-500/20' 
                          : ''
                      }
                    `}
                  >
                    <div>
                      {/* Top Bar Status Indicator */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">Match #{match.id}</span>
                        {isStreaming ? (
                          <span className="bg-violet-500/10 border border-violet-500/25 text-violet-600 dark:text-violet-400 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wide animate-pulse-live flex items-center gap-1 shadow-sm">
                            <span className="w-1.5 h-1.5 bg-violet-600 dark:bg-violet-400 rounded-full animate-ping"></span>
                            STREAMING LIVE
                          </span>
                        ) : isLiveScore ? (
                          <span className="bg-cyan-500/10 border border-cyan-500/25 text-cyan-600 dark:text-cyan-400 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wide animate-pulse-live flex items-center gap-1 shadow-sm">
                            <span className="w-1.5 h-1.5 bg-cyan-600 dark:bg-cyan-400 rounded-full animate-ping" />
                            LIVE SCORE ({match.elapsedMinute}')
                          </span>
                        ) : isFinished ? (
                          <span className="bg-slate-500/10 border border-slate-500/20 text-slate-700 dark:text-slate-300 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            Final Score
                          </span>
                        ) : (
                          <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            Scheduled
                          </span>
                        )}
                      </div>

                      {/* Main Countries Grid */}
                      <div className="flex items-center justify-between py-2">
                        {/* Team A */}
                        <div className="flex flex-col items-center flex-1 text-center">
                          {getFlagUrl(match.teamA) ? (
                            <img 
                              src={getFlagUrl(match.teamA) || ''} 
                              alt={match.teamA} 
                              className="w-12 h-8 object-cover rounded-md shadow border border-[var(--border-glass)] select-none" 
                            />
                          ) : (
                            <span className="text-2xl filter drop-shadow-md select-none">⚽</span>
                          )}
                          <span className="font-bold text-xs mt-2 text-[var(--text-main)]">{match.teamA}</span>
                        </div>

                        {/* Scores Box */}
                        <div className="flex flex-col items-center px-4">
                          {(isLiveScore || isStreaming || isFinished) ? (
                            <span className="text-xl font-extrabold tracking-widest font-mono text-[var(--text-main)]">
                              {match.scoreA}<span className="text-[var(--text-muted)]/40 px-1">:</span>{match.scoreB}
                            </span>
                          ) : (
                            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">VS</span>
                          )}
                          
                          {/* Minute Indicator */}
                          {isLiveScore && (
                            <span className="text-[9px] text-cyan-600 dark:text-cyan-400 font-bold font-mono mt-1">{match.elapsedMinute}'</span>
                          )}
                          {isStreaming && (
                            <span className="text-[9px] text-violet-600 dark:text-violet-400 font-bold font-mono mt-1 animate-pulse">LIVE</span>
                          )}
                        </div>

                        {/* Team B */}
                        <div className="flex flex-col items-center flex-1 text-center">
                          {getFlagUrl(match.teamB) ? (
                            <img 
                              src={getFlagUrl(match.teamB) || ''} 
                              alt={match.teamB} 
                              className="w-12 h-8 object-cover rounded-md shadow border border-[var(--border-glass)] select-none" 
                            />
                          ) : (
                            <span className="text-2xl filter drop-shadow-md select-none">⚽</span>
                          )}
                          <span className="font-bold text-xs mt-2 text-[var(--text-main)]">{match.teamB}</span>
                        </div>
                      </div>

                      {/* Match Meta Information */}
                      <div className="mt-4 pt-3.5 border-t border-[var(--border-glass)] space-y-2">
                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-medium font-sans">
                          <MapPin className="w-4 h-4 text-violet-500/70 flex-shrink-0" />
                          <span className="truncate">{match.stadium}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-medium font-sans">
                          <Calendar className="w-4 h-4 text-violet-500/70 flex-shrink-0" />
                          <span>{formatDate(match.time)}</span>
                        </div>
                      </div>

                      {/* Match Event Timeline */}
                      {match.events.length > 0 && (
                        <div className="mt-4">
                          <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider mb-2 px-1 text-center select-none">Match Events</p>
                          <div className="bg-black/5 dark:bg-black/25 p-3 rounded-xl border border-[var(--border-glass)] grid grid-cols-2 gap-x-3 text-xs divide-x divide-slate-200 dark:divide-slate-800">
                            {/* Home Scorers (Team A) */}
                            <div className="space-y-2 pr-1.5 min-h-[15px]">
                              {match.events
                                .filter((ev) => ev.team === 'home' || ev.id.startsWith('home'))
                                .map((ev) => (
                                  <div key={ev.id} className="flex items-center gap-1.5 text-[var(--text-main)] justify-start">
                                    <span className="text-sm select-none" title="Goal">{getEventIcon(ev.type)}</span>
                                    <span className="font-semibold truncate max-w-[80px] sm:max-w-none text-xs" title={ev.player}>{ev.player}</span>
                                    <span className="text-[8px] text-[var(--text-muted)] font-bold font-mono ml-auto">{ev.minute}'</span>
                                  </div>
                                ))}
                              {match.events.filter((ev) => ev.team === 'home' || ev.id.startsWith('home')).length === 0 && (
                                <div className="text-[9px] text-[var(--text-muted)]/50 italic text-center py-1 select-none">-</div>
                              )}
                            </div>
                            
                            {/* Away Scorers (Team B) */}
                            <div className="space-y-2 pl-3 min-h-[15px]">
                              {match.events
                                .filter((ev) => ev.team === 'away' || ev.id.startsWith('away'))
                                .map((ev) => (
                                  <div key={ev.id} className="flex items-center gap-1.5 text-[var(--text-main)] justify-start">
                                    <span className="text-sm select-none" title="Goal">{getEventIcon(ev.type)}</span>
                                    <span className="font-semibold truncate max-w-[80px] sm:max-w-none text-xs" title={ev.player}>{ev.player}</span>
                                    <span className="text-[8px] text-[var(--text-muted)] font-bold font-mono ml-auto">{ev.minute}'</span>
                                  </div>
                                ))}
                              {match.events.filter((ev) => ev.team === 'away' || ev.id.startsWith('away')).length === 0 && (
                                <div className="text-[9px] text-[var(--text-muted)]/50 italic text-center py-1 select-none">-</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom CTA Joining Buttons */}
                    <div className="mt-5 pt-3 border-t border-[var(--border-glass)]">
                      {isStreaming ? (
                        <button
                          onClick={() => onJoinFifaStream(match.id)}
                          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-semibold py-2.5 rounded-xl transition duration-200 flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/5 cursor-pointer active:scale-98"
                        >
                          <Tv className="w-4 h-4" />
                          Join Watch Party (Live Now)
                        </button>
                      ) : isLiveScore ? (
                        <button
                          onClick={() => onJoinFifaStream(match.id)}
                          className="w-full bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white text-xs font-semibold py-2.5 rounded-xl transition duration-200 flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/5 cursor-pointer active:scale-98"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Join Chat Room (Live Score)
                        </button>
                      ) : isFinished ? (
                        <div className="w-full text-center py-2 bg-black/5 dark:bg-white/5 border border-[var(--border-glass)] rounded-xl text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                          Match Completed
                        </div>
                      ) : (
                        <div className="w-full text-center py-2.5 bg-black/3 dark:bg-white/3 border border-[var(--border-glass)] rounded-xl text-xs text-[var(--text-muted)] font-semibold tracking-wide font-mono">
                          Starts at {match.time ? (formatDate(match.time).split('•')[1]?.trim() || 'Scheduled') : 'Scheduled'}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
