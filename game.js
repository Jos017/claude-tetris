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
];

// Power-ups: piezas 1x1 especiales (13–17). El 18 es el bloque comodín que deja el tinte.
const POWER_TYPES = [13, 14, 15, 16, 17];
const WILD = 18;
const POWER_EVERY = 5;       // un power-up cada N líneas
const FREEZE_MS = 5000;
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
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label');

let board, current, next, hold, holdUsed, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, b2b, lastRotate, effects, flashAt, flashPower;
let pendingPower, nextPowerAt, freezeMs;
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

function randomPiece() {
  if (Math.random() < PENTOMINO_CHANCE)
    return makePiece(PENTOMINO_TYPES[Math.floor(Math.random() * PENTOMINO_TYPES.length)]);
  return makePiece(Math.floor(Math.random() * BASE_TYPES) + 1);
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

function tryRotate() {
  const rotated = rotateCW(current.shape);
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
    if (lines >= nextPowerAt) { pendingPower = true; nextPowerAt = lines - (lines % POWER_EVERY) + POWER_EVERY; }
    level = Math.floor(lines / 10) + 1;
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
  const tspin = isTSpin();
  if (POWER_TYPES.includes(current.type)) applyPower(current);
  else merge();
  clearLines(tspin);
  holdUsed = false;
  spawn();
}

function spawn() {
  lastRotate = false;
  current = next;
  if (pendingPower) {
    next = makePiece(POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)]);
    pendingPower = false;
  } else {
    next = randomPiece();
  }
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
  drawHold();
}

// Reserva la pieza actual; si ya hay una guardada se intercambian. Una vez por pieza.
function holdPiece() {
  if (holdUsed) return;
  const type = current.type;
  if (hold) {
    current = makePiece(hold);
  } else {
    current = next;
    next = randomPiece();
    drawNext();
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
  const text = parts.join(' ') || '–';
  if (statusEl.textContent !== text) statusEl.textContent = text;
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
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

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, THEMES[theme].ghost);

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

function drawHold() {
  drawPreview(holdCtx, holdCanvas, hold ? PIECES[hold] : null);
  holdCanvas.classList.toggle('locked', !!holdUsed);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
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
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastRotate = false;
    } else {
      lockPiece();
    }
  }
  draw();
  updateStatus();
  if (gameOver) return; // endGame corre dentro del frame actual: cancelAnimationFrame no lo detiene
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  hold = null;
  holdUsed = false;
  combo = 0;
  b2b = false;
  lastRotate = false;
  pendingPower = false;
  nextPowerAt = POWER_EVERY;
  freezeMs = 0;
  effects = [];
  flashAt = 0;
  flashPower = 0;
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
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

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('theme') || 'dark'; } catch (e) { /* ignorar */ }
setTheme(savedTheme, false);

init();
