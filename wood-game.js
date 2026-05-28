(function () {
  const canvas = document.getElementById('wood-game');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const shell = document.getElementById('wood-game-shell');

  const FONT = '13px JetBrains Mono, monospace';

  const C = {
    bg:    '#070910',
    grid:  'rgba(37,42,56,0.3)',
    cyan:  '#22d3ee',
    muted: '#5a6478',
    green: '#4ade80',
    purple:'#c084fc',
    bark:  '#3a1a06',
    fresh: '#d97706',
    sweet: '#fbbf24',
    axe:   '#94a3b8',
    chip:  '#a16207',
  };

  const LOG_TYPES = [
    { name: 'pine',     trunkCol: '#7c4a1e', barkCol: '#5a3212', sweetFrac: 0.28, oscSpeed: 1.0  },
    { name: 'oak',      trunkCol: '#6b3314', barkCol: '#4a220a', sweetFrac: 0.20, oscSpeed: 1.55 },
    { name: 'walnut',   trunkCol: '#52240a', barkCol: '#351608', sweetFrac: 0.16, oscSpeed: 1.9  },
    { name: 'ironwood', trunkCol: '#3a1f08', barkCol: '#261408', sweetFrac: 0.12, oscSpeed: 2.3  },
  ];

  const BASE_PTS = [5, 12, 18, 25];

  let state        = 'idle';
  let score        = 0;
  let hiScore      = 0;
  let lives        = 3;
  let streak       = 0;
  let frame        = 0;
  let particles    = [];
  let popups       = [];
  let axeAnim      = null;
  let shakeAmt     = 0;
  let indicatorPos = 0;
  let indicatorDir = 1;

  function lti() {
    if (score >= 400) return 3;
    if (score >= 200) return 2;
    if (score >= 60)  return 1;
    return 0;
  }

  function startGame() {
    score = 0; lives = 3; streak = 0; frame = 0;
    particles = []; popups = [];
    axeAnim = null; shakeAmt = 0;
    indicatorPos = 0; indicatorDir = 1;
    state = 'playing';
  }

  // ── Geometry ──────────────────────────────────────────────────────────────

  function td() {
    const cx       = canvas.width / 2;
    const groundY  = 228;
    const trunkW   = 44;
    const trunkH   = 130;
    const trunkTop = groundY - trunkH;
    const trunkCY  = trunkTop + trunkH / 2;
    const oscRange = trunkH / 2 - 16; // axe stays clear of trunk ends
    return { cx, groundY, trunkW, trunkH, trunkTop, trunkCY, oscRange };
  }

  function axeY(pos) {
    const { trunkCY, oscRange } = td();
    return trunkCY + pos * oscRange;
  }

  // ── Chop ─────────────────────────────────────────────────────────────────

  function chop() {
    if (axeAnim) return;
    const lt      = LOG_TYPES[lti()];
    const inSweet = Math.abs(indicatorPos) < lt.sweetFrac;
    const perfect = Math.abs(indicatorPos) < lt.sweetFrac * 0.4;
    axeAnim = { t: 0, hit: inSweet, perfect, pos: indicatorPos };

    if (inSweet) {
      streak++;
      const mult = streak >= 3 ? streak : 1;
      const pts  = BASE_PTS[lti()] * (perfect ? 2 : 1) * mult;
      score += pts;
      popups.push({ text: perfect ? `PERFECT  +${pts}` : `+${pts}`, life: 1.0, col: perfect ? C.sweet : C.cyan });
      spawnChips(indicatorPos, true);
    } else {
      streak = 0;
      shakeAmt = 1;
      lives--;
      popups.push({ text: 'glance', life: 1.0, col: C.muted });
      spawnChips(indicatorPos, false);
      if (lives <= 0) {
        hiScore = Math.max(hiScore, score);
        state   = 'dead';
      }
    }
  }

  function spawnChips(pos, good) {
    const { cx, trunkW } = td();
    const chipX = cx - trunkW / 2 + 4;
    const chipY = axeY(pos);
    const chars = ['/', '\\', "'", ',', '`', '*'];
    const n = good ? 22 : 6;
    for (let i = 0; i < n; i++) {
      // chips spray rightward (away from axe on left) with upward bias
      const a = (Math.random() - 0.5) * Math.PI * 1.1 - 0.2;
      const s = Math.random() * 3.5 + 1.5;
      particles.push({
        x: chipX + (Math.random() - 0.5) * 10,
        y: chipY + (Math.random() - 0.5) * 8,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 1,
        col: Math.random() > 0.5 ? C.fresh : C.chip,
        ch: chars[Math.floor(Math.random() * chars.length)],
      });
    }
  }

  // ── Drawing ──────────────────────────────────────────────────────────────

  function drawBg() {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < canvas.width; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 26) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
  }

  function drawCanopy(cx, trunkTop) {
    // Three stacked triangles = pine silhouette
    const layers = [
      { baseY: trunkTop + 12, topY: trunkTop - 46, hw: 66, col: '#14532d' },
      { baseY: trunkTop - 16, topY: trunkTop - 72, hw: 52, col: '#166534' },
      { baseY: trunkTop - 42, topY: trunkTop - 94, hw: 38, col: '#15803d' },
    ];
    layers.forEach(({ baseY, topY, hw, col }) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(cx, topY);
      ctx.lineTo(cx - hw, baseY);
      ctx.lineTo(cx + hw, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#052e16';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  function drawTrunk(lt, sweetAlpha) {
    const { cx, groundY, trunkW, trunkH, trunkTop, trunkCY, oscRange } = td();
    const lt_ = LOG_TYPES[lti()];

    // Body
    ctx.fillStyle = lt.trunkCol;
    ctx.fillRect(cx - trunkW / 2, trunkTop, trunkW, trunkH);

    // Bark texture
    ctx.strokeStyle = lt.barkCol;
    ctx.lineWidth = 1.5;
    for (let bx = cx - trunkW / 2 + 7; bx < cx + trunkW / 2 - 2; bx += 9) {
      ctx.beginPath();
      ctx.moveTo(bx, trunkTop + 2);
      ctx.lineTo(bx, groundY - 2);
      ctx.stroke();
    }

    // Outline
    ctx.strokeStyle = C.bark;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cx - trunkW / 2, trunkTop, trunkW, trunkH);

    // Sweet zone
    const zoneH   = 2 * lt_.sweetFrac * oscRange;
    const zoneTop = trunkCY - zoneH / 2;

    ctx.fillStyle = `rgba(251,191,36,${sweetAlpha * 0.42})`;
    ctx.fillRect(cx - trunkW / 2 + 1, zoneTop, trunkW - 2, zoneH);

    // Zone border lines extending outside the trunk for visibility
    const ext = 14;
    ctx.strokeStyle = `rgba(251,191,36,${sweetAlpha * 0.95})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - trunkW / 2 - ext, zoneTop);
    ctx.lineTo(cx + trunkW / 2 + ext, zoneTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - trunkW / 2 - ext, zoneTop + zoneH);
    ctx.lineTo(cx + trunkW / 2 + ext, zoneTop + zoneH);
    ctx.stroke();

    // ▶ arrow on left side pointing to sweet zone (since axe comes from left)
    const arrowX = cx - trunkW / 2 - ext - 18;
    const arrowY = trunkCY;
    ctx.fillStyle = `rgba(251,191,36,${sweetAlpha * 0.95})`;
    ctx.beginPath();
    ctx.moveTo(arrowX + 10, arrowY);
    ctx.lineTo(arrowX,      arrowY - 7);
    ctx.lineTo(arrowX,      arrowY + 7);
    ctx.closePath();
    ctx.fill();

    // Ground shadow
    ctx.strokeStyle = 'rgba(90,100,120,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY + 3);
    ctx.lineTo(canvas.width, groundY + 3);
    ctx.stroke();
  }

  function drawAxeAt(pos, lt, lunge) {
    const { cx, trunkW } = td();
    const ay      = axeY(pos);
    const inSweet = Math.abs(pos) < lt.sweetFrac;
    const col     = inSweet ? C.sweet : C.axe;

    // Axe to the left of trunk; lunge moves it right toward trunk
    const bladeX    = cx - trunkW / 2 - 6 + lunge;
    const handleLen = 84;

    // Handle (slight upward angle)
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth   = 5;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(bladeX - handleLen, ay + 10);
    ctx.lineTo(bladeX, ay - 2);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Grip knob
    ctx.fillStyle = '#5a2d0c';
    ctx.beginPath();
    ctx.ellipse(bladeX - handleLen - 2, ay + 11, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Axe head: D-shape, blade edge facing right (toward trunk)
    const s = 20;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(bladeX - s * 0.1, ay - s * 0.55);         // top-back
    ctx.bezierCurveTo(
      bladeX + s * 0.4,  ay - s * 0.85,
      bladeX + s * 0.95, ay - s * 0.4,
      bladeX + s * 0.9,  ay                               // mid-blade tip
    );
    ctx.bezierCurveTo(
      bladeX + s * 0.95, ay + s * 0.4,
      bladeX + s * 0.4,  ay + s * 0.85,
      bladeX - s * 0.1,  ay + s * 0.55                   // bottom-back
    );
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = inSweet ? '#92400e' : '#334155';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Blade-edge sheen
    ctx.strokeStyle = inSweet ? 'rgba(255,255,200,0.5)' : 'rgba(200,210,224,0.35)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(bladeX + s * 0.6, ay - s * 0.28);
    ctx.bezierCurveTo(
      bladeX + s * 0.8,  ay - s * 0.1,
      bladeX + s * 0.8,  ay + s * 0.1,
      bladeX + s * 0.6,  ay + s * 0.28
    );
    ctx.stroke();
  }

  function drawHUD(lt) {
    ctx.font         = FONT;
    ctx.textBaseline = 'top';
    ctx.textAlign    = 'right';
    ctx.fillStyle    = C.muted;
    ctx.fillText(`score  ${String(Math.floor(score)).padStart(5, '0')}`, canvas.width - 14, 12);
    if (hiScore > 0)
      ctx.fillText(`best   ${String(Math.floor(hiScore)).padStart(5, '0')}`, canvas.width - 14, 30);

    ctx.textAlign = 'left';
    ctx.fillStyle = C.green;
    ctx.fillText(`> ${lt.name}`, 14, 12);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('♥ '.repeat(lives).trim(), 14, 30);
    if (streak >= 3) {
      ctx.fillStyle = C.sweet;
      ctx.fillText(`×${streak} streak`, 14, 48);
    }

    popups.forEach((p, i) => {
      const hex = p.col.replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      ctx.font      = 'bold 18px JetBrains Mono, monospace';
      ctx.fillStyle = `rgba(${r},${g},${b},${p.life})`;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, canvas.width / 2, canvas.height / 2 - 55 - i * 26);
    });

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawOverlay(title, sub, note) {
    ctx.fillStyle = 'rgba(7,9,16,0.82)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2, cy = canvas.height / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font      = 'bold 22px JetBrains Mono, monospace';
    ctx.fillStyle = C.cyan;
    ctx.fillText(title, cx, cy - 28);
    ctx.font      = '13px JetBrains Mono, monospace';
    ctx.fillStyle = C.muted;
    ctx.fillText(sub, cx, cy + 4);
    if (note) {
      ctx.font      = '11px JetBrains Mono, monospace';
      ctx.fillStyle = C.purple;
      ctx.fillText(note, cx, cy + 26);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // ── Loop ─────────────────────────────────────────────────────────────────

  function loop() {
    const lt = LOG_TYPES[lti()];

    ctx.save();
    if (shakeAmt > 0) {
      ctx.translate(
        (Math.random() - 0.5) * shakeAmt * 5,
        (Math.random() - 0.5) * shakeAmt * 3
      );
      shakeAmt = Math.max(0, shakeAmt - 0.08);
    }
    ctx.clearRect(-10, -10, canvas.width + 20, canvas.height + 20);
    drawBg();

    if (state === 'idle') {
      const { cx, trunkTop } = td();
      drawCanopy(cx, trunkTop);
      drawTrunk(lt, 0.5 + 0.5 * Math.sin(frame * 0.045));
      drawAxeAt(0, lt, 0);
      drawOverlay('> ~/wood', '[ space · enter · tap ] to chop');
      ctx.restore();
      frame++;
      requestAnimationFrame(loop);
      return;
    }

    if (state === 'playing') {
      const spd = lt.oscSpeed * (1 + score * 0.0025);
      indicatorPos += indicatorDir * spd * 0.016;
      if (indicatorPos >= 1)  { indicatorPos =  1; indicatorDir = -1; }
      if (indicatorPos <= -1) { indicatorPos = -1; indicatorDir =  1; }
      if (axeAnim) { axeAnim.t++; if (axeAnim.t > 24) axeAnim = null; }
    }

    const { cx, trunkTop } = td();
    drawCanopy(cx, trunkTop);
    drawTrunk(lt, 0.55 + 0.45 * Math.sin(frame * 0.09));

    if (axeAnim) {
      // t 0→12: lunge in, 12→24: retract
      const prog  = axeAnim.t / 12;
      const eased = prog < 1 ? 1 - Math.pow(1 - prog, 3) : 2 - prog;
      drawAxeAt(axeAnim.pos, lt, Math.max(0, eased * 22));
    } else {
      drawAxeAt(indicatorPos, lt, 0);
    }

    // Particles
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    particles.forEach((p) => {
      const hex = p.col.replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      ctx.fillStyle = `rgba(${r},${g},${b},${p.life})`;
      ctx.fillText(p.ch, p.x, p.y);
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    particles.forEach((p) => {
      p.x  += p.vx; p.y  += p.vy;
      p.vy += 0.15;
      p.vx *= 0.93; p.vy *= 0.93;
      p.life -= 0.025;
    });
    particles = particles.filter((p) => p.life > 0);

    popups.forEach((p) => { p.life -= 0.016; });
    popups = popups.filter((p) => p.life > 0);

    drawHUD(lt);

    if (state === 'dead') {
      drawOverlay(
        `> score  ${String(Math.floor(score)).padStart(5, '0')}`,
        '[ space · enter · tap ] to try again',
        score >= hiScore && score > 0
          ? 'new best!'
          : (hiScore > 0 ? `your best: ${String(Math.floor(hiScore)).padStart(5, '0')}` : null)
      );
    }

    ctx.restore();
    frame++;
    requestAnimationFrame(loop);
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (!shell || !shell.classList.contains('revealed')) return;
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    if (state !== 'playing') { startGame(); return; }
    e.preventDefault();
    chop();
  });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (state !== 'playing') startGame();
    else chop();
  }, { passive: false });

  // ── Resize ────────────────────────────────────────────────────────────────

  function resize() {
    canvas.width  = canvas.parentElement.offsetWidth;
    canvas.height = 280;
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);
  resize();

  loop();
})();
