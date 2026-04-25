---
name: Icon Rebrand Update
overview: Replace the current starburst brand mark with an asymmetric origami-star identity across CLI prompt, banner art, and docs, while preserving terminal readability and existing banner behavior gates.
todos:
  - id: branch-create
    content: Create and switch to branch feature/tweak-stardust-icon
    status: completed
  - id: banner-icon-redesign
    content: Replace starburst art with asymmetric origami-star in src/banner.ts
    status: completed
  - id: prompt-marker-update
    content: Switch REPL prompt to ASCII two-character brand marker in src/repl.ts
    status: completed
  - id: docs-sync
    content: Update README, docs/chat-mode.md, and docs/assets/images/banner.svg to reflect new icon
    status: completed
  - id: verify
    content: Run build/demo checks and validate banner+prompt consistency
    status: completed
isProject: false
---

# Origami Icon Rebrand Plan

## Goal
Update the brand icon so it is visually distinct from Gemini-like sparkle marks, using an **origami-style asymmetric star** and an **ASCII 2-character prompt marker**.

## Scope
- CLI prompt icon in [`/mnt/stuff/WebstormProjects/awesome-md-to-pdf/src/repl.ts`](/mnt/stuff/WebstormProjects/awesome-md-to-pdf/src/repl.ts)
- Banner icon/eyebrow symbol language in [`/mnt/stuff/WebstormProjects/awesome-md-to-pdf/src/banner.ts`](/mnt/stuff/WebstormProjects/awesome-md-to-pdf/src/banner.ts)
- User-facing docs that explicitly describe/show the old glyph:
  - [`/mnt/stuff/WebstormProjects/awesome-md-to-pdf/README.md`](/mnt/stuff/WebstormProjects/awesome-md-to-pdf/README.md)
  - [`/mnt/stuff/WebstormProjects/awesome-md-to-pdf/docs/chat-mode.md`](/mnt/stuff/WebstormProjects/awesome-md-to-pdf/docs/chat-mode.md)
  - [`/mnt/stuff/WebstormProjects/awesome-md-to-pdf/docs/assets/images/banner.svg`](/mnt/stuff/WebstormProjects/awesome-md-to-pdf/docs/assets/images/banner.svg)

## Implementation Steps
1. Create branch `feature/tweak-stardust-icon`.
2. Introduce a new origami-star geometry in `src/banner.ts` (replace current symmetric starburst layout), keeping the current color palette and compact/wide banner behavior intact.
3. Replace prompt prefix in `src/repl.ts` from single Unicode glyph to an ASCII 2-character brand marker that remains clearly visible on light/dark terminals.
4. Align banner eyebrow markers in `src/banner.ts` with the new identity so prompt and banner feel like one brand system.
5. Update docs language/examples to remove references to the old `✦` starburst and describe the new origami mark + ASCII prompt marker.
6. Update `docs/assets/images/banner.svg` to match the new icon silhouette and eyebrow symbols.
7. Verify consistency by checking all remaining starburst/`✦` references and ensuring no stale copy remains.

## Verification
- Run targeted checks:
  - `npm run build`
  - `npm run demo:light`
  - `npm run demo:dark`
- Manual spot-check:
  - Launch `awesome-md-to-pdf` and confirm prompt marker + banner icon are coherent and readable.
  - Verify README and docs screenshots/text match runtime output.

## Notes
- Keep existing `--no-banner` and `MDTOPDF_NO_BANNER` behavior unchanged.
- Keep changes branding-focused; avoid modifying unrelated REPL command behavior or converter pipeline.