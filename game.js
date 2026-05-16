(function () {
  const canvas = document.getElementById('fish-game');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const FONT    = '13px JetBrains Mono, monospace';
  const FONT_SM = '10px JetBrains Mono, monospace';
  const LINE_H  = 17;

  const C = {
    bg:     '#070910',
    grid:   'rgba(37,42,56,0.3)',
    cyan:   '#22d3ee',
    muted:  '#5a6478',
    purple: '#c084fc',
    coral:  '#f87171',
    mine:   '#94a3b8',
    food:   '#4ade80',
  };

  // ── Sprites ───────────────────────────────────────────────────────────────
  const SP = {
    fish: {
      frames: [
        ['  ^  ', '><((°>'],
        ['  ^  ', '><(( °>'],
      ],
      color: C.cyan,
    },
    fishDead: {
      lines: ['  ^  ', '><((x>'],
      color: C.muted,
    },
    jellyfish: {
      frames: [
        ['.~~~~.', '(o · o)', " '~~~' ", ' ||||  '],
        ['.~~~~.', '(· o ·)', " '~~~' ", '  |||| '],
      ],
      color: C.purple,
    },
    mine: {
      lines: [' \\|/ ', '*[O]*', ' /|\\ ', '  |  '],
      color: C.mine,
    },
    coral: {
      lines: ['Y   Y', ' Y Y ', '  Y  ', '  |  ', '  |  '],
      color: C.coral,
    },
  };

  function getLines(sprite, t) {
    if (sprite.frames) {
      return sprite.frames[Math.floor(t / 22) % sprite.frames.length];
    }
    return sprite.lines;
  }

  function drawSprite(sprite, x, y, t = 0) {
    const lines = getLines(sprite, t);
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = sprite.color;
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y - ((lines.length - 1) * LINE_H) / 2 + i * LINE_H);
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // ── Sprites: food ─────────────────────────────────────────────────────────
  // Animated with two frames
  const FOOD_FRAMES = [['·:·'], [':·:']];
  const FOOD_R = 10; // collect radius

  // ── State ─────────────────────────────────────────────────────────────────
  let state     = 'idle';
  let score     = 0;
  let hiScore   = 0;
  let frame     = 0;
  let speed     = 0;
  let obstacles = [];
  let food      = [];
  let particles = [];
  let bubbles   = [];

  const FISH_R = 11;
  const fish   = { x: 80, y: 0, vy: 0 };

  // ── Input ─────────────────────────────────────────────────────────────────
  const keys = {};
  let touchDir = 0;

  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if ((e.code === 'Space' || e.code === 'Enter') && state !== 'playing') startGame();
    if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code) && state === 'playing') e.preventDefault();
  });
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchDir = e.touches[0].clientY - canvas.getBoundingClientRect().top < canvas.height / 2 ? -1 : 1;
    if (state !== 'playing') startGame();
  }, { passive: false });
  canvas.addEventListener('touchend',    () => { touchDir = 0; });
  canvas.addEventListener('touchcancel', () => { touchDir = 0; });

  // ── Init ──────────────────────────────────────────────────────────────────
  function startGame() {
    fish.y    = canvas.height / 2;
    fish.vy   = 0;
    obstacles = [];
    food      = [];
    particles = [];
    score     = 0;
    frame     = 0;
    speed     = 2.6;
    bubbles   = Array.from({ length: 14 }, mkBubble);
    state     = 'playing';
  }

  function mkBubble() {
    return {
      x:       Math.random() * canvas.width,
      y:       Math.random() * canvas.height,
      ch:      Math.random() > 0.5 ? 'o' : '·',
      speed:   Math.random() * 0.3 + 0.1,
      opacity: Math.random() * 0.18 + 0.04,
    };
  }

  // ── Obstacles ─────────────────────────────────────────────────────────────
  const OBS_TYPES = ['jellyfish', 'mine', 'coral'];

  function spawnObs() {
    const type = OBS_TYPES[Math.floor(Math.random() * OBS_TYPES.length)];
    const pad  = 60;
    obstacles.push({
      type,
      x: canvas.width + 50,
      y: pad + Math.random() * (canvas.height - pad * 2),
      t: 0,
    });
  }

  function obsRadius(type) {
    return type === 'jellyfish' ? 22 : type === 'mine' ? 19 : 15;
  }

  function collides(obs) {
    return Math.hypot(fish.x - obs.x, fish.y - obs.y) < obsRadius(obs.type) + FISH_R - 5;
  }

  // ── Food ──────────────────────────────────────────────────────────────────
  function spawnFood() {
    const pad = 40;
    food.push({
      x: canvas.width + 30,
      y: pad + Math.random() * (canvas.height - pad * 2),
      t: 0,
      collected: false,
    });
  }

  function drawFood(f) {
    const lines = FOOD_FRAMES[Math.floor(f.t / 18) % 2];
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.food;
    ctx.fillText(lines[0], f.x, f.y);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // ── Particles ─────────────────────────────────────────────────────────────
  const P_CHARS = ['·', '*', '~', '°', '+', '×'];

  function spawnParticles(x, y) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 2.8 + 0.5;
      particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 1,
        color: C.cyan, ch: P_CHARS[Math.floor(Math.random() * P_CHARS.length)] });
    }
  }

  function spawnCollectParticles(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 2 + 0.5;
      particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 1,
        color: C.food, ch: ['+', '·', '*'][Math.floor(Math.random() * 3)] });
    }
  }

  // ── Draw helpers ──────────────────────────────────────────────────────────
  function drawBg() {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < canvas.width; x += 64) {
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += LINE_H * 2) {
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
  }

  function drawBubbles() {
    ctx.font = FONT_SM;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    bubbles.forEach((b) => {
      ctx.fillStyle = `rgba(34,211,238,${b.opacity})`;
      ctx.fillText(b.ch, b.x, b.y);
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  function drawHUD() {
    ctx.font = FONT;
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`score  ${String(Math.floor(score)).padStart(5, '0')}`, canvas.width - 14, 12);
    if (hiScore > 0)
      ctx.fillText(`best   ${String(Math.floor(hiScore)).padStart(5, '0')}`, canvas.width - 14, 30);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  function drawOverlay(title, sub, note) {
    ctx.fillStyle = 'rgba(7,9,16,0.78)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2, cy = canvas.height / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px JetBrains Mono, monospace';
    ctx.fillStyle = C.cyan;
    ctx.fillText(title, cx, cy - 22);
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillStyle = C.muted;
    ctx.fillText(sub, cx, cy + 2);
    if (note) {
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillStyle = C.purple;
      ctx.fillText(note, cx, cy + 22);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // ── Loop ──────────────────────────────────────────────────────────────────
  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBg();

    if (state !== 'idle') {
      bubbles.forEach((b) => { b.y -= b.speed; if (b.y < -8) { b.y = canvas.height + 8; b.x = Math.random() * canvas.width; } });
    }
    drawBubbles();

    if (state === 'idle') {
      drawSprite(SP.fish, fish.x, canvas.height / 2, 0);
      drawOverlay('> ~/deep-sea', '[ space · enter · tap ] to dive in');
      requestAnimationFrame(loop);
      return;
    }

    if (state === 'playing') {
      const accel = 0.44, maxV = 5;
      if (keys['ArrowUp']   || keys['KeyW']) fish.vy -= accel;
      if (keys['ArrowDown'] || keys['KeyS']) fish.vy += accel;
      if (touchDir !== 0) fish.vy += touchDir * accel;

      fish.vy = Math.max(-maxV, Math.min(maxV, fish.vy * 0.87));
      fish.y  = Math.max(18, Math.min(canvas.height - 18, fish.y + fish.vy));

      speed = 2.6 + score * 0.014;

      const obsInterval  = Math.max(48, 108 - Math.floor(score / 20));
      const foodInterval = Math.max(70, 140 - Math.floor(score / 30));
      if (frame % obsInterval  === 0) spawnObs();
      if (frame % foodInterval === 0) spawnFood();

      obstacles.forEach((o) => { o.x -= speed; o.t++; });
      obstacles = obstacles.filter((o) => o.x > -80);

      food.forEach((f) => { f.x -= speed; f.t++; });
      food = food.filter((f) => f.x > -40);

      // Collect food
      food.forEach((f) => {
        if (!f.collected && Math.hypot(fish.x - f.x, fish.y - f.y) < FOOD_R + FISH_R) {
          f.collected = true;
          score += 25;
          spawnCollectParticles(f.x, f.y);
        }
      });
      food = food.filter((f) => !f.collected);

      for (const obs of obstacles) {
        if (collides(obs)) {
          spawnParticles(fish.x, fish.y);
          hiScore = Math.max(hiScore, score);
          state = 'dead';
          break;
        }
      }

      score += 0.1 * (speed / 2.6);
      frame++;
    }

    // Obstacles
    obstacles.forEach((obs) => {
      drawSprite(SP[obs.type], obs.x, obs.y, obs.t);
    });

    // Food
    food.forEach(drawFood);

    // Particles
    particles.forEach((p) => {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.92; p.vy *= 0.92;
      p.life -= 0.038;
    });
    particles = particles.filter((p) => p.life > 0);
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    particles.forEach((p) => {
      // parse base color and apply alpha
      const hex = p.color.replace('#', '');
      const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
      ctx.fillStyle = `rgba(${r},${g},${b},${p.life})`;
      ctx.fillText(p.ch, p.x, p.y);
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    // Fish
    if (state === 'playing') {
      drawSprite(SP.fish, fish.x, fish.y, frame);
    } else if (state === 'dead' && particles.length === 0) {
      drawSprite(SP.fishDead, fish.x, fish.y, 0);
    }

    drawHUD();

    if (state === 'dead' && particles.length === 0) {
      drawOverlay(
        `> score  ${String(Math.floor(score)).padStart(5, '0')}`,
        '[ space · enter · tap ] to try again',
        `your high score: ${String(Math.floor(hiScore)).padStart(5, '0')}  ·  lindy's best: 1,238`
      );
    }

    requestAnimationFrame(loop);
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  function resize() {
    canvas.width  = canvas.parentElement.offsetWidth;
    canvas.height = 280;
    if (state === 'idle') fish.y = canvas.height / 2;
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);
  resize();

  bubbles = Array.from({ length: 14 }, mkBubble);
  fish.y  = canvas.height / 2;
  loop();
})();
