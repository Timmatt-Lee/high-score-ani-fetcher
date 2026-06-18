with open("src/hooks/useAnimeScanner.test.ts", "r") as f:
    content = f.read()

content = content.replace('const { Observable } = await import("rxjs");', '')
# Import at top
content = "import { Observable } from 'rxjs';\n" + content

with open("src/hooks/useAnimeScanner.test.ts", "w") as f:
    f.write(content)

with open("src/services/animeScanner/animeScanner.test.ts", "r") as f:
    content2 = f.read()

content2 = content2.replace('const defaultSettings = { targetScore: 4.8, rescanThreshold: 95, cacheExpireDays: 14 };', '')

with open("src/services/animeScanner/animeScanner.test.ts", "w") as f:
    f.write(content2)

