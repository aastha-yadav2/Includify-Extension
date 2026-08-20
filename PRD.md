# Includify — Product Requirements Document (PRD) 📋

## 1. Executive Summary & Vision

**Includify** is an AI-native digital accessibility engine designed to eliminate cognitive friction across the web. Modern web applications often feature dense layouts, complex vocabulary, low contrast ratios, and visual clutter that hinder users with dyslexia, ADHD, executive function challenges, low vision, and language barriers. 

Includify acts as an adaptive accessibility layer operating directly inside the browser. It combines real-time DOM extraction, plain-language AI transformation, multi-provider fault-tolerant fallbacks, and customizable typographic engines to ensure digital spaces are open, legible, and intuitive for every mind.

---

## 2. Target Personas & User Stories

### Persona 1: Alex (Dyslexic Reader & Student)
- **Challenges**: Struggles with dense paragraphs, tracking line transitions, and complex vocabulary.
- **User Story**: *"As a student with dyslexia, I want to change the reading font of any webpage to OpenDyslexic or Lexend with custom letter spacing so that I can read without visual distortion."*

### Persona 2: Priya (ADHD & Executive Functioning)
- **Challenges**: Easily distracted by sidebars, animated popups, auto-playing videos, and cluttered navigation.
- **User Story**: *"As a user with ADHD, I want a 1-click Focus Reader overlay that isolates article text and spotlights paragraphs so I can finish reading without distraction."*

### Persona 3: David (Low Vision User)
- **Challenges**: High sensitivity to bright screen glares and small font sizes.
- **User Story**: *"As a low vision user, I want high-contrast color themes (Yellow-on-Black / Dark Mode) and dynamic font scaling so I can browse comfortably."*

### Persona 4: Elena (Non-Native English Speaker / ESL Learner)
- **Challenges**: Hard to comprehend long idioms, multi-syllabic jargon, and dense academic articles.
- **User Story**: *"As an ESL user, I want 1-click translation into Hindi, Bengali, Tamil, or Telugu with simplified 6th-grade language explanations and audio read-aloud."*

---

## 3. Key Functional Requirements

| ID | Module | Requirement Description | Priority |
| :--- | :--- | :--- | :--- |
| **FR-01** | **DOM Extractor** | Cleanly extract visible readable text while stripping CSS artifacts, script tags, navbars, and advertisements. | **P0** (Critical) |
| **FR-02** | **AI Simplification** | Generate 6th-grade plain-language text, 2-sentence summary, and 3 key points via primary AI. | **P0** (Critical) |
| **FR-03** | **Dual AI Fallback** | Automatically retry and switch to Grok (XAI/Groq API) if Gemini API quota is exhausted (429/503). | **P0** (Critical) |
| **FR-04** | **Multilingual AI** | Translate web content into 7 target languages (HI, BN, TA, TE, MR, GU, EN) with plain-language option. | **P1** (High) |
| **FR-05** | **Reading Font System** | Scope custom reading fonts (OpenDyslexic, Lexend, Atkinson, Verdana, Noto) strictly to readable elements. | **P0** (Critical) |
| **FR-06** | **Focus Reader View** | Provide 100% opaque, distraction-free Reader Overlay with active paragraph spotlight tracking. | **P0** (Critical) |
| **FR-07** | **Read Aloud TTS** | Integrate Web Speech API text-to-speech with speed controls (0.75x-2.0x) and synchronized sentence highlighting. | **P1** (High) |
| **FR-08** | **Contrast Themes** | Offer 5 contrast modes (Normal, Dark, High Contrast, Sepia, Blue Tint) applied to page & overlays. | **P1** (High) |
| **FR-09** | **Ergonomic Popup UI** | Render compact vertical stack popup with persistent setting synchronization (`chrome.storage.sync`). | **P1** (High) |

---

## 4. Non-Functional Requirements & Performance SLAs

- **Sub-Second AI Latency**: AI Simplification and Translation responses must complete in under **1.0 second** (`maxOutputTokens: 800`, `temperature: 0.1`).
- **Zero Page Reloads**: All font applications, contrast changes, and overlay toggles must occur dynamically without reloading the target webpage.
- **Security & Privacy**:
  - API keys (`GEMINI_API_KEY`, `XAI_API_KEY`) must reside strictly on the Node.js backend.
  - Extension background service worker acts as a secure API proxy router.
  - Zero browser history logging or personal data collection.
- **Accessibility Standards**: Compliance with **WCAG 2.1 Level AA** guidelines for color contrast ratios, keyboard accessibility (`Alt+Shift` shortcuts), and ARIA landmark roles.

---

## 5. System Quality & Error Resilience

- **Fail-Safe Degradation**: If all AI providers fail or network is offline, Includify provides local algorithmic text extraction and plain-language formatting so core accessibility features (Reader View, Fonts, Contrast, Read Aloud) remain 100% functional.
- **UI Notifications**: Subtle notice banner (`"⚡ AI provider switched automatically to maintain service."`) alerts users whenever fallback mechanisms activate.
