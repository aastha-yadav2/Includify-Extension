/**
 * Includify Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const backendStatusEl = document.getElementById('backend-status');
  const btnSimplify = document.getElementById('btn-simplify');
  const toggleFocus = document.getElementById('toggle-focus');
  const toggleDyslexia = document.getElementById('toggle-dyslexia');
  
  // Multilingual Translation Elements
  const selectTargetLang = document.getElementById('select-target-lang');
  const btnTranslatePage = document.getElementById('btn-translate-page');
  const btnTranslateSimplify = document.getElementById('btn-translate-simplify');

  // TTS Controls
  const btnTtsPlay = document.getElementById('btn-tts-play');
  const btnTtsPause = document.getElementById('btn-tts-pause');
  const btnTtsStop = document.getElementById('btn-tts-stop');
  const sliderTtsRate = document.getElementById('slider-tts-rate');
  const valTtsRate = document.getElementById('val-tts-rate');

  // Contrast Buttons
  const contrastButtons = document.querySelectorAll('.btn-theme');

  // Fine-tuning Sliders
  const btnToggleSettings = document.getElementById('btn-toggle-settings');
  const settingsPanel = document.getElementById('settings-panel');
  const sliderFontSize = document.getElementById('slider-font-size');
  const valFontSize = document.getElementById('val-font-size');
  const sliderLineHeight = document.getElementById('slider-line-height');
  const valLineHeight = document.getElementById('val-line-height');
  const sliderLetterSpacing = document.getElementById('slider-letter-spacing');
  const valLetterSpacing = document.getElementById('val-letter-spacing');
  const sliderParagraphSpacing = document.getElementById('slider-paragraph-spacing');
  const valParagraphSpacing = document.getElementById('val-paragraph-spacing');
  const btnResetSettings = document.getElementById('btn-reset-settings');

  // Reading Font Elements
  const toggleFontEnable = document.getElementById('toggle-font-enable');
  const fontRadioButtons = document.querySelectorAll('input[name="reading-font"]');
  const fontOptionItems = document.querySelectorAll('.font-option-item');

  // Toast Container
  const toastEl = document.getElementById('toast');

  // Check Backend Health
  checkBackendHealth();

  // Load Saved Settings from chrome.storage.sync
  chrome.storage.sync.get([
    'fontSize', 'fontFamily', 'enableReadingFont', 'lineSpacing', 'letterSpacing', 'paragraphSpacing',
    'contrastMode', 'readingSpeed', 'focusMode', 'dyslexiaMode', 'targetLanguage'
  ], (settings) => {
    if (chrome.runtime.lastError) {
      console.warn('Storage sync error:', chrome.runtime.lastError);
      return;
    }

    if (settings.focusMode !== undefined) toggleFocus.checked = settings.focusMode;
    if (settings.dyslexiaMode !== undefined) toggleDyslexia.checked = settings.dyslexiaMode;
    if (settings.enableReadingFont !== undefined && toggleFontEnable) {
      toggleFontEnable.checked = settings.enableReadingFont;
    }
    if (settings.fontFamily) {
      updateFontUI(settings.fontFamily);
    }
    if (settings.targetLanguage && selectTargetLang) {
      selectTargetLang.value = settings.targetLanguage;
    }

    if (settings.fontSize) {
      sliderFontSize.value = settings.fontSize;
      valFontSize.textContent = `${settings.fontSize}%`;
    }
    if (settings.lineSpacing) {
      sliderLineHeight.value = settings.lineSpacing;
      valLineHeight.textContent = `${settings.lineSpacing}x`;
    }
    if (settings.letterSpacing !== undefined) {
      sliderLetterSpacing.value = settings.letterSpacing;
      valLetterSpacing.textContent = `${settings.letterSpacing}px`;
    }
    if (settings.paragraphSpacing !== undefined) {
      sliderParagraphSpacing.value = settings.paragraphSpacing;
      valParagraphSpacing.textContent = `${settings.paragraphSpacing}em`;
    }
    if (settings.readingSpeed) {
      sliderTtsRate.value = settings.readingSpeed;
      valTtsRate.textContent = `${settings.readingSpeed}x`;
    }

    if (settings.contrastMode) {
      updateContrastUI(settings.contrastMode);
    }
  });

  // --- EVENT LISTENERS ---

  // 1. Simplify Content Button
  btnSimplify.addEventListener('click', () => {
    showToast('✨ Analyzing & Simplifying webpage...');
    sendToActiveTab({ type: 'SIMPLIFY_CONTENT' });
  });

  // 1b. Multilingual Translation Buttons & Selector
  selectTargetLang.addEventListener('change', (e) => {
    const lang = e.target.value;
    const name = selectTargetLang.options[selectTargetLang.selectedIndex].getAttribute('data-name');
    saveSetting('targetLanguage', lang);
    saveSetting('targetLanguageName', name);
  });

  btnTranslatePage.addEventListener('click', () => {
    const targetLanguage = selectTargetLang.value;
    const targetLanguageName = selectTargetLang.options[selectTargetLang.selectedIndex].getAttribute('data-name');
    saveSetting('targetLanguage', targetLanguage);
    saveSetting('targetLanguageName', targetLanguageName);
    showToast(`🌐 Translating content to ${targetLanguageName}...`);
    sendToActiveTab({ 
      type: 'TRANSLATE_CONTENT', 
      targetLanguage, 
      targetLanguageName, 
      simplify: false 
    });
  });

  btnTranslateSimplify.addEventListener('click', () => {
    const targetLanguage = selectTargetLang.value;
    const targetLanguageName = selectTargetLang.options[selectTargetLang.selectedIndex].getAttribute('data-name');
    saveSetting('targetLanguage', targetLanguage);
    saveSetting('targetLanguageName', targetLanguageName);
    showToast(`✨ Translating & Simplifying to ${targetLanguageName}...`);
    sendToActiveTab({ 
      type: 'TRANSLATE_CONTENT', 
      targetLanguage, 
      targetLanguageName, 
      simplify: true 
    });
  });

  // 1c. Reading Font Selector & Toggle
  if (toggleFontEnable) {
    toggleFontEnable.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      saveSetting('enableReadingFont', isEnabled);
      const activeFont = document.querySelector('input[name="reading-font"]:checked')?.value || 'default';
      sendToActiveTab({ type: 'SET_READING_FONT', font: activeFont, enabled: isEnabled });
      showToast(isEnabled ? '🔤 Reading Font Enabled' : 'Reading Font Disabled');
    });
  }

  fontRadioButtons.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const selectedFont = e.target.value;
      updateFontUI(selectedFont);
      saveSetting('fontFamily', selectedFont);
      const isEnabled = toggleFontEnable ? toggleFontEnable.checked : true;
      sendToActiveTab({ type: 'SET_READING_FONT', font: selectedFont, enabled: isEnabled });
      showToast(`Font updated: ${getFontName(selectedFont)}`);
    });
  });

  // 2. Focus Mode Toggle
  toggleFocus.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    saveSetting('focusMode', isEnabled);
    sendToActiveTab({ type: 'TOGGLE_FOCUS_MODE', enabled: isEnabled });
    showToast(isEnabled ? '🎯 Focus Mode Enabled' : 'Focus Mode Disabled');
  });

  // 3. Dyslexia Mode Toggle
  toggleDyslexia.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    saveSetting('dyslexiaMode', isEnabled);
    saveSetting('fontFamily', isEnabled ? 'opendyslexic' : 'default');
    if (isEnabled) updateFontUI('opendyslexic');
    sendToActiveTab({ type: 'TOGGLE_DYSLEXIA_MODE', enabled: isEnabled });
    showToast(isEnabled ? '🔤 Dyslexia-Friendly Mode Enabled' : 'Standard Font Restored');
  });

  // 4. TTS Controls
  btnTtsPlay.addEventListener('click', () => {
    const rate = parseFloat(sliderTtsRate.value);
    sendToActiveTab({ type: 'TTS_PLAY', rate });
    showToast('▶ Reading Aloud started');
  });

  btnTtsPause.addEventListener('click', () => {
    sendToActiveTab({ type: 'TTS_PAUSE' });
    showToast('⏸ Read Aloud paused');
  });

  btnTtsStop.addEventListener('click', () => {
    sendToActiveTab({ type: 'TTS_STOP' });
    showToast('⏹ Read Aloud stopped');
  });

  sliderTtsRate.addEventListener('input', (e) => {
    const rate = parseFloat(e.target.value);
    valTtsRate.textContent = `${rate}x`;
    saveSetting('readingSpeed', rate);
    sendToActiveTab({ type: 'TTS_UPDATE_RATE', rate });
  });

  // 5. Contrast Theme Buttons
  contrastButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.getAttribute('data-theme');
      updateContrastUI(theme);
      saveSetting('contrastMode', theme);
      sendToActiveTab({ type: 'SET_CONTRAST_MODE', mode: theme });
      showToast(`Theme updated: ${btn.textContent.trim()}`);
    });
  });

  // 6. Settings Accordion
  btnToggleSettings.addEventListener('click', () => {
    const isExpanded = btnToggleSettings.getAttribute('aria-expanded') === 'true';
    btnToggleSettings.setAttribute('aria-expanded', !isExpanded);
    settingsPanel.classList.toggle('hidden', isExpanded);
  });

  // 7. Fine-tuning Sliders
  sliderFontSize.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    valFontSize.textContent = `${val}%`;
    saveSetting('fontSize', val);
    sendToActiveTab({ type: 'UPDATE_TYPOGRAPHY', fontSize: val });
  });

  sliderLineHeight.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    valLineHeight.textContent = `${val}x`;
    saveSetting('lineSpacing', val);
    sendToActiveTab({ type: 'UPDATE_TYPOGRAPHY', lineSpacing: val });
  });

  sliderLetterSpacing.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    valLetterSpacing.textContent = `${val}px`;
    saveSetting('letterSpacing', val);
    sendToActiveTab({ type: 'UPDATE_TYPOGRAPHY', letterSpacing: val });
  });

  sliderParagraphSpacing.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    valParagraphSpacing.textContent = `${val}em`;
    saveSetting('paragraphSpacing', val);
    sendToActiveTab({ type: 'UPDATE_TYPOGRAPHY', paragraphSpacing: val });
  });

  // 8. Reset Settings Button
  btnResetSettings.addEventListener('click', () => {
    const defaults = {
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

    chrome.storage.sync.set(defaults, () => {
      toggleFocus.checked = false;
      toggleDyslexia.checked = false;
      sliderFontSize.value = 100; valFontSize.textContent = '100%';
      sliderLineHeight.value = 1.6; valLineHeight.textContent = '1.6x';
      sliderLetterSpacing.value = 0; valLetterSpacing.textContent = '0px';
      sliderParagraphSpacing.value = 1.5; valParagraphSpacing.textContent = '1.5em';
      sliderTtsRate.value = 1.0; valTtsRate.textContent = '1.0x';
      updateContrastUI('normal');

      sendToActiveTab({ type: 'RESET_ACCESSIBILITY' });
      showToast('🔄 Settings reset to defaults');
    });
  });

  // --- HELPER FUNCTIONS ---

  function updateContrastUI(activeTheme) {
    contrastButtons.forEach(btn => {
      if (btn.getAttribute('data-theme') === activeTheme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function saveSetting(key, value) {
    chrome.storage.sync.set({ [key]: value });
  }

  function sendToActiveTab(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      const tab = tabs[0];

      // Block on internal browser pages
      if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
        showToast('⚠️ Includify cannot run on browser internal pages.');
        return;
      }

      chrome.tabs.sendMessage(tab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Tab messaging retry triggered:', chrome.runtime.lastError.message);
          
          // Auto-inject content script if tab was opened prior to extension load/reload
          if (chrome.scripting) {
            chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content/content.css'] }).catch(() => {});
            chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] }).then(() => {
              // Retry message after dynamic injection
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, message).catch(() => {});
              }, 100);
            }).catch(() => {
              showToast('⚠️ Please refresh the webpage to enable Includify.');
            });
          } else {
            showToast('⚠️ Please refresh the webpage to enable Includify.');
          }
        }
      });
    });
  }

  async function checkBackendHealth() {
    try {
      const res = await fetch('http://localhost:3000/api/health', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        backendStatusEl.classList.add('online');
        backendStatusEl.querySelector('.status-text').textContent = data.geminiConfigured ? 'Gemini Ready' : 'Server Online';
      } else {
        setOfflineStatus();
      }
    } catch (err) {
      setOfflineStatus();
    }
  }

  function setOfflineStatus() {
    backendStatusEl.classList.add('offline');
    backendStatusEl.querySelector('.status-text').textContent = 'Server Offline';
  }

  function updateFontUI(selectedFont) {
    fontRadioButtons.forEach(radio => {
      radio.checked = (radio.value === selectedFont);
    });
    fontOptionItems.forEach(item => {
      if (item.getAttribute('data-font') === selectedFont) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  function getFontName(key) {
    const names = {
      default: 'Default / Original',
      opendyslexic: 'OpenDyslexic',
      lexend: 'Lexend',
      atkinson: 'Atkinson Hyperlegible',
      verdana: 'Verdana',
      noto: 'Noto Sans'
    };
    return names[key] || key;
  }

  function showToast(msg) {
    const el = toastEl || document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => {
      el.classList.add('hidden');
    }, 2800);
  }
});
