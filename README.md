# Sudoku with Olga

A calm, ad-free Sudoku experience with a Japanese-inspired, minimalist visual style.

## Run locally
Open `index.html` in a modern browser. No build step or dependencies are required.

## Publish with GitHub Pages
1. Create a new public repository named `sudoku-with-olga`.
2. Upload `index.html`, `style.css`, `sudoku.js`, and `README.md` to the repository root.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
5. GitHub will provide the published website URL.

## Current version
- A date-seeded Daily Sudoku: everyone receives the same Medium puzzle for the same calendar day.
- Unlimited Practice puzzles with Easy, Medium, and Hard settings.
- Daily puzzle progress is saved locally in the browser, so players can return where they left off without creating an account.
- Randomly generated Sudoku boards with a unique solution.
- Large, high-contrast entered digits; small pencil-mark notes.
- Stronger 3×3 box boundaries.
- Cell, row, column, box, and matching-number highlighting.
- Number pad, keyboard entry, notes, erase, undo, hint, restart, and timer.
- Responsive layout for desktop and mobile.

## Notes
This is an initial playable prototype. Practice difficulty currently uses clue-removal targets rather than formal human-solving difficulty grading. Daily puzzles use a fixed Medium clue-removal target; logic-technique validation can be added later. Google Fonts are loaded from Google Fonts; system fallbacks are provided.
