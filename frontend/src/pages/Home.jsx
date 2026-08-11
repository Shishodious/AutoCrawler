import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { startCrawl, startRecursiveCrawl, getCrawlJob } from '../api';
import {
  Play, Loader2, Link as LinkIcon, WifiOff, ExternalLink,
  Globe, FileSearch, Network, RotateCcw, AlertCircle, ArrowRight,
} from 'lucide-react';
import { getSocket } from '../services/socket';
import CrawlProgressPanel from '../components/CrawlProgressPanel';

const Home = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [crawlMode, setCrawlMode] = useState('single'); // 'single' | 'recursive'
  const [result, setResult] = useState(null);
  const [recursiveResult, setRecursiveResult] = useState(null);
  const [error, setError] = useState(null);
  const [lastCrawledUrl, setLastCrawledUrl] = useState(''); // Track last successfully crawled URL
  const crawlingUrlRef = useRef(''); // Ref to track the URL being crawled (for event handlers)

  // Socket.IO states
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);

  // Real-time crawl states
  const [crawlStatus, setCrawlStatus] = useState('idle'); // 'idle' | 'queued' | 'running' | 'complete' | 'error'
  const [crawlProgress, setCrawlProgress] = useState({});
  const [crawlMethod, setCrawlMethod] = useState(null);
  const [currentDepth, setCurrentDepth] = useState(null);
  const [linksFound, setLinksFound] = useState([]);
  const [crawlStats, setCrawlStats] = useState(null);
  const [crawlErrors, setCrawlErrors] = useState([]);

  // Default recursive crawl options
  const DEFAULT_RECURSIVE_OPTIONS = {
    maxDepth: 2,
    maxPages: 50,
    sameDomainOnly: true
  };

  // Setup socket event listeners
  useEffect(() => {
    const setupSocket = () => {
      try {
        const socket = getSocket();

        const handleConnect = () => {
          console.log('✅ Socket connected:', socket.id);
          setIsConnected(true);
          setSocketError(null);
        };

        const handleDisconnect = () => {
          console.log('❌ Socket disconnected');
          setIsConnected(false);
        };

        const handleConnectError = (error) => {
          console.error('Connection error:', error);
          setSocketError(error.message);
        };

        // Crawl event listeners
        const handleCrawlStart = (data) => {
          console.log('🚀 Crawl started:', data);
          setCrawlStatus('running');
          setCrawlProgress({});
          setCrawlMethod(null);
          setCurrentDepth(null);
          setLinksFound([]);
          setCrawlStats(null);
          setCrawlErrors([]);
        };

        const handleMethodDetected = (data) => {
          console.log('🔍 Method detected:', data);
          setCrawlMethod(data.method);
        };

        const handleCrawlProgress = (data) => {
          console.log('📊 Progress:', data);
          setCrawlProgress(data);
        };

        const handleLinkFound = (data) => {
          console.log('🔗 Link found:', data);
          setLinksFound(prev => [...prev, data]);
        };

        const handleDepthChange = (data) => {
          console.log('📏 Depth change:', data);
          setCurrentDepth(data);
        };

        const handleCrawlComplete = (data) => {
          console.log('✅ Crawl complete:', data);
          setCrawlStatus('complete');
          setCrawlStats(data);
          setLastCrawledUrl(crawlingUrlRef.current); // Save the successfully crawled URL from ref
        };

        const handleCrawlError = (data) => {
          console.error('❌ Crawl error:', data);
          setCrawlErrors(prev => [...prev, data]);
          if (data.fatal) {
            setCrawlStatus('error');
          }
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectError);

        // Register crawl event listeners
        socket.on('crawl:start', handleCrawlStart);
        socket.on('crawl:method-detected', handleMethodDetected);
        socket.on('crawl:progress', handleCrawlProgress);
        socket.on('crawl:link-found', handleLinkFound);
        socket.on('crawl:depth-change', handleDepthChange);
        socket.on('crawl:complete', handleCrawlComplete);
        socket.on('crawl:error', handleCrawlError);

        setIsConnected(socket.connected);

        return () => {
          socket.off('connect', handleConnect);
          socket.off('disconnect', handleDisconnect);
          socket.off('connect_error', handleConnectError);

          // Cleanup crawl event listeners
          socket.off('crawl:start', handleCrawlStart);
          socket.off('crawl:method-detected', handleMethodDetected);
          socket.off('crawl:progress', handleCrawlProgress);
          socket.off('crawl:link-found', handleLinkFound);
          socket.off('crawl:depth-change', handleDepthChange);
          socket.off('crawl:complete', handleCrawlComplete);
          socket.off('crawl:error', handleCrawlError);
        };
      } catch (error) {
        console.error('Failed to get socket:', error);
        setSocketError(error.message);
        return undefined;
      }
    };

    const timer = setTimeout(setupSocket, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleCrawl = async (e) => {
    e.preventDefault();
    if (!url) return;

    // Save the URL being crawled to ref for event handlers
    crawlingUrlRef.current = url;

    setLoading(true);
    setError(null);
    setResult(null);
    setRecursiveResult(null);

    // Reset crawl states
    setCrawlStatus('idle');
    setCrawlProgress({});
    setCrawlMethod(null);
    setCurrentDepth(null);
    setLinksFound([]);
    setCrawlStats(null);
    setCrawlErrors([]);

    try {
      const socket = getSocket();
      const socketId = socket?.id;

      // Crawls are queued now: the API returns 202 + jobId immediately,
      // live progress arrives over the socket, and we poll the job for
      // the final result payload.
      if (crawlMode === 'single') {
        const response = await startCrawl(url, {}, socketId);
        setCrawlStatus('queued');
        const job = await pollJob(response.jobId);
        setResult(job.result?.data);
      } else {
        const response = await startRecursiveCrawl(url, DEFAULT_RECURSIVE_OPTIONS, socketId);
        setCrawlStatus('queued');
        const job = await pollJob(response.jobId);
        setRecursiveResult(job.result);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to crawl website');
      setCrawlStatus('error');
    } finally {
      setLoading(false);
    }
  };

  // Poll a crawl job until it reaches a terminal state
  const pollJob = async (jobId) => {
    const POLL_MS = 2000;
    const MAX_TRIES = 300; // ~10 minutes
    for (let i = 0; i < MAX_TRIES; i++) {
      const { data } = await getCrawlJob(jobId);
      if (data.state === 'completed') return data;
      if (data.state === 'failed') {
        throw new Error(data.failedReason || 'Crawl failed');
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    throw new Error('Crawl timed out — check History later for results');
  };

  const isReCrawl = crawlStatus === 'complete' && url === lastCrawledUrl && url !== '';

  return (
    <div className="container mx-auto px-6 py-10 max-w-4xl">
      {/* Hero */}
      <div className="mb-8 text-center animate-fade-in">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          <span className="text-gradient">Map any website</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-gray-400">
          Drop in a URL and AutoCrawler discovers every link in real time — picking the fastest engine for the job.
        </p>
      </div>

      {/* Socket connection error banner */}
      {socketError && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 p-4 text-danger animate-fade-in">
          <WifiOff className="mt-0.5 w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Live connection failed</p>
            <p className="text-sm text-danger/80">{socketError}</p>
            <p className="mt-1 text-xs text-danger/60">Refresh the page to reconnect.</p>
          </div>
        </div>
      )}

      {/* Main crawl card */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 mb-8 animate-slide-up">
        {/* Header row: title + live status */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">New crawl</h2>
          <span
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
              isConnected
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-gray-600 bg-gray-700/20 text-gray-400'
            }`}
            title={isConnected ? 'Real-time updates active' : 'Not connected to live updates'}
          >
            <span className="relative flex h-2 w-2">
              {isConnected && (
                <span className="status-dot-live absolute inline-flex h-2 w-2 rounded-full bg-success" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${isConnected ? 'bg-success' : 'bg-gray-500'}`} />
            </span>
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* Crawl mode segmented control */}
        <div className="mb-5 grid grid-cols-2 gap-1.5 rounded-xl border border-hairline bg-dark/60 p-1.5">
          <button
            type="button"
            onClick={() => setCrawlMode('single')}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              crawlMode === 'single'
                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/25'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileSearch className="w-4 h-4" />
            Single page
          </button>
          <button
            type="button"
            onClick={() => setCrawlMode('recursive')}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              crawlMode === 'recursive'
                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/25'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Network className="w-4 h-4" />
            Recursive
          </button>
        </div>

        {/* Mode info */}
        <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-sm text-gray-300">
          {crawlMode === 'single' ? (
            <p className="flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-primary-soft flex-shrink-0" />
              Crawl a single page and extract every link it contains.
            </p>
          ) : (
            <div className="flex items-start gap-2">
              <Network className="mt-0.5 w-4 h-4 text-primary-soft flex-shrink-0" />
              <p>
                Follow links across multiple pages from the starting URL.
                <span className="mt-1 flex flex-wrap gap-2">
                  {['Max depth: 2', 'Max pages: 50', 'Same domain only'].map((chip) => (
                    <span key={chip} className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary-soft">
                      {chip}
                    </span>
                  ))}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* URL form */}
        <form onSubmit={handleCrawl} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Globe className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-xl border border-hairline bg-dark/60 pl-10 pr-4 py-3 text-white placeholder:text-gray-600 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-glow flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-7 py-3 font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isReCrawl ? <RotateCcw className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            {loading ? 'Crawling…' : isReCrawl ? 'Re-crawl' : 'Crawl'}
          </button>
        </form>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3.5 text-sm text-danger">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Real-Time Crawl Progress Panel */}
      <CrawlProgressPanel
        crawlStatus={crawlStatus}
        crawlProgress={crawlProgress}
        crawlMethod={crawlMethod}
        currentDepth={currentDepth}
        linksFound={linksFound}
        crawlStats={crawlStats}
        crawlErrors={crawlErrors}
      />

      {/* Single Crawl Result */}
      {result && crawlMode === 'single' && (
        <div className="glass-card rounded-2xl p-6 sm:p-8 animate-fade-in">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold text-white" title={result.title}>
                {result.title || 'Untitled page'}
              </h2>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center gap-1 truncate text-sm text-gray-400 hover:text-primary-soft transition-colors"
              >
                <span className="truncate">{result.url}</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
            <div className="flex-shrink-0 rounded-full border border-primary/30 bg-primary/15 px-4 py-1.5 font-mono text-sm font-semibold text-primary-soft">
              {result.links.length} links
            </div>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {result.links.slice(0, 5).map((link, index) => (
              <a
                key={index}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-lg border border-hairline bg-dark/50 p-3 transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex items-center gap-3 text-gray-300 group-hover:text-primary-soft">
                  <LinkIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{link}</span>
                </div>
              </a>
            ))}
            {result.links.length > 5 && (
              <p className="pt-2 text-center text-sm text-gray-500">
                + {result.links.length - 5} more links · view the full list on the History page
              </p>
            )}
          </div>
        </div>
      )}

      {/* Recursive Crawl Result */}
      {recursiveResult && crawlMode === 'recursive' && (
        <div className="glass-card rounded-2xl p-6 sm:p-8 animate-fade-in">
          <h2 className="mb-6 text-2xl font-bold text-white">Recursive crawl complete</h2>

          {/* Summary Stats */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Total pages', value: recursiveResult.summary?.totalPages || 0, accent: 'text-white', ring: 'border-hairline' },
              { label: 'Successful', value: recursiveResult.summary?.successfulPages || 0, accent: 'text-success', ring: 'border-success/30' },
              { label: 'Failed', value: recursiveResult.summary?.failedPages || 0, accent: 'text-danger', ring: 'border-danger/30' },
              { label: 'Max depth', value: recursiveResult.maxDepthReached || 0, accent: 'text-primary-soft', ring: 'border-primary/30' },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border ${s.ring} bg-dark/50 p-4`}>
                <div className="mb-1 text-xs font-medium text-gray-500">{s.label}</div>
                <div className={`text-2xl font-bold ${s.accent}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Session Info */}
          <div className="mb-6 rounded-xl border border-hairline bg-dark/50 p-4">
            <div className="mb-1 text-xs font-medium text-gray-500">Session ID</div>
            <div className="mb-3 break-all font-mono text-sm text-gray-300">{recursiveResult.crawlSessionId}</div>
            <div className="mb-1 text-xs font-medium text-gray-500">Start URL</div>
            <a
              href={recursiveResult.startUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary-soft hover:text-white transition-colors"
            >
              <span className="truncate">{recursiveResult.startUrl}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          </div>

          {/* View Full Session Button */}
          <button
            onClick={() => navigate(`/session/${recursiveResult.crawlSessionId}`)}
            className="btn-glow flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary py-3 font-semibold text-white transition-all hover:brightness-110"
          >
            View full session details
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Home;
