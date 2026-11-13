import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User,
  Palette,
  MessageSquare,
  Bell,
  Shield,
  Volume2,
  Lock,
  LogOut,
  Check,
  Play,
  Sun,
  Moon,
  Laptop,
  Video,
  VideoOff,
  Camera,
  Mic,
  Copy,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Eye,
  KeyRound,
  FileText,
  HelpCircle,
  Smartphone
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Switch from '../components/common/Switch';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';

const DEFAULT_SETTINGS = {
  // Appearance
  fontSize: 'medium',
  reducedMotion: false,

  // Chat Customization
  enterSendsMessage: true,
  compactChat: false,
  linkPreviews: true,
  bigEmojis: true,

  // Notifications
  pushNotifications: false,
  inAppAlerts: true,
  soundAlerts: true,
  doNotDisturb: false,
  emailDigest: true,

  // Privacy
  waitingRoom: false,
  e2ee: true,
  showOnlineStatus: true,
  dmPermission: 'everyone', // 'everyone' | 'contacts'

  // Sound & Hardware
  ringtone: 'gentle-pulse',
  autoMuteMic: false,
  autoTurnOffCam: false,
  mirrorVideo: true,
  noiseCancellation: true,
  videoQuality: '1080p',
  selectedCameraId: 'default',
  selectedMicId: 'default',
  selectedAudioOutputId: 'default'
};

const NAV_ITEMS = [
  { id: 'account', label: 'Account', icon: User, desc: 'Identity & credentials' },
  { id: 'appearance', label: 'Appearance', icon: Palette, desc: 'Themes & typography' },
  { id: 'chat', label: 'Chat Customization', icon: MessageSquare, desc: 'Composer & messages' },
  { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Alerts & sounds' },
  { id: 'privacy', label: 'Privacy', icon: Shield, desc: 'Room security & status' },
  { id: 'sound', label: 'Sound & Media', icon: Volume2, desc: 'Hardware & ringtones' },
  { id: 'security', label: 'Security & Sessions', icon: Lock, desc: 'Password & devices' }
];

const Settings = () => {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Load persisted user settings
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('nexora_user_settings') || localStorage.getItem('connectsphere_user_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        // Fallback
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [activeTab, setActiveTab] = useState('account');
  const [saveToast, setSaveToast] = useState(false);
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Hardware Devices State
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const videoPreviewRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animFrameRef = useRef(null);

  // Enumerate actual connected devices
  const enumerateDevices = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
      setAudioInputDevices(devices.filter((d) => d.kind === 'audioinput'));
      setAudioOutputDevices(devices.filter((d) => d.kind === 'audiooutput'));
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    enumerateDevices();
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
    }
    return () => {
      if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
      }
      stopCameraPreview();
      stopMicTest();
    };
  }, []);

  // Update a setting and persist
  const updateSetting = (key, value) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('nexora_user_settings', JSON.stringify(updated));
      localStorage.setItem('connectsphere_user_settings', JSON.stringify(updated));
      return updated;
    });
    triggerToast();
  };

  const triggerToast = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2200);
  };

  // Hardware: Camera Preview
  const startCameraPreview = async () => {
    setCameraError('');
    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const constraints = {
        video: settings.selectedCameraId && settings.selectedCameraId !== 'default'
          ? { deviceId: { exact: settings.selectedCameraId } }
          : true,
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
      enumerateDevices();
    } catch (err) {
      setCameraError(err.message || 'Camera permission denied or device busy.');
      setIsCameraActive(false);
    }
  };

  const stopCameraPreview = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Hardware: Mic Level Analyzer
  const startMicTest = async () => {
    try {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const constraints = {
        audio: settings.selectedMicId && settings.selectedMicId !== 'default'
          ? { deviceId: { exact: settings.selectedMicId } }
          : true,
        video: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      setIsTestingMic(true);

      const updateMeter = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setMicLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch {
      setIsTestingMic(false);
    }
  };

  const stopMicTest = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      try {
        if (ctx.state !== 'closed') {
          ctx.close().catch(() => {});
        }
      } catch {
        // Ignored
      }
    }
    setIsTestingMic(false);
    setMicLevel(0);
  };

  // Sound Test Chime
  const handlePlayTestSound = () => {
    setIsTestingAudio(true);
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch {
      // AudioContext fallback
    }
    setTimeout(() => setIsTestingAudio(false), 700);
  };

  // Request Push Notification Permission
  const handlePushPermission = async (enable) => {
    if (enable && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        updateSetting('pushNotifications', true);
      } else {
        updateSetting('pushNotifications', false);
      }
    } else {
      updateSetting('pushNotifications', enable);
    }
  };

  // Logout Handler
  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    navigate('/login');
  };

  const personalRoomCode = user?.username || (user?.fullName ? user.fullName.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'my-room');
  const personalRoomUrl = `${window.location.origin}/room/${personalRoomCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(personalRoomUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-0.5 rounded-full border border-brand-200 dark:border-brand-900/50">
              Preferences
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Settings & Preferences
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Personalize your NEXORA experience, appearance, hardware devices, and account privacy.
          </p>
        </div>

        {saveToast && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-sm animate-fade-in self-start sm:self-auto">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Preferences saved</span>
          </div>
        )}
      </div>

      {/* Main Layout: Responsive Navigation + Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Settings Navigation: Horizontal scroll on mobile/tablet, sticky vertical on desktop */}
        <div className="lg:col-span-4 xl:col-span-3 bg-white dark:bg-dark-900 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-dark-750 shadow-card p-2 sm:p-3 lg:space-y-1 lg:sticky lg:top-6 overflow-hidden">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hidden lg:block">
            Settings Menu
          </div>

          <div className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl sm:rounded-2xl text-left transition cursor-pointer select-none shrink-0 lg:w-full min-h-[40px] ${
                    isActive
                      ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-md shadow-brand-500/20 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-dark-800/80 hover:text-slate-900 dark:hover:text-white bg-slate-50/50 dark:bg-dark-850/50 lg:bg-transparent'
                  }`}
                >
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold whitespace-nowrap lg:truncate leading-tight">{item.label}</div>
                    <div
                      className={`text-[10px] truncate mt-0.5 hidden lg:block ${
                        isActive ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {item.desc}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Logout Shortcut in Mobile Tab Row */}
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 bg-rose-50/80 dark:bg-rose-950/40 text-xs font-semibold shrink-0 min-h-[40px]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>

          {/* Prominent Logout Button on Desktop Navigation */}
          <div className="pt-3 mt-2 border-t border-slate-100 dark:border-dark-800 hidden lg:block">
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer text-xs font-semibold"
            >
              <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <LogOut className="w-4 h-4" />
              </div>
              <span>Log Out of NEXORA</span>
            </button>
          </div>
        </div>

        {/* Right Settings Content Area */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6 min-w-0">
          {/* ================= SECTION: ACCOUNT ================= */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              {/* Account Identity Card */}
              <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-dark-800">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-violet-600 p-0.5 shadow-md">
                      <div className="w-full h-full rounded-[14px] bg-white dark:bg-dark-900 overflow-hidden flex items-center justify-center font-extrabold text-xl text-brand-600">
                        {user?.profileImage ? (
                          <img
                            src={user.profileImage}
                            alt={user.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {user?.fullName || 'NEXORA Member'}
                        <Badge variant="primary" size="sm">@{user?.username || 'member'}</Badge>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {user?.email || 'user@nexora.io'}
                      </p>
                    </div>
                  </div>

                  <Link to="/profile">
                    <Button variant="secondary" size="sm" className="text-xs font-semibold">
                      <User className="w-3.5 h-3.5 mr-1.5" />
                      Manage Full Profile
                    </Button>
                  </Link>
                </div>

                {/* Account Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-850 border border-slate-200/80 dark:border-dark-750 space-y-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Account Status
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Active & Verified
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-850 border border-slate-200/80 dark:border-dark-750 space-y-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Tier / Subscription
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        NEXORA Professional
                      </span>
                      <Badge variant="success" size="sm">Unlimited</Badge>
                    </div>
                  </div>
                </div>

                {/* Personal Room URL Quick Share */}
                <div className="space-y-2 pt-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Your Permanent Meeting URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={personalRoomUrl}
                      className="w-full bg-slate-50 dark:bg-dark-850 border border-slate-200/90 dark:border-dark-750 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none shadow-subtle select-all"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyLink}
                      className="shrink-0 text-xs"
                    >
                      {copiedLink ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 mr-1.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      {copiedLink ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="p-6 rounded-3xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 space-y-4">
                <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Account Danger Zone</h4>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Sign out of this session
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Terminate your active authentication cookie and return to the login screen.
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowLogoutModal(true)}
                    className="text-xs shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1.5" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION: APPEARANCE ================= */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Theme Selector */}
              <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card space-y-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                    Theme Appearance
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Choose between Light, Dark, or System mode to match your desktop environment.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* System Theme */}
                  <div
                    onClick={() => setTheme('system')}
                    className={`p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                      theme === 'system'
                        ? 'border-brand-500 bg-brand-50/30 dark:bg-brand-950/40 ring-2 ring-brand-500/20 shadow-subtle'
                        : 'border-slate-200 dark:border-dark-750 bg-slate-50/50 dark:bg-dark-850 hover:border-slate-300 dark:hover:border-dark-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-violet-600 text-white flex items-center justify-center shadow-sm">
                        <Laptop className="w-5 h-5" />
                      </div>
                      {theme === 'system' && (
                        <span className="p-1 rounded-full bg-brand-600 text-white">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="mt-4">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">System Sync</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Follows your operating system preference automatically
                      </div>
                    </div>
                  </div>

                  {/* Light Theme */}
                  <div
                    onClick={() => setTheme('light')}
                    className={`p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                      theme === 'light'
                        ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-500/20 shadow-subtle'
                        : 'border-slate-200 dark:border-dark-750 bg-slate-50/50 dark:bg-dark-850 hover:border-slate-300 dark:hover:border-dark-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-white text-slate-800 flex items-center justify-center border border-slate-200 shadow-sm">
                        <Sun className="w-5 h-5 text-amber-500" />
                      </div>
                      {theme === 'light' && (
                        <span className="p-1 rounded-full bg-brand-600 text-white">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="mt-4">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Light Theme</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Crisp warm white surfaces with soft lavender accents
                      </div>
                    </div>
                  </div>

                  {/* Dark Theme */}
                  <div
                    onClick={() => setTheme('dark')}
                    className={`p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                      theme === 'dark'
                        ? 'border-brand-500 bg-brand-950/40 ring-2 ring-brand-500/20 shadow-subtle'
                        : 'border-slate-200 dark:border-dark-750 bg-slate-50/50 dark:bg-dark-850 hover:border-slate-300 dark:hover:border-dark-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-dark-900 text-white flex items-center justify-center border border-dark-750 shadow-sm">
                        <Moon className="w-5 h-5 text-brand-400" />
                      </div>
                      {theme === 'dark' && (
                        <span className="p-1 rounded-full bg-brand-600 text-white">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="mt-4">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Dark Theme</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Deep charcoal surfaces with muted violet undertones
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Typography & Motion Preferences */}
              <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card space-y-5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Visual Scaling & Accessibility
                </h3>

                <div className="space-y-4 divide-y divide-slate-100 dark:divide-dark-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Interface Density / Font Scale
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Adjust text sizing across chat bubbles and conversation cards.
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-dark-800 rounded-xl">
                      {['compact', 'medium', 'comfortable'].map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => updateSetting('fontSize', size)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                            settings.fontSize === size
                              ? 'bg-white dark:bg-dark-900 text-brand-600 dark:text-brand-400 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4">
                    <Switch
                      id="reducedMotion"
                      checked={settings.reducedMotion}
                      onChange={(v) => updateSetting('reducedMotion', v)}
                      label="Reduce Motion & Animations"
                      description="Minimizes smooth transition animations for performance or vestibular comfort."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION: CHAT CUSTOMIZATION ================= */}
          {activeTab === 'chat' && (
            <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  Chat & Messaging Customization
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Fine-tune keyboard shortcuts, message density, and rich media behaviors.
                </p>
              </div>

              <div className="space-y-4 divide-y divide-slate-100 dark:divide-dark-800">
                <div className="pt-2">
                  <Switch
                    id="enterSendsMessage"
                    checked={settings.enterSendsMessage}
                    onChange={(v) => updateSetting('enterSendsMessage', v)}
                    label="Press Enter to send message"
                    description="When enabled, pressing Enter sends the message immediately, and Shift + Enter starts a new line."
                  />
                </div>

                <div className="pt-4">
                  <Switch
                    id="compactChat"
                    checked={settings.compactChat}
                    onChange={(v) => updateSetting('compactChat', v)}
                    label="Compact message bubble density"
                    description="Reduces bubble padding to fit more conversation history onto your screen."
                  />
                </div>

                <div className="pt-4">
                  <Switch
                    id="linkPreviews"
                    checked={settings.linkPreviews}
                    onChange={(v) => updateSetting('linkPreviews', v)}
                    label="Rich URL & link previews"
                    description="Automatically display Open Graph website cards when sharing URLs in chat."
                  />
                </div>

                <div className="pt-4">
                  <Switch
                    id="bigEmojis"
                    checked={settings.bigEmojis}
                    onChange={(v) => updateSetting('bigEmojis', v)}
                    label="Enlarge standalone emojis"
                    description="Renders single emoji messages in 2x size for extra visual expression."
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION: NOTIFICATIONS ================= */}
          {activeTab === 'notifications' && (
            <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  Notification Preferences
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Control how and when NEXORA notifies you of incoming messages and call invites.
                </p>
              </div>

              <div className="space-y-4 divide-y divide-slate-100 dark:divide-dark-800">
                <div className="pt-2">
                  <Switch
                    id="pushNotifications"
                    checked={settings.pushNotifications}
                    onChange={handlePushPermission}
                    label="Desktop push notifications"
                    description="Receive OS alerts when colleagues message you while NEXORA is in the background."
                  />
                </div>

                <div className="pt-4">
                  <Switch
                    id="inAppAlerts"
                    checked={settings.inAppAlerts}
                    onChange={(v) => updateSetting('inAppAlerts', v)}
                    label="In-app notification banners"
                    description="Show floating toast banners when messages arrive in other conversation threads."
                  />
                </div>

                <div className="pt-4">
                  <Switch
                    id="soundAlerts"
                    checked={settings.soundAlerts}
                    onChange={(v) => updateSetting('soundAlerts', v)}
                    label="Sound alerts on message receipt"
                    description="Play subtle audio cues for incoming messages."
                  />
                </div>

                <div className="pt-4">
                  <Switch
                    id="doNotDisturb"
                    checked={settings.doNotDisturb}
                    onChange={(v) => updateSetting('doNotDisturb', v)}
                    label="Do Not Disturb mode"
                    description="Temporarily silence all notification banners, chimes, and call popups."
                  />
                </div>

                <div className="pt-4">
                  <Switch
                    id="emailDigest"
                    checked={settings.emailDigest}
                    onChange={(v) => updateSetting('emailDigest', v)}
                    label="Email summary digest"
                    description="Send an email summary of missed mentions and calls if you are away."
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION: PRIVACY ================= */}
          {activeTab === 'privacy' && (
            <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  Privacy & Room Gatekeeping
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage conference security, waiting room defaults, and presence visibility.
                </p>
              </div>

              <div className="space-y-4 divide-y divide-slate-100 dark:divide-dark-800">
                <div className="pt-2">
                  <Switch
                    id="waitingRoom"
                    checked={settings.waitingRoom}
                    onChange={(v) => updateSetting('waitingRoom', v)}
                    label="Mandatory meeting waiting room"
                    description="Require host approval before participants can join your personal room."
                  />
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      End-to-End Encrypted Media Mesh
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Enforces strict DTLS-SRTP encryption on all WebRTC peer connections.
                    </p>
                  </div>
                  <Badge variant="success" size="sm">Always Active</Badge>
                </div>

                <div className="pt-4">
                  <Switch
                    id="showOnlineStatus"
                    checked={settings.showOnlineStatus}
                    onChange={(v) => updateSetting('showOnlineStatus', v)}
                    label="Broadcast online presence status"
                    description="Allow teammates and contacts to see whether you are currently active."
                  />
                </div>

                <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Direct Messaging Permissions
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Who is allowed to initiate real-time chat conversations with you.
                    </p>
                  </div>
                  <select
                    value={settings.dmPermission}
                    onChange={(e) => updateSetting('dmPermission', e.target.value)}
                    className="bg-slate-50 dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="everyone">Anyone on NEXORA</option>
                    <option value="contacts">Accepted Contacts Only</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION: SOUND & MEDIA ================= */}
          {activeTab === 'sound' && (
            <div className="space-y-6">
              {/* Audio & Video Hardware Testing */}
              <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                      <Video className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Camera & Video Sensor
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Test sensor feed, orientation, and default send quality
                      </p>
                    </div>
                  </div>
                  <Badge variant="success" size="sm" dot>Connected</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Camera Source
                    </label>
                    <select
                      value={settings.selectedCameraId || 'default'}
                      onChange={(e) => updateSetting('selectedCameraId', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                    >
                      <option value="default">Default System Camera</option>
                      {videoDevices.map((dev, idx) => (
                        <option key={dev.deviceId || idx} value={dev.deviceId}>
                          {dev.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Send Resolution
                    </label>
                    <select
                      value={settings.videoQuality}
                      onChange={(e) => updateSetting('videoQuality', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                    >
                      <option value="1080p">High Definition (1080p Full HD)</option>
                      <option value="720p">Standard Definition (720p HD)</option>
                      <option value="auto">Adaptive Bandwidth</option>
                    </select>
                  </div>
                </div>

                {/* Live Camera Preview Box */}
                <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden h-60">
                  {isCameraActive ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-black rounded-xl overflow-hidden">
                      <video
                        ref={videoPreviewRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover rounded-xl ${
                          settings.mirrorVideo ? 'scale-x-[-1]' : ''
                        }`}
                      />
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-semibold text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        LIVE CAMERA PREVIEW
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={stopCameraPreview}
                        className="absolute bottom-3 right-3 shadow-lg text-xs"
                      >
                        <VideoOff className="w-3.5 h-3.5 mr-1" />
                        Stop Preview
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-4">
                      <div className="w-14 h-14 rounded-full bg-brand-600/20 border border-brand-500/40 flex items-center justify-center text-brand-400 font-bold mb-3">
                        <Camera className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-semibold text-slate-200">
                        Test Your Camera Sensor
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1 max-w-xs mb-3">
                        Verify video quality, framing, and lighting before joining team calls.
                      </span>
                      {cameraError && (
                        <p className="text-xs text-rose-400 mb-2 font-medium">{cameraError}</p>
                      )}
                      <Button variant="primary" size="sm" onClick={startCameraPreview} className="text-xs">
                        <Video className="w-3.5 h-3.5 mr-1.5" />
                        Start Camera Preview
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Microphone & Sound Testing */}
              <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Microphone & Sound Output
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Configure input level, test microphone, and check speakers
                      </p>
                    </div>
                  </div>
                  <Badge variant="success" size="sm" dot>Ready</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Microphone Input
                    </label>
                    <select
                      value={settings.selectedMicId || 'default'}
                      onChange={(e) => updateSetting('selectedMicId', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                    >
                      <option value="default">Default System Microphone</option>
                      {audioInputDevices.map((dev, idx) => (
                        <option key={dev.deviceId || idx} value={dev.deviceId}>
                          {dev.label || `Microphone ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Audio Output (Speakers)
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={settings.selectedAudioOutputId || 'default'}
                        onChange={(e) => updateSetting('selectedAudioOutputId', e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                      >
                        <option value="default">Default System Output</option>
                        {audioOutputDevices.map((dev, idx) => (
                          <option key={dev.deviceId || idx} value={dev.deviceId}>
                            {dev.label || `Speaker ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handlePlayTestSound}
                        isLoading={isTestingAudio}
                        className="shrink-0 text-xs"
                      >
                        <Play className="w-3.5 h-3.5 mr-1" />
                        Test Chime
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Live Mic Meter */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Live Microphone Input Level
                      </span>
                      {isTestingMic && (
                        <span className="text-[10px] font-semibold text-emerald-500 animate-pulse">
                          (Listening to voice...)
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                        {micLevel}%
                      </span>
                      <Button
                        variant={isTestingMic ? 'danger' : 'ghost'}
                        size="sm"
                        onClick={isTestingMic ? stopMicTest : startMicTest}
                        className="text-[11px] py-1 px-2.5 h-auto"
                      >
                        {isTestingMic ? 'Stop Test' : 'Test Mic'}
                      </Button>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-dark-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-75 ${
                        micLevel > 80
                          ? 'bg-rose-500'
                          : micLevel > 50
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${micLevel}%` }}
                    />
                  </div>
                </div>

                {/* Meeting Defaults Switches */}
                <div className="space-y-4 divide-y divide-slate-100 dark:divide-dark-800 pt-3">
                  <div className="pt-2">
                    <Switch
                      id="noiseCancellation"
                      checked={settings.noiseCancellation}
                      onChange={(v) => updateSetting('noiseCancellation', v)}
                      label="Intelligent background noise suppression"
                      description="AI filters out keyboard keystrokes, air conditioning, and ambient noise."
                    />
                  </div>

                  <div className="pt-4">
                    <Switch
                      id="autoMuteMic"
                      checked={settings.autoMuteMic}
                      onChange={(v) => updateSetting('autoMuteMic', v)}
                      label="Mute microphone when joining a meeting"
                      description="Join silently by default without broadcasting immediate ambient noise."
                    />
                  </div>

                  <div className="pt-4">
                    <Switch
                      id="autoTurnOffCam"
                      checked={settings.autoTurnOffCam}
                      onChange={(v) => updateSetting('autoTurnOffCam', v)}
                      label="Turn off camera when joining a meeting"
                      description="Keep video disabled until you explicitly turn it on."
                    />
                  </div>

                  <div className="pt-4">
                    <Switch
                      id="mirrorVideo"
                      checked={settings.mirrorVideo}
                      onChange={(v) => updateSetting('mirrorVideo', v)}
                      label="Mirror video preview"
                      description="Flips your video horizontally so it behaves naturally like a physical mirror."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION: SECURITY & SESSIONS ================= */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Security Status Card */}
              <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card space-y-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                    Security & Active Sessions
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Review authenticated devices, sessions, and credentials protection.
                  </p>
                </div>

                {/* Password Management Shortcut */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-dark-850 border border-slate-200/80 dark:border-dark-750">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Account Password
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Last changed recently. Keep it secure and unique.
                      </p>
                    </div>
                  </div>
                  <Link to="/profile">
                    <Button variant="secondary" size="sm" className="text-xs font-semibold">
                      Change Password
                    </Button>
                  </Link>
                </div>

                {/* Active Sessions List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Current Active Devices
                  </h4>

                  <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-dark-850/70 border border-slate-200/70 dark:border-dark-750 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Monitor className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Current Linux / Web Browser Session
                          </span>
                          <Badge variant="success" size="sm" dot>This Device</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Active now • IP Protected
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modern Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
        title="Log Out of NEXORA?"
        description="You will be returned to the sign-in screen and will need to authenticate again."
        confirmText="Log Out"
        cancelText="Stay Signed In"
        type="danger"
      />
    </div>
  );
};

export default Settings;
