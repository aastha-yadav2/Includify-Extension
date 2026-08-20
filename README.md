# Includify — Designing Digital Spaces for Every Mind ✨

[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js_Express-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Google Gemini API](https://img.shields.io/badge/Primary_AI-Google_Gemini_3.6_Flash-8E75B2?logo=google&logoColor=white)](https://aistudio.google.com/)
[![Groq / Grok AI](https://img.shields.io/badge/Fallback_AI-Groq_%2F_Grok-FF6C37?logo=fastapi&logoColor=white)](https://groq.com/)
[![Accessibility WCAG 2.1](https://img.shields.io/badge/WCAG_2.1-AA_Compliant-005A9C?logo=w3c&logoColor=white)](https://www.w3.org/WAI/standards-guidelines/wcag/)

**Includify** is an AI-powered accessibility browser extension and Node.js backend system designed for users with cognitive differences, dyslexia, ADHD, low vision, and language learners. It transforms any complex, cluttered webpage into a clean, highly legible, distraction-free reading experience without requiring page reloads or altering browser controls.

---

## 🌟 Core Features

- 🧠 **AI Text Simplification**: Extracts article text and generates 6th-grade plain language content, a 2-sentence summary, and 3 key takeaways.
- 🌐 **Multilingual Translation**: Translates web content into **Hindi**, **Bengali**, **Tamil**, **Telugu**, **Marathi**, **Gujarati**, and **English** with native language speech synthesis tags.
- 🎯 **Focus Reader View**: Full-screen, 100% opaque distraction-free reader mode with active paragraph spotlighting and zero background blur/text dimming.
- 🔤 **Accessibility Reading Font System**: Switch between 6 curated high-legibility fonts (**Default**, **OpenDyslexic**, **Lexend**, **Atkinson Hyperlegible**, **Verdana**, **Noto Sans**) applied strictly to readable elements (`article, main, p, h1-h6, li, blockquote`).
- ⚡ **Dual AI Provider Fallback**: Automatic, zero-interruption switching between **Google Gemini (Primary)** and **Groq / Grok (Fallback)** on quota exhaustion, rate limits (429), or service downtime.
- 🔊 **Read Aloud TTS Engine**: Native Web Speech API synthesis with Play/Pause/Stop, speech speed controls (0.75x – 2.0x), and live sentence highlighting.
- 👁 **Visual Contrast Themes**: Instant theme switching for Normal, Dark Mode, High Contrast (Yellow on Black), Soft Sepia, and Soft Blue Light Reduction.
- ⚙️ **Fine-Tuned Typography Controls**: Custom sliders for Font Size (80%-160%), Line Height (1.2x-2.4x), Letter Spacing (0-5px), and Paragraph Spacing (1.0-3.0em).

---

## 🏗 System Architecture & AI Provider Hierarchy

```
                                  +-----------------------+
                                  | Includify Popup UI /  |
                                  |   Chrome Extension    |
                                  +-----------+-----------+
                                              |
                                              v (Manifest V3 Background Messaging)
                                  +-----------+-----------+
                                  | Node.js Express Server|
                                  |   (http://localhost)  |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------+-----------+
                                  |  AI Provider Manager  |
                                  +-----+-----------+-----+
                                        |           |
                     (Primary AI)       |           |   (Quota Exhausted / 429 Fallback)
          +-----------------------------+           +-----------------------------+
          |                                                                       |
          v                                                                       v
+---------+--------------+                                              +---------+--------------+
| Google Gemini API      |                                              | Groq / Grok AI API     |
| (gemini-3.6-flash)     |                                              | (openai/gpt-oss-120b)  |
+------------------------+                                              +------------------------+
```

---

## 📁 Repository Structure

```
Includify-Extension/
├── .gitignore                      # Environment variables, logs, node_modules exclusion
├── README.md                       # Main project documentation & setup guide
├── PRD.md                          # Product Requirements Document
├── CONTRIBUTING.md                 # Contribution guidelines & workflow
├── CODE_OF_CONDUCT.md              # Community Code of Conduct
│
├── extension/                      # Chrome Extension (Manifest V3 Bundle)
│   ├── manifest.json               # Extension permissions, service worker, & content scripts
│   ├── background.js               # Service Worker background router & CORS proxy handler
│   ├── assets/                     # Extension branding icons (16px, 48px, 128px)
│   ├── popup/
│   │   ├── popup.html              # Ergonomic vertical stack popup UI
│   │   ├── popup.css               # Accessibility styling system & typography previews
│   │   └── popup.js                # State management (`chrome.storage.sync`) & messaging
│   └── content/
│       ├── content.css             # Reader View, Contrast Modes, & Scoped Reading Fonts
│       └── content.js              # DOM content extraction engine & TTS Reader
│
└── server/                         # Node.js Express Backend & AI Provider Engine
    ├── .env.example                # Template configuration file
    ├── package.json                # Dependencies (@google/genai, express, cors, dotenv)
    ├── index.js                    # Express API routes (/api/simplify, /api/translate)
    ├── services/
    │   └── aiProviderManager.js    # Provider fallback orchestrator & simulation handler
    └── providers/
        ├── baseProvider.js         # Abstract provider base class
        ├── geminiProvider.js       # Google Gemini SDK provider implementation
        └── grokProvider.js         # Groq / Grok REST provider implementation
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.x or higher)
- Google Chrome Browser (v105+ for Manifest V3 support)

### 1. Backend Server Installation
```bash
# Clone the repository
git clone https://github.com/aastha-yadav2/Includify-Extension.git
cd Includify-Extension/server

# Install dependencies
npm install

# Create environment configuration
cp .env.example .env
```

Edit `server/.env` to configure your API keys:
```env
PORT=3000

# Primary and Fallback AI Keys
GEMINI_API_KEY=your_gemini_api_key
XAI_API_KEY=your_grok_or_groq_api_key

PRIMARY_AI=gemini
FALLBACK_AI=grok
```

Start the backend server:
```bash
npm start
```
Server runs at `http://localhost:3000`.

### 2. Loading Extension in Google Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in top-right corner).
3. Click **Load unpacked**.
4. Select the `extension/` directory from `Includify-Extension/extension`.
5. Pin **Includify** to your Chrome extension toolbar.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Alt + Shift + S` | **Simplify Content** | Extract webpage article text and launch AI Reader Overlay. |
| `Alt + Shift + F` | **Focus Mode** | Toggle distraction-free Reader View overlay. |
| `Alt + Shift + D` | **Dyslexia Mode** | Toggle OpenDyslexic font and wide letter spacing. |
| `Alt + Shift + R` | **Read Aloud** | Start/Stop text-to-speech reading with sentence highlight. |

---

## 📄 License & Compliance

This project is licensed under the MIT License - see the `LICENSE` file for details. Built in full alignment with WCAG 2.1 Level AA Accessibility Standards.
