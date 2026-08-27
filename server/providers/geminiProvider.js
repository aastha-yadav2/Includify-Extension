const BaseAIProvider = require('./baseProvider');
const { GoogleGenAI } = require('@google/genai');

function parseAIJsonResponse(contentStr, fallbackText = '') {
  if (!contentStr || typeof contentStr !== 'string') {
    return { resultText: fallbackText };
  }

  // 1. Remove markdown code block markers
  let cleaned = contentStr.replace(/```json/gi, '').replace(/```/g, '').trim();

  // 2. Try direct JSON parse
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (e1) {
    // 3. Try regex extraction of JSON object {...}
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e2) {
        // Fix unescaped control characters in JSON string
        try {
          const sanitized = jsonMatch[0].replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
          const parsed = JSON.parse(sanitized);
          if (parsed && typeof parsed === 'object') return parsed;
        } catch (e3) {}
      }
    }
  }

  // 4. Regex extraction for resultText, simplifiedText, or translatedText
  const resultMatch = cleaned.match(/"(?:resultText|simplifiedText|translatedText)"\s*:\s*"([\s\S]*?)"\s*[,\}]/i);
  if (resultMatch && resultMatch[1]) {
    return { resultText: resultMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') };
  }

  // 5. If response is plain text (not JSON), use it directly as resultText!
  const plainText = cleaned.replace(/[\{\}\"]/g, '').trim();
  return { resultText: plainText || fallbackText };
}

class GeminiProvider extends BaseAIProvider {
  constructor(apiKey) {
    super('gemini');
    this.apiKey = apiKey;
    this.client = null;

    if (apiKey && apiKey !== 'your_gemini_key' && apiKey !== 'your_gemini_api_key_here') {
      try {
        this.client = new GoogleGenAI({ apiKey });
      } catch (err) {
        console.warn(`[GeminiProvider] Initialization error: ${err.message}`);
      }
    }
  }

  isConfigured() {
    return !!(this.client && this.apiKey);
  }

  async generateSimplification(text, options = {}) {
    if (!this.isConfigured()) {
      const err = new Error('Gemini API Key is missing or default');
      err.status = 401;
      throw err;
    }

    const { title = 'Web Content' } = options;
    const trimmedText = text.trim().substring(0, 3000);

    const prompt = `
You are an expert cognitive accessibility engine for Includify.

TASK:
Simplify the provided content for readers with reading and cognitive difficulties.

REQUIREMENTS:
1. "simplifiedText": Plain-language, easy-to-read version of the content using simpler vocabulary and shorter sentences.
2. "summary": A concise 2-sentence summary of the main idea.
3. "keyPoints": An array of 3 key takeaways.

Preserve original meaning, names, dates, numbers, facts, and technical terms accurately. Do NOT invent facts.

Webpage Title: ${title}
Original Content:
"""
${trimmedText}
"""

Return ONLY a valid JSON object matching this exact schema:
{
  "simplifiedText": "...",
  "summary": "...",
  "keyPoints": ["...", "...", "..."]
}
`;

    try {
      const responseText = await this._generateWithFallback(prompt);
      const parsed = parseAIJsonResponse(responseText, trimmedText);
      const simplifiedText = parsed.simplifiedText || parsed.resultText || trimmedText;

      return {
        operation: 'simplify',
        sourceLanguage: 'en',
        resultText: simplifiedText,
        simplifiedText,
        summary: parsed.summary || 'Summary unavailable.',
        keyPoints: Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0 ? parsed.keyPoints : ['Key point 1', 'Key point 2', 'Key point 3']
      };
    } catch (err) {
      throw this._parseGeminiError(err);
    }
  }

  async translateText(text, targetLanguage = 'hi', options = {}) {
    if (!this.isConfigured()) {
      const err = new Error('Gemini API Key is missing or default');
      err.status = 401;
      throw err;
    }

    const { targetLanguageName = 'Hindi' } = options;
    const trimmedText = text.trim().substring(0, 3000);

    const prompt = `
You are an expert translator and cognitive accessibility assistant.
Translate the following text into ${targetLanguageName} (language code: ${targetLanguage}).

REQUIREMENTS:
1. "translatedText": Complete accurate translation of the text into ${targetLanguageName}.
2. "summary": A concise 2-sentence summary of the content written in ${targetLanguageName}.
3. "keyPoints": An array of 3 key takeaways written in ${targetLanguageName}.

Do NOT include conversational preambles like "Here is the translation".

Text to translate:
"""
${trimmedText}
"""

Respond ONLY with a valid JSON object matching this exact schema:
{
  "translatedText": "...",
  "summary": "...",
  "keyPoints": ["...", "...", "..."]
}
`;

    try {
      const responseText = await this._generateWithFallback(prompt);
      const parsed = parseAIJsonResponse(responseText, trimmedText);
      const translatedText = parsed.translatedText || parsed.resultText || trimmedText;

      return {
        operation: 'translate',
        sourceLanguage: 'en',
        targetLanguage,
        targetLanguageName,
        resultText: translatedText,
        translatedText,
        summary: parsed.summary || `${targetLanguageName} summary unavailable.`,
        keyPoints: Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0 ? parsed.keyPoints : []
      };
    } catch (err) {
      throw this._parseGeminiError(err);
    }
  }

  async _generateWithFallback(prompt) {
    const candidateModels = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastErr = null;

    for (const modelName of candidateModels) {
      try {
        const response = await this.client.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            maxOutputTokens: 2048
          }
        });
        if (response && response.text) return response.text;
      } catch (err) {
        lastErr = err;
        console.warn(`[GeminiProvider] Model '${modelName}' failed: ${err.message}`);
      }
    }

    throw lastErr || new Error('All Gemini candidate models failed');
  }

  _parseGeminiError(err) {
    const msg = (err.message || err.toString() || '').toLowerCase();
    let status = err.status || err.statusCode || 500;

    if (
      msg.includes('429') || 
      msg.includes('resource_exhausted') || 
      msg.includes('quota') || 
      msg.includes('rate limit') ||
      msg.includes('exceeded') ||
      msg.includes('limit reached')
    ) {
      status = 429;
    } else if (msg.includes('503') || msg.includes('unavailable')) {
      status = 503;
    } else if (msg.includes('504') || msg.includes('deadline')) {
      status = 504;
    } else if (msg.includes('401') || msg.includes('api_key') || msg.includes('unauthenticated') || msg.includes('bad request')) {
      status = 401;
    } else if (msg.includes('403') || msg.includes('permission_denied')) {
      status = 403;
    }

    const parsedErr = new Error(`Gemini Provider Error [${status}]: ${err.message || msg}`);
    parsedErr.status = status;
    parsedErr.rawMessage = err.message || msg;
    return parsedErr;
  }
}

module.exports = GeminiProvider;
