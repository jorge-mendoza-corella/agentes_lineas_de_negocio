---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes
---

# Systematic Debugging

## Overview

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## The Four Phases

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**
1. Read error messages carefully — they often contain the exact solution
2. Reproduce consistently — can you trigger it reliably?
3. Check recent changes — git diff, recent commits, new dependencies
4. In multi-component systems: add diagnostic instrumentation at EACH layer to find WHERE it breaks
5. Trace data flow backward from symptom to source

### Phase 2: Pattern Analysis
- Find working examples of similar code in the same codebase
- Compare working vs broken — list every difference
- Understand dependencies and assumptions

### Phase 3: Hypothesis and Testing
- State clearly: "I think X is the root cause because Y"
- Make the SMALLEST possible change to test the hypothesis
- One variable at a time

### Phase 4: Implementation
1. Create failing test case that reproduces the bug
2. Implement single fix addressing the root cause
3. Verify fix — test passes, no other tests broken

**If 3+ fixes have failed:** STOP. Question the architecture. Don't attempt Fix #4 without discussion.

## Red Flags — Stop and Return to Phase 1

- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "Add multiple changes, run tests"
- "It's probably X, let me fix that"
- "One more fix attempt" (when already tried 2+)
- Each fix reveals new problem in different place

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple, don't need process" | Simple bugs have root causes too. Process is fast. |
| "Emergency, no time for process" | Systematic is FASTER than guess-and-check thrashing. |
| "I see the problem, let me fix it" | Seeing symptoms ≠ understanding root cause. |
| "One more fix attempt" (after 2+) | 3+ failures = architectural problem. |
