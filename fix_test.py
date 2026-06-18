import re

with open("src/hooks/useAnimeScanner.test.ts", "r") as f:
    content = f.read()

default_settings_str = """
const defaultSettings = {
  targetScore: 4.8,
  rescanThreshold: 95,
  cacheExpireDays: 14,
};
"""

content = content.replace('function createMockObservable(', default_settings_str + '\nfunction createMockObservable(')

# Replace the specific setup Hook
content = re.sub(
    r'const setupHook = \(.*?\)\s*=>\s*\{',
    r'const setupHook = (searchList: AnimeItem[] = [], favoriteList: AnimeItem[] = [], trashList: AnimeItem[] = []) => {',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'useAnimeScanner\(\s*searchList,\s*favoriteList,\s*trashList,\s*onScanComplete\s*\)',
    r'useAnimeScanner(searchList, favoriteList, trashList, defaultSettings, onScanComplete)',
    content
)

with open("src/hooks/useAnimeScanner.test.ts", "w") as f:
    f.write(content)
