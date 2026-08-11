import React from 'react';
import { ChevronDown, ChevronUp, Link as LinkIcon, Globe, Lock, Zap, Clock, Layers, FileText, Boxes } from 'lucide-react';

const sectionClass = "rounded-xl border border-hairline bg-dark/50 p-4";
const sectionTitleClass = "mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300";

const CrawlDetailsExpand = ({ crawl, isExpanded, onToggle }) => {
  return (
    <div className="mt-4">
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-medium text-primary-soft transition-colors hover:text-white"
      >
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {isExpanded ? 'Hide details' : 'Show details'}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4 animate-fade-in">
          {/* Metadata Section */}
          {crawl.metadata && (
            <div className={sectionClass}>
              <h4 className={sectionTitleClass}>
                <Globe className="w-4 h-4 text-primary-soft" />
                Metadata
              </h4>
              <div className="space-y-2 text-sm">
                {crawl.metadata.description && (
                  <div>
                    <span className="text-gray-500">Description</span>
                    <p className="mt-1 text-gray-300">{crawl.metadata.description}</p>
                  </div>
                )}
                {crawl.metadata.keywords && crawl.metadata.keywords.length > 0 && (
                  <div>
                    <span className="text-gray-500">Keywords</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {crawl.metadata.keywords.map((keyword, idx) => (
                        <span key={idx} className="rounded-md border border-hairline bg-dark-soft px-2 py-1 text-xs text-gray-300">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {crawl.metadata.author && (
                  <div>
                    <span className="text-gray-500">Author</span>
                    <span className="ml-2 text-gray-300">{crawl.metadata.author}</span>
                  </div>
                )}
                {crawl.metadata.language && (
                  <div>
                    <span className="text-gray-500">Language</span>
                    <span className="ml-2 text-gray-300">{crawl.metadata.language}</span>
                  </div>
                )}
                {crawl.metadata.contentType && (
                  <div>
                    <span className="text-gray-500">Content type</span>
                    <span className="ml-2 text-gray-300">{crawl.metadata.contentType}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Extracted Content Section */}
          {crawl.content && (crawl.content.wordCount > 0 || crawl.content.excerpt) && (
            <div className={sectionClass}>
              <h4 className={sectionTitleClass}>
                <FileText className="w-4 h-4 text-primary-soft" />
                Extracted content
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-4 text-gray-400">
                  <span>{crawl.content.wordCount || 0} words</span>
                  {crawl.content.author && <span>By {crawl.content.author}</span>}
                  {crawl.content.siteName && <span>{crawl.content.siteName}</span>}
                </div>
                {crawl.content.excerpt && (
                  <p className="text-gray-300 italic border-l-2 border-hairline pl-3">{crawl.content.excerpt}</p>
                )}
                {crawl.content.headings && crawl.content.headings.length > 0 && (
                  <div>
                    <span className="text-gray-500">Headings</span>
                    <ul className="mt-1 list-disc list-inside text-gray-300 max-h-40 overflow-y-auto">
                      {crawl.content.headings.slice(0, 30).map((h, idx) => (
                        <li key={idx}>{typeof h === 'string' ? h : h.text}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Structured Data Section */}
          {crawl.structured && (
            <div className={sectionClass}>
              <h4 className={sectionTitleClass}>
                <Boxes className="w-4 h-4 text-primary-soft" />
                Structured data
              </h4>
              <div className="space-y-2 text-sm">
                {crawl.structured.entities && crawl.structured.entities.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {crawl.structured.entities.slice(0, 20).map((e, idx) => (
                      <span key={idx} className="rounded-md bg-primary/15 px-2 py-1 text-xs text-primary-soft">
                        {e.type}{e.name ? `: ${e.name}` : ''}
                      </span>
                    ))}
                  </div>
                )}
                {crawl.structured.openGraph && Object.keys(crawl.structured.openGraph).length > 0 && (
                  <div className="text-gray-400">
                    {Object.entries(crawl.structured.openGraph).slice(0, 6).map(([k, v]) => (
                      <div key={k}><span className="text-gray-500">{k}:</span> <span className="text-gray-300">{String(v).slice(0, 120)}</span></div>
                    ))}
                  </div>
                )}
                {crawl.structured.jsonLd && crawl.structured.jsonLd.length > 0 && (
                  <p className="text-xs text-gray-500">{crawl.structured.jsonLd.length} JSON-LD block(s) captured</p>
                )}
              </div>
            </div>
          )}

          {/* Crawler Stats Section */}
          {crawl.crawlerStats && (
            <div className={sectionClass}>
              <h4 className={sectionTitleClass}>
                <Zap className="w-4 h-4 text-primary-soft" />
                Crawler statistics
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                <div>
                  <span className="text-gray-500">Method</span>
                  <span className={`ml-2 font-mono ${
                    crawl.crawlerStats.method === 'axios' ? 'text-success' : 'text-accent'
                  }`}>
                    {crawl.crawlerStats.method}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Duration</span>
                  <span className="ml-2 font-mono text-gray-300">{crawl.crawlerStats.duration}ms</span>
                </div>
                <div>
                  <span className="text-gray-500">Depth</span>
                  <span className="ml-2 font-mono text-gray-300">{crawl.crawlerStats.depth}</span>
                </div>
                {crawl.crawlerStats.statusCode && (
                  <div>
                    <span className="text-gray-500">Status code</span>
                    <span className={`ml-2 font-mono ${
                      crawl.crawlerStats.statusCode === 200 ? 'text-success' : 'text-danger'
                    }`}>
                      {crawl.crawlerStats.statusCode}
                    </span>
                  </div>
                )}
                {crawl.crawlerStats.responseSize && (
                  <div>
                    <span className="text-gray-500">Response size</span>
                    <span className="ml-2 font-mono text-gray-300">
                      {(crawl.crawlerStats.responseSize / 1024).toFixed(2)} KB
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SSL Info Section */}
          {crawl.sslInfo && (
            <div className={sectionClass}>
              <h4 className={sectionTitleClass}>
                <Lock className="w-4 h-4 text-primary-soft" />
                SSL information
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                <div>
                  <span className="text-gray-500">Protocol</span>
                  <span className={`ml-2 font-mono ${
                    crawl.sslInfo.protocol === 'https' ? 'text-success' : 'text-warning'
                  }`}>
                    {crawl.sslInfo.protocol}
                  </span>
                </div>
                {crawl.sslInfo.tlsVersion && (
                  <div>
                    <span className="text-gray-500">TLS version</span>
                    <span className="ml-2 font-mono text-gray-300">{crawl.sslInfo.tlsVersion}</span>
                  </div>
                )}
                {crawl.sslInfo.certificateValid !== null && (
                  <div>
                    <span className="text-gray-500">Certificate</span>
                    <span className={`ml-2 font-mono ${
                      crawl.sslInfo.certificateValid ? 'text-success' : 'text-danger'
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
            <div className={sectionClass}>
              <h4 className={sectionTitleClass}>
                <Layers className="w-4 h-4 text-primary-soft" />
                Detection information
              </h4>
              <div className="space-y-2 text-sm">
                {crawl.detectionInfo.reason && (
                  <div>
                    <span className="text-gray-500">Reason</span>
                    <span className="ml-2 text-gray-300">{crawl.detectionInfo.reason}</span>
                  </div>
                )}
                {crawl.detectionInfo.confidence !== undefined && (
                  <div>
                    <span className="text-gray-500">Confidence</span>
                    <span className="ml-2 font-mono text-gray-300">{crawl.detectionInfo.confidence}%</span>
                  </div>
                )}
                {crawl.detectionInfo.framework && (
                  <div>
                    <span className="text-gray-500">Framework</span>
                    <span className="ml-2 text-gray-300">{crawl.detectionInfo.framework}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Links Section */}
          {crawl.links && crawl.links.length > 0 && (
            <div className={sectionClass}>
              <h4 className={sectionTitleClass}>
                <LinkIcon className="w-4 h-4 text-primary-soft" />
                Extracted links ({crawl.links.length})
              </h4>
              <div className="max-h-60 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                {crawl.links.map((link, index) => (
                  <a
                    key={index}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate rounded-lg border border-hairline bg-dark-soft/60 p-2 text-xs text-gray-400 transition-colors hover:border-primary/40 hover:text-primary-soft"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Timestamp */}
          {crawl.createdAt && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              Crawled at {new Date(crawl.createdAt).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CrawlDetailsExpand;
