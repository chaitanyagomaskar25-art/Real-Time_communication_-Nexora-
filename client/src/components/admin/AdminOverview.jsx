import React from 'react';
import {
  Users,
  Video,
  FileText,
  HardDrive,
  Activity,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Radio,
  ArrowUpRight
} from 'lucide-react';

const AdminOverview = ({ stats, loading, onTabChange }) => {
  if (loading || !stats) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-400">Loading overview statistics...</p>
      </div>
    );
  }

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
    return mb.toFixed(2) + ' MB';
  };

  const metricCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers || 0,
      sub: `${stats.activeUsers || 0} active now / 24h`,
      icon: Users,
      color: 'text-indigo-500',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/50',
      tab: 'users'
    },
    {
      title: 'Active Meetings',
      value: stats.ongoingMeetings || 0,
      sub: 'Live WebRTC sessions',
      icon: Radio,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50',
      tab: 'meetings'
    },
    {
      title: 'Total Meetings',
      value: stats.totalMeetings || 0,
      sub: `${stats.completedMeetings || 0} completed`,
      icon: Video,
      color: 'text-brand-500',
      bg: 'bg-brand-50 dark:bg-brand-950/40 border-brand-200 dark:border-brand-900/50',
      tab: 'meetings'
    },
    {
      title: 'Shared Files',
      value: stats.totalFiles || 0,
      sub: formatBytes(stats.totalStorageBytes),
      icon: FileText,
      color: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50',
      tab: 'system'
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Hero Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card, idx) => (
          <div
            key={idx}
            onClick={() => onTabChange(card.tab)}
            className="p-5 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {card.title}
              </span>
              <div className={`p-2.5 rounded-2xl border ${card.bg}`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                {card.value}
              </h3>
              <span className="text-xs text-slate-400 flex items-center group-hover:text-brand-500 transition">
                View <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Platform Health & Activity Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Health Snapshot */}
        <div className="p-6 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Platform Status
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              OPERATIONAL
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850">
              <span className="text-slate-500 dark:text-slate-400">Database Engine</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                MongoDB Live
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850">
              <span className="text-slate-500 dark:text-slate-400">WebRTC Mesh Signaling</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                {stats.activeSockets || 0} Connected Sockets
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850">
              <span className="text-slate-500 dark:text-slate-400">Storage Consumption</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-amber-500" />
                {formatBytes(stats.totalStorageBytes)}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Admin & Platform Activity Stream */}
        <div className="lg:col-span-2 p-6 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Recent Audit Trail & Activity
              </h3>
            </div>
            <button
              onClick={() => onTabChange('system')}
              className="text-xs font-semibold text-brand-500 hover:text-brand-600 transition"
            >
              All Logs →
            </button>
          </div>

          <div className="space-y-2.5">
            {(!stats.recentActivity || stats.recentActivity.length === 0) ? (
              <p className="text-xs text-slate-400 py-6 text-center">No recent administrative events recorded.</p>
            ) : (
              stats.recentActivity.slice(0, 5).map((log, i) => (
                <div
                  key={log.id || i}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0">
                      <ShieldAlert className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                    </div>
                    <div className="min-w-0 truncate">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        <span className="text-brand-500">{log.adminName || 'Admin'}</span> performed{' '}
                        <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">{log.action}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        Target: {log.targetType} ({log.targetId})
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;

