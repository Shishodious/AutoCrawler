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
    <div className="glass-card rounded-2xl p-5 sm:p-6 my-5 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          {crawlStatus === 'running' && <Loader2 className="animate-spin text-primary-soft" size={20} />}
          {crawlStatus === 'complete' && <CheckCircle className="text-success" size={20} />}
          {crawlStatus === 'error' && <XCircle className="text-danger" size={20} />}
          <h3 className="text-lg font-bold text-white m-0">
            {crawlStatus === 'running' && 'Crawl in progress'}
            {crawlStatus === 'complete' && 'Crawl complete'}
            {crawlStatus === 'error' && 'Crawl failed'}
          </h3>
        </div>

        {/* Method Badge */}
        {crawlMethod && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide text-white ${
            crawlMethod === 'axios'
              ? 'bg-gradient-to-r from-primary to-secondary'
              : 'bg-gradient-to-r from-secondary to-accent'
          }`}>
            {crawlMethod === 'axios' ? <Zap size={13} /> : <Chrome size={13} />}
            <span>{crawlMethod === 'axios' ? 'Axios' : 'Puppeteer'}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {crawlStatus === 'running' && (
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 text-sm">{crawlProgress.status || 'Initializing…'}</span>
            <span className="text-primary-soft font-bold text-lg">{crawlProgress.percentage || 0}%</span>
          </div>
          <div className="w-full h-2.5 bg-dark rounded-full overflow-hidden mb-2 border border-hairline">
            <div
              className="h-full bg-gradient-to-r from-primary via-secondary to-accent rounded-full transition-all duration-300 ease-out"
              style={{ width: `${crawlProgress.percentage || 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{crawlProgress.pagesProcessed || 0} / {crawlProgress.totalEstimate || '?'} pages</span>
            {crawlProgress.currentUrl && (
              <span className="italic text-gray-400 truncate max-w-md" title={crawlProgress.currentUrl}>
                {crawlProgress.currentUrl.length > 50
                  ? crawlProgress.currentUrl.substring(0, 50) + '…'
                  : crawlProgress.currentUrl}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Depth Indicator */}
      {currentDepth && currentDepth.currentDepth !== undefined && (
        <div className="bg-dark/60 border border-hairline p-3 rounded-xl mb-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500 font-semibold">Depth</span>
            <span className="text-primary-soft font-bold text-lg">
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
        <details className="bg-dark/60 border border-hairline rounded-xl p-3 mb-4" open={crawlStatus === 'running'}>
          <summary className="cursor-pointer font-semibold text-gray-200 py-1 select-none hover:text-primary-soft transition-colors">
            Links discovered ({linksFound.length})
          </summary>
          <div className="max-h-52 overflow-y-auto mt-3 pr-2 space-y-2 custom-scrollbar">
            {linksFound.slice(-50).reverse().map((link, index) => (
              <div key={index} className="flex items-center gap-3 p-2 bg-dark-soft/60 rounded-lg hover:bg-dark-soft transition-colors">
                <span className="bg-gradient-to-r from-primary to-secondary text-white px-2 py-0.5 rounded text-xs font-bold min-w-[32px] text-center">
                  D{link.depth}
                </span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-gray-400 hover:text-primary-soft text-sm flex items-center gap-2 truncate no-underline transition-colors"
                  title={link.url}
                >
                  <span className="truncate">
                    {link.url.length > 60 ? link.url.substring(0, 60) + '…' : link.url}
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
        <details className="bg-danger/5 border border-danger/30 rounded-xl p-3 mb-4" open>
          <summary className="cursor-pointer font-semibold text-danger py-1 select-none hover:text-rose-300 transition-colors flex items-center gap-2">
            <AlertCircle size={16} />
            Errors ({crawlErrors.length})
          </summary>
          <div className="max-h-52 overflow-y-auto mt-3 pr-2 space-y-2 custom-scrollbar">
            {crawlErrors.map((error, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border-l-4 ${
                  error.fatal
                    ? 'bg-danger/10 border-l-danger'
                    : 'bg-warning/10 border-l-warning'
                }`}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-gray-200 font-semibold text-sm">{error.errorType}</span>
                  {error.fatal && (
                    <span className="bg-danger text-white px-2 py-0.5 rounded text-xs font-bold uppercase">
                      Fatal
                    </span>
                  )}
                </div>
                <div className="text-gray-300 text-sm mb-1">{error.errorMessage}</div>
                {error.failedUrl && (
                  <div className="text-gray-500 text-xs italic truncate" title={error.failedUrl}>
                    {error.failedUrl.length > 70 ? error.failedUrl.substring(0, 70) + '…' : error.failedUrl}
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Completion Stats */}
      {crawlStatus === 'complete' && crawlStats && (
        <div className="bg-dark/60 border border-hairline p-4 rounded-xl">
          <h4 className="text-base font-semibold text-gray-200 mb-4 mt-0">Crawl summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Total pages', value: crawlStats.totalPages || 0 },
              { label: 'Total links', value: crawlStats.totalLinks || 0 },
              { label: 'Duration', value: `${((crawlStats.duration || 0) / 1000).toFixed(2)}s` },
              ...(crawlStats.uniqueDomains !== undefined ? [{ label: 'Unique domains', value: crawlStats.uniqueDomains }] : []),
              ...(crawlStats.averageResponseTime !== undefined ? [{ label: 'Avg response', value: `${crawlStats.averageResponseTime}ms` }] : []),
              ...(crawlStats.successRate ? [{ label: 'Success rate', value: crawlStats.successRate }] : []),
            ].map((stat) => (
              <div key={stat.label} className="bg-dark-soft/60 p-3 rounded-lg flex flex-col gap-1">
                <span className="text-gray-500 text-xs font-semibold">{stat.label}</span>
                <span className="text-primary-soft text-xl font-bold">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CrawlProgressPanel;
