---
name: dispatching-parallel-agents
description: Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies
---

# Dispatching Parallel Agents

## Overview

When multiple unrelated failures or tasks exist (different test files, different subsystems, different bugs), investigating them sequentially wastes time. Each investigation is independent and can happen in parallel.

**Core principle:** Dispatch one agent per independent problem domain. Let them work concurrently.

## When to Use

**Use when:**
- 3+ test files failing with different root causes
- Multiple subsystems broken independently
- Each problem can be understood without context from others
- No shared state between investigations

**Don't use when:**
- Failures are related (fix one might fix others)
- Agents would interfere with each other (editing same files)
- Still in exploration phase

## The Pattern

### 1. Identify Independent Domains
Group failures by what's broken. Each domain is independent.

### 2. Create Focused Agent Tasks
Each agent gets:
- **Specific scope:** One test file or subsystem
- **Clear goal:** Make these tests pass
- **Constraints:** Don't change other code
- **Expected output:** Summary of what you found and fixed

### 3. Dispatch in Parallel
All agents run concurrently via the Agent tool.

### 4. Review and Integrate
When agents return: verify fixes don't conflict, run full test suite, integrate all changes.

## Good Agent Prompt Structure

1. **Focused** — One clear problem domain
2. **Self-contained** — All context needed to understand the problem
3. **Specific about output** — What should the agent return?

Example:
```
Fix the 3 failing tests in src/agents/agent-tool-abort.test.ts:
1. "should abort tool with partial output capture" - expects 'interrupted at' in message
2. "should handle mixed completed and aborted tools" - fast tool aborted instead of completed

Root cause likely: timing/race condition issues.
Return: Summary of what you found and what you fixed.
```

## Common Mistakes

| Wrong | Right |
|-------|-------|
| "Fix all the tests" | "Fix agent-tool-abort.test.ts" |
| No context | Paste the error messages |
| No constraints | "Do NOT change production code" |
| Vague output | "Return summary of root cause and changes" |

## Verification After Agents Return

1. Read each summary — understand what changed
2. Check for conflicts — did agents edit same code?
3. Run full suite — verify all fixes work together
4. Spot check — agents can make systematic errors
