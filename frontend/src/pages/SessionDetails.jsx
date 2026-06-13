import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSession } from '../api';
import {
  ArrowLeft,
  Network,
  CheckCircle,
  XCircle,
  Clock,
  Layers,
  Link as LinkIcon,
  Zap,
  AlertTriangle,
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
      <div className="container mx-auto px-6 py-10 max-w-6xl">
        <div className="h-9 w-72 rounded-lg bg-dark-light shimmer mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-dark-light shimmer" />
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-dark-light shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-6 py-10 max-w-6xl">
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-6 text-danger">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 w-5 h-5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold">Error loading session</h3>
              <p className="text-sm text-danger/80">{error}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/history')}
            className="mt-4 flex items-center gap-2 text-primary-soft hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to history
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
    <div className="container mx-auto px-6 py-10 max-w-6xl">
      {/* Back Button */}
      <button
        onClick={() => navigate('/history')}
        className="mb-6 flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to history
      </button>

      {/* Header */}
      <div className="mb-6 glass-card rounded-2xl p-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-primary/15 border border-primary/25">
            <Network className="w-6 h-6 text-primary-soft" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Recursive crawl session</h1>
            <div className="mt-0.5 break-all font-mono text-xs text-gray-500">{sessionId}</div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {sessionData?.summary && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 stagger">
          {[
            { label: 'Total pages', value: sessionData.summary.totalPages, accent: 'text-white', ring: 'border-hairline' },
            { label: 'Successful', value: sessionData.summary.successfulPages, accent: 'text-success', ring: 'border-success/25' },
            { label: 'Failed', value: sessionData.summary.failedPages, accent: 'text-danger', ring: 'border-danger/25' },
            { label: 'Success rate', value: sessionData.summary.successRate, accent: 'text-primary-soft', ring: 'border-primary/25' },
          ].map((s) => (
            <div key={s.label} className={`glass-card rounded-2xl border ${s.ring} p-4`}>
              <div className="mb-1 text-xs text-gray-500">{s.label}</div>
              <div className={`text-2xl font-bold ${s.accent}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Additional Summary Info */}
      {sessionData?.summary && (
        <div className="mb-6 glass-card rounded-2xl p-6">
          <h3 className="mb-4 text-base font-bold text-white">Session details</h3>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm md:grid-cols-2 lg:grid-cols-3">
            <div className="min-w-0">
              <span className="block text-xs text-gray-500">Start URL</span>
              <a
                href={sessionData.summary.startUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 block truncate text-primary-soft hover:text-white transition-colors"
              >
                {sessionData.summary.startUrl}
              </a>
            </div>
            <div>
              <span className="block text-xs text-gray-500">Max depth</span>
              <span className="mt-0.5 block font-mono text-gray-200">{sessionData.summary.maxDepth}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500">Total duration</span>
              <span className="mt-0.5 block font-mono text-gray-200">{sessionData.summary.totalDuration}ms</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500">Avg duration</span>
              <span className="mt-0.5 block font-mono text-gray-200">{sessionData.summary.avgDuration}ms</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500">Axios pages</span>
              <span className="mt-0.5 block font-mono text-success">{sessionData.summary.methods.axios}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500">Puppeteer pages</span>
              <span className="mt-0.5 block font-mono text-accent">{sessionData.summary.methods.puppeteer}</span>
            </div>
            {sessionData.summary.crawledAt && (
              <div className="lg:col-span-3">
                <span className="block text-xs text-gray-500">Crawled at</span>
                <span className="mt-0.5 block text-gray-300">{new Date(sessionData.summary.crawledAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Crawled pages</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Sort by</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-hairline bg-dark px-3 py-1.5 text-sm text-white transition-colors focus:border-primary focus:outline-none"
          >
            <option value="depth">Depth</option>
            <option value="time">Crawl time</option>
          </select>
        </div>
      </div>

      {/* Pages List */}
      <div className="space-y-4 stagger">
        {sortedPages.map((page) => (
          <div
            key={page.id}
            className="glass-card card-hover rounded-2xl p-5"
          >
            <div className="flex flex-col justify-between gap-4 md:flex-row">
              {/* Left: Page Info */}
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-start gap-3">
                  <div className={`mt-0.5 ${page.crawlSuccess ? 'text-success' : 'text-danger'}`}>
                    {page.crawlSuccess ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate font-semibold text-white" title={page.title}>{page.title || 'Untitled page'}</h4>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm text-primary-soft hover:text-white transition-colors"
                    >
                      {page.url}
                    </a>
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Layers className="w-4 h-4 text-gray-500" />
                    <span>Depth <span className="font-mono text-white">{page.depth}</span></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Zap className="w-4 h-4 text-gray-500" />
                    <span>Method <span className={`font-mono ${page.method === 'axios' ? 'text-success' : 'text-accent'}`}>{page.method}</span></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span>Duration <span className="font-mono text-white">{page.duration}ms</span></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <LinkIcon className="w-4 h-4 text-gray-500" />
                    <span>Links <span className="font-mono text-white">{page.linksFound}</span></span>
                  </div>
                </div>
              </div>

              {/* Right: Timestamp */}
              <div className="flex-shrink-0 font-mono text-xs text-gray-500 md:text-right">
                {new Date(page.crawledAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {sortedPages.length === 0 && (
        <div className="glass-card rounded-2xl py-12 text-center text-gray-500">
          No pages found in this session.
        </div>
      )}
    </div>
  );
};

export default SessionDetails;
