/* ==========================================================================
   ARCADE SUITE MANAGER (SNAKE, TETRIS, PS4 CONTROLLER & LONG-PRESS QUIT)
   ========================================================================== */

// --- Audio Synthesizer (Web Audio API) ---
class SoundFx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playEat() {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  playBonus() {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteTime = now + idx * 0.04;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.2, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.1);
      });
    } catch (e) {}
  }

  playGameOver() {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {}
  }

  playClick() {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch (e) {}
  }
}

const sfx = new SoundFx();

// --- Snake Game Engine ---
class PureSnakeGame {
  constructor(canvas, canvasWrapper) {
    this.canvasWrapper = canvasWrapper;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    this.cellSize = 20;
    this.gridCols = 25;
    this.gridRows = 25;

    this.state = 'IDLE';
    this.snake = [];
    this.dir = { x: 0, y: -1 };
    this.nextDir = { x: 0, y: -1 };
    
    this.normalFood = null;
    this.specialFood = null;

    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('neon_snake_highscore') || '0', 10);
    this.combo = 1;
    this.comboTimer = 0;
    this.comboMaxTime = 120;

    this.particles = [];
    this.baseSpeedMs = 90;
    this.lastTickTime = 0;
    this.animFrameId = null;
  }

  resizeCanvas() {
    const rect = this.canvasWrapper.getBoundingClientRect();
    this.canvas.width = Math.floor(rect.width);
    this.canvas.height = Math.floor(rect.height);

    const targetCellSize = 22;
    this.gridCols = Math.max(15, Math.floor(this.canvas.width / targetCellSize));
    this.gridRows = Math.max(15, Math.floor(this.canvas.height / targetCellSize));
    this.cellSize = this.canvas.width / this.gridCols;
  }

  startGame() {
    this.resizeCanvas();
    const midX = Math.floor(this.gridCols / 2);
    const midY = Math.floor(this.gridRows / 2);

    this.snake = [
      { x: midX, y: midY },
      { x: midX, y: midY + 1 },
      { x: midX, y: midY + 2 }
    ];

    this.dir = { x: 0, y: -1 };
    this.nextDir = { x: 0, y: -1 };
    
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.particles = [];
    this.specialFood = null;

    this.spawnNormalFood();
    this.state = 'PLAYING';
    this.lastTickTime = performance.now();

    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.loop(performance.now());
  }

  setDirection(x, y) {
    if (this.dir.x + x === 0 && this.dir.y + y === 0) return;
    this.nextDir = { x, y };
  }

  spawnNormalFood() {
    let valid = false;
    let pos = {};
    while (!valid) {
      pos = {
        x: Math.floor(Math.random() * this.gridCols),
        y: Math.floor(Math.random() * this.gridRows)
      };
      valid = !this.snake.some(segment => segment.x === pos.x && segment.y === pos.y);
    }
    this.normalFood = { ...pos, type: 'normal' };
    if (!this.specialFood && Math.random() < 0.3) {
      this.spawnSpecialFood();
    }
  }

  spawnSpecialFood() {
    let valid = false;
    let pos = {};
    while (!valid) {
      pos = {
        x: Math.floor(Math.random() * this.gridCols),
        y: Math.floor(Math.random() * this.gridRows)
      };
      valid = !this.snake.some(segment => segment.x === pos.x && segment.y === pos.y) &&
              !(this.normalFood && this.normalFood.x === pos.x && this.normalFood.y === pos.y);
    }
    const isGold = Math.random() < 0.6;
    this.specialFood = {
      ...pos,
      type: isGold ? 'gold' : 'speed',
      timer: 120,
      maxTimer: 120
    };
  }

  loop(currentTime) {
    if (this.state !== 'PLAYING') return;

    this.animFrameId = requestAnimationFrame((timestamp) => this.loop(timestamp));

    const elapsed = currentTime - this.lastTickTime;
    if (elapsed >= this.baseSpeedMs) {
      this.updateGameLogic();
      this.lastTickTime = currentTime;
    }

    this.render();
  }

  updateGameLogic() {
    this.dir = { ...this.nextDir };

    let head = {
      x: this.snake[0].x + this.dir.x,
      y: this.snake[0].y + this.dir.y
    };

    // Wraparound Wall Logic
    if (head.x < 0) head.x = this.gridCols - 1;
    else if (head.x >= this.gridCols) head.x = 0;

    if (head.y < 0) head.y = this.gridRows - 1;
    else if (head.y >= this.gridRows) head.y = 0;

    if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
      this.createExplosion(head.x, head.y, '#ff0055', 25);
      this.gameOver();
      return;
    }

    this.snake.unshift(head);
    let ateFood = false;

    if (this.normalFood && head.x === this.normalFood.x && head.y === this.normalFood.y) {
      ateFood = true;
      this.score += 10 * this.combo;
      this.comboTimer = 0;
      this.combo++;
      sfx.playEat();
      this.createExplosion(head.x, head.y, '#ff007f', 12);
      this.spawnNormalFood();
    }

    if (this.specialFood && head.x === this.specialFood.x && head.y === this.specialFood.y) {
      ateFood = true;
      if (this.specialFood.type === 'gold') {
        this.score += 35 * this.combo;
        sfx.playBonus();
        this.createExplosion(head.x, head.y, '#ffe600', 18);
      } else {
        this.score += 20 * this.combo;
        this.combo += 2;
        sfx.playBonus();
        this.createExplosion(head.x, head.y, '#00ffaa', 18);
      }
      this.specialFood = null;
    }

    if (!ateFood) {
      this.snake.pop();
    }

    if (this.specialFood) {
      this.specialFood.timer--;
      if (this.specialFood.timer <= 0) this.specialFood = null;
    }

    if (this.combo > 1) {
      this.comboTimer++;
      if (this.comboTimer >= this.comboMaxTime) {
        this.combo = 1;
        this.comboTimer = 0;
      }
    }
  }

  createExplosion(gridX, gridY, color, count = 15) {
    const px = (gridX + 0.5) * this.cellSize;
    const py = (gridY + 0.5) * this.cellSize;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 3,
        color: color,
        alpha: 1
      });
    }
  }

  gameOver() {
    this.state = 'GAMEOVER';
    sfx.playGameOver();

    const wrapper = document.getElementById('canvas-wrapper');
    wrapper.classList.remove('shake');
    void wrapper.offsetWidth;
    wrapper.classList.add('shake');

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('neon_snake_highscore', this.highScore.toString());
    }

    document.getElementById('final-score').textContent = this.score;
    document.getElementById('final-best').textContent = this.highScore;

    setTimeout(() => {
      document.getElementById('game-over-overlay').classList.add('active');
    }, 400);
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawGrid();
    if (this.specialFood) this.drawSpecialFood(this.specialFood);
    if (this.normalFood) this.drawFood(this.normalFood);
    this.drawSnake();
    this.updateAndDrawParticles();
    this.drawCanvasHUD();
  }

  drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= this.gridCols; i++) {
      ctx.beginPath();
      ctx.moveTo(i * this.cellSize, 0);
      ctx.lineTo(i * this.cellSize, this.canvas.height);
      ctx.stroke();
    }
    for (let j = 0; j <= this.gridRows; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * this.cellSize);
      ctx.lineTo(this.canvas.width, j * this.cellSize);
      ctx.stroke();
    }
  }

  drawFood(food) {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const cx = (food.x + 0.5) * cs;
    const cy = (food.y + 0.5) * cs;
    const foodColor = '#ff007f';
    const pulse = 1 + Math.sin(performance.now() / 150) * 0.12;
    const radius = (cs / 2.5) * pulse;

    ctx.save();
    ctx.shadowColor = foodColor;
    ctx.shadowBlur = 15;
    ctx.fillStyle = foodColor;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawSpecialFood(food) {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const cx = (food.x + 0.5) * cs;
    const cy = (food.y + 0.5) * cs;
    const isGold = food.type === 'gold';
    const foodColor = isGold ? '#ffe600' : '#00ffaa';
    const pulse = 1 + Math.sin(performance.now() / 100) * 0.15;
    const radius = (cs / 2.3) * pulse;

    ctx.save();
    ctx.shadowColor = foodColor;
    ctx.shadowBlur = 20;

    const timerRatio = food.timer / food.maxTimer;
    ctx.strokeStyle = foodColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, cs * 0.45, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * timerRatio));
    ctx.stroke();

    ctx.fillStyle = foodColor;
    ctx.beginPath();
    const sides = isGold ? 5 : 4;
    for (let i = 0; i < sides * 2; i++) {
      const r = (i % 2 === 0) ? radius : radius * 0.5;
      const a = (i * Math.PI) / sides;
      ctx.lineTo(cx + r * Math.sin(a), cy - r * Math.cos(a));
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawSnake() {
    if (this.snake.length === 0) return;
    const ctx = this.ctx;
    const cs = this.cellSize;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 240, 255, 0.6)';
    ctx.shadowBlur = 12;

    for (let i = this.snake.length - 1; i >= 1; i--) {
      const seg = this.snake[i];
      const ratio = i / this.snake.length;
      ctx.fillStyle = '#00f0ff';
      const size = cs * (0.85 - ratio * 0.25);
      const offset = (cs - size) / 2;
      ctx.fillRect(seg.x * cs + offset, seg.y * cs + offset, size, size);
    }

    const head = this.snake[0];
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#00f0ff';
    const headSize = cs * 0.9;
    const hOffset = (cs - headSize) / 2;
    ctx.fillRect(head.x * cs + hOffset, head.y * cs + hOffset, headSize, headSize);
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

  drawCanvasHUD() {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '800 16px "Orbitron", monospace';
    ctx.fillStyle = 'rgba(240, 246, 252, 0.85)';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.fillText(`SCORE: ${this.score}`, 16, 32);
    ctx.textAlign = 'right';
    ctx.fillText(`BEST: ${this.highScore}`, this.canvas.width - 16, 32);
    if (this.combo > 1) {
      ctx.fillStyle = '#ff007f';
      ctx.font = '800 14px "Orbitron", monospace';
      ctx.fillText(`${this.combo}x COMBO`, this.canvas.width - 16, 54);
    }
    ctx.restore();
  }
}

// --- Arcade Manager & Global Input Controller ---
class ArcadeManager {
  constructor() {
    this.canvasWrapper = document.getElementById('canvas-wrapper');
    this.canvas = document.getElementById('game-canvas');
    
    this.snakeEngine = new PureSnakeGame(this.canvas, this.canvasWrapper);
    this.tetrisEngine = new window.CyberTetrisEngine(this.canvas, this.canvasWrapper);

    this.currentGame = 'none'; // 'none' | 'snake' | 'tetris'

    // Overlays
    this.mainMenuOverlay = document.getElementById('main-menu-overlay');
    this.snakeStartOverlay = document.getElementById('snake-start-overlay');
    this.tetrisStartOverlay = document.getElementById('tetris-start-overlay');
    this.pauseOverlay = document.getElementById('pause-overlay');
    this.gameOverOverlay = document.getElementById('game-over-overlay');
    this.quitModal = document.getElementById('quit-modal');

    // Long Press Timer State
    this.longPressTimer = null;
    this.longPressDuration = 800; // ms

    this.gamepadPrev = {
      up: false, down: false, left: false, right: false,
      btnX: false, btnOptions: false, btnHoldStart: 0
    };

    this.initEvents();
  }

  initEvents() {
    // Menu Game Selection Buttons
    document.getElementById('select-snake-btn').addEventListener('click', () => {
      sfx.init();
      sfx.playClick();
      this.selectGame('snake');
    });

    document.getElementById('select-tetris-btn').addEventListener('click', () => {
      sfx.init();
      sfx.playClick();
      this.selectGame('tetris');
    });

    // Start Game Buttons inside overlays
    document.getElementById('snake-start-btn').addEventListener('click', () => {
      sfx.init();
      this.startSelectedGame();
    });

    document.getElementById('tetris-start-btn').addEventListener('click', () => {
      sfx.init();
      this.startSelectedGame();
    });

    // Resume & Restart Buttons
    document.getElementById('resume-btn').addEventListener('click', () => {
      sfx.playClick();
      this.resumeCurrentGame();
    });

    document.getElementById('restart-pause-btn').addEventListener('click', () => {
      sfx.playClick();
      this.startSelectedGame();
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
      sfx.playClick();
      this.startSelectedGame();
    });

    // Main Menu Return Buttons
    document.getElementById('menu-pause-btn').addEventListener('click', () => {
      sfx.playClick();
      this.showQuitModal();
    });

    document.getElementById('menu-gameover-btn').addEventListener('click', () => {
      sfx.playClick();
      this.returnToMainMenu();
    });

    // Quit Modal Buttons
    document.getElementById('confirm-quit-btn').addEventListener('click', () => {
      sfx.playClick();
      this.returnToMainMenu();
    });

    document.getElementById('cancel-quit-btn').addEventListener('click', () => {
      sfx.playClick();
      this.quitModal.classList.remove('active');
      this.resumeCurrentGame();
    });

    // Setup Long-Press Touch & Keyboard Listeners
    this.initLongPressHandlers();

    // Resize listeners
    window.addEventListener('resize', () => {
      if (this.currentGame === 'snake') this.snakeEngine.resizeCanvas();
      if (this.currentGame === 'tetris') this.tetrisEngine.resizeCanvas();
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        if (this.currentGame === 'snake') this.snakeEngine.resizeCanvas();
        if (this.currentGame === 'tetris') this.tetrisEngine.resizeCanvas();
      }, 200);
    });

    // Gamepad Loop
    const pollLoop = () => {
      this.pollGamepad();
      requestAnimationFrame(pollLoop);
    };
    requestAnimationFrame(pollLoop);
  }

  selectGame(gameType) {
    this.currentGame = gameType;
    this.hideAllOverlays();

    if (gameType === 'snake') {
      this.snakeStartOverlay.classList.add('active');
    } else if (gameType === 'tetris') {
      this.tetrisStartOverlay.classList.add('active');
    }
  }

  startSelectedGame() {
    this.hideAllOverlays();
    if (this.currentGame === 'snake') {
      this.snakeEngine.startGame();
    } else if (this.currentGame === 'tetris') {
      this.tetrisEngine.startGame();
    }
  }

  resumeCurrentGame() {
    this.hideAllOverlays();
    if (this.currentGame === 'snake') {
      this.snakeEngine.state = 'PLAYING';
      this.snakeEngine.lastTickTime = performance.now();
      this.snakeEngine.loop(performance.now());
    } else if (this.currentGame === 'tetris') {
      this.tetrisEngine.state = 'PLAYING';
      this.tetrisEngine.lastDropTime = performance.now();
      this.tetrisEngine.loop(performance.now());
    }
  }

  pauseCurrentGame() {
    if (this.currentGame === 'snake' && this.snakeEngine.state === 'PLAYING') {
      this.snakeEngine.state = 'PAUSED';
      this.pauseOverlay.classList.add('active');
    } else if (this.currentGame === 'tetris' && this.tetrisEngine.state === 'PLAYING') {
      this.tetrisEngine.state = 'PAUSED';
      this.pauseOverlay.classList.add('active');
    }
  }

  showQuitModal() {
    this.pauseCurrentGame();
    this.quitModal.classList.add('active');
  }

  returnToMainMenu() {
    if (this.snakeEngine.animFrameId) cancelAnimationFrame(this.snakeEngine.animFrameId);
    if (this.tetrisEngine.animFrameId) cancelAnimationFrame(this.tetrisEngine.animFrameId);

    this.snakeEngine.state = 'IDLE';
    this.tetrisEngine.state = 'IDLE';
    this.currentGame = 'none';

    this.hideAllOverlays();
    this.mainMenuOverlay.classList.add('active');
  }

  hideAllOverlays() {
    this.mainMenuOverlay.classList.remove('active');
    this.snakeStartOverlay.classList.remove('active');
    this.tetrisStartOverlay.classList.remove('active');
    this.pauseOverlay.classList.remove('active');
    this.gameOverOverlay.classList.remove('active');
    this.quitModal.classList.remove('active');
  }

  // --- Long Press Handler (Touch Screen & Keyboard) ---
  initLongPressHandlers() {
    let touchStartX = 0;
    let touchStartY = 0;

    window.addEventListener('touchstart', (e) => {
      sfx.init();
      if (this.currentGame === 'none') return;
      if (e.touches && e.touches[0]) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
      this.longPressTimer = setTimeout(() => {
        this.triggerHaptic();
        this.showQuitModal();
      }, this.longPressDuration);
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (this.longPressTimer) clearTimeout(this.longPressTimer);
      if (this.currentGame === 'none') return;

      if (!e.changedTouches || !e.changedTouches[0]) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;

      // Handle Game Swipes if playing
      if (Math.abs(dx) > 18 || Math.abs(dy) > 18) {
        if (this.currentGame === 'snake' && this.snakeEngine.state === 'PLAYING') {
          if (Math.abs(dx) > Math.abs(dy)) {
            this.snakeEngine.setDirection(dx > 0 ? 1 : -1, 0);
          } else {
            this.snakeEngine.setDirection(0, dy > 0 ? 1 : -1);
          }
        } else if (this.currentGame === 'tetris' && this.tetrisEngine.state === 'PLAYING') {
          if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) this.tetrisEngine.moveRight();
            else this.tetrisEngine.moveLeft();
          } else if (dy > 30) {
            this.tetrisEngine.softDrop();
          } else if (dy < -30) {
            this.tetrisEngine.rotatePiece();
          }
        }
      }
    }, { passive: true });

    window.addEventListener('touchcancel', () => {
      if (this.longPressTimer) clearTimeout(this.longPressTimer);
    });

    // Keyboard Listeners
    let keyHoldTimer = null;
    window.addEventListener('keydown', (e) => {
      sfx.init();
      const key = e.key;

      if (key === 'Escape' || key === 'q' || key === 'Q') {
        if (!keyHoldTimer) {
          keyHoldTimer = setTimeout(() => {
            this.showQuitModal();
          }, this.longPressDuration);
        }
      }

      if (this.currentGame === 'snake' && this.snakeEngine.state === 'PLAYING') {
        if (key === 'ArrowUp' || key === 'w' || key === 'W') this.snakeEngine.setDirection(0, -1);
        else if (key === 'ArrowDown' || key === 's' || key === 'S') this.snakeEngine.setDirection(0, 1);
        else if (key === 'ArrowLeft' || key === 'a' || key === 'A') this.snakeEngine.setDirection(-1, 0);
        else if (key === 'ArrowRight' || key === 'd' || key === 'D') this.snakeEngine.setDirection(1, 0);
        else if (key === ' ' || key === 'p' || key === 'P') this.pauseCurrentGame();
      } else if (this.currentGame === 'tetris' && this.tetrisEngine.state === 'PLAYING') {
        if (key === 'ArrowLeft' || key === 'a' || key === 'A') this.tetrisEngine.moveLeft();
        else if (key === 'ArrowRight' || key === 'd' || key === 'D') this.tetrisEngine.moveRight();
        else if (key === 'ArrowDown' || key === 's' || key === 'S') this.tetrisEngine.softDrop();
        else if (key === 'ArrowUp' || key === 'w' || key === 'W' || key === 'z' || key === 'Z') this.tetrisEngine.rotatePiece();
        else if (key === ' ') this.tetrisEngine.hardDrop();
        else if (key === 'p' || key === 'P') this.pauseCurrentGame();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Escape' || e.key === 'q' || e.key === 'Q') {
        if (keyHoldTimer) clearTimeout(keyHoldTimer);
        keyHoldTimer = null;
      }
    });
  }

  pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && gamepads[i].connected) {
        gp = gamepads[i];
        break;
      }
    }

    if (!gp) return;

    const isBtnPressed = (idx) => {
      const b = gp.buttons[idx];
      return b && (b.pressed || b.value > 0.3);
    };

    const btnX = isBtnPressed(0);
    const btnOptions = isBtnPressed(9) || isBtnPressed(1) || isBtnPressed(8) || isBtnPressed(16);

    const dpadUp = isBtnPressed(12);
    const dpadDown = isBtnPressed(13);
    const dpadLeft = isBtnPressed(14);
    const dpadRight = isBtnPressed(15);

    const axisX = gp.axes[0] || 0;
    const axisY = gp.axes[1] || 0;

    const stickUp = axisY < -0.35;
    const stickDown = axisY > 0.35;
    const stickLeft = axisX < -0.35;
    const stickRight = axisX > 0.35;

    const isUp = dpadUp || stickUp;
    const isDown = dpadDown || stickDown;
    const isLeft = dpadLeft || stickLeft;
    const isRight = dpadRight || stickRight;

    // Hold Options / Share button for > 800ms to open Quit Modal
    if (btnOptions) {
      if (!this.gamepadPrev.btnHoldStart) {
        this.gamepadPrev.btnHoldStart = performance.now();
      } else if (performance.now() - this.gamepadPrev.btnHoldStart > 800) {
        this.gamepadPrev.btnHoldStart = 0;
        this.showQuitModal();
      }
    } else {
      this.gamepadPrev.btnHoldStart = 0;
    }

    // Directional Control Dispatching
    if (this.currentGame === 'snake' && this.snakeEngine.state === 'PLAYING') {
      if (isUp && !this.gamepadPrev.up) this.snakeEngine.setDirection(0, -1);
      else if (isDown && !this.gamepadPrev.down) this.snakeEngine.setDirection(0, 1);
      else if (isLeft && !this.gamepadPrev.left) this.snakeEngine.setDirection(-1, 0);
      else if (isRight && !this.gamepadPrev.right) this.snakeEngine.setDirection(1, 0);
    } else if (this.currentGame === 'tetris' && this.tetrisEngine.state === 'PLAYING') {
      if (isLeft && !this.gamepadPrev.left) this.tetrisEngine.moveLeft();
      else if (isRight && !this.gamepadPrev.right) this.tetrisEngine.moveRight();
      else if (isDown && !this.gamepadPrev.down) this.tetrisEngine.softDrop();
      else if (isUp && !this.gamepadPrev.up) this.tetrisEngine.rotatePiece();
      
      // Cross (✖) button on Tetris -> Hard Drop
      if (btnX && !this.gamepadPrev.btnX) this.tetrisEngine.hardDrop();
    }

    // Cross (✖) button to start/resume
    if (btnX && !this.gamepadPrev.btnX && this.currentGame === 'snake') {
      if (this.snakeEngine.state === 'IDLE') this.startSelectedGame();
    } else if (btnX && !this.gamepadPrev.btnX && this.currentGame === 'tetris') {
      if (this.tetrisEngine.state === 'IDLE') this.startSelectedGame();
    }

    this.gamepadPrev.up = isUp;
    this.gamepadPrev.down = isDown;
    this.gamepadPrev.left = isLeft;
    this.gamepadPrev.right = isRight;
    this.gamepadPrev.btnX = btnX;
    this.gamepadPrev.btnOptions = btnOptions;
  }

  triggerHaptic() {
    if (navigator.vibrate) {
      try { navigator.vibrate(12); } catch (e) {}
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.arcade = new ArcadeManager();
});
