/* financial-levels.js — the four playable worlds of the 8-bit money
   quest, plus the DOM wiring between the sliders and the engine.

   Everything renders into the engine's low-resolution buffer, so all
   coordinates here are chunky internal pixels (~170–230 wide stage).
   Adding a fifth world is one registerLevel() call — Mascot.js and
   FinancialEngine.js stay untouched. */

(function () {
  "use strict";

  var canvas = document.getElementById("journeyCanvas");
  if (!canvas || !canvas.getContext || !window.Mascot || !window.FinancialEngine) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mascot = new Mascot();
  var engine = new FinancialEngine({ canvas: canvas, mascot: mascot, reducedMotion: reduced });
  var money = FinancialEngine.money;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, k) { return a + (b - a) * k; }

  /* ---------- 8-bit scene helpers ---------- */

  var PFONT = '"Press Start 2P", "Courier New", monospace';
  var GOLD = "#e7c069", GOLD_LIGHT = "#f6e7bd", GOLD_DARK = "#7a5a1e";
  var BRICK = "#16382d", BRICK_DARK = "#0a1a14", TEAL = "#9fd8c4", RED = "#d96a4a";

  function rmShort(v) {
    v = Math.round(v);
    if (v >= 1e6) return "RM" + (Math.round(v / 1e5) / 10) + "M";
    if (v >= 1e4) return "RM" + Math.round(v / 1e3) + "K";
    if (v >= 1e3) return "RM" + (Math.round(v / 100) / 10) + "K";
    return "RM" + v;
  }

  function ptext(g, str, x, y, color, align, size) {
    var ctx = g.ctx;
    ctx.font = (size || 8) + "px " + PFONT;
    ctx.fillStyle = color || "rgba(242,236,224,0.9)";
    ctx.textAlign = align || "center";
    ctx.fillText(str, Math.round(x), Math.round(y));
  }

  function brickGround(g, topY) {
    var ctx = g.ctx, w = g.w, h = g.h;
    topY = Math.round(topY);
    ctx.fillStyle = BRICK;
    ctx.fillRect(0, topY, w, h - topY);
    ctx.fillStyle = BRICK_DARK;
    var row = 0;
    for (var y = topY; y < h; y += 6, row++) {
      ctx.fillRect(0, y, w, 1);
      for (var x = (row % 2 ? 6 : 0); x < w; x += 12) ctx.fillRect(x, y, 1, 6);
    }
    ctx.fillStyle = "rgba(231,192,105,0.9)";
    ctx.fillRect(0, topY, w, 1);
  }

  function qBlock(g, x, y, s) {
    var ctx = g.ctx;
    x = Math.round(x); y = Math.round(y);
    var lit = g.reduced || ((g.t * 2) | 0) % 2 === 0;
    ctx.fillStyle = lit ? GOLD : "#c9a14a";
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = GOLD_DARK;
    ctx.fillRect(x, y, s, 1); ctx.fillRect(x, y + s - 1, s, 1);
    ctx.fillRect(x, y, 1, s); ctx.fillRect(x + s - 1, y, 1, s);
    ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillRect(x + s - 2, y + 1, 1, 1);
    ctx.fillRect(x + 1, y + s - 2, 1, 1); ctx.fillRect(x + s - 2, y + s - 2, 1, 1);
    ctx.font = "8px " + PFONT;
    ctx.fillStyle = "#3a2a10";
    ctx.textAlign = "center";
    ctx.fillText("?", x + s / 2 + 1, y + s - 4);
  }

  function pipe(g, cx, topY, pw, bottomY, main, dark, light) {
    var ctx = g.ctx;
    cx = Math.round(cx); topY = Math.round(topY);
    var rimH = 6, rimW = pw + 6;
    var bx = Math.round(cx - pw / 2);
    ctx.fillStyle = main;
    ctx.fillRect(bx, topY + rimH, pw, bottomY - topY - rimH);
    ctx.fillStyle = light;
    ctx.fillRect(bx + 2, topY + rimH, 3, bottomY - topY - rimH);
    ctx.fillStyle = dark;
    ctx.fillRect(bx + pw - 3, topY + rimH, 3, bottomY - topY - rimH);
    var rx = Math.round(cx - rimW / 2);
    ctx.fillStyle = main;
    ctx.fillRect(rx, topY, rimW, rimH);
    ctx.fillStyle = light;
    ctx.fillRect(rx, topY, rimW, 2);
    ctx.fillStyle = dark;
    ctx.fillRect(rx, topY + rimH - 2, rimW, 2);
  }

  function coinRow(g, x, y, count) {
    var ctx = g.ctx;
    for (var i = 0; i < count; i++) {
      ctx.fillStyle = GOLD;
      ctx.fillRect(x + i * 5, y, 4, 4);
      ctx.fillStyle = GOLD_LIGHT;
      ctx.fillRect(x + i * 5 + 1, y + 1, 1, 2);
    }
  }

  function heart(ctx, x, y, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 2, 1); ctx.fillRect(x + 3, y, 2, 1);
    ctx.fillRect(x, y + 1, 5, 2);
    ctx.fillRect(x + 1, y + 3, 3, 1);
    ctx.fillRect(x + 2, y + 4, 1, 1);
  }

  function stars(g, count, maxY) {
    var ctx = g.ctx;
    for (var i = 0; i < count; i++) {
      var sx = ((i * 73) % 97) / 97 * g.w;
      var sy = ((i * 41) % 89) / 89 * maxY;
      ctx.globalAlpha = 0.15 + 0.5 * Math.abs(Math.sin(g.t * 0.8 + i * 1.3));
      ctx.fillStyle = "#f6f1e7";
      ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  /* World 1-4 · short pyramid of pixel coins. `frozen` paints them frosted
     blue (locked in probate); otherwise bright gold (cleared for the family).
     Returns its bounds so the caller can frame it in ice. */
  function coinStack(g, cx, baseY, frozen) {
    var ctx = g.ctx;
    cx = Math.round(cx); baseY = Math.round(baseY);
    var cs = 5, gap = 1, step = cs + gap, rowsN = 4, cols = 4;
    var totalW = cols * step - gap;
    var x0 = cx - Math.round(totalW / 2);
    for (var r = 0; r < rowsN; r++) {
      var rowY = baseY - (r + 1) * step;
      var cN = cols - r;                         // pyramid: each tier loses one coin
      var rx = x0 + Math.round(r * step / 2);    // …and centres over the one below
      for (var c = 0; c < cN; c++) {
        var x = rx + c * step;
        ctx.fillStyle = frozen ? "#6f93ad" : GOLD;
        ctx.fillRect(x, rowY, cs, cs);
        ctx.fillStyle = frozen ? "#bcdcf0" : GOLD_LIGHT;
        ctx.fillRect(x + 1, rowY + 1, 2, 1);
        ctx.fillStyle = frozen ? "#46627a" : GOLD_DARK;
        ctx.fillRect(x, rowY + cs - 1, cs, 1);
      }
    }
    return { x0: x0, w: totalW, top: baseY - rowsN * step };
  }

  /* World 1-4 · a tiny waiting capybara (a "loved one") outside the home.
     Deliberately chunky (8×6) so it still reads at mobile canvas sizes. */
  function miniCapy(g, cx, baseY, faceLeft) {
    var ctx = g.ctx;
    cx = Math.round(cx); baseY = Math.round(baseY);
    var O = "#2b1a10", B = "#b07d46", S = "#8a5d33";
    var bx = cx - 4, by = baseY - 6;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(cx - 4, baseY, 8, 1);          // shadow
    ctx.fillStyle = O;
    ctx.fillRect(bx, by, 8, 6);                 // outline body
    ctx.fillStyle = B;
    ctx.fillRect(bx + 1, by + 1, 6, 4);         // fur fill
    ctx.fillStyle = O;
    ctx.fillRect(bx + 1, by - 1, 1, 1);         // ears
    ctx.fillRect(bx + 6, by - 1, 1, 1);
    ctx.fillRect(bx + 1, baseY - 1, 1, 1);      // legs
    ctx.fillRect(bx + 6, baseY - 1, 1, 1);
    ctx.fillStyle = S;                          // snout nub
    ctx.fillRect(faceLeft ? bx : bx + 7, by + 2, 1, 2);
    ctx.fillStyle = "#1c1008";                  // eye
    ctx.fillRect(faceLeft ? bx + 2 : bx + 5, by + 1, 1, 1);
  }

  /* ============================================================
     WORLD 1-1 — Cashflow: the coin pipes
     ============================================================ */

  function spawnCoin(g, x0, y0, x1, y1) {
    var T = 0.7, G = 180;
    g.particles.spawn({
      x: x0 + (Math.random() - 0.5) * 6, y: y0,
      vx: (x1 - x0) / T + (Math.random() - 0.5) * 8,
      vy: (y1 - y0) / T - 0.5 * G * T,
      g: G, size: 3, life: T, color: GOLD, alpha: 1
    });
  }

  engine.registerLevel("budget", {
    name: "Cashflow",
    title: "World 1-1 · The Coin Pipes",
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
        var ctx = g.ctx, w = g.w, h = g.h;
        var groundY = h - 14;
        stars(g, 14, h * 0.4);

        // "?" pay block
        var bs = 14;
        var bx = w / 2 - bs / 2, by = 8 + (g.reduced ? 0 : Math.round(Math.abs(Math.sin(g.t * 2)) * -2));
        qBlock(g, bx, by, bs);

        var rate = clamp(g.m.rate, 0, 0.6);
        var spendShare = clamp(g.m.spendShare, 0, 1.5);
        var totalSpend = (g.values.fixed || 0) + (g.values.debt || 0) + (g.values.other || 0);
        var spendCx = w * 0.32, saveCx = w * 0.68;

        // spending pipe (money down the drain); labels hug the left
        // edge so the coin arc never crosses the text
        var pw = 18, pipeTop = groundY - 26;
        pipe(g, spendCx, pipeTop, pw, groundY, "#2e7d4f", "#1b4a2f", "#5cb87a");
        ptext(g, "SPEND", 3, pipeTop - 12, TEAL, "left");
        ptext(g, rmShort(totalSpend), 3, pipeTop - 2, TEAL, "left");

        // savings vault filling with coin rows; labels hug the right edge
        var vw = 34, vh = 28;
        var vx = Math.round(saveCx - vw / 2), vTop = groundY - vh;
        ctx.fillStyle = "#0a1a14";
        ctx.fillRect(vx, vTop, vw, vh);
        var fillRows = Math.floor(clamp(rate / 0.4, 0, 1) * 4);
        for (var r = 0; r < fillRows; r++) coinRow(g, vx + 4, groundY - 7 - r * 5, 6);
        ctx.fillStyle = GOLD_DARK;
        ctx.fillRect(vx, vTop, 2, vh); ctx.fillRect(vx + vw - 2, vTop, 2, vh);
        ctx.fillRect(vx, groundY - 2, vw, 2);
        ctx.fillStyle = GOLD;
        ctx.fillRect(vx - 1, vTop, 4, 2); ctx.fillRect(vx + vw - 3, vTop, 4, 2);
        ptext(g, "SAVE", w - 3, vTop - 12, GOLD, "right");
        ptext(g, rmShort(g.m.savings), w - 3, vTop - 2, GOLD, "right");

        // coins spurting from the block (saved coins drop into the
        // left half of the vault, clear of the right-edge labels)
        if (!g.reduced && g.dt) {
          if (Math.random() < Math.min(0.8, spendShare * 0.45)) spawnCoin(g, w / 2, by + bs, spendCx, pipeTop);
          if (rate > 0.01 && Math.random() < Math.min(0.8, rate * 2)) spawnCoin(g, w / 2, by + bs, saveCx - 8, vTop);
          if (spendShare > 1 && Math.random() < 0.3) {
            g.particles.spawn({
              x: spendCx + (Math.random() - 0.5) * pw, y: pipeTop + 4,
              vx: (Math.random() - 0.5) * 14, vy: -20, g: 90,
              size: 2, life: 0.9, color: RED, alpha: 0.9
            });
          }
        }

        brickGround(g, groundY);
        mascot.draw(ctx, w / 2, groundY, Math.min(h * 0.26, 40), { gaze: rate >= 0.05 ? 0.5 : -0.5 });
      }
    }
  });

  /* ============================================================
     WORLD 1-2 — Protection: the brick shield
     ============================================================ */

  /* shared global money state — World 1-1 and World 1-2 read & write the
     SAME income, so moving the slider in one world moves it in the other.
     (World 1-2 now models liabilities explicitly via its own mortgage /
     non-mortgage sliders, so it no longer borrows World 1-1's debt figure.) */
  var GLOBAL = { income: 5000, debt: 800 };
  var insurancePhase = 0;                 // 0 = Brick Shield form · 1 = Force Field form

  var shieldRef = { ratio: 1, x: 0 };
  var FULL_MED = 1000000;                  // RM 1M annual limit = a maxed force field

  /* Unified Capy scene — BOTH defences are drawn on the same canvas at all
     times, regardless of which input form (phase) is on screen below:
       • the brick wall in front of Capy  = Life cover / Phase-1 target
       • the force-field dome around Capy = Medical-card limit / RM 1M
     Toggling phases only swaps the form UI underneath, never this graphic. */
  function drawCapyDefenses(g, groundY) {
    var ctx = g.ctx, w = g.w, h = g.h;
    var lifeRatio = clamp(g.m.ratio, 0, 1.2);
    var fieldRatio = clamp(g.m.forcefield, 0, 1.2);
    var noCard = !g.values.medlimit;          // RM 0 limit = no medical card at all

    var capH = Math.min(h * 0.26, 40);
    var capX = Math.round(w * 0.4);
    var cy = Math.round(groundY - capH * 0.55);

    // ---- FORCE FIELD: pixel dome around Capy (drawn first, behind Capy) ----
    var R = Math.min(w * 0.24, 28);
    var segs = 22;
    var litF = Math.round(clamp(fieldRatio, 0, 1) * segs);
    var lowF = fieldRatio < 0.5;
    var flickF = (lowF || noCard) && !g.reduced ? (((g.t * 8) | 0) % 2 === 0) : true;
    var ffColor = noCard ? RED : fieldRatio >= 1 ? TEAL : fieldRatio >= 0.5 ? GOLD : "#d99a4a";
    for (var i = 0; i < segs; i++) {
      var ang = (i / segs) * Math.PI * 2 - Math.PI / 2;
      var px = capX + Math.cos(ang) * R;
      var py = cy + Math.sin(ang) * R * 0.95;
      if (!noCard && i < litF && flickF) {
        ctx.fillStyle = ffColor;
        ctx.fillRect(Math.round(px - 1), Math.round(py - 1), 2, 2);
      } else {
        ctx.fillStyle = "rgba(159,216,196,0.16)";
        ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
      }
    }
    if (!noCard && fieldRatio >= 1 && !g.reduced && Math.random() < 0.12) {
      var sa = Math.random() * Math.PI * 2;
      g.particles.spawn({
        x: capX + Math.cos(sa) * R, y: cy + Math.sin(sa) * R * 0.95,
        vx: 0, vy: -6, size: 1, life: 0.7, color: GOLD_LIGHT, alpha: 0.9
      });
    }

    brickGround(g, groundY);
    mascot.draw(ctx, capX, groundY, capH, { gaze: 0.6 });

    // ---- BRICK SHIELD: vertical wall in front of Capy (lit = life cover) ----
    var bsz = 8;
    var wallX = Math.round(w * 0.66);
    var rows = 5, cols = 2;
    var lit = Math.round(clamp(lifeRatio, 0, 1) * rows * cols);
    shieldRef.ratio = lifeRatio;
    shieldRef.x = wallX;
    var flicker = lifeRatio < 0.45 && !g.reduced ? (((g.t * 9) | 0) % 3 !== 0) : true;
    var idx = 0;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var bx = wallX + c * bsz;
        var by = groundY - (r + 1) * bsz;
        if (idx < lit && flicker) {
          ctx.fillStyle = GOLD;
          ctx.fillRect(bx, by, bsz, bsz);
          ctx.fillStyle = GOLD_LIGHT;
          ctx.fillRect(bx + 1, by + 1, 2, 1);
          ctx.fillStyle = GOLD_DARK;
          ctx.fillRect(bx, by + bsz - 1, bsz, 1);
          ctx.fillRect(bx + bsz - 1, by, 1, bsz);
        } else {
          ctx.strokeStyle = "rgba(231,192,105,0.25)";
          ctx.strokeRect(bx + 0.5, by + 0.5, bsz - 1, bsz - 1);
        }
        idx++;
      }
    }
    if (lifeRatio >= 1 && !g.reduced && Math.random() < 0.1) {
      g.particles.spawn({
        x: wallX + Math.random() * bsz * 2, y: groundY - Math.random() * bsz * rows,
        vx: 0, vy: -8, size: 1, life: 0.8, color: GOLD_LIGHT, alpha: 0.9
      });
    }

    // incoming "life happens" hazards bounce off a strong wall, slip a weak one
    if (!g.reduced && g.dt && Math.random() < 0.06) {
      g.particles.spawn({
        x: w + 6,
        y: h * 0.25 + Math.random() * (groundY - h * 0.32),
        vx: -(28 + Math.random() * 22), vy: 0,
        size: 3, life: 10, color: "rgba(242,236,224,0.6)", alpha: 0.9,
        update: function (p) {
          if (p.resolved || p.x > shieldRef.x + bsz * 2 + 2) return;
          p.resolved = true;
          if (Math.random() < Math.min(1, shieldRef.ratio)) {
            p.vx = 40 + Math.random() * 25;   // bounced off the wall
            p.vy = -30 - Math.random() * 20;
            p.g = 100; p.color = GOLD_LIGHT; p.size = 2; p.life = p.age + 0.6;
          } else {
            p.color = RED;                     // slipped through the gap
            p.life = p.age + 0.7;
          }
        }
      });
    }

    // ---- medical-card status: gold card when insured, flashing alert at RM 0 ----
    if (!noCard) {
      var kx = Math.round(w * 0.1), ky = 12;
      ctx.fillStyle = GOLD;
      ctx.fillRect(kx, ky, 16, 11);
      ctx.fillStyle = GOLD_DARK;
      ctx.fillRect(kx, ky, 16, 1); ctx.fillRect(kx, ky + 10, 16, 1);
      ctx.fillStyle = "#2e7d4f";
      ctx.fillRect(kx + 6, ky + 2, 4, 7);
      ctx.fillRect(kx + 3, ky + 4, 10, 3);
    } else {
      var blink = g.reduced || (((g.t * 3) | 0) % 2 === 0);
      if (blink) {
        var aw = Math.min(w - 10, 128), ah = 22;
        var axx = Math.round(w / 2 - aw / 2), ayy = Math.round(h * 0.12);
        ctx.fillStyle = "rgba(217,106,74,0.94)";
        ctx.fillRect(axx, ayy, aw, ah);
        ctx.fillStyle = "#2a0d08";
        ctx.fillRect(axx, ayy, aw, 1); ctx.fillRect(axx, ayy + ah - 1, aw, 1);
        ctx.fillRect(axx, ayy, 1, ah); ctx.fillRect(axx + aw - 1, ayy, 1, ah);
        ptext(g, "CRITICAL RISK", w / 2, ayy + 9, "#fff3e6", "center");
        ptext(g, "NO MED CARD", w / 2, ayy + 18, "#fff3e6", "center");
      }
    }
  }

  engine.registerLevel("insurance", {
    name: "Protection",
    title: "World 1-2 · The Brick Shield",
    // two progressive input forms, toggled by one retro pixel button. The
    // canvas always shows both defences; only the form + title swap.
    phases: [
      { title: "The Brick Shield", cta: "Check Health Protection" },
      { title: "The Force Field", cta: "Back to Life Cover" }
    ],
    inputs: [
      { key: "income", group: "PHASE 1: LIFE PROTECTION", phase: 0, label: "Monthly income", sub: "(Synced with World 1-1)", min: 1000, max: 30000, step: 100, value: 5000, fmt: "money" },
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
        var groundY = g.h - 14;
        stars(g, 12, g.h * 0.35);
        // both defences, always — the form below decides nothing here
        drawCapyDefenses(g, groundY);
      }
    }
  });

  /* ============================================================
     WORLD 1-3 — Future: the flagpole climb
     ============================================================ */

  engine.registerLevel("retirement", {
    name: "Future",
    title: "World 1-3 · The Flagpole Climb",
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
        var ctx = g.ctx, w = g.w, h = g.h;
        var groundY = h - 12;
        var SCALE = 1.3;
        var ratio = clamp(g.m.ratio, 0, SCALE);
        stars(g, 14, h * 0.4);

        // staircase: a "money mound" launchpad (step 0) sized by current stash,
        // then climbing steps rising to the projected-pot height
        var nSteps = 8;
        var stairX0 = Math.round(w * 0.1);
        var poleX = Math.round(w * 0.86);
        var stairSpan = poleX - stairX0;
        var maxClimb = groundY - 22;
        var goalClimb = maxClimb / SCALE;               // height of the GOAL line
        var climb = maxClimb * (ratio / SCALE);         // projected-pot height
        var startR = clamp(g.m.startRatio == null ? 0 : g.m.startRatio, 0, 1);
        var launchH = Math.min(climb, goalClimb * startR);  // stash's share of the goal
        var ea = Math.exp(2) - 1;
        var tops = [];
        for (var i = 0; i < nSteps; i++) {
          var sh;
          if (i === 0) {
            sh = launchH;                               // the launchpad foundation
          } else {
            var f = (Math.exp(2 * i / (nSteps - 1)) - 1) / ea;   // 0→1 across climbing steps
            sh = launchH + (climb - launchH) * f;
          }
          sh = Math.max(2, Math.round(sh));
          tops.push(groundY - sh);
          var x = stairX0 + Math.round(i * stairSpan / nSteps);
          var xw = stairX0 + Math.round((i + 1) * stairSpan / nSteps) - x;
          if (i === 0 && launchH > 6) {
            // thick golden money-mound foundation, with coin texture
            ctx.fillStyle = "#c9a14a";
            ctx.fillRect(x, groundY - sh, xw, sh);
            for (var cyy = groundY - sh + 3; cyy < groundY - 2; cyy += 5) {
              for (var cxx = x + 2; cxx < x + xw - 2; cxx += 5) {
                ctx.fillStyle = GOLD_LIGHT;
                ctx.fillRect(cxx, cyy, 2, 2);
              }
            }
            ctx.fillStyle = GOLD_DARK;
            ctx.fillRect(x + xw - 1, groundY - sh, 1, sh);
            ctx.fillStyle = GOLD;
            ctx.fillRect(x, groundY - sh, xw, 1);
          } else {
            ctx.fillStyle = BRICK;
            ctx.fillRect(x, groundY - sh, xw, sh);
            ctx.fillStyle = BRICK_DARK;
            for (var yy = groundY - sh + 4; yy < groundY; yy += 5) ctx.fillRect(x, yy, xw, 1);
            ctx.fillRect(x + xw - 1, groundY - sh, 1, sh);
            ctx.fillStyle = GOLD;
            ctx.fillRect(x, groundY - sh, xw, 1);
          }
        }

        // goal line
        var goalY = Math.round(groundY - maxClimb / SCALE);
        ctx.fillStyle = "rgba(231,192,105,0.5)";
        for (var dx2 = stairX0; dx2 < w * 0.9; dx2 += 6) ctx.fillRect(dx2, goalY, 3, 1);
        ptext(g, "GOAL", stairX0 + 2, goalY - 4, "rgba(231,192,105,0.8)", "left");

        // flagpole — the flag rises with the funding ratio
        var poleTop = goalY - 6;
        ctx.fillStyle = "#8aa89c";
        ctx.fillRect(poleX, poleTop, 2, groundY - poleTop);
        ctx.fillStyle = GOLD_LIGHT;
        ctx.fillRect(poleX - 1, poleTop - 3, 4, 3);
        var flagY = Math.round(lerp(groundY - 10, poleTop + 2, clamp(ratio, 0, 1)));
        ctx.fillStyle = ratio >= 1 ? GOLD : "#c9a14a";
        ctx.fillRect(poleX - 9, flagY, 9, 4);
        ctx.fillRect(poleX - 6, flagY + 4, 6, 2);

        // fireworks when the goal is beaten
        if (ratio >= 1 && !g.reduced && Math.random() < 0.05) {
          var fx2 = poleX - 10 + Math.random() * 20, fy2 = poleTop - 4 - Math.random() * 10;
          for (var s2 = 0; s2 < 8; s2++) {
            var ang = (s2 / 8) * Math.PI * 2;
            g.particles.spawn({
              x: fx2, y: fy2,
              vx: Math.cos(ang) * 20, vy: Math.sin(ang) * 20,
              size: 1, life: 0.7, color: s2 % 2 ? GOLD_LIGHT : TEAL, alpha: 1
            });
          }
        }

        brickGround(g, groundY);

        // Capy climbs the staircase on a loop — standard horizontal motion.
        // The launchpad foundation (step 0) is what lifts the start tier; the
        // Capy's left↔right position no longer tracks the stash.
        var p = g.reduced ? 0.6 : (g.t * 0.07) % 1;
        var stepIdx = Math.min(nSteps - 1, Math.floor(p * nSteps));
        var capX = stairX0 + p * stairSpan;
        var capY = tops[stepIdx];
        mascot.draw(ctx, capX, capY, Math.min(h * 0.2, 32), { walk: g.t * 6, gaze: 0.8 });
      }
    }
  });

  /* ============================================================
     WORLD 1-4 — Legacy: the map home
     (handled gently — a calm night scene, never an alarmed mascot)
     ============================================================ */

  // tracks the Will toggle so the frozen-coins stash can SLIDE through the
  // gate (rather than teleport) the moment the Will is written
  var legacyCoins = { will: false, t0: -1 };

  engine.registerLevel("legacy", {
    name: "Legacy",
    title: "World 1-4 · THE WILLOW GATE",
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
        var ctx = g.ctx, w = g.w, h = g.h;
        var groundY = h - 14;                  // floor line matches World 1-1
        var v = g.values;
        var epf = !!v.epf;                     // nominees → a stream of love
        var hibah = !!v.hibah;                 // Hibah → an instant wealth conduit
        var will = !!v.will;                   // Will → the coins clear the gate
        var loved = Math.max(1, Math.round(v.loved || 1));

        stars(g, 22, h * 0.5);

        // pixel moon — low enough to clear the HUD bubble/stat strip on top
        var moonX = Math.round(w * 0.40), moonY = Math.round(h * 0.26);
        ctx.fillStyle = "rgba(246,231,189,0.8)";
        ctx.fillRect(moonX, moonY, 7, 7);
        ctx.fillRect(moonX - 2, moonY + 2, 11, 3);
        ctx.fillStyle = "rgba(201,161,74,0.4)";
        ctx.fillRect(moonX + 2, moonY + 3, 2, 2);

        // --- anchors: Capy (left) · Willow archway (centre) · home (right) ---
        var capH = Math.min(h * 0.26, 30);
        var capX = Math.round(w * 0.12);
        var capChestY = Math.round(groundY - capH * 0.45);

        var gateX = Math.round(w * 0.45);
        var gateH = Math.min(h * 0.52, 52);                 // taller, prominent arch
        var gateTop = Math.round(groundY - gateH);
        var openHalf = Math.max(7, Math.round(w * 0.05));   // half the doorway
        var pillarW = 4;
        var springY = Math.round(gateTop + gateH * 0.34);   // arch springline

        // home scaled down ~12% to free room for the coin piles + capybaras
        var houseW = Math.round(Math.min(w * 0.19, 28));
        var houseH = Math.round(Math.min(h * 0.35, 30));
        var houseCX = Math.round(w * 0.85);
        var houseBaseY = groundY;                           // sits low on the ground

        // waiting loved-ones cluster, just in front of (left of) the home
        var clusterRight = houseCX - Math.round(houseW / 2) - 3;
        var clusterCX = clusterRight - 8;

        // flight path: Capy's chest → the waiting capybaras, through the gate
        var sx = capX + 5, sy = capChestY;
        var ex = clusterCX, ey = groundY - 5;
        function px(t) { return sx + (ex - sx) * t; }
        function py(t) { return sy + (ey - sy) * t; }

        // --- thin grass ground (structures sit on top) ---------------------
        ctx.fillStyle = BRICK;
        ctx.fillRect(0, groundY, w, h - groundY);
        ctx.fillStyle = "rgba(159,216,196,0.5)";
        ctx.fillRect(0, groundY, w, 1);

        // --- the cleared path (gold once a Will is written, else faint) -----
        if (will) {
          for (var bt = 0.04; bt < 0.99; bt += 0.045) {
            var bx = Math.round(px(bt)), by = Math.round(py(bt));
            ctx.fillStyle = GOLD;
            ctx.fillRect(bx, by + 5, 3, 2);
            ctx.fillStyle = GOLD_DARK;
            ctx.fillRect(bx, by + 7, 1, 2);
          }
        } else {
          for (var dt2 = 0.06; dt2 < 0.96; dt2 += 0.09) {
            ctx.fillStyle = "rgba(242,236,224,0.20)";
            ctx.fillRect(Math.round(px(dt2)), Math.round(py(dt2)) + 5, 1, 1);
          }
        }

        // --- HIBAH: a glowing teal conduit + fast motes (instant transfer) --
        if (hibah) {
          for (var ct = 0.02; ct < 1; ct += 0.025) {
            var cx2 = Math.round(px(ct)), cy2 = Math.round(py(ct));
            var pulse = (Math.sin(g.t * 6 - ct * 12) + 1) / 2;
            ctx.fillStyle = "rgba(159,216,196," + (0.22 + pulse * 0.5).toFixed(2) + ")";
            ctx.fillRect(cx2, cy2 + 1, 2, 2);
          }
          var motes = g.reduced ? 3 : 5;
          for (var m2 = 0; m2 < motes; m2++) {
            var mt = g.reduced ? (m2 / motes) : ((g.t * 0.9 + m2 / motes) % 1);
            var mx = Math.round(px(mt)), my = Math.round(py(mt));
            ctx.fillStyle = TEAL;
            ctx.fillRect(mx, my, 3, 3);
            ctx.fillStyle = GOLD_LIGHT;
            ctx.fillRect(mx + 1, my + 1, 1, 1);
          }
        }

        // --- the WILLOW GATE: a vintage stone archway -----------------------
        var lit = will;
        var stone = lit ? GOLD : "rgba(231,192,105,0.34)";
        var stoneHi = lit ? GOLD_LIGHT : "rgba(246,231,189,0.32)";
        var stoneLo = lit ? GOLD_DARK : "rgba(122,90,30,0.42)";
        var lpx = gateX - openHalf - pillarW;   // left pillar
        var rpx = gateX + openHalf;             // right pillar
        var pillarBot = groundY - 2;
        ctx.fillStyle = stone;
        ctx.fillRect(lpx, springY, pillarW, pillarBot - springY);
        ctx.fillRect(rpx, springY, pillarW, pillarBot - springY);
        ctx.fillStyle = stoneHi;                // lit left edge
        ctx.fillRect(lpx, springY, 1, pillarBot - springY);
        ctx.fillRect(rpx, springY, 1, pillarBot - springY);
        ctx.fillStyle = stoneLo;                // shaded right edge + seams
        ctx.fillRect(lpx + pillarW - 1, springY, 1, pillarBot - springY);
        ctx.fillRect(rpx + pillarW - 1, springY, 1, pillarBot - springY);
        for (var sy2 = springY + 5; sy2 < pillarBot; sy2 += 6) {
          ctx.fillRect(lpx, sy2, pillarW, 1);
          ctx.fillRect(rpx, sy2, pillarW, 1);
        }
        ctx.fillStyle = stone;                  // chunky base plinths → reads as a gate
        ctx.fillRect(lpx - 1, pillarBot, pillarW + 2, 2);
        ctx.fillRect(rpx - 1, pillarBot, pillarW + 2, 2);
        // the arch ring — stepped voussoir blocks curving over the doorway
        var rC = openHalf + pillarW / 2;
        var archVR = springY - gateTop;
        var steps = 8;
        for (var a = 0; a <= steps; a++) {
          var ang = Math.PI * (a / steps);
          var ox = gateX - Math.cos(ang) * rC;
          var oy = springY - Math.sin(ang) * archVR;
          ctx.fillStyle = stone;
          ctx.fillRect(Math.round(ox - pillarW / 2), Math.round(oy), pillarW, 5);
          ctx.fillStyle = stoneHi;
          ctx.fillRect(Math.round(ox - pillarW / 2), Math.round(oy), pillarW, 1);
        }
        // drooping willow strands from the archway underside
        ctx.fillStyle = lit ? "rgba(159,216,196,0.85)" : "rgba(159,216,196,0.32)";
        for (var s = 0; s < 5; s++) {
          var wx = gateX - openHalf + 1 + s * Math.round((openHalf * 2 - 2) / 4);
          var sway = g.reduced ? 0 : Math.round(Math.sin(g.t * 1.4 + s) * 1);
          ctx.fillRect(wx + sway, springY + 1, 1, 5 + (s % 2) * 4);
        }

        // --- the family HOME (right, larger, sitting low) -------------------
        var hx0 = houseCX - Math.round(houseW / 2);
        var bodyTop = houseBaseY - Math.round(houseH * 0.6);
        ctx.fillStyle = "#d8b86a";
        ctx.fillRect(hx0, bodyTop, houseW, houseBaseY - bodyTop);
        ctx.fillStyle = GOLD_DARK;
        ctx.fillRect(hx0, bodyTop, houseW, 1);
        ctx.fillRect(hx0, houseBaseY - 1, houseW, 1);
        var roofH = Math.round(houseH * 0.42);
        var roofTopY = bodyTop - roofH;
        var halfW = Math.round(houseW / 2) + 1;
        for (var ry = 0; ry <= roofH; ry++) {
          var ww = Math.round(halfW * 2 * (ry / roofH)) + 1;
          ctx.fillStyle = "#b5894a";
          ctx.fillRect(houseCX - Math.round(ww / 2), roofTopY + ry, ww, 1);
        }
        ctx.fillStyle = "#7a5a1e";              // chimney
        ctx.fillRect(hx0 + houseW - 5, roofTopY + 2, 3, roofH - 2);
        var winGlow = will ? "rgba(246,231,189,0.95)" : "rgba(246,231,189,0.55)";
        var dwW = Math.max(3, Math.round(houseW * 0.26));
        var dwH = Math.round(houseH * 0.4);
        ctx.fillStyle = "#5a3d1e";              // doorway
        ctx.fillRect(houseCX - Math.round(dwW / 2), houseBaseY - dwH, dwW, dwH);
        ctx.fillStyle = winGlow;               // lit windows
        ctx.fillRect(hx0 + 2, bodyTop + 3, 3, 3);
        ctx.fillRect(hx0 + houseW - 5, bodyTop + 3, 3, 3);

        // --- waiting loved ones: small capybaras in front of the home -------
        for (var i = 0; i < loved; i++) {
          var rowIdx = i >= 4 ? 1 : 0;          // wrap to a back row past 4
          var colIdx = rowIdx ? i - 4 : i;
          var mcx = clusterRight - colIdx * 8 - rowIdx * 4;
          var mby = groundY - rowIdx * 3;
          miniCapy(g, mcx, mby, true);
        }

        // --- the FROZEN COINS mechanic: the Will SLIDES the stash through ---
        var fcXL = Math.round(w * 0.30);          // locked, on Capy's side
        var fcXR = Math.round(w * 0.63);          // cleared, on the family's side
        // detect the Will toggle flipping → start the slide (or re-freeze)
        if (will && !legacyCoins.will) legacyCoins.t0 = g.t;
        if (!will) legacyCoins.t0 = -1;
        legacyCoins.will = will;
        var MOVE = 0.9;                            // slide duration (seconds)
        var moveP = !will ? 0
          : (g.reduced || legacyCoins.t0 < 0) ? 1
          : clamp((g.t - legacyCoins.t0) / MOVE, 0, 1);

        if (!will) {
          // locked on the Capy's (left) side, encased in frosted ice
          var st = coinStack(g, fcXL, groundY, true);
          var shim = g.reduced ? 0.5 : 0.30 + 0.3 * ((Math.sin(g.t * 2) + 1) / 2);
          ctx.fillStyle = "rgba(206,234,255," + shim.toFixed(2) + ")";
          ctx.fillRect(st.x0 - 2, st.top - 2, st.w + 4, 1);
          ctx.fillRect(st.x0 - 2, groundY - 1, st.w + 4, 1);
          ctx.fillRect(st.x0 - 2, st.top - 2, 1, groundY - st.top + 1);
          ctx.fillRect(st.x0 + st.w + 1, st.top - 2, 1, groundY - st.top + 1);
          if (!g.reduced) {
            for (var fp = 0; fp < 5; fp++) {
              var fy = st.top + ((g.t * 6 + fp * 5) % (groundY - st.top));
              ctx.fillStyle = "rgba(224,242,255,0.5)";
              ctx.fillRect(st.x0 + (fp * 4) % st.w, Math.round(fy), 1, 1);
            }
          }
        } else if (moveP < 1) {
          // IN TRANSIT: the icy stash flies horizontally through the arch centre
          var mx2 = Math.round(fcXL + (fcXR - fcXL) * moveP);
          var lift = Math.round(Math.sin(moveP * Math.PI) * gateH * 0.4);
          coinStack(g, mx2, groundY - lift, true);
          if (!g.reduced && Math.random() < 0.6) {   // frost trail behind them
            g.particles.spawn({
              x: mx2 - 8, y: groundY - lift - 6, vx: -5, vy: -2,
              size: 1, life: 0.5, color: "rgba(188,220,240,0.9)", alpha: 0.85
            });
          }
        } else {
          // ARRIVED: coins land on the family's side and shine, freshly unlocked
          var st2 = coinStack(g, fcXR, groundY, false);
          var twk = (Math.sin(g.t * 5) + 1) / 2;
          ctx.fillStyle = "rgba(246,231,189," + (0.4 + twk * 0.6).toFixed(2) + ")";
          ctx.fillRect(fcXR - 2, st2.top - 3, 5, 1);   // sparkle cross on the cap
          ctx.fillRect(fcXR, st2.top - 5, 1, 5);
          if (!g.reduced && Math.random() < 0.5) {
            g.particles.spawn({
              x: fcXR + (Math.random() - 0.5) * 14, y: groundY - 4 - Math.random() * 12,
              vx: 0, vy: -6, size: 1, life: 0.7, color: GOLD_LIGHT, alpha: 1
            });
          }
        }

        // --- corner status labels (small pixel scale), clear of the centre
        // and tucked just under the HUD bubble / stat chip ------------------
        if (!will) {
          // top-left corner, mapping to the frozen stash on the left below
          ptext(g, "Frozen Coins", 3, Math.round(h * 0.34), "rgba(206,234,255,0.95)", "left", 6);
        } else {
          // top-right corner, sitting above the house + the shining coin pile.
          // kept short ("passed") so it clears the wider 2-line speech bubble
          var ry1 = Math.round(h * 0.28);
          ptext(g, "Coins passed", w - 3, ry1, "rgba(246,231,189,0.95)", "right", 6);
          ptext(g, "to loved ones", w - 3, ry1 + 8, "rgba(246,231,189,0.95)", "right", 6);
        }

        // --- EPF: a continuous stream of love hearts to the loved ones ------
        if (epf) {
          var nH = Math.min(6, 3 + loved);
          for (var k = 0; k < nH; k++) {
            var t = g.reduced ? (0.2 + 0.7 * (k / nH)) : ((g.t * 0.45 + k / nH) % 1);
            heart(ctx, Math.round(px(t) - 2), Math.round(py(t) - 1), RED);
            if (t > 0.93 && !g.reduced && Math.random() < 0.25) {
              g.particles.spawn({
                x: ex, y: ey, vx: (Math.random() - 0.5) * 5, vy: -3,
                size: 1, life: 0.6, color: GOLD_LIGHT, alpha: 0.9
              });
            }
          }
        }

        // --- Capy, drawn last so it always reads on top --------------------
        mascot.draw(ctx, capX, groundY, capH, { gaze: 0.8 });
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

  var progress = {};
  var chips = {};

  engine.order.forEach(function (id, i) {
    var def = engine.levels[id];
    var b = document.createElement("button");
    b.className = "journey__chip";
    b.type = "button";
    b.setAttribute("role", "tab");
    b.innerHTML =
      '<span class="journey__chip-num">' + (i + 1) + "</span>" +
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

      // legacy keys: full-width, thumb-friendly toggles (World 1-2 switch
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
      // income & debt are shared world state — seed the slider from GLOBAL so
      // a value set in World 1-1 shows up here (and vice-versa). Every other
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
    tagEl.textContent = "World 1-" + (i + 1);
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
    // remember the live inputs for the active world so the cross-world
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
     CROSS-WORLD ROADMAP — the "Turn this into a real plan" popup
     Compiles all four worlds (titles, every selection, readiness
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
  engine.order.forEach(function (id) { worldValues[id] = seedDefaults(engine.levels[id]); });

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
        tag: "World 1-" + (i + 1),
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
      + '<p class="plan-report__intro">A snapshot of your four-world money quest with Capy. '
      + 'Bring this to your session with Sofina.</p></div>';

    report.worlds.forEach(function (wld) {
      var primary = wld.sections[0].st;
      var p = clamp(Math.round((primary.power && primary.power.pct) || primary.score || 0), 0, 100);
      var tone = primary.power ? primary.power.tone : "gold";
      html += '<section class="plan-world">'
        + '<div class="plan-world__top"><div>'
        + '<p class="plan-world__tag">' + esc(wld.tag) + '</p>'
        + '<p class="plan-world__name">' + esc(wld.name) + '</p></div>'
        + '<span class="plan-world__score">' + esc(primary.stat || (primary.score + "%")) + '</span></div>'
        + '<div class="plan-bar"><div class="plan-bar__fill' + toneClass(tone) + '" style="width:' + p + '%"></div></div>';

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
    L.push("CAPY'S MONEY QUEST — ROADMAP");
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
        L.push("Capy says: “" + sec.st.say + "”");
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

  /* ---------- PDF download (html2canvas + jsPDF, lazy-loaded) ----------
     The PDF body is a pixel-faithful capture of the exact roadmap the user
     sees on screen (#planReport): same fonts, colours, bars and cards. The
     capture is sliced across A4 pages at world-card boundaries so nothing
     gets cut mid-card. A small branded header/footer is added per page.
     Both libraries are only fetched the first time the button is clicked. */

  var JSPDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  var H2C_CDN   = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";

  function loadScript(src, onload, onerror) {
    var s = document.createElement("script");
    s.src = src;
    s.onload = onload;
    s.onerror = onerror;
    document.head.appendChild(s);
  }

  function resetPrintBtn() {
    if (planPrintBtn) { planPrintBtn.disabled = false; planPrintBtn.textContent = "Download PDF"; }
  }

  // Lazy-load jsPDF, then html2canvas, then run cb().
  function loadPdfLibs(cb) {
    function haveJsPDF() { return window.jspdf && window.jspdf.jsPDF; }
    function haveH2C()   { return !!window.html2canvas; }
    function fail() {
      resetPrintBtn();
      setStatus("Couldn't load the PDF tools — check your connection and try again.", "err");
    }
    function ensureH2C() {
      if (haveH2C()) { cb(); return; }
      loadScript(H2C_CDN, cb, fail);
    }
    if (haveJsPDF()) { ensureH2C(); return; }
    loadScript(JSPDF_CDN, ensureH2C, fail);
  }

  function downloadRoadmapPDF(report) {
    var node = document.getElementById("planReport");
    // The modal must be open & rendered for an accurate on-screen capture.
    if (!node || !node.innerHTML.trim()) {
      node = document.getElementById("planReport");
      if (node) node.innerHTML = renderReportHTML(report || collectReport());
    }
    if (!node) { resetPrintBtn(); return; }

    var JsPDF = window.jspdf.jsPDF;
    var doc = new JsPDF({ unit: "mm", format: "a4", compress: true });
    var PW = doc.internal.pageSize.getWidth();   // 210
    var PH = doc.internal.pageSize.getHeight();  // 297
    var ML = 12, MR = 12, MB = 12;
    var CW = PW - ML - MR;                        // 186
    var HEADER_H = 24;                            // branded header band (mm)
    var BODY_TOP = HEADER_H + 6;                  // body starts below header

    var INK     = [11,  31,  26];
    var GOLD    = [201, 161, 74];
    var CREAM   = [242, 236, 224];
    var MUTED   = [120, 118, 115];
    var PAGE_BG = [253, 253, 248];                // = dialog bg (#fffdf8)

    function tc(c) { doc.setTextColor(c[0], c[1], c[2]); }
    function fc(c) { doc.setFillColor(c[0], c[1], c[2]); }

    function paintPageBg() { fc(PAGE_BG); doc.rect(0, 0, PW, PH, "F"); }

    // Branded header band, drawn on every page so the document stays consistent.
    function drawHeader() {
      fc(INK);  doc.rect(0, 0, PW, HEADER_H, "F");
      fc(GOLD); doc.rect(0, HEADER_H, PW, 1, "F");
      tc(GOLD); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      doc.text("CAPY'S QUEST  by  SOFINA JOHARI", ML, 9);
      tc(CREAM); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
      doc.text("YOUR MONEY JOURNEY ROADMAP", ML, 18);
      var dateStr = new Date().toLocaleDateString("en-MY",
        { day: "numeric", month: "long", year: "numeric" });
      tc(GOLD); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      doc.text(dateStr, PW - MR, 9, { align: "right" });
    }

    function finish() {
      // page-number footers
      var nPages = doc.internal.getNumberOfPages();
      for (var p = 1; p <= nPages; p++) {
        doc.setPage(p);
        tc(MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
        doc.text(String(p) + " / " + String(nPages), PW / 2, PH - 6, { align: "center" });
      }
      var blob = doc.output("blob");
      var a    = document.createElement("a");
      a.href   = URL.createObjectURL(blob);
      a.download = "capy-roadmap-sofina.pdf";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 1000);
      resetPrintBtn();
      setStatus("", null);
    }

    function fail() {
      resetPrintBtn();
      setStatus("Couldn't build the PDF — please try again.", "err");
    }

    // Wait for web fonts (the pixel font) so the capture matches the screen.
    var fontsReady = (document.fonts && document.fonts.ready)
      ? document.fonts.ready : Promise.resolve();

    fontsReady.then(function () {
      return window.html2canvas(node, {
        backgroundColor: "#fffdf8",
        scale: Math.min(2.5, (window.devicePixelRatio || 1) * 1.5),
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY
      });
    }).then(function (canvas) {
      var reportW = node.getBoundingClientRect().width;   // CSS px
      var pxPerCss = canvas.width / reportW;               // capture px per CSS px
      var mmPerCss = CW / reportW;                         // PDF mm per CSS px
      var totalCss = canvas.height / pxPerCss;

      // Break candidates: bottom edge of each card, so pages never cut a card.
      var rTop = node.getBoundingClientRect().top + window.scrollY;
      var blocks = node.querySelectorAll(".plan-report__head, .plan-world");
      var breaks = [];
      Array.prototype.forEach.call(blocks, function (b) {
        var r = b.getBoundingClientRect();
        breaks.push((r.top + window.scrollY - rTop) + r.height);
      });
      if (!breaks.length || breaks[breaks.length - 1] < totalCss - 1) breaks.push(totalCss);

      var usableMM  = PH - BODY_TOP - MB;
      var usableCss = usableMM / mmPerCss;                 // body height per page in CSS px

      var startCss = 0;
      var first = true;
      var guard = 0;
      while (startCss < totalCss - 0.5 && guard++ < 200) {
        var limit = startCss + usableCss;
        // largest card boundary that fits on this page
        var endCss = -1;
        for (var i = 0; i < breaks.length; i++) {
          if (breaks[i] > startCss + 1 && breaks[i] <= limit + 0.5) endCss = breaks[i];
        }
        // a single card taller than one page → hard slice
        if (endCss < 0) endCss = Math.min(limit, totalCss);
        endCss = Math.min(endCss, totalCss);

        var sY = Math.max(0, Math.round(startCss * pxPerCss));
        var sH = Math.min(canvas.height - sY, Math.round((endCss - startCss) * pxPerCss));
        if (sH <= 0) break;

        var slice = document.createElement("canvas");
        slice.width  = canvas.width;
        slice.height = sH;
        var ctx = slice.getContext("2d");
        ctx.fillStyle = "#fffdf8";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, sY, canvas.width, sH, 0, 0, canvas.width, sH);
        var img = slice.toDataURL("image/jpeg", 0.92);

        if (!first) doc.addPage();
        paintPageBg();
        drawHeader();
        var hMM = (sH / pxPerCss) * mmPerCss;
        doc.addImage(img, "JPEG", ML, BODY_TOP, CW, hMM);

        first = false;
        startCss = endCss;
      }

      finish();
    }).catch(fail);
  }

  if (planBtn) planBtn.addEventListener("click", openPlan);
  if (planClose) planClose.addEventListener("click", closePlan);
  if (planBackdrop) planBackdrop.addEventListener("click", closePlan);
  if (planPrintBtn) planPrintBtn.addEventListener("click", function () {
    if (!currentReport) currentReport = collectReport();
    planPrintBtn.disabled = true;
    planPrintBtn.textContent = "Generating...";
    loadPdfLibs(function () { downloadRoadmapPDF(currentReport); });
  });
  if (planSendBtn) planSendBtn.addEventListener("click", sendToSofina);

  engine.start(engine.order[0]);
  // re-measure once layout has settled, and repaint when the pixel font lands
  requestAnimationFrame(function () { engine._resize(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { if (engine.level) engine._renderFrame(0); });
  }
})();
