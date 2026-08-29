import React from 'react';
import { FileText, Boxes } from 'lucide-react';
import { hasExtractedContent, hasStructuredData } from '../utils/extraction';

/**
 * Renders the Track A extraction output — readable page content and structured
 * data. Shared by the History details expander and the Home crawl result card
 * so both surfaces show the same thing and stay in sync.
 */

const sectionClass = "rounded-xl border border-hairline bg-dark/50 p-4";
const sectionTitleClass = "mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300";

export const ExtractedContentSection = ({ content }) => {
  if (!hasExtractedContent(content)) return null;

  return (
    <div className={sectionClass}>
      <h4 className={sectionTitleClass}>
        <FileText className="w-4 h-4 text-primary-soft" />
        Extracted content
      </h4>
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-4 text-gray-400">
          <span>{content.wordCount || 0} words</span>
          {content.author && <span>By {content.author}</span>}
          {content.siteName && <span>{content.siteName}</span>}
        </div>
        {content.excerpt && (
          <p className="text-gray-300 italic border-l-2 border-hairline pl-3">{content.excerpt}</p>
        )}
        {content.headings && content.headings.length > 0 && (
          <div>
            <span className="text-gray-500">Headings</span>
            <ul className="mt-1 list-disc list-inside text-gray-300 max-h-40 overflow-y-auto">
              {content.headings.slice(0, 30).map((h, idx) => (
                <li key={idx}>{typeof h === 'string' ? h : h.text}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export const StructuredDataSection = ({ structured }) => {
  if (!hasStructuredData(structured)) return null;

  return (
    <div className={sectionClass}>
      <h4 className={sectionTitleClass}>
        <Boxes className="w-4 h-4 text-primary-soft" />
        Structured data
      </h4>
      <div className="space-y-2 text-sm">
        {structured.entities && structured.entities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {structured.entities.slice(0, 20).map((e, idx) => (
              <span key={idx} className="rounded-md bg-primary/15 px-2 py-1 text-xs text-primary-soft">
                {e.type}{e.name ? `: ${e.name}` : ''}
              </span>
            ))}
          </div>
        )}
        {structured.openGraph && Object.keys(structured.openGraph).length > 0 && (
          <div className="text-gray-400">
            {Object.entries(structured.openGraph).slice(0, 6).map(([k, v]) => (
              <div key={k}>
                <span className="text-gray-500">{k}:</span>{' '}
                <span className="text-gray-300 break-all">{String(v).slice(0, 120)}</span>
              </div>
            ))}
          </div>
        )}
        {structured.jsonLd && structured.jsonLd.length > 0 && (
          <p className="text-xs text-gray-500">{structured.jsonLd.length} JSON-LD block(s) captured</p>
        )}
      </div>
    </div>
  );
};
