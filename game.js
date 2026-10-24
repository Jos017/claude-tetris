'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - light blue
  '#ffb74d', // L - orange
  '#90a4ae', // N - tuerca (gris acero)
  '#f06292', // + - cruz (rosa)
  '#4db6ac', // U (verde azulado)
  '#a1887f', // Y (marrón)
  '#fff176', // 1x1 - single (amarillo claro)
  '#ff7043', // 13 bomba
  '#fdd835', // 14 rayo
  '#ab47bc', // 15 tinte
  '#8d6e63', // 16 gravedad
  '#4fc3f7', // 17 congelar
  '#eceff1', // 18 comodín (solo en el tablero)
  '#546e7a', // 19 basura (modo desafío)
];

// Power-ups: piezas 1x1 especiales (13–17). El 18 es el bloque comodín que deja el tinte.
const POWER_TYPES = [13, 14, 15, 16, 17];
const WILD = 18;
const GARBAGE = 19;
const POWER_EVERY = 5;       // un power-up cada N líneas
const FREEZE_MS = 5000;
const ENERGY_MAX = 100;
const ENERGY_PER_LINE = 10;
const PEEK_MS = 15000;
const SLOW_MS = 10000;
const SLOW_FACTOR = 2.5;     // la caída tarda 2.5× más durante "ralentizar"
// Modos desafío (el clásico es mode = null). Opciones: goalLines, timeLimit, surviveMs (ms),
// garbageEvery (ms), prefill (filas), invisible, startLevel, reverseRot
const CHALLENGES = {
  sprint:     { name: 'Sprint', desc: 'Limpia 40 líneas en 2:00', goalLines: 40, timeLimit: 120000 },
  basura:     { name: 'Basura', desc: 'Sobrevive 90 s: sube basura cada 10 s', surviveMs: 90000, garbageEvery: 10000 },
  fijos:      { name: 'Tablero fijo', desc: 'Limpia 15 líneas con bloques pre-colocados', goalLines: 15, prefill: 6 },
  invisibles: { name: 'Invisibles', desc: 'Limpia 10 líneas: las piezas se ocultan al asentarse', goalLines: 10, invisible: true },
  inversa:    { name: 'Rotación inversa', desc: 'Nivel 6 con el giro invertido: 15 líneas', goalLines: 15, startLevel: 6, reverseRot: true },
};
const MODE_KEYS = Object.keys(CHALLENGES);
const ICONS = { 13: '💣', 14: '⚡', 15: '🎨', 16: '⏬', 17: '❄️', 18: '★' };

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (hueco central)
  [[0,9,0],[9,9,9],[0,9,0]],                  // + (pentominó)
  [[10,0,10],[10,10,10],[0,0,0]],             // U (pentominó)
  [[0,0,0,0],[11,11,11,11],[0,11,0,0],[0,0,0,0]], // Y (pentominó)
  [[12]],                                      // 1x1 - recompensa tras un Tetris
  [[13]], [[14]], [[15]], [[16]], [[17]],      // power-ups: bomba, rayo, tinte, gravedad, congelar
];

// Tipos que salen al azar: 1–8 uniformes; los pentominós (9–11) son ocasionales; el 1x1 solo como recompensa
const BASE_TYPES = 8;
const PENTOMINO_TYPES = [9, 10, 11];
const PENTOMINO_CHANCE = 0.1;
const SINGLE = 12;

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [400, 800, 1200, 1600];
const PERFECT_CLEAR_BONUS = 2000;
const MAX_COMBO = 8;       // multiplicador máximo (x8)
const EFFECT_MS = 1400;    // duración de los textos flotantes
const FLASH_MS = 260;      // duración del destello al limpiar

// Colores de canvas dependientes del tema (las piezas conservan su color; el borde les da contraste)
const THEMES = {
  dark:  { grid: '#22222e', edge: null,                  highlight: 'rgba(255,255,255,0.12)', ghost: 0.2 },
  light: { grid: '#e1e3ee', edge: 'rgba(20,20,40,0.55)', highlight: 'rgba(255,255,255,0.35)', ghost: 0.45 },
};
let theme = 'dark';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const statusEl = document.getElementById('status');
const energyEl = document.getElementById('energy');
const energyFill = document.getElementById('energy-fill');
const queueSection = document.getElementById('queue-section');
const queueCanvas = document.getElementById('queue-canvas');
const queueCtx = queueCanvas.getContext('2d');
const abilityOverlay = document.getElementById('ability-overlay');
const modeOverlay = document.getElementById('mode-overlay');
const goalSection = document.getElementById('goal-section');
const goalLabel = document.getElementById('goal-label');
const goalEl = document.getElementById('goal');
const modesBtn = document.getElementById('modes-btn');
const overlayModesBtn = document.getElementById('overlay-modes-btn');
const pauseOverlay = document.getElementById('pause-overlay');
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const startLevelVal = document.getElementById('start-level-val');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label');

let board, current, next, hold, holdUsed, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, b2b, lastRotate, effects, flashAt, flashPower;
let pendingPower, nextPowerAt, freezeMs;
let queue, energy, peekMs, slowMs, undoSnap, menuOpen, activeMenu;
let mode = null, baseLevel, elapsed, garbageAccum, lockedAt;
let startLevelPref = 1, freshKey = false; // nivel inicial elegido (1–10); freshKey = ignorar teclas repetidas tras reanudar
const MAX_START_LEVEL = 10;
let audioCtx = null, muted = false;

// ---- Sonido (Web Audio sintetizado, sin archivos) ----
function beep(freq, dur = 0.1, type = 'square', vol = 0.05, delay = 0) {
  if (muted) return;
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch (e) { /* audio no disponible */ }
}

function playNotes(freqs, step = 0.07, type = 'square') {
  freqs.forEach((f, i) => beep(f, 0.12, type, 0.05, i * step));
}

// ---- Efectos visuales: textos flotantes + destello ----
function announce(text, color) {
  effects.push({ text, color, t: performance.now() });
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomType() {
  if (Math.random() < PENTOMINO_CHANCE)
    return PENTOMINO_TYPES[Math.floor(Math.random() * PENTOMINO_TYPES.length)];
  return Math.floor(Math.random() * BASE_TYPES) + 1;
}

function randomPiece() {
  return makePiece(randomType());
}

// Cola de piezas futuras (permite la habilidad "ver las próximas 5")
function fillQueue() {
  while (queue.length < 5) queue.push(randomType());
}

// Avanza `next`: primero un power-up pendiente; si no, la cabeza de la cola
function advanceNext() {
  if (pendingPower) {
    next = makePiece(POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)]);
    pendingPower = false;
  } else {
    next = makePiece(queue.shift());
    fillQueue();
  }
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function rotateCCW(shape) {
  return rotateCW(rotateCW(rotateCW(shape)));
}

function tryRotate() {
  const rotated = mode && mode.reverseRot ? rotateCCW(current.shape) : rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastRotate = true;
      beep(520, 0.04, 'triangle', 0.03);
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

// T-spin (regla de las 3 esquinas): la T rotó en su último movimiento y ≥3 esquinas del centro están ocupadas
function isTSpin() {
  if (current.type !== 3 || !lastRotate) return false;
  const cx = current.x + 1, cy = current.y + 1;
  let filled = 0;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])) filled++;
  }
  return filled >= 3;
}

// ---- Power-ups: se activan al aterrizar la pieza 1x1 y no dejan bloque ----
function applyPower(piece) {
  const px = piece.x, py = piece.y;
  switch (piece.type) {
    case 13: { // bomba: borra un área 3×3
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const y = py + dy, x = px + dx;
          if (y >= 0 && y < ROWS && x >= 0 && x < COLS && board[y][x]) { board[y][x] = 0; n++; }
        }
      score += n * 10 * level;
      announce('BOMBA', '#ff7043');
      beep(90, 0.3, 'sawtooth', 0.08);
      beep(60, 0.4, 'square', 0.08, 0.05);
      break;
    }
    case 14: { // rayo: limpia la columna y la fila de la superficie donde cae
      const row = Math.min(py + 1, ROWS - 1);
      for (let c = 0; c < COLS; c++) board[row][c] = 0;
      for (let r = 0; r < ROWS; r++) board[r][px] = 0;
      score += 100 * level;
      announce('RAYO', '#fdd835');
      playNotes([1200, 800, 1600, 600], 0.04, 'sawtooth');
      break;
    }
    case 15: { // tinte: el color más abundante pasa a comodín (se borra con la siguiente limpieza de líneas)
      const counts = {};
      for (const row of board) for (const v of row) if (v && v !== WILD) counts[v] = (counts[v] || 0) + 1;
      const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      if (top) {
        for (const row of board) for (let c = 0; c < COLS; c++) if (row[c] === +top) row[c] = WILD;
      }
      announce('TINTE', '#ab47bc');
      playNotes([440, 554, 659], 0.06, 'triangle');
      break;
    }
    case 16: { // gravedad: compacta cada columna hacia abajo
      for (let c = 0; c < COLS; c++) {
        const col = [];
        for (let r = 0; r < ROWS; r++) if (board[r][c]) col.push(board[r][c]);
        for (let r = ROWS - 1; r >= 0; r--) board[r][c] = col.length ? col.pop() : 0;
      }
      announce('GRAVEDAD', '#8d6e63');
      playNotes([300, 220, 160], 0.07, 'triangle');
      break;
    }
    case 17: // congelar: detiene la caída automática
      freezeMs = FREEZE_MS;
      announce('CONGELAR', '#4fc3f7');
      playNotes([1400, 1100, 900], 0.06, 'sine');
      break;
  }
}

function clearLines(tspin = false) {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    if (cleared === 4) { next = makePiece(SINGLE); drawNext(); } // recompensa tras un Tetris
    combo++;
    const mult = Math.min(combo, MAX_COMBO);
    const hard = cleared === 4 || tspin; // jugadas "difíciles" que encadenan B2B
    let pts = tspin ? (TSPIN_SCORES[cleared] ?? LINE_SCORES[cleared]) : (LINE_SCORES[cleared] || 0);
    const label = tspin ? `T-SPIN ${['', 'SINGLE', 'DOUBLE', 'TRIPLE'][cleared] || ''}`.trim() : (cleared === 4 ? 'TETRIS' : '');
    if (label) announce(label, '#ba68c8');
    if (hard && b2b) {
      pts = Math.floor(pts * 1.5);
      announce('BACK-TO-BACK', '#ffd54f');
    }
    b2b = hard;
    score += pts * level * mult;
    if (combo > 1) announce(`COMBO x${mult}`, '#4dd0e1');
    let wilds = 0; // los comodines del tinte desaparecen con cualquier limpieza
    for (const row of board) for (let c = 0; c < COLS; c++) if (row[c] === WILD) { row[c] = 0; wilds++; }
    if (wilds) { score += wilds * 20 * level; announce(`COMODINES +${wilds * 20 * level}`, '#eceff1'); }
    if (board.every(row => row.every(v => v === 0))) {
      score += PERFECT_CLEAR_BONUS * level;
      announce('PERFECT CLEAR', '#81c784');
      playNotes([523, 659, 784, 1047, 1319], 0.09, 'triangle');
    } else if (hard) {
      playNotes(tspin ? [392, 587, 784] : [523, 659, 784, 1047], 0.07);
    } else {
      beep(330 * Math.pow(2, Math.min(combo - 1, 12) / 12 * 2), 0.14);
    }
    flashAt = performance.now();
    flashPower = Math.min(0.15 + cleared * 0.1, 0.5);
    lines += cleared;
    energy = Math.min(ENERGY_MAX, energy + cleared * ENERGY_PER_LINE);
    if (lines >= nextPowerAt) { pendingPower = true; nextPowerAt = lines - (lines % POWER_EVERY) + POWER_EVERY; }
    level = baseLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  } else {
    combo = 0;
    if (tspin) { // T-spin sin líneas: bonus, no rompe B2B
      score += TSPIN_SCORES[0] * level;
      announce('T-SPIN', '#ba68c8');
      playNotes([392, 587], 0.07);
    } else {
      beep(160, 0.05, 'square', 0.03);
    }
  }
  updateHUD();
  checkChallenge();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  if (gy > current.y) lastRotate = false;
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastRotate = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  undoSnap = {
    board: board.map(row => [...row]), type: current.type,
    score, lines, level, combo, b2b, dropInterval, nextPowerAt, pendingPower,
  };
  const tspin = isTSpin();
  if (POWER_TYPES.includes(current.type)) applyPower(current);
  else merge();
  lockedAt = performance.now();
  clearLines(tspin);
  if (gameOver) return; // desafío completado en esta limpieza
  holdUsed = false;
  spawn();
}

function spawn() {
  lastRotate = false;
  current = next;
  advanceNext();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
  drawHold();
  drawQueue();
}

// Reserva la pieza actual; si ya hay una guardada se intercambian. Una vez por pieza.
function holdPiece() {
  if (holdUsed) return;
  const type = current.type;
  if (hold) {
    current = makePiece(hold);
  } else {
    current = next;
    advanceNext();
    drawNext();
    drawQueue();
  }
  hold = type;
  holdUsed = true;
  lastRotate = false;
  dropAccum = 0;
  beep(300, 0.06, 'triangle', 0.04);
  drawHold();
  if (collide(current.shape, current.x, current.y)) endGame();
}

// Efectos temporales activos (se actualiza cada frame; solo toca el DOM si cambia el texto)
function updateStatus() {
  const parts = [];
  if (freezeMs > 0) parts.push(`❄ ${Math.ceil(freezeMs / 1000)}s`);
  if (slowMs > 0) parts.push(`🐢 ${Math.ceil(slowMs / 1000)}s`);
  if (peekMs > 0) parts.push(`👁 ${Math.ceil(peekMs / 1000)}s`);
  const text = parts.join(' ') || '–';
  if (statusEl.textContent !== text) statusEl.textContent = text;
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  energyFill.style.width = `${energy}%`;
  energyEl.classList.toggle('full', energy >= ENERGY_MAX);
  comboEl.textContent = (combo > 0 ? `x${Math.min(combo, MAX_COMBO)}` : '–') + (b2b ? ' B2B' : '');
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = THEMES[theme].highlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (THEMES[theme].edge) {
    context.strokeStyle = THEMES[theme].edge;
    context.lineWidth = 1;
    context.strokeRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);
  }
  if (ICONS[colorIndex]) { // power-ups y comodín llevan un símbolo
    context.fillStyle = '#222';
    context.font = `${Math.floor(size * 0.6)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(ICONS[colorIndex], x * size + size / 2, y * size + size / 2 + 1);
    context.textAlign = 'start';
    context.textBaseline = 'alphabetic';
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = THEMES[theme].grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board (modo Invisibles: visible 0.8 s tras asentar una pieza y luego se desvanece)
  const hidden = !!(mode && mode.invisible);
  let boardAlpha = 1;
  if (hidden) {
    const age = performance.now() - lockedAt;
    boardAlpha = age < 800 ? 1 : Math.max(0, 1 - (age - 800) / 700);
  }
  if (boardAlpha > 0)
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        drawBlock(ctx, c, r, board[r][c], BLOCK, boardAlpha);

  // ghost (oculto en Invisibles: delataría la altura de la pila)
  if (!hidden) {
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, THEMES[theme].ghost);
  }

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  if (freezeMs > 0) { // tinte azul mientras dura el congelar
    ctx.fillStyle = 'rgba(79,195,247,0.14)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawEffects();
}

// Destello blanco + textos flotantes (COMBO, TETRIS, T-SPIN, B2B, PERFECT CLEAR)
function drawEffects() {
  const now = performance.now();
  const flashAge = now - flashAt;
  if (flashAge < FLASH_MS) {
    ctx.fillStyle = `rgba(255,255,255,${flashPower * (1 - flashAge / FLASH_MS)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  effects = effects.filter(f => now - f.t < EFFECT_MS);
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px "Courier New", monospace';
  effects.forEach((f, i) => {
    const age = (now - f.t) / EFFECT_MS;
    ctx.globalAlpha = 1 - age * age;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    const y = canvas.height / 3 + i * 30 - age * 40;
    ctx.strokeText(f.text, canvas.width / 2, y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, canvas.width / 2, y);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'start';
}

// Dibuja una pieza centrada en un canvas de vista previa (4×4 celdas)
function drawPreview(context, cv, shape) {
  const NB = 30;
  context.clearRect(0, 0, cv.width, cv.height);
  if (!shape) return;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], NB);
}

function drawNext() {
  drawPreview(nextCtx, nextCanvas, next.shape);
}

function drawQueue() {
  queueCtx.clearRect(0, 0, queueCanvas.width, queueCanvas.height);
  if (peekMs <= 0) return;
  queue.slice(0, 5).forEach((type, i) => {
    const shape = PIECES[type];
    const offX = i * 4 + Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(queueCtx, offX + c, offY + r, shape[r][c], 7);
  });
}

function drawHold() {
  drawPreview(holdCtx, holdCanvas, hold ? PIECES[hold] : null);
  holdCanvas.classList.toggle('locked', !!holdUsed);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayTitle.classList.remove('win');
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

// ---- Modo desafío ----
function fmtTime(ms) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function updateGoal() {
  if (!mode) return;
  const text = mode.surviveMs
    ? `Faltan ${fmtTime(mode.surviveMs - elapsed)}`
    : `${lines}/${mode.goalLines}` + (mode.timeLimit ? ` · ${fmtTime(mode.timeLimit - elapsed)}` : '');
  if (goalEl.textContent !== text) goalEl.textContent = text;
}

function checkChallenge() {
  if (!mode || gameOver) return;
  if (mode.goalLines && lines >= mode.goalLines) finishChallenge(true);
  else if (mode.surviveMs && elapsed >= mode.surviveMs) finishChallenge(true);
  else if (mode.timeLimit && elapsed >= mode.timeLimit) finishChallenge(false);
}

function finishChallenge(win) {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = win ? '¡DESAFÍO COMPLETADO!' : 'TIEMPO AGOTADO';
  overlayTitle.classList.toggle('win', win);
  overlayScore.textContent = `${mode.name} · ${fmtTime(elapsed)} · Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  if (win) playNotes([523, 659, 784, 1047, 1319], 0.09, 'triangle');
}

// Modo Basura: sube una fila con un hueco; si no hay espacio arriba, game over
function addGarbageRow() {
  undoSnap = null;
  beep(110, 0.15, 'sawtooth', 0.06);
  if (board[0].some(Boolean)) { endGame(); return; }
  board.shift();
  const hole = Math.floor(Math.random() * COLS);
  board.push(Array.from({ length: COLS }, (_, c) => (c === hole ? 0 : GARBAGE)));
  while (current.y > 0 && collide(current.shape, current.x, current.y)) current.y--; // empuja la pieza activa
  if (collide(current.shape, current.x, current.y)) endGame();
}

// ---- Habilidades (se cargan con la barra de energía; E abre el menú) ----
const ABILITIES = {
  1() { // ver las próximas 5 piezas
    peekMs = PEEK_MS;
    queueSection.classList.remove('hidden');
    drawQueue();
    return true;
  },
  2() { // intercambiar la pieza actual por otra del pool básico
    let type;
    do { type = Math.floor(Math.random() * BASE_TYPES) + 1; } while (type === current.type);
    const swapped = makePiece(type);
    if (collide(swapped.shape, swapped.x, swapped.y)) return false;
    current = swapped;
    lastRotate = false;
    dropAccum = 0;
    return true;
  },
  3() { // ralentizar el tiempo
    slowMs = SLOW_MS;
    return true;
  },
  4() { // deshacer la última colocación
    if (!undoSnap) return false;
    const s = undoSnap;
    board = s.board;
    ({ score, lines, level, combo, b2b, dropInterval, nextPowerAt, pendingPower } = s);
    queue.unshift(next.type);
    queue.pop();
    next = makePiece(current.type);
    current = makePiece(s.type);
    undoSnap = null;
    lastRotate = false;
    holdUsed = false;
    dropAccum = 0;
    drawNext();
    drawHold();
    drawQueue();
    return true;
  },
};

// Menús modales (habilidades, modos): pausan la partida mientras están abiertos
function openMenu(el) {
  if (menuOpen || (paused && !gameOver)) return;
  menuOpen = true;
  activeMenu = el;
  if (!gameOver) {
    paused = true;
    cancelAnimationFrame(animId);
  }
  el.classList.remove('hidden');
}

function closeMenu() {
  if (!menuOpen) return;
  menuOpen = false;
  activeMenu.classList.add('hidden');
  activeMenu = null;
  showPauseView(false);
  freshKey = true; // las teclas mantenidas no mueven la pieza al volver
  if (gameOver) return;
  paused = false;
  dropAccum = 0;
  lastTime = performance.now();
  loop(lastTime);
}

function openAbilityMenu() {
  if (energy < ENERGY_MAX || gameOver) return;
  openMenu(abilityOverlay);
}

function startMode(key) {
  mode = CHALLENGES[key] || null; // clave vacía = clásico
  init();
}

function useAbility(n) {
  if (!ABILITIES[n] || !ABILITIES[n]()) return; // no disponible: el menú sigue abierto
  energy = 0;
  beep(660, 0.1, 'triangle');
  beep(990, 0.15, 'triangle', 0.05, 0.08);
  updateHUD();
  closeMenu();
  draw();
}

function togglePause() {
  if (gameOver || menuOpen) return;
  openMenu(pauseOverlay);
  pauseButtons()[0].focus();
}

// Menú de pausa: vista principal o lista de controles
function pauseButtons() {
  return [...(pauseControls.classList.contains('hidden') ? pauseMain : pauseControls).querySelectorAll('.menu-btn')];
}

function showPauseView(controls) {
  pauseMain.classList.toggle('hidden', controls);
  pauseControls.classList.toggle('hidden', !controls);
  if (menuOpen && activeMenu === pauseOverlay) pauseButtons()[0].focus();
}

function setStartLevel(n) {
  startLevelPref = ((n - 1 + MAX_START_LEVEL) % MAX_START_LEVEL) + 1;
  startLevelVal.textContent = startLevelPref;
  try { localStorage.setItem('startLevel', startLevelPref); } catch (e) { /* almacenamiento no disponible */ }
}

function pauseAction(name) {
  if (name === 'controls') showPauseView(true);
  else if (name === 'back') showPauseView(false);
  else if (name === 'level') setStartLevel(startLevelPref + 1);
  else {
    if (document.activeElement) document.activeElement.blur(); // Space (caída) no debe reactivar el botón
    if (name === 'resume') closeMenu(); else init();
  }
}

function pauseKey(e) {
  if (e.repeat) return; // teclas mantenidas no actúan sobre el menú
  if (e.code === 'KeyM') { muted = !muted; return; }
  const inControls = !pauseControls.classList.contains('hidden');
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (inControls) showPauseView(false); else closeMenu();
    return;
  }
  const btns = pauseButtons();
  const i = btns.indexOf(document.activeElement);
  if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
    e.preventDefault();
    const d = e.code === 'ArrowDown' ? 1 : -1;
    btns[(i + d + btns.length) % btns.length].focus();
  } else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && i >= 0 && btns[i].dataset.pause === 'level') {
    e.preventDefault();
    setStartLevel(startLevelPref + (e.code === 'ArrowRight' ? 1 : -1));
  } else if (!inControls && /^(Digit|Numpad)[1-4]$/.test(e.code)) {
    pauseAction(['resume', 'restart', 'controls', 'level'][+e.code.slice(-1) - 1]);
  } else if (e.code === 'Space') {
    e.preventDefault(); // Enter activa el botón enfocado; Space no
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (freezeMs > 0) { // congelar: la caída automática se detiene (las teclas siguen funcionando)
    freezeMs = Math.max(0, freezeMs - dt);
    dropAccum = 0;
  }
  if (slowMs > 0) slowMs = Math.max(0, slowMs - dt);
  if (peekMs > 0) {
    peekMs = Math.max(0, peekMs - dt);
    if (peekMs === 0) { queueSection.classList.add('hidden'); drawQueue(); }
  }
  elapsed += dt;
  if (mode && mode.garbageEvery) {
    garbageAccum += dt;
    if (garbageAccum >= mode.garbageEvery) { garbageAccum = 0; addGarbageRow(); }
  }
  if (!gameOver && dropAccum >= (slowMs > 0 ? dropInterval * SLOW_FACTOR : dropInterval)) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastRotate = false;
    } else {
      lockPiece();
    }
  }
  checkChallenge();
  draw();
  updateStatus();
  updateGoal();
  if (gameOver) return; // endGame corre dentro del frame actual: cancelAnimationFrame no lo detiene
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  baseLevel = mode && mode.startLevel ? mode.startLevel : startLevelPref;
  elapsed = 0;
  garbageAccum = 0;
  lockedAt = performance.now();
  if (mode && mode.prefill) { // bloques fijos: cada fila con un hueco al azar
    for (let r = ROWS - mode.prefill; r < ROWS; r++) {
      const hole = Math.floor(Math.random() * COLS);
      for (let c = 0; c < COLS; c++) if (c !== hole && Math.random() < 0.75) board[r][c] = GARBAGE;
    }
  }
  hold = null;
  holdUsed = false;
  combo = 0;
  b2b = false;
  lastRotate = false;
  pendingPower = false;
  nextPowerAt = POWER_EVERY;
  freezeMs = 0;
  slowMs = 0;
  peekMs = 0;
  energy = 0;
  undoSnap = null;
  menuOpen = false;
  queue = [];
  fillQueue();
  queueSection.classList.add('hidden');
  abilityOverlay.classList.add('hidden');
  modeOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  showPauseView(false);
  freshKey = true;
  overlayTitle.classList.remove('win');
  activeMenu = null;
  effects = [];
  goalSection.classList.toggle('hidden', !mode);
  if (mode) { goalLabel.textContent = mode.name.toUpperCase(); announce(mode.name, '#7aa2f7'); }
  flashAt = 0;
  flashPower = 0;
  score = 0;
  lines = 0;
  level = baseLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = makePiece(queue.shift());
  fillQueue();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.repeat && freshKey) return; // tecla mantenida desde antes de reanudar
  if (!e.repeat) freshKey = false;
  if (menuOpen && activeMenu === pauseOverlay) { pauseKey(e); return; }
  if (menuOpen) {
    if (e.code === 'Escape' || (e.code === 'KeyE' && activeMenu === abilityOverlay)) closeMenu();
    else if (activeMenu === abilityOverlay && /^(Digit|Numpad)[1-4]$/.test(e.code)) useAbility(+e.code.slice(-1));
    else if (activeMenu === modeOverlay && /^(Digit|Numpad)[0-5]$/.test(e.code)) startMode(MODE_KEYS[+e.code.slice(-1) - 1]);
    return;
  }
  if (e.code === 'KeyE') { openAbilityMenu(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (e.code === 'KeyM') { muted = !muted; return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastRotate = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastRotate = false; }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
  }
  updateHUD();
});

function setTheme(name, save = true) {
  theme = name === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  const isLight = theme === 'light';
  themeToggle.setAttribute('aria-checked', isLight);
  themeLabel.textContent = isLight ? 'Modo oscuro' : 'Modo claro';
  themeToggle.setAttribute('aria-label', themeLabel.textContent);
  if (save) {
    try { localStorage.setItem('theme', theme); } catch (e) { /* almacenamiento no disponible */ }
  }
  // En pausa/game over el loop no corre: repintar manualmente
  if (current && next) { draw(); drawNext(); drawHold(); }
}

themeToggle.addEventListener('click', () => {
  setTheme(theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // evitar que Space (hard drop) active el botón
});

restartBtn.addEventListener('click', init);
document.querySelectorAll('[data-pause]').forEach(btn =>
  btn.addEventListener('click', () => pauseAction(btn.dataset.pause)));
document.querySelectorAll('[data-ability]').forEach(btn =>
  btn.addEventListener('click', () => useAbility(+btn.dataset.ability)));
document.querySelectorAll('[data-mode]').forEach(btn =>
  btn.addEventListener('click', () => startMode(btn.dataset.mode)));
modesBtn.addEventListener('click', () => { modesBtn.blur(); openMenu(modeOverlay); });
overlayModesBtn.addEventListener('click', () => openMenu(modeOverlay));

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('theme') || 'dark'; } catch (e) { /* ignorar */ }
setTheme(savedTheme, false);
try { setStartLevel(parseInt(localStorage.getItem('startLevel'), 10) || 1); } catch (e) { /* ignorar */ }

init();
