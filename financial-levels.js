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

  function ptext(g, str, x, y, color, align) {
    var ctx = g.ctx;
    ctx.font = "8px " + PFONT;
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
      { title: "The Brick Shield", cta: "Check Health Protection &nbsp;&rarr;" },
      { title: "The Force Field", cta: "&larr;&nbsp; Back to Life Cover" }
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

  engine.registerLevel("legacy", {
    name: "Legacy",
    title: "World 1-4 · THE WILLOW GATE",
    inputs: [
      { key: "loved", label: "Loved ones", min: 1, max: 8, step: 1, value: 3, fmt: "people" },
      {
        key: "keys", type: "keyrow", label: "Legacy Keys",
        items: [
          { key: "epf", label: "EPF and/or Tabung Haji Nominees Added", value: 0 },
          { key: "will", label: "Will / Wasiat Written", value: 0 },
          { key: "hibah", label: "Hibah / Insurance Beneficiary Assigned", value: 0 }
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

      // --- conversational Malaysian estate-planning commentary ----------
      var coach;
      if (!epf && !will && !hibah) {
        coach = "🚨 ASSETS FROZEN: Without an estate plan, your hard-earned coins are "
          + "locked in legal limbo. Your " + loved + " loved ones will face a complex, "
          + "multi-year probate court maze just to access your bank accounts.";
      } else if (epf && will && hibah) {
        coach = "✨ LEGACY SECURED! Your wealth is completely unfrozen and mapped directly "
          + "to your " + loved + " loved ones. With valid wills and Hibah express lanes in "
          + "place, your coins transfer instantly with zero legal delays.";
      } else if (will) {
        coach = "🧱 COURT RUNWAY: Your Will/Wasiat ensures physical properties are "
          + "distributed exactly how you want. However, Wills still must clear the slow "
          + "probate court process. Consider a Hibah or direct nomination to provide your "
          + "family with immediate cash.";
      } else {
        coach = "⚡ EXPRESS LANE ACTIVE: Your nominated funds or Hibah will bypass the "
          + "courts entirely and reach your beneficiaries instantly. However, your physical "
          + "properties or un-nominated cash savings remain frozen without a Will/Wasiat.";
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
        var groundY = h - 10;
        var v = g.values;
        var express = !!(v.epf || v.hibah);   // either melts the legal ice block
        var will = !!v.will;                   // completes the structural bridge
        stars(g, 30, h * 0.6);

        // pixel moon (mid-left sky, clear of the HUD strip)
        ctx.fillStyle = "rgba(246,231,189,0.8)";
        ctx.fillRect(12, 24, 8, 8);
        ctx.fillRect(10, 26, 12, 4);
        ctx.fillStyle = "rgba(201,161,74,0.4)";
        ctx.fillRect(15, 27, 2, 2);

        // anchors: Capy (left) → Willow Gate (centre) → the home (upper right)
        var capX = Math.round(w * 0.13), capY = groundY;
        var houseX = Math.round(w * 0.84), houseY = Math.round(h * 0.34);
        var gateX = Math.round(w * 0.50), gateTop = Math.round(h * 0.30);
        var sx = capX + 6, sy = capY - 14;     // heart launch point (Capy's chest)
        var ex = houseX, ey = houseY + 8;      // the home's doorway
        function px(t) { return sx + (ex - sx) * t; }
        function py(t) { return sy + (ey - sy) * t; }
        var iceAt = 0.62;                      // where the frozen barrier sits

        // --- WILL: a solid structural bridge from Capy through the gate home
        if (will) {
          for (var bt = 0.05; bt < 0.98; bt += 0.045) {
            var bx = Math.round(px(bt)), by = Math.round(py(bt));
            ctx.fillStyle = GOLD;
            ctx.fillRect(bx, by + 5, 3, 2);
            ctx.fillStyle = GOLD_DARK;
            ctx.fillRect(bx, by + 7, 1, 4);
          }
        } else {
          // faint dotted trail — the path is not yet a solid bridge
          for (var dt2 = 0.06; dt2 < 0.96; dt2 += 0.08) {
            ctx.fillStyle = "rgba(242,236,224,0.22)";
            ctx.fillRect(Math.round(px(dt2)), Math.round(py(dt2)) + 5, 1, 1);
          }
        }

        // --- the Willow Gate frame (its pathways open once a Will is written)
        var postCol = will ? GOLD : "rgba(231,192,105,0.35)";
        var gateH = groundY - gateTop;
        ctx.fillStyle = postCol;
        ctx.fillRect(gateX - 16, gateTop, 3, gateH);     // left post
        ctx.fillRect(gateX + 13, gateTop, 3, gateH);     // right post
        ctx.fillRect(gateX - 16, gateTop, 32, 3);        // lintel
        ctx.fillStyle = will ? "rgba(159,216,196,0.85)" : "rgba(159,216,196,0.3)";
        for (var s = 0; s < 5; s++) {                    // drooping willow strands
          var wx = gateX - 12 + s * 6;
          var sway = g.reduced ? 0 : Math.round(Math.sin(g.t * 1.4 + s) * 1);
          ctx.fillRect(wx + sway, gateTop + 3, 1, 6 + (s % 2) * 4);
        }

        // --- the home (upper right)
        var houseCol = will ? GOLD : "rgba(231,192,105,0.55)";
        ctx.fillStyle = houseCol;
        ctx.fillRect(houseX - 6, houseY - 4, 12, 9);
        ctx.fillRect(houseX - 4, houseY - 8, 8, 4);
        ctx.fillRect(houseX - 1, houseY - 11, 2, 3);
        ctx.fillStyle = will ? BRICK_DARK : "rgba(10,26,20,0.6)";
        ctx.fillRect(houseX - 1, houseY + 1, 2, 4);      // door

        // --- FROZEN ice block: traps the hearts until an express key melts it
        if (!express) {
          var iceCx = Math.round(px(iceAt));
          var iceTopY = Math.round(h * 0.20);
          var iceBotY = groundY - 1;
          for (var iy = iceTopY; iy < iceBotY; iy += 4) {
            for (var ix = -7; ix <= 7; ix += 4) {
              var sh = 0.30 + 0.22 * Math.abs(Math.sin(g.t * 1.1 + iy * 0.25 + ix));
              ctx.fillStyle = "rgba(168,208,234," + (g.reduced ? "0.4" : sh.toFixed(2)) + ")";
              ctx.fillRect(iceCx + ix, iy, 3, 3);
            }
          }
          ctx.fillStyle = "rgba(224,242,255,0.75)";
          ctx.fillRect(iceCx - 8, iceTopY, 18, 1);
          ctx.fillRect(iceCx - 8, iceBotY - 1, 18, 1);
          ptext(g, "FROZEN", iceCx, iceTopY - 3, "rgba(206,234,255,0.95)");
        } else if (!g.reduced && g.dt && Math.random() < 0.14) {
          // express lane active: melt-water sparkles drift up where ice was
          g.particles.spawn({
            x: px(iceAt) + (Math.random() - 0.5) * 14, y: groundY - Math.random() * 22,
            vx: (Math.random() - 0.5) * 3, vy: -5 - Math.random() * 4,
            size: 1, life: 1.2, color: TEAL, alpha: 0.7
          });
        }

        // --- flying hearts: Capy's love, heading for the home
        var n = v.loved;
        for (var k = 0; k < n; k++) {
          var t;
          if (express) {
            // free flight: hearts shoot straight through into the house frame
            t = g.reduced ? (0.3 + 0.6 * (k / Math.max(1, n))) : ((g.t * 0.4 + k * 0.31) % 1);
            if (t > 0.95 && !g.reduced && Math.random() < 0.3) {
              g.particles.spawn({
                x: ex, y: ey, vx: (Math.random() - 0.5) * 6, vy: -3,
                size: 1, life: 0.6, color: GOLD_LIGHT, alpha: 0.9
              });
            }
          } else {
            // trapped: hearts bob in the open ground before the ice wall
            t = 0.10 + (iceAt - 0.18) * ((Math.sin(g.t * 1.6 + k * 1.7) + 1) / 2);
          }
          heart(ctx, Math.round(px(t) - 2), Math.round(py(t)),
            express ? RED : "rgba(217,106,74,0.55)");
        }

        // --- thin grass ground + Capy
        ctx.fillStyle = BRICK;
        ctx.fillRect(0, groundY, w, h - groundY);
        ctx.fillStyle = "rgba(159,216,196,0.5)";
        ctx.fillRect(0, groundY, w, 1);
        mascot.draw(ctx, capX, groundY, Math.min(h * 0.24, 36), { gaze: 0.8 });
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

      // legacy keys: a compact container of space-saving binary checkboxes
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
          lab.className = "journey__key";
          lab.setAttribute("for", kid);
          lab.innerHTML =
            '<input type="checkbox" id="' + kid + '"' + (on ? " checked" : "") + " />" +
            '<span class="journey__key-box" aria-hidden="true"></span>' +
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

  engine.start(engine.order[0]);
  // re-measure once layout has settled, and repaint when the pixel font lands
  requestAnimationFrame(function () { engine._resize(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { if (engine.level) engine._renderFrame(0); });
  }
})();
