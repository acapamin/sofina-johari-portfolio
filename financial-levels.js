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
      { key: "income", label: "Monthly take-home", min: 1000, max: 30000, step: 100, value: 5000, fmt: "money" },
      { key: "spend", label: "Monthly spending", min: 500, max: 30000, step: 100, value: 4000, fmt: "money" }
    ],
    compute: function (v) {
      var savings = v.income - v.spend;
      var rate = v.income > 0 ? savings / v.income : 0;
      var mood = rate >= 0.28 ? "joyful"
        : rate >= 0.15 ? "growth"
        : rate >= 0.05 ? "stable"
        : rate >= 0 ? "cautious"
        : "concerned";
      var say = {
        joyful: "Coin shower! Top score!",
        growth: "Level up! We're growing!",
        stable: "Steady lah, steady.",
        cautious: "Hmm... coins feel light.",
        concerned: "The pipe eats everything!"
      }[mood];
      var coach = {
        joyful: "Capy is thrilled — saving 28%+ of income is elite territory. The next question is whether that money is working as hard as you do.",
        growth: "A 15–28% savings rate compounds beautifully over a decade. Keep this up and the next levels get much easier.",
        stable: "You're saving something every month — that habit matters more than the amount. A small trim to spending lifts Capy's whole mood.",
        cautious: "It's tight. Under 5% saved means one surprise bill wipes out the month. Try nudging spending down and watch the gold coins appear.",
        concerned: "Spending exceeds income, so the gap is quietly filling up on credit. This is exactly the conversation a planner untangles — no judgement."
      }[mood];
      return {
        mood: mood,
        score: clamp(Math.round((rate / 0.3) * 100), 0, 100),
        stat: rmShort(v.income) + "/MO",
        headline: savings >= 0
          ? "You bank " + money(savings) + " a month — a " + Math.round(rate * 100) + "% savings rate."
          : "You overspend by " + money(-savings) + " every month.",
        coach: coach,
        say: say,
        metrics: {
          rate: clamp(rate, -0.5, 0.6),
          savings: Math.max(0, savings),
          spendShare: clamp(v.spend / v.income, 0, 1.5)
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
        var spendCx = w * 0.32, saveCx = w * 0.68;

        // spending pipe (money down the drain); labels hug the left
        // edge so the coin arc never crosses the text
        var pw = 18, pipeTop = groundY - 26;
        pipe(g, spendCx, pipeTop, pw, groundY, "#2e7d4f", "#1b4a2f", "#5cb87a");
        ptext(g, "SPEND", 3, pipeTop - 12, TEAL, "left");
        ptext(g, rmShort(g.values.spend), 3, pipeTop - 2, TEAL, "left");

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

  var shieldRef = { ratio: 1, x: 0 };

  engine.registerLevel("insurance", {
    name: "Protection",
    title: "World 1-2 · The Brick Shield",
    inputs: [
      { key: "income", label: "Monthly income", min: 1000, max: 30000, step: 100, value: 5000, fmt: "money" },
      { key: "cover", label: "Life / takaful cover", min: 0, max: 2000000, step: 10000, value: 100000, fmt: "money" },
      { key: "deps", label: "Dependants", min: 0, max: 6, step: 1, value: 2, fmt: "people" }
    ],
    compute: function (v) {
      // simple heuristic: ~10× annual income + a cushion per dependant
      var need = v.income * 12 * 10 + v.deps * 60000;
      var ratio = need > 0 ? v.cover / need : 1;
      var gap = Math.max(0, need - v.cover);
      var mood = ratio >= 1 ? "joyful"
        : ratio >= 0.75 ? "stable"
        : ratio >= 0.45 ? "risk-averse"
        : "concerned";
      var say = {
        joyful: "Full wall! Bring it on!",
        stable: "Decent armour. Few thin spots.",
        cautious: "My wall is flickering...",
        concerned: "The wall is barely holding!"
      }[mood === "risk-averse" ? "cautious" : mood];
      var coach = {
        joyful: "Cover meets the safety target, so a worst day wouldn't become a financial one too. Worth reviewing whenever income or family grows.",
        stable: "You're mostly protected — the remaining gap is the deductible life would charge your family. Often cheap to close with term cover.",
        "risk-averse": "Capy is being careful: under half the target means your dependants would feel a real shortfall. Comparing 8+ providers usually finds an affordable fix.",
        concerned: "A thin wall with people relying on you is the riskiest spot on this whole quest. The good news: protection is usually the cheapest problem to solve."
      }[mood];
      return {
        mood: mood,
        score: clamp(Math.round(ratio * 100), 0, 100),
        stat: "SHIELD " + clamp(Math.round(ratio * 100), 0, 120) + "%",
        headline: ratio >= 1
          ? "Fully shielded — cover is " + Math.round(ratio * 100) + "% of the " + money(need) + " safety target."
          : "Protection gap: " + money(gap) + " of a " + money(need) + " target.",
        coach: coach,
        say: say,
        metrics: { ratio: clamp(ratio, 0, 1.2) }
      };
    },
    scene: {
      draw: function (g) {
        var ctx = g.ctx, w = g.w, h = g.h;
        var groundY = h - 14;
        var ratio = clamp(g.m.ratio, 0, 1.2);
        var mx = w * 0.3;
        stars(g, 12, h * 0.35);

        // wall of shield blocks: 2 cols × 5 rows, lit count = coverage
        var bsz = 8;
        var wallX = Math.round(w * 0.58);
        var rows = 5, cols = 2;
        var lit = Math.round(clamp(ratio, 0, 1) * rows * cols);
        shieldRef.ratio = ratio;
        shieldRef.x = wallX;

        var flicker = ratio < 0.45 && !g.reduced ? (((g.t * 9) | 0) % 3 !== 0) : true;
        var idx = 0;
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            var x = wallX + c * bsz;
            var y = groundY - (r + 1) * bsz;
            if (idx < lit && flicker) {
              ctx.fillStyle = GOLD;
              ctx.fillRect(x, y, bsz, bsz);
              ctx.fillStyle = GOLD_LIGHT;
              ctx.fillRect(x + 1, y + 1, 2, 1);
              ctx.fillStyle = GOLD_DARK;
              ctx.fillRect(x, y + bsz - 1, bsz, 1);
              ctx.fillRect(x + bsz - 1, y, 1, bsz);
            } else {
              ctx.strokeStyle = "rgba(231,192,105,0.25)";
              ctx.strokeRect(x + 0.5, y + 0.5, bsz - 1, bsz - 1);
            }
            idx++;
          }
        }
        if (ratio >= 1 && !g.reduced && Math.random() < 0.1) {
          g.particles.spawn({
            x: wallX + Math.random() * bsz * 2, y: groundY - Math.random() * bsz * rows,
            vx: 0, vy: -8, size: 1, life: 0.8, color: GOLD_LIGHT, alpha: 0.9
          });
        }

        // incoming "life happens" hazards
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
                p.g = 100;
                p.color = GOLD_LIGHT;
                p.size = 2;
                p.life = p.age + 0.6;
              } else {
                p.color = RED;                     // slipped through the gap
                p.life = p.age + 0.7;
              }
            }
          });
        }

        brickGround(g, groundY);
        mascot.draw(ctx, mx, groundY, Math.min(h * 0.26, 40), { gaze: 0.7 });
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
      { key: "wantIncome", label: "Retirement income /mo", min: 1000, max: 20000, step: 100, value: 3000, fmt: "money" }
    ],
    compute: function (v) {
      var years = Math.max(1, v.retireAge - v.age);
      var n = years * 12, r = 0.05 / 12;       // illustrative 5% p.a. return
      var fv = v.monthly > 0 ? v.monthly * ((Math.pow(1 + r, n) - 1) / r) : 0;
      var need = (v.wantIncome * 12) / 0.04;   // 4% withdrawal rule of thumb
      var ratio = need > 0 ? fv / need : 0;
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
      var coach = {
        joyful: "Your projected pot clears the target with room to spare. Now it's about the right vehicles — EPF, unit trusts, Shariah-compliant options — and staying the course.",
        growth: "You're on a strong trajectory. A small bump in monthly contributions, or a year or two more of compounding, closes the rest.",
        stable: "Solid base camp. Compounding does the heavy lifting from here — the earlier you raise contributions, the cheaper the summit gets.",
        cautious: "The maths says the current pace lands well short. Retiring slightly later or automating a bigger contribution changes this staircase dramatically.",
        concerned: "At this pace the pot covers only a fraction of the income you want. Don't panic — starting is the hard part, and the curve is very sensitive to small changes."
      }[mood];
      return {
        mood: mood,
        score: clamp(Math.round(ratio * 100), 0, 100),
        stat: "AGE " + v.age + "-" + v.retireAge,
        headline: "Projected pot at " + v.retireAge + ": " + money(fv) + " — "
          + Math.round(ratio * 100) + "% of your " + money(need) + " goal.",
        coach: coach,
        say: say,
        metrics: { ratio: clamp(ratio, 0, 1.3) }
      };
    },
    scene: {
      draw: function (g) {
        var ctx = g.ctx, w = g.w, h = g.h;
        var groundY = h - 12;
        var SCALE = 1.3;
        var ratio = clamp(g.m.ratio, 0, SCALE);
        stars(g, 14, h * 0.4);

        // staircase of blocks, total height = trajectory; the last
        // step lands flush against the flagpole
        var nSteps = 8;
        var stairX0 = Math.round(w * 0.1);
        var poleX = Math.round(w * 0.86);
        var stairSpan = poleX - stairX0;
        var maxClimb = groundY - 22;
        var climb = maxClimb * (ratio / SCALE);
        var ea = Math.exp(2) - 1;
        var tops = [];
        for (var i = 0; i < nSteps; i++) {
          var f = (Math.exp(2 * (i + 1) / nSteps) - 1) / ea;
          var sh = Math.max(2, Math.round(climb * f));
          tops.push(groundY - sh);
          var x = stairX0 + Math.round(i * stairSpan / nSteps);
          var xw = stairX0 + Math.round((i + 1) * stairSpan / nSteps) - x;
          ctx.fillStyle = BRICK;
          ctx.fillRect(x, groundY - sh, xw, sh);
          ctx.fillStyle = BRICK_DARK;
          for (var yy = groundY - sh + 4; yy < groundY; yy += 5) ctx.fillRect(x, yy, xw, 1);
          ctx.fillRect(x + xw - 1, groundY - sh, 1, sh);
          ctx.fillStyle = GOLD;
          ctx.fillRect(x, groundY - sh, xw, 1);
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

        // Capy climbs the staircase on loop, all the way to the pole
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
    title: "World 1-4 · The Map Home",
    inputs: [
      { key: "loved", label: "Loved ones", min: 1, max: 8, step: 1, value: 3, fmt: "people" },
      { key: "docs", label: "Assets documented", min: 0, max: 100, step: 5, value: 25, fmt: "percent" },
      { key: "will", label: "Will / wasiat written", type: "toggle", value: 0 }
    ],
    compute: function (v) {
      var readiness = (v.will ? 0.5 : 0) + (v.docs / 100) * 0.5;
      var mood = readiness >= 0.7 ? "serene" : readiness >= 0.35 ? "calm" : "thoughtful";
      var say = {
        serene: "All mapped. They'll be okay.",
        calm: "A good start. Gently does it.",
        thoughtful: "It's love, really."
      }[mood];
      var coach = {
        serene: "With a will or wasiat in place and your assets mapped, you've given your loved ones clarity instead of paperwork during the hardest week of their lives.",
        calm: "You've begun the map — every account you list and every wish you write down is a burden lifted from someone you love. No rush; just keep going.",
        thoughtful: "Most Malaysians put this off, and that's completely human. A simple list of what you own and a basic will or wasiat is a profound act of care — and easier than it feels."
      }[mood];
      return {
        mood: mood,
        score: Math.round(readiness * 100),
        stat: "READY " + Math.round(readiness * 100) + "%",
        headline: Math.round(readiness * 100) + "% legacy-ready for "
          + v.loved + (v.loved === 1 ? " loved one." : " loved ones."),
        coach: coach,
        say: say,
        metrics: { readiness: readiness, docs: v.docs / 100 }
      };
    },
    scene: {
      draw: function (g) {
        var ctx = g.ctx, w = g.w, h = g.h;
        var groundY = h - 10;
        var v = g.values;
        stars(g, 30, h * 0.6);

        // pixel moon (mid-left sky, clear of the HUD strip and the map)
        ctx.fillStyle = "rgba(246,231,189,0.8)";
        ctx.fillRect(12, 28, 8, 8);
        ctx.fillRect(10, 30, 12, 4);
        ctx.fillStyle = "rgba(201,161,74,0.4)";
        ctx.fillRect(15, 31, 2, 2);

        // the family map panel (sits below the HUD strip)
        var mw = Math.round(Math.min(w * 0.52, 120));
        var mh = Math.round(Math.min(h * 0.62, 96));
        var mx0 = Math.round(w * 0.62 - mw / 2);
        var my0 = Math.round(h * 0.52 - mh / 2);
        ctx.fillStyle = "rgba(246,241,231,0.08)";
        ctx.fillRect(mx0, my0, mw, mh);
        ctx.fillStyle = GOLD;
        ctx.fillRect(mx0, my0, mw, 1); ctx.fillRect(mx0, my0 + mh - 1, mw, 1);
        ctx.fillRect(mx0, my0, 1, mh); ctx.fillRect(mx0 + mw - 1, my0, 1, mh);

        // home: a little pixel house at the top of the map
        var hx = mx0 + mw / 2, hy = my0 + 14;
        ctx.fillStyle = GOLD;
        ctx.fillRect(Math.round(hx - 5), hy - 4, 10, 7);
        ctx.fillRect(Math.round(hx - 3), hy - 7, 6, 3);
        ctx.fillRect(Math.round(hx - 1), hy - 9, 2, 2);
        ctx.fillStyle = BRICK_DARK;
        ctx.fillRect(Math.round(hx - 1), hy, 2, 3);

        // dotted paths to each heart; documented = bright gold trail
        var n = v.loved;
        var solid = Math.round((v.docs / 100) * n);
        for (var k = 0; k < n; k++) {
          // span stops short of the wasiat seal in the bottom-right corner
          var tx = n === 1 ? hx : mx0 + 10 + (mw - 32) * (k / (n - 1));
          var ty = my0 + mh - 16 + ((k % 2) * 4);
          var documented = k < solid;
          var step = documented ? 4 : 8;
          var dist = Math.hypot(tx - hx, ty - hy - 4);
          for (var d = 6; d < dist - 4; d += step) {
            var pxd = hx + (tx - hx) * (d / dist);
            var pyd = (hy + 4) + (ty - hy - 4) * (d / dist);
            ctx.fillStyle = documented ? "rgba(231,192,105,0.9)" : "rgba(242,236,224,0.25)";
            ctx.fillRect(Math.round(pxd), Math.round(pyd), 1, 1);
          }
          heart(ctx, Math.round(tx - 2), Math.round(ty), documented ? RED : "rgba(242,236,224,0.3)");
        }

        // wasiat scroll in the map corner
        var wx2 = mx0 + mw - 12, wy2 = my0 + mh - 14;
        if (v.will) {
          ctx.fillStyle = "#f6f1e7";
          ctx.fillRect(wx2, wy2, 7, 9);
          ctx.fillStyle = GOLD;
          ctx.fillRect(wx2, wy2 + 3, 7, 2);
          ctx.fillStyle = BRICK_DARK;
          ctx.fillRect(wx2 + 1, wy2 + 6, 5, 1);
        } else {
          ctx.fillStyle = "rgba(242,236,224,0.3)";
          ctx.fillRect(wx2, wy2, 2, 1); ctx.fillRect(wx2 + 5, wy2, 2, 1);
          ctx.fillRect(wx2, wy2 + 8, 2, 1); ctx.fillRect(wx2 + 5, wy2 + 8, 2, 1);
          ctx.fillRect(wx2, wy2, 1, 2); ctx.fillRect(wx2 + 6, wy2, 1, 2);
          ctx.fillRect(wx2, wy2 + 7, 1, 2); ctx.fillRect(wx2 + 6, wy2 + 7, 1, 2);
        }

        // drifting fireflies
        if (!g.reduced && g.dt && Math.random() < 0.04) {
          g.particles.spawn({
            x: mx0 + Math.random() * mw,
            y: my0 + mh,
            vx: (Math.random() - 0.5) * 3, vy: -4 - Math.random() * 4,
            size: 1, life: 4, color: GOLD_LIGHT, alpha: 0.5
          });
        }

        // thin grass ground
        ctx.fillStyle = BRICK;
        ctx.fillRect(0, groundY, w, h - groundY);
        ctx.fillStyle = "rgba(159,216,196,0.5)";
        ctx.fillRect(0, groundY, w, 1);

        mascot.draw(ctx, w * 0.15, groundY, Math.min(h * 0.24, 36), { gaze: 0.8 });
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
    def.inputs.forEach(function (inp) {
      var row = document.createElement("div");
      row.className = "journey__control" + (inp.type === "toggle" ? " journey__control--toggle" : "");
      if (inp.type === "toggle") {
        row.innerHTML =
          '<label class="journey__toggle">' +
          '<input type="checkbox"' + (inp.value ? " checked" : "") + " />" +
          '<span class="journey__toggle-track" aria-hidden="true"></span>' +
          '<span class="journey__control-label">' + inp.label + "</span>" +
          "</label>";
        row.querySelector("input").addEventListener("change", function () {
          engine.setInput(inp.key, this.checked ? 1 : 0);
        });
      } else {
        var id = "jin-" + inp.key;
        row.innerHTML =
          '<div class="journey__control-head">' +
          '<label class="journey__control-label" for="' + id + '">' + inp.label + "</label>" +
          "<output>" + fmtVal(inp, inp.value) + "</output>" +
          "</div>" +
          '<input class="journey__range" type="range" id="' + id + '" min="' + inp.min +
          '" max="' + inp.max + '" step="' + inp.step + '" value="' + inp.value + '" />';
        var range = row.querySelector("input");
        var output = row.querySelector("output");
        setFill(range);
        range.addEventListener("input", function () {
          var v = parseFloat(this.value);
          output.textContent = fmtVal(inp, v);
          setFill(this);
          engine.setInput(inp.key, v);
        });
      }
      controlsEl.appendChild(row);
    });
  }

  var lastSay = "";
  engine.on("level", function (e) {
    var i = engine.order.indexOf(e.id);
    tagEl.textContent = "World 1-" + (i + 1);
    titleEl.textContent = e.def.title.split("·")[1].trim();
    buildControls(e.def);
    for (var id in chips) chips[id].classList.toggle("is-active", id === e.id);
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
    // power = average score across the levels played so far, so a
    // maxed first level reads 100%, not 25%
    var total = 0, visited = 0;
    engine.order.forEach(function (id) {
      if (progress[id] != null) { visited++; total += progress[id]; }
    });
    var pct = visited ? Math.round(total / visited) : 0;
    vibeEl.style.width = pct + "%";
    vibePctEl.textContent = pct + "%";
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
