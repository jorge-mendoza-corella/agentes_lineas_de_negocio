---
name: test-driven-development
description: Use when implementing any feature or bugfix, before writing implementation code
---

# Test-Driven Development (TDD)

## Overview

Write the test first. Watch it fail. Write minimal code to pass.

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? Delete it. Start over.

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Delete means delete

## Red-Green-Refactor

### RED - Write Failing Test
Write one minimal test showing what should happen. Run it. Confirm it fails for the expected reason.

### GREEN - Minimal Code
Write simplest code to pass the test. Don't add features beyond what the test requires.

### Verify GREEN
Run the test. Confirm it passes. Confirm other tests still pass.

### REFACTOR - Clean Up
After green only: remove duplication, improve names, extract helpers. Keep tests green.

### Repeat
Next failing test for next behavior.

## Common Rationalizations — All Mean: Delete Code, Start Over

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Already manually tested" | Ad-hoc ≠ systematic. No record, can't re-run. |
| "Deleting X hours is wasteful" | Sunk cost fallacy. Unverified code is debt. |
| "TDD will slow me down" | TDD faster than debugging. |

## Verification Checklist

Before marking work complete:
- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for expected reason
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Edge cases and errors covered

## Integration with Project Stack

- **TypeScript/Next.js**: Vitest
- **Python**: Pytest
- **E2E**: Playwright
- **BD**: Integration tests against Supabase local (never mocks)
