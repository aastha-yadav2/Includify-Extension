/**
 * Includify Content Script Engine
 */

(function () {
  if (window.__includifyInitialized) return;
  window.__includifyInitialized = true;

  console.log('✨ [Includify] Content script injected & ready.');

  // Global State
  let currentSettings = {
    fontSize: 100,
    fontFamily: 'default',
    lineSpacing: 1.6,
    letterSpacing: 0,
    paragraphSpacing: 1.5,
    contrastMode: 'normal',
    readingSpeed: 1.0,
    focusMode: false,
    dyslexiaMode: false
  };

  let ttsUtterance = null;
  let ttsSentences = [];
  let ttsCurrentIndex = 0;
  let isTtsPlaying = false;
  let isTtsPaused = false;
  let ttsRate = 1.0;

  // Load initial settings on load
  chrome.storage.sync.get([
    'fontSize', 'fontFamily', 'enableReadingFont', 'lineSpacing',
    'letterSpacing', 'paragraphSpacing', 'contrastMode',
    'readingSpeed', 'focusMode', 'dyslexiaMode'
  ], (stored) => {
    if (stored) {
      currentSettings = { ...currentSettings, ...stored };
      applyAllSettings(currentSettings);
    }
  });

  // Listen for Runtime Messages from Popup and Background Worker
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('✨ [Includify] Message received:', message.type);

    switch (message.type) {
      case 'SIMPLIFY_CONTENT':
        handleSimplifyAction();
        break;
      case 'TRANSLATE_CONTENT':
        handleTranslateAction(message.targetLanguage, message.targetLanguageName, message.simplify);
        break;
      case 'TOGGLE_FOCUS_MODE':
        toggleFocusMode(message.enabled);
        break;
      case 'TOGGLE_DYSLEXIA_MODE':
        toggleDyslexiaMode(message.enabled);
        break;
      case 'SET_CONTRAST_MODE':
        setContrastMode(message.mode);
        break;
      case 'UPDATE_TYPOGRAPHY':
        updateTypography(message);
        break;
      case 'TTS_PLAY':
        handleTtsPlay(message.rate);
        break;
      case 'TTS_PAUSE':
        handleTtsPause();
        break;
      case 'TTS_STOP':
        handleTtsStop();
        break;
      case 'TTS_UPDATE_RATE':
        handleTtsUpdateRate(message.rate);
        break;
      case 'SET_READING_FONT':
        setReadingFont(message.font, message.enabled);
        break;
      case 'RESET_ACCESSIBILITY':
        resetAccessibility();
        break;
    }

    sendResponse({ status: 'ACK' });
    return true;
  });

  /* ==========================================================================
     1c. ACCESSIBILITY READING FONT ENGINE
     ========================================================================== */

  function setReadingFont(fontKey, enabled = true) {
    currentSettings.fontFamily = fontKey;
    currentSettings.enableReadingFont = enabled;

    // Remove all Includify reading font classes from document.body
    document.body.classList.remove(
      'includify-font-default',
      'includify-font-opendyslexic',
      'includify-font-lexend',
      'includify-font-atkinson',
      'includify-font-verdana',
      'includify-font-noto'
    );

    if (enabled && fontKey && fontKey !== 'default') {
      document.body.classList.add(`includify-font-${fontKey}`);
    }
  }

  // MutationObserver for dynamic content additions
  const fontObserver = new MutationObserver(() => {
    if (currentSettings.enableReadingFont && currentSettings.fontFamily && currentSettings.fontFamily !== 'default') {
      if (!document.body.classList.contains(`includify-font-${currentSettings.fontFamily}`)) {
        document.body.classList.add(`includify-font-${currentSettings.fontFamily}`);
      }
    }
  });

  if (document.body) {
    fontObserver.observe(document.body, { childList: true, subtree: true });
  }

  /* ==========================================================================
     1. DOM CONTENT EXTRACTOR (CLEAN READABLE TEXT ONLY)
     ========================================================================== */

  // Helper: Check if element is visible in rendered DOM
  function isElementVisible(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && el.children.length === 0) {
      return false;
    }

    return true;
  }

  // Helper: Test if string contains CSS/JS code artifacts
  function isCodeOrCssArtifact(text) {
    if (!text || text.length === 0) return true;

    // Matches CSS rules, class declarations, style blocks, variable names
    const cssPatterns = [
      /\{[\s\S]*?\}/,                 // e.g. {margin:0px; overflow:hidden}
      /\.[a-zA-Z0-9_-]+\s*\{/,        // e.g. .OSrXXb{
      /#[\w-]+\s*\{/,                 // e.g. #search{
      /--[a-zA-Z0-9_-]+:/,            // e.g. --gyu5L:
      /\b(font-family|font-size|background-color|text-overflow|line-height|margin-top|padding-left|z-index|box-shadow|display:flex|position:absolute)\b/i,
      /var\(--[a-zA-Z0-9_-]+\)/,      // e.g. var(--ztTqPe)
      /function\s*\(|\bvar\s+\w+=|\bconst\s+\w+=|\blet\s+\w+=/i // JS keywords
    ];

    return cssPatterns.some(pattern => pattern.test(text));
  }

  function extractMainContent() {
    let rawParagraphs = [];
    let pageTitle = document.title || 'Webpage Content';
    
    // Clean Title
    const h1 = document.querySelector('h1');
    if (h1 && isElementVisible(h1) && h1.innerText.trim().length > 0) {
      pageTitle = h1.innerText.trim();
    }

    // -------------------------------------------------------------
    // Scenario A: Google Search & Web Application Pages
    // -------------------------------------------------------------
    if (window.location.hostname.includes('google.')) {
      // Extract Google Search Result Snippets & Featured Answers
      const searchSelectors = [
        '.VwiC3b',             // Main result snippet text
        '.hgKElc',             // Featured snippet answer
        'div[data-attrid]',    // Knowledge graph / AI card
        '.OSrXXb',             // Title / heading text
        '.BNeawe',             // Mobile Google snippets
        '#rso p', '#rso h3'    // Paragraphs and result headings
      ];

      searchSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (isElementVisible(el)) {
            const text = (el.innerText || el.textContent).trim();
            if (text.length > 20 && !isCodeOrCssArtifact(text)) {
              rawParagraphs.push(text);
            }
          }
        });
      });
    }

    // -------------------------------------------------------------
    // Scenario B: Standard Webpages, News, Blogs, Wikipedia
    // -------------------------------------------------------------
    if (rawParagraphs.length === 0) {
      // 1. Identify Candidate Container
      const containers = [
        document.querySelector('article'),
        document.querySelector('main'),
        document.querySelector('[role="main"]'),
        document.querySelector('#main-content'),
        document.querySelector('#content'),
        document.querySelector('.post-content'),
        document.querySelector('.article-content'),
        document.querySelector('.entry-content'),
        document.querySelector('#bodyContent') // Wikipedia
      ].filter(el => el && isElementVisible(el));

      let primaryContainer = containers[0];

      // 2. If no semantic container, scan for element containing highest count of visible <p> tags
      if (!primaryContainer) {
        const divs = Array.from(document.querySelectorAll('div, section'));
        let maxCount = 0;

        divs.forEach(div => {
          if (!isElementVisible(div)) return;
          if (div.closest('nav, header, footer, aside, .ad, .sidebar, .comments, #includify-root, #includify-focus-reader-root')) return;

          const pList = Array.from(div.querySelectorAll('p')).filter(p => isElementVisible(p) && p.innerText.trim().length > 30);
          if (pList.length > maxCount) {
            maxCount = pList.length;
            primaryContainer = div;
          }
        });
      }

      if (!primaryContainer) {
        primaryContainer = document.body;
      }

      // 3. Extract text ONLY from visible readable elements inside candidate container
      const readableElements = primaryContainer.querySelectorAll('h1, h2, h3, h4, p, li, blockquote');
      
      readableElements.forEach(el => {
        // Skip elements inside nav, footer, script, style, ad, or Includify overlay
        if (el.closest('script, style, noscript, svg, nav, footer, header, aside, .ad, .sidebar, #includify-root, #includify-focus-reader-root')) {
          return;
        }

        if (isElementVisible(el)) {
          const text = (el.innerText || el.textContent).trim();
          if (text.length > 15 && !isCodeOrCssArtifact(text)) {
            rawParagraphs.push(text);
          }
        }
      });
    }

    // -------------------------------------------------------------
    // Sanitization & Deduplication Pass
    // -------------------------------------------------------------
    const cleanParagraphs = [];
    const seen = new Set();

    rawParagraphs.forEach(p => {
      // Normalize whitespace
      const normalized = p.replace(/\s+/g, ' ').trim();
      
      // Reject if too short, repeated, or contains code/CSS syntax
      if (
        normalized.length >= 15 && 
        !seen.has(normalized) && 
        !isCodeOrCssArtifact(normalized)
      ) {
        seen.add(normalized);
        cleanParagraphs.push(normalized);
      }
    });

    const finalText = cleanParagraphs.join('\n\n');

    // Debug Log as requested by specification
    console.log("INCLUDIFY CLEAN EXTRACTED TEXT:", finalText);

    // Fallback if no readable content found
    if (finalText.length < 30) {
      return {
        title: pageTitle,
        url: window.location.href,
        text: "No readable article content detected. Select text or use Includify on an article page."
      };
    }

    return {
      title: pageTitle,
      url: window.location.href,
      text: finalText
    };
  }

  /* ==========================================================================
     2. AI TEXT SIMPLIFICATION & READER OVERLAY
     ========================================================================== */

  async function handleSimplifyAction() {
    let extracted = extractMainContent();

    // Secondary fallback for pages without standard article container
    if (!extracted.text || extracted.text.length < 30 || extracted.text.includes('No readable article content detected')) {
      const fallbackParagraphs = Array.from(document.querySelectorAll('p, div, span, section'))
        .filter(el => isElementVisible(el) && !el.closest('#includify-root, #includify-focus-reader-root, script, style, nav, footer, header'))
        .map(el => (el.innerText || el.textContent || '').trim())
        .filter(t => t.length > 25 && !isCodeOrCssArtifact(t));

      const uniqueParagraphs = Array.from(new Set(fallbackParagraphs));
      if (uniqueParagraphs.length > 0) {
        extracted.text = uniqueParagraphs.slice(0, 15).join('\n\n');
      }
    }

    if (!extracted.text || extracted.text.length < 20) {
      alert('Includify: Could not find sufficient readable article text on this webpage.');
      return;
    }

    // Show loading state overlay
    showOverlayLoading();

    chrome.runtime.sendMessage({
      type: 'API_CALL_SIMPLIFY',
      payload: {
        text: extracted.text,
        title: extracted.title,
        url: extracted.url
      }
    }, (res) => {
      if (chrome.runtime.lastError || !res || !res.success) {
        console.warn('Backend API connection warning, generating local fallback:', chrome.runtime.lastError?.message || res?.error);
        const fallbackData = {
          simplifiedText: extracted.text,
          summary: "Includify extracted main content directly from the webpage.",
          keyPoints: [
            `Title: ${extracted.title}`,
            `Extracted length: ${extracted.text.length} characters`,
            `Host: ${window.location.hostname}`
          ]
        };
        renderSimplificationOverlay(fallbackData, extracted);
      } else {
        renderSimplificationOverlay(res.data, extracted);
      }
    });
  }

  function showOverlayLoading() {
    removeOverlay();

    const root = document.createElement('div');
    root.id = 'includify-root';
    root.innerHTML = `
      <div class="reader-header">
        <h2>✨ Includify AI Reader</h2>
        <button class="btn-close" id="includify-close-btn" aria-label="Close">✕</button>
      </div>
      <div class="reader-body">
        <div class="loading-spinner">
          <p>⚡ Extracting text & calling Gemini AI...</p>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    document.getElementById('includify-close-btn').addEventListener('click', removeOverlay);
  }

  function renderSimplificationOverlay(data, extracted) {
    removeOverlay();

    const root = document.createElement('div');
    root.id = 'includify-root';

    if (data.aiUnavailable || data.success === false) {
      root.innerHTML = `
        <div class="reader-header">
          <h2>✨ Includify Reader View</h2>
          <button class="btn-close" id="includify-close-btn" aria-label="Close Reader Overlay">✕</button>
        </div>
        <div class="reader-body">
          <div class="summary-box" style="background:#fffbe6; border-color:#ffe58f;">
            <h3 style="color:#d48806;">⚠️ AI Unavailable</h3>
            <p style="color:#8c6b00;">${escapeHtml(data.message || 'AI processing is temporarily unavailable. You can still use Includify accessibility features.')}</p>
          </div>
          <div class="simplified-text-box">
            <h3>📖 Page Content</h3>
            <div id="includify-text-container">
              <p>${escapeHtml(extracted.text)}</p>
            </div>
          </div>
        </div>
        <div class="reader-footer">
          <button class="btn-reader-action" id="includify-read-btn">🔊 Read Aloud</button>
        </div>
      `;

      document.body.appendChild(root);
      document.getElementById('includify-close-btn').addEventListener('click', removeOverlay);
      document.getElementById('includify-read-btn').addEventListener('click', () => {
        playTTS(extracted.text);
      });
      return;
    }

    const keyPointsHtml = (data.keyPoints || []).map(pt => `<li>${escapeHtml(pt)}</li>`).join('');
    
    // Format simplified text paragraphs
    const paragraphsHtml = (data.simplifiedText || '')
      .split('\n\n')
      .filter(p => p.trim().length > 0)
      .map(p => `<p>${escapeHtml(p)}</p>`)
      .join('');

    const fallbackNoticeBanner = data.fallbackUsed ? `
      <div class="fallback-banner" style="background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
        <span>⚡ AI provider switched automatically to maintain service.</span>
      </div>
    ` : '';

    root.innerHTML = `
      <div class="reader-header">
        <h2>✨ Includify AI Reader</h2>
        <button class="btn-close" id="includify-close-btn" aria-label="Close Reader Overlay">✕</button>
      </div>

      <div class="reader-body">
        ${fallbackNoticeBanner}

        <!-- Summary Section -->
        <div class="summary-box">
          <h3>📌 Key Summary</h3>
          <p>${escapeHtml(data.summary || 'Summary unavailable.')}</p>
        </div>

        <!-- Key Takeaways -->
        ${keyPointsHtml ? `
        <div class="key-points-box">
          <h3>💡 Key Points</h3>
          <ul>${keyPointsHtml}</ul>
        </div>` : ''}

        <!-- Simplified Article Body -->
        <div class="simplified-text-box">
          <h3>📖 Simplified Text</h3>
          <div id="includify-text-container">
            ${paragraphsHtml}
          </div>
        </div>
      </div>

      <div class="reader-footer">
        <button class="btn-reader-action" id="includify-read-btn">🔊 Read Aloud</button>
        <button class="btn-reader-action" id="includify-toggle-orig-btn" style="background:#64748b;">🔄 Show Original</button>
      </div>
    `;

    document.body.appendChild(root);

    // Event listeners inside overlay
    document.getElementById('includify-close-btn').addEventListener('click', removeOverlay);
    
    document.getElementById('includify-read-btn').addEventListener('click', () => {
      const textToRead = `${data.summary}. Key Points: ${(data.keyPoints||[]).join('. ')}. ${data.simplifiedText}`;
      playTTS(textToRead);
    });

    let showingOriginal = false;
    document.getElementById('includify-toggle-orig-btn').addEventListener('click', (e) => {
      const container = document.getElementById('includify-text-container');
      if (!showingOriginal) {
        container.innerHTML = `<p>${escapeHtml(extracted.text)}</p>`;
        e.target.textContent = '✨ Show Simplified';
        showingOriginal = true;
      } else {
        container.innerHTML = paragraphsHtml;
        e.target.textContent = '🔄 Show Original';
        showingOriginal = false;
      }
    });
  }

  function removeOverlay() {
    const existing = document.getElementById('includify-root');
    if (existing) existing.remove();
  }

  /* ==========================================================================
     2b. MULTILINGUAL TRANSLATION ENGINE
     ========================================================================== */

  const TTS_LANG_MAP = {
    en: 'en-US',
    hi: 'hi-IN',
    bn: 'bn-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    mr: 'mr-IN',
    gu: 'gu-IN'
  };

  let activeTranslationData = null;

  async function handleTranslateAction(targetLang = 'hi', targetLangName = 'Hindi', simplify = false) {
    const extracted = extractMainContent();

    if (!extracted.text || extracted.text.length < 50) {
      alert('Includify: Could not find sufficient article text to translate.');
      return;
    }

    showTranslationLoading(targetLangName);

    chrome.runtime.sendMessage({
      type: 'API_CALL_TRANSLATE',
      payload: {
        text: extracted.text,
        title: extracted.title,
        targetLanguage: targetLang,
        targetLanguageName: targetLangName,
        simplify: simplify || false
      }
    }, (res) => {
      if (chrome.runtime.lastError || !res || !res.success) {
        console.warn('Backend Translation API warning:', chrome.runtime.lastError?.message || res?.error);
        const fallbackData = {
          translatedText: `[${targetLangName} Translation Preview]\n\n${extracted.text}`,
          summary: `Extracted content for ${targetLangName} translation.`,
          keyPoints: [`Target Language: ${targetLangName}`, `Host: ${window.location.hostname}`],
          targetLanguage: targetLang,
          targetLanguageName: targetLangName
        };
        activeTranslationData = { ...fallbackData, targetLang, targetLangName };
        renderTranslationOverlay(fallbackData, extracted);
      } else {
        const data = res.data;
        activeTranslationData = { ...data, targetLang, targetLangName };
        renderTranslationOverlay(data, extracted);

        // If in Focus Mode, update focused container text in place
        if (isFocusActive && focusTargetContainer) {
          updateFocusContentWithTranslation(data);
        }
      }
    });
  }

  function showTranslationLoading(langName) {
    removeOverlay();

    const root = document.createElement('div');
    root.id = 'includify-root';
    root.innerHTML = `
      <div class="reader-header">
        <h2>🌐 Includify ${langName} Translator</h2>
        <button class="btn-close" id="includify-close-btn" aria-label="Close">✕</button>
      </div>
      <div class="reader-body">
        <div class="loading-spinner">
          <p>⚡ Translating content into ${langName} via Gemini AI...</p>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    document.getElementById('includify-close-btn').addEventListener('click', removeOverlay);
  }

  function renderTranslationOverlay(data, extracted) {
    removeOverlay();

    const root = document.createElement('div');
    root.id = 'includify-root';

    if (data.aiUnavailable || data.success === false) {
      root.innerHTML = `
        <div class="reader-header">
          <h2>🌐 Includify Reader View</h2>
          <button class="btn-close" id="includify-close-btn" aria-label="Close Reader Overlay">✕</button>
        </div>
        <div class="reader-body">
          <div class="summary-box" style="background:#fffbe6; border-color:#ffe58f;">
            <h3 style="color:#d48806;">⚠️ AI Unavailable</h3>
            <p style="color:#8c6b00;">${escapeHtml(data.message || 'AI processing is temporarily unavailable. You can still use Includify accessibility features.')}</p>
          </div>
          <div class="simplified-text-box">
            <h3>📖 Page Content</h3>
            <div id="includify-text-container">
              <p>${escapeHtml(extracted.text)}</p>
            </div>
          </div>
        </div>
        <div class="reader-footer">
          <button class="btn-reader-action" id="includify-read-btn">🔊 Read Aloud</button>
        </div>
      `;

      document.body.appendChild(root);
      document.getElementById('includify-close-btn').addEventListener('click', removeOverlay);
      document.getElementById('includify-read-btn').addEventListener('click', () => {
        playTTS(extracted.text);
      });
      return;
    }

    const langName = data.targetLanguageName || 'Translation';
    const keyPointsHtml = (data.keyPoints || []).map(pt => `<li>${escapeHtml(pt)}</li>`).join('');

    const paragraphsHtml = (data.translatedText || '')
      .split('\n\n')
      .filter(p => p.trim().length > 0)
      .map(p => `<p>${escapeHtml(p)}</p>`)
      .join('');

    const fallbackNoticeBanner = data.fallbackUsed ? `
      <div class="fallback-banner" style="background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
        <span>⚡ AI provider switched automatically to maintain service.</span>
      </div>
    ` : '';

    root.innerHTML = `
      <div class="reader-header">
        <h2>🌐 Includify ${escapeHtml(langName)} Reader</h2>
        <button class="btn-close" id="includify-close-btn" aria-label="Close Reader Overlay">✕</button>
      </div>

      <div class="reader-body">
        ${fallbackNoticeBanner}

        <!-- Summary Section -->
        <div class="summary-box" style="background:#f0fdf4; border-left-color:#22c55e;">
          <h3 style="color:#15803d;">📌 Summary (${escapeHtml(langName)})</h3>
          <p style="color:#14532d;">${escapeHtml(data.summary || 'Summary unavailable.')}</p>
        </div>

        <!-- Key Takeaways -->
        ${keyPointsHtml ? `
        <div class="key-points-box">
          <h3>💡 Key Points (${escapeHtml(langName)})</h3>
          <ul>${keyPointsHtml}</ul>
        </div>` : ''}

        <!-- Translated Article Body -->
        <div class="simplified-text-box">
          <h3>📖 Translated Content (${escapeHtml(langName)})</h3>
          <div id="includify-text-container">
            ${paragraphsHtml}
          </div>
        </div>
      </div>

      <div class="reader-footer" style="flex-wrap:wrap; gap:6px;">
        <button class="btn-reader-action" id="includify-trans-read-btn">🔊 Read Aloud (${escapeHtml(langName)})</button>
        <button class="btn-reader-action" id="includify-trans-simplify-btn" style="background:#7c3aed;">✨ Simplify Translation</button>
        <button class="btn-reader-action" id="includify-toggle-orig-btn" style="background:#64748b;">🔄 Show Original</button>
      </div>
    `;

    document.body.appendChild(root);

    document.getElementById('includify-close-btn').addEventListener('click', removeOverlay);

    // Read Aloud button in translated TTS language
    document.getElementById('includify-trans-read-btn').addEventListener('click', () => {
      const textToRead = `${data.summary}. ${data.translatedText}`;
      playTTS(textToRead, ttsRate, data.targetLanguage);
    });

    // Simplify Translation button
    document.getElementById('includify-trans-simplify-btn').addEventListener('click', () => {
      handleTranslateAction(data.targetLanguage || 'hi', data.targetLanguageName || 'Hindi', true);
    });

    let showingOriginal = false;
    document.getElementById('includify-toggle-orig-btn').addEventListener('click', (e) => {
      const container = document.getElementById('includify-text-container');
      if (!showingOriginal) {
        container.innerHTML = `<p>${escapeHtml(extracted.text)}</p>`;
        e.target.textContent = `🌐 Show ${langName}`;
        showingOriginal = true;
      } else {
        container.innerHTML = paragraphsHtml;
        e.target.textContent = '🔄 Show Original';
        showingOriginal = false;
      }
    });
  }

  function updateFocusContentWithTranslation(data) {
    if (!focusTargetContainer) return;

    const paragraphsHtml = (data.translatedText || '')
      .split('\n\n')
      .filter(p => p.trim().length > 0)
      .map(p => `<p class="includify-focus-paragraph">${escapeHtml(p)}</p>`)
      .join('');

    focusTargetContainer.innerHTML = `
      <div style="background:#f0fdf4; border-left:4px solid #22c55e; padding:12px 16px; border-radius:8px; margin-bottom:20px;">
        <h3 style="margin:0 0 6px 0; color:#15803d; font-size:14px;">📌 ${escapeHtml(data.targetLanguageName || 'Translation')} Summary</h3>
        <p style="margin:0; color:#14532d; font-size:15px; line-height:1.5;">${escapeHtml(data.summary || '')}</p>
      </div>
      ${paragraphsHtml}
    `;

    // Re-bind paragraph spotlight tracking
    const paragraphs = focusTargetContainer.querySelectorAll('p');
    paragraphs.forEach(p => p.classList.add('includify-focus-paragraph'));
    updateFocusSpotlightAndProgress();
  }

  /* ==========================================================================
     3. FOCUS MODE READER VIEW ENGINE
     ========================================================================== */

  let isFocusActive = false;
  let focusLineSpacingIndex = 0;
  let focusOriginalScrollPos = 0;

  function toggleFocusMode(enable) {
    currentSettings.focusMode = enable;

    if (enable) {
      if (isFocusActive) return;
      isFocusActive = true;

      // 1. Save original scroll position
      focusOriginalScrollPos = window.scrollY;

      // 2. Extract Main Content from host page
      const extracted = extractMainContent();

      // 3. Create Dedicated Full-Screen Includify Reader View Root
      removeFocusReader();

      const readerRoot = document.createElement('div');
      readerRoot.id = 'includify-focus-reader-root';

      const rawText = extracted.text || 'No article content detected on this page.';
      const titleText = extracted.title || 'Includify Focus Reader';

      const paragraphsHtml = rawText
        .split('\n\n')
        .filter(p => p.trim().length > 0)
        .map(p => `<p class="includify-reader-paragraph">${escapeHtml(p.trim())}</p>`)
        .join('');

      readerRoot.innerHTML = `
        <div class="includify-reader-container" id="includify-reader-container">
          <header class="includify-reader-header">
            <span class="includify-reader-badge">🧠 INCLUDIFY FOCUS READER</span>
            <h1 class="includify-reader-title">${escapeHtml(titleText)}</h1>
            <div class="includify-reader-meta">
              <span>Source: ${escapeHtml(window.location.hostname)}</span>
              <span>•</span>
              <span>Distraction-Free Reading Mode</span>
            </div>
          </header>
          
          <main class="includify-reader-body" id="includify-reader-body">
            ${paragraphsHtml}
          </main>
        </div>
      `;

      document.body.appendChild(readerRoot);
      document.body.classList.add('includify-focus-active-body');

      // 4. Inject Progress Bar
      let progressBar = document.getElementById('includify-focus-progress-bar');
      if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.id = 'includify-focus-progress-bar';
        document.body.appendChild(progressBar);
      }

      // 5. Inject Floating Toolbar
      let toolbar = document.getElementById('includify-focus-toolbar');
      if (!toolbar) {
        toolbar = document.createElement('div');
        toolbar.id = 'includify-focus-toolbar';
        toolbar.setAttribute('role', 'toolbar');
        toolbar.setAttribute('aria-label', 'Focus Mode Reading Controls');

        const curLang = currentSettings.targetLanguage || 'en';
        
        toolbar.innerHTML = `
          <div class="includify-tb-brand">🎯 Focus</div>
          <div class="includify-tb-progress" id="includify-progress-text">Reading: 0%</div>
          <select class="includify-tb-btn" id="includify-tb-lang" title="Translate Focus Article" aria-label="Translate Focus Article" style="background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.3); color:white;">
            <option value="en" ${curLang==='en'?'selected':''}>🌐 English</option>
            <option value="hi" ${curLang==='hi'?'selected':''}>🌐 हिन्दी (Hindi)</option>
            <option value="bn" ${curLang==='bn'?'selected':''}>🌐 বাংলা (Bengali)</option>
            <option value="ta" ${curLang==='ta'?'selected':''}>🌐 தமிழ் (Tamil)</option>
            <option value="te" ${curLang==='te'?'selected':''}>🌐 తెలుగు (Telugu)</option>
            <option value="mr" ${curLang==='mr'?'selected':''}>🌐 मराठी (Marathi)</option>
            <option value="gu" ${curLang==='gu'?'selected':''}>🌐 ગુજરાતી (Gujarati)</option>
          </select>
          <button class="includify-tb-btn" id="includify-tb-font-dec" title="Decrease Font Size" aria-label="Decrease Font Size">A−</button>
          <button class="includify-tb-btn" id="includify-tb-font-inc" title="Increase Font Size" aria-label="Increase Font Size">A+</button>
          <button class="includify-tb-btn" id="includify-tb-spacing" title="Cycle Line Spacing" aria-label="Cycle Line Spacing">📏 Spacing</button>
          <button class="includify-tb-btn" id="includify-tb-read" title="Read Aloud Content" aria-label="Read Aloud Content">🔊 Read Aloud</button>
          <button class="includify-tb-btn includify-tb-exit" id="includify-tb-exit" title="Exit Focus Mode" aria-label="Exit Focus Mode">✕ Exit</button>
        `;

        document.body.appendChild(toolbar);

        // Bind Toolbar Event Listeners
        document.getElementById('includify-tb-lang').addEventListener('change', (e) => {
          const lang = e.target.value;
          const langName = e.target.options[e.target.selectedIndex].text.replace(/^🌐\s*/, '');
          chrome.storage.sync.set({ targetLanguage: lang, targetLanguageName: langName });
          handleTranslateAction(lang, langName, false);
        });

        document.getElementById('includify-tb-font-dec').addEventListener('click', () => {
          const newSize = Math.max(80, (currentSettings.fontSize || 100) - 10);
          currentSettings.fontSize = newSize;
          chrome.storage.sync.set({ fontSize: newSize });
          updateTypography(currentSettings);
        });

        document.getElementById('includify-tb-font-inc').addEventListener('click', () => {
          const newSize = Math.min(180, (currentSettings.fontSize || 100) + 10);
          currentSettings.fontSize = newSize;
          chrome.storage.sync.set({ fontSize: newSize });
          updateTypography(currentSettings);
        });

        document.getElementById('includify-tb-spacing').addEventListener('click', () => {
          focusLineSpacingIndex = (focusLineSpacingIndex + 1) % lineSpacingOptions.length;
          const option = lineSpacingOptions[focusLineSpacingIndex];
          currentSettings.lineSpacing = option.value;
          document.getElementById('includify-tb-spacing').textContent = option.label;
          chrome.storage.sync.set({ lineSpacing: option.value });
          updateTypography(currentSettings);
        });

        document.getElementById('includify-tb-read').addEventListener('click', () => {
          if (isTtsPlaying) {
            handleTtsPause();
          } else {
            playTTS(rawText, ttsRate);
          }
        });

        document.getElementById('includify-tb-exit').addEventListener('click', () => {
          toggleFocusMode(false);
          chrome.storage.sync.set({ focusMode: false });
        });
      }

      // 6. Attach Reader Scroll Listener for Spotlight & Progress
      readerRoot.addEventListener('scroll', updateReaderSpotlightAndProgress, { passive: true });
      updateReaderSpotlightAndProgress();

      // Apply initial typography styles to reader
      applyTypographyStyles();

    } else {
      if (!isFocusActive) return;
      isFocusActive = false;

      removeFocusReader();
      document.body.classList.remove('includify-focus-active-body');

      // Restore original scroll position
      window.scrollTo(0, focusOriginalScrollPos);

      handleTtsStop();
    }
  }

  function removeFocusReader() {
    const reader = document.getElementById('includify-focus-reader-root');
    if (reader) reader.remove();

    const progressBar = document.getElementById('includify-focus-progress-bar');
    if (progressBar) progressBar.remove();

    const toolbar = document.getElementById('includify-focus-toolbar');
    if (toolbar) toolbar.remove();
  }

  function updateReaderSpotlightAndProgress() {
    const readerRoot = document.getElementById('includify-focus-reader-root');
    if (!readerRoot) return;

    const viewportCenter = window.innerHeight / 2;
    const paragraphs = Array.from(readerRoot.querySelectorAll('.includify-reader-paragraph'));

    let closestParagraph = null;
    let minDistance = Infinity;

    paragraphs.forEach(p => {
      const rect = p.getBoundingClientRect();
      const pCenter = rect.top + (rect.height / 2);
      const distance = Math.abs(pCenter - viewportCenter);

      if (distance < minDistance) {
        minDistance = distance;
        closestParagraph = p;
      }
    });

    paragraphs.forEach(p => {
      if (p === closestParagraph) {
        p.classList.add('includify-reader-spotlight-active');
      } else {
        p.classList.remove('includify-reader-spotlight-active');
      }
    });

    // Calculate scroll progress inside reader container
    const scrollTop = readerRoot.scrollTop;
    const scrollHeight = readerRoot.scrollHeight - readerRoot.clientHeight;
    let progress = Math.min(100, Math.max(0, Math.round((scrollTop / Math.max(1, scrollHeight)) * 100)));

    const progressBar = document.getElementById('includify-focus-progress-bar');
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }

    const progressText = document.getElementById('includify-progress-text');
    if (progressText) {
      progressText.textContent = `Reading: ${progress}%`;
    }
  }

  /* ==========================================================================
     4. DYSLEXIA & TYPOGRAPHY ENGINE
     ========================================================================== */

  function toggleDyslexiaMode(enable) {
    currentSettings.dyslexiaMode = enable;

    let styleEl = document.getElementById('includify-dyslexia-style');
    if (enable) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'includify-dyslexia-style';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `
        body, body *, #includify-root, #includify-root * {
          font-family: 'OpenDyslexic', 'Comic Sans MS', 'Lexend', sans-serif !important;
          letter-spacing: 0.12em !important;
          word-spacing: 0.16em !important;
          line-height: 1.8 !important;
        }
      `;
      document.body.classList.add('includify-dyslexia-active');
    } else {
      if (styleEl) styleEl.remove();
      document.body.classList.remove('includify-dyslexia-active');
    }
    applyTypographyStyles();
  }

  function updateTypography(settings) {
    if (settings.fontSize !== undefined) currentSettings.fontSize = settings.fontSize;
    if (settings.lineSpacing !== undefined) currentSettings.lineSpacing = settings.lineSpacing;
    if (settings.letterSpacing !== undefined) currentSettings.letterSpacing = settings.letterSpacing;
    if (settings.paragraphSpacing !== undefined) currentSettings.paragraphSpacing = settings.paragraphSpacing;

    applyTypographyStyles();
  }

  function applyTypographyStyles() {
    let styleEl = document.getElementById('includify-typography-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'includify-typography-style';
      document.head.appendChild(styleEl);
    }

    const fontSize   = Math.max(80, Math.min(200, currentSettings.fontSize || 100));
    const lineHeight = currentSettings.lineSpacing || 1.6;
    const letterSpacing = currentSettings.letterSpacing !== undefined ? currentSettings.letterSpacing : 0;
    const paragraphSpacing = currentSettings.paragraphSpacing !== undefined ? currentSettings.paragraphSpacing : 1.5;

    // Scale factor for font-size (relative to 100% baseline)
    const scale = fontSize / 100;

    styleEl.textContent = `
      /* ============================================================
         Includify Typography Engine — High Specificity Overrides
         Targets both host page content AND Includify overlays.
         Uses html-level font scaling so all rem/em values cascade.
         ============================================================ */

      /* 1. Font Size — scale the root so rem units cascade correctly */
      html:not(#\\9) body p,
      html:not(#\\9) body li,
      html:not(#\\9) body blockquote,
      html:not(#\\9) body h1,
      html:not(#\\9) body h2,
      html:not(#\\9) body h3,
      html:not(#\\9) body h4,
      html:not(#\\9) body h5,
      html:not(#\\9) body h6,
      html:not(#\\9) body span:not([class]),
      html:not(#\\9) body article,
      html:not(#\\9) body main {
        font-size: ${fontSize}% !important;
      }

      /* 2. Line Height — applied to all text containers */
      html:not(#\\9) body p,
      html:not(#\\9) body li,
      html:not(#\\9) body blockquote,
      html:not(#\\9) body h1,
      html:not(#\\9) body h2,
      html:not(#\\9) body h3,
      html:not(#\\9) body h4,
      html:not(#\\9) body h5,
      html:not(#\\9) body h6 {
        line-height: ${lineHeight} !important;
      }

      /* 3. Letter Spacing */
      html:not(#\\9) body p,
      html:not(#\\9) body li,
      html:not(#\\9) body h1,
      html:not(#\\9) body h2,
      html:not(#\\9) body h3,
      html:not(#\\9) body h4,
      html:not(#\\9) body h5,
      html:not(#\\9) body h6,
      html:not(#\\9) body blockquote {
        letter-spacing: ${letterSpacing}px !important;
      }

      /* 4. Paragraph Spacing */
      html:not(#\\9) body p,
      html:not(#\\9) body blockquote {
        margin-bottom: ${paragraphSpacing}em !important;
      }

      /* 5. Focus Reader — override hardcoded content.css values */
      #includify-focus-reader-root .includify-reader-paragraph {
        font-size: ${fontSize}% !important;
        line-height: ${lineHeight} !important;
        letter-spacing: ${letterSpacing}px !important;
        margin-bottom: ${paragraphSpacing}em !important;
      }

      /* 6. AI Reader Overlay — override hardcoded content.css values */
      #includify-root .simplified-text-box p,
      #includify-root .reader-body p,
      #includify-root li {
        font-size: ${fontSize}% !important;
        line-height: ${lineHeight} !important;
        letter-spacing: ${letterSpacing}px !important;
        margin-bottom: ${paragraphSpacing}em !important;
      }
    `;
  }

  /* ==========================================================================
     5. VISUAL ACCESSIBILITY ENGINE
     ========================================================================== */

  function setContrastMode(mode) {
    currentSettings.contrastMode = mode;

    const contrastClasses = [
      'includify-theme-dark', 'includify-theme-high-contrast', 
      'includify-theme-sepia', 'includify-theme-blue-tint'
    ];

    document.body.classList.remove(...contrastClasses);

    if (mode && mode !== 'normal') {
      document.body.classList.add(`includify-theme-${mode}`);
    }
  }

  function applyAllSettings(settings) {
    if (settings.dyslexiaMode) toggleDyslexiaMode(true);
    if (settings.contrastMode) setContrastMode(settings.contrastMode);
    if (settings.fontFamily || settings.enableReadingFont !== undefined) {
      setReadingFont(settings.fontFamily || 'default', settings.enableReadingFont !== false);
    }
    if (settings.focusMode) toggleFocusMode(true);
    updateTypography(settings);
  }

  function resetAccessibility() {
    currentSettings = {
      fontSize: 100,
      fontFamily: 'default',
      enableReadingFont: true,
      lineSpacing: 1.6,
      letterSpacing: 0,
      paragraphSpacing: 1.5,
      contrastMode: 'normal',
      readingSpeed: 1.0,
      focusMode: false,
      dyslexiaMode: false
    };

    toggleDyslexiaMode(false);
    setContrastMode('normal');
    toggleFocusMode(false);
    setReadingFont('default', false);

    const typoStyle = document.getElementById('includify-typography-style');
    if (typoStyle) typoStyle.remove();

    const dyslexiaStyle = document.getElementById('includify-dyslexia-style');
    if (dyslexiaStyle) dyslexiaStyle.remove();

    handleTtsStop();
  }

  /* ==========================================================================
     6. READ ALOUD WEB SPEECH TTS ENGINE
     ========================================================================== */

  function handleTtsPlay(rate) {
    if (rate) ttsRate = rate;

    if (isTtsPaused && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      isTtsPaused = false;
      isTtsPlaying = true;
      return;
    }

    const extracted = extractMainContent();
    playTTS(extracted.text, ttsRate);
  }

  function handleTtsPause() {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      isTtsPaused = true;
      isTtsPlaying = false;
    }
  }

  function handleTtsStop() {
    if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
      window.speechSynthesis.cancel();
    }
    isTtsPlaying = false;
    isTtsPaused = false;
    clearSentenceHighlights();
  }

  function handleTtsUpdateRate(rate) {
    ttsRate = rate;
    if (isTtsPlaying) {
      handleTtsStop();
      handleTtsPlay(rate);
    }
  }

  function playTTS(text, rate = 1.0, langCode = null) {
    handleTtsStop();

    if (!('speechSynthesis' in window)) {
      alert('Read Aloud is not supported on this browser.');
      return;
    }

    if (!text || text.trim().length === 0) return;

    const targetLang = langCode || (activeTranslationData && activeTranslationData.targetLanguage) || currentSettings.targetLanguage || 'en';

    // Split into readable sentences
    ttsSentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    ttsCurrentIndex = 0;
    isTtsPlaying = true;

    speakNextSentence(rate, targetLang);
  }

  function speakNextSentence(rate, langCode = 'en') {
    if (ttsCurrentIndex >= ttsSentences.length || !isTtsPlaying) {
      handleTtsStop();
      return;
    }

    const sentenceText = ttsSentences[ttsCurrentIndex].trim();
    ttsUtterance = new SpeechSynthesisUtterance(sentenceText);
    ttsUtterance.rate = rate || 1.0;

    // Set voice language code (e.g. hi-IN for Hindi, bn-IN for Bengali, etc.)
    const bcp47 = TTS_LANG_MAP[langCode] || TTS_LANG_MAP['en'];
    ttsUtterance.lang = bcp47;

    ttsUtterance.onstart = () => {
      highlightSentenceInDOM(sentenceText);
    };

    ttsUtterance.onend = () => {
      ttsCurrentIndex++;
      if (isTtsPlaying) {
        speakNextSentence(rate, langCode);
      }
    };

    ttsUtterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      handleTtsStop();
    };

    window.speechSynthesis.speak(ttsUtterance);
  }

  function highlightSentenceInDOM(sentenceText) {
    clearSentenceHighlights();
    if (!sentenceText || sentenceText.length < 5) return;

    // Find element containing sentence string
    const paragraphs = Array.from(document.querySelectorAll('p, li, span, h1, h2, h3'));
    const matched = paragraphs.find(p => p.textContent.includes(sentenceText.substring(0, 20)));

    if (matched) {
      matched.classList.add('includify-highlight-sentence');
      matched.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function clearSentenceHighlights() {
    document.querySelectorAll('.includify-highlight-sentence').forEach(el => {
      el.classList.remove('includify-highlight-sentence');
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
