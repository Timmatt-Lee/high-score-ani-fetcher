const fs = require('fs');

const fileContent = fs.readFileSync('comments_latest.json', 'utf8');
const comments = JSON.parse(fileContent);

// Sort comments by created_at ascending
comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

console.log(`Total comments: ${comments.length}`);

// Group by thread (in_reply_to_id or id if it's the root of the thread)
const threads = {};
for (const comment of comments) {
  const threadId = comment.in_reply_to_id || comment.id;
  if (!threads[threadId]) {
    threads[threadId] = [];
  }
  threads[threadId].push(comment);
}

// Print thread details
for (const threadId in threads) {
  const list = threads[threadId];
  const lastComment = list[list.length - 1];
  
  // Show threads where the last comment is not from the bot
  if (lastComment.user.login !== 'ai-timmatt' && lastComment.user.login !== 'antigravity-bot') {
    console.log(`=== Unresolved Thread (ID: ${threadId}) ===`);
    console.log(`Path: ${lastComment.path}`);
    for (const c of list) {
      console.log(`  [${c.user.login}]: ${c.body}`);
    }
    console.log();
  }
}
