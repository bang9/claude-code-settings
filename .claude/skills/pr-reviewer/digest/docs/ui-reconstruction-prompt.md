# UI Reconstruction Prompt

Prompt template for Phase 2C codex session. Replace `<placeholders>` with actual values.

```
## Context
PR #<number>: <title>
Repository: <owner>/<repo>

## Technology Stack
<e.g., React Native + TypeScript, React 18 + Tailwind CSS, Vue 3 + Composition API, SwiftUI, Jetpack Compose>

## Changed UI Files
<list of modified UI file paths from the diff, one per line>

## UI States to Reconstruct
<list each state identified during Phase 1.3 analysis, e.g.:
- Grid with 1 image
- Grid with 2 images
- Grid with 5 images
- Pending upload (dimmed overlay)
- Media viewer open (full-screen modal)
- Failed upload state
>

## Task

MODE: Read-only exploration. You have full read access to the repository.
Do NOT run builds, execute scripts, modify files, or install dependencies.

### Step 1: Explore

Before writing any HTML, explore the codebase to build a complete picture of the changed UI.

1. **Read changed files** — understand component structure, rendering logic, and state handling
2. **Follow imports** — read child components, shared UI primitives, and layout wrappers that the changed files reference directly
3. **Resolve the style foundation** — find and read the project's design tokens, theme definitions, color palettes, spacing scales, and typography values (whatever form they take in this stack)
4. **Resolve component styles** — read associated stylesheets, style objects, or style definitions that govern the changed components' appearance
5. **Identify visual assets** — when icon references or image constants appear, locate the actual SVG paths or asset definitions to reproduce them faithfully

Stop exploring when you have enough context to reconstruct every listed UI state with exact colors, spacing, typography, and iconography. Breadth over depth — skip unrelated code.

### Step 2: Reconstruct

Produce a single self-contained HTML file that visually reconstructs each UI state listed above.

Requirements:
- The output must feel like a high-fidelity UI specimen, not a wireframe or rough mockup.
- Use the exact design values you found during exploration: hex colors, px/rem spacing, font families, border radii, shadows. Do not approximate — if the token says `#1A1A2E`, use `#1A1A2E`.
- Reconstruct the changed UI as independent component/state demos. Each state should be visually inspectable on its own, with a small neutral label outside the specimen if needed.
- Preserve component boundaries and relationships implied by the code. If the PR changes a dropdown, modal, selector, popover, sheet, tab, or inline editor, show the surrounding parent surface that gives that state meaning.
- Make state differences explicit. If code implies open/closed, selected/unselected, loading/idle, empty/error, focused/blurred, disabled/enabled, or multi-variant branches, render them as separate specimens.
- Reproduce icons faithfully. If you found SVG sources during exploration, inline them. If the project uses an icon font or library you cannot inline, use a close visual match with inline SVG and note the original icon name.
- For non-web platforms (React Native, SwiftUI, Jetpack Compose, Flutter), map platform primitives to their closest HTML/CSS equivalents while preserving the visual intent. E.g., RN `View`→`div`, `Text`→`span`, SwiftUI `VStack`→flex column, Compose `Column`→flex column.
- Inline all CSS — no external dependencies.
- Use realistic placeholder content only where actual assets are unavailable. Prefer believable text lengths, avatar circles, file names, chips, rows, and inline SVG placeholders over generic colored boxes.
- Default to a light theme unless the source code clearly represents a dark-only UI.
- Avoid heavy framing around each specimen. Use plain layout, dividers, spacing, and subtle surfaces before adding cards.
- For modals, popovers, dropdowns, or overlays, render them in their visible state with correct anchoring and layering. Do not reduce them to detached callouts.
- If responsive behavior is obvious from the code, preserve the primary desktop composition and at least one compact/mobile variant when it materially changes the layout.
- Assume a main review viewport around 960px wide unless the component code clearly suggests a narrower canvas. Individual specimens may be narrower when appropriate.
- If more than 8 states are listed, group related states into compact sections, but keep each actual specimen separate.
- Do not artificially optimize for short output. Use as much HTML/CSS as needed to preserve fidelity.

Quality bar:
- The digest reader should immediately understand what changed by looking at the reconstruction, without reading the source first.
- If the result could plausibly belong to any generic SaaS app, it is too vague — the project's own design language must be visible.
- If multiple states look visually identical except for their labels, you have missed meaningful state-specific detail.
- If colors, spacing, or typography feel "close but off", you did not use the actual token values from the codebase.

Output ONLY the raw HTML starting with <!DOCTYPE html> or <html>.
No markdown fences, no explanation before or after.
```
