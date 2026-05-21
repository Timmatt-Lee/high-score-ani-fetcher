# High Score Ani Fetcher

A modern Chrome Extension built with React, TypeScript, and Vite that fetches and filters high-score anime from 巴哈姆特動漫瘋 (動畫瘋 - ani.gamer.com.tw).

## 🚀 Features

- **Fetch High Scores**: Automatically retrieves anime data from 巴哈姆特動漫瘋.
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

This project maintains a strictly 90%+ test coverage standard and utilizes both Unit/Integration tests and End-to-End (E2E) tests.

- **Run Unit & Integration Tests (Fast)**:

  ```sh
  npm run test
  ```

  _These tests run via Vitest, check coverage, and are automatically executed before every commit using Husky._

- **Run End-to-End (E2E) Tests (Docker-based locally, Native in CI)**:

  > [!IMPORTANT]
  > **Prerequisite**: You must have **Docker Desktop** installed and running on your local machine. Locally, the E2E tests will automatically run inside Playwright's official Linux Docker container to guarantee consistent visual regression snapshot comparisons (preventing macOS vs. Linux font rendering discrepancies). In the CI/CD pipeline, tests run natively on the Linux runner.

  ```sh
  npm run test:e2e
  ```

  To update visual snapshots (inside Docker), run:

  ```sh
  npm run test:e2e:update
  ```

## 📜 License

This project is licensed under the terms specified in the `LICENSE` file.
