/**
 * Predicates for Track A extraction output. Kept out of the component file so
 * fast refresh keeps working (component modules must only export components).
 */

export const hasExtractedContent = (content) =>
  Boolean(content && (content.wordCount > 0 || content.excerpt));

export const hasStructuredData = (structured) =>
  Boolean(
    structured && (
      structured.entities?.length > 0 ||
      (structured.openGraph && Object.keys(structured.openGraph).length > 0) ||
      structured.jsonLd?.length > 0
    )
  );
