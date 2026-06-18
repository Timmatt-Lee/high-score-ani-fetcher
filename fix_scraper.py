with open("src/services/animeScanner/animeScraper.ts", "r") as f:
    content = f.read()

import re

# We will add a simple sleep function at the top
if 'const sleep = (ms: number)' not in content:
    content = content.replace('export class AnimeScraper {', 'const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));\n\nexport class AnimeScraper {')

# We will modify the fetchUrl to retry on 429
fetch_old = """  private async fetchUrl(
    url: string,
    page: number,
    scanStep: AnimeScanStep,
    animeName?: string,
  ): Promise<Result<string, AnimeScanHttpError>> {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {"""

fetch_new = """  private async fetchUrl(
    url: string,
    page: number,
    scanStep: AnimeScanStep,
    animeName?: string,
    retries = 3,
  ): Promise<Result<string, AnimeScanHttpError>> {
    let response: Response;
    try {
      response = await fetch(url);
      
      // Handle 429 Too Many Requests
      if (response.status === 429 && retries > 0) {
        const retryAfter = response.headers.get("retry-after");
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : (4 - retries) * 2000;
        await sleep(delay);
        return this.fetchUrl(url, page, scanStep, animeName, retries - 1);
      }
    } catch (err) {"""

content = content.replace(fetch_old, fetch_new)

with open("src/services/animeScanner/animeScraper.ts", "w") as f:
    f.write(content)

