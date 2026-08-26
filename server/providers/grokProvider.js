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
    const trimmedText = text.trim().substring(0, 2500);

    const prompt = `
You are the AI accessibility engine for Includify.

TASK:
Simplify the provided webpage content for users with cognitive and reading difficulties.

RULES:
- Preserve original meaning, names, dates, numbers, and technical terms accurately.
- Use shorter sentences and simpler vocabulary.
- Do not invent facts or add unrelated information.

Webpage Title: ${title}
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
    const trimmedText = text.trim().substring(0, 2500);

    const prompt = `
You are a precise, direct translator.
Translate the following text into ${targetLanguageName} (language code: ${targetLanguage}).

RULES:
- Output ONLY the translated content into ${targetLanguageName}.
- Do NOT include conversational introductions like "Here is the translation", "Content translated to...", or preambles.
- Do NOT summarize or add explanations.
- Preserve original meaning, facts, and structure accurately.

Text to translate:
"""
${trimmedText}
"""

Respond ONLY with a valid JSON object matching this exact schema:
{
  "translatedText": "..."
}
`;

    return await this._callAIAPI(prompt, trimmedText);
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
          max_tokens: 1200
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

        // Extract JSON string cleanly via regex match
        const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Failed to locate JSON object in model response');

        const parsed = JSON.parse(jsonMatch[0]);

        return {
          simplifiedText: parsed.simplifiedText || parsed.translatedText || fallbackText,
          translatedText: parsed.translatedText || parsed.simplifiedText || fallbackText,
          summary: parsed.summary || 'Summary unavailable.',
          keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : []
        };
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
