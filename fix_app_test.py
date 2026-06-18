import re

with open("src/App.test.tsx", "r") as f:
    content = f.read()

content = content.replace('import { useAnimeScanner } from "./hooks/useAnimeScanner";', 'import { useAnimeScanner } from "./hooks/useAnimeScanner";\nimport { useSettings } from "./hooks/useSettings";')

mock_code = """
vi.mock("./hooks/useSettings", () => ({
  useSettings: vi.fn(),
}));
"""

content = content.replace('vi.mock("./hooks/useAnimeScanner", () => ({', mock_code + '\nvi.mock("./hooks/useAnimeScanner", () => ({')

setup_hook = """
    vi.mocked(useSettings).mockReturnValue({
      settings: { targetScore: 4.8, rescanThreshold: 95, cacheExpireDays: 14 },
      saveSettings: vi.fn(),
      isLoaded: true,
    });
"""

content = content.replace('  beforeEach(() => {', '  beforeEach(() => {' + setup_hook)

with open("src/App.test.tsx", "w") as f:
    f.write(content)
