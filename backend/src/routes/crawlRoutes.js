const express = require('express');
const router = express.Router();
const { crawlWebsite } = require('../utils/crawler');
const SiteData = require('../models/SiteData');
const axios = require('axios');
const passport = require('passport');

// POST /api/crawl - Crawl a URL (Protected)
router.post('/crawl', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log(`Starting crawl for: ${url}`);
    const { title, links } = await crawlWebsite(url);

    const siteData = new SiteData({
      url,
      title,
      links
    });

    await siteData.save();
    console.log(`Saved data for: ${url}`);

    // Trigger N8n Webhook (if configured)
    if (process.env.N8N_WEBHOOK_URL) {
      try {
        await axios.post(process.env.N8N_WEBHOOK_URL, {
          url,
          title,
          links,
          timestamp: siteData.timestamp
        });
        console.log('N8n webhook triggered');
      } catch (webhookError) {
        console.error('Failed to trigger N8n webhook:', webhookError.message);
        // Don't fail the request if webhook fails
      }
    }

    res.status(200).json({
      message: 'Crawl successful',
      data: siteData
    });

  } catch (error) {
    console.error('Crawl failed:', error);
    res.status(500).json({ error: 'Failed to crawl website', details: error.message });
  }
});

// GET /api/sites - Get crawl history
router.get('/sites', async (req, res) => {
  try {
    const sites = await SiteData.find().sort({ timestamp: -1 });
    res.status(200).json(sites);
  } catch (error) {
    console.error('Failed to fetch sites:', error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

module.exports = router;
