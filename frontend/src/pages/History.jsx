import React, { useEffect, useState } from 'react';
import api from '../api';
import { Calendar, Link as LinkIcon, ExternalLink } from 'lucide-react';

const History = () => {
  const [crawls, setCrawls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.get('/sites');
        setCrawls(response.data);
      } catch (error) {
        console.error('Failed to fetch history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8 text-white flex items-center gap-3">
        <Calendar className="w-8 h-8 text-primary" />
        Crawl History
      </h1>

      <div className="grid gap-6">
        {crawls.map((crawl) => (
          <div key={crawl._id} className="bg-dark-light rounded-xl p-6 border border-gray-700 hover:border-primary/30 transition-colors">
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-semibold text-white mb-1">{crawl.title}</h3>
                <a href={crawl.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-sm">
                  {crawl.url} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="text-gray-400 text-sm font-mono">
                {new Date(crawl.timestamp).toLocaleString()}
              </div>
            </div>
            
            <div className="bg-dark rounded-lg p-4 border border-gray-800">
              <div className="flex items-center gap-2 text-gray-300 mb-2">
                <LinkIcon className="w-4 h-4" />
                <span className="font-semibold">{crawl.links.length} Links Extracted</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {crawl.links.slice(0, 5).map((link, i) => (
                  <span key={i} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded truncate max-w-[200px]">
                    {link}
                  </span>
                ))}
                {crawl.links.length > 5 && (
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">
                    +{crawl.links.length - 5} more
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default History;
