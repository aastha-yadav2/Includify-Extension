const GeminiProvider = require('../providers/geminiProvider');
const GrokProvider = require('../providers/grokProvider');

class AIProviderManager {
  constructor() {
    this.primaryName = (process.env.PRIMARY_AI || 'gemini').toLowerCase();
    this.fallbackName = (process.env.FALLBACK_AI || 'grok').toLowerCase();

    // Instantiate providers
    this.providers = {
      gemini: new GeminiProvider(process.env.GEMINI_API_KEY),
      grok: new GrokProvider(process.env.XAI_API_KEY)
    };

    console.log(`[AI Provider Manager] Hierarchy initialized: PRIMARY='${this.primaryName}' | FALLBACK='${this.fallbackName}'`);
  }

  isRetryableError(status) {
    // 429 Rate Limit, 503 Service Unavailable, 504 Deadline Exceeded, network errors (500)
    return [429, 503, 504, 500, 502].includes(status);
  }

  isNonRetryableConfigError(status) {
    // 400 Bad Request, 401 Invalid API Key, 403 Permission Denied
    return [400, 401, 403].includes(status);
  }

  /**
   * Generates AI simplification using Primary provider, with automatic retries and Grok fallback.
   */
  async generateSimplification(text, options = {}) {
    return await this._executeOperation('generateSimplification', [text, options], options);
  }

  /**
   * Generates AI translation using Primary provider, with automatic retries and Grok fallback.
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

    const primaryProvider = this.providers[this.primaryName];
    const fallbackProvider = this.providers[this.fallbackName];

    // --- STEP 1: Attempt Primary Provider ---
    if (primaryProvider && primaryProvider.isConfigured()) {
      console.log(`[AI Provider Manager] Selected primary provider: '${this.primaryName}' for ${methodName}`);
      try {
        const result = await primaryProvider[methodName](...args);
        console.log(`[AI Provider Manager] Primary provider '${this.primaryName}' succeeded.`);
        return {
          success: true,
          provider: this.primaryName,
          fallbackUsed: false,
          ...result
        };
      } catch (primaryErr) {
        const status = primaryErr.status || 500;
        console.warn(`[AI Provider Manager] Primary provider '${this.primaryName}' failed with status [${status}]: ${primaryErr.message}`);

        // Non-retryable configuration errors (400, 401, 403) -> Return config error immediately
        if (this.isNonRetryableConfigError(status)) {
          console.warn(`[AI Provider Manager] Non-retryable configuration error detected (${status}). Stopping fallback chain.`);
          return {
            success: false,
            errorType: 'CONFIGURATION_ERROR',
            status,
            message: `AI Provider configuration error (${status}): ${primaryErr.rawMessage || primaryErr.message}`
          };
        }

        // Retryable error (429, 503, 504) -> Attempt 1 exponential backoff retry with Primary
        if (this.isRetryableError(status)) {
          console.log(`[AI Provider Manager] Retryable error [${status}] detected. Attempting 1 retry with primary '${this.primaryName}' after 300ms...`);
          await new Promise(r => setTimeout(r, 300));
          try {
            const retryResult = await primaryProvider[methodName](...args);
            console.log(`[AI Provider Manager] Primary provider '${this.primaryName}' succeeded on retry.`);
            return {
              success: true,
              provider: this.primaryName,
              fallbackUsed: false,
              ...retryResult
            };
          } catch (retryErr) {
            console.warn(`[AI Provider Manager] Primary provider '${this.primaryName}' retry failed. Activating fallback provider '${this.fallbackName}'...`);
          }
        }
      }
    } else {
      console.warn(`[AI Provider Manager] Primary provider '${this.primaryName}' is not properly configured.`);
    }

    // --- STEP 2: Attempt Fallback Provider ---
    if (fallbackProvider && fallbackProvider.isConfigured() && this.fallbackName !== this.primaryName) {
      console.log(`[AI Provider Manager] Activating fallback provider: '${this.fallbackName}' for ${methodName}...`);
      try {
        const fallbackResult = await fallbackProvider[methodName](...args);
        console.log(`[AI Provider Manager] Fallback provider '${this.fallbackName}' succeeded.`);
        return {
          success: true,
          provider: this.fallbackName,
          fallbackUsed: true,
          fallbackNotice: 'AI provider switched automatically to maintain service.',
          ...fallbackResult
        };
      } catch (fallbackErr) {
        console.error(`[AI Provider Manager] Fallback provider '${this.fallbackName}' also failed:`, fallbackErr.message);
      }
    } else {
      console.warn(`[AI Provider Manager] Fallback provider '${this.fallbackName}' is not configured or unavailable.`);
    }

    // --- STEP 3: Complete AI Failure (Both Providers Failed / Unavailable) ---
    console.error(`[AI Provider Manager] All AI providers failed or unconfigured.`);
    return {
      success: false,
      aiUnavailable: true,
      message: 'AI processing is temporarily unavailable. You can still use Includify\'s accessibility features.'
    };
  }

  /**
   * Simulation mode handler for testing Gemini 429, 503, 401, and Grok failures without hitting quotas
   */
  async _handleSimulation(methodName, args, mode) {
    console.log(`🧪 [AI Simulation Mode Active]: mode='${mode}'`);

    const fallbackProvider = this.providers[this.fallbackName];

    if (mode === '401') {
      return {
        success: false,
        errorType: 'CONFIGURATION_ERROR',
        status: 401,
        message: 'AI Provider configuration error (401): Invalid API Key.'
      };
    }

    if (mode === '429' || mode === '503') {
      console.log(`🧪 Simulated Gemini [${mode}]. Activating fallback provider '${this.fallbackName}'...`);
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
          // If Grok also fails in simulation
        }
      }

      // Mock Grok response if key is not present during test
      return {
        success: true,
        provider: 'grok',
        fallbackUsed: true,
        fallbackNotice: 'AI provider switched automatically to maintain service.',
        simplifiedText: 'Simulated Grok Fallback: Plain language content rendered successfully.',
        translatedText: 'Simulated Grok Fallback: Translated content rendered successfully.',
        summary: 'Simulated Grok Fallback summary.',
        keyPoints: ['Simulated Grok point 1', 'Simulated Grok point 2']
      };
    }

    if (mode === 'all-fail') {
      return {
        success: false,
        aiUnavailable: true,
        message: 'AI processing is temporarily unavailable. You can still use Includify\'s accessibility features.'
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
