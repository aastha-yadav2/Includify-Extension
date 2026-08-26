const BaseAIProvider = require('./baseProvider');

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

class GrokProvider extends BaseAIProvider {
  constructor(apiKey) {
    super('grok');
    this.apiKey = apiKey;
  }

  isConfigured() {
    return !!(this.apiKey && this.apiKey !== 'your_grok_key' && this.apiKey.trim().length > 0);
  }

  async generateSimplification(text, options = {}) {
    if (!this.isConfigured()) {
      const err = new Error('Grok/Groq API Key is missing or default');
      err.status = 401;
      throw err;
    }

    const { title = 'Web Content' } = options;
    const trimmedText = text.trim().substring(0, 2500);

    const prompt = `
You are an expert cognitive accessibility engine for Includify.

TASK:
Simplify the provided content for readers with reading and cognitive difficulties.

REQUIREMENTS:
1. "simplifiedText": Plain-language version of the content using simpler vocabulary and shorter sentences.
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

    const parsed = await this._callAIAPI(prompt, trimmedText);
    const simplifiedText = parsed.simplifiedText || parsed.resultText || trimmedText;

    return {
      operation: 'simplify',
      sourceLanguage: 'en',
      resultText: simplifiedText,
      simplifiedText,
      summary: parsed.summary || 'Summary unavailable.',
      keyPoints: Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0 ? parsed.keyPoints : []
    };
  }

  async translateText(text, targetLanguage = 'hi', options = {}) {
    if (!this.isConfigured()) {
      const err = new Error('Grok/Groq API Key is missing or default');
      err.status = 401;
      throw err;
    }

    const { targetLanguageName = 'Hindi' } = options;
    const trimmedText = text.trim().substring(0, 2500);

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

    const parsed = await this._callAIAPI(prompt, trimmedText);
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
  }

  async _callAIAPI(userPrompt, fallbackText) {
    const isGroqKey = this.apiKey.startsWith('gsk_');
    const endpoint = isGroqKey 
      ? 'https://api.groq.com/openai/v1/chat/completions' 
      : 'https://api.x.ai/v1/chat/completions';
    
    const candidateModels = isGroqKey 
      ? ['openai/gpt-oss-120b', 'groq/compound', 'openai/gpt-oss-20b'] 
      : ['grok-2-latest', 'grok-beta'];

    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        const bodyObj = {
          model: modelName,
          messages: [
            { role: 'system', content: 'You are a precise translation and accessibility engine. Respond ONLY in valid JSON format.' },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          max_tokens: 1500
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bodyObj)
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          console.warn(`[GrokProvider] Model '${modelName}' returned status ${response.status}: ${errText.substring(0, 150)}`);
          lastError = new Error(`HTTP ${response.status}: ${errText}`);
          lastError.status = response.status;
          continue;
        }

        const data = await response.json();
        const contentStr = data.choices?.[0]?.message?.content;
        if (!contentStr) throw new Error('Response body message content was empty');

        const parsed = parseAIJsonResponse(contentStr, fallbackText);
        return parsed;
      } catch (modelErr) {
        lastError = modelErr;
        console.warn(`[GrokProvider] Error executing model '${modelName}': ${modelErr.message}`);
      }
    }

    let status = lastError?.status || 500;
    const parsedErr = new Error(`Grok Provider Error [${status}]: ${lastError?.message || 'All models failed'}`);
    parsedErr.status = status;
    throw parsedErr;
  }
}

module.exports = GrokProvider;
