---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase. Document everything: which files to touch, code, testing, how to test it. Bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

**Save plans to:** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`

## Plan Document Header (Mandatory)

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** [One sentence]
**Architecture:** [2-3 sentences]
**Tech Stack:** [Key technologies]
---
```

## Task Structure

```markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts`
- Test: `tests/exact/path/to/test.ts`

- [ ] **Step 1: Write the failing test**
[actual test code here]

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test path/to/test`
Expected: FAIL with "X not defined"

- [ ] **Step 3: Write minimal implementation**
[actual implementation code here]

- [ ] **Step 4: Run test to verify it passes**
Expected: PASS

- [ ] **Step 5: Commit**
git commit -m "feat: add X"
```

## No Placeholders — Ever

These are plan failures — never write them:
- "TBD", "TODO", "implement later"
- "Add appropriate error handling"
- "Write tests for the above" (without actual test code)
- Steps that describe what to do without showing how

## Self-Review After Writing

1. **Spec coverage:** Can you point to a task for each requirement?
2. **Placeholder scan:** Any TBD, TODO, incomplete steps?
3. **Type consistency:** Do method names match across tasks?

## Execution Handoff

After saving, offer:
1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review
2. **Inline Execution** — execute tasks in this session using executing-plans
