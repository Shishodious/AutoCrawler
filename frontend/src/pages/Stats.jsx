import React, { useEffect, useState } from 'react';
import { getStats } from '../api';
import { 
  BarChart3, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Zap,
  AlertTriangle,
  Clock
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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-red-200">
          <h3 className="font-semibold mb-2">Error Loading Statistics</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const successRate = stats?.successRate;
  
  

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary" />
          Crawl Statistics
        </h1>
        <p className="text-gray-400 mt-2">Overview of all crawling operations</p>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Crawls */}
        <div className="bg-dark-light rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-primary/20 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
          </div>
          <div className="text-gray-400 text-sm mb-1">Total Crawls</div>
          <div className="text-3xl font-bold text-white">{stats?.total || 0}</div>
        </div>

        {/* Successful Crawls */}
        <div className="bg-dark-light rounded-xl p-6 border border-green-700/30">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-500/20 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
          </div>
          <div className="text-gray-400 text-sm mb-1">Successful</div>
          <div className="text-3xl font-bold text-green-400">{stats?.successful || 0}</div>
        </div>

        {/* Failed Crawls */}
        <div className="bg-dark-light rounded-xl p-6 border border-red-700/30">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-red-500/20 p-3 rounded-lg">
              <XCircle className="w-6 h-6 text-red-500" />
            </div>
          </div>
          <div className="text-gray-400 text-sm mb-1">Failed</div>
          <div className="text-3xl font-bold text-red-400">{stats?.failed || 0}</div>
        </div>

        {/* Success Rate */}
        <div className="bg-dark-light rounded-xl p-6 border border-primary/30">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-primary/20 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
          </div>
          <div className="text-gray-400 text-sm mb-1">Success Rate</div>
          <div className="text-3xl font-bold text-primary">{successRate}</div>
        </div>
      </div>

      {/* Average Duration */}
      {stats?.avgDuration !== undefined && (
        <div className="bg-dark-light rounded-xl p-6 border border-gray-700 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-indigo-500/20 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="text-gray-400 text-sm">Average Crawl Duration</div>
              <div className="text-2xl font-bold text-white">{stats.avgDuration.toFixed(2)} ms</div>
            </div>
          </div>
        </div>
      )}

      {/* Method Breakdown */}
      {stats?.methodBreakdown && Object.keys(stats.methodBreakdown).length > 0 && (
        <div className="bg-dark-light rounded-xl p-6 border border-gray-700 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-white">Method Breakdown</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(stats.methodBreakdown).map(([method, count]) => (
              <div key={method} className="bg-dark rounded-lg p-4 border border-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-gray-400 text-sm mb-1">
                      {method.charAt(0).toUpperCase() + method.slice(1)}
                    </div>
                    <div className="text-2xl font-bold text-white">{count}</div>
                  </div>
                  <div className={`text-4xl font-mono ${
                    method === 'axios' ? 'text-green-400' : 'text-blue-400'
                  }`}>
                    {method === 'axios' ? '⚡' : '🌐'}
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {stats.total > 0 
                    ? `${((count / stats.total) * 100).toFixed(1)}% of total`
                    : '0% of total'
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Breakdown */}
      {stats?.errorBreakdown && Object.keys(stats.errorBreakdown).length > 0 && (
        <div className="bg-dark-light rounded-xl p-6 border border-red-700/30">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h2 className="text-xl font-semibold text-white">Error Breakdown</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(stats.errorBreakdown).map(([errorType, count]) => (
              <div key={errorType} className="bg-dark rounded-lg p-4 border border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-gray-300 font-medium mb-1">
                      {errorType.replace(/_/g, ' ')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {count} occurrence{count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-red-400">{count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {stats?.totalCrawls === 0 && (
        <div className="bg-dark-light rounded-xl p-12 border border-gray-700 text-center">
          <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">No Statistics Available</h3>
          <p className="text-gray-500">Start crawling websites to see statistics here.</p>
        </div>
      )}
    </div>
  );
};

export default Stats;
