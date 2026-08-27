require('dotenv').config();
const express = require('express');
const cors = require('cors');
const aiProviderManager = require('./services/aiProviderManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '5mb' }));

/**
 * Health Check Endpoint
 */
app.get('/api/health', (req, res) => {
  const primary = process.env.PRIMARY_AI || 'gemini';
  const fallback = process.env.FALLBACK_AI || 'grok';
  const geminiOk = aiProviderManager.providers.gemini.isConfigured();
  const grokOk = aiProviderManager.providers.grok.isConfigured();

  res.json({
    status: 'ok',
    app: 'Includify Accessibility Backend',
    version: '2.0.0',
    primaryAI: primary,
    fallbackAI: fallback,
    geminiConfigured: geminiOk,
    grokConfigured: grokOk,
    activeProvider: (aiProviderManager.primaryName === 'grok' && grokOk) ? 'grok' : (geminiOk ? 'gemini' : (grokOk ? 'grok' : 'none')),
    timestamp: new Date().toISOString()
  });
});

/**
 * Core AI Text Simplification Endpoint
 * Provider-agnostic simplification with automatic Gemini -> Grok fallback.
 */
app.post('/api/simplify', async (req, res) => {
  try {
    const { text, title, url, simulate } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid Request',
        message: 'No readable text content provided to simplify.'
      });
    }

    const result = await aiProviderManager.generateSimplification(text, {
      title,
      url,
      simulationMode: simulate || req.query.simulate
    });

    if (!result.success && result.errorType === 'CONFIGURATION_ERROR') {
      return res.status(result.status || 401).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('[Server Error] Simplification handler failed:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process simplification. ' + error.message
    });
  }
});

/**
 * Multilingual Translation Endpoint
 * Provider-agnostic translation with automatic Gemini -> Grok fallback.
 */
app.post('/api/translate', async (req, res) => {
  try {
    const { text, title, targetLanguage = 'hi', targetLanguageName = 'Hindi', simplify = false, simulate } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid Request',
        message: 'No readable text content provided to translate.'
      });
    }

    const result = await aiProviderManager.translateText(text, targetLanguage, {
      title,
      targetLanguageName,
      simplify,
      simulationMode: simulate || req.query.simulate
    });

    if (!result.success && result.errorType === 'CONFIGURATION_ERROR') {
      return res.status(result.status || 401).json(result);
    }

    return res.json({
      targetLanguage,
      targetLanguageName,
      ...result
    });
  } catch (error) {
    console.error('[Server Error] Translation handler failed:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process translation. ' + error.message
    });
  }
});

/**
 * Simulation Testing Endpoint
 * Allows testing Gemini 429, 503, 401, and Grok fallback without exhausting quotas.
 */
app.post('/api/test-ai-fallback', async (req, res) => {
  const { mode = '429', text = 'Includify Provider Fallback System Test' } = req.body;
  
  console.log(`🧪 Testing AI Fallback System with mode: '${mode}'`);
  const result = await aiProviderManager.generateSimplification(text, {
    simulationMode: mode
  });

  res.json(result);
});

/**
 * Interactive Demo Webpage Endpoint
 */
app.get('/demo', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Includify Test Page - Cognitive Accessibility & Web Design</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    header {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: white;
      padding: 2.5rem 1.5rem;
      text-align: center;
    }
    header h1 {
      margin: 0 0 0.5rem 0;
      font-size: 2.2rem;
    }
    main {
      max-width: 800px;
      margin: 2rem auto;
      background: white;
      padding: 2.5rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    h2 {
      color: #334155;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 0.5rem;
    }
    p {
      font-size: 1.1rem;
      margin-bottom: 1.25rem;
    }
  </style>
</head>
<body>
  <header>
    <h1>✨ Includify Demo Webpage</h1>
    <p>Test Cognitive Accessibility, Reading Fonts, AI Simplification & Translation</p>
  </header>
  <main>
    <article>
      <h2>Cognitive Accessibility in Modern Web Applications</h2>
      <p>
        The rapid proliferation of intricate web application architectures has unintentionally introduced significant cognitive friction for neurodivergent individuals. Users experiencing ADHD, dyslexia, or varied reading velocity frequently encounter fatigue when attempting to comprehend multisyllabic vocabulary and syntactically complex sentence structures.
      </p>
      <p>
        Implementing adaptable typography options, contrast customization, and plain-language text transformations measurably reduces cognitive load without forfeiting the fundamental context or informational depth of the original text.
      </p>
    </article>
  </main>
</body>
</html>
  `);
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Includify Backend Server v2.0 running on http://localhost:3000`);
  console.log(`📝 Health Check: http://localhost:3000/api/health`);
  console.log(`🧪 Test Fallback: http://localhost:3000/api/test-ai-fallback`);
  console.log(`====================================================`);
});
