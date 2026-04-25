# Visual baselines

This folder holds the checked-in PNG baselines for the visual-regression
harness in [../verify-visual.js](../verify-visual.js). Each baseline is the
first-page raster of the `scripts/fixtures/visual.md` sample rendered with
one of the bundled DESIGN.md files.

Update the baselines whenever an intentional visual change lands:

```bash
npm run verify:visual -- --update-baselines
```

Without `--update-baselines`, the harness compares the fresh render against
the checked-in baseline (by byte size, within a 15% tolerance) and fails on
meaningful drift.
