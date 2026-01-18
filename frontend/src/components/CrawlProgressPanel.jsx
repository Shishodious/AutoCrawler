import React from 'react';
import { Loader2, CheckCircle, XCircle, AlertCircle, ExternalLink, Zap, Chrome } from 'lucide-react';

const CrawlProgressPanel = ({ 
  crawlStatus, 
  crawlProgress, 
  crawlMethod, 
  currentDepth, 
  linksFound, 
  crawlStats, 
  crawlErrors 
}) => {
  if (crawlStatus === 'idle') {
    return null; // Don't show panel when not crawling
  }

  return (
    <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-gray-700 rounded-xl p-5 my-5 shadow-2xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          {crawlStatus === 'running' && <Loader2 className="animate-spin text-blue-400" size={20} />}
          {crawlStatus === 'complete' && <CheckCircle className="text-green-500" size={20} />}
          {crawlStatus === 'error' && <XCircle className="text-red-500" size={20} />}
          <h3 className="text-xl font-semibold text-gray-200 m-0">
            {crawlStatus === 'running' && 'Crawl in Progress'}
            {crawlStatus === 'complete' && 'Crawl Complete'}
            {crawlStatus === 'error' && 'Crawl Failed'}
          </h3>
        </div>
        
        {/* Method Badge */}
        {crawlMethod && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold uppercase ${
            crawlMethod === 'axios' 
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white' 
              : 'bg-gradient-to-r from-pink-400 to-red-500 text-white'
          }`}>
            {crawlMethod === 'axios' ? <Zap size={14} /> : <Chrome size={14} />}
            <span>{crawlMethod === 'axios' ? 'Axios' : 'Puppeteer'}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {crawlStatus === 'running' && (
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 text-sm">{crawlProgress.status || 'Initializing...'}</span>
            <span className="text-blue-400 font-bold text-lg">{crawlProgress.percentage || 0}%</span>
          </div>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${crawlProgress.percentage || 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{crawlProgress.pagesProcessed || 0} / {crawlProgress.totalEstimate || '?'} pages</span>
            {crawlProgress.currentUrl && (
              <span className="italic text-gray-400 truncate max-w-md" title={crawlProgress.currentUrl}>
                {crawlProgress.currentUrl.length > 50 
                  ? crawlProgress.currentUrl.substring(0, 50) + '...' 
                  : crawlProgress.currentUrl}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Depth Indicator */}
      {currentDepth && currentDepth.currentDepth !== undefined && (
        <div className="bg-[#1e1e2e] p-3 rounded-lg mb-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500 font-semibold">Depth:</span>
            <span className="text-blue-400 font-bold text-lg">
              {currentDepth.currentDepth} / {currentDepth.maxDepth}
            </span>
            {currentDepth.pagesAtThisDepth > 0 && (
              <span className="text-gray-400 text-xs">
                ({currentDepth.pagesAtThisDepth} pages at this level)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Links Found Feed */}
      {linksFound && linksFound.length > 0 && (
        <details className="bg-[#1e1e2e] rounded-lg p-3 mb-4" open={crawlStatus === 'running'}>
          <summary className="cursor-pointer font-semibold text-gray-200 py-1 select-none hover:text-blue-400 transition-colors">
            Links Discovered ({linksFound.length})
          </summary>
          <div className="max-h-52 overflow-y-auto mt-3 pr-2 space-y-2 scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-700">
            {linksFound.slice(-50).reverse().map((link, index) => (
              <div key={index} className="flex items-center gap-3 p-2 bg-[#252535] rounded-md hover:bg-[#2a2a3e] transition-colors">
                <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs font-bold min-w-[30px] text-center">
                  D{link.depth}
                </span>
                <a 
                  href={link.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 text-gray-400 hover:text-blue-400 text-sm flex items-center gap-2 truncate no-underline transition-colors"
                  title={link.url}
                >
                  <span className="truncate">
                    {link.url.length > 60 ? link.url.substring(0, 60) + '...' : link.url}
                  </span>
                  <ExternalLink size={12} className="flex-shrink-0" />
                </a>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Errors */}
      {crawlErrors && crawlErrors.length > 0 && (
        <details className="bg-[#2e1e1e] border border-[#4a2a2a] rounded-lg p-3 mb-4" open>
          <summary className="cursor-pointer font-semibold text-red-400 py-1 select-none hover:text-red-300 transition-colors flex items-center gap-2">
            <AlertCircle size={16} />
            Errors ({crawlErrors.length})
          </summary>
          <div className="max-h-52 overflow-y-auto mt-3 pr-2 space-y-2">
            {crawlErrors.map((error, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-md border-l-4 ${
                  error.fatal 
                    ? 'bg-[#3a1a1a] border-l-red-500' 
                    : 'bg-[#3a2a1a] border-l-orange-500'
                }`}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-gray-200 font-semibold text-sm">{error.errorType}</span>
                  {error.fatal && (
                    <span className="bg-red-500 text-white px-2 py-0.5 rounded text-xs font-bold uppercase">
                      Fatal
                    </span>
                  )}
                </div>
                <div className="text-gray-300 text-sm mb-1">{error.errorMessage}</div>
                {error.failedUrl && (
                  <div className="text-gray-500 text-xs italic truncate" title={error.failedUrl}>
                    {error.failedUrl.length > 70 ? error.failedUrl.substring(0, 70) + '...' : error.failedUrl}
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Completion Stats */}
      {crawlStatus === 'complete' && crawlStats && (
        <div className="bg-[#1e1e2e] p-4 rounded-lg">
          <h4 className="text-base font-semibold text-gray-200 mb-4 mt-0">Crawl Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-[#252535] p-3 rounded-md flex flex-col gap-1">
              <span className="text-gray-500 text-xs font-semibold">Total Pages:</span>
              <span className="text-blue-400 text-xl font-bold">{crawlStats.totalPages || 0}</span>
            </div>
            <div className="bg-[#252535] p-3 rounded-md flex flex-col gap-1">
              <span className="text-gray-500 text-xs font-semibold">Total Links:</span>
              <span className="text-blue-400 text-xl font-bold">{crawlStats.totalLinks || 0}</span>
            </div>
            <div className="bg-[#252535] p-3 rounded-md flex flex-col gap-1">
              <span className="text-gray-500 text-xs font-semibold">Duration:</span>
              <span className="text-blue-400 text-xl font-bold">
                {((crawlStats.duration || 0) / 1000).toFixed(2)}s
              </span>
            </div>
            {crawlStats.uniqueDomains !== undefined && (
              <div className="bg-[#252535] p-3 rounded-md flex flex-col gap-1">
                <span className="text-gray-500 text-xs font-semibold">Unique Domains:</span>
                <span className="text-blue-400 text-xl font-bold">{crawlStats.uniqueDomains}</span>
              </div>
            )}
            {crawlStats.averageResponseTime !== undefined && (
              <div className="bg-[#252535] p-3 rounded-md flex flex-col gap-1">
                <span className="text-gray-500 text-xs font-semibold">Avg Response:</span>
                <span className="text-blue-400 text-xl font-bold">{crawlStats.averageResponseTime}ms</span>
              </div>
            )}
            {crawlStats.successRate && (
              <div className="bg-[#252535] p-3 rounded-md flex flex-col gap-1">
                <span className="text-gray-500 text-xs font-semibold">Success Rate:</span>
                <span className="text-blue-400 text-xl font-bold">{crawlStats.successRate}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CrawlProgressPanel;
