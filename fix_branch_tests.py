import re

with open("src/hooks/useAnimeScanner.test.ts", "r") as f:
    content = f.read()

# Replace arguments for the first branch test
content = content.replace("useAnimeScanner([mockFav], [mockTrash], [], defaultSettings, onComplete)", "useAnimeScanner([], [mockFav], [mockTrash], defaultSettings, onComplete)")

# Replace the second one too
content = content.replace("useAnimeScanner([mockFav], [mockTrash], [], defaultSettings, onComplete)", "useAnimeScanner([], [mockFav], [mockTrash], defaultSettings, onComplete)")

# For the third and fourth test, fix the observable creation
# Test 3
test_3_bad = """vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      const { Subject } = require("rxjs");
      const subject = new Subject();
      setTimeout(() => {
        subject.next(new AnimeScanParseError(1, "step", "url", "err"));
        subject.complete();
      }, 0);
      return subject;
    });"""

test_3_good = """vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return createMockObservable([new AnimeScanParseError(1, "step", "url", "err")]);
    });"""

content = content.replace(test_3_bad, test_3_good)

# Test 4
test_4_bad = """vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      const { Subject } = require("rxjs");
      const subject = new Subject();
      setTimeout(() => {
        subject.error({ notAnError: true });
      }, 0);
      return subject;
    });"""

test_4_good = """vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      const { Observable } = require("rxjs");
      return new Observable((subscriber) => {
        subscriber.error({ notAnError: true });
      });
    });"""

content = content.replace(test_4_bad, test_4_good)

with open("src/hooks/useAnimeScanner.test.ts", "w") as f:
    f.write(content)

