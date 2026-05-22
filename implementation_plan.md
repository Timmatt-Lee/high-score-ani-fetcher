# Implementation Plan - Scraper Refactoring & Error Handling Improvements

## Goal

Refactor `ScraperService` to align with high-quality engineering standards: move from static methods to an instance-based singleton (DI-ready), improve error transparency by throwing explicit errors instead of masking them with defaults, and strictly follow user-specified URL construction.

## Tasks

### 1. Refactor `ScraperService`

- [x] Change `BASE_URL` to `https://ani.gamer.com.tw` (no trailing slash).
- [x] Convert `ScraperService` from a class with static methods to a class that is instantiated.
- [x] Export a singleton instance of `ScraperService`.
- [x] Improve `fetch` error handling:
  - Include the URL and status code in the thrown Error.
  - [x] `getTotalPages`: Throw if `!response.ok`.
  - [x] `scrapeListPage`: Throw if `!response.ok` (stop returning `[]`).
  - [x] `scrapeAnimeDetails`: Throw if `!response.ok`.
- [x] Increase strictness in parsing:
  - [x] `getTotalPages`: Throw if `.page_number a` elements are missing.
  - [x] `getTotalPages`: Throw if the last page text is not a valid number.
  - [x] `scrapeListPage`: Throw or keep empty if `title` is missing (avoid "No Title").
  - [x] `scrapeListPage`: Throw if mandatory elements for an `AnimeItem` are missing or invalid (if deemed critical).

### 2. Update Hooks & Components

- [x] Update `useAnimeScanner` to use the `scraperService` instance.
- [x] Ensure `useAnimeScanner` handles the new thrown errors properly (it already has a `try/catch` block).

### 3. Update Tests

- [x] Update `src/services/scraper.test.ts` to match the new instance-based API.
- [x] Update tests to expect thrown errors instead of default/fallback values.
- [x] Ensure test coverage remains ≥ 99% (Achieved 100%).

### 4. Verification

- [x] Run `npm run test` (Vitest) to verify unit tests.
- [x] Run `npm run lint` and `npm run type-check`.
- [x] (Optional) Run E2E tests if relevant changes affect UI flow.

## Design Decisions

- **Singleton Pattern:** Moving away from `static` allows for easier mocking and aligns better with DI patterns in React (e.g., providing the service via Context).
- **Fail Fast:** Throwing errors instead of returning "No Title" or "1" (for pages) ensures that scraping failures are noticed and diagnosed immediately rather than producing silent data corruption.
