import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Mail,
  Save,
  Check,
  Copy,
  Sparkles,
  Camera,
  AtSign,
  AlertCircle,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Upload,
  RefreshCw,
  Trash2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Input from '../components/common/Input';
import StatusDot from '../components/common/StatusDot';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { contactService } from '../services/contactService';

const PRESENCE_OPTIONS = [
  { id: 'available', label: 'Available', dotClass: 'bg-emerald-500', desc: 'Online and ready to connect' },
  { id: 'busy', label: 'Busy / In a Meeting', dotClass: 'bg-rose-500', desc: 'Do not disturb' },
  { id: 'away', label: 'Away', dotClass: 'bg-amber-500', desc: 'Stepped away temporarily' },
  { id: 'offline', label: 'Invisible / Offline', dotClass: 'bg-slate-400', desc: 'Appear offline to others' }
];

const AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=NEXORA-1',
  'https://api.dicebear.com/7.x/bottts/svg?seed=NEXORA-2',
  'https://api.dicebear.com/7.x/bottts/svg?seed=NEXORA-3',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Aria',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Luna'
];

const Profile = () => {
  const { user, updateProfile, changePassword, updatePresenceStatus } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();
  const fileInputRef = useRef(null);

  // Profile Form State
  const [fullName, setFullName] = useState(user?.fullName || user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [profileImage, setProfileImage] = useState(user?.profileImage || '');
  const [presenceStatus, setPresenceStatus] = useState(
    user?.presenceStatus || localStorage.getItem('nexora_user_presence') || 'available'
  );
  const [isUpdatingPresence, setIsUpdatingPresence] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Status Indicators
  const [profileStatus, setProfileStatus] = useState({ loading: false, error: '', success: '' });
  const [passwordStatus, setPasswordStatus] = useState({ loading: false, error: '', success: '' });
  const [copiedLink, setCopiedLink] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  // Sync state if user loads later
  useEffect(() => {
    if (user) {
      setFullName(user.fullName || user.name || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
      setBio(user.bio || '');
      setProfileImage(user.profileImage || '');
      if (user.presenceStatus) {
        setPresenceStatus(user.presenceStatus);
      }
    }
  }, [user]);

  const personalRoomCode = username || (fullName ? fullName.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'my-meeting');
  const personalRoomUrl = `${window.location.origin}/room/${personalRoomCode}`;

  // Handle Presence change
  const handlePresenceChange = async (statusId) => {
    setPresenceStatus(statusId);
    setIsUpdatingPresence(true);
    try {
      if (updatePresenceStatus) {
        await updatePresenceStatus(statusId);
      } else {
        await contactService.updatePresence(statusId);
      }
      if (socket) {
        socket.emit('update-presence-status', { status: statusId });
      }
    } catch (err) {
      console.warn('Could not update backend presence:', err);
    } finally {
      setIsUpdatingPresence(false);
    }
  };

  // Image Upload via FileReader
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setProfileStatus({
        loading: false,
        error: 'Image file size must be less than 2MB',
        success: ''
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImage(reader.result);
      setShowAvatarModal(false);
    };
    reader.readAsDataURL(file);
  };

  // Generate random avatar seed
  const handleGenerateSeed = () => {
    const seed = Math.random().toString(36).substring(2, 9);
    setProfileImage(`https://api.dicebear.com/7.x/bottts/svg?seed=nexora-${seed}`);
  };

  // Profile Save
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileStatus({ loading: true, error: '', success: '' });

    if (!fullName.trim()) {
      setProfileStatus({ loading: false, error: 'Full name cannot be empty', success: '' });
      return;
    }

    if (!username.trim() || username.trim().length < 3) {
      setProfileStatus({ loading: false, error: 'Username must be at least 3 characters', success: '' });
      return;
    }

    try {
      await updateProfile({
        fullName: fullName.trim(),
        username: username.toLowerCase().trim(),
        bio: bio.trim(),
        profileImage
      });
      setProfileStatus({ loading: false, error: '', success: 'Profile updated successfully!' });
      toast.success('Profile details updated successfully!');
      setTimeout(() => {
        setProfileStatus((prev) => ({ ...prev, success: '' }));
      }, 3500);
    } catch (err) {
      setProfileStatus({ loading: false, error: err.message || 'Failed to update profile.', success: '' });
      toast.error(err.message || 'Failed to update profile.');
    }
  };

  // Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordStatus({ loading: true, error: '', success: '' });

    if (!currentPassword) {
      setPasswordStatus({ loading: false, error: 'Current password is required', success: '' });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setPasswordStatus({ loading: false, error: 'New password must be at least 6 characters', success: '' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ loading: false, error: 'New passwords do not match', success: '' });
      return;
    }

    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordStatus({ loading: false, error: '', success: 'Password changed successfully!' });
      toast.success('Account password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordStatus((prev) => ({ ...prev, success: '' }));
      }, 3500);
    } catch (err) {
      setPasswordStatus({ loading: false, error: err.message || 'Failed to change password.', success: '' });
      toast.error(err.message || 'Failed to change password.');
    }
  };

  const handleCopyPersonalLink = () => {
    navigator.clipboard.writeText(personalRoomUrl);
    setCopiedLink(true);
    toast.success('Personal meeting URL copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const currentPresence = PRESENCE_OPTIONS.find((p) => p.id === presenceStatus) || PRESENCE_OPTIONS[0];

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-0.5 rounded-full border border-brand-200 dark:border-brand-900/50">
            NEXORA Identity
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Profile & Account
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your public persona, custom avatar, permanent room URL, and credentials.
        </p>
      </div>

      {/* Hero Profile Overview Card with Brand Gradient Banner */}
      <div className="rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card overflow-hidden">
        {/* Subtle Gradient Cover Banner */}
        <div className="h-28 sm:h-36 bg-gradient-to-r from-brand-600 via-violet-600 to-indigo-700 relative overflow-hidden">
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-black/30 backdrop-blur-md text-[11px] font-medium text-white/90 border border-white/10 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Verified NEXORA Account
            </span>
          </div>
        </div>

        {/* Profile Content Shelf */}
        <div className="p-6 sm:p-8 pt-0 relative">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-5 -mt-14 sm:-mt-16 mb-6">
            {/* Large Avatar with Online Presence Badge */}
            <div className="relative group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white dark:bg-dark-900 p-1.5 shadow-xl ring-4 ring-white dark:ring-dark-900">
                <div className="w-full h-full rounded-2xl bg-gradient-to-tr from-brand-600 to-violet-600 text-white font-extrabold text-3xl flex items-center justify-center overflow-hidden">
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt={fullName || 'Avatar'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{fullName ? fullName.charAt(0).toUpperCase() : 'U'}</span>
                  )}
                </div>
              </div>

              {/* Non-aggressive animated Online Indicator Dot on Avatar */}
              <div className="absolute bottom-2 right-2">
                <StatusDot status={presenceStatus} size="lg" />
              </div>

              {/* Camera edit button */}
              <button
                type="button"
                onClick={() => setShowAvatarModal(true)}
                title="Change profile picture"
                className="absolute inset-0 rounded-3xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer backdrop-blur-[2px]"
              >
                <Camera className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-semibold tracking-wider uppercase">Change</span>
              </button>
            </div>

            {/* Quick Actions at Top Right */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-center sm:justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAvatarModal(true)}
                className="text-xs"
              >
                <Camera className="w-3.5 h-3.5 mr-1.5" />
                Update Photo
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const formEl = document.getElementById('edit-profile-form');
                  formEl?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-xs"
              >
                <User className="w-3.5 h-3.5 mr-1.5" />
                Edit Info
              </Button>
            </div>
          </div>

          {/* User Details & Presence Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-dark-800">
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {fullName || 'Explorer'}
                </h2>
                <Badge variant="primary" size="sm" className="font-mono">
                  @{username || 'user'}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center sm:justify-start gap-1.5 font-medium">
                <Mail className="w-3.5 h-3.5" />
                {email || 'user@nexora.io'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl pt-1 leading-relaxed">
                {bio || 'Ready for real-time video collaboration, encrypted messaging, and team workspaces.'}
              </p>
            </div>

            {/* Interactive Presence Selector */}
            <div className="bg-slate-50 dark:bg-dark-850 p-3 rounded-2xl border border-slate-200/90 dark:border-dark-750 flex flex-col gap-1.5 shrink-0 sm:min-w-[220px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Online Presence
                </span>
                {isUpdatingPresence && (
                  <span className="text-[10px] text-brand-600 dark:text-brand-400 animate-pulse font-medium">
                    Updating...
                  </span>
                )}
              </div>
              <div className="relative">
                <select
                  value={presenceStatus}
                  onChange={(e) => handlePresenceChange(e.target.value)}
                  className="w-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl pl-8 pr-4 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500 cursor-pointer shadow-subtle"
                >
                  {PRESENCE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span
                  className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${currentPresence.dotClass}`}
                />
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {currentPresence.desc}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Personal Permanent Room URL Card */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-violet-600 text-white flex items-center justify-center shadow-sm shadow-brand-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Personal Meeting Room URL
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your permanent, custom conference link. Share with teammates for instant calls anytime.
              </p>
            </div>
          </div>
          <a
            href={personalRoomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 text-xs font-semibold border border-brand-200 dark:border-brand-900/50 hover:bg-brand-100 transition shrink-0"
          >
            <span>Launch My Room</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            readOnly
            value={personalRoomUrl}
            className="w-full bg-slate-50/90 dark:bg-dark-850 border border-slate-200/90 dark:border-dark-750 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none shadow-subtle select-all"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyPersonalLink}
            className="shrink-0 text-xs font-semibold"
          >
            {copiedLink ? (
              <Check className="w-4 h-4 text-emerald-500 mr-1.5" />
            ) : (
              <Copy className="w-4 h-4 mr-1.5" />
            )}
            {copiedLink ? 'Copied' : 'Copy Link'}
          </Button>
        </div>
      </div>

      {/* Edit Profile Form Card */}
      <div
        id="edit-profile-form"
        className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-dark-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              Edit Profile Information
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Update your public display name, handle, and personal summary across NEXORA.
            </p>
          </div>

          {profileStatus.success && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>{profileStatus.success}</span>
            </div>
          )}
        </div>

        {profileStatus.error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{profileStatus.error}</span>
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input
              label="Full Display Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Elena Rostova"
              required
              icon={User}
            />

            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. elenarostova"
              required
              icon={AtSign}
              helperText="Unique handle for calls, mentions & personal room URL"
            />
          </div>

          <Input
            label="Email Address"
            value={email}
            readOnly
            disabled
            icon={Mail}
            helperText="Primary email tied to your NEXORA authentication (cannot be modified directly)"
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Personal Bio & Role
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {bio.length} / 250 characters
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={250}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell teammates about your focus, time zone, or project role..."
              className="w-full bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 hover:border-slate-300 dark:hover:border-dark-700 rounded-2xl p-3.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition shadow-subtle"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-dark-800">
            <Button
              variant="primary"
              type="submit"
              isLoading={profileStatus.loading}
              className="text-xs font-semibold px-5"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Profile Changes
            </Button>
          </div>
        </form>
      </div>

      {/* Change Password Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-dark-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-violet-500" />
              Account Security & Password
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ensure your account is protected with a unique, high-entropy password.
            </p>
          </div>

          {passwordStatus.success && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>{passwordStatus.success}</span>
            </div>
          )}
        </div>

        {passwordStatus.error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{passwordStatus.error}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="relative">
            <Input
              label="Current Password"
              type={showCurrentPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
              icon={Lock}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((prev) => !prev)}
              className="absolute right-3.5 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <Input
                label="New Password"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                icon={Lock}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-3.5 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Input
              label="Confirm New Password"
              type={showNewPassword ? 'text' : 'password'}
              placeholder="Re-enter new password"
              icon={Lock}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-dark-800">
            <Button
              variant="secondary"
              type="submit"
              isLoading={passwordStatus.loading}
              className="text-xs font-semibold px-5"
            >
              Update Password
            </Button>
          </div>
        </form>
      </div>

      {/* Avatar Update Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-dark-900 rounded-3xl border border-slate-200/90 dark:border-dark-750 shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-dark-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-brand-500" />
                Update Profile Avatar
              </h3>
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Current preview */}
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-brand-600 to-violet-600 p-1 shadow-md">
                <div className="w-full h-full rounded-2xl bg-white dark:bg-dark-900 overflow-hidden flex items-center justify-center font-bold text-2xl text-brand-600">
                  {profileImage ? (
                    <img src={profileImage} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span>{fullName ? fullName.charAt(0).toUpperCase() : 'U'}</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Avatar preview for your team profile
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {/* File upload hidden input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <Button
                variant="primary"
                className="w-full text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo from Device (PNG/JPG)
              </Button>

              <Button
                variant="secondary"
                className="w-full text-xs"
                onClick={handleGenerateSeed}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Generate Random Tech Avatar
              </Button>

              {/* Presets Grid */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Or pick a preset avatar:
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {AVATAR_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setProfileImage(preset)}
                      className={`w-11 h-11 rounded-xl p-0.5 border cursor-pointer hover:scale-105 transition overflow-hidden bg-slate-50 dark:bg-dark-800 ${
                        profileImage === preset
                          ? 'border-brand-500 ring-2 ring-brand-500/20'
                          : 'border-slate-200 dark:border-dark-700'
                      }`}
                    >
                      <img src={preset} alt="preset" className="w-full h-full object-cover rounded-lg" />
                    </button>
                  ))}
                </div>
              </div>

              {profileImage && (
                <button
                  type="button"
                  onClick={() => setProfileImage('')}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-rose-500 hover:text-rose-600 pt-2 cursor-pointer font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Custom Avatar (Use Initials)
                </button>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-dark-800">
              <Button
                variant="primary"
                size="sm"
                className="text-xs"
                onClick={() => setShowAvatarModal(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
