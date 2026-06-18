import re

with open("src/services/animeScanner/animeScanner.test.ts", "r") as f:
    content = f.read()

# I will replace any new AnimeScanner(...) with regex, carefully extracting the last parameter which might be options or the scraper
def replacer(match):
    args_str = match.group(1)
    args = args_str.split(',')
    
    # We need to insert defaultMap, defaultSettings before the last argument if it's options
    # Wait, the signature is (totalPages, pageConcurrency, detailConcurrency, filterItem, scraper, existingAnimesMap, settings, options?)
    # Let's just find "as any as AnimeScraper" or "as AnimeScraper" and insert the map and settings after it.
    pass

# Actually, let's just do a string replacement for the scraper parts.
# The scraper in tests is usually `{ ... } as any as AnimeScraper` or `{ ... } as AnimeScraper`.
content = re.sub(
    r'(as any as AnimeScraper|as AnimeScraper)(,\s*\{.*?\}\s*)?\)',
    r'\1, defaultMap, defaultSettings\2)',
    content,
    flags=re.DOTALL
)

with open("src/services/animeScanner/animeScanner.test.ts", "w") as f:
    f.write(content)
