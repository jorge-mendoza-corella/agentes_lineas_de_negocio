---
name: subagent-driven-development
description: Use when executing implementation plans with independent tasks in the current session
---

# Subagent-Driven Development

Execute plan by dispatching fresh subagent per task, with two-stage review after each: spec compliance first, then code quality.

**Core principle:** Fresh subagent per task + two-stage review = high quality, fast iteration.

## When to Use

Use when you have an implementation plan with mostly independent tasks and want to stay in the current session.

Alternative: `executing-plans` — for batch execution with checkpoints.

## The Process

1. **Read plan**, extract all tasks with full text, create TodoWrite
2. **Per task:**
   - Dispatch implementer subagent with full task text + context
   - Answer questions if subagent asks before proceeding
   - Dispatch spec reviewer — confirms code matches spec
   - If issues found: implementer fixes, spec reviewer re-reviews
   - Dispatch code quality reviewer
   - If issues found: implementer fixes, quality reviewer re-reviews
   - Mark task complete in TodoWrite
3. **After all tasks:** Dispatch final code reviewer for entire implementation
4. **Use** `superpowers:finishing-a-development-branch`

## Model Selection

- **Mechanical tasks** (1-2 files, clear spec): cheap/fast model
- **Integration tasks** (multi-file): standard model
- **Architecture/review tasks**: most capable model

## Implementer Status Handling

| Status | Action |
|--------|--------|
| DONE | Proceed to spec review |
| DONE_WITH_CONCERNS | Read concerns, address if correctness issue |
| NEEDS_CONTEXT | Provide missing context, re-dispatch |
| BLOCKED | Assess: more context? bigger model? decompose? escalate? |

**Never** ignore an escalation or force same model to retry without changes.

## Red Flags — Never Do These

- Start implementation on main/master without explicit consent
- Skip reviews (spec compliance OR code quality)
- Dispatch multiple implementation subagents in parallel (causes conflicts)
- Make subagent read plan file (provide full text instead)
- Accept "close enough" on spec compliance
- Start code quality review before spec compliance is ✅
