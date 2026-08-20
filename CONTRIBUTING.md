# Contributing to Includify 🤝

Thank you for your interest in contributing to **Includify**! We welcome contributions from developers, accessibility researchers, designers, and translators to make digital spaces open and accessible for every mind.

---

## 📜 Code of Conduct

All contributors are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all community members with respect, empathy, and kindness.

---

## 🛠️ How to Contribute

### 1. Reporting Bugs
- Search existing GitHub Issues before opening a new issue.
- Describe the bug clearly, including the webpage URL, Chrome version, OS, and expected vs actual behavior.
- Include console error traces if available (`F12` Developer Tools).

### 2. Suggesting Feature Enhancements
- Open a feature request issue detailing the accessibility use case.
- Explain how the enhancement benefits users with dyslexia, ADHD, low vision, or cognitive differences.

### 3. Submitting Pull Requests (PRs)
1. **Fork the Repository**: Create your personal fork on GitHub.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/accessible-feature-name
   ```
3. **Set Up Local Environment**:
   - Backend: Navigate to `server/`, copy `.env.example` to `.env`, run `npm install` and `npm start`.
   - Chrome Extension: Open `chrome://extensions/`, enable Developer Mode, click **Load unpacked**, and select `extension/`.
4. **Follow Coding Standards**:
   - Use clean vanilla JavaScript, HTML5, and CSS3 without unnecessary bloated frameworks.
   - Maintain WCAG 2.1 AA accessibility standards (proper contrast, keyboard focus indicators, ARIA attributes).
   - Ensure AI keys are kept strictly on the backend (`server/.env`).
5. **Commit Your Changes**:
   ```bash
   git commit -m "feat(extension): add accessible focus mode shortcut"
   ```
6. **Push and Create PR**:
   - Push your branch to your fork and submit a PR against `main`.
   - Provide a concise summary of changes and UI screenshots/recordings if applicable.

---

## 🧪 Testing Guidelines

Before submitting a PR, ensure:
- Backend health check returns `status: ok` (`http://localhost:3000/api/health`).
- Test page `http://localhost:3000/demo` renders correctly with extension popup toggles.
- Keyboard shortcuts (`Alt+Shift+S`, `Alt+Shift+F`, `Alt+Shift+D`, `Alt+Shift+R`) operate smoothly.
- Zero console errors in extension background service worker or content scripts.
