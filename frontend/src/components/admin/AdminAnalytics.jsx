import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Users,
  Video
} from 'lucide-react';
import { adminService } from '../../services/adminService';

const AdminAnalytics = () => {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminService.getAnalytics(days);
      setData(res);
    } catch (err) {
      console.warn('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading || !data) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-400">Aggregating platform database metrics...</p>
      </div>
    );
  }

  const { registrationTrend = [], meetingTrend = [], filesTrend = [], growthStats = {} } = data;

  const maxReg = Math.max(...registrationTrend.map((d) => d.count), 5);
  const maxMeet = Math.max(...meetingTrend.map((d) => Math.max(d.created, d.completed)), 5);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Period Selector */}
      <div className="p-5 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Platform Growth & Real Usage Analytics
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real aggregated activity from user accounts, meetings, and file uploads.
          </p>
        </div>

        {/* Timeframe pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
          {[7, 14, 30].map((period) => (
            <button
              key={period}
              onClick={() => setDays(period)}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                days === period
                  ? 'bg-white dark:bg-dark-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Last {period} Days
            </button>
          ))}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-400">New Registrations</span>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {growthStats.totalNewUsersPeriod ?? 0}
            </h3>
            <span className="text-xs font-bold text-emerald-500 flex items-center">
              +{growthStats.avgRegistrationsPerDay}/day
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Total in past {days} days</p>
        </div>

        <div className="p-5 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-400">Meetings Hosted</span>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {growthStats.totalMeetingsPeriod ?? 0}
            </h3>
            <span className="text-xs font-bold text-brand-500 flex items-center">
              +{growthStats.avgMeetingsPerDay}/day
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Conferences created</p>
        </div>

        <div className="p-5 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-400">Total Files Shared</span>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {filesTrend.reduce((acc, f) => acc + f.count, 0)}
            </h3>
            <span className="text-xs font-bold text-amber-500">
              {((filesTrend.reduce((acc, f) => acc + f.sizeBytes, 0)) / (1024 * 1024)).toFixed(1)} MB
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">In-call transfer volume</p>
        </div>

        <div className="p-5 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-400">Meeting Completion Rate</span>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {growthStats.totalMeetingsPeriod > 0
                ? Math.round(
                    (meetingTrend.reduce((acc, m) => acc + m.completed, 0) /
                      growthStats.totalMeetingsPeriod) *
                      100
                  )
                : 100}
              %
            </h3>
            <span className="text-xs font-bold text-emerald-500">Healthy</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Completed vs created</p>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Registration Bar Chart */}
        <div className="p-6 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Daily User Registrations
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">Max: {maxReg}</span>
          </div>

          <div className="h-48 flex items-end justify-between gap-2 pt-6">
            {registrationTrend.map((item, idx) => {
              const heightPercent = Math.max(8, Math.round((item.count / maxReg) * 100));
              const displayDate = item.date.slice(5);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                  {/* Tooltip */}
                  <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded pointer-events-none whitespace-nowrap shadow-lg z-10">
                    {item.date}: <strong>{item.count} users</strong>
                  </div>

                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden h-36 flex items-end">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full bg-gradient-to-t from-indigo-600 to-cyan-500 rounded-xl transition-all duration-300 group-hover:brightness-110"
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono transform -rotate-45 sm:rotate-0">
                    {displayDate}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Meeting Activity Chart (Created vs Completed) */}
        <div className="p-6 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-brand-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Meeting Activity Progression
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-[11px] text-brand-500">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500" /> Created
              </span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-500">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Completed
              </span>
            </div>
          </div>

          <div className="h-48 flex items-end justify-between gap-2 pt-6">
            {meetingTrend.map((item, idx) => {
              const createdHeight = Math.max(6, Math.round((item.created / maxMeet) * 100));
              const completedHeight = Math.max(6, Math.round((item.completed / maxMeet) * 100));
              const displayDate = item.date.slice(5);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                  <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded pointer-events-none whitespace-nowrap shadow-lg z-10">
                    {item.date}: {item.created} created / {item.completed} completed
                  </div>

                  <div className="w-full flex items-end justify-center gap-1 h-36">
                    <div
                      style={{ height: `${createdHeight}%` }}
                      className="w-1/2 bg-brand-500 rounded-t-lg transition-all"
                    />
                    <div
                      style={{ height: `${completedHeight}%` }}
                      className="w-1/2 bg-emerald-500 rounded-t-lg transition-all"
                    />
                  </div>

                  <span className="text-[9px] text-slate-400 font-mono transform -rotate-45 sm:rotate-0">
                    {displayDate}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
