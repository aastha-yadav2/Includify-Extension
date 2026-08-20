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
      const err = new Error('Grok/Groq API Key is missing or default');
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
- Preserve original meaning accurately.
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

    return await this._callAIAPI(prompt, trimmedText);
  }

  async translateText(text, targetLanguage = 'hi', options = {}) {
    if (!this.isConfigured()) {
      const err = new Error('Grok/Groq API Key is missing or default');
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

    return await this._callAIAPI(prompt, trimmedText);
  }

  async _callAIAPI(userPrompt, fallbackText) {
    const isGroqKey = this.apiKey.startsWith('gsk_');
    const endpoint = isGroqKey 
      ? 'https://api.groq.com/openai/v1/chat/completions' 
      : 'https://api.x.ai/v1/chat/completions';
    
    const modelName = isGroqKey ? 'openai/gpt-oss-120b' : 'grok-2-latest';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
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
        const err = new Error(`Fallback AI API returned HTTP status ${response.status}: ${errText}`);
        err.status = response.status;
        throw err;
      }

      const data = await response.json();
      const contentStr = data.choices?.[0]?.message?.content;
      if (!contentStr) throw new Error('Fallback AI response body was empty');

      // Clean JSON string
      const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : contentStr);

      return {
        simplifiedText: parsed.simplifiedText || parsed.translatedText || fallbackText,
        translatedText: parsed.translatedText || parsed.simplifiedText || fallbackText,
        summary: parsed.summary || 'Summary unavailable.',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : []
      };
    } catch (err) {
      let status = err.status || 500;
      const parsedErr = new Error(`Fallback Provider Error [${status}]: ${err.message}`);
      parsedErr.status = status;
      throw parsedErr;
    }
  }
}

module.exports = GrokProvider;
