---
name: finishing-a-development-branch
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work
---

# Finishing a Development Branch

## Overview

Guide completion of development work by presenting clear options and handling chosen workflow.

**Core principle:** Verify tests → Present options → Execute choice → Clean up.

## The Process

### Step 1: Verify Tests

```bash
pnpm test
```

If tests fail: show failures, cannot proceed until they pass.

### Step 2: Present Options (exactly these 4)

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

### Step 3: Execute Choice

**Option 1 — Merge locally:**
```bash
git checkout <base-branch>
git pull
git merge <feature-branch>
# verify tests pass
git branch -d <feature-branch>
```

**Option 2 — Push and PR:**
```bash
git push -u origin <feature-branch>
gh pr create --title "..." --body "..."
```
Branch stays, worktree cleaned.

**Option 3 — Keep as-is:** Report branch and worktree path. No cleanup.

**Option 4 — Discard:** Require typed "discard" confirmation first.
```bash
git checkout <base-branch>
git branch -D <feature-branch>
```

## Rules

**Never:**
- Proceed with failing tests
- Delete work without typed confirmation
- Force-push without explicit request

**Always:**
- Verify tests before offering options
- Present exactly 4 options
- Get typed "discard" for Option 4
