/* ==========================================================================
   CYBER TETRIS GAME ENGINE (FULL-FEATURED SRS & AUDIO SYNTHESIZER)
   ========================================================================== */

// Tetromino Definitions & Rotations
const TETROMINOES = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    color: '#00f0ff',
    glow: 'rgba(0, 240, 255, 0.7)'
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#0077ff',
    glow: 'rgba(0, 119, 255, 0.7)'
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#ffaa00',
    glow: 'rgba(255, 170, 0, 0.7)'
  },
  O: {
    shape: [
      [1, 1],
      [1, 1]
    ],
    color: '#ffe600',
    glow: 'rgba(255, 230, 0, 0.7)'
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    color: '#00ffaa',
    glow: 'rgba(0, 255, 170, 0.7)'
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#aa00ff',
    glow: 'rgba(170, 0, 255, 0.7)'
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ],
    color: '#ff0055',
    glow: 'rgba(255, 0, 85, 0.7)'
  }
};

const TETROMINO_KEYS = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

class TetrisSoundFx {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playRotate() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.04);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  }

  playDrop() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  playLineClear() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteTime = now + idx * 0.05;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);
        gain.gain.setValueAtTime(0.2, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(noteTime);
        osc.stop(noteTime + 0.12);
      });
    } catch (e) {}
  }

  playTetris() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteTime = now + idx * 0.04;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);
        gain.gain.setValueAtTime(0.25, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(noteTime);
        osc.stop(noteTime + 0.15);
      });
    } catch (e) {}
  }
}

const tetrisSfx = new TetrisSoundFx();

class CyberTetrisEngine {
  constructor(canvas, canvasWrapper) {
    this.canvas = canvas;
    this.canvasWrapper = canvasWrapper;
    this.ctx = canvas.getContext('2d');

    this.cols = 10;
    this.rows = 20;

    this.grid = [];
    this.activePiece = null;
    this.nextPiece = null;

    this.score = 0;
    this.linesCleared = 0;
    this.level = 1;
    this.highScore = parseInt(localStorage.getItem('cyber_tetris_highscore') || '0', 10);

    this.state = 'IDLE'; // 'IDLE' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'
    this.dropInterval = 800; // ms per drop
    this.lastDropTime = 0;
    this.animFrameId = null;

    this.particles = [];
  }

  initGrid() {
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
  }

  resizeCanvas() {
    const rect = this.canvasWrapper.getBoundingClientRect();
    this.canvas.width = Math.floor(rect.width);
    this.canvas.height = Math.floor(rect.height);

    // Tetris Board Dimensions: 10 cols x 20 rows
    // In landscape or portrait, fit 20 rows vertically in canvas height
    this.boardHeight = this.canvas.height * 0.92;
    this.cellSize = this.boardHeight / this.rows;
    this.boardWidth = this.cellSize * this.cols;

    this.boardX = (this.canvas.width - this.boardWidth) / 2;
    this.boardY = (this.canvas.height - this.boardHeight) / 2;
  }

  startGame() {
    this.resizeCanvas();
    this.initGrid();

    this.score = 0;
    this.linesCleared = 0;
    this.level = 1;
    this.dropInterval = 800;
    this.particles = [];

    this.nextPiece = this.generatePiece();
    this.spawnPiece();

    this.state = 'PLAYING';
    this.lastDropTime = performance.now();

    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.loop(performance.now());
  }

  generatePiece() {
    const key = TETROMINO_KEYS[Math.floor(Math.random() * TETROMINO_KEYS.length)];
    const def = TETROMINOES[key];
    return {
      key: key,
      shape: def.shape.map(row => [...row]),
      color: def.color,
      glow: def.glow,
      x: Math.floor((this.cols - def.shape[0].length) / 2),
      y: 0
    };
  }

  spawnPiece() {
    this.activePiece = this.nextPiece;
    this.nextPiece = this.generatePiece();

    // Check game over collision on spawn
    if (this.checkCollision(this.activePiece.x, this.activePiece.y, this.activePiece.shape)) {
      this.gameOver();
    }
  }

  rotatePiece() {
    if (!this.activePiece || this.state !== 'PLAYING') return;

    const shape = this.activePiece.shape;
    const N = shape.length;
    const rotated = Array.from({ length: N }, () => Array(N).fill(0));

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        rotated[c][N - 1 - r] = shape[r][c];
      }
    }

    // SRS Wall kick checks
    const kicks = [0, 1, -1, 2, -2];
    for (let kick of kicks) {
      if (!this.checkCollision(this.activePiece.x + kick, this.activePiece.y, rotated)) {
        this.activePiece.x += kick;
        this.activePiece.shape = rotated;
        tetrisSfx.playRotate();
        return;
      }
    }
  }

  moveLeft() {
    if (!this.activePiece || this.state !== 'PLAYING') return;
    if (!this.checkCollision(this.activePiece.x - 1, this.activePiece.y, this.activePiece.shape)) {
      this.activePiece.x -= 1;
      tetrisSfx.playRotate();
    }
  }

  moveRight() {
    if (!this.activePiece || this.state !== 'PLAYING') return;
    if (!this.checkCollision(this.activePiece.x + 1, this.activePiece.y, this.activePiece.shape)) {
      this.activePiece.x += 1;
      tetrisSfx.playRotate();
    }
  }

  softDrop() {
    if (!this.activePiece || this.state !== 'PLAYING') return;
    if (!this.checkCollision(this.activePiece.x, this.activePiece.y + 1, this.activePiece.shape)) {
      this.activePiece.y += 1;
      this.score += 1;
    } else {
      this.lockPiece();
    }
  }

  hardDrop() {
    if (!this.activePiece || this.state !== 'PLAYING') return;
    let drops = 0;
    while (!this.checkCollision(this.activePiece.x, this.activePiece.y + 1, this.activePiece.shape)) {
      this.activePiece.y += 1;
      drops++;
    }
    this.score += drops * 2;
    tetrisSfx.playDrop();
    this.lockPiece();
  }

  checkCollision(x, y, shape) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const newX = x + c;
          const newY = y + r;

          if (newX < 0 || newX >= this.cols || newY >= this.rows) {
            return true;
          }
          if (newY >= 0 && this.grid[newY][newX]) {
            return true;
          }
        }
      }
    }
    return false;
  }

  lockPiece() {
    const shape = this.activePiece.shape;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const boardY = this.activePiece.y + r;
          const boardX = this.activePiece.x + c;
          if (boardY >= 0 && boardY < this.rows) {
            this.grid[boardY][boardX] = {
              color: this.activePiece.color,
              glow: this.activePiece.glow
            };
          }
        }
      }
    }

    this.clearLines();
    this.spawnPiece();
  }

  clearLines() {
    let cleared = 0;

    for (let r = this.rows - 1; r >= 0; r--) {
      if (this.grid[r].every(cell => cell !== 0)) {
        // Create line clear particles
        this.createLineParticles(r);
        this.grid.splice(r, 1);
        this.grid.unshift(Array(this.cols).fill(0));
        cleared++;
        r++; // Check same row index again after shift
      }
    }

    if (cleared > 0) {
      this.linesCleared += cleared;
      
      const scoreMultipliers = [0, 100, 300, 500, 800];
      this.score += (scoreMultipliers[cleared] || 100) * this.level;

      if (cleared === 4) {
        tetrisSfx.playTetris();
      } else {
        tetrisSfx.playLineClear();
      }

      // Level up every 10 lines
      this.level = Math.floor(this.linesCleared / 10) + 1;
      this.dropInterval = Math.max(100, 800 - (this.level - 1) * 70);
    }
  }

  createLineParticles(row) {
    const py = this.boardY + (row + 0.5) * this.cellSize;
    for (let c = 0; c < this.cols; c++) {
      const px = this.boardX + (c + 0.5) * this.cellSize;
      for (let i = 0; i < 4; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        this.particles.push({
          x: px,
          y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 2 + Math.random() * 3,
          color: '#00f0ff',
          alpha: 1
        });
      }
    }
  }

  getGhostY() {
    if (!this.activePiece) return 0;
    let ghostY = this.activePiece.y;
    while (!this.checkCollision(this.activePiece.x, ghostY + 1, this.activePiece.shape)) {
      ghostY++;
    }
    return ghostY;
  }

  loop(currentTime) {
    if (this.state !== 'PLAYING') return;

    this.animFrameId = requestAnimationFrame((timestamp) => this.loop(timestamp));

    const elapsed = currentTime - this.lastDropTime;
    if (elapsed >= this.dropInterval) {
      this.softDrop();
      this.lastDropTime = currentTime;
    }

    this.render();
  }

  gameOver() {
    this.state = 'GAMEOVER';
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('cyber_tetris_highscore', this.highScore.toString());
    }

    const wrapper = document.getElementById('canvas-wrapper');
    wrapper.classList.remove('shake');
    void wrapper.offsetWidth;
    wrapper.classList.add('shake');

    document.getElementById('final-score').textContent = this.score;
    document.getElementById('final-best').textContent = this.highScore;

    setTimeout(() => {
      document.getElementById('game-over-overlay').classList.add('active');
    }, 300);
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw Board Background & Grid Lines
    this.drawBoard();

    // Draw Fixed Blocks on Board
    this.drawFixedBlocks();

    // Draw Ghost Piece Projection
    if (this.activePiece) {
      this.drawGhostPiece();
      this.drawPiece(this.activePiece.x, this.activePiece.y, this.activePiece.shape, this.activePiece.color, this.activePiece.glow);
    }

    // Draw Particles
    this.updateAndDrawParticles();

    // Draw Canvas HUD (Score, Level, Next Piece)
    this.drawTetrisHUD();
  }

  drawBoard() {
    const ctx = this.ctx;
    ctx.save();

    // Board container background
    ctx.fillStyle = 'rgba(7, 10, 15, 0.95)';
    ctx.fillRect(this.boardX, this.boardY, this.boardWidth, this.boardHeight);

    // Outer Glow Border
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.strokeRect(this.boardX, this.boardY, this.boardWidth, this.boardHeight);

    // Grid lines inside board
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;

    for (let c = 0; c <= this.cols; c++) {
      ctx.beginPath();
      ctx.moveTo(this.boardX + c * this.cellSize, this.boardY);
      ctx.lineTo(this.boardX + c * this.cellSize, this.boardY + this.boardHeight);
      ctx.stroke();
    }
    for (let r = 0; r <= this.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(this.boardX, this.boardY + r * this.cellSize);
      ctx.lineTo(this.boardX + this.boardWidth, this.boardY + r * this.cellSize);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawFixedBlocks() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell) {
          this.drawCell(c, r, cell.color, cell.glow);
        }
      }
    }
  }

  drawGhostPiece() {
    const ghostY = this.getGhostY();
    const shape = this.activePiece.shape;
    const ctx = this.ctx;

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const px = this.boardX + (this.activePiece.x + c) * this.cellSize;
          const py = this.boardY + (ghostY + r) * this.cellSize;

          ctx.save();
          ctx.strokeStyle = this.activePiece.color;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.4;
          ctx.strokeRect(px + 1, py + 1, this.cellSize - 2, this.cellSize - 2);
          ctx.restore();
        }
      }
    }
  }

  drawPiece(x, y, shape, color, glow) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          this.drawCell(x + c, y + r, color, glow);
        }
      }
    }
  }

  drawCell(col, row, color, glow) {
    const ctx = this.ctx;
    const px = this.boardX + col * this.cellSize;
    const py = this.boardY + row * this.cellSize;
    const sz = this.cellSize;

    ctx.save();
    ctx.shadowColor = glow || color;
    ctx.shadowBlur = 8;

    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, sz - 2, sz - 2);

    // Inner bright highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(px + 2, py + 2, sz - 4, (sz - 4) * 0.25);

    ctx.restore();
  }

  updateAndDrawParticles() {
    const ctx = this.ctx;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.03;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawTetrisHUD() {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '800 14px "Orbitron", monospace';
    ctx.fillStyle = 'rgba(240, 246, 252, 0.85)';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;

    // Draw Left Panel (Score & Level)
    const leftMargin = Math.max(12, this.boardX - 110);
    if (this.boardX > 100) {
      ctx.fillText(`SCORE`, leftMargin, this.boardY + 30);
      ctx.font = '800 18px "Orbitron", monospace';
      ctx.fillText(`${this.score}`, leftMargin, this.boardY + 54);

      ctx.font = '800 14px "Orbitron", monospace';
      ctx.fillText(`LEVEL`, leftMargin, this.boardY + 95);
      ctx.font = '800 18px "Orbitron", monospace';
      ctx.fillText(`${this.level}`, leftMargin, this.boardY + 119);

      ctx.font = '800 14px "Orbitron", monospace';
      ctx.fillText(`BEST`, leftMargin, this.boardY + 160);
      ctx.font = '800 18px "Orbitron", monospace';
      ctx.fillText(`${this.highScore}`, leftMargin, this.boardY + 184);
    } else {
      // In narrow viewports, draw score at top
      ctx.fillText(`SCORE: ${this.score}`, 16, 28);
      ctx.textAlign = 'right';
      ctx.fillText(`LVL: ${this.level}  BEST: ${this.highScore}`, this.canvas.width - 16, 28);
    }

    // Draw Next Piece Preview on Right Panel if space exists
    if (this.nextPiece && (this.canvas.width - (this.boardX + this.boardWidth)) > 80) {
      const rightX = this.boardX + this.boardWidth + 20;
      ctx.textAlign = 'left';
      ctx.font = '800 14px "Orbitron", monospace';
      ctx.fillText(`NEXT`, rightX, this.boardY + 30);

      // Draw Next Piece shape preview
      const shape = this.nextPiece.shape;
      const previewCell = Math.min(18, this.cellSize * 0.75);
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
            const px = rightX + c * previewCell;
            const py = this.boardY + 45 + r * previewCell;
            ctx.fillStyle = this.nextPiece.color;
            ctx.fillRect(px, py, previewCell - 1, previewCell - 1);
          }
        }
      }
    }

    ctx.restore();
  }
}

window.CyberTetrisEngine = CyberTetrisEngine;
