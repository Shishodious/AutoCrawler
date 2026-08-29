/**
 * Report layer — composes a crawled SiteData record into a portable report
 * object and renders it as JSON, Markdown, or PDF. This is what turns raw
 * crawl output into a deliverable.
 */
const PDFDocument = require('pdfkit');

/** Build the normalized report object from a SiteData document. */
function buildReport(site) {
  const s = site.toObject ? site.toObject() : site;
  return {
    url: s.url,
    title: s.title,
    crawledAt: s.createdAt,
    method: s.crawlerStats?.method,
    metadata: {
      description: s.metadata?.description || '',
      author: s.metadata?.author || s.content?.author || '',
      language: s.metadata?.language || '',
      keywords: s.metadata?.keywords || []
    },
    content: s.content
      ? {
          excerpt: s.content.excerpt || '',
          author: s.content.author || '',
          wordCount: s.content.wordCount || 0,
          headings: (s.content.headings || []).map((h) => h.text)
        }
      : null,
    entities: s.structured?.entities || [],
    openGraph: s.structured?.openGraph || {},
    links: {
      total: (s.links || []).length,
      sample: (s.links || []).slice(0, 25)
    }
  };
}

function toMarkdown(report) {
  const lines = [];
  lines.push(`# ${report.title || 'Untitled'}`);
  lines.push('');
  lines.push(`- **URL:** ${report.url}`);
  lines.push(`- **Crawled:** ${report.crawledAt ? new Date(report.crawledAt).toISOString() : 'N/A'}`);
  lines.push(`- **Method:** ${report.method || 'N/A'}`);
  if (report.metadata.author) lines.push(`- **Author:** ${report.metadata.author}`);
  if (report.metadata.language) lines.push(`- **Language:** ${report.metadata.language}`);
  lines.push('');

  if (report.metadata.description) {
    lines.push('## Description');
    lines.push(report.metadata.description);
    lines.push('');
  }

  if (report.content) {
    lines.push('## Content');
    lines.push(`Word count: ${report.content.wordCount}`);
    if (report.content.excerpt) {
      lines.push('');
      lines.push(`> ${report.content.excerpt}`);
    }
    if (report.content.headings.length) {
      lines.push('');
      lines.push('### Headings');
      report.content.headings.forEach((h) => lines.push(`- ${h}`));
    }
    lines.push('');
  }

  if (report.entities.length) {
    lines.push('## Structured Entities');
    report.entities.forEach((e) => lines.push(`- **${e.type}**${e.name ? `: ${e.name}` : ''}`));
    lines.push('');
  }

  lines.push('## Links');
  lines.push(`Total: ${report.links.total}`);
  report.links.sample.forEach((l) => lines.push(`- ${l}`));
  lines.push('');

  return lines.join('\n');
}

/** Stream a PDF of the report to the given writable (res). */
function renderPdf(report, stream) {
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(stream);

  doc.fontSize(20).text(report.title || 'Untitled', { underline: false });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#555').text(report.url);
  doc.fillColor('#000').moveDown();

  doc.fontSize(9).fillColor('#555')
    .text(`Crawled: ${report.crawledAt ? new Date(report.crawledAt).toISOString() : 'N/A'}  ·  Method: ${report.method || 'N/A'}`);
  doc.fillColor('#000').moveDown();

  if (report.metadata.description) {
    doc.fontSize(13).text('Description');
    doc.fontSize(10).text(report.metadata.description);
    doc.moveDown();
  }

  if (report.content) {
    doc.fontSize(13).text('Content');
    doc.fontSize(10).text(`Word count: ${report.content.wordCount}`);
    if (report.content.excerpt) doc.moveDown(0.3).fontSize(10).fillColor('#333').text(report.content.excerpt).fillColor('#000');
    if (report.content.headings.length) {
      doc.moveDown(0.3).fontSize(11).text('Headings');
      doc.fontSize(10);
      report.content.headings.forEach((h) => doc.text(`• ${h}`));
    }
    doc.moveDown();
  }

  if (report.entities.length) {
    doc.fontSize(13).text('Structured Entities');
    doc.fontSize(10);
    report.entities.forEach((e) => doc.text(`• ${e.type}${e.name ? `: ${e.name}` : ''}`));
    doc.moveDown();
  }

  doc.fontSize(13).text('Links');
  doc.fontSize(10).text(`Total: ${report.links.total}`);
  report.links.sample.forEach((l) => doc.fillColor('#0645ad').text(l));
  doc.fillColor('#000');

  doc.end();
}

module.exports = { buildReport, toMarkdown, renderPdf };
