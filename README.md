# Includify: Designing Digital Spaces for Every Mind ✨

**Includify** is an accessibility browser extension (Manifest V3) paired with a secure Node.js backend powered by Google Gemini API. It creates a cognitive accessibility layer that allows users to make ANY webpage easier to read and understand without leaving the site.

---

## 🌟 Key Features

1. **✨ AI Text Simplification**
   - Extracts main readable content from complex web pages.
   - Sends payload securely to Node.js backend (Gemini API key is **never** exposed to the browser/extension client).
   - Displays a concise summary, key points, and plain language simplified text inside an accessible overlay reader.

2. **🎯 Focus Mode**
   - Removes visual distractions, dims background elements, spotlights the active article container, and provides paragraph spotlighting on hover.

3. **🔤 Dyslexia-Friendly Mode**
   - Applies specialized high-legibility font styling with increased letter spacing, word spacing, and line height.

4. **👁 Visual Accessibility**
   - High Contrast Themes: Normal, Dark High Contrast, Yellow on Black, Soft Sepia, and Soft Blue Light Reduction.
   - Dynamic font size scaling and animation pausing.

5. **🔊 Read Aloud (Web Speech TTS)**
   - Built-in Browser Web Speech API reader with Play, Pause, Resume, Stop, reading rate modifier (0.75x - 2.0x), and synchronized sentence highlighting.

6. **⚙️ Persistent User Settings**
   - User preferences saved seamlessly across browser sessions via `chrome.storage.sync`.

---

## 🚀 Getting Started

### 1. Start the Node.js Backend Server

```bash
cd server
npm install
npm start
```

- Server running at: `http://localhost:3000`
- Interactive Demo Test Page: `http://localhost:3000/demo`
- Health check: `http://localhost:3000/api/health`

#### Optional: Enable Google Gemini AI API
Edit `server/.env`:
```env
PORT=3000
GEMINI_API_KEY=your_actual_gemini_api_key
```
*(If no API key is provided, the server operates in smart fallback mode with heuristic plain language simplification for instant demo usage.)*

---

### 2. Load Extension in Google Chrome (Manifest V3)

1. Open Google Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner).
3. Click **Load unpacked**.
4. Select the `extension/` folder inside `d:\Includify\extension`.
5. Pin the **Includify** extension to your browser toolbar!

---

## 🧪 Testing the Extension

1. Open the interactive demo page: [http://localhost:3000/demo](http://localhost:3000/demo)
2. Click the **Includify** icon in your browser toolbar.
3. Try out:
   - **✨ Simplify Content** (`Alt+Shift+S`)
   - **🎯 Focus Mode** (`Alt+Shift+F`)
   - **🔤 Dyslexia-Friendly Mode** (`Alt+Shift+D`)
   - **👁 Visual Accessibility Themes** (Dark, Yellow on Black, Sepia)
   - **🔊 Read Aloud** (`Alt+Shift+R`)
