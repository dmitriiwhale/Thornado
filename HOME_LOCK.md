# Home Lock (Anchor)

Home page is locked behind an anchor snapshot.

## Commands

- `npm run home:anchor`  
  Creates or refreshes the Home anchor from current files.
- `npm run home:check`  
  Verifies Home files are unchanged compared to the anchor.
- `npm run home:restore`  
  Restores Home files back to the anchored snapshot.

## Locked files

- `client/src/pages/Landing.jsx`
- `client/src/components/LiveBtcChart.jsx`
- `client/src/components/ScrollReveal.jsx`
- `client/src/components/SplitTextScroll.jsx`
- `client/src/styles.css`

## Workflow rule for Terminal edits

1. Run `npm run home:check` before starting Terminal work.
2. Edit only Terminal-related files.
3. Run `npm run home:check` again before finishing.
4. If drift is detected, run `npm run home:restore`.
