# Traffic Jam

A browser-based single-player sliding block puzzle built with Svelte, TypeScript, Tailwind CSS, and Vite.

## Game rules

- The board is always `6x6`.
- Each vehicle is `2x1` or `3x1`.
- Vehicles are either horizontal or vertical.
- Vehicles may only move in their long direction.
- The target vehicle is a horizontal length-2 car on row 3.
- A level is solved when the target car reaches the right edge and exits.

## Project structure

- `src/lib/puzzle/game.ts`: movement rules, collision logic, win detection, validation.
- `src/lib/puzzle/solver.ts`: BFS solver used to verify that levels are solvable and compute optimal move counts.
- `src/lib/puzzle/levels.ts`: YAML loader and level normalization.
- `src/lib/components/Board.svelte`: touch-friendly play surface.
- `levels/`: YAML-authored level files.

## Level format

Each YAML file in `levels/` has this shape:

```yaml
title: Starter
difficulty: Beginner
vehicles:
  - color: red
    x: 0
    y: 2
    length: 2
    orientation: horizontal
  - color: blue
    x: 2
    y: 0
    length: 3
    orientation: vertical
```

Coordinate origin is the top-left cell. `x` increases to the right and `y` increases downward. The first vehicle is always the target car.

Named colors are supported in addition to raw CSS colors like `#2563eb`. Built-in names include `red`, `light green`, `dark green`, `light orange`, `light blue`, `pink`, `lavender`, `forest green`, `forrest green`, `silver`, `blue`, `yellow`, `purple`, `green`, `dark yellow`, `dark orange`, `dark blue`, `cyan`, and `orange`. Spaces, hyphens, and underscores are treated the same.

Recommended difficulty labels are `Beginner`, `Intermediate`, `Advanced`, and `Expert`. The level viewer colors them as pastel green, pastel orange, pastel blue, and pastel red respectively.

## Commands

- `npm install`
- `npm run dev`
- `npm run check`
- `npm run build`

## Deployment

Pushes to `main` automatically deploy the built site to GitHub Pages through `.github/workflows/deploy-pages.yml`. The Vite `base` path is derived from `GITHUB_REPOSITORY` during GitHub Actions builds, so the app is served correctly from the repository subpath.
