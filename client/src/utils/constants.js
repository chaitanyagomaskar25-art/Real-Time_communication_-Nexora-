export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export const STORAGE_KEYS = {
  TOKEN: 'connectsphere_token',
  USER: 'connectsphere_user'
};

// Default demo user credentials shared across Login & Register autofill
export const DEMO_USER = {
  fullName: 'Alex Johnson',
  username: 'alex_johnson',
  email: 'alex@example.com',
  password: 'Password123!'
};

export const DEMO_CREDENTIALS_STORAGE_KEY = 'nexora_demo_credentials';

// WebRTC ICE STUN and TURN Servers configuration
// STUN (Session Traversal Utilities for NAT): discovers public IP / port for NAT traversal.
// TURN (Traversal Using Relays around NAT): relays encrypted media when direct P2P connection fails (e.g., symmetric NAT / restrictive enterprise firewalls).
export const ICE_SERVERS = {
  iceServers: [
    // Primary Google Public STUN Servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Configurable TURN relay server fallback via environment variables
    ...(import.meta.env.VITE_TURN_URL
      ? [
          {
            urls: import.meta.env.VITE_TURN_URL,
            username: import.meta.env.VITE_TURN_USERNAME || '',
            credential: import.meta.env.VITE_TURN_CREDENTIAL || ''
          }
        ]
      : [])
  ],
  iceCandidatePoolSize: 10
};

// Curated emoji library for interactive emoji picker panels & reaction palette
export const EMOJI_CATEGORIES = [
  {
    name: 'Frequent',
    emojis: ['👍', '❤️', '🔥', '👏', '🎉', '🚀', '✨', '🙌', '💯', '🙏', '👀', '😍']
  },
  {
    name: 'Smileys & Faces',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😋', '😜', '🤪',
      '😎', '🤩', '🥳', '😏', '🤔', '🤫', '🤭', '😴', '🤤', '😷',
      '🤯', '🥶', '🥵', '😳', '🥺', '😭', '😤', '😡', '🤬', '💀'
    ]
  },
  {
    name: 'Gestures & People',
    emojis: [
      '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '✌️', '🤞', '🤟',
      '🤘', '🤙', '👋', '✋', '🖐️', '👌', '🤏', '✍️', '🙏', '💪',
      '👀', '🧠', '👑', '🦸', '🧙', '🕺', '💃', '🏃', '🙋', '🙆'
    ]
  },
  {
    name: 'Hearts & Symbols',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🔥', '✨',
      '⚡', '🌟', '⭐', '💥', '💯', '💢', '💨', '💫', '🎉', '🎊'
    ]
  },
  {
    name: 'Work, Tech & Objects',
    emojis: [
      '💻', '🖥️', '📱', '⌨️', '🖱️', '🔋', '💡', '⏰', '📅', '📝',
      '📊', '📈', '📌', '📎', '🔒', '🔑', '☕', '🍕', '🍻', '🎯',
      '🏆', '🥇', '🚀', '🛠️', '⚙️', '🔍', '📦', '🎁', '🔔', '📢'
    ]
  }
];


