const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import models and utilities
const SiteData = require('../models/SiteData');
const ExtractTemplate = require('../models/ExtractTemplate');
const { emitCrawlEvent } = require('../services/socketService');
const extractSocketId = require('../middleware/socketIdMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const { enqueueCrawlJob, getCrawlQueue } = require('../queue/crawlQueue');
const { buildReport, toMarkdown, renderPdf } = require('../utils/report/generateReport');
//only 2 routes need to extract socket id
const {
  crawlRequestSchema,
  recursiveCrawlRequestSchema,
  siteDataQuerySchema,
  extractRequestSchema,
  extractTemplateSchema
} = require('../utils/validation');

// ============================================
// POST /api/crawl - Enqueue Hybrid Crawl
// Crawls now run in the worker process; this returns 202 + jobId
// immediately and progress streams over Socket.IO via the Redis relay.
// ============================================
router.post('/crawl', authMiddleware, extractSocketId, async (req, res) => {
  try {
    // Validate request body
    const validationResult = crawlRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    const { url, options } = validationResult.data;

    const job = await enqueueCrawlJob('single', {
      url,
      options,
      userId: req.user?.id || null,
      socketId: req.socketId
    });

    console.log(`[API] Enqueued single crawl for: ${url} (job ${job.id})`);

    // Immediate feedback while the job waits for a worker slot
    emitCrawlEvent('crawl:queued', { jobId: job.id, url }, req.socketId);

    res.status(202).json({
      success: true,
      jobId: job.id,
      status: 'queued',
      message: 'Crawl queued. Poll GET /api/crawl/jobs/:jobId or listen on Socket.IO for progress.'
    });
  } catch (error) {
    console.error('[API] Failed to enqueue crawl:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to enqueue crawl',
      details: { message: error.message }
    });
  }
});

// ============================================
// POST /api/crawl/recursive - Enqueue Recursive Crawl
// ============================================
router.post('/crawl/recursive', authMiddleware, extractSocketId, async (req, res) => {
  try {
    // Validate request body
    const validationResult = recursiveCrawlRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    const { url, options } = validationResult.data;

    const job = await enqueueCrawlJob('recursive', {
      url,
      options,
      userId: req.user?.id || null,
      socketId: req.socketId
    });

    console.log(`[API] Enqueued recursive crawl for: ${url} (job ${job.id})`);

    emitCrawlEvent('crawl:queued', { jobId: job.id, url }, req.socketId);

    res.status(202).json({
      success: true,
      jobId: job.id,
      status: 'queued',
      message: 'Recursive crawl queued. Poll GET /api/crawl/jobs/:jobId or listen on Socket.IO for progress.'
    });
  } catch (error) {
    console.error('[API] Failed to enqueue recursive crawl:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to enqueue recursive crawl',
      details: { message: error.message }
    });
  }
});

// ============================================
// GET /api/crawl/jobs/:jobId - Crawl Job Status & Result
// ============================================
router.get('/crawl/jobs/:jobId', authMiddleware, async (req, res) => {
  try {
    const job = await getCrawlQueue().getJob(req.params.jobId);

    // 404 for unknown jobs AND other users' jobs (don't leak existence)
    if (!job || (job.data.userId && job.data.userId !== req.user?.id)) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    const state = await job.getState();

    res.status(200).json({
      success: true,
      jobId: job.id,
      type: job.name,
      url: job.data.url,
      state,
      result: state === 'completed' ? job.returnvalue : null,
      failedReason: state === 'failed' ? job.failedReason : null,
      enqueuedAt: new Date(job.timestamp).toISOString()
    });
  } catch (error) {
    console.error('[API] Failed to fetch job status:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job status',
      details: { message: error.message }
    });
  }
});

// ============================================
// POST /api/extract - Schema-driven field extraction (enqueued)
// ============================================
router.post('/extract', authMiddleware, extractSocketId, async (req, res) => {
  try {
    const validationResult = extractRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors });
    }

    let { url, mode, fields, selectors, templateId } = validationResult.data;

    // A template supplies fields/selectors/mode when referenced
    if (templateId) {
      const template = await ExtractTemplate.findOne({ _id: templateId, userId: req.user?.id });
      if (!template) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      mode = mode || template.mode;
      fields = fields || template.fields;
      selectors = selectors || template.selectors;
    }

    const job = await enqueueCrawlJob('extract', {
      url,
      mode: mode || 'auto',
      fields: fields || [],
      selectors: selectors || null,
      userId: req.user?.id || null,
      socketId: req.socketId
    });

    emitCrawlEvent('crawl:queued', { jobId: job.id, url }, req.socketId);

    res.status(202).json({
      success: true,
      jobId: job.id,
      status: 'queued',
      message: 'Extraction queued. Poll GET /api/crawl/jobs/:jobId for the result.'
    });
  } catch (error) {
    console.error('[API] Failed to enqueue extraction:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to enqueue extraction',
      details: { message: error.message }
    });
  }
});

// ============================================
// Extraction Templates CRUD
// ============================================
router.get('/extract/templates', authMiddleware, async (req, res) => {
  try {
    const templates = await ExtractTemplate.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch templates' });
  }
});

router.post('/extract/templates', authMiddleware, async (req, res) => {
  try {
    const validationResult = extractTemplateSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors });
    }
    const template = await ExtractTemplate.create({ ...validationResult.data, userId: req.user.id });
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    console.error('[API] Failed to create template:', error.message);
    res.status(500).json({ success: false, error: 'Failed to create template' });
  }
});

router.delete('/extract/templates/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await ExtractTemplate.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete template' });
  }
});

// ============================================
// GET /api/sites - Fetch All Crawls with Filters
// ============================================
router.get('/sites', authMiddleware, async (req, res) => {
  try {
    // Validate query parameters
    const validationResult = siteDataQuerySchema.safeParse(req.query);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validationResult.error.issues
      });
    }

    const { 
      url, 
      crawlSuccess, 
      method, 
      errorType, 
      userId, 
      limit, 
      skip 
    } = validationResult.data;

    // Additional query params for sorting and searching
    const sortBy = req.query.sortBy || 'createdAt';
    const order = req.query.order === 'asc' ? 1 : -1;
    const search = req.query.search || '';

    // Build query — always scope to the logged-in user
    const query = { userId: req.user.id };
    if (url) query.url = url;
    if (crawlSuccess !== undefined) query.crawlSuccess = crawlSuccess;
    if (method) query['crawlerStats.method'] = method;
    if (errorType) query.errorType = errorType;
    if (search) {
      query.$or = [
        { url: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count for pagination
    const total = await SiteData.countDocuments(query);

    // Fetch sites with filters and sorting
    const sites = await SiteData.find(query)
      .sort({ [sortBy]: order })
      .limit(limit)
      .skip(skip)
      .select('-__v'); // Exclude version key

    res.status(200).json({
      success: true,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + sites.length < total,
        currentPage: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        url,
        crawlSuccess,
        method,
        errorType,
        search,
        sortBy,
        order: order === 1 ? 'asc' : 'desc'
      },
      data: sites
    });

  } catch (error) {
    console.error('[API] Failed to fetch sites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sites',
      details: error.message
    });
  }
});

// ============================================
// GET /api/sites/:id - Fetch Single Crawl
// ============================================
router.get('/sites/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const site = await SiteData.findById(id).select('-__v');

    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'Site not found',
        details: `No crawl data found with ID: ${id}`
      });
    }

    // Prevent cross-user access — only the owner may view a crawl
    if (site.userId?.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. You can only view your own crawls.'
      });
    }

    res.status(200).json({
      success: true,
      data: site
    });

  } catch (error) {
    console.error('[API] Failed to fetch site:', error);
    
    // Handle invalid ObjectId format
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid site ID format',
        details: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch site',
      details: error.message
    });
  }
});

// ============================================
// GET /api/sites/:id/report - Report / export (json | md | pdf)
// ============================================
router.get('/sites/:id/report', authMiddleware, async (req, res) => {
  try {
    const format = (req.query.format || 'json').toLowerCase();
    const site = await SiteData.findById(req.params.id).select('-__v');

    if (!site) {
      return res.status(404).json({ success: false, error: 'Site not found' });
    }
    if (site.userId?.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, error: 'Forbidden. You can only export your own crawls.' });
    }

    const report = buildReport(site);
    const safeName = `report-${req.params.id}`;

    if (format === 'md' || format === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.md"`);
      return res.send(toMarkdown(report));
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
      return renderPdf(report, res);
    }

    // Default: JSON
    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error('[API] Failed to build report:', error.message);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, error: 'Invalid site ID format' });
    }
    res.status(500).json({ success: false, error: 'Failed to build report' });
  }
});

// ============================================
// GET /api/stats - Crawl Statistics
// ============================================
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userFilter = { userId: req.user.id };

    // Per-user overall stats
    const total = await SiteData.countDocuments(userFilter);
    const successful = await SiteData.countDocuments({ ...userFilter, crawlSuccess: true });
    const failed = await SiteData.countDocuments({ ...userFilter, crawlSuccess: false });

    const avgDurationResult = await SiteData.aggregate([
      { $match: { ...userFilter, crawlSuccess: true } },
      { $group: { _id: null, avgDuration: { $avg: '$crawlerStats.duration' } } }
    ]);

    const overallStats = {
      total,
      successful,
      failed,
      successRate: total > 0 ? ((successful / total) * 100).toFixed(2) + '%' : '0%',
      avgDuration: avgDurationResult.length > 0 ? avgDurationResult[0].avgDuration : 0
    };

    // Per-user method breakdown
    const methodBreakdown = await SiteData.aggregate([
      { $match: userFilter },
      { $group: { _id: '$crawlerStats.method', count: { $sum: 1 } } }
    ]);

    // Per-user error breakdown
    const errorBreakdown = await SiteData.aggregate([
      { $match: { ...userFilter, crawlSuccess: false } },
      { $group: { _id: '$errorType', count: { $sum: 1 } } }
    ]);

    const methodStats = {};
    methodBreakdown.forEach(item => { methodStats[item._id] = item.count; });

    const errorStats = {};
    errorBreakdown.forEach(item => { errorStats[item._id] = item.count; });

    res.status(200).json({
      success: true,
      stats: {
        ...overallStats,
        methodBreakdown: methodStats,
        errorBreakdown: errorStats
      }
    });

  } catch (error) {
    console.error('[API] Failed to fetch stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      details: error.message
    });
  }
});

// ============================================
// DELETE /api/sites/:id - Delete Crawl
// ============================================
router.delete('/sites/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Find first to check ownership
    const site = await SiteData.findById(id);
    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'Site not found',
        details: `No crawl data found with ID: ${id}`
      });
    }

    // Prevent cross-user deletions
    if (site.userId?.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. You can only delete your own crawls.'
      });
    }

    const deletedSite = await SiteData.findByIdAndDelete(id);
    if (!deletedSite) {
      return res.status(404).json({
        success: false,
        error: 'Site not found',
        details: `No crawl data found with ID: ${id}`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Crawl data deleted successfully',
      data: {
        id: deletedSite._id,
        url: deletedSite.url,
        deletedAt: new Date()
      }
    });

  } catch (error) {
    console.error('[API] Failed to delete site:', error);
    
    // Handle invalid ObjectId format
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid site ID format',
        details: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete site',
      details: error.message
    });
  }
});

// ============================================
// GET /api/crawl/sessions/:sessionId - Get Crawl Session
// ============================================
router.get('/crawl/sessions/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Validate sessionId format
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID format',
        details: 'Session ID must be a valid MongoDB ObjectId'
      });
    }

    // Find all pages from this crawl session — scoped to the logged-in user
    const pages = await SiteData.find({ crawlSessionId: sessionId, userId: req.user.id })
      .sort({ 'crawlerStats.depth': 1, createdAt: 1 })
      .select('-__v');
    
    if (pages.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Crawl session not found',
        details: `No pages found for session ID: ${sessionId}`
      });
    }

    // Calculate session summary statistics
    const successfulPages = pages.filter(p => p.crawlSuccess);
    const failedPages = pages.filter(p => !p.crawlSuccess);
    
    const summary = {
      totalPages: pages.length,
      successfulPages: successfulPages.length,
      failedPages: failedPages.length,
      successRate: pages.length > 0 
        ? ((successfulPages.length / pages.length) * 100).toFixed(2) + '%' 
        : '0%',
      methods: {
        axios: pages.filter(p => p.crawlerStats?.method === 'axios').length,
        puppeteer: pages.filter(p => p.crawlerStats?.method === 'puppeteer').length
      },
      maxDepth: Math.max(...pages.map(p => p.crawlerStats?.depth || 0)),
      totalDuration: pages.reduce((sum, p) => sum + (p.crawlerStats?.duration || 0), 0),
      avgDuration: successfulPages.length > 0
        ? Math.round(successfulPages.reduce((sum, p) => sum + (p.crawlerStats?.duration || 0), 0) / successfulPages.length)
        : 0,
      startUrl: pages[0]?.url,
      crawledAt: pages[0]?.createdAt
    };

    res.status(200).json({
      success: true,
      sessionId,
      summary,
      pages: pages.map(page => ({
        id: page._id,
        url: page.url,
        title: page.title,
        depth: page.crawlerStats?.depth,
        method: page.crawlerStats?.method,
        duration: page.crawlerStats?.duration,
        linksFound: page.links?.length || 0,
        crawlSuccess: page.crawlSuccess,
        crawledAt: page.createdAt
      }))
    });

  } catch (error) {
    console.error('[API] Failed to fetch crawl session:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch crawl session',
      details: error.message
    });
  }
});

module.exports = router;
