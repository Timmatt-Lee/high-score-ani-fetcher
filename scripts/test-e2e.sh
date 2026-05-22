#!/bin/bash
if [ "$CI" = "true" ]; then
  npx playwright test "$@"
else
  docker run --rm --ipc=host -v "$(pwd)":/work -w /work mcr.microsoft.com/playwright:v1.60.0-noble npx playwright test "$@"
fi
