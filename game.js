/* ==========================================================================
   PURE CANVAS SNAKE GAME ENGINE (DYNAMIC WIDESCREEN RECTANGULAR GRID)
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

// --- Game Engine Class ---
class PureSnakeGame {
  constructor() {
    this.canvasWrapper = document.getElementById('canvas-wrapper');
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Dynamic Grid Properties (Rectangular)
    this.cellSize = 20;
    this.gridCols = 25;
    this.gridRows = 25;

    // Overlays
    this.startOverlay = document.getElementById('start-overlay');
    this.pauseOverlay = document.getElementById('pause-overlay');
    this.gameOverOverlay = document.getElementById('game-over-overlay');

    this.finalScoreEl = document.getElementById('final-score');
    this.finalBestEl = document.getElementById('final-best');

    // Game State
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

    // Gamepad state tracking
    this.gamepadPrev = {
      up: false,
      down: false,
      left: false,
      right: false,
      btnX: false,
      btnOptions: false
    };

    this.resizeCanvas();
    this.initUI();
    this.initGamepad();
    this.renderInitialCanvas();

    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.render();
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.resizeCanvas();
        this.render();
      }, 200);
    });
  }

  resizeCanvas() {
    const rect = this.canvasWrapper.getBoundingClientRect();
    this.canvas.width = Math.floor(rect.width);
    this.canvas.height = Math.floor(rect.height);

    // Aim for ~20-22px cells dynamically
    const targetCellSize = 22;
    this.gridCols = Math.max(15, Math.floor(this.canvas.width / targetCellSize));
    this.gridRows = Math.max(15, Math.floor(this.canvas.height / targetCellSize));
    
    // Exact cell size to fill 100% of canvas area cleanly without gaps
    this.cellSize = this.canvas.width / this.gridCols;
  }

  initUI() {
    const handleStart = () => {
      sfx.init();
      sfx.playClick();
      this.startGame();
    };

    document.getElementById('start-btn').addEventListener('click', handleStart);
    document.getElementById('start-btn').addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleStart();
    }, { passive: false });

    document.getElementById('resume-btn').addEventListener('click', () => {
      sfx.playClick();
      this.togglePause();
    });

    document.getElementById('restart-pause-btn').addEventListener('click', () => {
      sfx.playClick();
      this.hideAllOverlays();
      this.startGame();
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
      sfx.playClick();
      this.hideAllOverlays();
      this.startGame();
    });

    this.startOverlay.addEventListener('click', () => {
      sfx.init();
      this.startGame();
    });

    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.initTouchEvents();
  }

  initGamepad() {
    const unlockAudioAndGamepad = () => {
      sfx.init();
    };
    window.addEventListener('touchstart', unlockAudioAndGamepad, { passive: true });
    window.addEventListener('click', unlockAudioAndGamepad, { passive: true });

    window.addEventListener('gamepadconnected', () => {
      sfx.init();
      sfx.playClick();
      this.triggerHaptic();
    });

    const pollLoop = () => {
      this.pollGamepad();
      requestAnimationFrame(pollLoop);
    };
    requestAnimationFrame(pollLoop);
  }

  pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
    if (!gamepads) return;

    let gp = null;
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && gamepads[i].connected) {
        gp = gamepads[i];
        break;
      }
    }

    if (!gp) return;

    const isBtnPressed = (btnIndex) => {
      const b = gp.buttons[btnIndex];
      if (!b) return false;
      return b.pressed || b.value > 0.3;
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

    if (isUp && !this.gamepadPrev.up) {
      this.setDirection(0, -1);
    } else if (isDown && !this.gamepadPrev.down) {
      this.setDirection(0, 1);
    } else if (isLeft && !this.gamepadPrev.left) {
      this.setDirection(-1, 0);
    } else if (isRight && !this.gamepadPrev.right) {
      this.setDirection(1, 0);
    }

    if (btnX && !this.gamepadPrev.btnX) {
      sfx.init();
      if (this.state === 'IDLE' || this.state === 'GAMEOVER') {
        this.hideAllOverlays();
        this.startGame();
      } else if (this.state === 'PAUSED') {
        this.togglePause();
      }
    }

    if (btnOptions && !this.gamepadPrev.btnOptions) {
      sfx.init();
      if (this.state === 'PLAYING' || this.state === 'PAUSED') {
        this.togglePause();
      }
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

  initTouchEvents() {
    let touchStartX = 0;
    let touchStartY = 0;

    window.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (this.state !== 'PLAYING') return;
      if (!e.changedTouches || !e.changedTouches[0]) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;

      if (Math.abs(dx) > 18 || Math.abs(dy) > 18) {
        this.triggerHaptic();
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) this.setDirection(1, 0);
          else this.setDirection(-1, 0);
        } else {
          if (dy > 0) this.setDirection(0, 1);
          else this.setDirection(0, -1);
        }
      }
    }, { passive: true });
  }

  setDirection(x, y) {
    sfx.init();
    if (this.dir.x + x === 0 && this.dir.y + y === 0) return;
    this.nextDir = { x, y };
  }

  handleKeyDown(e) {
    sfx.init();
    const key = e.key;

    if (key === 'ArrowUp' || key === 'w' || key === 'W') {
      e.preventDefault();
      this.setDirection(0, -1);
    } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
      e.preventDefault();
      this.setDirection(0, 1);
    } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
      e.preventDefault();
      this.setDirection(-1, 0);
    } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
      e.preventDefault();
      this.setDirection(1, 0);
    } else if (key === ' ' || key === 'p' || key === 'P') {
      e.preventDefault();
      if (this.state === 'PLAYING' || this.state === 'PAUSED') {
        this.togglePause();
      } else if (this.state === 'IDLE') {
        this.startGame();
      }
    }
  }

  startGame() {
    this.resizeCanvas();
    this.hideAllOverlays();
    
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

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.pauseOverlay.classList.add('active');
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.pauseOverlay.classList.remove('active');
      this.lastTickTime = performance.now();
      this.loop(performance.now());
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

    this.finalScoreEl.textContent = this.score;
    this.finalBestEl.textContent = this.highScore;

    setTimeout(() => {
      this.gameOverOverlay.classList.add('active');
    }, 400);
  }

  hideAllOverlays() {
    this.startOverlay.classList.remove('active');
    this.pauseOverlay.classList.remove('active');
    this.gameOverOverlay.classList.remove('active');
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

    const head = {
      x: this.snake[0].x + this.dir.x,
      y: this.snake[0].y + this.dir.y
    };

    if (head.x < 0 || head.x >= this.gridCols || head.y < 0 || head.y >= this.gridRows) {
      this.createExplosion(this.snake[0].x, this.snake[0].y, '#ff0055', 25);
      this.gameOver();
      return;
    }

    if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
      this.createExplosion(head.x, head.y, '#ff0055', 25);
      this.gameOver();
      return;
    }

    this.snake.unshift(head);

    let ateFood = false;

    if (this.normalFood && head.x === this.normalFood.x && head.y === this.normalFood.y) {
      ateFood = true;
      const pts = 10 * this.combo;
      this.score += pts;
      this.comboTimer = 0;
      this.combo++;
      sfx.playEat();
      this.createExplosion(head.x, head.y, '#ff007f', 12);
      this.spawnNormalFood();
    }

    if (this.specialFood && head.x === this.specialFood.x && head.y === this.specialFood.y) {
      ateFood = true;
      if (this.specialFood.type === 'gold') {
        const pts = 35 * this.combo;
        this.score += pts;
        sfx.playBonus();
        this.createExplosion(head.x, head.y, '#ffe600', 18);
      } else {
        const pts = 20 * this.combo;
        this.score += pts;
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
      if (this.specialFood.timer <= 0) {
        this.specialFood = null;
      }
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

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawGrid();

    if (this.specialFood) {
      this.drawSpecialFood(this.specialFood);
    }

    if (this.normalFood) {
      this.drawFood(this.normalFood);
    }

    this.drawSnake();
    this.updateAndDrawParticles();

    this.drawCanvasHUD();
  }

  renderInitialCanvas() {
    this.render();
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
      const px = seg.x * cs + offset;
      const py = seg.y * cs + offset;

      this.drawRoundedRect(ctx, px, py, size, size, 6);
      ctx.fill();
    }

    const head = this.snake[0];
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#00f0ff';
    const headSize = cs * 0.9;
    const hOffset = (cs - headSize) / 2;
    const hx = head.x * cs + hOffset;
    const hy = head.y * cs + hOffset;

    this.drawRoundedRect(ctx, hx, hy, headSize, headSize, 8);
    ctx.fill();

    ctx.fillStyle = '#04060a';
    const eyeSize = cs * 0.14;
    const eyeOffset = cs * 0.25;

    let eye1X = hx + eyeOffset;
    let eye1Y = hy + eyeOffset;
    let eye2X = hx + headSize - eyeOffset - eyeSize;
    let eye2Y = hy + eyeOffset;

    if (this.dir.x === 1) {
      eye1X = hx + headSize - eyeOffset;
      eye1Y = hy + eyeOffset;
      eye2X = hx + headSize - eyeOffset;
      eye2Y = hy + headSize - eyeOffset - eyeSize;
    } else if (this.dir.x === -1) {
      eye1X = hx + eyeOffset - eyeSize;
      eye1Y = hy + eyeOffset;
      eye2X = hx + eyeOffset - eyeSize;
      eye2Y = hy + headSize - eyeOffset - eyeSize;
    } else if (this.dir.y === 1) {
      eye1X = hx + eyeOffset;
      eye1Y = hy + headSize - eyeOffset;
      eye2X = hx + headSize - eyeOffset - eyeSize;
      eye2Y = hy + headSize - eyeOffset;
    }

    ctx.beginPath();
    ctx.arc(eye1X + eyeSize/2, eye1Y + eyeSize/2, eyeSize, 0, Math.PI * 2);
    ctx.arc(eye2X + eyeSize/2, eye2Y + eyeSize/2, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
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

  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
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
}

document.addEventListener('DOMContentLoaded', () => {
  window.game = new PureSnakeGame();
});
