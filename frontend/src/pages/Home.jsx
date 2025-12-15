import React, { useState } from 'react';
import api from '../api';
import { Play, Loader2, Link as LinkIcon } from 'lucide-react';

const Home = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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
