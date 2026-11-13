import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Users,
  Video,
  BarChart2,
  Server,
  ShieldCheck,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import AdminOverview from '../../components/admin/AdminOverview';
import AdminUsers from '../../components/admin/AdminUsers';
import AdminMeetings from '../../components/admin/AdminMeetings';
import AdminAnalytics from '../../components/admin/AdminAnalytics';
import AdminSystem from '../../components/admin/AdminSystem';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'meetings' | 'analytics' | 'system'
  const [overviewStats, setOverviewStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminService.getOverview();
      setOverviewStats(data);
    } catch (err) {
      console.warn('Failed to fetch admin overview:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'meetings', label: 'Meeting Oversight', icon: Video },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'system', label: 'System & Audit', icon: Server }
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Top Admin Banner */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-slate-800 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link to="/dashboard" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 mr-2">
              <ArrowLeft className="w-3.5 h-3.5" />
              Workspace
            </Link>
            <Badge variant="primary" size="sm" dot>
              <ShieldCheck className="w-3 h-3 mr-1" />
              ADMINISTRATOR CONSOLE
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Governance & Control Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time platform oversight, account lifecycle management, meeting moderation, and immutable audit telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchOverview}
            isLoading={loading}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Navigation Tabs Pill Bar */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white dark:bg-dark-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-card overflow-x-auto text-xs font-semibold">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-dark-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main View Router */}
      <div className="pt-2">
        {activeTab === 'overview' && (
          <AdminOverview
            stats={overviewStats}
            loading={loading}
            onTabChange={(tabId) => setActiveTab(tabId)}
          />
        )}

        {activeTab === 'users' && <AdminUsers />}

        {activeTab === 'meetings' && <AdminMeetings />}

        {activeTab === 'analytics' && <AdminAnalytics />}

        {activeTab === 'system' && <AdminSystem />}
      </div>
    </div>
  );
};

export default AdminDashboard;

