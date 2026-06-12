const { execSync } = require("child_process");

const comments = [
  {
    id: 3338026444,
    body: "Done. We removed `AnimeDetails` and `AnimeInfo` from the public exports in `src/services/scraper/index.ts`. External components and services can only import the unified `AnimeItem` and `AnimeItemSchema` now."
  }
];

const pullNumber = 88;
const repo = "Timmatt-Lee/high-score-ani-fetcher";

for (const comment of comments) {
  console.log(`Replying to comment ${comment.id}...`);
  try {
    const payload = JSON.stringify({
      body: comment.body,
      in_reply_to: comment.id
    });
    const cmd = `gh api repos/${repo}/pulls/${pullNumber}/comments -X POST --input -`;
    execSync(cmd, { input: payload, encoding: "utf-8" });
    console.log(`Success!`);
  } catch (err) {
    console.error(`Failed to reply to comment ${comment.id}:`, err.message);
  }
}
