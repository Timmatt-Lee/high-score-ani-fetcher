# Implementation Plan - Scraper Infrastructure & Strictness Upgrade

## Goal

Elevate the project to L5 engineering standards by implementing Dependency Injection (DI) for services, enhancing error transparency with custom error types and HTML snippets, refactoring data models for better separation of concerns, and enforcing absolute strictness in parsing to prevent silent failures.

## Tasks

### 1. Refactor Data Models & Interfaces

- [x] Create `AnimeDetails` interface for specific detail fields (`score`, `rating_count`, `description`).
- [x] Refactor `AnimeItem` to inherit from `AnimeDetails`.
- [x] Ensure all fields use correct types (`number` for counts/scores, `Date` for dates).

### 2. Advanced Error Handling

- [x] Implement `ScraperError` custom class.
- [x] Include `url`, `status`, `statusText`, and `htmlSnippet` in the error context.
- [x] Implement "Snippet Capture": When a fetch fails, capture the first 500 characters of the response body to facilitate debugging.
- [x] Enforce "Parsing Strictness":
  - [x] Throw if `title` is missing (no "No Title" defaults).
  - [x] Throw if `score` is missing or invalid.
  - [x] Throw if `description` is missing or empty.
  - [x] Throw if numeric parsing for watch/episode counts results in `NaN`.

### 3. Dependency Injection (DI) Architecture

- [x] Create `ServiceProvider` and `ServiceContext` to manage service instances.
- [x] Use `useServices` hook for service access in components/hooks.
- [x] Wrap the application entry point with `ServiceProvider`.
- [x] Update existing hooks (`useAnimeScanner`) to use DI instead of direct imports.

### 4. Refining Logic

- [x] Improve `watchCount` parsing to correctly handle decimal strings like "2.5萬" and ensure integer results via `Math.floor`.
- [x] Refine CSS selectors to prevent accidental matching of titles instead of meta-data.

### 5. Verification & Quality

- [x] Maintain 100% unit test coverage across all new infrastructure.
- [x] Add tests for `ServiceContext` and its error boundaries.
- [x] Ensure all lint rules and type checks pass.

## Design Decisions

- **DI for Singleton**: Direct export of a singleton is a "quick fix"; using React Context for DI is the "institutional standard" as it allows for clean mocking in tests and facilitates future growth (e.g., swapping implementations or providing different services per environment).
- **Hard Error Boundaries**: By throwing on _any_ missing expected data, we ensure that changes in the source site's structure are detected immediately. This is far superior to "best-effort" parsing which leads to hard-to-debug data corruption.
- **Contextual Errors**: Including the HTML snippet in the error object allows us to see exactly what the scraper was looking at when it failed, without needing to manually reproduce the fetch in a browser.
