const BaseAIProvider = require('./baseProvider');

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
      const err = new Error('xAI Grok API Key is missing or default');
      err.status = 401;
      throw err;
    }

    const { title = 'Web Content', url = 'Unknown' } = options;
    const trimmedText = text.trim().substring(0, 6000);

    const prompt = `
You are the AI accessibility engine for Includify.

TASK:
Simplify the provided webpage content for users with cognitive and reading difficulties.

RULES:
- Preserve original meaning.
- Do not invent facts.
- Use short sentences.
- Replace difficult vocabulary with simpler words.
- Keep important names, numbers and facts unchanged.

Webpage Title: ${title}
Webpage URL: ${url}

Original Content:
"""
${trimmedText}
"""

Return ONLY a valid JSON object matching this exact schema:
{
  "simplifiedText": "...",
  "summary": "...",
  "keyPoints": ["...", "..."]
}
`;

    return await this._callGrokAPI(prompt, trimmedText);
  }

  async translateText(text, targetLanguage = 'hi', options = {}) {
    if (!this.isConfigured()) {
      const err = new Error('xAI Grok API Key is missing or default');
      err.status = 401;
      throw err;
    }

    const { targetLanguageName = 'Hindi', title = 'Web Content', simplify = false } = options;
    const trimmedText = text.trim().substring(0, 6000);

    const prompt = `
You are an expert translator and cognitive accessibility assistant.
Translate the following web article into ${targetLanguageName} (language code: ${targetLanguage}).

${simplify ? `IMPORTANT REQUIREMENT: Simplify the translation using easy, clear, plain language in ${targetLanguageName}.` : 'Preserve original facts, context, and meaning accurately.'}

Title: ${title}
Original Text:
"""
${trimmedText}
"""

Respond ONLY with a valid JSON object matching this exact schema:
{
  "translatedText": "...",
  "summary": "...",
  "keyPoints": ["...", "..."]
}
`;

    return await this._callGrokAPI(prompt, trimmedText);
  }

  async _callGrokAPI(userPrompt, fallbackText) {
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-2-latest',
          messages: [
            { role: 'system', content: 'You are an AI accessibility assistant that responds strictly in valid JSON.' },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        const err = new Error(`xAI Grok API returned HTTP status ${response.status}: ${errText}`);
        err.status = response.status;
        throw err;
      }

      const data = await response.json();
      const contentStr = data.choices?.[0]?.message?.content;
      if (!contentStr) throw new Error('xAI Grok response body was empty');

      const parsed = JSON.parse(contentStr);
      return {
        simplifiedText: parsed.simplifiedText || parsed.translatedText || fallbackText,
        translatedText: parsed.translatedText || parsed.simplifiedText || fallbackText,
        summary: parsed.summary || 'Summary unavailable.',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : []
      };
    } catch (err) {
      let status = err.status || 500;
      const parsedErr = new Error(`Grok Provider Error [${status}]: ${err.message}`);
      parsedErr.status = status;
      throw parsedErr;
    }
  }
}

module.exports = GrokProvider;
