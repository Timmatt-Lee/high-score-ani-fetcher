#!/bin/bash
# This helper script executes E2E Playwright tests.
# We wrap the command in a script to handle argument forwarding correctly.
#
# WHY THIS SCRIPT IS NEEDED:
# If we run 'npm run test:e2e -- --update-snapshots' with inline bash scripts in package.json
# (e.g., "if [ $CI = true ]; then ...; else ...; fi"), npm appends the arguments to the very end
# of the string, resulting in "fi --update-snapshots" which causes a bash syntax error.
# Using this script and forwarding arguments via "$@" resolves the parameter placement issue.

# Check if we are running in a CI environment (like GitHub Actions)
if [ "$CI" = "true" ]; then
  # On CI, run tests natively on the host runner (Ubuntu) to save resources
  # "$@" forwards all command line arguments (e.g. --update-snapshots) to playwright
  npx playwright test "$@"
else
  # Locally, run tests inside the official Playwright Docker container to prevent OS-specific
  # rendering discrepancies (especially for visual screenshot comparisons)
  # -v "$(pwd)":/work mounts the project directory
  # -w /work sets the working directory inside the container
  # "$@" forwards all command line arguments to playwright inside the container
  docker run --rm --ipc=host -v "$(pwd)":/work -w /work mcr.microsoft.com/playwright:v1.60.0-noble npx playwright test "$@"
fi
