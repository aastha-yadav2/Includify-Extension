const GeminiProvider = require('../providers/geminiProvider');
const GrokProvider = require('../providers/grokProvider');
const crypto = require('crypto');

class AIProviderManager {
  constructor() {
    this.primaryName = (process.env.PRIMARY_AI || 'gemini').toLowerCase();
    this.fallbackName = (process.env.FALLBACK_AI || 'grok').toLowerCase();

    // Instantiate providers
    this.providers = {
      gemini: new GeminiProvider(process.env.GEMINI_API_KEY),
      grok: new GrokProvider(process.env.XAI_API_KEY)
    };

    // In-memory cache for fast repeated requests (15-min TTL)
    this.cache = new Map();
    this.cacheTTLMs = 15 * 60 * 1000;

    console.log(`[AI Provider Manager] Hierarchy initialized: PRIMARY='${this.primaryName}' | FALLBACK='${this.fallbackName}'`);
  }

  _generateCacheKey(methodName, args) {
    const textStr = args[0] || '';
    const optsStr = JSON.stringify(args[1] || {});
    const hash = crypto.createHash('md5').update(`${methodName}:${textStr}:${optsStr}`).digest('hex');
    return hash;
  }

  _getFromCache(cacheKey) {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.cacheTTLMs) {
      this.cache.delete(cacheKey);
      return null;
    }
    console.log(`⚡ [AI Provider Manager] In-memory cache hit for key: ${cacheKey.substring(0, 8)}`);
    return entry.data;
  }

  _setInCache(cacheKey, data) {
    if (this.cache.size > 200) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, { timestamp: Date.now(), data });
  }

  /**
   * Generates AI simplification using Primary provider (Gemini).
   * If Gemini API key is exhausted, rate-limited, or unavailable, automatically shifts to Grok API key.
   */
  async generateSimplification(text, options = {}) {
    return await this._executeOperation('generateSimplification', [text, options], options);
  }

  /**
   * Generates AI translation using Primary provider (Gemini).
   * If Gemini API key is exhausted, rate-limited, or unavailable, automatically shifts to Grok API key.
   */
  async translateText(text, targetLanguage, options = {}) {
    return await this._executeOperation('translateText', [text, targetLanguage, options], options);
  }

  async _executeOperation(methodName, args, options = {}) {
    const { simulationMode = null } = options;

    // Simulation hooks for automated testing
    if (simulationMode) {
      return await this._handleSimulation(methodName, args, simulationMode);
    }

    // Check cache
    const cacheKey = this._generateCacheKey(methodName, args);
    const cachedRes = this._getFromCache(cacheKey);
    if (cachedRes) {
      return { ...cachedRes, cached: true };
    }

    const primaryProvider = this.providers[this.primaryName];
    const fallbackProvider = this.providers[this.fallbackName];

    // --- STEP 1: Attempt Primary Provider (Gemini) ---
    if (primaryProvider && primaryProvider.isConfigured()) {
      console.log(`[AI Provider Manager] Selected primary provider: '${this.primaryName}' for ${methodName}`);
      try {
        const result = await primaryProvider[methodName](...args);
        console.log(`[AI Provider Manager] Primary provider '${this.primaryName}' succeeded.`);
        const finalRes = {
          success: true,
          provider: this.primaryName,
          fallbackUsed: false,
          ...result
        };
        this._setInCache(cacheKey, finalRes);
        return finalRes;
      } catch (primaryErr) {
        const status = primaryErr.status || 500;
        console.warn(`⚠️ [AI Provider Manager] Gemini API Key exhausted or failed [${status}]: ${primaryErr.message}`);
        console.log(`🔄 [AI Provider Manager] Shifting request to Fallback Provider ('${this.fallbackName}' with XAI_API_KEY)...`);
      }
    } else {
      console.warn(`⚠️ [AI Provider Manager] Primary provider '${this.primaryName}' is not configured or key is uninitialized. Shifting to fallback provider...`);
    }

    // --- STEP 2: Shift to Fallback Provider (Grok / XAI_API_KEY) ---
    if (fallbackProvider && fallbackProvider.isConfigured() && this.fallbackName !== this.primaryName) {
      console.log(`🚀 [AI Provider Manager] Executing request with Fallback Provider: '${this.fallbackName}'...`);
      try {
        const fallbackResult = await fallbackProvider[methodName](...args);
        console.log(`✅ [AI Provider Manager] Fallback provider '${this.fallbackName}' succeeded.`);
        const finalRes = {
          success: true,
          provider: this.fallbackName,
          fallbackUsed: true,
          fallbackNotice: 'AI provider switched automatically to maintain service.',
          ...fallbackResult
        };
        this._setInCache(cacheKey, finalRes);
        return finalRes;
      } catch (fallbackErr) {
        console.error(`❌ [AI Provider Manager] Fallback provider '${this.fallbackName}' also failed:`, fallbackErr.message);
      }
    } else {
      console.warn(`⚠️ [AI Provider Manager] Fallback provider '${this.fallbackName}' is not configured in .env (XAI_API_KEY).`);
    }

    // --- STEP 3: Complete AI Failure (Both Providers Exhausted / Unavailable) ---
    console.error(`❌ [AI Provider Manager] All AI providers exhausted or unconfigured.`);
    return {
      success: false,
      aiUnavailable: true,
      message: 'Unable to process this content right now. Please try again.'
    };
  }

  /**
   * Simulation mode handler for testing Gemini 429, 503, 401, quota exhaustion, and Grok shift
   */
  async _handleSimulation(methodName, args, mode) {
    console.log(`🧪 [AI Simulation Mode Active]: mode='${mode}'`);

    const fallbackProvider = this.providers[this.fallbackName];

    if (mode === '429' || mode === '503' || mode === '401' || mode === 'quota-exhausted') {
      console.log(`⚡ Gemini API key exhausted (${mode}). Shifting automatically to Grok API key ('${this.fallbackName}')...`);
      if (fallbackProvider && fallbackProvider.isConfigured()) {
        try {
          const res = await fallbackProvider[methodName](...args);
          return {
            success: true,
            provider: this.fallbackName,
            fallbackUsed: true,
            fallbackNotice: 'AI provider switched automatically to maintain service.',
            ...res
          };
        } catch (err) {
          // If Grok also fails
        }
      }

      // Mock Grok response if key is not set during local offline test
      return {
        success: true,
        provider: 'grok',
        fallbackUsed: true,
        fallbackNotice: 'AI provider switched automatically to maintain service.',
        simplifiedText: 'Grok Fallback Engine: Gemini key was exhausted. This simplified text was rendered using Grok API key.',
        translatedText: 'Grok Fallback Engine: Gemini key was exhausted. This translated content was rendered using Grok API key.',
        summary: 'Grok Fallback Engine summary rendered after Gemini quota exhaustion.',
        keyPoints: ['Gemini API key quota exhausted', 'Shifted automatically to Grok API key', 'Uninterrupted accessibility service']
      };
    }

    if (mode === 'all-fail') {
      return {
        success: false,
        aiUnavailable: true,
        message: 'Unable to process this content right now. Please try again.'
      };
    }

    return {
      success: false,
      errorType: 'UNKNOWN_SIMULATION',
      message: `Unknown simulation mode '${mode}'`
    };
  }
}

module.exports = new AIProviderManager();
