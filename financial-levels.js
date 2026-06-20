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

  /* Minimal scene: only Capybara + the HTML Power bar overlay.
     Capybara is centred vertically in the canvas with equal top/bottom
     gaps so it stays equidistant from the summary box and power bar. */
  function drawOnlyCapybara(g) {
    var ctx = g.ctx, w = g.w, h = g.h;
    ctx.fillStyle = "#0d231c";
    ctx.fillRect(0, 0, w, h);

    var gap = 3; // internal pixels; equal top and bottom clearance
    // Capybara fills the available canvas height minus the fixed gaps,
    // only constrained horizontally so it never overflows the canvas width.
    var maxCapyByWidth = w * 0.9 * (13 / 17);
    var capySize = Math.min(h - 2 * gap, maxCapyByWidth);
    var capyBottom = gap + capySize;

    mascot.draw(ctx, w / 2, capyBottom, capySize, { gaze: 0 });
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
      draw: function (g) { drawOnlyCapybara(g); }
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
      draw: function (g) { drawOnlyCapybara(g); }
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
      draw: function (g) { drawOnlyCapybara(g); }
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
      draw: function (g) { drawOnlyCapybara(g); }
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

  engine.on("level", function (e) {
    var i = engine.order.indexOf(e.id);
    tagEl.textContent = "World 1-" + (i + 1) + " · " + e.def.name;
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
    updateNav();
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
      + '<p class="plan-report__intro">A snapshot of your four-world money quest with Capy. '
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
  var prevBtn = document.getElementById("journeyPrevBtn");
  var nextBtn = document.getElementById("journeyNextBtn");
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

  function updateNav() {
    if (!engine.levelId) return;
    var idx = engine.order.indexOf(engine.levelId);
    var last = engine.order.length - 1;
    if (prevBtn) prevBtn.disabled = idx <= 0;
    if (nextBtn) nextBtn.hidden = idx >= last;
    if (planBtn) planBtn.hidden = idx !== last;
    var navEl = document.querySelector(".journey__nav");
    if (navEl) navEl.classList.toggle("is-legacy", idx === last);
  }
  function goPrev() {
    var idx = engine.order.indexOf(engine.levelId);
    if (idx > 0) engine.start(engine.order[idx - 1]);
  }
  function goNext() {
    var idx = engine.order.indexOf(engine.levelId);
    if (idx >= 0 && idx < engine.order.length - 1) engine.start(engine.order[idx + 1]);
  }

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
  if (prevBtn) prevBtn.addEventListener("click", goPrev);
  if (nextBtn) nextBtn.addEventListener("click", goNext);
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
