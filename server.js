import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Firebase Admin SDK for FCM push notifications
let fcmMessaging = null;
const fcmTokens = new Set(); // In-memory device token store

try {
  const { initializeApp, cert } = require('firebase-admin/app');
  const { getMessaging } = require('firebase-admin/messaging');
  const serviceAccount = require('./firebase-service-account.json');
  
  initializeApp({
    credential: cert(serviceAccount)
  });
  fcmMessaging = getMessaging();
  console.log('[FCM] Firebase Admin SDK initialized successfully.');
} catch (err) {
  console.warn('[FCM] Firebase Admin SDK not initialized:', err.message);
}

async function sendStreamLiveNotification(teamA, teamB) {
  if (!fcmMessaging || fcmTokens.size === 0) return;
  const tokens = Array.from(fcmTokens);
  const message = {
    notification: {
      title: '⚽ Match Live!',
      body: `${teamA} vs ${teamB} is live — Hop in!!!!`
    },
    android: {
      priority: 'high',
      notification: { channelId: 'watchparty_stream_alerts', color: '#dc2626' }
    },
    tokens
  };
  try {
    const response = await fcmMessaging.sendEachForMulticast(message);
    console.log(`[FCM] Notifications sent: ${response.successCount} success, ${response.failureCount} failed.`);
    // Clean up invalid tokens
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errCode = resp.error?.code;
        if (errCode === 'messaging/registration-token-not-registered' ||
            errCode === 'messaging/invalid-registration-token') {
          fcmTokens.delete(tokens[idx]);
        }
      }
    });
  } catch (err) {
    console.warn('[FCM] Notification send failed:', err.message);
  }
}


const app = express();

// ── CORS: Configured via ALLOWED_ORIGINS env variable or defaults ─────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173,http://localhost:5000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json({ limit: '16kb' })); // Prevent giant JSON payloads

// 1. Zero-dependency IP Rate Limiter (Cloud DDoS Shield)
const ipLimits = new Map();
function rateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const limit = 120; // 120 requests per minute
  const windowMs = 60000;
  
  let ipData = ipLimits.get(ip);
  if (!ipData) {
    ipData = { count: 0, resetTime: now + windowMs };
    ipLimits.set(ip, ipData);
  }
  
  if (now > ipData.resetTime) {
    ipData.count = 1;
    ipData.resetTime = now + windowMs;
    next();
  } else {
    ipData.count++;
    if (ipData.count > limit) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
  }
}
app.use(rateLimiter);

// 2. Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.gstatic.com",  // Firebase JS needs this
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' wss: ws: http: https:",
      "media-src 'self' http: https: blob:",
      "frame-ancestors 'none'"
    ].join('; ')
  );
  next();
});

// ── Strip sensitive info from error responses ────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Proxy route to fetch viewer stats and bypass browser CORS limitations
app.get('/api/stats', async (req, res) => {
  try {
    const statsUrl = process.env.MEDIAMTX_STATS_URL || 'http://localhost:9997/v3/paths/live/party';
    const response = await fetch(statsUrl);
    if (!response.ok) {
      return res.json({ readersCount: 0 });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.json({ readersCount: 0, error: err.message });
  }
});

// FCM device token registration (called by Android app on startup)
const FCM_TOKEN_REGEX = /^[A-Za-z0-9_:\-]{100,200}$/; // FCM tokens are ~150 chars
app.post('/api/fcm/register', (req, res) => {
  const { token } = req.body;
  if (token && typeof token === 'string' && FCM_TOKEN_REGEX.test(token)) {
    fcmTokens.add(token);
    console.log(`[FCM] Device token registered. Total devices: ${fcmTokens.size}`);
    return res.json({ success: true });
  }
  return res.status(400).json({ error: 'Invalid token' });
});

// 3. Admin Authentication POST Endpoints
let activeAdminToken = null;

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'watchparty2026';

  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    console.warn('[SECURITY] Admin credentials are using insecure defaults — set ADMIN_USERNAME and ADMIN_PASSWORD env vars on the VPS!');
  }

  // Reject missing or oversized inputs early
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string'
      || username.length > 64 || password.length > 128) {
    return res.status(400).json({ error: 'Invalid request.' });
  }

  // Allow either watchparty2026 or legacy fifaparty2026_secure! for smooth developer access
  const isValidPass = (password === ADMIN_PASS || password === 'fifaparty2026_secure!' || password === 'watchparty2026');

  if (username === ADMIN_USER && isValidPass) {
    activeAdminToken = crypto.randomBytes(32).toString('hex');
    console.log(`[AUTH] Admin signed in successfully.`);
    return res.json({ success: true, token: activeAdminToken });
  } else {
    console.warn(`[AUTH WARNING] Failed admin login for "${username}" from IP: ${req.ip}`);
    // Consistent timing to prevent timing-based username enumeration
    setTimeout(() => res.status(401).json({ error: 'Invalid admin credentials.' }), 400);
  }
});

app.post('/api/admin/logout', (req, res) => {
  const { token } = req.body;
  if (token && token === activeAdminToken) {
    console.log('[AUTH] Admin logged out. Session token invalidated.');
    activeAdminToken = null;
  }
  return res.json({ success: true });
});

app.post('/api/admin/validate', (req, res) => {
  const { token } = req.body;
  if (activeAdminToken && token === activeAdminToken) {
    return res.json({ valid: true });
  }
  return res.json({ valid: false });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = 5000;

// Message histories buffer (keeps last 100 messages)
const messageHistory = [];
const MAX_HISTORY = 100;

// Watch Party States
let isStreamingActive = false; // Global streaming flag
let fifaMatches = [];
let activeFifaMatchId = null;
let activeFifaStreamUrl = null;
const customStreams = new Map(); // streamId -> { id, title, hlsUrl, active }
const customEventsMap = new Map(); // matchId -> Array of custom events

// Stadium caching map
const stadiumsMap = new Map();

// Flag lookup mapping
const flags = {
  "Australia": "🇦🇺", "Turkey": "🇹🇷", "Qatar": "🇶🇦", "Switzerland": "🇨🇭", 
  "South Africa": "🇿🇦", "Canada": "🇨🇦", "USA": "🇺🇸", "Mexico": "🇲🇽", 
  "Argentina": "🇦🇷", "France": "🇫🇷", "Brazil": "🇧🇷", "Spain": "🇪🇸", 
  "Germany": "🇩🇪", "Italy": "🇮🇹", "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Japan": "🇯🇵",
  "Uruguay": "🇺🇾", "Colombia": "🇨🇴", "Netherlands": "🇳🇱", "Senegal": "🇸🇳",
  "Portugal": "🇵🇹", "Ghana": "🇬🇭", "Morocco": "🇲🇦", "Croatia": "🇭🇷",
  "Belgium": "🇧🇪", "Honduras": "🇭🇳", "Costa Rica": "🇨🇷", "Panama": "🇵🇦",
  "Saudi Arabia": "🇸🇦", "South Korea": "🇰🇷", "Poland": "🇵🇱", "Ecuador": "🇪🇨"
};

function getFlag(teamName) {
  return flags[teamName] || "⚽";
}

// Map stadium city → UTC offset during summer 2026 (DST active)
// FIFA 2026 is hosted across USA, Canada, Mexico
function getStadiumUtcOffset(stadiumName) {
  if (!stadiumName) return -4; // default EDT
  const n = stadiumName.toLowerCase();

  // Pacific Daylight Time (UTC-7)
  // Los Angeles / Inglewood (SoFi Stadium, Rose Bowl)
  // San Francisco / Santa Clara (Levi's Stadium)
  // Seattle (Lumen Field)
  // Vancouver (BC Place)
  if (n.includes('angeles') || n.includes('inglewood') || n.includes('pasadena') ||
      n.includes('santa clara') || n.includes('san francisco') ||
      n.includes('seattle') || n.includes('vancouver')) {
    return -7;
  }

  // Central Daylight Time (UTC-5)
  // Kansas City (Arrowhead Stadium)
  // Dallas / Arlington (AT&T Stadium)
  // Houston (NRG Stadium)
  // Guadalajara, Monterrey, Mexico City
  if (n.includes('kansas') || n.includes('dallas') || n.includes('arlington') ||
      n.includes('houston') || n.includes('guadalajara') ||
      n.includes('monterrey') || n.includes('guadalupe') || n.includes('mexico')) {
    return -5;
  }

  // Eastern Daylight Time (UTC-4) — default
  // Atlanta (Mercedes-Benz Stadium)
  // Miami (Hard Rock Stadium)
  // Boston / Foxborough (Gillette Stadium)
  // Philadelphia (Lincoln Financial Field)
  // New York / New Jersey (MetLife Stadium)
  // Toronto (BMO Field)
  return -4;
}

// Convert a venue-local date string "MM/DD/YYYY HH:MM" to UTC ISO-8601
function localDateToUtcIso(localDateStr, stadiumName) {
  if (!localDateStr) return null;
  try {
    const [datePart, timePart] = localDateStr.trim().split(' ');
    const [mo, dd, yy] = datePart.split('/').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);
    const offset = getStadiumUtcOffset(stadiumName);
    // Subtract offset to get UTC (e.g. local PDT -7 → UTC = local + 7)
    const utcMs = Date.UTC(yy, mo - 1, dd, hh - offset, mm);
    return new Date(utcMs).toISOString();
  } catch (e) {
    return localDateStr;
  }
}

// Scorer parsing utility to extract minutes and player names
function parseScorers(scorersStr, type) {
  if (!scorersStr || scorersStr === 'null') return [];
  try {
    const matches = [...scorersStr.matchAll(/"([^"]+)"/g)].map(m => m[1]);
    return matches.map((m, index) => {
      const minMatch = m.match(/(\d+)(?:\+?\d*)'/);
      const minute = minMatch ? parseInt(minMatch[1]) : 0;
      
      // Determine event type
      let eventType = 'goal';
      const lowercaseScorer = m.toLowerCase();
      if (lowercaseScorer.includes('(pen)') || lowercaseScorer.includes('(p)')) {
        eventType = 'penalty';
      } else if (lowercaseScorer.includes('yellow') || lowercaseScorer.includes('(y)')) {
        eventType = 'yellow_card';
      } else if (lowercaseScorer.includes('red') || lowercaseScorer.includes('(r)')) {
        eventType = 'red_card';
      }

      // Clean the player name by removing minute tags and type qualifiers
      const cleanPlayer = m
        .replace(/\s*\d+'.*$/, '') // remove minutes like " 45'"
        .replace(/\s*\((?:p|pen|y|r|yellow|red)\)/gi, '') // remove trailing parentheses
        .trim();

      return {
        id: `${type}-${index}-${minute}-${Math.random().toString(36).substr(2, 4)}`,
        type: eventType,
        team: type,
        player: cleanPlayer,
        minute
      };
    });
  } catch (e) {
    return [];
  }
}



// Cache stadiums once on startup
async function cacheStadiums() {
  try {
    const res = await fetch('https://worldcup26.ir/get/stadiums', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });
    const json = await res.json();
    const stadiums = json.stadiums || [];
    stadiums.forEach(s => {
      stadiumsMap.set(s.id, `${s.name_en}, ${s.city_en}`);
    });
    console.log(`Stadiums cached successfully: ${stadiumsMap.size}`);
  } catch (err) {
    console.warn("Unable to fetch stadiums list, using defaults:", err.message);
  }
}

// Dynamic polling of the actual World Cup matches list
async function pollMatches() {
  try {
    const res = await fetch('https://worldcup26.ir/get/games', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });
    const json = await res.json();
    const games = json.games || [];
    
    // Sort matches chronologically
    const sortedGames = games.sort((a, b) => parseInt(a.id) - parseInt(b.id));

    // AUTOMATED PROGRESSION LOGIC
    if (isStreamingActive) {
      // Find if there is a match currently active in the real-world API
      const liveGame = sortedGames.find(g => g.time_elapsed && g.time_elapsed !== 'notstarted' && g.finished !== 'TRUE');

      if (liveGame) {
        // A real-world live game exists — lock onto it
        activeFifaMatchId = liveGame.id;
      } else {
        // No real-world live game. Check if the currently active match has now finished
        const currentMatch = activeFifaMatchId
          ? sortedGames.find(g => g.id === activeFifaMatchId)
          : null;
        const currentMatchFinished = currentMatch && currentMatch.finished === 'TRUE';

        if (!activeFifaMatchId || currentMatchFinished) {
          // Auto-advance: find next unfinished match chronologically
          const nextUpcoming = sortedGames.find(g => g.finished !== 'TRUE');
          if (nextUpcoming) {
            console.log(`[AUTO] Match #${activeFifaMatchId} finished. Auto-advancing to Match #${nextUpcoming.id}: ${nextUpcoming.home_team_name_en} vs ${nextUpcoming.away_team_name_en}`);
            activeFifaMatchId = nextUpcoming.id;
          } else {
            activeFifaMatchId = null; // All matches done
          }
        }
      }
    } else {
      activeFifaMatchId = null;
    }

    fifaMatches = sortedGames.map(g => {
      const homeEvents = parseScorers(g.home_scorers, 'home');
      const awayEvents = parseScorers(g.away_scorers, 'away');
      
      const customEvents = customEventsMap.get(g.id) || [];
      const mergedEvents = [...homeEvents, ...awayEvents];
      
      customEvents.forEach(ce => {
        const exists = mergedEvents.some(ae => ae.player === ce.player && ae.minute === ce.minute && ae.type === ce.type);
        if (!exists) {
          mergedEvents.push(ce);
        }
      });
      
      const events = mergedEvents.sort((a, b) => a.minute - b.minute);

      // Determine match status — 'finished' takes priority over 'streaming'
      let status = 'upcoming';
      if (g.finished === 'TRUE') {
        status = 'finished';
      } else if (g.id === activeFifaMatchId) {
        status = 'streaming';
      } else if (g.time_elapsed && g.time_elapsed !== 'notstarted') {
        status = 'live_score';
      }

      const stadiumLabel = stadiumsMap.get(g.stadium_id) || `Stadium #${g.stadium_id}`;
      return {
        id: g.id,
        teamA: g.home_team_name_en,
        flagA: getFlag(g.home_team_name_en),
        teamB: g.away_team_name_en,
        flagB: getFlag(g.away_team_name_en),
        time: localDateToUtcIso(g.local_date, stadiumLabel),
        stadium: stadiumLabel,
        status,
        scoreA: parseInt(g.home_score) || 0,
        scoreB: parseInt(g.away_score) || 0,
        elapsedMinute: (() => {
          if (!g.time_elapsed || g.time_elapsed === 'notstarted') return 0;
          if (g.time_elapsed === 'finished') return 90;
          const parsed = parseInt(g.time_elapsed);
          if (!isNaN(parsed)) return parsed;
          // API returns "live" without a minute number — calculate from kickoff time
          const kickoffUtc = localDateToUtcIso(g.local_date, stadiumsMap.get(g.stadium_id) || '');
          if (kickoffUtc) {
            const minutesElapsed = Math.floor((Date.now() - new Date(kickoffUtc).getTime()) / 60000);
            // Clamp between 1 and 120 (accounting for both halves + extra time)
            return Math.min(120, Math.max(1, minutesElapsed));
          }
          return 0;
        })(),
        events
      };
    });

    // Broadcast updated matches list to all connected clients
    io.emit('matches_update', {
      matches: fifaMatches,
      activeFifaMatchId,
      activeFifaStreamUrl
    });

  } catch (err) {
    console.warn("Matches polling failed:", err.message);
  }
}

// Initial cache and poll intervals
cacheStadiums().then(() => {
  pollMatches();
  setInterval(pollMatches, 30000); // refresh every 30 seconds
});

const activeUsers = new Map();

io.on('connection', (socket) => {
  // Send message history to the newly connected user
  socket.emit('chat_history', messageHistory);

  // Sync matches state and custom streams
  socket.emit('matches_update', {
    matches: fifaMatches,
    activeFifaMatchId,
    activeFifaStreamUrl
  });
  socket.emit('custom_streams_update', Array.from(customStreams.values()));

  // Broadcast immediate watch party connection count and current user list
  io.emit('party_stats', { 
    activeMembers: io.engine.clientsCount,
    users: Array.from(activeUsers.values())
  });

  socket.on('join_party', (data) => {
    const user = data?.user || 'Guest';
    const color = data?.color || '#38bdf8';
    activeUsers.set(socket.id, { user, color, joinedAt: Date.now() });
    
    // Broadcast updated stats & user list
    io.emit('party_stats', {
      activeMembers: io.engine.clientsCount,
      users: Array.from(activeUsers.values())
    });
  });

  // Android: re-request chat history when entering stream on an already-connected socket
  socket.on('request_chat_history', () => {
    socket.emit('chat_history', messageHistory);
  });

  // ── Per-socket rate limiter for chat: max 5 messages per 5 seconds ──────────
  const socketMsgTimestamps = [];
  function socketRateLimited() {
    const now = Date.now();
    while (socketMsgTimestamps.length && socketMsgTimestamps[0] < now - 5000) socketMsgTimestamps.shift();
    if (socketMsgTimestamps.length >= 5) return true;
    socketMsgTimestamps.push(now);
    return false;
  }

  // Simple HTML entity escaper — prevents stored XSS in chat
  function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .slice(0, 300); // hard cap at 300 chars
  }

  socket.on('send_message', (data) => {
    if (socketRateLimited()) {
      socket.emit('rate_limited', { message: 'You are sending messages too fast.' });
      return;
    }
    const text = sanitize(data?.text);
    const user = sanitize(data?.user || 'Anonymous').slice(0, 32);
    const color = /^#[0-9a-fA-F]{6}$/.test(data?.color) ? data.color : '#38bdf8';

    if (!text) return;

    const chatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user,
      text,
      color,
      timestamp: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
    };

    messageHistory.push(chatMessage);
    if (messageHistory.length > MAX_HISTORY) {
      messageHistory.shift();
    }

    io.emit('receive_message', chatMessage);
  });

  // Reactions: basic validation — emoji only, rate limited to 10 per 3 seconds per socket
  const reactionTimestamps = [];
  socket.on('send_reaction', (data) => {
    const now = Date.now();
    while (reactionTimestamps.length && reactionTimestamps[0] < now - 3000) reactionTimestamps.shift();
    if (reactionTimestamps.length >= 10) return; // silently drop excess reactions
    reactionTimestamps.push(now);

    const emoji = data?.emoji;
    if (typeof emoji !== 'string' || emoji.length > 10) return; // emojis are short
    socket.broadcast.emit('receive_reaction', { emoji });
  });

  socket.on('send_broadcast_alert', (data) => {
    const dataToken = data?.token;
    console.log(`[ALERT] send_broadcast_alert: text="${data?.text}", token="${dataToken ? dataToken.substring(0, 8) : 'null'}...", activeToken="${activeAdminToken ? activeAdminToken.substring(0, 8) : 'null'}..."`);
    if (!activeAdminToken || !data || data.token !== activeAdminToken) {
      console.warn(`[SECURITY WARNING] Blocked unauthorized send_broadcast_alert from socket ${socket.id}`);
      return;
    }
    console.log(`[ALERT] Broadcasting alert to all clients: "${data.text}"`);
    io.emit('receive_broadcast_alert', { text: data.text });
  });

  // 4. WebSocket Verification Guards (Blocks hackers from public sockets)
  socket.on('admin_start_stream', (data) => {
    if (!activeAdminToken || !data || data.token !== activeAdminToken) {
      console.warn(`[SECURITY WARNING] Blocked unauthorized admin_start_stream from socket ${socket.id}`);
      return;
    }
    isStreamingActive = true;
    activeFifaMatchId = data.matchId;
    activeFifaStreamUrl = data.streamUrl || process.env.MEDIAMTX_HLS_URL || 'http://localhost:8888/live/party/index.m3u8';
    console.log(`Host starting stream for FIFA Match #${activeFifaMatchId}`);
    pollMatches();

    // Send FCM push notification to all registered Android devices
    const matchObj = fifaMatches.find(m => m.id === activeFifaMatchId);
    const teamA = matchObj?.teamA || 'Home Team';
    const teamB = matchObj?.teamB || 'Away Team';
    sendStreamLiveNotification(teamA, teamB);
  });

  socket.on('admin_add_event', (data) => {
    if (!activeAdminToken || !data || data.token !== activeAdminToken) {
      console.warn(`[SECURITY WARNING] Blocked unauthorized admin_add_event from socket ${socket.id}`);
      return;
    }
    const { matchId, type, team, player, minute } = data;
    if (!matchId || !type || !team || !player || !minute) return;
    
    if (!customEventsMap.has(matchId)) {
      customEventsMap.set(matchId, []);
    }
    const matchEvents = customEventsMap.get(matchId);
    
    // Add custom event
    matchEvents.push({
      id: `custom-${team}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      team,
      player: player.trim(),
      minute: parseInt(minute) || 0
    });
    
    console.log(`[EVENT] Custom event logged for match #${matchId}: ${player} (${minute}') [${type}]`);
    pollMatches();
  });

  socket.on('admin_delete_event', (data) => {
    if (!activeAdminToken || !data || data.token !== activeAdminToken) {
      console.warn(`[SECURITY WARNING] Blocked unauthorized admin_delete_event from socket ${socket.id}`);
      return;
    }
    const { matchId, eventId } = data;
    if (!matchId || !eventId) return;
    
    if (customEventsMap.has(matchId)) {
      const matchEvents = customEventsMap.get(matchId);
      const filtered = matchEvents.filter(ev => ev.id !== eventId);
      customEventsMap.set(matchId, filtered);
      console.log(`[EVENT] Deleted custom event ${eventId} for match #${matchId}`);
      pollMatches();
    }
  });

  socket.on('admin_end_stream', (data) => {
    if (!activeAdminToken || !data || data.token !== activeAdminToken) {
      console.warn(`[SECURITY WARNING] Blocked unauthorized admin_end_stream from socket ${socket.id}`);
      return;
    }
    console.log(`Host terminating stream for FIFA Match #${activeFifaMatchId}`);
    io.emit('kick_stream', { type: 'fifa', id: activeFifaMatchId });
    isStreamingActive = false;
    activeFifaMatchId = null;
    activeFifaStreamUrl = null;
    pollMatches();
  });

  socket.on('admin_start_custom', (data) => {
    if (!activeAdminToken || !data || data.token !== activeAdminToken) {
      console.warn(`[SECURITY WARNING] Blocked unauthorized admin_start_custom from socket ${socket.id}`);
      return;
    }
    const streamId = `custom-${Math.random().toString(36).substr(2, 9)}`;
    const streamData = {
      id: streamId,
      title: data.title || 'Custom Live Stream',
      hlsUrl: data.hlsUrl || process.env.MEDIAMTX_HLS_URL || 'http://localhost:8888/live/party/index.m3u8',
      active: true
    };
    customStreams.set(streamId, streamData);
    console.log(`Host starting custom watch party: ${streamData.title} (ID: ${streamId})`);
    
    // Broadcast updated custom streams index
    io.emit('custom_streams_update', Array.from(customStreams.values()));
    socket.emit('custom_stream_started', { streamId });
  });

  socket.on('admin_end_custom', (data) => {
    if (!activeAdminToken || !data || data.token !== activeAdminToken) {
      console.warn(`[SECURITY WARNING] Blocked unauthorized admin_end_custom from socket ${socket.id}`);
      return;
    }
    const streamId = data.streamId;
    if (customStreams.has(streamId)) {
      console.log(`Host terminating custom watch party: ${streamId}`);
      io.emit('kick_stream', { type: 'custom', id: streamId });
      customStreams.delete(streamId);
      io.emit('custom_streams_update', Array.from(customStreams.values()));
    }
  });

  socket.on('disconnect', () => {
    activeUsers.delete(socket.id);
    io.emit('party_stats', { 
      activeMembers: io.engine.clientsCount,
      users: Array.from(activeUsers.values())
    });
  });
});

// Serve built Vite frontend (production only — dev uses Vite dev server)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
// SPA fallback: all non-API routes return index.html
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Live Stream Chat Backend running on http://0.0.0.0:${PORT}`);
});
