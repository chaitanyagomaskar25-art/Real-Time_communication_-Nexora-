import React from 'react';
import {
  StopCircle,
  Maximize2,
  Minimize2,
  ShieldAlert,
  Radio
} from 'lucide-react';

const ScreenShareToolbar = ({
  isLocalPresenting = false,
  presenterName = '',
  presenterSocketId = '',
  onStopSharing,
  isHost = false,
  onHostStopSharing,
  isFullscreen = false,
  onToggleFullscreen
}) => {
  return (
    <div className="fixed top-14 left-1/2 transform -translate-x-1/2 z-30 animate-fade-in w-11/12 max-w-xl">
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-dark-900/90 backdrop-blur-xl border border-brand-500/40 rounded-2xl shadow-2xl">
        {/* Left: Presenting status indicator */}
        <div className="flex items-center gap-2.5 truncate">
          <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0 border border-brand-500/30">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div className="truncate">
            <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
              <span className="truncate">
                {isLocalPresenting
                  ? 'You are presenting your screen'
                  : `${presenterName || 'A participant'} is presenting`}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">
                Live
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {isLocalPresenting
                ? 'Visible in high-definition to all attendees'
                : 'Shared presentation content active'}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Fullscreen Toggle */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}

          {/* Local Presenter: Stop Sharing Button */}
          {isLocalPresenting && (
            <button
              onClick={onStopSharing}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-rose-600/30"
              title="Stop Sharing Your Screen"
            >
              <StopCircle className="w-4 h-4" />
              <span>Stop Sharing</span>
            </button>
          )}

          {/* Host Action: Stop another participant's presentation */}
          {!isLocalPresenting && isHost && onHostStopSharing && (
            <button
              onClick={() => onHostStopSharing(presenterSocketId)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-slate-300 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
              title="Host control: Stop this user's screen share"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Stop Presenter</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScreenShareToolbar;
