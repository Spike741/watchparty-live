import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { io, Socket } from 'socket.io-client';
import { 
  Settings, 
  Send, 
  Users, 
  Maximize, 
  Minimize, 
  MessageSquare, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause,
  AlertCircle,
  X,
  ArrowLeft,
  ArrowDown
} from 'lucide-react';
import { NicknameModal } from './components/NicknameModal';
import { SettingsModal } from './components/SettingsModal';
import { LobbyView, getFlagUrl, getEventIcon } from './components/LobbyView';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { InteractiveBackground } from './components/InteractiveBackground';

// Dynamic host detection for local/LAN testing to prevent manual settings overhead
// NOTE: In Capacitor Android APK, window.location.hostname is EMPTY STRING ""
// because the app loads from file:///android_asset/public/index.html
const EMOJI_CATEGORIES = [
  {
    name: 'Smileys & Emotion',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🤫', '🤥', '😶', '🫥', '😐', '😑', '😬', '🫨', '🫠', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '😵‍💫', '🫗', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕']
  },
  {
    name: 'Gestures & People',
    emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄']
  },
  {
    name: 'Sports & Matches',
    emojis: ['⚽', '🥅', '🟨', '🟥', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎸', '🎻', '🎷', '🎺', '🪗', '🎮', '🕹️', '🎰', '🎲', '🎳', '🎯', '🏈', '🏀', '🥎', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '⛳', '🪁', '🏹', '🎣', '🤿', '🩱', '🩲', '🩳', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂']
  },
  {
    name: 'Symbols & Flags',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💖', '🌟', '✨', '⚡', '💥', '🔥', '🌈', '☀️', '☁️', '❄️', '💤', '🎵', '🎶', '🔔', '📣', '📢', '💭', '💬', '🗯️', 'ℹ️', '⚠️', '🚫', '✅', '❌', '💯', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🇮🇳', '🇧🇷', '🇯🇵', '🇬🇧', '🇺🇸', '🇪🇸', '🇫🇷', '🇩🇪', '🇮🇹', '🇦🇷', '🇵🇹']
  }
];

const isNativeApp = () => {
  const hostname = window.location.hostname;
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isCapacitorGlobal = !!(window as any).Capacitor;
  const isFileProtocol = window.location.protocol === 'file:';
  const isEmptyOrLocalHost = !hostname || hostname === 'localhost' || hostname === '127.0.0.1';
  return isCapacitorGlobal || isFileProtocol || (isAndroid && isEmptyOrLocalHost);
};

const getInitialBackendUrl = () => {
  const hostname = window.location.hostname;
  
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }

  // In production web build, frontend & backend are served from the same Express process.
  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && !isNativeApp()) {
    return window.location.origin;
  }

  const saved = localStorage.getItem('watchparty_backend_url');
  if (saved) {
    if (saved.includes('92.4.73.113')) {
      localStorage.removeItem('watchparty_backend_url');
    } else {
      return saved;
    }
  }

  return 'http://localhost:5000';
};

const getInitialHlsUrl = () => {
  if (import.meta.env.VITE_HLS_URL) {
    return import.meta.env.VITE_HLS_URL;
  }
  return 'http://localhost:8888/live/party/index.m3u8';
};

const HLS_STREAM_URL = getInitialHlsUrl();

// Check router parameters on load
const getInitialView = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') === 'true') {
    const hasToken = !!sessionStorage.getItem('watchparty_admin_token');
    return hasToken ? 'admin_dashboard' : 'admin_login';
  }
  return 'lobby';
};

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

interface ChatMessage {
  id: string;
  user: string;
  text: string;
  color: string;
  timestamp: string;
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith('#')) return `rgba(139, 92, 246, ${alpha})`;
  const cleanHex = hex.replace('#', '');
  let r = 0, g = 0, b = 0;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex.charAt(0) + cleanHex.charAt(0), 16);
    g = parseInt(cleanHex.charAt(1) + cleanHex.charAt(1), 16);
    b = parseInt(cleanHex.charAt(2) + cleanHex.charAt(2), 16);
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  } else {
    return `rgba(139, 92, 246, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function App() {
  // Navigation Router
  const [currentView, setCurrentView] = useState<'lobby' | 'stream' | 'admin_login' | 'admin_dashboard'>(getInitialView());

  // Profiles & Settings
  const [nickname, setNickname] = useState<string | null>(localStorage.getItem('watchparty_nickname'));
  const [userColor, setUserColor] = useState<string>(localStorage.getItem('watchparty_color') || '#38bdf8');
  const [backendUrl, setBackendUrl] = useState<string>(getInitialBackendUrl());

  // Video Quality & Volume States
  const [volume, setVolume] = useState<number>(() => {
    const savedVolume = localStorage.getItem('watchparty_volume');
    return savedVolume ? parseFloat(savedVolume) : 1;
  });
  const [qualityLevels, setQualityLevels] = useState<{ height: number; index: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  
  // Modals state
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Theme State
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    return (localStorage.getItem('watchparty_theme') as 'system' | 'light' | 'dark') || 'system';
  });

  // Sync state indices
  const [matches, setMatches] = useState<FifaMatch[]>([]);
  const [activeFifaMatchId, setActiveFifaMatchId] = useState<string | null>(null);
  const [activeFifaStreamUrl, setActiveFifaStreamUrl] = useState<string | null>(null);
  const [customStreams, setCustomStreams] = useState<CustomStream[]>([]);

  // Invitation link parsed state
  const params = new URLSearchParams(window.location.search);
  const inviteId = params.get('streamId');
  const [invitedStreamId] = useState<string | null>(inviteId);
  const [invitedStream, setInvitedStream] = useState<{ id: string; title: string } | null>(null);

  // Active Stream state selection
  const [currentViewingMatchId, setCurrentViewingMatchId] = useState<string | null>(null);
  const [currentViewingCustomId, setCurrentViewingCustomId] = useState<string | null>(null);

  // Admin watch stream mode
  const [adminWatchingStream, setAdminWatchingStream] = useState(false);
  const [adminStreamUrl, setAdminStreamUrl] = useState<string | null>(null);
  const [broadcastAlert, setBroadcastAlert] = useState<string | null>(null);

  // Video State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [streamOffline, setStreamOffline] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);

  // Chat & Connection State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [partyMembers, setPartyMembers] = useState(1);
  const [partyUsers, setPartyUsers] = useState<{ user: string; color: string }[]>([]);
  const [viewerCount, setViewerCount] = useState(0);

  // Layout & Responsive States
  const [isLandscape, setIsLandscape] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoFitMode, setVideoFitMode] = useState<'contain' | 'cover'>('contain');
  const [showChatOverlay, setShowChatOverlay] = useState(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [showVideoControls, setShowVideoControls] = useState(true);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: string; emoji: string; x: number }[]>([]);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Force Nickname selection landing prompt if no nickname exists on first load
  useEffect(() => {
    const isEditingAdmin = currentView === 'admin_login' || currentView === 'admin_dashboard';
    if (!nickname && !isEditingAdmin) {
      setShowNicknameModal(true);
    }
  }, [nickname, currentView]);

  // Compute isDarkTheme dynamically for background particle controls
  const isDarkTheme = theme === 'dark' || (theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Apply Appearance Theme to DOM html element
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      let isDark = false;
      if (theme === 'dark') {
        isDark = true;
      } else if (theme === 'light') {
        isDark = false;
      } else {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      
      if (isDark) {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
      }
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  // Socket.io Client Setup
  useEffect(() => {
    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket server');
      setSocketConnected(true);
      // Register nickname with the server so viewers list is populated
      const storedNick = localStorage.getItem('watchparty_nickname') || 'Guest';
      const storedColor = localStorage.getItem('watchparty_color') || '#38bdf8';
      socket.emit('join_party', { user: storedNick, color: storedColor });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from socket server');
      setSocketConnected(false);
    });

    socket.on('matches_update', (data: { matches: FifaMatch[], activeFifaMatchId: string | null, activeFifaStreamUrl: string | null }) => {
      setMatches(data.matches);
      setActiveFifaMatchId(data.activeFifaMatchId);
      setActiveFifaStreamUrl(data.activeFifaStreamUrl);
    });

    socket.on('custom_streams_update', (streams: CustomStream[]) => {
      setCustomStreams(streams);
      if (invitedStreamId) {
        const found = streams.find(s => s.id === invitedStreamId);
        if (found) {
          setInvitedStream({ id: found.id, title: found.title });
        } else {
          setInvitedStream(null);
        }
      }
    });

    socket.on('custom_stream_started', (data: { streamId: string }) => {
      // For Admin dashboard redirection reference
      console.log(`Custom stream started successfully with ID: ${data.streamId}`);
    });

    socket.on('chat_history', (history: ChatMessage[]) => {
      setMessages(history);
    });

    socket.on('receive_message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      
      const textTrim = msg.text.trim();
      const emojiRegex = /^[\p{Emoji}\u200d\uFE0F\s]+$/u;
      if (emojiRegex.test(textTrim) && [...textTrim].length <= 4) {
        const id = `${Date.now()}-${Math.random()}`;
        const x = 10 + Math.random() * 80;
        setFloatingEmojis((prev) => [...prev.slice(-15), { id, emoji: textTrim, x }]);
      }
    });

    socket.on('receive_reaction', (data: { emoji: string }) => {
      triggerEmojiFlood(data.emoji);
    });

    socket.on('receive_broadcast_alert', (data: { text: string }) => {
      setBroadcastAlert(data.text);
      // Auto-dismiss the popup message after 10 seconds
      setTimeout(() => {
        setBroadcastAlert((current) => current === data.text ? null : current);
      }, 10000);
    });

    socket.on('party_stats', (stats: { activeMembers: number; users?: { user: string; color: string }[] }) => {
      setPartyMembers(stats.activeMembers);
      if (stats.users) setPartyUsers(stats.users);
    });

    socket.on('kick_stream', (data: { type: 'fifa' | 'custom', id: string }) => {
      if (data.type === 'fifa' && currentViewingMatchId === data.id) {
        alert("The live stream watch party has been terminated by the host.");
        setCurrentViewingMatchId(null);
        setCurrentView('lobby');
      } else if (data.type === 'custom' && currentViewingCustomId === data.id) {
        alert("This custom watch party has been terminated by the host.");
        setCurrentViewingCustomId(null);
        setCurrentView('lobby');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [backendUrl, currentViewingMatchId, currentViewingCustomId, invitedStreamId]);

  // MediaMTX Viewer Count polled via backend proxy to solve browser CORS issues
  useEffect(() => {
    const fetchViewerStats = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/stats`);
        if (!response.ok) throw new Error('API offline');
        const data = await response.json();
        setViewerCount(data.readersCount ?? 0);
        setStreamOffline(false);
      } catch (err) {
        console.warn('Unable to query viewer stats via backend proxy:', err);
      }
    };

    fetchViewerStats();
    const interval = setInterval(fetchViewerStats, 5000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  // Resolves currently viewed streams
  const activeMatchObj = matches.find(m => m.id === currentViewingMatchId);
  const activeCustomObj = customStreams.find(s => s.id === currentViewingCustomId);

  const isLiveScoreOnlyMode = !adminWatchingStream && activeMatchObj && activeMatchObj.status === 'live_score';
  const activeStreamSource = adminWatchingStream
    ? (adminStreamUrl || HLS_STREAM_URL)
    : (activeCustomObj ? activeCustomObj.hlsUrl : (activeFifaStreamUrl || HLS_STREAM_URL));

  // HLS.js Player Engine Loader (Only active when in stream view and not in Live Score only mode)
  useEffect(() => {
    if (currentView !== 'stream' || isLiveScoreOnlyMode) return;

    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    setVideoLoading(true);

    const initPlayer = () => {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          manifestLoadingMaxRetry: 5,
          manifestLoadingRetryDelay: 2000
        });
        hlsRef.current = hls;

        hls.loadSource(activeStreamSource);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setVideoLoading(false);
          setStreamOffline(false);

          // Apply volume and muted state
          video.volume = isMuted ? 0 : volume;
          video.muted = isMuted;

          // Fetch parsed quality levels
          const levels = hls?.levels.map((lvl, index) => ({
            height: lvl.height,
            index: index
          })) || [];
          const sortedLevels = [...levels].sort((a, b) => b.height - a.height);
          setQualityLevels(sortedLevels);
          setCurrentQuality(-1); // Default to Auto

          video.play()
            .then(() => setIsPlaying(true))
            .catch((err) => {
              console.warn('Autoplay blocked:', err);
              setIsPlaying(false);
            });
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn('Fatal network error, attempting recovery...');
                hls?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn('Fatal media error, attempting recovery...');
                hls?.recoverMediaError();
                break;
              default:
                console.error('Fatal HLS playback error:', data);
                setStreamOffline(true);
                setVideoLoading(false);
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = activeStreamSource;
        
        video.addEventListener('loadedmetadata', () => {
          setVideoLoading(false);
          setStreamOffline(false);

          // Apply volume and muted state
          video.volume = isMuted ? 0 : volume;
          video.muted = isMuted;

          video.play()
            .then(() => setIsPlaying(true))
            .catch((err) => {
              console.warn('Autoplay blocked:', err);
              setIsPlaying(false);
            });
        });

        video.addEventListener('error', (err) => {
          console.error('Native video stream error:', err);
          setStreamOffline(true);
          setVideoLoading(false);
        });
      }
    };

    initPlayer();

    return () => {
      if (hls) {
        hls.destroy();
      }
      hlsRef.current = null;
      setQualityLevels([]);
      setCurrentQuality(-1);
      setShowQualityMenu(false);
    };
  }, [streamOffline, currentView, activeStreamSource, isLiveScoreOnlyMode]);

  // Layout and Fullscreen / Orientation Observers
  useEffect(() => {
    const handleLayoutResize = () => {
      // Use aspect ratio > 1.25 to detect landscape, preventing portrait soft keyboard resizes from triggering it
      const landscape = (window.innerWidth / window.innerHeight) > 1.25;
      setIsLandscape(landscape);

      // On native Android (WebView), document.fullscreenElement is always null.
      // Track fullscreen from the isFullscreen state directly (set by toggleFullscreen).
      // On browser, sync from the real fullscreenElement.
      const isNative = !!(window as any).AndroidBridge;
      if (!isNative) {
        const fullscreen = !!document.fullscreenElement;
        setIsFullscreen(fullscreen);

        if (!fullscreen) {
          if (screen.orientation && screen.orientation.unlock) {
            try { screen.orientation.unlock(); } catch (e) { console.warn(e); }
          }
        }
      }
    };

    window.addEventListener('resize', handleLayoutResize);
    document.addEventListener('fullscreenchange', handleLayoutResize);

    handleLayoutResize();

    return () => {
      window.removeEventListener('resize', handleLayoutResize);
      document.removeEventListener('fullscreenchange', handleLayoutResize);
    };
  }, []);


  // Keyboard Layout Resizer using VisualViewport API (Safe Areas)
  useEffect(() => {
    if (!window.visualViewport) return;

    const handleKeyboardResize = () => {
      const height = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--visual-height', `${height}px`);
      setTimeout(scrollToBottom, 80);
    };

    window.visualViewport.addEventListener('resize', handleKeyboardResize);
    window.visualViewport.addEventListener('scroll', handleKeyboardResize);
    
    handleKeyboardResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleKeyboardResize);
      window.visualViewport?.removeEventListener('scroll', handleKeyboardResize);
    };
  }, []);

  // Auto scroll handling in Live Chat Box
  useEffect(() => {
    if (!showScrollBottomBtn) {
      scrollToBottom();
    }
  }, [messages, showScrollBottomBtn]);

  const scrollToBottom = () => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  };

  const handleChatScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    setShowScrollBottomBtn(!isNearBottom);
  };

  // Video Player Controls HUD (Fade out timer)
  const resetControlsTimeout = () => {
    setShowVideoControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowVideoControls(false);
      }
    }, 3000);
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  // Screen Wake Lock API implementation to prevent mobile screen sleep during playback
  useEffect(() => {
    if (currentView !== 'stream' || isLiveScoreOnlyMode) return;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('Screen Wake Lock is active!');
        } catch (err: any) {
          console.warn(`Wake lock request failed: ${err.message}`);
        }
      } else {
        console.warn('Screen Wake Lock is unsupported by this browser.');
      }
    };

    if (isPlaying && !streamOffline) {
      requestWakeLock();
    } else {
      if (wakeLockRef.current) {
        wakeLockRef.current.release()
          .then(() => {
            wakeLockRef.current = null;
            console.log('Screen Wake Lock released.');
          })
          .catch((err: any) => console.warn(err));
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPlaying && !streamOffline) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch((err: any) => console.warn(err));
      }
    };
  }, [isPlaying, streamOffline, currentView, isLiveScoreOnlyMode]);

  // Video Handlers
  const handlePlayPause = () => {
    resetControlsTimeout();
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleMuteToggle = () => {
    resetControlsTimeout();
    const video = videoRef.current;
    if (!video) return;

    const newMuted = !isMuted;
    video.muted = newMuted;
    setIsMuted(newMuted);

    if (!newMuted && volume === 0) {
      video.volume = 0.5;
      setVolume(0.5);
      localStorage.setItem('watchparty_volume', '0.5');
    } else {
      video.volume = newMuted ? 0 : volume;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    resetControlsTimeout();
    const val = parseFloat(e.target.value);
    setVolume(val);
    localStorage.setItem('watchparty_volume', val.toString());
    const video = videoRef.current;
    if (video) {
      video.volume = val;
      if (val === 0) {
        video.muted = true;
        setIsMuted(true);
      } else {
        video.muted = false;
        setIsMuted(false);
      }
    }
  };

  const handleQualityChange = (levelIndex: number) => {
    setCurrentQuality(levelIndex);
    if (hlsRef.current) {
      if (levelIndex === -1) {
        hlsRef.current.currentLevel = -1; // Auto
      } else if (levelIndex < -1) {
        // Find closest height in actual levels
        const targetHeight = Math.abs(levelIndex);
        if (qualityLevels.length > 0) {
          const closest = qualityLevels.reduce((prev, curr) => {
            return Math.abs(curr.height - targetHeight) < Math.abs(prev.height - targetHeight) ? curr : prev;
          }, qualityLevels[0]);
          hlsRef.current.currentLevel = closest.index;
        }
      } else {
        hlsRef.current.currentLevel = levelIndex;
      }
    }
    setShowQualityMenu(false);
  };

  const toggleFullscreen = async () => {
    resetControlsTimeout();

    const isNative = !!(window as any).AndroidBridge;

    if (isNative) {
      // === NATIVE ANDROID PATH (Capacitor WebView) ===
      // document.requestFullscreen() does NOT work in WebView.
      // We use our native bridge to force landscape + immersive mode.
      try {
        if (!isFullscreen) {
          (window as any).AndroidBridge.setFullscreenLandscape(true);
          setIsFullscreen(true);
        } else {
          (window as any).AndroidBridge.setFullscreenLandscape(false);
          setIsFullscreen(false);
        }
      } catch (e) {
        console.warn('AndroidBridge.setFullscreenLandscape failed:', e);
      }
      return;
    }

    // === BROWSER PATH (Web / PWA) ===
    const container = mainContainerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        }

        // Lock to landscape for web browser
        if (screen.orientation && (screen.orientation as any).lock) {
          await (screen.orientation as any).lock('landscape').catch((err: any) => {
            console.warn('Web orientation lock failed/unsupported:', err);
          });
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }

        if (screen.orientation && screen.orientation.unlock) {
          try {
            screen.orientation.unlock();
          } catch (e) {
            console.warn(e);
          }
        }
      }
    } catch (err) {
      console.warn('Browser fullscreen failed:', err);
      setIsFullscreen(!isFullscreen);
    }
  };


  // Send message through socket backend
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !nickname || !socketRef.current) return;

    socketRef.current.emit('send_message', {
      user: nickname,
      text: inputText.trim(),
      color: userColor,
    });

    setInputText('');
    setShowScrollBottomBtn(false);
    setTimeout(scrollToBottom, 50);
  };


  const triggerEmojiFlood = (emoji: string) => {
    const burstCount = 6;
    const newEmojis = Array.from({ length: burstCount }).map((_, i) => ({
      id: `${Date.now()}-${Math.random()}-${i}`,
      emoji,
      x: 10 + Math.random() * 80,
    }));
    setFloatingEmojis((prev) => [...prev.slice(-20), ...newEmojis]);
  };

  const handleSendReaction = (emoji: string) => {
    triggerEmojiFlood(emoji);
    if (socketRef.current) {
      socketRef.current.emit('send_reaction', { emoji });
    }
  };

  // Profile overrides
  const handleJoinParty = (name: string, color: string) => {
    setNickname(name);
    setUserColor(color);
    setShowNicknameModal(false);
    localStorage.setItem('watchparty_nickname', name);
    localStorage.setItem('watchparty_color', color);
    if (socketRef.current) {
      socketRef.current.emit('join_party', { user: name, color });
    }
  };

  const handleSaveSettings = (url: string) => {
    setBackendUrl(url);
  };

  const handleThemeChange = (newTheme: 'system' | 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('watchparty_theme', newTheme);
  };

  const handleChangeNicknameRequest = () => {
    setShowSettingsModal(false);
    setShowNicknameModal(true);
  };

  // Lobby Trigger Joins
  const handleJoinFifaMatch = (matchId: string) => {
    setCurrentViewingMatchId(matchId);
    setCurrentViewingCustomId(null);
    setCurrentView('stream');
  };

  const handleJoinCustomMatch = (streamId: string) => {
    setCurrentViewingCustomId(streamId);
    setCurrentViewingMatchId(null);
    // Remove query parameter on successful join to clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
    setInvitedStream(null);
    setCurrentView('stream');
  };

  // Admin triggers
  const handleStartFifaBroadcast = (matchId: string, streamUrl: string) => {
    const token = sessionStorage.getItem('watchparty_admin_token') || '';
    if (socketRef.current) {
      socketRef.current.emit('admin_start_stream', { matchId, streamUrl, token });
    }
  };

  const handleEndFifaBroadcast = () => {
    const token = sessionStorage.getItem('watchparty_admin_token') || '';
    if (socketRef.current) {
      socketRef.current.emit('admin_end_stream', { token });
    }
  };

  const handleStartCustomBroadcast = (title: string, hlsUrl: string) => {
    const token = sessionStorage.getItem('watchparty_admin_token') || '';
    if (socketRef.current) {
      socketRef.current.emit('admin_start_custom', { title, hlsUrl, token });
    }
  };

  const handleEndCustomBroadcast = (streamId: string) => {
    const token = sessionStorage.getItem('watchparty_admin_token') || '';
    if (socketRef.current) {
      socketRef.current.emit('admin_end_custom', { streamId, token });
    }
  };

  const handleAddMatchEvent = (matchId: string, type: string, team: string, player: string, minute: number) => {
    const token = sessionStorage.getItem('watchparty_admin_token') || '';
    if (socketRef.current) {
      socketRef.current.emit('admin_add_event', { matchId, type, team, player, minute, token });
    }
  };

  const handleDeleteMatchEvent = (matchId: string, eventId: string) => {
    const token = sessionStorage.getItem('watchparty_admin_token') || '';
    if (socketRef.current) {
      socketRef.current.emit('admin_delete_event', { matchId, eventId, token });
    }
  };

  // Unify Side-by-side flex layout applied to all landscape devices
  const showSideBySide = isLandscape;

  // Render Admin logins
  if (currentView === 'admin_login') {
    return (
      <>
        <InteractiveBackground isDark={isDarkTheme} />
        <AdminLogin 
          backendUrl={backendUrl}
          onLogin={(token) => {
            sessionStorage.setItem('watchparty_admin_token', token);
            setCurrentView('admin_dashboard');
          }} 
        />
      </>
    );
  }

  // Render Admin Dashboard
  if (currentView === 'admin_dashboard') {
    return (
      <>
        <InteractiveBackground isDark={isDarkTheme} />
        <AdminDashboard
          defaultHlsUrl={HLS_STREAM_URL}
          matches={matches}
          activeFifaMatchId={activeFifaMatchId}
          customStreams={customStreams}
          onStartFifaStream={handleStartFifaBroadcast}
          onEndFifaStream={handleEndFifaBroadcast}
          onStartCustomStream={handleStartCustomBroadcast}
          onEndCustomStream={handleEndCustomBroadcast}
          onAddMatchEvent={handleAddMatchEvent}
          onDeleteMatchEvent={handleDeleteMatchEvent}
          liveViewerCount={partyMembers}
          liveUsers={partyUsers}
          onWatchStream={(url: string) => {
            setAdminWatchingStream(true);
            setAdminStreamUrl(url);
            setCurrentViewingMatchId(null);
            setCurrentViewingCustomId(null);
            setCurrentView('stream');
          }}
          onSendBroadcastAlert={(text) => {
            const token = sessionStorage.getItem('watchparty_admin_token') || '';
            if (socketRef.current) {
              socketRef.current.emit('send_broadcast_alert', { text, token });
            }
          }}
          onLogout={async () => {
            const token = sessionStorage.getItem('watchparty_admin_token');
            try {
              await fetch(`${backendUrl}/api/admin/logout`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
              });
            } catch (e) {
              console.warn('Admin logout API call failed:', e);
            }
            sessionStorage.removeItem('watchparty_admin_token');
            window.history.replaceState({}, document.title, window.location.pathname);
            setCurrentView('lobby');
          }}
        />
      </>
    );
  }

  // Render standard User Lobby Grid
  if (currentView === 'lobby') {
    return (
      <>
        <InteractiveBackground isDark={isDarkTheme} />
        <LobbyView
          matches={matches}
          nickname={nickname || 'Guest'}
          userColor={userColor}
          onChangeNickname={handleChangeNicknameRequest}
          onJoinFifaStream={handleJoinFifaMatch}
          invitedStream={invitedStream}
          onJoinCustomStream={handleJoinCustomMatch}
          viewerCount={viewerCount}
          partyMembers={partyMembers}
          socketConnected={socketConnected}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
        {showNicknameModal && <NicknameModal onJoin={handleJoinParty} />}
        {showSettingsModal && (
          <SettingsModal 
            currentUrl={backendUrl}
            defaultUrl={getInitialBackendUrl()}
            onSave={handleSaveSettings}
            onClose={() => setShowSettingsModal(false)}
            currentNickname={nickname || 'Anonymous'}
            onChangeNickname={handleChangeNicknameRequest}
            theme={theme}
            onThemeChange={handleThemeChange}
          />
        )}
      </>
    );
  }

  // Else, render the Watch Party Player & Chat View
  return (
    <>
      <InteractiveBackground isDark={isDarkTheme} />
      <div 
        ref={mainContainerRef}
        className="flex flex-col w-full select-none text-[var(--text-main)] relative overflow-hidden bg-transparent"
        style={{ 
          height: 'var(--visual-height, 100dvh)',
          paddingTop: isFullscreen ? '0px' : 'env(safe-area-inset-top, 0px)',
          paddingBottom: isFullscreen ? '0px' : 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: isFullscreen ? '0px' : 'env(safe-area-inset-left, 0px)',
          paddingRight: isFullscreen ? '0px' : 'env(safe-area-inset-right, 0px)'
        }}
      >
      {/* 1. Header (Hidden in Fullscreen mode only) */}
      {!isFullscreen && (
        <header className="h-13 flex items-center justify-between px-4 flex-shrink-0 z-25 bg-transparent shadow-none">
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
            <button
              onClick={() => {
                if (adminWatchingStream) {
                  setAdminWatchingStream(false);
                  setAdminStreamUrl(null);
                  setCurrentView('admin_dashboard');
                } else {
                  setCurrentViewingMatchId(null);
                  setCurrentViewingCustomId(null);
                  setCurrentView('lobby');
                }
              }}
              className="p-1.5 hover:bg-slate-250 dark:hover:bg-slate-800 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-glass)] hover:border-violet-550/20 shadow-sm transition duration-200 flex-shrink-0 cursor-pointer"
              title={adminWatchingStream ? 'Back to Dashboard' : 'Back to Lobby'}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="bg-gradient-to-r from-violet-600 to-indigo-650 text-white text-[9px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm select-none uppercase tracking-wider animate-pulse-live flex-shrink-0 border border-violet-400/20">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
              {isLiveScoreOnlyMode ? 'SCORE' : 'LIVE'}
            </div>
            <h1 className="font-bold text-xs sm:text-sm tracking-tight text-[var(--text-main)] max-w-[80px] min-[375px]:max-w-[120px] sm:max-w-xs truncate flex-shrink-1 min-w-0">
              {activeCustomObj ? activeCustomObj.title : (activeMatchObj ? `${activeMatchObj.teamA} vs ${activeMatchObj.teamB}` : 'Watch Party')}
            </h1>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 border border-black/10 dark:border-white/10 ${socketConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 animate-pulse'}`} />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-black/5 dark:bg-white/5 px-2.5 py-1.5 rounded-full border border-[var(--border-glass)] shadow-sm flex-shrink-0 font-medium">
              <Users className="w-3.5 h-3.5 text-violet-500" />
              <span>{Math.max(viewerCount, partyMembers)}</span>
            </div>

            {/* Permanent Fullscreen Button in Header for Laptops */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 bg-black/5 dark:bg-white/5 border border-[var(--border-glass)] hover:border-violet-500/20 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)] transition duration-200 active:scale-95 flex-shrink-0 cursor-pointer shadow-sm"
              title="Toggle Fullscreen"
            >
              <Maximize className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="p-1.5 sm:p-2 bg-black/5 dark:bg-white/5 border border-[var(--border-glass)] hover:border-violet-500/20 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)] transition duration-200 active:scale-95 flex-shrink-0 cursor-pointer shadow-sm"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {/* 2. Content Layout Frame */}
      <div 
        className={`
          flex flex-grow min-h-0 relative w-full bg-slate-950 dark:bg-[#030303] dark
          ${isFullscreen ? 'h-full' : 'h-[calc(100%-56px)]'}
          ${showSideBySide ? 'flex-row' : 'flex-col'}
        `}
      >
        {/* PLAYER WRAPPER */}
        <div 
          onMouseMove={resetControlsTimeout}
          onTouchStart={resetControlsTimeout}
          className={`
            bg-black relative overflow-hidden group transition-all duration-300 ease-in-out
            ${showSideBySide 
              ? 'flex-grow h-full' 
              : 'w-full aspect-video z-10 shadow-sm border-b border-[var(--border-glass)] flex-shrink-0'
            }
          `}
        >
          {isLiveScoreOnlyMode ? (
            /* Live Scoreboard HUD overlay in place of standard video player */
            <div className="w-full h-full bg-black/45 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-text relative border-b border-[var(--border-glass)]">
              <div className="absolute top-4 left-4 bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                LIVE SCORE BOARD
              </div>
              
              {/* Big Score Header */}
              <div className="flex items-center justify-center gap-8 md:gap-12 mt-4">
                <div className="flex flex-col items-center">
                  {activeMatchObj && getFlagUrl(activeMatchObj.teamA) ? (
                    <img 
                      src={getFlagUrl(activeMatchObj.teamA) || ''} 
                      alt="" 
                      className="w-16 h-10 md:w-20 md:h-12 object-cover rounded-md shadow-lg border border-[var(--border-glass)] select-none" 
                    />
                  ) : (
                    <span className="text-4xl md:text-5xl filter drop-shadow-md select-none">⚽</span>
                  )}
                  <span className="font-extrabold text-sm md:text-base mt-3 text-[var(--text-main)]">{activeMatchObj?.teamA}</span>
                </div>
                
                <div className="flex flex-col items-center px-4">
                  <span className="text-3xl md:text-4xl font-black font-mono tracking-widest text-[var(--text-main)]">
                    {activeMatchObj?.scoreA} : {activeMatchObj?.scoreB}
                  </span>
                  <span className="text-xs text-cyan-600 dark:text-cyan-400 font-bold font-mono mt-1.5">Minute: {activeMatchObj?.elapsedMinute}'</span>
                </div>

                <div className="flex flex-col items-center">
                  {activeMatchObj && getFlagUrl(activeMatchObj.teamB) ? (
                    <img 
                      src={getFlagUrl(activeMatchObj.teamB) || ''} 
                      alt="" 
                      className="w-16 h-10 md:w-20 md:h-12 object-cover rounded-md shadow-lg border border-[var(--border-glass)] select-none" 
                    />
                  ) : (
                    <span className="text-4xl md:text-5xl filter drop-shadow-md select-none">⚽</span>
                  )}
                  <span className="font-extrabold text-sm md:text-base mt-3 text-[var(--text-main)]">{activeMatchObj?.teamB}</span>
                </div>
              </div>

              {/* Goal Scorer timeline */}
              {activeMatchObj && activeMatchObj.events.length > 0 && (
                <div className="mt-8 max-w-md w-full bg-black/10 dark:bg-black/30 border border-[var(--border-glass)] rounded-xl p-4 text-left max-h-[175px] overflow-y-auto custom-scrollbar">
                  <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider mb-3 px-0.5 text-center select-none">Match Events</p>
                  <div className="grid grid-cols-2 gap-x-4 text-xs divide-x divide-slate-250 dark:divide-slate-850 min-h-[30px]">
                    {/* Home team events */}
                    <div className="space-y-2 pr-2">
                      {activeMatchObj.events
                        .filter((ev) => ev.team === 'home' || ev.id.startsWith('home'))
                        .map((ev) => (
                          <div key={ev.id} className="flex items-center gap-1.5 text-[var(--text-main)]">
                            <span className="text-sm select-none" title={ev.type}>{getEventIcon(ev.type)}</span>
                            <span className="font-semibold truncate text-xs" title={ev.player}>{ev.player}</span>
                            <span className="text-[8px] text-[var(--text-muted)] font-bold font-mono ml-auto">{ev.minute}'</span>
                          </div>
                        ))}
                      {activeMatchObj.events.filter((ev) => ev.team === 'home' || ev.id.startsWith('home')).length === 0 && (
                        <div className="text-[10px] text-[var(--text-muted)]/50 italic text-center py-2 select-none">-</div>
                      )}
                    </div>
                    
                    {/* Away team events */}
                    <div className="space-y-2 pl-4">
                      {activeMatchObj.events
                        .filter((ev) => ev.team === 'away' || ev.id.startsWith('away'))
                        .map((ev) => (
                          <div key={ev.id} className="flex items-center gap-1.5 text-[var(--text-main)]">
                            <span className="text-sm select-none" title={ev.type}>{getEventIcon(ev.type)}</span>
                            <span className="font-semibold truncate text-xs" title={ev.player}>{ev.player}</span>
                            <span className="text-[8px] text-[var(--text-muted)] font-bold font-mono ml-auto">{ev.minute}'</span>
                          </div>
                        ))}
                      {activeMatchObj.events.filter((ev) => ev.team === 'away' || ev.id.startsWith('away')).length === 0 && (
                        <div className="text-[10px] text-[var(--text-muted)]/50 italic text-center py-2 select-none">-</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-[var(--text-muted)] mt-6 max-w-xs leading-relaxed">
                The video stream is offline. You are in the Live Score Chat Room.
              </p>
            </div>
          ) : (
            /* Standard Video element */
            <>
              <video
                ref={videoRef}
                playsInline
                muted={isMuted}
                className={`w-full h-full ${videoFitMode === 'contain' ? 'object-contain' : 'object-cover'} animate-in fade-in duration-305`}
                onClick={handlePlayPause}
              />

              {/* Loading Overlays */}
              {videoLoading && !streamOffline && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 z-20">
                  <div className="w-8 h-8 border-3 border-violet-500/35 border-t-violet-500 rounded-full animate-spin mb-3"></div>
                  <p className="text-xs text-gray-400">Loading party stream...</p>
                </div>
              )}

              {streamOffline && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-20 px-6 text-center">
                  <AlertCircle className="w-10 h-10 text-red-500 mb-3 animate-bounce" />
                  <h3 className="text-sm font-bold text-white">Party Stream Offline</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs">
                    The watch party stream server is unreachable. Retrying...
                  </p>
                  <button 
                    onClick={() => setStreamOffline(false)}
                    className="mt-4 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-2 px-4 rounded-xl transition cursor-pointer"
                  >
                    Force Reload
                  </button>
                </div>
              )}

              {/* CUSTOM CONTROLS OVERLAY (Overlay Hud) */}
              {(!videoLoading && !streamOffline) && (
                <div className="absolute inset-0 z-10 flex flex-col justify-between p-4 pointer-events-none">
                  
                  {/* Background gradient overlay that fades in/out */}
                  <div 
                    className={`
                      absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/55 
                      transition-opacity duration-300 -z-10
                      ${showVideoControls ? 'opacity-100' : 'opacity-0'}
                    `}
                  />

                  {/* Overlay Top Bar */}
                  {isFullscreen && (
                    <div 
                      className={`
                        flex items-center justify-between transition-all duration-300 font-sans
                        bg-black/50 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 mx-2 mt-2 shadow-lg pointer-events-auto
                        ${showVideoControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}
                      `}
                    >
                      {/* Left side: LIVE indicator and title */}
                      <div className="flex items-center gap-2">
                        <span className="bg-gradient-to-r from-violet-600 to-indigo-650 text-[9px] font-extrabold px-2 py-0.5 rounded-lg tracking-wide animate-pulse text-white select-none border border-violet-400/20 shadow-sm">LIVE</span>
                        <span className="text-[11px] text-white font-medium truncate max-w-[200px]">
                          Watch Party Broadcast
                        </span>
                      </div>

                      {/* Right side: Viewers and Settings button */}
                      <div className="flex items-center gap-2">
                        {/* Viewers count badge */}
                        <div className="flex items-center gap-1 text-[10px] text-white/95 bg-white/10 px-2 py-1 rounded-lg border border-white/10 shadow-sm font-semibold">
                          <Users className="w-3 h-3 text-violet-400" />
                          <span>{Math.max(viewerCount, partyMembers)}</span>
                        </div>

                        {/* Settings button */}
                        <button
                          onClick={() => setShowSettingsModal(true)}
                          className="p-1 hover:bg-white/10 rounded-lg text-white transition active:scale-95 cursor-pointer"
                          title="Configure Settings"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Center Play Button Overlay */}
                  <div 
                    className={`
                      flex items-center justify-center transition-opacity duration-300 pointer-events-auto
                      ${showVideoControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                    `}
                  >
                    <button 
                      onClick={handlePlayPause}
                      className="w-11 h-11 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/85 border border-white/10 active:scale-95 transition cursor-pointer"
                    >
                      {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white fill-white ml-0.5" />}
                    </button>
                  </div>

                  {/* Bottom Control Bar */}
                  <div 
                    className={`
                      flex items-center justify-between pointer-events-auto transition-all duration-300 font-sans
                      bg-black/50 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 mx-2 mb-2 shadow-lg
                      ${showVideoControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}
                    `}
                  >
                    <div className="flex items-center gap-2.5">
                      <button 
                        onClick={handleMuteToggle}
                        className="p-1 text-white hover:text-violet-400 transition active:scale-90 cursor-pointer"
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      
                      {/* Volume Adjuster Slider */}
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-violet-500 transition"
                      />
                      
                      <span className="text-[10px] text-gray-300 font-semibold select-none">LIVE</span>
                    </div>

                    <div className="flex items-center gap-2 px-1">
                      {/* Live chat toggle */}
                      <button 
                        onClick={() => setShowChatOverlay(!showChatOverlay)}
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${showChatOverlay ? 'bg-gradient-to-r from-violet-600 to-indigo-600 border-transparent text-white' : 'bg-white/10 border-white/10 text-gray-300 hover:text-white'}`}
                        title={showChatOverlay ? "Hide Live Chat" : "Show Live Chat"}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>

                      {/* Video Quality / Resolution Selector */}
                      <div className="relative pointer-events-auto">
                        <button 
                          onClick={() => setShowQualityMenu(!showQualityMenu)}
                          className="px-2 py-1 text-[9px] font-extrabold text-white border border-white/10 bg-white/10 hover:bg-white/20 rounded-lg transition active:scale-95 flex items-center justify-center gap-1 uppercase tracking-wider cursor-pointer"
                          title="Change Streaming Resolution"
                        >
                          <span>Resolution: {currentQuality === -1 ? 'Auto' : 
                            (currentQuality < -1 ? `${Math.abs(currentQuality)}p` : 
                             `${qualityLevels.find(q => q.index === currentQuality)?.height || 'Auto'}p`
                            )
                          }</span>
                        </button>
                        
                        {showQualityMenu && (
                          <div className="absolute bottom-9 right-0 bg-black/95 border border-white/10 rounded-xl py-1 w-28 text-xs z-50 shadow-2xl max-h-48 overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-2 duration-150">
                            <button
                              type="button"
                              onClick={() => handleQualityChange(-1)}
                              className={`w-full text-left px-3 py-1.5 hover:bg-white/10 font-semibold ${currentQuality === -1 ? 'text-violet-400 font-bold' : 'text-gray-300'}`}
                            >
                              Auto
                            </button>
                            {[1080, 720, 480, 360].map((res) => {
                              const menuIndex = -res;
                              const isSelected = currentQuality === menuIndex || 
                                (qualityLevels.length > 0 && currentQuality !== -1 && 
                                 qualityLevels.find(q => q.index === currentQuality)?.height === res
                                );
                              return (
                                <button
                                  key={res}
                                  type="button"
                                  onClick={() => handleQualityChange(menuIndex)}
                                  className={`w-full text-left px-3 py-1.5 hover:bg-white/10 font-semibold ${isSelected ? 'text-violet-400 font-bold' : 'text-gray-300'}`}
                                >
                                  {res}p
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => setVideoFitMode(prev => prev === 'contain' ? 'cover' : 'contain')}
                        className="px-2 py-1 text-[9px] font-extrabold text-white border border-white/10 bg-white/10 hover:bg-white/20 rounded-lg transition active:scale-95 flex items-center justify-center gap-1 uppercase tracking-wider cursor-pointer"
                        title={videoFitMode === 'contain' ? "Crop/Fill Screen" : "Fit to Screen"}
                      >
                        {videoFitMode === 'contain' ? 'FILL' : 'FIT'}
                      </button>

                      <button 
                        onClick={toggleFullscreen}
                        className="p-1 text-white hover:text-violet-400 transition active:scale-95 cursor-pointer"
                      >
                        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Floating Emojis Layer */}
          <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none z-50 overflow-hidden">
            {floatingEmojis.map((item) => (
              <span
                key={item.id}
                className="absolute bottom-4 text-3xl animate-float-emoji select-none"
                style={{ left: `${item.x}%` }}
              >
                {item.emoji}
              </span>
            ))}
          </div>

          {/* Admin Broadcast Alert Popup Toast */}
          {broadcastAlert && (
            <div className="absolute top-16 left-4 z-[60] max-w-[280px] bg-violet-600/95 dark:bg-violet-700/95 backdrop-blur-md border border-violet-500 text-white rounded-xl shadow-2xl p-3 flex gap-2.5 items-start animate-in slide-in-from-left-4 fade-in duration-300 pointer-events-auto">
              <AlertCircle className="w-5 h-5 text-white/95 flex-shrink-0 mt-0.5" />
              <div className="flex-grow min-w-0">
                <p className="text-[9px] text-white/70 font-bold uppercase tracking-wider select-none">Announce Alert</p>
                <p className="text-xs font-semibold leading-normal break-words mt-0.5">{broadcastAlert}</p>
              </div>
              <button 
                onClick={() => setBroadcastAlert(null)}
                className="p-0.5 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition flex-shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* CHAT CONTAINER (Resizes player dynamically in landscape, floats in both) */}
        <div 
          className={`
            transition-all duration-300 ease-in-out flex flex-col overflow-hidden flex-shrink-0
            ${showSideBySide
              ? `${
                  showChatOverlay 
                    ? 'w-72 md:w-80 h-full p-3 pr-4 pointer-events-auto opacity-100' 
                    : 'w-0 h-full p-0 pointer-events-none opacity-0'
                }`
              : `mx-4 mb-4 mt-2 rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-glass)] dark:bg-black/45 backdrop-blur-xl shadow-lg ${
                  showChatOverlay 
                    ? 'opacity-100 scale-100 flex-grow h-0 min-h-0 pointer-events-auto' 
                    : 'opacity-0 scale-95 pointer-events-none h-0 flex-grow-0 m-0 border-0 py-0'
                }`
            }
          `}
        >
          {/* Internal card wrapper for floating look in landscape, inherits directly in portrait */}
          <div className={`flex flex-col h-full w-full overflow-hidden ${showSideBySide ? 'glass-panel rounded-2xl border border-white/10 shadow-xl' : ''}`}>
            {/* Live Chat Sub-header */}
            <div className="h-11 border-b border-[var(--border-glass)] flex items-center justify-between px-4 flex-shrink-0 bg-transparent text-[var(--text-main)]">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-main)]">Live Chat</span>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider bg-black/5 dark:bg-white/5 border border-[var(--border-glass)] px-2.5 py-0.5 rounded-full select-none">WATCH PARTY</span>
              <button
                onClick={() => setShowChatOverlay(false)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition cursor-pointer"
                title="Hide Live Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat message display area */}
          <div 
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="flex-grow min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-3 bg-transparent flex flex-col"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-violet-500/10 to-indigo-500/10 border border-violet-500/20 flex items-center justify-center mb-3 animate-pulse shadow-[0_4px_12px_rgba(99,102,241,0.05)]">
                  <MessageSquare className="w-5 h-5 text-violet-500" />
                </div>
                <div className="bg-black/5 dark:bg-white/5 border border-[var(--border-glass)] rounded-2xl p-4 shadow-sm max-w-[200px]">
                  <p className="text-xs font-bold text-[var(--text-main)]">Live Watch Party</p>
                  <p className="text-[9px] text-[var(--text-muted)] mt-1 leading-relaxed">
                    Say hello to other party members and share live reactions!
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.user === nickname;
                const initial = msg.user ? msg.user.charAt(0).toUpperCase() : '?';
                return (
                  <div 
                    key={msg.id}
                    className={`flex gap-2 w-full ${isMe ? 'justify-end' : 'justify-start'} items-end animate-in fade-in slide-in-from-bottom-1 duration-150`}
                  >
                    {/* Circle Avatar (only for others) */}
                    {!isMe && (
                      <div 
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm select-none flex-shrink-0"
                        style={{ backgroundColor: msg.color || '#8b5cf6' }}
                      >
                        {initial}
                      </div>
                    )}

                    <div 
                      className={`
                        max-w-[78%] rounded-2xl px-3.5 py-2 flex flex-col relative border shadow-[0_2px_8px_rgba(0,0,0,0.02)]
                        ${isMe ? 'rounded-tr-none' : 'rounded-tl-none'}
                      `}
                      style={{
                        backgroundColor: hexToRgba(msg.color, 0.14),
                        borderColor: hexToRgba(msg.color, 0.22)
                      }}
                    >
                      {/* Name tag (only for others) */}
                      {!isMe && (
                        <span 
                          className="text-[9px] font-extrabold mb-0.5 select-none" 
                          style={{ color: msg.color }}
                        >
                          {msg.user}
                        </span>
                      )}
                      
                      {/* Message text */}
                      <span className="text-xs text-[var(--text-main)] break-words select-text font-normal leading-snug">
                        {msg.text}
                      </span>
                      
                      {/* Bubble bottom row: timestamp */}
                      <span className="text-[7px] text-[var(--text-muted)]/75 self-end mt-1 font-mono select-none">
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Float Scroll-to-Bottom button */}
          {showScrollBottomBtn && (
            <button 
              onClick={scrollToBottom}
              className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 active:scale-95 transition z-20 animate-bounce cursor-pointer"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>New messages</span>
            </button>
          )}

          {/* Full Emoji Picker Popover */}
          {showFullEmojiPicker && (
            <div className="absolute bottom-[115px] right-3 left-3 glass-panel rounded-2xl shadow-2xl p-3 z-30 flex flex-col max-h-[280px] min-h-[220px] transition-all duration-300 ease-in-out select-none animate-in slide-in-from-bottom-4 fade-in">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--border-glass)] pb-2 mb-2">
                <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider pl-1">Select Emoji reaction</span>
                <button 
                  type="button"
                  onClick={() => setShowFullEmojiPicker(false)}
                  className="p-1 hover:bg-slate-205 dark:hover:bg-slate-800 rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)] transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              
              {/* Categories & Emojis Scroll area */}
              <div className="flex-grow overflow-y-auto custom-scrollbar space-y-4">
                {EMOJI_CATEGORIES.map((category) => (
                  <div key={category.name} className="space-y-1.5">
                    <h4 className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider pl-1">{category.name}</h4>
                    <div className="grid grid-cols-8 gap-1.5">
                      {category.emojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            handleSendReaction(emoji);
                            setShowFullEmojiPicker(false);
                          }}
                          className="text-xl p-1 hover:bg-slate-205 dark:hover:bg-slate-800 rounded-xl transition active:scale-125 cursor-pointer flex items-center justify-center"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat Input Bar */}
          <form 
            onSubmit={handleSendMessage}
            className="p-3 border-t border-[var(--border-glass)] bg-transparent flex flex-col gap-2 flex-shrink-0 relative"
          >
            {/* Quick Emoji Reaction Row */}
            <div className="flex items-center gap-2 px-2 py-1 bg-black/5 dark:bg-white/5 rounded-xl border border-[var(--border-glass)] overflow-x-auto whitespace-nowrap scrollbar-none flex-shrink-0">
              <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider pl-1 select-none flex-shrink-0">Reactions:</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {['⚽', '😢', '❤️', '😊', '🤨', '🟨', '🟥'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendReaction(emoji)}
                    className="text-sm p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg hover:-translate-y-0.5 active:scale-125 transition duration-150 cursor-pointer flex-shrink-0"
                  >
                    {emoji}
                  </button>
                ))}
                
                {/* Plus button to open full selector */}
                <button
                  type="button"
                  onClick={() => setShowFullEmojiPicker(!showFullEmojiPicker)}
                  className={`text-[10px] p-1.5 rounded-lg border transition duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer flex-shrink-0 ml-1 ${showFullEmojiPicker ? 'bg-gradient-to-r from-violet-600 to-indigo-650 text-white border-transparent shadow-sm' : 'bg-slate-200 dark:bg-slate-800 border-[var(--border-glass)] text-[var(--text-main)] hover:bg-slate-300 dark:hover:bg-slate-700'}`}
                  title="All Emojis"
                >
                  ➕
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={nickname ? `Chatting as ${nickname}...` : 'Select nickname to chat...'}
                disabled={!nickname}
                className="flex-grow glass-input focus:outline-none rounded-full px-4 py-2.5 text-xs placeholder-gray-500 transition"
                maxLength={200}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || !nickname}
                className="p-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white disabled:opacity-40 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-slate-800 dark:disabled:to-slate-800 disabled:text-gray-400 rounded-xl transition duration-200 active:scale-95 flex-shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>

      </div>

      {/* 3. Nickname Selection Prompt Overlay */}
      {showNicknameModal && (
        <NicknameModal onJoin={handleJoinParty} />
      )}

      {/* 4. Settings Configuration Panel */}
      {showSettingsModal && (
        <SettingsModal 
          currentUrl={backendUrl}
          defaultUrl={getInitialBackendUrl()}
          onSave={handleSaveSettings}
          onClose={() => setShowSettingsModal(false)}
          currentNickname={nickname || 'Anonymous'}
          onChangeNickname={handleChangeNicknameRequest}
          theme={theme}
          onThemeChange={handleThemeChange}
        />
      )}
    </div>
    </>
  );
}

export default App;
