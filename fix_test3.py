import re

with open("src/services/animeScanner/animeScanner.test.ts", "r") as f:
    content = f.read()

default_settings_str = """
const defaultSettings = {
  targetScore: 4.8,
  rescanThreshold: 95,
  cacheExpireDays: 14,
};
const defaultMap = new Map();
"""

content = content.replace('const runPipeline =', default_settings_str + '\nconst runPipeline =')

content = re.sub(
    r'new AnimeScanner\(\s*totalPages,\s*pageConcurrency,\s*detailConcurrency,\s*filterItem,\s*scraper(,\s*\{[^}]*\})?\s*\)',
    r'new AnimeScanner(totalPages, pageConcurrency, detailConcurrency, filterItem, scraper, defaultMap, defaultSettings\1)',
    content
)

with open("src/services/animeScanner/animeScanner.test.ts", "w") as f:
    f.write(content)
