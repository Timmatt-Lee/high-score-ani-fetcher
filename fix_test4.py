import re

with open("src/services/animeScanner/animeScraper.test.ts", "r") as f:
    content = f.read()

default_settings_str = """
const defaultSettings = {
  targetScore: 4.8,
  rescanThreshold: 95,
  cacheExpireDays: 14,
};
const defaultMap = new Map();
"""

content = content.replace('describe("AnimeScraper", () => {', default_settings_str + '\ndescribe("AnimeScraper", () => {')

content = re.sub(
    r'new AnimeScanner\(\s*1,\s*1,\s*1,\s*\(\)\s*=>\s*true,\s*animeScraper\s*\)',
    r'new AnimeScanner(1, 1, 1, () => true, animeScraper, defaultMap, defaultSettings)',
    content
)

with open("src/services/animeScanner/animeScraper.test.ts", "w") as f:
    f.write(content)
