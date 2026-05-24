# Repository-Specific Rules: high-score-ani-fetcher

This file defines the project-specific rules for the `high-score-ani-fetcher` repository. These rules override or extend the global rules specified in `~/.gemini/GEMINI.md`.

## 1. PR, Review & Merge Lifecycle (Custom Override)

For this repository, we enforce a Human-in-the-Loop Review process before auto-merging. Follow these steps:

1. **Local Checks:** Run all linters, formatters, and tests locally. Fix any errors.
2. **Push & PR:** Push the branch and automatically create a Pull Request.
3. **Wait for Human Review:** Do NOT auto-merge the PR immediately.
4. **Resolve Review Comments:**
   - When the user reviews the PR and leaves comments on GitHub (or notifies you about them in chat), you must inspect the GitHub comments.
   - Update the codebase to address every review comment.
   - Reply to the comments on GitHub (or in the chat) to explain your changes, and ensure they are resolved.
   - Re-run local checks and push updates to the branch.
5. **Auto-Merge on LGTM:**
   - Once all review comments are resolved and the user gives "LGTM" (Looks Good To Me) on the PR review (or says "LGTM" in chat), the PR can be auto-merged.
   - Delete the remote and local branches after a successful merge.
