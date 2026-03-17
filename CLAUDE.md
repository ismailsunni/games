# CLAUDE.md — Games Project

A browser-based multi-game collection built with React 19, Vite, and Tailwind CSS. Deployed to GitHub Pages.

## Stack

- **React 19** + **Vite 7** (no TypeScript — plain JSX)
- **Tailwind CSS v3** (custom theme: `bg-paper`, `bg-canvas`, `text-ink`, `text-accent`, `font-display`, `font-body`)
- **gh-pages** for deployment (`npm run deploy`)
- **No router library** — hash-based routing via custom `useRoute` hook

## Project Structure

```
src/
  App.jsx              # Route switcher (hash → component)
  main.jsx             # React entry point
  index.css            # Tailwind base styles
  App.css
  hooks/
    useRoute.js        # Custom hash router: useRoute() → { route, navigate }
  pages/
    GameList.jsx        # Home/hub — lists all games
    TicTacToe.jsx       # Configurable board (2×2–10×10), 3 AI difficulties
    TicTacToe3D.jsx     # 3-layer 3D board, 49 winning lines
    GinRummy.jsx        # Card game: draw/discard, sets+runs, knock ≤10
  utils/
    tictactoeAI.js      # AI logic: easyMove, mediumMove, hardMove
  assets/
    react.svg
```

## Routing

Hash-based — no React Router. Navigation uses `window.location.hash`.

```js
const { route, navigate } = useRoute()
navigate('#/tictactoe')   // go to a game
// route === '/tictactoe' (hash stripped of '#')
```

Routes: `/` (GameList), `/tictactoe`, `/tictactoe3d`, `/ginrummy`

## Adding a New Game

1. Create `src/pages/MyGame.jsx`
2. Add it to `App.jsx`:
   ```jsx
   if (route === '/mygame') return <MyGame />
   ```
3. Add an entry to the `games` array in `GameList.jsx`:
   ```js
   { id: 'mygame', name: 'My Game', description: '...', emoji: '🎲', hash: '#/mygame' }
   ```

## AI (Tic-Tac-Toe)

`src/utils/tictactoeAI.js` exports three difficulty levels:

| Export | Strategy |
|---|---|
| `easyMove(squares, boardSize)` | Random valid move |
| `mediumMove(squares, boardSize, winLength)` | Threat-aware heuristic (win → block → fork → build) |
| `hardMove(squares, boardSize, winLength)` | Minimax (3×3 full; larger boards use alpha-beta + depth limit) |

AI always plays as `'O'`, human as `'X'`.

## Styling Conventions

Uses a custom Tailwind theme. Prefer existing tokens over raw colors:
- `bg-paper` / `bg-canvas` / `bg-white` for backgrounds
- `text-ink` / `text-ink/60` / `text-ink/40` for text
- `text-accent` / `border-accent` / `hover:border-accent` for highlights
- `font-display` for headings, `font-body` for body text

## Dev Commands

```bash
npm run dev       # Start dev server (Vite HMR)
npm run build     # Production build → dist/
npm run preview   # Preview built output locally
npm run lint      # ESLint
npm run deploy    # Build + push to gh-pages
```

## Notes

- No TypeScript — keep it plain JSX unless migrating intentionally
- No test suite currently
- Board state is flat arrays (`squares[i]`, index = `row * boardSize + col`)
