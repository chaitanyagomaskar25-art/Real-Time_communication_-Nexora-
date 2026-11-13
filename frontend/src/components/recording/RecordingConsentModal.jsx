import React from 'react';
import { ShieldAlert, LogOut, Check } from 'lucide-react';
import Button from '../common/Button';

const RecordingConsentModal = ({ isOpen, hostName, onConsent, onLeave }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-dark-900 rounded-2xl border border-rose-500/30 dark:border-rose-500/20 shadow-2xl p-6 overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-red-500 to-amber-500" />

        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 flex-shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Recording in Progress
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
              </span>
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong className="text-slate-900 dark:text-white">{hostName || 'The meeting host'}</strong> has started recording audio and video for this meeting.
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              By staying in this meeting, you consent to being recorded. Your consent will be securely recorded in the meeting log.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-end border-t border-slate-100 dark:border-slate-800/80 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onLeave}
            className="w-full sm:w-auto text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Leave Meeting
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={onConsent}
            className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            I Consent & Stay
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RecordingConsentModal;
