import React from 'react';
import { Shield, Clock, PhoneOff } from 'lucide-react';
import Button from '../common/Button';

const WaitingRoom = ({ meetingTitle, hostName, onLeave }) => {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
      {/* Glow Backdrop */}
      <div className="absolute w-[500px] h-[300px] bg-brand-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-md w-full bg-slate-850/80 border border-slate-700/80 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        {/* Pulsing indicator */}
        <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping" />
          <div className="w-16 h-16 rounded-full bg-brand-600/30 border border-brand-500/40 flex items-center justify-center text-brand-300">
            <Shield className="w-8 h-8" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-white">
            Waiting for Host Approval
          </h2>
          <p className="text-xs text-slate-400">
            Please wait, the meeting host will let you in soon.
          </p>
        </div>

        {/* Meeting Information */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-left space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Meeting:</span>
            <span className="font-semibold text-slate-200 truncate max-w-[200px]">{meetingTitle || 'NEXORA Conference'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Host:</span>
            <span className="font-semibold text-slate-200">{hostName || 'Host'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Status:</span>
            <span className="text-amber-400 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              Waiting in Queue
            </span>
          </div>
        </div>

        <Button
          variant="danger"
          size="md"
          className="w-full"
          onClick={onLeave}
        >
          <PhoneOff className="w-4 h-4 mr-2" />
          Leave Waiting Room
        </Button>
      </div>
    </div>
  );
};

export default WaitingRoom;
