import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSession } from '../api';
import { 
  ArrowLeft, 
  Globe, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Layers,
  Link as LinkIcon,
  Zap
} from 'lucide-react';

const SessionDetails = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('depth'); // 'depth' | 'time'

  useEffect(() => {
    const fetchSession = async () => {
      try {
        setLoading(true);
        const response = await getSession(sessionId);
        setSessionData(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch session data');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

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
          <h3 className="font-semibold mb-2">Error Loading Session</h3>
          <p>{error}</p>
          <button
            onClick={() => navigate('/history')}
            className="mt-4 flex items-center gap-2 text-primary hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to History
          </button>
        </div>
      </div>
    );
  }

  const sortedPages = [...(sessionData?.pages || [])].sort((a, b) => {
    if (sortBy === 'depth') {
      return a.depth - b.depth;
    } else {
      return new Date(a.crawledAt) - new Date(b.crawledAt);
    }
  });

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Back Button */}
      <button
        onClick={() => navigate('/history')}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to History
      </button>

      {/* Header */}
      <div className="bg-dark-light rounded-xl p-6 border border-gray-700 mb-6">
        <h1 className="text-3xl font-bold text-white mb-4 flex items-center gap-3">
          <Globe className="w-8 h-8 text-primary" />
          Recursive Crawl Session
        </h1>
        <div className="text-gray-400 text-sm font-mono">
          Session ID: {sessionId}
        </div>
      </div>

      {/* Summary Stats */}
      {sessionData?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-dark-light rounded-xl p-4 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Total Pages</div>
            <div className="text-2xl font-bold text-white">{sessionData.summary.totalPages}</div>
          </div>
          <div className="bg-dark-light rounded-xl p-4 border border-green-700/30">
            <div className="text-gray-400 text-sm mb-1">Successful</div>
            <div className="text-2xl font-bold text-green-400">{sessionData.summary.successfulPages}</div>
          </div>
          <div className="bg-dark-light rounded-xl p-4 border border-red-700/30">
            <div className="text-gray-400 text-sm mb-1">Failed</div>
            <div className="text-2xl font-bold text-red-400">{sessionData.summary.failedPages}</div>
          </div>
          <div className="bg-dark-light rounded-xl p-4 border border-primary/30">
            <div className="text-gray-400 text-sm mb-1">Success Rate</div>
            <div className="text-2xl font-bold text-primary">{sessionData.summary.successRate}</div>
          </div>
        </div>
      )}

      {/* Additional Summary Info */}
      {sessionData?.summary && (
        <div className="bg-dark-light rounded-xl p-6 border border-gray-700 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Session Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Start URL:</span>
              <a 
                href={sessionData.summary.startUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-primary hover:underline truncate mt-1"
              >
                {sessionData.summary.startUrl}
              </a>
            </div>
            <div>
              <span className="text-gray-500">Max Depth:</span>
              <span className="text-gray-300 ml-2 font-mono">{sessionData.summary.maxDepth}</span>
            </div>
            <div>
              <span className="text-gray-500">Total Duration:</span>
              <span className="text-gray-300 ml-2 font-mono">{sessionData.summary.totalDuration}ms</span>
            </div>
            <div>
              <span className="text-gray-500">Avg Duration:</span>
              <span className="text-gray-300 ml-2 font-mono">{sessionData.summary.avgDuration}ms</span>
            </div>
            <div>
              <span className="text-gray-500">Axios:</span>
              <span className="text-green-400 ml-2 font-mono">{sessionData.summary.methods.axios}</span>
            </div>
            <div>
              <span className="text-gray-500">Puppeteer:</span>
              <span className="text-blue-400 ml-2 font-mono">{sessionData.summary.methods.puppeteer}</span>
            </div>
            {sessionData.summary.crawledAt && (
              <div className="lg:col-span-3">
                <span className="text-gray-500">Crawled At:</span>
                <span className="text-gray-300 ml-2">{new Date(sessionData.summary.crawledAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-white">Crawled Pages</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-dark border border-gray-600 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-primary transition-colors text-white"
          >
            <option value="depth">Depth</option>
            <option value="time">Crawl Time</option>
          </select>
        </div>
      </div>

      {/* Pages List */}
      <div className="space-y-4">
        {sortedPages.map((page, index) => (
          <div
            key={page.id}
            className="bg-dark-light rounded-xl p-5 border border-gray-700 hover:border-primary/30 transition-colors"
          >
            <div className="flex flex-col md:flex-row justify-between gap-4">
              {/* Left: Page Info */}
              <div className="flex-1">
                <div className="flex items-start gap-3 mb-2">
                  <div className={`mt-1 ${page.crawlSuccess ? 'text-green-400' : 'text-red-400'}`}>
                    {page.crawlSuccess ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-semibold mb-1">{page.title}</h4>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm truncate block"
                    >
                      {page.url}
                    </a>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  <div className="flex items-center gap-1 text-gray-400">
                    <Layers className="w-4 h-4" />
                    <span>Depth: <span className="text-white font-mono">{page.depth}</span></span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <Zap className="w-4 h-4" />
                    <span>Method: <span className={`font-mono ${
                      page.method === 'axios' ? 'text-green-400' : 'text-blue-400'
                    }`}>{page.method}</span></span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>Duration: <span className="text-white font-mono">{page.duration}ms</span></span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <LinkIcon className="w-4 h-4" />
                    <span>Links: <span className="text-white font-mono">{page.linksFound}</span></span>
                  </div>
                </div>
              </div>

              {/* Right: Timestamp */}
              <div className="text-xs text-gray-500 md:text-right">
                {new Date(page.crawledAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {sortedPages.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No pages found in this session.
        </div>
      )}
    </div>
  );
};

export default SessionDetails;
