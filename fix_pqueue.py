with open("src/services/animeScanner/animeScanner.ts", "r") as f:
    content = f.read()

content = content.replace(
    'this.pageQueue = new PQueue({ concurrency: pageConcurrency });',
    'this.pageQueue = new PQueue({ concurrency: pageConcurrency, intervalCap: 2, interval: 1000 });'
)
content = content.replace(
    'this.detailQueue = new PQueue({ concurrency: detailConcurrency });',
    'this.detailQueue = new PQueue({ concurrency: detailConcurrency, intervalCap: 10, interval: 1000 });'
)

with open("src/services/animeScanner/animeScanner.ts", "w") as f:
    f.write(content)

