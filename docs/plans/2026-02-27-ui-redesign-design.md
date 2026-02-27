# Hangman UI Redesign — Design Document
_2026-02-27_

## Overview

Restyle the existing React frontend from scattered inline styles / Vite boilerplate into a cohesive warm-and-earthy visual design. No new libraries. No changes to game logic, backend, or TypeScript types.

---

## Design Decisions

| Decision | Choice |
|---|---|
| Colour palette | Warm & earthy (parchment background, saddle-brown accent) |
| Font | Lora (Google Fonts serif) for headings and UI; Courier New monospace for letter tiles |
| SVG style | Sketchy / hand-drawn (`strokeLinecap: round`, `strokeLinejoin: round`) |
| Keyboard layout | QWERTY rows |
| Styling approach | CSS custom properties in `index.css` + class names per component |

---

## Colour Palette

```css
:root {
  --bg:           #fdf6e3;   /* parchment page background */
  --surface:      #fffbf0;   /* card / panel background */
  --accent:       #8b4513;   /* saddle brown — buttons, headings */
  --accent-hover: #6b3410;   /* darker on hover */
  --text:         #2c1810;   /* primary text */
  --text-muted:   #7a5c4a;   /* secondary / hint text */
  --correct:      #4a7c59;   /* muted green — correct guesses */
  --wrong:        #8b2e2e;   /* muted red — wrong guesses */
  --border:       #d4b896;   /* warm tan border */
}
```

---

## Typography

- Import Lora (weights 400, 600) from Google Fonts via `@import` in `index.css`
- Body font: Lora, Georgia, serif
- Letter tiles: `Courier New`, Courier, monospace (fixed-width for even spacing)
- Base font size: 16px

---

## Global Styles (`index.css`)

- Full rewrite — strip all Vite boilerplate
- `body`: `background: var(--bg)`, `color: var(--text)`, `font-family` set to Lora serif
- `button` reset: remove default browser styles, cursor pointer
- `h1`, `h2`: Lora serif, `color: var(--accent)`

`App.css` is cleared of all unused Vite boilerplate (logo animations, `.card`, `.read-the-docs`).

---

## Component Designs

### App

- Centred column, `max-width: 640px`, `margin: 0 auto`, `padding: 2rem`
- Score displayed as a small pill badge in the upper-right: `2 wins / 1 loss`
- Error message in `var(--wrong)` colour

### GameSetup

- Large `h1` "Hangman" in Lora, `color: var(--accent)`
- Subtitle in `var(--text-muted)`
- Three pill buttons side by side (Easy / Medium / Hard)
  - Background: `var(--accent)`, text: white
  - Hover: `var(--accent-hover)`, slight upward translate (`translateY(-2px)`)
  - `border-radius: 999px`, `padding: 0.6rem 1.8rem`

### HangmanSvg

- Stroke colour: `#5c3d2e` (dark aged-ink brown)
- Gallows strokes: `strokeWidth={5}`, `strokeLinecap="round"`, `strokeLinejoin="round"`
- Body part strokes: `strokeWidth={4}`, same linecap/join
- Displayed inside a bordered card (`border: 1px solid var(--border)`, `border-radius: 12px`, `background: var(--surface)`, padding)

### WordDisplay

- Each letter in a square tile: `min-width: 2rem`, `height: 2.5rem`
- Border bottom only: `border-bottom: 3px solid var(--accent)`
- Font: `Courier New` monospace, `font-size: 1.8rem`, `font-weight: bold`
- `color: var(--accent)` for revealed letters, `var(--border)` for underscores
- Flex row with `gap: 0.5rem`

### Keyboard (QWERTY layout)

QWERTY rows:
```
Row 1: Q W E R T Y U I O P
Row 2: A S D F G H J K L
Row 3: Z X C V B N M
```

- Each key: `width: 2.2rem`, `height: 2.4rem`, `border-radius: 6px`
- Unguessed: `background: var(--surface)`, `border: 1px solid var(--border)`, subtle `box-shadow: 0 2px 0 var(--border)` (physical key feel)
- Correct: `background: var(--correct)`, white text, no shadow
- Wrong: `background: var(--wrong)`, white text, no shadow
- Disabled: `opacity: 0.5`, `cursor: default`
- Rows centred, `gap: 0.3rem` between keys, `gap: 0.5rem` between rows

### GameResult

- Win: `h2` in `var(--correct)` — "You Won! 🎉"
- Lose: `h2` in `var(--wrong)` — "Game Over"
- "The word was: **WORD**" in large bold serif
- Play Again button: same pill style as difficulty buttons

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/index.css` | Full rewrite — theme tokens, Lora import, global resets |
| `frontend/src/App.css` | Clear all Vite boilerplate |
| `frontend/src/App.tsx` | Add CSS class names, score pill layout |
| `frontend/src/components/GameSetup.tsx` | Add class names, pill buttons |
| `frontend/src/components/HangmanSvg.tsx` | Round strokes, brown colour, card wrapper |
| `frontend/src/components/WordDisplay.tsx` | Tile styling, monospace font, accent colour |
| `frontend/src/components/Keyboard.tsx` | QWERTY layout, key styling |
| `frontend/src/components/GameResult.tsx` | Coloured headings, pill Play Again button |
| `frontend/src/components/GameBoard.tsx` | Layout spacing, muted error text |

No backend changes. No new dependencies. No changes to TypeScript types or test files.
