# 巴哈動畫評分

[![CI Pipeline](https://github.com/Timmatt-Lee/high-score-ani-fetcher/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Timmatt-Lee/high-score-ani-fetcher/actions/workflows/ci.yml)
[![Coverage Status](https://img.shields.io/badge/coverage-%E2%89%A599%25-brightgreen.svg?style=flat-square)](#-testing)
[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue.svg?logo=google-chrome&logoColor=white&style=flat-square)](https://developer.chrome.com/docs/extensions/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black&style=flat-square)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/github/license/Timmatt-Lee/high-score-ani-fetcher?style=flat-square&color=orange)](LICENSE)
[![CodeQL Analysis](https://github.com/Timmatt-Lee/high-score-ani-fetcher/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/Timmatt-Lee/high-score-ani-fetcher/actions/workflows/codeql-analysis.yml)

A modern Chrome Extension built with React, TypeScript, and Vite that fetches and filters high-score anime from [巴哈姆特動漫瘋](ani.gamer.com.tw).

## 🚀 Features

- **Fetch High Scores**: Automatically retrieves anime data from [巴哈姆特動漫瘋](ani.gamer.com.tw).
- **Filter & Sort**: Easily sort and filter through anime lists based on user ratings.
- **Modern Tech Stack**: Built with React 19, TypeScript, and Vite for blazing fast development.
- **Robust Quality Control**: Includes strict ESLint rules, Vitest for unit/coverage testing, and Husky for pre-commit hooks.

## 🛠️ Installation & Setup

1. **Clone the repository**:

   ```sh
   git clone https://github.com/Timmatt-Lee/high-score-ani-fetcher.git
   cd high-score-ani-fetcher
   ```

2. **Install dependencies**:

   ```sh
   npm install
   ```

3. **Start the development server (HMR enabled)**:

   ```sh
   npm run dev
   ```

## 📦 Building for Production

To build the extension for production (e.g., to upload to the Chrome Web Store):

```sh
npm run build
```

The output will be generated in the `dist` folder. You can then load this unpacked folder into Chrome via `chrome://extensions/`.

## 🧪 Testing

This project maintains a strictly 99% test coverage standard (the AI-augmented gold standard) and utilizes both Unit/Integration tests and End-to-End (E2E) tests.

- **Run Unit & Integration Tests (Fast)**:

  ```sh
  npm run test
  ```

  _These tests run via Vitest, check coverage, and are automatically executed before every commit using Husky._

- **Component Visual Sandbox & Documentation (Storybook)**:

  To run the Storybook component library locally:

  ```sh
  npm run storybook
  ```

  To build the static Storybook:

  ```sh
  npm run build-storybook
  ```

- **Visual Regression Testing (Chromatic)**:

  We use Chromatic for cloud-based visual regression testing. It runs automatically in CI/CD, eliminating flakiness from OS-specific rendering engines (no local Docker required).

  To publish new visual baselines manually:

  ```sh
  npm run chromatic -- --project-token=<your-token>
  ```

- **Functional End-to-End (E2E) Tests (Playwright)**:

  To verify Chrome Extension behaviors (like page scanning and service worker messaging):

  ```sh
  npm run test:e2e
  ```

  _Note: Playwright visual regression snapshots have been completely replaced by Chromatic; E2E tests now strictly verify functional integration._

## 📜 License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.
