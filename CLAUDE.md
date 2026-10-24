# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no build, no tests, no linter, no package.json. README is in Spanish; UI strings (e.g. "PAUSA", "Reiniciar") are Spanish/mixed — keep that.

## Running

Open `index.html` directly, or serve statically: `python -m http.server 8000` then `http://localhost:8000`.

## Architecture

Three files: `index.html` (DOM + two canvases), `style.css`, `game.js` (all logic, single script, `'use strict'`, global state).

- Global mutable state declared in one `let` line (`board`, `current`, `next`, `score`, ... `animId`); `init()` resets it and doubles as restart handler.
- Board: `ROWS×COLS` matrix, `0` = empty, `1–18` = index into both `COLORS` and `PIECES` (same index scheme).
- Flow: `loop` (rAF, accumulates `dropAccum` vs `dropInterval`) → `lockPiece` → `merge` → `clearLines` (updates score/level/`dropInterval`) → `spawn` (calls `endGame` if new piece collides).
- Pause/game over work by `cancelAnimationFrame(animId)`; unpause restarts `loop` manually. Overlay shared for both states.
- Scoring lives in `clearLines(tspin)`: combo multiplier (`combo`, cap `MAX_COMBO`), B2B (`b2b`), T-spin via `isTSpin()` (needs `lastRotate`, reset on any move/drop/spawn/hold), perfect clear. Feedback = `announce()` floating texts + `flashAt` flash (drawn in `drawEffects`) + `beep()`/`playNotes()` Web Audio (`muted` toggled with `M`).
- Power-ups: 1×1 pieces `13–17` (`POWER_TYPES`) queued via `pendingPower` (every `POWER_EVERY` lines) in `spawn`; `lockPiece` calls `applyPower` instead of `merge`. `18` = `WILD` board-only cell (from "tinte"), wiped by the next line clear. `ICONS` map draws the symbol in `drawBlock`. Freeze = `freezeMs` countdown in `loop`; `updateStatus` renders active timers.
- Rotation: `rotateCW` + horizontal kick list `[0,-1,1,-2,2]` in `tryRotate` (no SRS, no floor kicks).
- Input: single `keydown` listener using `e.code`; calls `updateHUD()` after every key.

## Gotchas

- Canvas size is hard-coded in `index.html` (`#board` 300×600, `#next-canvas` 120×120); changing `COLS`/`ROWS`/`BLOCK` in `game.js` requires updating it to `COLS*BLOCK × ROWS*BLOCK`.
- Adding a piece = new entry in both `COLORS` and `PIECES` (same index) + decide how it spawns in `randomPiece`: `BASE_TYPES` (1–8, uniform; 8 = 3×3 "tuerca" ring), `PENTOMINO_TYPES` (9–11, `PENTOMINO_CHANCE`), `SINGLE` (12, only as Tetris reward in `clearLines`).
- Level speed formula is duplicated in README; keep in sync: `max(100, 1000 - (level-1)*90)` ms. Initial `1000` is in `init()`.
