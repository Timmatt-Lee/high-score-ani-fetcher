/**
 * TypeScript migration rationale for verify-visual-coverage:
 * - Consistency: Aligning build/utility tools with the codebase's language (TypeScript) maintains code standards and unified tooling.
 * - Type Safety: Static typing prevents runtime property typos and ensures correctness in Node filesystem path manipulations.
 * - Maintenance: Utilizing native tools like `tsx` allows executing this TypeScript script directly in dev and CI environments without overhead.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const COMPONENTS_DIR = path.join(PROJECT_ROOT, "src", "components");

console.log(
  "🔍 Checking visual regression test coverage (Storybook stories)...",
);

// Helper to recursively find files matching a suffix
function getFiles(dir: string, suffix: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath, suffix));
    } else if (filePath.endsWith(suffix)) {
      results.push(filePath);
    }
  }
  return results;
}

const componentFiles = getFiles(COMPONENTS_DIR, ".tsx");
let missingCount = 0;

for (const componentFile of componentFiles) {
  const baseName = path.basename(componentFile);
  const dirName = path.dirname(componentFile);

  // Skip index.ts/index.tsx, Icons.tsx, setup/test files, or files inside test/story directories
  if (
    baseName.startsWith("index.") ||
    baseName === "Icons.tsx" ||
    baseName.includes(".test.") ||
    baseName.includes(".stories.") ||
    dirName.includes("test")
  ) {
    continue;
  }

  // Expect a .stories.tsx or .stories.ts with the same name in the same directory
  const storyName = baseName.replace(".tsx", ".stories.tsx");
  const storyPath = path.join(dirName, storyName);

  if (!fs.existsSync(storyPath)) {
    console.error(
      `❌ [Visual Coverage Failure] UI component "${path.relative(
        PROJECT_ROOT,
        componentFile,
      )}" has no corresponding Storybook file "${storyName}"!`,
    );
    missingCount++;
  }
}

if (missingCount > 0) {
  console.error(
    `\n🚨 Error: Found ${missingCount} UI component(s) missing Storybook stories for visual validation.`,
  );
  console.error(
    "Please create a corresponding *.stories.tsx file and capture all major visual states.",
  );
  process.exit(1);
} else {
  console.log(
    "✅ All UI components have corresponding Storybook stories. Visual coverage check passed!",
  );
  process.exit(0);
}
