/* financial-levels.js — the Four Pillars of your wealth.
   A premium architectural metaphor that replaces the original 8-bit
   game. Each "world" (Cashflow, Protection, Future, Legacy) keeps its
   slider inputs and compute() maths; only the scene renderer changes —
   a classical colonnade of four pillars whose gold-light fill tracks
   each pillar's readiness score, with an engraved line-art owl
   perched on the lintel as the mood messenger.

   Adding a fifth world is still one registerLevel() call — Owl.js and
   FinancialEngine.js stay untouched. The engine is upgraded to render
   at full canvas backing resolution (no pixelation) so the line art
   stays crisp. */

(function () {
  "use strict";

  var canvas = document.getElementById("journeyCanvas");
  if (!canvas || !canvas.getContext || !window.Owl || !window.FinancialEngine) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var owl = new Owl();
  var engine = new FinancialEngine({ canvas: canvas, mascot: owl, reducedMotion: reduced });
  var money = FinancialEngine.money;

  /* Upgrade the engine to render at the canvas's native CSS pixel
     resolution with antialiasing, so the colonnade's engraved line-art
     stays crisp. The render loop, particle system and metric easing
     are untouched. */
  engine._resize = function () {
    var cw = this.canvas.clientWidth || 640;
    var ch = this.canvas.clientHeight || 420;
    this.scale = 1;
    this.w = Math.max(160, Math.floor(cw));
    this.h = Math.max(160, Math.floor(ch));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx.imageSmoothingEnabled = true;
    if (this.reduced && this.level) this._renderFrame(0);
  };
  engine._resize();

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, k) { return a + (b - a) * k; }

  /* ---------- premium palette ---------- */
  var INK = "#0b1f1a", INK_SOFT = "#12302a";
  var CREAM = "#f6f1e7", CREAM_DEEP = "#ede5d4";
  var GOLD = "#c9a14a", GOLD_SOFT = "#e0c98c", GOLD_DEEP = "#7a5a1e";
  var RUST = "#d07a5e", TEAL = "#9fd8c4";
  var SERIF = '"Fraunces", Georgia, serif';
  var SANS = '"Instrument Sans", -apple-system, sans-serif';

  function rmShort(v) {
    v = Math.round(v);
    if (v >= 1e6) return "RM" + (Math.round(v / 1e5) / 10) + "M";
    if (v >= 1e4) return "RM" + Math.round(v / 1e3) + "K";
    if (v >= 1e3) return "RM" + (Math.round(v / 100) / 10) + "K";
    return "RM" + v;
  }

  /* Cached per-world readiness scores and tones, so all four pillars
     can render with their live fill heights even when only one is the
     active world. Seeded with each world's default-computed score and
     updated on every state event. */
  var progress = {};
  var tones = {};
  var ROMAN = ["I", "II", "III", "IV", "V", "VI"];

  function toneColor(tone) {
    if (tone === "green") return TEAL;
    if (tone === "red") return RUST;
    return GOLD;
  }

  /* ============================================================
     THE COLONNADE — the single shared scene renderer.
     Every world's scene.draw calls into this; only the highlighted
     (active) pillar changes. Pillar i maps to engine.order[i].
     ============================================================ */

  function drawColonnade(g) {
    var ctx = g.ctx, w = g.w, h = g.h;
    var activeIdx = engine.order.indexOf(engine.levelId);
    if (activeIdx < 0) activeIdx = 0;

    // --- background: deep ink-green wash with a soft top vignette ---
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0a1f1a");
    bg.addColorStop(0.55, "#0b2620");
    bg.addColorStop(1, "#07171210");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // faint paper grain via two diagonal hairline passes (cheap)
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 0.5;
    for (var i = 0; i < w; i += 7) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i + h, h);
      ctx.stroke();
    }
    ctx.restore();

    // --- geometry ---
    var padX = Math.max(20, w * 0.06);
    var stageW = w - padX * 2;
    var nPillars = engine.order.length;
    var pillarW = Math.max(38, Math.min(72, stageW * 0.13));
    var gap = (stageW - pillarW * nPillars) / (nPillars - 1);
    var pillarTopY = Math.round(h * 0.34);
    var pillarBotY = Math.round(h * 0.86);
    var pillarH = pillarBotY - pillarTopY;
    var lintelH = Math.max(34, h * 0.10);
    var lintelTopY = pillarTopY - lintelH;
    var lintelBotY = pillarTopY;
    var groundY = Math.round(h * 0.91);

    // pillar x centres
    var centres = [];
    for (var p = 0; p < nPillars; p++) {
      centres.push(padX + pillarW / 2 + p * (pillarW + gap));
    }

    // --- gold motes drifting up inside filled pillars ---
    if (!g.reduced && g.dt) {
      engine.order.forEach(function (id, i) {
        var isActive = i === activeIdx;
        var st = isActive ? g.state : null;
        var score = isActive ? (g.state && g.state.score) : progress[id];
        if (score == null) score = 0;
        var tone = isActive ? (g.state && g.state.power && g.state.power.tone) : tones[id];
        if (score < 8) return;
        var spawnChance = Math.min(0.18, score / 600) * (isActive ? 1.4 : 0.7);
        if (Math.random() < spawnChance) {
          var cx = centres[i];
          var fillTop = pillarBotY - (score / 100) * pillarH;
          g.particles.spawn({
            x: cx + (Math.random() - 0.5) * pillarW * 0.55,
            y: pillarBotY - 2 - Math.random() * 4,
            vx: (Math.random() - 0.5) * 6,
            vy: -12 - Math.random() * 18,
            g: -2,
            size: 1.4 + Math.random() * 1.4,
            life: 1.4 + Math.random() * 0.6,
            color: toneColor(tone) || GOLD_SOFT,
            alpha: 0.85,
            update: function (pt) {
              // fade out as it passes the fill line
              if (pt.y < fillTop) pt.life = Math.min(pt.life, pt.age + 0.25);
            }
          });
        }
      });
    }

    // --- the ground line: a thin cream-deep rule across the stage ---
    ctx.save();
    ctx.strokeStyle = "rgba(237,229,212,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX * 0.4, groundY);
    ctx.lineTo(w - padX * 0.4, groundY);
    ctx.stroke();
    ctx.restore();

    // --- draw each pillar (back to front: shaft, fill, capital, base) ---
    engine.order.forEach(function (id, i) {
      drawPillar(ctx, centres[i], pillarTopY, pillarBotY, pillarW, {
        score: (i === activeIdx ? (g.state && g.state.score) : progress[id]) || 0,
        tone: i === activeIdx ? (g.state && g.state.power && g.state.power.tone) : tones[id],
        active: i === activeIdx,
        reduced: g.reduced,
        t: g.t
      });
    });

    // --- cracks: ink hairlines that propagate from weak pillars
    //     (<25% score) up into the lintel above them ---
    engine.order.forEach(function (id, i) {
      var score = (i === activeIdx ? (g.state && g.state.score) : progress[id]) || 0;
      if (score >= 25) return;
      drawCrack(ctx, centres[i], pillarTopY, lintelTopY, pillarW, score, g.t, g.reduced);
    });

    // --- the lintel (roof beam) drawn over the pillar tops ---
    drawLintel(ctx, padX, lintelTopY, stageW, lintelH, w, {
      activeIdx: activeIdx,
      weakCount: engine.order.reduce(function (n, id, i) {
        var sc = (i === activeIdx ? (g.state && g.state.score) : progress[id]) || 0;
        return n + (sc < 25 ? 1 : 0);
      }, 0),
      reduced: g.reduced,
      t: g.t
    });

    // --- the owl perched on top of the lintel, slightly above centre ---
    var owlSize = Math.min(lintelH * 1.05, pillarW * 1.05, h * 0.20);
    var owlCX = w / 2;
    var owlPerchY = lintelTopY - 2;
    owl.draw(ctx, owlCX, owlPerchY, owlSize, {});

    // --- pillar labels + score numerals below the colonnade ---
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    engine.order.forEach(function (id, i) {
      var def = engine.levels[id];
      var score = (i === activeIdx ? (g.state && g.state.score) : progress[id]) || 0;
      var isActive = i === activeIdx;
      var cx = centres[i];
      var labelY = pillarBotY + Math.max(18, h * 0.055);
      var scoreY = labelY + Math.max(16, h * 0.045);

      // category name (small caps, sans)
      ctx.save();
      ctx.font = "600 " + Math.max(9, Math.round(w * 0.014)) + "px " + SANS;
      ctx.fillStyle = isActive ? GOLD_SOFT : "rgba(237,229,212,0.62)";
      ctx.letterSpacing = "0.18em";
      var name = (def.name || "").toUpperCase();
      ctx.fillText(name, cx, labelY);
      ctx.restore();

      // score (Fraunces italic, gold when strong, muted when weak)
      ctx.save();
      ctx.font = "italic 500 " + Math.max(15, Math.round(w * 0.024)) + "px " + SERIF;
      ctx.fillStyle = isActive
        ? (score >= 75 ? GOLD_SOFT : score < 25 ? "#e39a86" : "rgba(242,236,224,0.92)")
        : "rgba(224,201,140,0.55)";
      ctx.fillText(Math.round(score) + "%", cx, scoreY);
      ctx.restore();
    });

    // --- the Roman pillar number, engraved at the top of each capital ---
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    engine.order.forEach(function (id, i) {
      var cx = centres[i];
      var numY = pillarTopY - lintelH * 0.5;
      ctx.font = "italic 500 " + Math.max(11, Math.round(w * 0.018)) + "px " + SERIF;
      ctx.fillStyle = i === activeIdx ? GOLD_SOFT : "rgba(224,201,140,0.45)";
      ctx.fillText(ROMAN[i] || (i + 1), cx, numY);
    });
    ctx.restore();
  }

  /* ---------- a single pillar ---------- */
  function drawPillar(ctx, cx, topY, botY, width, opts) {
    var score = clamp(opts.score || 0, 0, 100);
    var tone = opts.tone;
    var active = opts.active;
    var t = opts.t;
    var reduced = opts.reduced;
    var fill = toneColor(tone);
    var x0 = Math.round(cx - width / 2);
    var x1 = Math.round(cx + width / 2);
    var w = width;
    var pillarH = botY - topY;

    // active glow halo behind the pillar
    if (active) {
      var halo = ctx.createRadialGradient(cx, (topY + botY) / 2, 2, cx, (topY + botY) / 2, w * 1.4);
      halo.addColorStop(0, "rgba(201,161,74,0.22)");
      halo.addColorStop(0.6, "rgba(201,161,74,0.08)");
      halo.addColorStop(1, "rgba(201,161,74,0)");
      ctx.save();
      ctx.fillStyle = halo;
      ctx.fillRect(x0 - w * 0.6, topY - 8, w * 2.2, pillarH + 16);
      ctx.restore();
    }

    // shaft body: cream stone with a soft inner shadow
    var shaftGrad = ctx.createLinearGradient(x0, 0, x1, 0);
    shaftGrad.addColorStop(0, "#e8dfca");
    shaftGrad.addColorStop(0.15, CREAM);
    shaftGrad.addColorStop(0.55, CREAM);
    shaftGrad.addColorStop(1, "#d9cfb6");
    ctx.fillStyle = shaftGrad;
    ctx.fillRect(x0, topY, w, pillarH);

    // gold-light fill from the base up, height = score%
    if (score > 0.5) {
      var fillH = Math.max(2, (score / 100) * pillarH);
      var fillTop = botY - fillH;
      var fillGrad = ctx.createLinearGradient(0, botY, 0, fillTop);
      fillGrad.addColorStop(0, fill);
      fillGrad.addColorStop(0.7, fill === TEAL ? "#b9e4d4" : (fill === RUST ? "#e8a896" : GOLD_SOFT));
      fillGrad.addColorStop(1, "rgba(246,231,189,0.85)");
      ctx.save();
      ctx.fillStyle = fillGrad;
      ctx.fillRect(x0 + 2, fillTop, w - 4, fillH);
      // surface ripple — a soft sine wave along the fill top
      if (!reduced) {
        ctx.strokeStyle = "rgba(246,231,189,0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var rx = x0 + 2; rx <= x1 - 2; rx += 2) {
          var ry = fillTop + Math.sin(t * 2.2 + rx * 0.18) * 0.9;
          if (rx === x0 + 2) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // fluting: 3 thin vertical inner channels for a classical look
    ctx.save();
    ctx.strokeStyle = "rgba(11,31,26,0.10)";
    ctx.lineWidth = 0.8;
    for (var f = -1; f <= 1; f++) {
      var fx = cx + f * (w * 0.22);
      ctx.beginPath();
      ctx.moveTo(Math.round(fx), topY + 2);
      ctx.lineTo(Math.round(fx), botY - 2);
      ctx.stroke();
    }
    ctx.restore();

    // pillar outline (thin gold)
    ctx.save();
    ctx.strokeStyle = active ? GOLD : "rgba(201,161,74,0.55)";
    ctx.lineWidth = active ? 2 : 1.2;
    ctx.strokeRect(x0 + 0.5, topY + 0.5, w - 1, pillarH - 1);
    ctx.restore();

    // base plinth: a slightly wider block at the bottom
    var plinthH = Math.max(8, pillarH * 0.06);
    var plinthOverhang = 4;
    ctx.fillStyle = CREAM_DEEP;
    ctx.fillRect(x0 - plinthOverhang, botY - plinthH, w + plinthOverhang * 2, plinthH);
    ctx.save();
    ctx.strokeStyle = "rgba(11,31,26,0.30)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - plinthOverhang + 0.5, botY - plinthH + 0.5, w + plinthOverhang * 2 - 1, plinthH - 1);
    ctx.restore();

    // capital: a wider block at the top with a thin gold abacus
    var capH = Math.max(10, pillarH * 0.08);
    var capOverhang = 6;
    ctx.fillStyle = CREAM_DEEP;
    ctx.fillRect(x0 - capOverhang, topY, w + capOverhang * 2, capH);
    ctx.fillStyle = "rgba(201,161,74,0.85)";
    ctx.fillRect(x0 - capOverhang, topY, w + capOverhang * 2, 2);
    ctx.save();
    ctx.strokeStyle = "rgba(11,31,26,0.30)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - capOverhang + 0.5, topY + 0.5, w + capOverhang * 2 - 1, capH - 1);
    ctx.restore();
  }

  /* ---------- lintel (roof beam) with engraved title ---------- */
  function drawLintel(ctx, padX, topY, stageW, h, totalW, opts) {
    var botY = topY + h;
    var left = padX - 8;
    var right = padX + stageW + 8;
    var width = right - left;

    // beam body: cream stone
    var grad = ctx.createLinearGradient(0, topY, 0, botY);
    grad.addColorStop(0, CREAM);
    grad.addColorStop(0.5, "#f1e8d4");
    grad.addColorStop(1, CREAM_DEEP);
    ctx.fillStyle = grad;
    ctx.fillRect(left, topY, width, h);

    // thin gold border
    ctx.save();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(left + 0.5, topY + 0.5, width - 1, h - 1);
    // inner gold filigree line
    ctx.strokeStyle = "rgba(201,161,74,0.45)";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(left + 4, topY + 4, width - 8, h - 8);
    ctx.restore();

    // cracks from weak pillars already drawn under the lintel;
    // tint the beam edge above weak pillars with a rust shadow
    if (opts.weakCount > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.35, 0.10 + opts.weakCount * 0.10);
      ctx.fillStyle = RUST;
      ctx.fillRect(left, botY - 2, width, 2);
      ctx.restore();
    }

    // engraved title — "YOUR FINANCIAL FOUNDATION"
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var cy = topY + h * 0.50;
    var fontSize = Math.max(11, Math.min(20, totalW * 0.024));
    ctx.font = "500 " + fontSize + "px " + SERIF;
    // engraved look: shadow offset + gold fill
    ctx.fillStyle = "rgba(11,31,26,0.30)";
    ctx.fillText("YOUR FINANCIAL FOUNDATION", totalW / 2 + 0.6, cy + 0.6);
    ctx.fillStyle = GOLD_DEEP;
    ctx.fillText("YOUR FINANCIAL FOUNDATION", totalW / 2, cy);
    ctx.restore();

    // small gold fleuron on each side of the title
    ctx.save();
    ctx.fillStyle = GOLD;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "italic " + Math.max(12, fontSize * 1.1) + "px " + SERIF;
    var sideGap = Math.min(totalW * 0.18, 110);
    ctx.fillText("◆", totalW / 2 - sideGap, cy);
    ctx.fillText("◆", totalW / 2 + sideGap, cy);
    ctx.restore();
  }

  /* ---------- hairline cracks from a weak pillar into the lintel ---------- */
  function drawCrack(ctx, cx, pillarTopY, lintelTopY, pillarW, score, t, reduced) {
    // lower score → taller, more branches, more visible
    var severity = clamp((25 - score) / 25, 0, 1);
    if (severity < 0.02) return;
    var crackH = (pillarTopY - lintelTopY) * (0.25 + severity * 0.75) + severity * 8;
    var startX = cx + (Math.random() - 0.5) * pillarW * 0.2;
    var startY = pillarTopY - 1;
    var endY = pillarTopY - crackH;

    ctx.save();
    ctx.strokeStyle = "rgba(11,31,26," + (0.45 + severity * 0.45).toFixed(2) + ")";
    ctx.lineWidth = 0.9 + severity * 0.6;
    ctx.lineCap = "round";

    // main jagged crack
    var segs = 5 + Math.round(severity * 3);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    var px = startX, py = startY;
    // deterministic shape from cx so it doesn't wiggle each frame
    var seed = cx * 0.13;
    for (var s = 1; s <= segs; s++) {
      var k = s / segs;
      var ny = startY - crackH * k;
      var jitter = (Math.sin(seed + s * 1.7) + Math.cos(seed + s * 2.3)) * (pillarW * 0.10) * (1 - k * 0.4);
      var nx = cx + jitter;
      ctx.lineTo(nx, ny);
      px = nx; py = ny;
    }
    ctx.stroke();

    // one short branch for severe cracks
    if (severity > 0.55) {
      var branchAt = segs * 0.55;
      var bx = cx + Math.sin(seed + 4) * pillarW * 0.12;
      var by = startY - crackH * (branchAt / segs);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + pillarW * 0.18, by - crackH * 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ============================================================
     PILLAR I — Cashflow: the coin pipes
     (Inputs and compute() maths unchanged from the original world.
      Only the scene renderer is new — all four pillars share the
      drawColonnade() function above.)
     ============================================================ */

  engine.registerLevel("budget", {
    name: "Cashflow",
    title: "Pillar I · The Coin Pipes",
    inputs: [
      { key: "income", group: "INFLOW · The Coin Pool", label: "Monthly Take-Home Pay", min: 1000, max: 20000, step: 100, value: 5000, fmt: "money", base: true },
      { key: "fixed", group: "OUTFLOW · The Drain Pipes & Blocks", label: "Fixed Commitments", sub: "(Rent, Insurance, Utilities, Bills)", min: 0, max: 20000, step: 100, value: 1500, fmt: "money", scaleWith: "income", maxFactor: 1.2 },
      { key: "debt", label: "Debt Repayments", sub: "(Car/Housing Loans, Credit Cards, PTPTN)", min: 0, max: 20000, step: 100, value: 800, fmt: "money", scaleWith: "income", maxFactor: 1.2 },
      { key: "other", label: "Other Spending", sub: "(Food, Lifestyle, Entertainment, Shopping)", min: 0, max: 20000, step: 100, value: 1500, fmt: "money", scaleWith: "income", maxFactor: 1.2 }
    ],
    compute: function (v) {
      // --- real-time cashflow maths -------------------------------------
      var totalExpenses = v.fixed + v.debt + v.other;
      var surplus = v.income - totalExpenses;
      var surplusPct = v.income > 0 ? (surplus / v.income) * 100 : 0;
      var dti = v.income > 0 ? (v.debt / v.income) * 100 : 0;
      var rate = v.income > 0 ? surplus / v.income : 0;
      var pctR = Math.round(surplusPct);
      var dtiR = Math.round(dti);

      // --- dynamic Capy commentary matrix (priority order) --------------
      var mood, say, coach, headline;
      if (dti > 35) {
        mood = "concerned";
        say = "Debt pipes are draining us!";
        coach = "Your Debt-to-Income ratio is sitting at " + dtiR + "%. Those debt drain "
          + "pipes are taking a massive bite out of your coins. Focus on a debt-busting "
          + "strategy first to free up your cashflow power-up!";
        headline = "Debt eats " + dtiR + "% of your take-home pay.";
      } else if (surplus < 0) {
        mood = "concerned";
        say = "The pipe eats everything!";
        coach = "Warning: Outflow exceeds inflow! Your capy is running on a deficit of "
          + money(Math.abs(surplus)) + " this month. You're dipping into reserves or "
          + "relying on credit cards. Time to slide back on 'Other Spending' to find a "
          + "sustainable balance.";
        headline = "You overspend by " + money(Math.abs(surplus)) + " every month.";
      } else if (surplusPct >= 20) {
        mood = "joyful";
        say = "LEVEL UP! WE'RE GROWING!";
        coach = "You have a healthy surplus of " + pctR + "% (" + money(surplus) + ") "
          + "remaining this month! This is a textbook gold standard. Your capy is in a "
          + "prime position to route these extra coins into the Protection or Future "
          + "Funds tabs above!";
        headline = "You bank " + money(surplus) + " a month — a " + pctR + "% surplus.";
      } else {
        mood = "stable";
        say = "Steady lah — mind the gap.";
        coach = "You have a positive surplus of " + pctR + "% (" + money(surplus) + "), "
          + "but room for error is tight. A small unexpected expense could stall your "
          + "capy. Look closely at your 'Other Spending' slider to see where you can trim "
          + "some fat.";
        headline = "A slim " + pctR + "% surplus (" + money(surplus) + ") this month.";
      }

      // --- POWER bar: tied directly to surplus percentage ---------------
      // 0% or negative → empty + red; 20%+ → full + green glow.
      var powerPct = clamp((surplusPct / 20) * 100, 0, 100);
      var tone = surplus <= 0 ? "red" : surplusPct >= 20 ? "green" : "gold";

      return {
        mood: mood,
        score: Math.round(powerPct),
        stat: (surplus >= 0 ? "+" : "−") + rmShort(Math.abs(surplus)),
        headline: headline,
        coach: coach,
        say: say,
        power: { pct: powerPct, tone: tone },
        metrics: {
          rate: clamp(rate, -0.5, 0.6),
          savings: Math.max(0, surplus),
          spendShare: clamp(v.income > 0 ? totalExpenses / v.income : 1.5, 0, 1.5)
        }
      };
    },
    scene: {
      draw: function (g) {
        drawColonnade(g);
      }
    }
  });

  /* ============================================================
     PILLAR II — Protection: the brick shield
     ============================================================ */

  /* shared global money state — Pillar I and Pillar II read & write the
     SAME income, so moving the slider in one pillar moves it in the other.
     (Pillar II now models liabilities explicitly via its own mortgage /
     non-mortgage sliders, so it no longer borrows Pillar I's debt figure.) */
  var GLOBAL = { income: 5000, debt: 800 };
  var insurancePhase = 0;                 // 0 = Brick Shield form · 1 = Force Field form

  var FULL_MED = 1000000;                  // RM 1M annual limit = a maxed force field

  engine.registerLevel("insurance", {
    name: "Protection",
    title: "Pillar II · The Brick Shield",
    // two progressive input forms, toggled by one elegant button. The
    // colonnade always shows all four pillars; only the form + title swap.
    phases: [
      { title: "The Brick Shield", cta: "Check Health Protection" },
      { title: "The Force Field", cta: "Back to Life Cover" }
    ],
    inputs: [
      { key: "income", group: "PHASE 1: LIFE PROTECTION", phase: 0, label: "Monthly income", sub: "(Synced with Pillar I)", min: 1000, max: 30000, step: 100, value: 5000, fmt: "money" },
      { key: "mortgage", group: "PHASE 1: LIFE PROTECTION", phase: 0, label: "Outstanding mortgage debt", min: 0, max: 1500000, step: 10000, value: 300000, fmt: "money" },
      { key: "mrta", group: "PHASE 1: LIFE PROTECTION", phase: 0, label: "My mortgage is covered by MRTA / MLTA", type: "toggle", value: 0 },
      { key: "nonmortgage", group: "PHASE 1: LIFE PROTECTION", phase: 0, label: "Outstanding non-mortgage debt", sub: "(Car, cards, PTPTN)", min: 0, max: 500000, step: 5000, value: 50000, fmt: "money" },
      { key: "deps", group: "PHASE 1: LIFE PROTECTION", phase: 0, label: "Dependants", sub: "(People relying on you)", min: 0, max: 3, step: 1, value: 2, fmt: "deps" },
      { key: "cover", group: "PHASE 1: LIFE PROTECTION", phase: 0, label: "Existing life / takaful cover", min: 0, max: 2000000, step: 10000, value: 100000, fmt: "money" },
      { key: "medlimit", group: "PHASE 2: HEALTH PROTECTION", phase: 1, label: "Annual medical card limit", sub: "(RM 0 = no medical card)", min: 0, max: 2000000, step: 100000, value: 500000, fmt: "money" },
      { key: "ciactive", group: "PHASE 2: HEALTH PROTECTION", phase: 1, label: "Critical illness policy active", type: "toggle", value: 0 }
    ],
    compute: function (v) {
      var income = v.income;
      var deps = Math.round(v.deps);
      var phase = v.phase ? 1 : 0;
      var depWord = deps >= 3 ? "3+" : String(deps);

      // ---- PHASE 1 · liabilities + income replacement (the brick shield) ----
      var mrta = v.mrta ? 1 : 0;
      var adjustedMortgage = mrta ? 0 : v.mortgage;              // MRTA settles the mortgage
      var totalLiabilities = adjustedMortgage + v.nonmortgage;
      var incomeReplace = deps <= 0 ? 0 : deps === 1 ? income * 12 * 7 : income * 12 * 10;
      var target = incomeReplace + totalLiabilities;
      var cover = v.cover;
      var lifeRatio = target > 0 ? cover / target : 1;
      var gap = Math.max(0, target - cover);

      // ---- PHASE 2 · medical card limit (the force field) ----
      var medlimit = v.medlimit;
      var ciActive = v.ciactive ? 1 : 0;
      var fieldRatio = clamp(medlimit / FULL_MED, 0, 1);         // full dome at RM 1M

      var mood, say, coach, headline, stat, power;

      if (phase === 0) {
        // plain-language justification of the (large) target number
        var why = "Target: " + money(target) + ". Why? ";
        if (deps === 0) {
          why += "With no dependants, the goal is simply to clear your "
            + money(totalLiabilities) + " in active liabilities so no debt is passed on.";
        } else {
          why += "With " + depWord + (deps === 1 ? " dependant" : " dependants")
            + ", your family needs " + (deps === 1 ? "7" : "10")
            + " years of your income replaced to sustain their lives if you vanish, plus your "
            + money(totalLiabilities) + " in active liabilities.";
        }
        if (mrta) why += " Your mortgage is excluded because your MRTA / MLTA handles it!";

        if (lifeRatio >= 1) {
          mood = "joyful";
          say = "Full wall! Bring it on!";
          headline = "Brick Shield complete — " + money(cover) + " of a " + money(target) + " target.";
          coach = why + " Your " + money(cover) + " cover clears this in full — your family is bulletproofed.";
        } else {
          mood = lifeRatio >= 0.75 ? "stable" : lifeRatio >= 0.45 ? "risk-averse" : "concerned";
          say = lifeRatio >= 0.75 ? "A few thin spots up top."
            : lifeRatio >= 0.45 ? "My wall is flickering..." : "The wall is barely holding!";
          headline = "Protection gap: " + money(gap) + " of a " + money(target) + " target.";
          coach = why + " Your " + money(cover) + " cover leaves a " + money(gap)
            + " gap — usually the cheapest financial problem to solve.";
        }
        stat = "SHIELD " + clamp(Math.round(lifeRatio * 100), 0, 120) + "%";
        power = { pct: clamp(lifeRatio * 100, 0, 100), tone: lifeRatio >= 1 ? "green" : lifeRatio < 0.45 ? "red" : "gold" };
      } else {
        var medComment;
        if (medlimit === 0) {
          mood = "concerned"; say = "No medical shield?!"; stat = "MED: NONE";
          power = { pct: 6, tone: "red" };
          headline = "Critical risk — no medical card active.";
          medComment = "🚨 CRITICAL RISK: Public healthcare is highly subsidized, but advanced "
            + "treatments, specialized implants, and cancer drugs still incur heavy out-of-pocket "
            + "costs. A major emergency could wipe out your cashflow.";
        } else if (medlimit < 200000) {
          mood = "risk-averse"; say = "Weak barrier, watch out."; stat = "MED " + rmShort(medlimit);
          power = { pct: clamp(fieldRatio * 100, 6, 100), tone: "red" };
          headline = "Weak barrier — limit under RM 200k.";
          medComment = "⚠️ WEAK BARRIER: Fine for basic ward stays, but complex surgeries or "
            + "intensive ICU care at Malaysian private hospitals can easily breach this ceiling "
            + "in a single admission.";
        } else if (medlimit < FULL_MED) {
          mood = "stable"; say = "Modest shield holding."; stat = "MED " + rmShort(medlimit);
          power = { pct: clamp(fieldRatio * 100, 0, 100), tone: "gold" };
          headline = "Modest shield — " + money(medlimit) + " annual limit.";
          medComment = "🧱 MODEST SHIELD: Covers standard private treatments well. However, to stay "
            + "fully protected against medical inflation and long-term care without out-of-pocket "
            + "panic, an upgrade to RM 1M+ is ideal.";
        } else {
          mood = "joyful"; say = "Force field maxed!"; stat = "MED MAX";
          power = { pct: 100, tone: "green" };
          headline = "Force field maxed — " + money(medlimit) + " annual limit.";
          medComment = "✨ MAXED BARRIER: Secures your health completely. Comfortably covers "
            + "long-term therapies, specialized surgeries, and private room stays at top private "
            + "hospitals with no lifetime caps.";
        }
        coach = medComment + "\n• Critical Illness: " + (ciActive ? "Active" : "Inactive")
          + " (Provides a cash payout to replace your income if you need time off work to recover).";
      }

      return {
        mood: mood,
        score: clamp(Math.round((phase === 0 ? lifeRatio : fieldRatio) * 100), 0, 100),
        stat: stat,
        headline: headline,
        coach: coach,
        say: say,
        power: power,
        metrics: { ratio: clamp(lifeRatio, 0, 1.2), forcefield: fieldRatio }
      };
    },
    scene: {
      draw: function (g) {
        drawColonnade(g);
      }
    }
  });

  /* ============================================================
     PILLAR III — Future: the flagpole climb
     ============================================================ */

  engine.registerLevel("retirement", {
    name: "Future",
    title: "Pillar III · The Flagpole Climb",
    inputs: [
      { key: "age", label: "Age today", min: 20, max: 60, step: 1, value: 30, fmt: "age" },
      { key: "retireAge", label: "Retirement age", min: 40, max: 70, step: 1, value: 60, fmt: "age" },
      { key: "monthly", label: "Invested monthly", min: 0, max: 10000, step: 50, value: 600, fmt: "money" },
      { key: "wantIncome", label: "Retirement income /mo", min: 1000, max: 20000, step: 100, value: 3000, fmt: "money" },
      { type: "microrow", label: "Current Stash", items: [
        { key: "cash", label: "Cash", sub: "2.5% p.a.", min: 0, max: 200000, step: 1000, value: 10000 },
        { key: "epf", label: "EPF", sub: "5.5% p.a.", min: 0, max: 1000000, step: 5000, value: 50000 },
        { key: "invest", label: "Invest", sub: "7.5% p.a.", min: 0, max: 1000000, step: 5000, value: 20000 }
      ] }
    ],
    compute: function (v) {
      var Y = Math.max(0, v.retireAge - v.age);    // years to retire
      var M = Y * 12;                              // months to retire
      var cash = v.cash || 0, epf = v.epf || 0, invest = v.invest || 0;

      // differentiated compounding on each existing stash bucket
      var fvCash = cash * Math.pow(1.025, Y);      // cash @ 2.5% p.a.
      var fvEpf = epf * Math.pow(1.055, Y);        // EPF  @ 5.5% p.a.
      var fvInvest = invest * Math.pow(1.075, Y);  // invest @ 7.5% p.a.
      var rM = 0.075 / 12;                         // monthly contributions @ 7.5% p.a.
      var fvSavings = v.monthly > 0 ? v.monthly * ((Math.pow(1 + rM, M) - 1) / rM) : 0;
      var pot = fvCash + fvEpf + fvInvest + fvSavings;

      var yearsToFund = Math.max(0, 80 - v.retireAge); // fund retirement → age 80 (MY life expectancy)
      var target = v.wantIncome * 12 * yearsToFund;     // dynamic goal: taller flag the earlier you retire
      var ratio = target > 0 ? pot / target : 0;
      var pct = Math.round(ratio * 100);

      var stashNow = cash + epf + invest;          // what's already owned today
      var startRatio = target > 0 ? clamp(stashNow / target, 0, 1) : 0;

      var mood = ratio >= 1.1 ? "joyful"
        : ratio >= 0.8 ? "growth"
        : ratio >= 0.5 ? "stable"
        : ratio >= 0.25 ? "cautious"
        : "concerned";
      var say = {
        joyful: "The flag! I can reach it!",
        growth: "Great view from up here!",
        stable: "Halfway up the staircase.",
        cautious: "These stairs feel short...",
        concerned: "The flag is so far away."
      }[mood];

      var coach = ratio < 1
        ? "Your current stash and monthly climb will compound into " + money(pot) + "—reaching "
          + pct + "% of your " + money(target) + " goal (which funds a " + yearsToFund
          + "-year retirement runway until age 80). Push your monthly investment dial to climb faster."
        : "Your current stash and steady contributions will compound into " + money(pot)
          + ", completely clearing your " + money(target) + " goal. This fully funds your "
          + yearsToFund + "-year retirement runway. Flagpole conquered!";

      return {
        mood: mood,
        score: clamp(pct, 0, 100),
        stat: "GOAL " + clamp(pct, 0, 999) + "%",
        headline: ratio >= 1
          ? "Flagpole conquered — " + money(pot) + " vs a " + money(target) + " goal."
          : "Projected " + money(pot) + " — " + pct + "% of your " + money(target) + " goal.",
        coach: coach,
        say: say,
        power: { pct: clamp(ratio * 100, 0, 100), tone: ratio >= 1 ? "green" : ratio < 0.3 ? "red" : "gold" },
        metrics: { ratio: clamp(ratio, 0, 1.3), startRatio: startRatio }
      };
    },
    scene: {
      draw: function (g) {
        drawColonnade(g);
      }
    }
  });

  /* ============================================================
     PILLAR IV — Legacy: the map home
     (handled gently — the owl leans calm, never alarmed)
     ============================================================ */

  engine.registerLevel("legacy", {
    name: "Legacy",
    title: "Pillar IV · The Willow Gate",
    inputs: [
      { key: "loved", label: "Loved ones", min: 1, max: 8, step: 1, value: 3, fmt: "people" },
      {
        key: "keys", type: "keyrow", label: "Legacy Keys",
        items: [
          { key: "epf", label: "EPF Nominee Added", value: 0 },
          { key: "hibah", label: "Insurance / Takaful Beneficiary Assigned", value: 0 },
          { key: "will", label: "Will / Wasiat / Hibah Arranged", value: 0 }
        ]
      }
    ],
    compute: function (v) {
      // --- Asset Unlock Factor -----------------------------------------
      // Base 10% (assets frozen under probate); each active legacy key adds
      // +30%, capped at 100%.
      var epf = v.epf ? 1 : 0, will = v.will ? 1 : 0, hibah = v.hibah ? 1 : 0;
      var readiness = Math.min(1, 0.10 + epf * 0.30 + will * 0.30 + hibah * 0.30);
      var pct = Math.round(readiness * 100);
      var express = epf || hibah;          // nominees / Hibah bypass the courts
      var loved = v.loved;

      var mood = pct >= 100 ? "serene" : pct >= 40 ? "calm" : "thoughtful";
      var say = {
        serene: "All unfrozen. They'll be okay.",
        calm: "A good start — keep unlocking.",
        thoughtful: "It's love, really."
      }[mood];

      // --- explicit commentary permutation matrix -----------------------
      // epf = EPF nominee · hibah = Insurance/Takaful beneficiary ·
      // will = Will/Wasiat/Hibah (property pathway). Eight exact statements.
      var coach;
      if (!epf && !hibah && !will) {
        coach = "🚨 ASSETS FROZEN: Without a plan, your coins are locked in legal limbo. "
          + "Your loved ones face a complex, multi-year probate court maze just to access "
          + "basic bank accounts.";
      } else if (epf && !hibah && !will) {
        coach = "⚡ PARTIAL EXPRESS LANE: Your EPF funds bypass court and reach beneficiaries "
          + "instantly. However, all physical property, cash stashes, and life insurance "
          + "remain frozen until you secure a Will/Hibah.";
      } else if (!epf && hibah && !will) {
        coach = "⚡ PARTIAL EXPRESS LANE: Your nominated insurance/takaful clears instantly "
          + "for immediate emergency cash. But without an EPF nominee or a Will/Hibah, your "
          + "retirement fund and property are stuck in court.";
      } else if (!epf && !hibah && will) {
        coach = "🧱 ASSET PATHWAY READY: Your Will or Hibah ensures your physical properties "
          + "are cleanly gifted to the right people. However, your family is left with zero "
          + "immediate emergency cash while the estate processes.";
      } else if (epf && hibah && !will) {
        coach = "⚡ EXPRESS RUNWAY ACTIVE: Your liquid wealth (EPF and insurance cash payouts) "
          + "transfers instantly for daily bills. However, your physical properties or home "
          + "remain legally stuck without a Will or Hibah.";
      } else if (epf && !hibah && will) {
        coach = "🧱 PREPARED ESTATE: Your EPF transfers instantly and your property "
          + "distribution is freed up via Will or Hibah. Consider nominating your "
          + "insurance/takaful to add immediate, court-free cash flow for daily bills.";
      } else if (!epf && hibah && will) {
        coach = "🧱 PROTECTED HOME: Your main properties are secured via Will/Hibah and your "
          + "insurance provides fast cash. Don't forget your EPF! Without a direct nominee "
          + "assigned, those retirement coins fall back into court.";
      } else {
        coach = "✨ MASTER LEGACY SECURED! Your EPF and insurance/takaful express lanes "
          + "guarantee immediate financial support, while your Will or Hibah perfectly "
          + "safeguards and routes your properties. Zero legal delays.";
      }

      return {
        mood: mood,
        score: pct,
        stat: "READY " + pct + "%",
        headline: pct + "% legacy-ready for "
          + loved + (loved === 1 ? " loved one." : " loved ones."),
        coach: coach,
        say: say,
        // POWER bar tracks readiness: red when fully frozen, green when secured
        power: { pct: pct, tone: pct >= 100 ? "green" : (express || will ? "gold" : "red") },
        metrics: { readiness: readiness, express: express ? 1 : 0, will: will }
      };
    },
    scene: {
      draw: function (g) {
        drawColonnade(g);
      }
    }
  });

  /* ============================================================
     DOM wiring — chips, sliders, coach copy, power meter
     ============================================================ */

  var chipsEl = document.getElementById("journeyLevels");
  var controlsEl = document.getElementById("journeyControls");
  var titleEl = document.getElementById("journeyTitle");
  var tagEl = document.getElementById("journeyLevelTag");
  var headlineEl = document.getElementById("journeyHeadline");
  var coachEl = document.getElementById("journeyCoach");
  var bubbleEl = document.getElementById("journeyBubble");
  var statEl = document.getElementById("journeyStat");
  var vibeEl = document.getElementById("journeyVibe");
  var vibePctEl = document.getElementById("journeyVibePct");
  var vibeBoxEl = document.querySelector(".journey__vibe");

  var chips = {};

  engine.order.forEach(function (id, i) {
    var def = engine.levels[id];
    var b = document.createElement("button");
    b.className = "journey__chip";
    b.type = "button";
    b.setAttribute("role", "tab");
    b.innerHTML =
      '<span class="journey__chip-num">' + (ROMAN[i] || (i + 1)) + "</span>" +
      "<span>" + def.name + "</span>" +
      '<span class="journey__chip-dot" aria-hidden="true"></span>';
    b.addEventListener("click", function () { engine.start(id); });
    chipsEl.appendChild(b);
    chips[id] = b;
  });

  function fmtVal(inp, v) {
    switch (inp.fmt) {
      case "money": return money(v);
      case "percent": return Math.round(v) + "%";
      case "age": return "Age " + v;
      case "deps": return v >= 3 ? "3+ people" : v + (v === 1 ? " person" : " people");
      case "people": return v + (v === 1 ? " person" : " people");
      default: return String(v);
    }
  }

  function setFill(range) {
    var pct = ((range.value - range.min) / (range.max - range.min)) * 100;
    range.style.setProperty("--fill", pct + "%");
  }

  function buildControls(def) {
    controlsEl.innerHTML = "";
    // a level that tags its inputs with `group` renders section headers
    // and switches to the compact two-column Cashflow layout
    var hasGroups = def.inputs.some(function (inp) { return inp.group; });
    // levels that declare `phases` show one progressive input view at a time,
    // toggled by a single retro pixel button (keeps the panel short → no scroll)
    var hasPhases = !!def.phases;
    var curPhase = hasPhases ? insurancePhase : null;
    controlsEl.classList.toggle("journey__controls--grouped", hasGroups);
    controlsEl.classList.toggle("journey__controls--phased", hasPhases);

    var controls = {};                 // key -> { inp, range, output }
    var baseKey = null;                // the inflow slider others scale against
    def.inputs.forEach(function (inp) { if (inp.base) baseKey = inp.key; });
    function baseVal() {
      return baseKey && controls[baseKey] ? parseFloat(controls[baseKey].range.value) : 0;
    }
    // an outflow's ceiling tracks the inflow (1.2× so a deficit is reachable)
    function dynMax(inp) {
      var raw = baseVal() * (inp.maxFactor || 1);
      return Math.max(inp.min + inp.step, Math.round(raw / inp.step) * inp.step);
    }
    // value readout — outflows also show their share of take-home pay
    function renderOut(inp, range, output) {
      var v = parseFloat(range.value);
      if (inp.scaleWith) {
        var income = baseVal();
        var p = income > 0 ? Math.round((v / income) * 100) : 0;
        var tone = p > 100 ? " journey__pct--over" : (p > 50 ? " journey__pct--heavy" : "");
        output.innerHTML = money(v) + ' <span class="journey__pct' + tone + '">(' + p + "%)</span>";
      } else {
        output.textContent = fmtVal(inp, v);
      }
    }
    // when the inflow moves, rescale every dependent slider's ceiling and
    // re-clamp any outflow that now exceeds it
    function refreshDynamic() {
      def.inputs.forEach(function (inp) {
        if (!inp.scaleWith) return;
        var c = controls[inp.key];
        var m = dynMax(inp);
        c.range.max = m;
        if (parseFloat(c.range.value) > m) {
          c.range.value = m;
          engine.setInput(inp.key, m);
        }
        setFill(c.range);
        renderOut(inp, c.range, c.output);
      });
    }

    var lastGroup = null;
    def.inputs.forEach(function (inp) {
      if (hasPhases && inp.phase !== curPhase) return;   // hide the other phase

      // micro-stash: a labelled row of 3 compact sliders sharing one line
      if (inp.type === "microrow") {
        var stash = document.createElement("div");
        stash.className = "journey__stash";
        var stHead = document.createElement("p");
        stHead.className = "journey__group-head journey__stash-head";
        stHead.textContent = inp.label;
        stash.appendChild(stHead);
        var stRow = document.createElement("div");
        stRow.className = "journey__stash-row";
        inp.items.forEach(function (it) {
          var iid = "jin-" + it.key;
          var cur = engine.values[it.key];
          var val = cur != null ? cur : it.value;
          engine.setInput(it.key, val);              // seed engine state for compute
          var cell = document.createElement("div");
          cell.className = "journey__micro";
          cell.innerHTML =
            '<label class="journey__micro-label" for="' + iid + '">' + it.label + "</label>" +
            (it.sub ? '<span class="journey__micro-sub">' + it.sub + "</span>" : "") +
            "<output></output>" +
            '<input class="journey__range" type="range" id="' + iid + '" min="' + it.min
            + '" max="' + it.max + '" step="' + it.step + '" value="' + val + '" />';
          var mr = cell.querySelector("input");
          var mo = cell.querySelector("output");
          mo.textContent = rmShort(val);
          setFill(mr);
          mr.addEventListener("input", function () {
            setFill(this);
            var nv = parseFloat(this.value);
            engine.setInput(it.key, nv);
            mo.textContent = rmShort(nv);
          });
          stRow.appendChild(cell);
        });
        stash.appendChild(stRow);
        controlsEl.appendChild(stash);
        return;
      }

      // legacy keys: full-width, thumb-friendly toggles (Pillar II switch
      // format) inside one tight container with a section header
      if (inp.type === "keyrow") {
        var keys = document.createElement("div");
        keys.className = "journey__keys";
        if (inp.label) {
          var kHead = document.createElement("p");
          kHead.className = "journey__group-head journey__keys-head";
          kHead.textContent = inp.label;
          keys.appendChild(kHead);
        }
        inp.items.forEach(function (it) {
          var kid = "jin-" + it.key;
          var cur = engine.values[it.key];
          var on = (cur != null ? cur : it.value) ? true : false;
          engine.setInput(it.key, on ? 1 : 0);     // seed engine state for compute
          var lab = document.createElement("label");
          lab.className = "journey__toggle journey__key";
          lab.setAttribute("for", kid);
          lab.innerHTML =
            '<input type="checkbox" id="' + kid + '"' + (on ? " checked" : "") + " />" +
            '<span class="journey__toggle-track" aria-hidden="true"></span>' +
            '<span class="journey__key-label">' + it.label + "</span>";
          lab.querySelector("input").addEventListener("change", function () {
            engine.setInput(it.key, this.checked ? 1 : 0);
          });
          keys.appendChild(lab);
        });
        controlsEl.appendChild(keys);
        return;
      }

      if (inp.group && inp.group !== lastGroup) {
        lastGroup = inp.group;
        lastGroup = inp.group;
        var head = document.createElement("p");
        head.className = "journey__group-head";
        head.textContent = inp.group;
        controlsEl.appendChild(head);
      }
      var split = hasGroups && inp.type !== "toggle";
      var row = document.createElement("div");
      row.className = "journey__control"
        + (inp.type === "toggle" ? " journey__control--toggle" : "")
        + (split ? " journey__control--split" : "");
      if (inp.type === "toggle") {
        var toggleOn = engine.values[inp.key] != null ? engine.values[inp.key] : inp.value;
        row.innerHTML =
          '<label class="journey__toggle">' +
          '<input type="checkbox"' + (toggleOn ? " checked" : "") + " />" +
          '<span class="journey__toggle-track" aria-hidden="true"></span>' +
          '<span class="journey__control-label">' + inp.label + "</span>" +
          "</label>";
        row.querySelector("input").addEventListener("change", function () {
          engine.setInput(inp.key, this.checked ? 1 : 0);
        });
        controlsEl.appendChild(row);
        return;
      }

      var id = "jin-" + inp.key;
      var subHtml = inp.sub ? '<span class="journey__control-sub">' + inp.sub + "</span>" : "";
      var theMax = inp.scaleWith ? dynMax(inp) : inp.max;
      // income & debt are shared pillar state — seed the slider from GLOBAL so
      // a value set in Pillar I shows up here (and vice-versa). Every other
      // slider seeds from the live engine value, so a phase toggle (which
      // rebuilds this panel) never loses what the user has already dialled in.
      var globalKey = inp.key === "income" || inp.key === "debt";
      var current = engine.values[inp.key];
      var theValue = globalKey
        ? clamp(GLOBAL[inp.key], inp.min, theMax)
        : clamp(current != null ? current : inp.value, inp.min, theMax);
      if (globalKey) engine.setInput(inp.key, theValue);
      var rangeHtml = '<input class="journey__range" type="range" id="' + id + '" min="'
        + inp.min + '" max="' + theMax + '" step="' + inp.step + '" value="' + theValue + '" />';

      if (split) {
        row.innerHTML =
          '<div class="journey__c-info">' +
          '<label class="journey__control-label" for="' + id + '">' + inp.label + subHtml + "</label>" +
          "</div>" +
          '<div class="journey__c-ctrl">' +
          "<output></output>" + rangeHtml +
          "</div>";
      } else {
        row.innerHTML =
          '<div class="journey__control-head">' +
          '<label class="journey__control-label" for="' + id + '">' + inp.label + subHtml + "</label>" +
          "<output></output>" +
          "</div>" + rangeHtml;
      }

      var range = row.querySelector("input");
      var output = row.querySelector("output");
      controls[inp.key] = { inp: inp, range: range, output: output };
      setFill(range);
      renderOut(inp, range, output);
      range.addEventListener("input", function () {
        setFill(this);
        var val = parseFloat(this.value);
        engine.setInput(inp.key, val);
        if (globalKey) GLOBAL[inp.key] = val;   // write back to the shared world state
        renderOut(inp, this, output);
        if (inp.base) refreshDynamic();   // inflow moved → rescale outflows + %
      });
      controlsEl.appendChild(row);
    });

    // progressive phase toggle — one pixel button swaps Life ⇄ Health views
    if (hasPhases) {
      var nextPhase = curPhase === 0 ? 1 : 0;
      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "journey__phase-toggle";
      toggle.innerHTML = def.phases[curPhase].cta;
      toggle.addEventListener("click", function () {
        insurancePhase = nextPhase;
        engine.setInput("phase", nextPhase);   // swap commentary / power readout
        if (def.phases[nextPhase].title) titleEl.textContent = def.phases[nextPhase].title;
        buildControls(def);                      // swap only the form UI (canvas persists)
      });
      controlsEl.appendChild(toggle);
    }
  }

  var lastSay = "";
  engine.on("level", function (e) {
    var i = engine.order.indexOf(e.id);
    tagEl.textContent = "Pillar " + (ROMAN[i] || (i + 1)) + " · " + e.def.name;
    titleEl.textContent = e.def.title.split("·")[1].trim();
    // phased levels always open on PHASE 1 (with its own panel title)
    if (e.def.phases) {
      insurancePhase = 0;
      engine.values.phase = 0;
      if (e.def.phases[0].title) titleEl.textContent = e.def.phases[0].title;
    }
    buildControls(e.def);
    for (var id in chips) chips[id].classList.toggle("is-active", id === e.id);
    if (vibeBoxEl) vibeBoxEl.classList.remove("is-green", "is-red");
    lastSay = "";
  });

  engine.on("state", function (s) {
    // remember the live inputs for the active pillar so the cross-pillar
    // roadmap report can replay every selection, even after switching tabs
    if (engine.levelId) {
      var snap = worldValues[engine.levelId] || (worldValues[engine.levelId] = {});
      for (var vk in engine.values) snap[vk] = engine.values[vk];
    }
    headlineEl.textContent = s.headline || "";
    coachEl.textContent = s.coach || "";
    statEl.textContent = s.stat || "";
    statEl.style.display = s.stat ? "" : "none";
    if (s.say && s.say !== lastSay) {
      lastSay = s.say;
      bubbleEl.textContent = s.say;
      bubbleEl.classList.remove("is-pop");
      void bubbleEl.offsetWidth; // restart the pop animation
      bubbleEl.classList.add("is-pop");
    }
    progress[engine.levelId] = s.score || 0;
    if (s.power) tones[engine.levelId] = s.power.tone;

    if (s.power) {
      // a level can drive the POWER bar directly (Cashflow ties it to
      // the surplus %): empty/red at a deficit, full + green glow at 20%+
      var pp = clamp(Math.round(s.power.pct), 0, 100);
      vibeEl.style.width = pp + "%";
      vibePctEl.textContent = pp + "%";
      if (vibeBoxEl) {
        vibeBoxEl.classList.toggle("is-green", s.power.tone === "green");
        vibeBoxEl.classList.toggle("is-red", s.power.tone === "red");
      }
    } else {
      // power = average score across the levels played so far, so a
      // maxed first level reads 100%, not 25%
      if (vibeBoxEl) vibeBoxEl.classList.remove("is-green", "is-red");
      var total = 0, visited = 0;
      engine.order.forEach(function (id) {
        if (progress[id] != null) { visited++; total += progress[id]; }
      });
      var pct = visited ? Math.round(total / visited) : 0;
      vibeEl.style.width = pct + "%";
      vibePctEl.textContent = pct + "%";
    }
    engine.order.forEach(function (id) {
      chips[id].classList.toggle("is-done", (progress[id] || 0) >= 60);
    });
  });

  /* ============================================================
     CROSS-PILLAR ROADMAP — the "Turn this into a real plan" popup
     Compiles all four pillars (titles, every selection, readiness
     scores and the exact dynamic commentary) into a printable report
     and a Send-to-Sofina submission.
     ============================================================ */

  // last-known inputs per world; seeded with each world's defaults so the
  // report is complete even for worlds the user never opened
  var worldValues = {};
  function seedDefaults(def) {
    var vals = {};
    def.inputs.forEach(function (inp) {
      if (inp.type === "microrow" || inp.type === "keyrow") {
        inp.items.forEach(function (it) { vals[it.key] = it.value; });
      } else if (inp.type === "toggle") {
        vals[inp.key] = inp.value || 0;
      } else {
        vals[inp.key] = inp.value;
      }
    });
    return vals;
  }
  engine.order.forEach(function (id) {
    var def = engine.levels[id];
    worldValues[id] = seedDefaults(def);
    // seed progress + tones with each pillar's default-computed score so
    // all four pillars render with their baseline fill on first paint
    var st = def.compute(seedDefaults(def));
    progress[id] = (st && st.score) || 0;
    if (st && st.power) tones[id] = st.power.tone;
  });

  // human-readable list of every slider / toggle selection in a world
  function describeInputs(def, vals) {
    var rows = [];
    def.inputs.forEach(function (inp) {
      if (inp.type === "microrow") {
        inp.items.forEach(function (it) {
          rows.push({ label: it.label + (it.sub ? " (" + it.sub + ")" : ""), value: money(vals[it.key] || 0) });
        });
      } else if (inp.type === "keyrow") {
        inp.items.forEach(function (it) {
          rows.push({ label: it.label, value: vals[it.key] ? "Yes" : "No" });
        });
      } else if (inp.type === "toggle") {
        rows.push({ label: inp.label, value: vals[inp.key] ? "Yes" : "No" });
      } else {
        rows.push({ label: inp.label + (inp.sub ? " " + inp.sub : ""), value: fmtVal(inp, vals[inp.key]) });
      }
    });
    return rows;
  }

  // assemble the full snapshot across all four worlds
  function collectReport() {
    var worlds = [];
    var totalScore = 0;
    engine.order.forEach(function (id, i) {
      var def = engine.levels[id];
      var vals = Object.assign({}, worldValues[id]);
      // honour the cross-world synced figures
      if ("income" in vals) vals.income = GLOBAL.income;
      if ("debt" in vals) vals.debt = GLOBAL.debt;

      var sections = [];
      if (def.phases) {
        // phased world (Protection): report BOTH phase commentaries
        def.phases.forEach(function (ph, p) {
          var st = def.compute(Object.assign({}, vals, { phase: p }));
          sections.push({ phaseTitle: ph.title, st: st });
        });
      } else {
        sections.push({ phaseTitle: null, st: def.compute(vals) });
      }

      // overall readiness for a world = its primary (first) section score
      totalScore += sections[0].st.score || 0;
      worlds.push({
        tag: "Pillar " + (ROMAN[i] || (i + 1)),
        category: def.name,
        name: def.title.split("·")[1].trim(),
        inputs: describeInputs(def, vals),
        sections: sections
      });
    });
    return { worlds: worlds, overall: Math.round(totalScore / engine.order.length) };
  }

  function toneClass(tone) {
    return tone === "green" ? " is-green" : tone === "red" ? " is-red" : "";
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ---- render the report into the modal (HTML) ----
  function renderReportHTML(report) {
    var html = '<div class="plan-report__head">'
      + '<p class="plan-report__overall">Overall readiness <b>' + report.overall + '%</b></p>'
      + '<p class="plan-report__intro">A snapshot of your Four Pillars with Capy the owl. '
      + 'Bring this to your session with Sofina.</p></div>';

    report.worlds.forEach(function (wld) {
      var primary = wld.sections[0].st;
      var p = clamp(Math.round((primary.power && primary.power.pct) || primary.score || 0), 0, 100);
      var tone = primary.power ? primary.power.tone : "gold";
      html += '<section class="plan-world">'
        + '<div class="plan-world__top"><div>'
        + '<p class="plan-world__tag">' + esc(wld.tag) + ' · ' + esc(wld.category) + '</p>'
        + '<p class="plan-world__name">' + esc(wld.name) + '</p></div>'
        + '<span class="plan-world__score">' + esc(primary.stat || (primary.score + "%")) + '</span></div>'
        + '<div class="plan-bar"><span class="plan-bar__label">Power</span><div class="plan-bar__track"><div class="plan-bar__fill' + toneClass(tone) + '" style="width:' + p + '%"></div></div><span class="plan-bar__pct">' + p + '%</span></div>';

      html += '<ul class="plan-world__inputs">';
      wld.inputs.forEach(function (r) {
        html += '<li><span>' + esc(r.label) + '</span><b>' + esc(r.value) + '</b></li>';
      });
      html += '</ul>';

      wld.sections.forEach(function (sec) {
        html += '<div class="plan-world__phase">';
        if (sec.phaseTitle) html += '<p class="plan-world__phase-title">' + esc(sec.phaseTitle) + '</p>';
        html += '<p class="plan-world__headline">' + esc(sec.st.headline) + '</p>'
          + '<p class="plan-world__coach">' + esc(sec.st.coach) + '</p>'
          + '<p class="plan-world__say">' + esc(sec.st.say) + '</p></div>';
      });
      html += '</section>';
    });
    return html;
  }

  // ---- render the report as plain text (form payload + mailto body) ----
  function renderReportText(report, remark, userName, userEmail, userWhatsapp, userSubscribe) {
    var L = [];
    L.push("YOUR FINANCIAL FOUNDATION — ROADMAP");
    L.push("Overall readiness: " + report.overall + "%");
    L.push("================================================");
    L.push("");
    L.push("CONTACT DETAILS");
    L.push("Name: " + (userName || "(not provided)"));
    L.push("Email: " + (userEmail || "(not provided)"));
    L.push("WhatsApp: " + (userWhatsapp || "(not provided)"));
    L.push("WhatsApp Broadcast: " + (userSubscribe || "No"));
    L.push("================================================");
    report.worlds.forEach(function (wld) {
      L.push("");
      L.push(wld.tag + " · " + wld.name + "   [" + (wld.sections[0].st.stat || "") + "]");
      L.push("------------------------------------------------");
      L.push("Your selections:");
      wld.inputs.forEach(function (r) { L.push("  • " + r.label + ": " + r.value); });
      wld.sections.forEach(function (sec) {
        L.push("");
        if (sec.phaseTitle) L.push("[" + sec.phaseTitle + "]");
        L.push(sec.st.headline);
        L.push(sec.st.coach);
        L.push("Capy the owl says: “" + sec.st.say + "”");
      });
    });
    L.push("");
    L.push("================================================");
    L.push("User remark: " + (remark && remark.trim() ? remark.trim() : "(none)"));
    return L.join("\n");
  }

  /* ---------- modal plumbing ---------- */
  var planBtn = document.getElementById("journeyPlanBtn");
  var planModal = document.getElementById("planModal");
  var planBackdrop = document.getElementById("planModalBackdrop");
  var planClose = document.getElementById("planModalClose");
  var planReportEl = document.getElementById("planReport");
  var planRemarkEl = document.getElementById("planRemark");
  var planPrintBtn = document.getElementById("planPrintBtn");
  var planSendBtn = document.getElementById("planSendBtn");
  var planStatusEl = document.getElementById("planSendStatus");

  var SOFINA_EMAIL = "sofinajohari.uwealth@gmail.com";
  var currentReport = null;
  var lastFocus = null;

  function setStatus(msg, kind) {
    if (!planStatusEl) return;
    if (!msg) { planStatusEl.hidden = true; return; }
    planStatusEl.hidden = false;
    planStatusEl.textContent = msg;
    planStatusEl.className = "plan-send__status " + (kind === "ok" ? "is-ok" : kind === "err" ? "is-err" : "");
  }

  function openPlan() {
    if (!planModal) return;
    currentReport = collectReport();
    planReportEl.innerHTML = renderReportHTML(currentReport);
    var dateEl = document.getElementById("planModalDate");
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString("en-MY",
        { day: "numeric", month: "long", year: "numeric" });
    }
    setStatus("", null);
    if (planSendBtn) { planSendBtn.disabled = false; planSendBtn.textContent = "Send to Sofina"; }
    ["planName", "planEmail", "planWhatsapp"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = "";
    });
    var sub = document.querySelector("input[name='planSubscribe']");
    if (sub) sub.checked = false;
    if (planRemarkEl) planRemarkEl.value = "";
    lastFocus = document.activeElement;
    planModal.hidden = false;
    document.body.style.overflow = "hidden";
    if (planClose) setTimeout(function () { planClose.focus(); }, 30);
    document.addEventListener("keydown", onPlanKey);
  }
  function closePlan() {
    if (!planModal) return;
    planModal.hidden = true;
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onPlanKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function onPlanKey(e) { if (e.key === "Escape") closePlan(); }

  function clearFieldError(el) {
    if (!el) return;
    el.removeAttribute("aria-invalid");
    el.classList.remove("is-err");
  }

  function markFieldError(el) {
    if (!el) return;
    el.setAttribute("aria-invalid", "true");
    el.classList.add("is-err");
    el.addEventListener("input", function onInput() {
      clearFieldError(el);
      el.removeEventListener("input", onInput);
    });
  }

  function sendToSofina() {
    if (!currentReport) currentReport = collectReport();

    var nameEl = document.getElementById("planName");
    var emailEl = document.getElementById("planEmail");
    var whatsappEl = document.getElementById("planWhatsapp");
    var subscribeEl = document.querySelector("input[name='planSubscribe']:checked");

    var userName = nameEl ? nameEl.value.trim() : "";
    var userEmail = emailEl ? emailEl.value.trim() : "";
    var userWhatsapp = whatsappEl ? whatsappEl.value.trim() : "";
    var userSubscribe = subscribeEl ? subscribeEl.value : "";

    var missing = [];
    if (!userName) missing.push(nameEl);
    if (!userEmail) missing.push(emailEl);
    if (!userWhatsapp) missing.push(whatsappEl);

    if (missing.length) {
      missing.forEach(markFieldError);
      missing[0].focus();
      setStatus("Please fill in your name, email, and WhatsApp number.", "err");
      return;
    }

    var remark = planRemarkEl ? planRemarkEl.value : "";
    var text = renderReportText(currentReport, remark, userName, userEmail, userWhatsapp, userSubscribe);
    planSendBtn.disabled = true;
    setStatus("Sending your roadmap…", null);

    var payload = JSON.stringify({
      name: userName,
      email: userEmail,
      whatsapp: userWhatsapp,
      subscribe: userSubscribe || "No",
      readiness: currentReport.overall + "%",
      remark: remark || "(none)",
      report: text
    });

    // Sends via the Resend-backed Netlify function (see netlify/functions/send-roadmap.mjs).
    fetch("/api/send-roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || !data.ok) {
          throw new Error(data && data.error ? data.error : "bad status " + res.status);
        }
        setStatus("Sent! Sofina will receive your roadmap.", "ok");
        planSendBtn.textContent = "Sent";
      });
    }).catch(function (err) {
      setStatus(
        (err && err.message) ? ("Couldn't send — " + err.message) : "Sending failed — check your connection and try again.",
        "err"
      );
      planSendBtn.disabled = false;
      planSendBtn.textContent = "Send to Sofina";
    });
  }

  /* ---------- PDF download (Chrome print-to-PDF) ----------
     We render the report in a dedicated A4 HTML page that re-uses the same
     self-hosted Fraunces / Instrument Sans fonts and colour system as the
     ebook. Opening it with ?print=1 auto-triggers the browser print dialog,
     so the user saves a vector, selectable-text PDF that matches the ebook
     brand exactly. */

  var ROADMAP_TEMPLATE = "assets/capy-roadmap/capy-roadmap.html";

  function resetPrintBtn() {
    if (planPrintBtn) { planPrintBtn.disabled = false; planPrintBtn.textContent = "Download PDF"; }
  }

  function downloadRoadmapPDF(report) {
    var json = JSON.stringify(report);
    var hash = btoa(encodeURIComponent(json));
    var url = new URL(ROADMAP_TEMPLATE, window.location.href);
    url.searchParams.set("download", "1");
    url.hash = hash;

    var iframe = document.createElement("iframe");
    iframe.src = url.toString();
    iframe.style.cssText = "position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;border:0;";
    iframe.setAttribute("aria-hidden", "true");

    function cleanup() {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      resetPrintBtn();
    }

    var timeout = setTimeout(function() {
      cleanup();
      setStatus("PDF download is taking longer than expected — please try again.", "err");
    }, 30000);

    function onMessage(e) {
      if (!e.data || e.data.type !== "capy-pdf-download") return;
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      cleanup();
      if (e.data.ok) {
        setStatus("Roadmap downloaded.", "ok");
      } else {
        setStatus("PDF download failed — please try again.", "err");
      }
    }

    window.addEventListener("message", onMessage);
    document.body.appendChild(iframe);
  }

  if (planBtn) planBtn.addEventListener("click", openPlan);
  if (planClose) planClose.addEventListener("click", closePlan);
  if (planBackdrop) planBackdrop.addEventListener("click", closePlan);
  if (planPrintBtn) planPrintBtn.addEventListener("click", function () {
    if (!currentReport) currentReport = collectReport();
    planPrintBtn.disabled = true;
    planPrintBtn.textContent = "Generating PDF...";
    downloadRoadmapPDF(currentReport);
  });
  if (planSendBtn) planSendBtn.addEventListener("click", sendToSofina);

  engine.start(engine.order[0]);
  // re-measure once layout has settled, and repaint when the pixel font lands
  requestAnimationFrame(function () { engine._resize(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { if (engine.level) engine._renderFrame(0); });
  }
})();
