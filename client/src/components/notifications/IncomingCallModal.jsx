import React from 'react';
import { PhoneOff, Video } from 'lucide-react';
import Modal from '../common/Modal';

const IncomingCallModal = ({ incomingCall, onAccept, onDecline }) => {
  if (!incomingCall) return null;

  return (
    <Modal
      isOpen={Boolean(incomingCall)}
      onClose={onDecline}
      title="Incoming Video Call"
      size="sm"
    >
      <div className="text-center py-4 space-y-4 text-xs text-slate-700 dark:text-slate-300">
        {/* Pulsing Avatar */}
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-brand-500/30">
            {incomingCall.callerName ? incomingCall.callerName.charAt(0).toUpperCase() : 'C'}
          </div>
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {incomingCall.callerName || 'A Contact'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">
            Incoming direct video meeting...
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4 pt-3">
          <button
            onClick={onDecline}
            className="flex-1 py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-300 font-semibold flex items-center justify-center gap-2 transition cursor-pointer border border-rose-200 dark:border-rose-900/40"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Decline</span>
          </button>

          <button
            onClick={() => onAccept(incomingCall)}
            className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/50"
          >
            <Video className="w-4 h-4" />
            <span>Accept Call</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default IncomingCallModal;
