import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { startCrawl, startRecursiveCrawl } from '../api';
import { Play, Loader2, Link as LinkIcon, Wifi, WifiOff, ExternalLink } from 'lucide-react';
import { getSocket } from '../services/socket';

const Home = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [crawlMode, setCrawlMode] = useState('single'); // 'single' | 'recursive'
  const [result, setResult] = useState(null);
  const [recursiveResult, setRecursiveResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Socket.IO states
  const [isConnected, setIsConnected] = useState(false);
  const [socketMessages, setSocketMessages] = useState([]);
  const [socketError, setSocketError] = useState(null);

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
          setSocketMessages(prev => [...prev, `Connected with ID: ${socket.id}`]);
        };

        const handleDisconnect = () => {
          console.log('❌ Socket disconnected');
          setIsConnected(false);
          setSocketMessages(prev => [...prev, 'Disconnected from server']);
        };

        const handleConnectError = (error) => {
          console.error('Connection error:', error);
          setSocketError(error.message);
          setSocketMessages(prev => [...prev, `Connection error: ${error.message}`]);
        };

        const handleServerResponse = (data) => {
          console.log('Received server message:', data);
          setSocketMessages(prev => [...prev, `Server says: ${data}`]);
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectError);
        socket.on('server-response', handleServerResponse);

        setIsConnected(socket.connected);

        return () => {
          socket.off('connect', handleConnect);
          socket.off('disconnect', handleDisconnect);
          socket.off('connect_error', handleConnectError);
          socket.off('server-response', handleServerResponse);
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

  const testSocketMessage = () => {
    try {
      const socket = getSocket();
      if (socket.connected) {
        socket.emit('test-from-client', 'Hello from React!');
        setSocketMessages(prev => [...prev, 'Sent: Hello from React!']);
      } else {
        setSocketMessages(prev => [...prev, 'Error: Socket not connected']);
      }
    } catch (error) {
      setSocketMessages(prev => [...prev, `Error: ${error.message}`]);
    }
  };

  const handleCrawl = async (e) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setRecursiveResult(null);

    try {
      if (crawlMode === 'single') {
        const response = await startCrawl(url);
        setResult(response.data.data);
      } else {
        const response = await startRecursiveCrawl(url, DEFAULT_RECURSIVE_OPTIONS);
        setRecursiveResult(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to crawl website');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Socket Error Banner */}
      {socketError && (
        <div className="mb-4 p-4 rounded-lg border bg-red-900/30 border-red-500 text-red-200">
          <div className="flex items-center gap-2 mb-2">
            <WifiOff className="w-5 h-5" />
            <span className="font-semibold">Socket Connection Failed</span>
          </div>
          <p className="text-sm">{socketError}</p>
          <p className="text-xs mt-2 text-red-300">Please refresh the page or contact support if the issue persists.</p>
        </div>
      )}

      {/* Socket Connection Status Banner */}
      <div className={`mb-4 p-4 rounded-lg border flex items-center justify-between ${
        isConnected 
          ? 'bg-green-900/20 border-green-500/50 text-green-200' 
          : 'bg-red-900/20 border-red-500/50 text-red-200'
      }`}>
        <div className="flex items-center gap-2">
          {isConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          <span className="font-semibold">
            {isConnected ? 'Socket Connected' : 'Socket Disconnected'}
          </span>
        </div>
        <button
          onClick={testSocketMessage}
          disabled={!isConnected}
          className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Test Socket
        </button>
      </div>

      {/* Socket Messages Log */}
      {socketMessages.length > 0 && (
        <div className="mb-4 p-4 bg-dark-light rounded-lg border border-gray-700 max-h-40 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Socket Events Log:</h3>
          {socketMessages.map((msg, idx) => (
            <div key={idx} className="text-xs text-gray-300 font-mono py-1">
              {msg}
            </div>
          ))}
        </div>
      )}

      {/* Main Crawl Form */}
      <div className="bg-dark-light rounded-xl p-8 shadow-lg border border-gray-700 mb-8">
        <h1 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Start New Crawl
        </h1>

        {/* Crawl Mode Toggle */}
        <div className="flex gap-2 mb-6 bg-dark rounded-lg p-1">
          <button
            type="button"
            onClick={() => setCrawlMode('single')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
              crawlMode === 'single'
                ? 'bg-primary text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Single Crawl
          </button>
          <button
            type="button"
            onClick={() => setCrawlMode('recursive')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
              crawlMode === 'recursive'
                ? 'bg-primary text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Recursive Crawl
          </button>
        </div>

        {/* Info about current mode */}
        <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-lg text-sm text-gray-300">
          {crawlMode === 'single' ? (
            <p>Crawl a single page and extract all links from it.</p>
          ) : (
            <p>
                Recursively crawl multiple pages starting from the URL. 
                <br></br>
              <span className="text-primary font-medium"> Default settings: Max Depth: 2, Max Pages: 50, Same Domain Only</span>
            </p>
          )}
        </div>

        <form onSubmit={handleCrawl} className="flex gap-4">
          <input
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 bg-dark border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-primary transition-colors"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-primary hover:bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Play className="w-5 h-5" />}
            Crawl
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Single Crawl Result */}
      {result && crawlMode === 'single' && (
        <div className="bg-dark-light rounded-xl p-8 shadow-lg border border-gray-700 animate-fade-in">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{result.title.length > 10
                    ? result.title.slice(0, 10) + '...'
                    : result.title}</h2>
              <p className="text-gray-400">{result.url}</p>
            </div>
            <div className="bg-primary/20 text-primary px-4 py-2 rounded-full font-mono text-sm">
              {result.links.length} Links Found
            </div>
          </div>
          
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {result.links.slice(0, 5).map((link, index) => (
              <a
                key={index}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-dark rounded-lg border border-gray-700 hover:border-primary/50 transition-colors group"
              >
                <div className="flex items-center gap-3 text-gray-300 group-hover:text-primary">
                  <LinkIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{link}</span>
                </div>
              </a>
            ))}
            {/* show dots if more links exist */}
            {result.links.length > 5 && (
              <div className="text-gray-500 text-sm italic">......</div>
            )}
            <div className="text-gray-500 text-sm italic">For full details, visit the history page</div>
          </div>
        </div>
      )}

      {/* Recursive Crawl Result */}
      {recursiveResult && crawlMode === 'recursive' && (
        <div className="bg-dark-light rounded-xl p-8 shadow-lg border border-gray-700 animate-fade-in">
          <h2 className="text-2xl font-bold text-white mb-6">Recursive Crawl Complete</h2>
          
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-dark rounded-lg p-4 border border-gray-800">
              <div className="text-gray-400 text-sm mb-1">Total Pages</div>
              <div className="text-2xl font-bold text-white">{recursiveResult.summary?.totalPages || 0}</div>
            </div>
            <div className="bg-dark rounded-lg p-4 border border-green-700/30">
              <div className="text-gray-400 text-sm mb-1">Successful</div>
              <div className="text-2xl font-bold text-green-400">{recursiveResult.summary?.successfulPages || 0}</div>
            </div>
            <div className="bg-dark rounded-lg p-4 border border-red-700/30">
              <div className="text-gray-400 text-sm mb-1">Failed</div>
              <div className="text-2xl font-bold text-red-400">{recursiveResult.summary?.failedPages || 0}</div>
            </div>
            <div className="bg-dark rounded-lg p-4 border border-primary/30">
              <div className="text-gray-400 text-sm mb-1">Max Depth</div>
              <div className="text-2xl font-bold text-primary">{recursiveResult.maxDepthReached || 0}</div>
            </div>
          </div>

          {/* Session Info */}
          <div className="bg-dark rounded-lg p-4 border border-gray-800 mb-6">
            <div className="text-sm text-gray-400 mb-2">Session ID</div>
            <div className="text-white font-mono text-sm mb-3">{recursiveResult.crawlSessionId}</div>
            <div className="text-sm text-gray-400 mb-2">Start URL</div>
            <a 
              href={recursiveResult.startUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1 text-sm"
            >
              {recursiveResult.startUrl}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* View Full Session Button */}
          <button
            onClick={() => navigate(`/session/${recursiveResult.crawlSessionId}`)}
            className="w-full bg-primary hover:bg-indigo-600 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            View Full Session Details
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Home;
