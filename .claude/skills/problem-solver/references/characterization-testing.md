# Characterization Testing

Shared foundation for refactoring and feature addition. Before changing existing logic, pin its current behavior with a rock-solid test suite — that suite is the safety net the change rides on.

## Goal

A test suite that fails the moment behavior changes, so any regression from your edit is caught immediately.

## Steps

1. Identify the surface — the functions, modules, and boundaries the upcoming change will touch.
2. Capture current behavior — write tests asserting what the code does *today* (not what it should do). Include the unglamorous paths: edge cases, error handling, boundary values.
3. Assert behavior, not implementation — test observable outputs/effects, so the suite survives the refactor instead of breaking on internal renames.
4. Confirm the net is real — each test must fail for the right reason if the behavior it pins is broken. A test that can't fail protects nothing.

## Evaluate the Suite (loop)

Run third-party evaluation on the tests themselves before building on them.

REQUIRED: `references/third-party-evaluation.md` — criteria row: *Tests*.

If the reviewer finds the suite weak or gappy → strengthen and re-evaluate. Do not start the refactor/feature until the foundation passes.
