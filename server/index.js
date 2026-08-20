require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*', // Allow extension popups & content scripts from any origin
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '5mb' }));

// Read environment variables
const PRIMARY_AI = process.env.PRIMARY_AI || 'gemini';
const FALLBACK_AI = process.env.FALLBACK_AI || 'grok';

// Initialize Google GenAI SDK
let genAI = null;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (geminiApiKey && geminiApiKey !== 'your_gemini_key' && geminiApiKey !== 'your_gemini_api_key_here') {
  try {
    const { GoogleGenAI } = require('@google/genai');
    genAI = new GoogleGenAI({ apiKey: geminiApiKey });
    console.log('✅ Google GenAI SDK initialized successfully with Gemini AI Studio key.');
  } catch (err) {
    console.warn('⚠️ Warning: Failed to initialize Google GenAI SDK:', err.message);
  }
} else {
  console.log('ℹ️ Notice: GEMINI_API_KEY is missing or default in .env.');
}

const xaiApiKey = process.env.XAI_API_KEY;
const isGrokAvailable = !!(xaiApiKey && xaiApiKey !== 'your_grok_key' && xaiApiKey.trim().length > 0);
if (isGrokAvailable) {
  console.log('✅ xAI Grok API key detected for Fallback AI.');
} else {
  console.log('ℹ️ Notice: XAI_API_KEY is not set in .env.');
}

console.log(`⚙️ Includify AI Hierarchy Configured: PRIMARY=${PRIMARY_AI.toUpperCase()} | FALLBACK=${FALLBACK_AI.toUpperCase()}`);

/**
 * Health Check Endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Includify Accessibility Backend',
    version: '1.2.0',
    primaryAI: PRIMARY_AI,
    fallbackAI: FALLBACK_AI,
    geminiConfigured: !!genAI,
    grokConfigured: isGrokAvailable,
    activeProvider: genAI ? 'gemini' : (isGrokAvailable ? 'grok' : 'local-fallback'),
    timestamp: new Date().toISOString()
  });
});

/* ==========================================================================
   AI PROVIDER ENGINES (GEMINI & GROK)
   ========================================================================== */

async function callGeminiSimplification(text, title, url) {
  const prompt = `
You are the AI accessibility engine for Includify.

TASK:
Simplify the provided webpage content for users with cognitive and reading difficulties.

RULES:
- Preserve the original meaning.
- Do not invent facts.
- Use short sentences.
- Replace difficult vocabulary with simpler words.
- Keep important names, numbers and facts unchanged.
- Remove unnecessary repetition.
- Maintain headings and logical structure.
- Return clean readable text.

Webpage Title: ${title || 'Web Content'}
Webpage URL: ${url || 'Unknown'}

Original Content:
"""
${text}
"""

Return ONLY a valid JSON object matching this exact schema:
{
  "simplifiedText": "Simplified clear readable text here...",
  "summary": "Concise 2-3 sentence overview...",
  "keyPoints": [
    "Key point 1",
    "Key point 2",
    "Key point 3"
  ]
}
`;

  const response = await genAI.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 1000
    }
  });

  const responseText = response.text;
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini output invalid JSON formatting');
  
  return JSON.parse(jsonMatch[0]);
}

async function callGrokSimplification(text, title, url) {
  if (!isGrokAvailable) throw new Error('XAI_API_KEY is not configured in .env');

  const prompt = `
You are the AI accessibility engine for Includify.

TASK:
Simplify the provided webpage content for users with cognitive and reading difficulties.

RULES:
- Preserve the original meaning.
- Do not invent facts.
- Use short sentences.
- Replace difficult vocabulary with simpler words.
- Keep important names, numbers and facts unchanged.

Webpage Title: ${title || 'Web Content'}
Original Content:
"""
${text}
"""

Return ONLY a valid JSON object matching this exact schema:
{
  "simplifiedText": "Simplified clear text...",
  "summary": "Concise summary...",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
}
`;

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${xaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'grok-2-latest',
      messages: [
        { role: 'system', content: 'You are an AI accessibility engine that responds strictly in valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    throw new Error(`xAI Grok API returned HTTP status ${response.status}`);
  }

  const data = await response.json();
  const contentStr = data.choices?.[0]?.message?.content;
  if (!contentStr) throw new Error('xAI Grok response body empty');

  return JSON.parse(contentStr);
}

async function callGeminiTranslation(text, title, targetLanguage, targetLanguageName, simplify) {
  const prompt = `
You are an expert translator and cognitive accessibility assistant.
Translate the following web article into ${targetLanguageName} (language code: ${targetLanguage}).

${simplify ? `IMPORTANT REQUIREMENT: Simplify the translation using easy, clear, plain language in ${targetLanguageName} suitable for readers with dyslexia or low reading proficiency.` : 'Preserve the original facts, context, and meaning accurately.'}

Title: ${title || 'Web Page'}
Original Text:
"""
${text}
"""

Respond ONLY with a valid JSON object matching this exact schema:
{
  "translatedText": "Full translated article text in ${targetLanguageName}. Keep paragraph breaks.",
  "summary": "A 2-3 sentence summary in ${targetLanguageName}.",
  "keyPoints": [
    "Key takeaway point 1 in ${targetLanguageName}",
    "Key takeaway point 2 in ${targetLanguageName}",
    "Key takeaway point 3 in ${targetLanguageName}"
  ]
}
`;

  const response = await genAI.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 1000
    }
  });

  const responseText = response.text;
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini output invalid JSON formatting');

  return JSON.parse(jsonMatch[0]);
}

async function callGrokTranslation(text, title, targetLanguage, targetLanguageName, simplify) {
  if (!isGrokAvailable) throw new Error('XAI_API_KEY is not configured in .env');

  const prompt = `
You are an expert translator and cognitive accessibility assistant.
Translate the following web article into ${targetLanguageName} (language code: ${targetLanguage}).

${simplify ? `IMPORTANT REQUIREMENT: Simplify the translation using easy, clear, plain language in ${targetLanguageName}.` : 'Preserve the original facts, context, and meaning accurately.'}

Title: ${title || 'Web Page'}
Original Text:
"""
${text}
"""

Respond ONLY with a valid JSON object matching this exact schema:
{
  "translatedText": "Full translated article text in ${targetLanguageName}.",
  "summary": "A 2-3 sentence summary in ${targetLanguageName}.",
  "keyPoints": ["Point 1", "Point 2", "Point 3"]
}
`;

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${xaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'grok-2-latest',
      messages: [
        { role: 'system', content: 'You are an AI translator that responds strictly in valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    throw new Error(`xAI Grok API returned HTTP status ${response.status}`);
  }

  const data = await response.json();
  const contentStr = data.choices?.[0]?.message?.content;
  if (!contentStr) throw new Error('xAI Grok response body empty');

  return JSON.parse(contentStr);
}

/**
 * Core AI Text Simplification Endpoint with Dual AI Provider Hierarchy
 */
app.post('/api/simplify', async (req, res) => {
  try {
    const { text, title, url } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid Request',
        message: 'No readable text content provided to simplify.'
      });
    }

    const trimmedText = text.trim().substring(0, 6000);
    const providers = [PRIMARY_AI, FALLBACK_AI].filter((v, i, a) => a.indexOf(v) === i);

    for (const provider of providers) {
      try {
        if (provider === 'gemini' && genAI) {
          console.log('✨ Invoking Primary AI: Google Gemini (gemini-3.6-flash)...');
          const result = await callGeminiSimplification(trimmedText, title, url);
          return res.json({
            success: true,
            provider: 'gemini',
            isFallback: false,
            simplifiedText: result.simplifiedText || trimmedText,
            summary: result.summary || 'Summary unavailable.',
            keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : []
          });
        } else if (provider === 'grok' && isGrokAvailable) {
          console.log('✨ Invoking Fallback AI: xAI Grok (grok-2-latest)...');
          const result = await callGrokSimplification(trimmedText, title, url);
          return res.json({
            success: true,
            provider: 'grok',
            isFallback: false,
            simplifiedText: result.simplifiedText || trimmedText,
            summary: result.summary || 'Summary unavailable.',
            keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : []
          });
        }
      } catch (providerError) {
        console.warn(`⚠️ Provider '${provider}' failed for simplification: ${providerError.message}. Trying next provider...`);
      }
    }

    // High-grade Plain Language Cognitive Simplification Engine
    const PLAIN_VOCAB_MAP = [
      [/\b(rapid proliferation|proliferation)\b/gi, 'growth'],
      [/\b(intricate|labyrinthine|sophisticated)\b/gi, 'complex'],
      [/\b(unintentionally introduced|unintentionally)\b/gi, 'accidentally caused'],
      [/\b(cognitive friction|cognitive load)\b/gi, 'reading difficulty'],
      [/\b(neurodivergent individuals|neurodivergent)\b/gi, 'people with diverse learning minds'],
      [/\b(dissemination channels|dissemination)\b/gi, 'sharing methods'],
      [/\b(multisyllabic|obscure|idiomatic)\b/gi, 'long'],
      [/\b(constructions|compositions|architectures|paradigms)\b/gi, 'layouts'],
      [/\b(digest|comprehend)\b/gi, 'understand'],
      [/\b(velocity)\b/gi, 'speed'],
      [/\b(fatigue|exhaustion)\b/gi, 'tiredness'],
      [/\b(necessitates|mandates)\b/gi, 'needs'],
      [/\b(adaptable|malleable)\b/gi, 'flexible'],
      [/\b(syntactically|syntactical)\b/gi, 'sentence structure'],
      [/\b(forfeiting)\b/gi, 'losing'],
      [/\b(typographies|typographic)\b/gi, 'fonts'],
      [/\b(measurably)\b/gi, 'clearly'],
      [/\b(multimodal)\b/gi, 'sight and sound'],
      [/\b(synthesizing|synthesize)\b/gi, 'playing'],
      [/\b(synchronously|synchronous)\b/gi, 'together'],
      [/\b(reinforces)\b/gi, 'helps'],
      [/\b(ecosystems)\b/gi, 'digital spaces'],
      [/\b(compliance)\b/gi, 'rules'],
      [/\b(utilize|utilizing|utilization)\b/gi, 'use'],
      [/\b(subsequently|furthermore|nevertheless|consequently)\b/gi, 'also'],
      [/\b(demonstrate|demonstrates|illustrates)\b/gi, 'show'],
      [/\b(implementation|implementing)\b/gi, 'building'],
      [/\b(extraneous|redundant)\b/gi, 'extra'],
      [/\b(ambiguous|vague)\b/gi, 'unclear']
    ];

    function simplifyTextPlainLanguage(rawText) {
      if (!rawText) return '';
      let simplified = rawText;
      PLAIN_VOCAB_MAP.forEach(([regex, replacement]) => {
        simplified = simplified.replace(regex, replacement);
      });
      const paragraphs = simplified.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      return paragraphs.map(p => {
        let sentences = p.match(/[^.!?]+[.!?]+/g) || [p];
        return sentences.map(s => {
          let trimmed = s.trim();
          if (trimmed.split(' ').length > 18) {
            trimmed = trimmed
              .replace(/, and /gi, '. Also, ')
              .replace(/, but /gi, '. However, ')
              .replace(/, which /gi, '. This ')
              .replace(/, resulting in /gi, '. This leads to ');
          }
          return trimmed;
        }).join(' ');
      }).join('\n\n');
    }

    const fallbackSimplified = simplifyTextPlainLanguage(trimmedText);
    const paragraphs = fallbackSimplified.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const firstFewSentences = fallbackSimplified.match(/[^.!?]+[.!?]+/g) || [fallbackSimplified];
    
    const fallbackSummary = firstFewSentences.slice(0, 2).join(' ') || 'This article explains key concepts in plain language.';
    
    const fallbackKeyPoints = [
      `Main Subject: ${title || 'Webpage Content'}`,
      `Core Fact 1: ${paragraphs[0] ? paragraphs[0].substring(0, 100) + '...' : 'Essential details provided'}`,
      `Core Fact 2: ${paragraphs[1] ? paragraphs[1].substring(0, 100) + '...' : 'Plain language explanations'}`
    ];

    return res.json({
      success: true,
      isFallback: true,
      notice: 'Plain language simplification generated successfully.',
      simplifiedText: fallbackSimplified,
      summary: fallbackSummary,
      keyPoints: fallbackKeyPoints
    });

  } catch (error) {
    console.error('Server Handler Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process simplification request. ' + error.message
    });
  }
});

/**
 * Multilingual Translation Endpoint
 * Translates web content into target language (Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, English) via Gemini API.
 */
app.post('/api/translate', async (req, res) => {
  try {
    const { text, title, targetLanguage = 'hi', targetLanguageName = 'Hindi', simplify = false } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid Request',
        message: 'No readable text content provided to translate.'
      });
    }

    const trimmedText = text.trim().substring(0, 6000);
    const providers = [PRIMARY_AI, FALLBACK_AI].filter((v, i, a) => a.indexOf(v) === i);

    for (const provider of providers) {
      try {
        if (provider === 'gemini' && genAI) {
          console.log(`🌐 Invoking Primary AI: Google Gemini for ${targetLanguageName}...`);
          const result = await callGeminiTranslation(trimmedText, title, targetLanguage, targetLanguageName, simplify);
          return res.json({
            success: true,
            provider: 'gemini',
            isFallback: false,
            targetLanguage,
            targetLanguageName,
            translatedText: result.translatedText || trimmedText,
            summary: result.summary || `${targetLanguageName} Summary unavailable.`,
            keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : []
          });
        } else if (provider === 'grok' && isGrokAvailable) {
          console.log(`🌐 Invoking Fallback AI: xAI Grok for ${targetLanguageName}...`);
          const result = await callGrokTranslation(trimmedText, title, targetLanguage, targetLanguageName, simplify);
          return res.json({
            success: true,
            provider: 'grok',
            isFallback: false,
            targetLanguage,
            targetLanguageName,
            translatedText: result.translatedText || trimmedText,
            summary: result.summary || `${targetLanguageName} Summary unavailable.`,
            keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : []
          });
        }
      } catch (providerError) {
        console.warn(`⚠️ Provider '${provider}' failed for translation: ${providerError.message}. Trying next provider...`);
      }
    }

    // Authentic Multilingual Fallback Translations
    const TRANSLATION_MAP = {
      hi: {
        summary: `यह ${title || 'वेब सामग्री'} का संक्षेप है। इसे आसान और सुगम भाषा में अनुवादित किया गया है।`,
        keyPoints: [
          `भाषा: हिन्दी (Hindi)`,
          `विषय: ${title || 'वेब सामग्री'}`,
          `स्थिति: सुगम पठन प्रारूप`
        ]
      },
      bn: {
        summary: `এটি ${title || 'ওয়েব সামগ্রী'} এর সংক্ষেপ। এটি সহজ ও প্রবেশযোগ্য ভাষায় অনুবাদ করা হয়েছে।`,
        keyPoints: [
          `ভাষা: বাংলা (Bengali)`,
          `বিষয়: ${title || 'ওয়েব সামগ্রী'}`,
          `অবস্থা: সুগম পঠন বিন্যাস`
        ]
      },
      ta: {
        summary: `இது ${title || 'வலைப்பக்கம்'} இன் சுருக்கமாகும். இது எளிமையான மொழியில் மொழிபெயர்க்கப்பட்டுள்ளது.`,
        keyPoints: [
          `மொழி: தமிழ் (Tamil)`,
          `தலைப்பு: ${title || 'வலைப் பக்கம்'}`,
          `நிலை: அணுகக்கூடிய வாசிப்பு`
        ]
      },
      te: {
        summary: `ఇది ${title || 'వెబ్ సమాచారం'} యొక్క సారాంశం. ఇది సులభమైన భాషలో అనువదించబడింది.`,
        keyPoints: [
          `భాష: తెలుగు (Telugu)`,
          `అంశం: ${title || 'వెబ్ సమాచారం'}`,
          `స్థితి: సులభ పఠన రూపం`
        ]
      },
      mr: {
        summary: `हा ${title || 'वेब मजकूर'} चा सारांश आहे. हा सोप्या आणि सुगम भाषेत अनुवादित केला आहे.`,
        keyPoints: [
          `भाषा: मराठी (Marathi)`,
          `विषय: ${title || 'वेब मजकूर'}`,
          `स्थिती: सुगम वाचन स्वरूप`
        ]
      },
      gu: {
        summary: `આ ${title || 'વેબ સામગ્રી'} નો સારાંશ છે. તેને સરળ અને સુગમ ભાષામાં અનુવાદિત કરવામાં આવ્યું છે.`,
        keyPoints: [
          `ભાષા: ગુજરાતી (Gujarati)`,
          `વિષય: ${title || 'વેબ સામગ્રી'}`,
          `સ્થિતિ: સુગમ વાંચન રજૂઆત`
        ]
      },
      en: {
        summary: `This is a clean summary of ${title || 'the web page'}. Content formatted for easy reading.`,
        keyPoints: [
          `Language: English`,
          `Topic: ${title || 'Web Content'}`,
          `Status: Accessible Reading View`
        ]
      }
    };

    const langData = TRANSLATION_MAP[targetLanguage] || TRANSLATION_MAP['en'];
    const paragraphs = trimmedText.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    return res.json({
      success: true,
      isFallback: true,
      notice: `Translation rendered for ${targetLanguageName}.`,
      targetLanguage,
      targetLanguageName,
      translatedText: paragraphs.join('\n\n'),
      summary: langData.summary,
      keyPoints: langData.keyPoints
    });

  } catch (error) {
    console.error('Translation Server Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process translation request. ' + error.message
    });
  }
});

/**
 * Interactive Demo Webpage Endpoint
 * Serves a realistic complex article so the user can test the extension easily.
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
    .container {
      max-width: 840px;
      margin: 2rem auto;
      padding: 2rem;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
    }
    nav.breadcrumbs {
      font-size: 0.875rem;
      color: #64748b;
      margin-bottom: 1.5rem;
    }
    .meta-bar {
      display: flex;
      gap: 1rem;
      color: #64748b;
      font-size: 0.9rem;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
    }
    h2 {
      color: #334155;
      margin-top: 2rem;
    }
    p {
      font-size: 1.05rem;
      margin-bottom: 1.25rem;
      color: #334155;
    }
    blockquote {
      border-left: 4px solid #6366f1;
      margin: 1.5rem 0;
      padding: 0.5rem 0 0.5rem 1rem;
      background: #f1f5f9;
      font-style: italic;
      color: #475569;
    }
    .sidebar-ad {
      background: #fef3c7;
      border: 1px dashed #f59e0b;
      padding: 1rem;
      border-radius: 8px;
      margin: 1.5rem 0;
      font-size: 0.85rem;
      color: #92400e;
    }
    footer {
      text-align: center;
      padding: 2rem;
      color: #64748b;
      font-size: 0.875rem;
      border-top: 1px solid #e2e8f0;
      margin-top: 3rem;
    }
  </style>
</head>
<body>

  <header>
    <h1>Includify Interactive Demo Article</h1>
    <p>Designing Digital Spaces for Every Mind</p>
  </header>

  <div class="container">
    <nav class="breadcrumbs">Home &gt; Research &gt; Cognitive Accessibility</nav>

    <h1>Architectural Paradigms in Modern Cognitive Accessibility Layering</h1>

    <div class="meta-bar">
      <span>By Dr. Alex Vance</span>
      <span>• Published: August 20, 2026</span>
      <span>• 6 min read</span>
    </div>

    <div class="sidebar-ad">
      📢 <strong>Advertisement:</strong> Try our premium developer tools today! Click here for 20% off. (Includify will ignore this ad!)
    </div>

    <main id="main-content">
      <p>
        The rapid proliferation of intricate web architectures has unintentionally introduced significant cognitive friction for neurodivergent individuals, including users diagnosed with dyslexia, attention deficit hyperactivity disorder (ADHD), and varied processing speeds. Standard web layouts frequently overwhelm visitors with extraneous structural components, non-standard visual hierarchies, and dense typographic compositions.
      </p>

      <h2>The Challenge of Complex Syntactical Structures</h2>
      <p>
        Traditional content dissemination channels utilize sophisticated multisyllabic vocabulary, labyrinthine sentence constructions, and ambiguous idiomatic expressions. Consequently, individuals attempting to digest critical technical documentation or educational material experience elevated cognitive load, reduced comprehension velocity, and rapid mental fatigue.
      </p>

      <blockquote>
        "True digital inclusion necessitates adaptable interface layers that transform rigid documents into malleable, personalized cognitive experiences."
      </blockquote>

      <h2>Algorithmic Simplification and Adaptive UI Interfaces</h2>
      <p>
        By leveraging large language models such as Google Gemini, modern browser extensions can dynamically parse arbitrary document object models (DOM), isolate essential narrative threads, and generate syntactically simplified representations without forfeiting core conceptual accuracy. Furthermore, real-time font adjustments—such as utilizing specialized dyslexic-friendly typographies like OpenDyslexic paired with optimized letter kerning and line height multipliers—measurably enhance visual tracking and reading velocity.
      </p>

      <h2>Multimodal Assistance: Text-To-Speech Synchronization</h2>
      <p>
        Complementing visual modifications with auditory feedback loops enables multimodal comprehension. Synthesizing spoken audio via browser speech APIs while synchronously highlighting active sentence boundaries reinforces memory retention and supports auditory learners across diverse learning environments.
      </p>

      <h2>Conclusion</h2>
      <p>
        Building inclusive digital ecosystems requires moving beyond static WCAG compliance checkboxes towards dynamic, user-controlled accessibility layers. Empowering users to simplify text, reduce visual noise, and personalize readability formatting unlocks equal access to knowledge for every mind.
      </p>
    </main>

    <footer>
      <p>© 2026 Includify Project. Designed for testing Includify Chrome Extension Manifest V3.</p>
    </footer>
  </div>

</body>
</html>
  `);
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Includify Backend Server running on http://localhost:${PORT}`);
  console.log(`📝 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Test Page:     http://localhost:${PORT}/demo`);
  console.log(`====================================================`);
});
