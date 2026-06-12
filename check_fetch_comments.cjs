const fs = require('fs');

const comments1 = JSON.parse(fs.readFileSync('comments_all_100.json', 'utf8'));
const comments2 = JSON.parse(fs.readFileSync('comments_all_page2.json', 'utf8'));
const comments = [...comments1, ...comments2];

comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

console.log(`Total comments fetched: ${comments.length}`);

const threads = {};
for (const comment of comments) {
  const threadId = comment.in_reply_to_id || comment.id;
  if (!threads[threadId]) {
    threads[threadId] = [];
  }
  threads[threadId].push(comment);
}

for (const threadId in threads) {
  const list = threads[threadId];
  const lastComment = list[list.length - 1];
  
  if (lastComment.user.login !== 'ai-timmatt' && lastComment.user.login !== 'antigravity-bot') {
    console.log(`=== Unresolved Thread (ID: ${threadId}) ===`);
    console.log(`Path: ${lastComment.path}`);
    for (const c of list) {
      console.log(`  [${c.user.login}]: ${c.body}`);
    }
    console.log();
  }
}
