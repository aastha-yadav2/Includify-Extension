/**
 * Base AI Provider Abstract Interface
 * All Includify AI Providers (Gemini, Grok, etc.) must implement this interface.
 */
class BaseAIProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Generates a plain-language simplification, summary, and key points.
   * @param {string} text 
   * @param {object} options { title, url }
   * @returns {Promise<{ simplifiedText: string, summary: string, keyPoints: string[] }>}
   */
  async generateSimplification(text, options = {}) {
    throw new Error(`generateSimplification() must be implemented by ${this.name}`);
  }

  /**
   * Translates text into targetLanguage with optional plain-language simplification.
   * @param {string} text 
   * @param {string} targetLanguage 
   * @param {object} options { targetLanguageName, title, simplify }
   * @returns {Promise<{ translatedText: string, summary: string, keyPoints: string[] }>}
   */
  async translateText(text, targetLanguage, options = {}) {
    throw new Error(`translateText() must be implemented by ${this.name}`);
  }
}

module.exports = BaseAIProvider;
