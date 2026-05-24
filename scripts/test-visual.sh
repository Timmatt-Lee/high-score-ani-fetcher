#!/bin/bash
# This helper script executes Visual Regression Playwright tests.
# We wrap the command in a script to handle argument forwarding correctly.
#
# WHY THIS SCRIPT IS NEEDED:
# Locally, running visual tests natively on macOS vs Linux CI will cause screenshot differences.
# Running them inside the same official Playwright Docker container enforces pixel-perfect consistency.

# Check if we are running in a CI environment (like GitHub Actions)
if [ "$CI" = "true" ]; then
  # On CI, run tests natively on the host runner (Ubuntu) to save resources
  # "$@" forwards all command line arguments (e.g. --update-snapshots) to playwright
  npx playwright test --config=playwright.visual.config.ts "$@"
else
  # Locally, run tests inside the official Playwright Docker container to prevent OS-specific
  # rendering discrepancies (especially for visual screenshot comparisons)
  # -v "$(pwd)":/work mounts the project directory
  # -w /work sets the working directory inside the container
  # "$@" forwards all command line arguments to playwright inside the container
  docker run --rm --ipc=host -v "$(pwd)":/work -w /work mcr.microsoft.com/playwright:v1.60.0-noble npx playwright test --config=playwright.visual.config.ts "$@"
fi
