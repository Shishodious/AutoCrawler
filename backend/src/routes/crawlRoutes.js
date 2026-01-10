const express = require('express');
const router = express.Router();
const passport = require('passport');
const axios = require('axios');
const mongoose = require('mongoose');

// Import models and utilities
const SiteData = require('../models/SiteData');
const { intelligentCrawl, recursiveCrawl } = require('../utils/hybridCrawler');
const { getErrorType } = require('../utils/errorHandler');
const { 
  crawlRequestSchema,
  recursiveCrawlRequestSchema,
  createSiteDataSchema,
  siteDataQuerySchema 
} = require('../utils/validation');

// ============================================
// POST /api/crawl - Start Hybrid Crawl
// ============================================
router.post('/crawl', async (req, res) => {
  try {
    // Validate request body
    const validationResult = crawlRequestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
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
    
    console.log(`[API] Starting crawl for: ${url}`);
    const startTime = Date.now();

    // Perform intelligent crawl
    const crawlResult = await intelligentCrawl(url, {
      ...options,
      verbose: true
    });

    // Check if crawl was successful
    if (!crawlResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Crawl failed',
        details: {
          type: crawlResult.error?.type || 'UNKNOWN',
          message: crawlResult.error?.message || 'Unknown error occurred'
        }
      });
    }

    // Prepare data for database
    const siteDataPayload = {
      url: crawlResult.url || url,
      title: crawlResult.title || 'Untitled',
      links: crawlResult.links || [],
      metadata: {
        description: crawlResult.metadata?.description || '',
        keywords: crawlResult.metadata?.keywords || [],
        author: crawlResult.metadata?.author || '',
        ogImage: crawlResult.metadata?.ogImage || '',
        favicon: crawlResult.metadata?.favicon || '',
        language: crawlResult.metadata?.language || '',
        contentType: crawlResult.metadata?.contentType || 'text/html'
      },
      crawlerStats: {
        method: crawlResult.method,
        duration: crawlResult.duration,
        depth: options.maxDepth || 0,
        statusCode: crawlResult.statusCode || 200,
        responseSize: crawlResult.responseSize || 0
      },
      sslInfo: {
        protocol: url.startsWith('https') ? 'https' : 'http',
        tlsVersion: crawlResult.tlsVersion || 'N/A',
        certificateValid: crawlResult.certificateValid || null
      },
      crawlSuccess: true
    };

    // Add userId only if user is authenticated
    if (req.user?.id) {
      siteDataPayload.userId = req.user.id;
    }

    // Validate data before saving
    const dataValidation = createSiteDataSchema.safeParse(siteDataPayload);
    
    if (!dataValidation.success) {
      console.error('[API] Data validation failed:', dataValidation.error);
      // Still try to save with minimal data
      const minimalData = {
        url,
        title: crawlResult.title || 'Untitled',
        links: crawlResult.links || [],
        crawlerStats: {
          method: crawlResult.method,
          duration: crawlResult.duration,
          depth: 0
        },
        sslInfo: {
          protocol: url.startsWith('https') ? 'https' : 'http'
        }
      };
      
      // Add userId only if user is authenticated
      if (req.user?.id) {
        minimalData.userId = req.user.id;
      }
      
      const siteData = new SiteData(minimalData);
      await siteData.save();
      
      return res.status(200).json({
        success: true,
        message: 'Crawl completed (partial data saved)',
        data: siteData,
        warning: 'Some metadata could not be validated'
      });
    }

    // Save to database
    const siteData = new SiteData(dataValidation.data);
    await siteData.save();
    
    console.log(`[API] Saved crawl data for: ${url} (ID: ${siteData._id})`);

    // // Trigger N8n Webhook (if configured)
    // if (process.env.N8N_WEBHOOK_URL) {
    //   try {
    //     await axios.post(process.env.N8N_WEBHOOK_URL, {
    //       url,
    //       title: siteData.title,
    //       links: siteData.links,
    //       method: crawlResult.method,
    //       duration: crawlResult.duration,
    //       timestamp: siteData.createdAt
    //     });
    //     console.log('[API] N8n webhook triggered');
    //   } catch (webhookError) {
    //     console.error('[API] Failed to trigger N8n webhook:', webhookError.message);
    //     // Don't fail the request if webhook fails
    //   }`
    // }

    // Return success response with method stats
    res.status(200).json({
      success: true,
      message: 'Crawl completed successfully',
      data: {
        id: siteData._id,
        url: siteData.url,
        title: siteData.title,
        links: siteData.links,
        metadata: siteData.metadata,
        crawlerStats: siteData.crawlerStats,
        sslInfo: siteData.sslInfo,
        detectionInfo: {
          reason: crawlResult.detectionReason || 'N/A',
          confidence: crawlResult.confidence || 0,
          framework: crawlResult.framework || null
        },
        crawlSuccess: siteData.crawlSuccess,
        crawledAt: siteData.createdAt
      }
    });

  } catch (error) {
    const errorType = getErrorType(error);
    console.error('[API] Crawl failed:', errorType, error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to crawl website',
      details: {
        type: errorType,
        message: error.message
      }
    });
  }
});

// ============================================
// POST /api/crawl/recursive - Start Recursive Crawl
// ============================================
router.post('/crawl/recursive', async (req, res) => {
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
    
    console.log(`[API] Starting recursive crawl from: ${url}`);
    console.log(`[API] Options: maxDepth=${options.maxDepth}, maxPages=${options.maxPages}, sameDomainOnly=${options.sameDomainOnly}`);
    
    const startTime = Date.now();

    // Perform recursive crawl
    const crawlResult = await recursiveCrawl(url, {
      ...options,
      verbose: true
    });

    // Check if crawl was successful
    if (!crawlResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Recursive crawl failed',
        details: {
          message: 'Crawl did not complete successfully'
        }
      });
    }

    // Generate crawl session ID to group all pages together
    const crawlSessionId = new mongoose.Types.ObjectId();
    
    console.log(`[API] Crawl complete. Saving ${crawlResult.results.length} pages to database...`);
    console.log(`[API] Session ID: ${crawlSessionId}`);

    // Save all crawled pages to database
    const savedPages = [];
    const failedPages = [];
    
    for (const pageResult of crawlResult.results) {
      try {
        // Only save successful crawls
        if (pageResult.success) {
          const siteDataPayload = {
            url: pageResult.url || url,
            title: pageResult.title || 'Untitled',
            links: pageResult.links || [],
            metadata: {
              description: pageResult.metadata?.description || pageResult.description || '',
              keywords: pageResult.metadata?.keywords || [],
              author: pageResult.metadata?.author || '',
              ogImage: pageResult.metadata?.ogImage || '',
              favicon: pageResult.metadata?.favicon || '',
              language: pageResult.metadata?.language || '',
              contentType: pageResult.metadata?.contentType || 'text/html'
            },
            crawlerStats: {
              method: pageResult.method,
              duration: pageResult.duration,
              depth: pageResult.depth,
              statusCode: pageResult.statusCode || 200,
              responseSize: pageResult.responseSize || 0
            },
            sslInfo: {
              protocol: pageResult.url?.startsWith('https') ? 'https' : 'http',
              tlsVersion: pageResult.tlsVersion || 'N/A',
              certificateValid: pageResult.certificateValid || null
            },
            crawlSuccess: true,
            crawlSessionId: crawlSessionId
          };

          // Add userId only if user is authenticated
          if (req.user?.id) {
            siteDataPayload.userId = req.user.id;
          }

          const siteData = new SiteData(siteDataPayload);
          await siteData.save();
          savedPages.push(siteData._id);
          
        } else {
          // Track failed pages
          failedPages.push({
            url: pageResult.url,
            depth: pageResult.depth,
            error: pageResult.error
          });
        }
      } catch (saveError) {
        console.error(`[API] Failed to save page ${pageResult.url}:`, saveError.message);
        failedPages.push({
          url: pageResult.url,
          depth: pageResult.depth,
          error: { type: 'SAVE_ERROR', message: saveError.message }
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    
    console.log(`[API] Saved ${savedPages.length} pages successfully`);
    console.log(`[API] Failed to save ${failedPages.length} pages`);
    console.log(`[API] Total duration: ${totalDuration}ms`);

    // Return success response with comprehensive summary
    res.status(200).json({
      success: true,
      message: 'Recursive crawl completed successfully',
      crawlSessionId: crawlSessionId.toString(),
      summary: {
        ...crawlResult.summary,
        totalDuration,
        savedPages: savedPages.length,
        failedToSave: failedPages.length
      },
      startUrl: crawlResult.startUrl,
      baseUrl: crawlResult.baseUrl,
      maxDepthReached: crawlResult.maxDepthReached,
      savedPageIds: savedPages,
      failedPages: failedPages.length > 0 ? failedPages : undefined
    });

  } catch (error) {
    const errorType = getErrorType(error);
    console.error('[API] Recursive crawl failed:', errorType, error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to perform recursive crawl',
      details: {
        type: errorType,
        message: error.message
      }
    });
  }
});

// ============================================
// GET /api/sites - Fetch All Crawls with Filters
// ============================================
router.get('/sites', async (req, res) => {
  try {
    // Validate query parameters
    const validationResult = siteDataQuerySchema.safeParse(req.query);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validationResult.error.errors
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

    // Build query
    const query = {};
    if (url) query.url = url;
    if (crawlSuccess !== undefined) query.crawlSuccess = crawlSuccess;
    if (method) query['crawlerStats.method'] = method;
    if (errorType) query.errorType = errorType;
    if (userId) query.userId = userId;
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
router.get('/sites/:id', async (req, res) => {
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
// GET /api/stats - Crawl Statistics
// ============================================
router.get('/stats', async (req, res) => {
  try {
    // Get overall stats using static method
    const overallStats = await SiteData.getCrawlStats();

    // Get method breakdown
    const methodBreakdown = await SiteData.aggregate([
      { $group: { _id: '$crawlerStats.method', count: { $sum: 1 } } }
    ]);

    // Get error breakdown
    const errorBreakdown = await SiteData.aggregate([
      { $match: { crawlSuccess: false } },
      { $group: { _id: '$errorType', count: { $sum: 1 } } }
    ]);

    // Format breakdowns
    const methodStats = {};
    methodBreakdown.forEach(item => {
      methodStats[item._id] = item.count;
    });

    const errorStats = {};
    errorBreakdown.forEach(item => {
      errorStats[item._id] = item.count;
    });

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
router.delete('/sites/:id', async (req, res) => {
  try {
    const { id } = req.params;

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
router.get('/crawl/sessions/:sessionId', async (req, res) => {
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

    // Find all pages from this crawl session
    const pages = await SiteData.find({ crawlSessionId: sessionId })
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
