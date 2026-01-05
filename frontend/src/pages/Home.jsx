import React, { useState, useEffect } from 'react';
import api from '../api';
import { Play, Loader2, Link as LinkIcon, Wifi, WifiOff } from 'lucide-react';
import { getSocket } from '../services/socket';

const Home = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  // Socket.IO states
  const [isConnected, setIsConnected] = useState(false);
  const [socketMessages, setSocketMessages] = useState([]);
  const [socketError, setSocketError] = useState(null);


  // Setup socket event listeners
  useEffect(() => {
    // Small delay to ensure AuthGate has initialized the socket
    const setupSocket = () => {
      try {
        const socket = getSocket();

        // Connection event handlers
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

        // Test event listener
        const handleServerResponse = (data) => {
          console.log('Received server message:', data);
          setSocketMessages(prev => [...prev, `Server says: ${data}`]);
        };

        // Attach event listeners
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectError);
        socket.on('server-response', handleServerResponse);

        // Set initial connection state
        setIsConnected(socket.connected);

        // Cleanup listeners on unmount
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

    // Give AuthGate time to initialize socket
    const timer = setTimeout(setupSocket, 100);
    
    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Test function to send message to server
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

    try {
      const response = await api.post('/crawl', { url });
      setResult(response.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to crawl website');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Socket Error Banner - Blocks functionality */}
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
      <div className="bg-dark-light rounded-xl p-8 shadow-lg border border-gray-700 mb-8">
        <h1 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Start New Crawl
        </h1>
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

      {result && (
        <div className="bg-dark-light rounded-xl p-8 shadow-lg border border-gray-700 animate-fade-in">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{result.title}</h2>
              <p className="text-gray-400">{result.url}</p>
            </div>
            <div className="bg-primary/20 text-primary px-4 py-2 rounded-full font-mono text-sm">
              {result.links.length} Links Found
            </div>
          </div>
          
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {result.links.map((link, index) => (
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
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
