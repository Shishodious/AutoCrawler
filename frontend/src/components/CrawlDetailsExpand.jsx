import React from 'react';
import { ChevronDown, ChevronUp, Link as LinkIcon, Globe, Lock, Zap, Clock, Layers } from 'lucide-react';

const CrawlDetailsExpand = ({ crawl, isExpanded, onToggle }) => {
  return (
    <div className="mt-4">
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-primary hover:text-indigo-400 transition-colors font-medium"
      >
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {isExpanded ? 'Hide Details' : 'Show Details'}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4 animate-fade-in">
          {/* Metadata Section */}
          {crawl.metadata && (
            <div className="bg-dark rounded-lg p-4 border border-gray-800">
              <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Metadata
              </h4>
              <div className="space-y-2 text-sm">
                {crawl.metadata.description && (
                  <div>
                    <span className="text-gray-500">Description:</span>
                    <p className="text-gray-300 mt-1">{crawl.metadata.description}</p>
                  </div>
                )}
                {crawl.metadata.keywords && crawl.metadata.keywords.length > 0 && (
                  <div>
                    <span className="text-gray-500">Keywords:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {crawl.metadata.keywords.map((keyword, idx) => (
                        <span key={idx} className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {crawl.metadata.author && (
                  <div>
                    <span className="text-gray-500">Author:</span>
                    <span className="text-gray-300 ml-2">{crawl.metadata.author}</span>
                  </div>
                )}
                {crawl.metadata.language && (
                  <div>
                    <span className="text-gray-500">Language:</span>
                    <span className="text-gray-300 ml-2">{crawl.metadata.language}</span>
                  </div>
                )}
                {crawl.metadata.contentType && (
                  <div>
                    <span className="text-gray-500">Content Type:</span>
                    <span className="text-gray-300 ml-2">{crawl.metadata.contentType}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Crawler Stats Section */}
          {crawl.crawlerStats && (
            <div className="bg-dark rounded-lg p-4 border border-gray-800">
              <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Crawler Statistics
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Method:</span>
                  <span className={`ml-2 font-mono ${
                    crawl.crawlerStats.method === 'axios' ? 'text-green-400' : 'text-blue-400'
                  }`}>
                    {crawl.crawlerStats.method}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Duration:</span>
                  <span className="text-gray-300 ml-2 font-mono">{crawl.crawlerStats.duration}ms</span>
                </div>
                <div>
                  <span className="text-gray-500">Depth:</span>
                  <span className="text-gray-300 ml-2 font-mono">{crawl.crawlerStats.depth}</span>
                </div>
                {crawl.crawlerStats.statusCode && (
                  <div>
                    <span className="text-gray-500">Status Code:</span>
                    <span className={`ml-2 font-mono ${
                      crawl.crawlerStats.statusCode === 200 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {crawl.crawlerStats.statusCode}
                    </span>
                  </div>
                )}
                {crawl.crawlerStats.responseSize && (
                  <div>
                    <span className="text-gray-500">Response Size:</span>
                    <span className="text-gray-300 ml-2 font-mono">
                      {(crawl.crawlerStats.responseSize / 1024).toFixed(2)} KB
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SSL Info Section */}
          {crawl.sslInfo && (
            <div className="bg-dark rounded-lg p-4 border border-gray-800">
              <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                SSL Information
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Protocol:</span>
                  <span className={`ml-2 font-mono ${
                    crawl.sslInfo.protocol === 'https' ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {crawl.sslInfo.protocol}
                  </span>
                </div>
                {crawl.sslInfo.tlsVersion && (
                  <div>
                    <span className="text-gray-500">TLS Version:</span>
                    <span className="text-gray-300 ml-2 font-mono">{crawl.sslInfo.tlsVersion}</span>
                  </div>
                )}
                {crawl.sslInfo.certificateValid !== null && (
                  <div>
                    <span className="text-gray-500">Certificate:</span>
                    <span className={`ml-2 font-mono ${
                      crawl.sslInfo.certificateValid ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {crawl.sslInfo.certificateValid ? 'Valid' : 'Invalid'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Detection Info Section */}
          {crawl.detectionInfo && (
            <div className="bg-dark rounded-lg p-4 border border-gray-800">
              <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Detection Information
              </h4>
              <div className="space-y-2 text-sm">
                {crawl.detectionInfo.reason && (
                  <div>
                    <span className="text-gray-500">Reason:</span>
                    <span className="text-gray-300 ml-2">{crawl.detectionInfo.reason}</span>
                  </div>
                )}
                {crawl.detectionInfo.confidence !== undefined && (
                  <div>
                    <span className="text-gray-500">Confidence:</span>
                    <span className="text-gray-300 ml-2 font-mono">{crawl.detectionInfo.confidence}%</span>
                  </div>
                )}
                {crawl.detectionInfo.framework && (
                  <div>
                    <span className="text-gray-500">Framework:</span>
                    <span className="text-gray-300 ml-2">{crawl.detectionInfo.framework}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Links Section */}
          {crawl.links && crawl.links.length > 0 && (
            <div className="bg-dark rounded-lg p-4 border border-gray-800">
              <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Extracted Links ({crawl.links.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {crawl.links.map((link, index) => (
                  <a
                    key={index}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2 bg-gray-900 rounded text-xs text-gray-400 hover:text-primary hover:bg-gray-800 transition-colors truncate"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Timestamp */}
          {crawl.createdAt && (
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Crawled at: {new Date(crawl.createdAt).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CrawlDetailsExpand;
