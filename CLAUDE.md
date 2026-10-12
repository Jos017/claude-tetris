# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no build, no tests, no linter, no package.json. README is in Spanish; UI strings (e.g. "PAUSA", "Reiniciar") are Spanish/mixed — keep that.

## Running

Open `index.html` directly, or serve statically: `python -m http.server 8000` then `http://localhost:8000`.

## Architecture

Three files: `index.html` (DOM + two canvases), `style.css`, `game.js` (all logic, single script, `'use strict'`, global state).

- Global mutable state declared in one `let` line (`board`, `current`, `next`, `score`, ... `animId`); `init()` resets it and doubles as restart handler.
- Board: `ROWS×COLS` matrix, `0` = empty, `1–7` = index into both `COLORS` and `PIECES` (same index scheme).
- Flow: `loop` (rAF, accumulates `dropAccum` vs `dropInterval`) → `lockPiece` → `merge` → `clearLines` (updates score/level/`dropInterval`) → `spawn` (calls `endGame` if new piece collides).
- Pause/game over work by `cancelAnimationFrame(animId)`; unpause restarts `loop` manually. Overlay shared for both states.
- Rotation: `rotateCW` + horizontal kick list `[0,-1,1,-2,2]` in `tryRotate` (no SRS, no floor kicks).
- Input: single `keydown` listener using `e.code`; calls `updateHUD()` after every key.

## Gotchas

- Canvas size is hard-coded in `index.html` (`#board` 300×600, `#next-canvas` 120×120); changing `COLS`/`ROWS`/`BLOCK` in `game.js` requires updating it to `COLS*BLOCK × ROWS*BLOCK`.
- Piece-type count `7` is hard-coded in `randomPiece`.
- Level speed formula is duplicated in README; keep in sync: `max(100, 1000 - (level-1)*90)` ms. Initial `1000` is in `init()`.
