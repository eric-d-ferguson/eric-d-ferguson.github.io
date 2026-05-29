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
    // Four stacked tiers, each wider and lower, with edge highlights
    const layers = [
      { baseY: trunkTop + 18, topY: trunkTop - 30, hw: 58, col: '#166534', hi: '#22c55e' },
      { baseY: trunkTop - 10, topY: trunkTop - 58, hw: 44, col: '#15803d', hi: '#4ade80' },
      { baseY: trunkTop - 34, topY: trunkTop - 78, hw: 32, col: '#166534', hi: '#22c55e' },
      { baseY: trunkTop - 56, topY: trunkTop - 94, hw: 22, col: '#14532d', hi: '#16a34a' },
    ];
    layers.forEach(({ baseY, topY, hw, col, hi }) => {
      // Shadow fill
      ctx.fillStyle = '#052e16';
      ctx.beginPath();
      ctx.moveTo(cx, topY + 4);
      ctx.lineTo(cx - hw, baseY + 3);
      ctx.lineTo(cx + hw, baseY + 3);
      ctx.closePath();
      ctx.fill();
      // Main fill
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(cx, topY);
      ctx.lineTo(cx - hw, baseY);
      ctx.lineTo(cx + hw, baseY);
      ctx.closePath();
      ctx.fill();
      // Left-face highlight (light hits from right, left face is lit)
      ctx.fillStyle = hi;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.moveTo(cx, topY);
      ctx.lineTo(cx - hw, baseY);
      ctx.lineTo(cx, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function drawTrunk(lt, sweetAlpha) {
    const { cx, groundY, trunkW, trunkH, trunkTop, trunkCY, oscRange } = td();
    const lt_ = LOG_TYPES[lti()];

    // Tapered trunk: slightly wider at base
    const topW  = trunkW;
    const botW  = trunkW + 10;

    ctx.fillStyle = lt.trunkCol;
    ctx.beginPath();
    ctx.moveTo(cx - topW / 2, trunkTop);
    ctx.lineTo(cx + topW / 2, trunkTop);
    ctx.lineTo(cx + botW / 2, groundY);
    ctx.lineTo(cx - botW / 2, groundY);
    ctx.closePath();
    ctx.fill();

    // Right-side shadow
    ctx.fillStyle = lt.barkCol;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(cx + topW * 0.15, trunkTop);
    ctx.lineTo(cx + topW / 2,    trunkTop);
    ctx.lineTo(cx + botW / 2,    groundY);
    ctx.lineTo(cx + botW * 0.15, groundY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Horizontal bark rings
    ctx.strokeStyle = lt.barkCol;
    ctx.lineWidth = 1;
    for (let gy = trunkTop + 14; gy < groundY - 4; gy += 18) {
      const frac  = (gy - trunkTop) / trunkH;
      const halfW = topW / 2 + (botW - topW) / 2 * frac;
      ctx.beginPath();
      ctx.moveTo(cx - halfW + 2, gy);
      ctx.bezierCurveTo(cx - halfW / 2, gy + 4, cx + halfW / 2, gy + 4, cx + halfW - 2, gy);
      ctx.stroke();
    }

    // Outline
    ctx.strokeStyle = C.bark;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - topW / 2, trunkTop);
    ctx.lineTo(cx + topW / 2, trunkTop);
    ctx.lineTo(cx + botW / 2, groundY);
    ctx.lineTo(cx - botW / 2, groundY);
    ctx.closePath();
    ctx.stroke();

    // Sweet zone
    const zoneH   = 2 * lt_.sweetFrac * oscRange;
    const zoneTop = trunkCY - zoneH / 2;

    ctx.fillStyle = `rgba(251,191,36,${sweetAlpha * 0.35})`;
    ctx.fillRect(cx - topW / 2, zoneTop, topW, zoneH);

    // Zone border lines extending outside the trunk
    const ext = 14;
    ctx.strokeStyle = `rgba(251,191,36,${sweetAlpha * 0.9})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(cx - topW / 2 - ext, zoneTop);
    ctx.lineTo(cx + topW / 2 + ext, zoneTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - topW / 2 - ext, zoneTop + zoneH);
    ctx.lineTo(cx + topW / 2 + ext, zoneTop + zoneH);
    ctx.stroke();
    ctx.setLineDash([]);

    // ▶ arrow pointing to sweet zone
    const arrowX = cx - topW / 2 - ext - 18;
    const arrowY = trunkCY;
    ctx.fillStyle = `rgba(251,191,36,${sweetAlpha * 0.95})`;
    ctx.beginPath();
    ctx.moveTo(arrowX + 10, arrowY);
    ctx.lineTo(arrowX,      arrowY - 7);
    ctx.lineTo(arrowX,      arrowY + 7);
    ctx.closePath();
    ctx.fill();

    // Ground shadow ellipse
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, groundY + 4, botW / 2 + 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAxeAt(pos, lt, lunge) {
    const { cx, trunkW } = td();
    const ay      = axeY(pos);
    const inSweet = Math.abs(pos) < lt.sweetFrac;
    const steelCol  = inSweet ? '#fbbf24' : '#b0bec5';
    const steelHi   = inSweet ? '#fef08a' : '#eceff1';
    const steelSide = inSweet ? '#92400e' : '#546e7a';

    // bitX = right edge of axe head (cutting edge, nearest tree)
    const bitX  = cx - trunkW / 2 - 10 + lunge;

    // Head dimensions — classic felling axe proportions:
    //   bit (cutting edge) is tall and sits on the right
    //   head widens from eye/poll toward the bit
    //   top edge sweeps forward-upward (toe), bottom sweeps forward-downward (heel)
    const bitH    = 46;  // total height of cutting edge
    const headW   = 34;  // depth of head (poll to bit)
    const pollH   = 14;  // height of poll face (much shorter than bit)

    const toeX  = bitX,      toeY  = ay - bitH / 2;   // top of cutting edge
    const heelX = bitX,      heelY = ay + bitH / 2;   // bottom of cutting edge
    const pollX = bitX - headW;
    const pollTopY = ay - pollH / 2;
    const pollBotY = ay + pollH / 2;

    // Control points for the sweeping top/bottom edges
    // Top edge: from pollTop → curves outward → toe  (convex upward)
    const topCtlX = pollX + headW * 0.55, topCtlY = toeY - 6;
    // Bottom edge: from pollBot → curves outward → heel (convex downward)
    const botCtlX = pollX + headW * 0.55, botCtlY = heelY + 6;

    // ── Handle (haft) ────────────────────────────────────────────────
    // Runs through eye (middle of head), extends ~90px to the left with slight downward belly
    const eyeX = pollX + 8;
    const eyeY = ay;
    const buttX = eyeX - 86;
    const buttY = eyeY + 14;  // slight downward belly

    // Shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth   = 9;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(buttX + 2, buttY + 3);
    ctx.quadraticCurveTo(eyeX - 36 + 2, eyeY + 8 + 3, eyeX + 2, eyeY + 3);
    ctx.stroke();

    // Haft body — gradient from dark end to lighter grip area
    const haftGrad = ctx.createLinearGradient(buttX, eyeY, buttX + 10, eyeY);
    haftGrad.addColorStop(0,   '#5a2008');
    haftGrad.addColorStop(0.5, '#9a4a1c');
    haftGrad.addColorStop(1,   '#7a3612');
    ctx.strokeStyle = haftGrad;
    ctx.lineWidth   = 7;
    ctx.beginPath();
    ctx.moveTo(buttX, buttY);
    ctx.quadraticCurveTo(eyeX - 36, eyeY + 8, eyeX, eyeY);
    ctx.stroke();

    // Grain lines on handle
    ctx.strokeStyle = 'rgba(60,20,5,0.45)';
    ctx.lineWidth   = 1;
    for (let t = 0.15; t < 0.85; t += 0.2) {
      const hx = buttX + (eyeX - buttX) * t;
      const hy = buttY + (eyeY - buttY) * t + 6 * Math.sin(Math.PI * t);
      ctx.beginPath();
      ctx.moveTo(hx - 4, hy - 2); ctx.lineTo(hx + 4, hy + 2); ctx.stroke();
    }

    // Palm swell (knob at butt end)
    ctx.fillStyle = '#5a2008';
    ctx.beginPath();
    ctx.ellipse(buttX, buttY, 6, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a1205';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.lineCap = 'butt';

    // ── Axe head ────────────────────────────────────────────────────
    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.moveTo(pollX + 3,  pollTopY + 3);
    ctx.quadraticCurveTo(topCtlX + 3, topCtlY + 3, toeX + 3, toeY + 3);
    ctx.lineTo(heelX + 3, heelY + 3);
    ctx.quadraticCurveTo(botCtlX + 3, botCtlY + 3, pollX + 3, pollBotY + 3);
    ctx.closePath();
    ctx.fill();

    // Main head — steel face (lighter, facing viewer)
    ctx.fillStyle = steelCol;
    ctx.beginPath();
    ctx.moveTo(pollX,  pollTopY);
    ctx.quadraticCurveTo(topCtlX, topCtlY, toeX, toeY);   // top sweep to toe
    ctx.lineTo(heelX, heelY);                               // cutting edge (bit)
    ctx.quadraticCurveTo(botCtlX, botCtlY, pollX, pollBotY); // bottom sweep to heel
    ctx.closePath();
    ctx.fill();

    // Top bevel — slightly lighter upper half to show the cheek
    const bevelGrad = ctx.createLinearGradient(pollX, pollTopY, pollX, ay);
    bevelGrad.addColorStop(0, inSweet ? 'rgba(255,240,100,0.45)' : 'rgba(220,230,240,0.45)');
    bevelGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bevelGrad;
    ctx.beginPath();
    ctx.moveTo(pollX,  pollTopY);
    ctx.quadraticCurveTo(topCtlX, topCtlY, toeX, toeY);
    ctx.lineTo(bitX, ay);
    ctx.lineTo(pollX, ay);
    ctx.closePath();
    ctx.fill();

    // Head outline
    ctx.strokeStyle = steelSide;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(pollX,  pollTopY);
    ctx.quadraticCurveTo(topCtlX, topCtlY, toeX, toeY);
    ctx.lineTo(heelX, heelY);
    ctx.quadraticCurveTo(botCtlX, botCtlY, pollX, pollBotY);
    ctx.closePath();
    ctx.stroke();

    // Poll face (flat back of head) — darker to look like the back face
    ctx.fillStyle = steelSide;
    ctx.fillRect(pollX - 5, pollTopY, 6, pollBotY - pollTopY);
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 1;
    ctx.strokeRect(pollX - 5, pollTopY, 6, pollBotY - pollTopY);

    // Cutting edge glint — thin bright line right on the bit
    ctx.strokeStyle = steelHi;
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(toeX, toeY + 5);
    ctx.lineTo(heelX, heelY - 5);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Eye hole — oval where handle passes through head
    ctx.fillStyle = inSweet ? '#78350f' : '#1c2833';
    ctx.beginPath();
    ctx.ellipse(eyeX + 4, eyeY, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = steelSide;
    ctx.lineWidth = 1;
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
