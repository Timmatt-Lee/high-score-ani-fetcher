const fs = require('fs');

const fileContent = fs.readFileSync('comments_latest.json', 'utf8');
const comments = JSON.parse(fileContent);

comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

const threads = {};
for (const comment of comments) {
  const threadId = comment.in_reply_to_id || comment.id;
  if (!threads[threadId]) {
    threads[threadId] = [];
  }
  threads[threadId].push(comment);
}

let count = 0;
for (const threadId in threads) {
  const list = threads[threadId];
  const lastComment = list[list.length - 1];
  
  if (lastComment.user.login !== 'ai-timmatt' && lastComment.user.login !== 'antigravity-bot') {
    count++;
    if (count <= 10) {
      console.log(`=========================================`);
      console.log(`[${count}] Thread ID: ${threadId}`);
      console.log(`Path: ${lastComment.path}`);
      console.log(`Line: ${lastComment.line || lastComment.original_line}`);
      console.log(`Comment: "${lastComment.body}"`);
      console.log(`Diff Hunk:\n${lastComment.diff_hunk}`);
      console.log(`=========================================\n`);
    }
  }
}
