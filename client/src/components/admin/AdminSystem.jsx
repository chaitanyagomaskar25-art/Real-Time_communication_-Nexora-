import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Cpu,
  Radio,
  HardDrive,
  Shield,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import Button from '../common/Button';

const AdminSystem = () => {
  const [metrics, setMetrics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sysRes, logsRes] = await Promise.all([
        adminService.getSystemMetrics(),
        adminService.getAuditLogs({ page: 1, limit: 15 })
      ]);
      setMetrics(sysRes);
      setAuditLogs(logsRes.logs || []);
    } catch (err) {
      console.warn('Failed to load system metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading || !metrics) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-400">Loading system metrics and telemetry...</p>
      </div>
    );
  }

  const { serverHealth = {}, socketMetrics = {}, storageMetrics = {} } = metrics;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Refresh button */}
      <div className="p-5 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-brand-500" />
            System Health & Security Audit Telemetry
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time infrastructure health, Socket.IO connections, and administrative audit logs.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          isLoading={refreshing}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh Metrics
        </Button>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Server & Node.js Health */}
        <div className="p-6 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Node.js Runtime</h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              {serverHealth.status?.toUpperCase()}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-400">Process Uptime</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{serverHealth.uptimeFormatted}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-400">Node Version</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{serverHealth.nodeVersion}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-400">Platform & OS</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{serverHealth.platform}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-400">Process Memory (Heap)</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {serverHealth.memory?.heapUsedMb} MB / {serverHealth.memory?.heapTotalMb} MB
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Database Engine</span>
              <span className="font-semibold text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {serverHealth.databaseState}
              </span>
            </div>
          </div>
        </div>

        {/* Socket.IO Signaling Engine */}
        <div className="p-6 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Socket.IO Gateway</h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              {socketMetrics.status?.toUpperCase()}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-400">Active Connected Sockets</span>
              <span className="font-bold text-emerald-500 text-sm">{socketMetrics.activeSockets}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-400">Active Room Channels</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{socketMetrics.activeRooms}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-400">Signaling Transport</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">WebSocket / Polling fallback</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">WebRTC Mesh State</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">P2P Full Mesh (DTLS/SRTP)</span>
            </div>
          </div>
        </div>

        {/* Storage Volume Breakdown */}
        <div className="p-6 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Storage Breakdown</h3>
            </div>
            <span className="text-xs font-mono font-bold text-amber-500">
              {storageMetrics.totalStorageFormatted}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-400">Meeting Files</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {storageMetrics.totalFilesCount} files ({storageMetrics.filesSizeFormatted})
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-400">Meeting Recordings</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {storageMetrics.recordingsCount} recordings ({storageMetrics.recordingsSizeFormatted})
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Storage Providers</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">Local Disk / Cloud Object Store</span>
            </div>
          </div>
        </div>
      </div>

      {/* Security Audit Log Table */}
      <div className="p-6 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Immutable Admin Action Audit Log
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {auditLogs.length} recent actions recorded
          </span>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">
            No administrative actions logged yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3 font-semibold">Action</th>
                  <th className="py-3 px-3 font-semibold">Admin</th>
                  <th className="py-3 px-3 font-semibold">Target</th>
                  <th className="py-3 px-3 font-semibold">Details</th>
                  <th className="py-3 px-3 font-semibold">IP Address</th>
                  <th className="py-3 px-3 font-semibold text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {auditLogs.map((log) => (
                  <tr key={log.id || log.logId} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40 transition">
                    <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-semibold text-brand-500">{log.adminName}</span>
                      <span className="block text-[10px] text-slate-400">{log.adminEmail}</span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 capitalize">{log.targetType}:</span>{' '}
                      <span className="font-mono text-[11px] text-slate-500">{log.targetId}</span>
                    </td>

                    <td className="py-3 px-3 text-[11px] text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                      {log.details ? JSON.stringify(log.details) : 'N/A'}
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                      {log.ipAddress || '127.0.0.1'}
                    </td>

                    <td className="py-3 px-3 text-right text-slate-400 text-[11px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSystem;
