import React, { useEffect, useState } from 'react';
import { getStats } from '../api';
import {
  BarChart3,
  TrendingUp,
  CheckCircle,
  XCircle,
  Zap,
  Chrome,
  AlertTriangle,
  Clock,
  Target,
} from 'lucide-react';

const Stats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await getStats();
        setStats(response.data.stats);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-10 max-w-6xl">
        <div className="h-9 w-64 rounded-lg bg-dark-light shimmer mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-dark-light shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-6 py-10 max-w-6xl">
        <div className="flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-6 text-danger">
          <AlertTriangle className="mt-0.5 w-5 h-5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold">Error loading statistics</h3>
            <p className="text-sm text-danger/80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const successRate = stats?.successRate;
  const ratePct = stats?.total ? Math.round(((stats.successful || 0) / stats.total) * 100) : 0;

  const cards = [
    { label: 'Total crawls', value: stats?.total || 0, icon: TrendingUp, accent: 'text-white', iconBg: 'bg-primary/15 text-primary-soft', ring: 'border-hairline' },
    { label: 'Successful', value: stats?.successful || 0, icon: CheckCircle, accent: 'text-success', iconBg: 'bg-success/15 text-success', ring: 'border-success/25' },
    { label: 'Failed', value: stats?.failed || 0, icon: XCircle, accent: 'text-danger', iconBg: 'bg-danger/15 text-danger', ring: 'border-danger/25' },
    { label: 'Success rate', value: successRate, icon: Target, accent: 'text-primary-soft', iconBg: 'bg-primary/15 text-primary-soft', ring: 'border-primary/25' },
  ];

  return (
    <div className="container mx-auto px-6 py-10 max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3 animate-fade-in">
        <span className="grid place-items-center w-11 h-11 rounded-xl bg-primary/15 border border-primary/25">
          <BarChart3 className="w-6 h-6 text-primary-soft" />
        </span>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Statistics</h1>
          <p className="text-sm text-gray-400">An overview of all your crawling operations.</p>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4 stagger">
        {cards.map((c) => (
          <div key={c.label} className={`glass-card card-hover rounded-2xl border ${c.ring} p-6`}>
            <div className={`mb-4 grid place-items-center w-11 h-11 rounded-xl ${c.iconBg}`}>
              <c.icon className="w-5 h-5" />
            </div>
            <div className="text-sm text-gray-400">{c.label}</div>
            <div className={`mt-1 text-3xl font-bold ${c.accent}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Success rate bar */}
      {stats?.total > 0 && (
        <div className="mb-6 glass-card rounded-2xl p-6 animate-fade-in">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">Overall success rate</span>
            <span className="font-mono text-sm font-semibold text-primary-soft">{successRate}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full border border-hairline bg-dark">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-accent transition-all duration-700 ease-out"
              style={{ width: `${ratePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Average Duration */}
      {stats?.avgDuration !== undefined && (
        <div className="mb-6 glass-card rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="grid place-items-center w-12 h-12 rounded-xl bg-accent/15 text-accent">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm text-gray-400">Average crawl duration</div>
              <div className="text-2xl font-bold text-white">{stats.avgDuration.toFixed(2)} ms</div>
            </div>
          </div>
        </div>
      )}

      {/* Method Breakdown */}
      {stats?.methodBreakdown && Object.keys(stats.methodBreakdown).length > 0 && (
        <div className="mb-6 glass-card rounded-2xl p-6">
          <div className="mb-6 flex items-center gap-3">
            <Zap className="w-5 h-5 text-primary-soft" />
            <h2 className="text-lg font-bold text-white">Method breakdown</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Object.entries(stats.methodBreakdown).map(([method, count]) => {
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              const isAxios = method === 'axios';
              return (
                <div key={method} className="rounded-xl border border-hairline bg-dark/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`grid place-items-center w-8 h-8 rounded-lg ${isAxios ? 'bg-success/15 text-success' : 'bg-accent/15 text-accent'}`}>
                        {isAxios ? <Zap className="w-4 h-4" /> : <Chrome className="w-4 h-4" />}
                      </span>
                      <span className="font-medium text-gray-200">
                        {method.charAt(0).toUpperCase() + method.slice(1)}
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-white">{count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-dark">
                    <div
                      className={`h-full rounded-full ${isAxios ? 'bg-success' : 'bg-accent'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-gray-500">{pct.toFixed(1)}% of total</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Breakdown */}
      {stats?.errorBreakdown && Object.keys(stats.errorBreakdown).length > 0 && (
        <div className="glass-card rounded-2xl border border-danger/25 p-6">
          <div className="mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-danger" />
            <h2 className="text-lg font-bold text-white">Error breakdown</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(stats.errorBreakdown).map(([errorType, count]) => (
              <div key={errorType} className="flex items-center justify-between rounded-xl border border-hairline bg-dark/50 p-4">
                <div>
                  <div className="font-medium capitalize text-gray-200">{errorType.replace(/_/g, ' ')}</div>
                  <div className="text-sm text-gray-500">
                    {count} occurrence{count !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="text-2xl font-bold text-danger">{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {stats?.total === 0 && (
        <div className="glass-card rounded-2xl py-16 text-center">
          <span className="mx-auto mb-4 grid place-items-center w-16 h-16 rounded-2xl bg-dark/60 border border-hairline">
            <BarChart3 className="w-8 h-8 text-gray-600" />
          </span>
          <h3 className="text-xl font-semibold text-gray-300 mb-2">No statistics yet</h3>
          <p className="text-gray-500">Start crawling websites to see statistics here.</p>
        </div>
      )}
    </div>
  );
};

export default Stats;
