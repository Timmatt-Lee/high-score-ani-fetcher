# Google L5 SWE Development & Code Quality Guidelines

This document outlines the strict software engineering practices and coding standards applied to this repository. These guidelines are compiled from the **Google TypeScript Style Guide**, **Google Engineering Practices (Code Review Guide)**, and industry-standard robust TypeScript/JavaScript patterns. All agents and developers modifying this codebase must adhere to these rules.

---

## 1. Exception Handling & Robustness

### 1.1. Focused Try-Catch (Narrow Scope)

- **Rule**: Keep `try` blocks as concise and focused as possible. Only enclose statements that are expected to throw catchable exceptions (e.g., I/O operations, network requests, file system access, or external data parsing).
- **Rationale**: Placing non-throwable statements inside a `try` block risks swallowing unexpected logic bugs (e.g., `TypeError`, `ReferenceError`, or logical assertion failures) and incorrectly labeling them as generic I/O or network failures. This violates the "Fail Fast" principle and complicates debugging.
- **Example**:
  - ❌ **Bad (Broad Try-Catch)**:

    ```typescript
    try {
      const response = await fetch(url);
      const html = await response.text();
      const dom = new DOMParser().parseFromString(html, "text/html");
      const title = dom.querySelector("h1")?.textContent;
      if (!title) {
        throw new Error("Title not found");
      }
      return { title, status: "success" };
    } catch (error) {
      logger.error("Failed to get title:", error);
      return { title: "N/A", status: "error" };
    }
    ```

  - ✔ **Good (Focused Try-Catch)**:

    ```typescript
    let html: string;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      html = await response.text();
    } catch (networkError) {
      logger.error("Network fetch failed:", networkError);
      throw new Error(`Failed to fetch content from ${url}`); // Or handle gracefully
    }

    // Parsing and business logic reside outside the try-catch block
    const dom = new DOMParser().parseFromString(html, "text/html");
    const title = dom.querySelector("h1")?.textContent;
    if (!title) {
      throw new Error("Malformed DOM: h1 title element not found");
    }
    return { title, status: "success" };
    ```

### 1.2. Strict Type Safety in Catch Blocks

- **Rule**: In TypeScript, the catch block parameter defaults to `unknown`. Never blindly cast it using `as Error` without validation. Always use type narrowing or type guards.
- **Example**:

  ```typescript
  try {
    // throwing operation
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(error.message, error.stack);
    } else {
      console.error("An unexpected error occurred:", error);
    }
  }
  ```

### 1.3. Throwing Standard Error Objects

- **Rule**: Always throw instances of the standard `Error` class or its subclasses (e.g., `TypeError`, `RangeError`, or a custom subclass). Never throw string literals, numbers, or arbitrary objects.
- **Rationale**: Standard `Error` objects automatically capture stack traces at the point of instantiation, which is critical for root-cause analysis.

### 1.4. No Empty Catch Blocks

- **Rule**: Never swallow exceptions silently. A `catch` block must either handle the exception, log it, wrap and rethrow it, or explicitly document in a comment why swallowing the error is safe and intentional.

---

## 2. Code Organization & Architecture

### 2.1. Test Co-location (Co-location Principle)

- **Rule**: Unit and component tests must reside next to their corresponding implementation files (e.g., `src/services/scraper.ts` should have `src/services/scraper.test.ts` right next to it).
- **Rationale**: Increases discoverability, keeps related files together, makes it easier to verify changes, and simplifies directory imports.

### 2.2. Folder Structure

- Group by technical/domain boundaries (e.g., `components/`, `hooks/`, `services/`, `utils/`).
- Keep helper logic localized to the component or service unless it is explicitly generic and reusable across multiple features.

---

## 3. Tooling & Automation Rules

### 3.1. Zero-Warning Linter & Formatter Enforcement

- Linter (ESLint) and Formatter (Prettier) checks must pass with zero errors and warnings prior to every commit.
- Configure automated git pre-commit hooks (Husky & lint-staged) to enforce quality locally before code reaches the remote repository.

### 3.2. Strict TypeScript Compilation

- Maintain maximum strictness in compiler flags (e.g., `"strict": true`, `"noImplicitAny": true`, `"noImplicitReturns": true`, `"noUnusedLocals": true`).

### 3.3. Test Coverage Threshold (>= 99%)

- All new or modified files must maintain or exceed **99% branch and statement coverage**.
- Write comprehensive unit and integration tests to cover happy paths, edge cases, error conditions, and retry behaviors.

---

## 4. References & External Resources

For deeper alignment with official standards, refer to:

- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
- [Google Engineering Practices Guide](https://github.com/google/eng-practices)
