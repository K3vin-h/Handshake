# Kit setup (Ryan, 15 minutes, before or at H0.5)

Files in this kit:
- CLAUDE.judging.md        -> append to your repo's CLAUDE.md
- .claude/commands/*.md    -> copy into the repo's .claude/commands/  (/prize-check, /a11y-audit, /devpost-draft, /letter-gate)
- .claude/agents/reviewer.md -> copy into the repo's .claude/agents/
- docs-templates/notes.md, test-log.md -> copy into the repo's docs/

## Steps (from the repo root, on main, before anyone creates a worktree)
1. cat CLAUDE.judging.md >> CLAUDE.md
2. mkdir -p .claude/commands .claude/agents docs
3. cp .claude/commands/*.md <repo>/.claude/commands/ ; cp .claude/agents/reviewer.md <repo>/.claude/agents/
4. cp docs-templates/notes.md docs-templates/test-log.md <repo>/docs/
5. Check .gitignore contains .env, then: git add . && git commit -m "Add judging map, commands, reviewer" && git push
6. Everyone pulls BEFORE creating their worktree (claude --worktree cv / frontend / backend), so every session sees these files.

## Test that it loaded (5 minutes, then stop)
- Start claude in the repo and type /  : you should see prize-check, a11y-audit, devpost-draft, letter-gate.
- Ask "what is our demo word and the Letter gate?" : it should answer from CLAUDE.md.
- If the commands don't show, the folder format may differ in your Claude Code version: check the Claude Code docs, or just paste the command text as a normal prompt. Delete anything that doesn't load; do not debug it.

## Who runs what
- Ryan: /letter-gate after each batch of tests; /prize-check at H8, H12, H16.
- Teammate A: /a11y-audit on each screen before H14, again at H16.
- Teammate B: /devpost-draft at H12 (with notes.md filled in) and again at H19.
- Anyone: the reviewer agent ("use the reviewer agent on the lesson screen") after a feature is done.

## Limits to remember
- Claude cannot see the webcam or run recognition tests. The test log is human-only.
- Contrast: Claude can only estimate from code. Confirm with a real contrast checker.
- These files assume the demo word LILY and Units 1-2 only. If the scope in the planning doc changes, edit CLAUDE.md, not each prompt.
