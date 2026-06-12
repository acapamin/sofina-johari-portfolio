/* financial-levels.js — the four playable levels of the money journey,
   plus the DOM wiring between the sliders and the FinancialEngine.

   Adding a fifth level is one registerLevel() call: declare inputs,
   a pure compute() (numbers in → mood + copy out) and a scene.draw().
   Mascot.js and FinancialEngine.js stay untouched. */

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

  /* ---------- shared scene helpers ---------- */

  function glow(g, x, y, r, color) {
    var grad = g.ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.ctx.fillStyle = grad;
    g.ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function groundLine(g, y) {
    g.ctx.strokeStyle = g.colors.line;
    g.ctx.lineWidth = 1;
    g.ctx.beginPath();
    g.ctx.moveTo(g.w * 0.05, y);
    g.ctx.lineTo(g.w * 0.95, y);
    g.ctx.stroke();
  }

  function text(g, str, x, y, opts) {
    opts = opts || {};
    g.ctx.fillStyle = opts.color || g.colors.muted;
    g.ctx.font = (opts.weight || "600") + " " + (opts.size || 12) + "px 'Instrument Sans', sans-serif";
    g.ctx.textAlign = opts.align || "center";
    g.ctx.fillText(str, x, y);
  }

  /* ============================================================
     LEVEL 1 — Cashflow: the two buckets
     ============================================================ */

  function spawnDrop(g, x0, y0, x1, y1, color) {
    var T = 0.75, G = 420;
    g.particles.spawn({
      x: x0 + (Math.random() - 0.5) * 12, y: y0,
      vx: (x1 - x0) / T + (Math.random() - 0.5) * 24,
      vy: (y1 - y0) / T - 0.5 * G * T,
      g: G,
      size: 2.4 + Math.random() * 1.6,
      life: T, color: color, alpha: 0.9
    });
  }

  function bucket(g, cx, top, bw, bh, fill, color, title, amount, overflowing) {
    var ctx = g.ctx, x = cx - bw / 2;
    ctx.save();
    g.rr(ctx, x, top, bw, bh, 14);
    ctx.clip();
    var fh = bh * clamp(fill, 0, 1);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = color;
    ctx.fillRect(x, top + bh - fh, bw, fh);
    ctx.globalAlpha = 1;
    ctx.restore();
    g.rr(ctx, x, top, bw, bh, 14);
    ctx.strokeStyle = overflowing ? "rgba(208,122,94,0.9)" : "rgba(242,236,224,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    text(g, title, cx, top + bh + 18, { color: "rgba(242,236,224,0.85)" });
    text(g, amount, cx, top + bh + 34, { color: "rgba(224,201,140,0.9)" });
  }

  engine.registerLevel("budget", {
    name: "Cashflow",
    title: "The Two Buckets",
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
        joyful: "Look at my jar go! ✨",
        growth: "Ooh, we're growing nicely!",
        stable: "Steady lah. Slow and sure.",
        cautious: "Hmm… the jar feels a bit light.",
        concerned: "Eh — the bucket is leaking!"
      }[mood];
      var coach = {
        joyful: "Sen is thrilled — saving 28%+ of income is elite territory. The next question is whether that money is working as hard as you do.",
        growth: "A 15–28% savings rate compounds beautifully over a decade. Keep this up and the next levels get much easier.",
        stable: "You're saving something every month — that habit matters more than the amount. A small trim to spending lifts Sen's whole mood.",
        cautious: "It's tight. Under 5% saved means one surprise bill wipes out the month. Try nudging spending down and watch the gold stream appear.",
        concerned: "Spending exceeds income, so the gap is quietly filling up on credit. This is exactly the conversation a planner untangles — no judgement."
      }[mood];
      return {
        mood: mood,
        score: clamp(Math.round((rate / 0.3) * 100), 0, 100),
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
        var groundY = h * 0.78;
        glow(g, w * 0.5, h * 0.2, h * 0.5, "rgba(201,161,74,0.10)");

        var sx = w * 0.5, sy = h * 0.16;
        var bw = Math.min(w * 0.24, 170), bh = Math.min(h * 0.28, 120);
        var spendCx = w * 0.24, saveCx = w * 0.76;
        var bTop = groundY - bh;

        // income source orb
        ctx.fillStyle = g.colors.goldSoft;
        ctx.beginPath();
        ctx.arc(sx, sy, 9 + Math.sin(g.t * 2.4) * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(224,201,140,0.4)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 16 + Math.sin(g.t * 2.4) * 2, 0, Math.PI * 2);
        ctx.stroke();
        text(g, "Income " + money(g.values.income), w - 16, 26,
          { align: "right", color: "rgba(242,236,224,0.85)" });

        // faint stream guides
        ctx.lineCap = "round";
        ctx.lineWidth = 9;
        ctx.strokeStyle = "rgba(159,216,196,0.12)";
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo((sx + spendCx) / 2, sy + (bTop - sy) * 0.2, spendCx, bTop - 6);
        ctx.stroke();
        var rate = clamp(g.m.rate, 0, 0.6);
        if (rate > 0.01) {
          ctx.strokeStyle = "rgba(201,161,74,0.14)";
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo((sx + saveCx) / 2, sy + (bTop - sy) * 0.2, saveCx, bTop - 6);
          ctx.stroke();
        }

        // cashflow particles
        var spendShare = clamp(g.m.spendShare, 0, 1.5);
        if (!g.reduced && g.dt) {
          if (Math.random() < Math.min(0.9, spendShare * 0.5)) spawnDrop(g, sx, sy, spendCx, bTop, g.colors.teal);
          if (rate > 0.01 && Math.random() < Math.min(0.9, rate * 2.4)) spawnDrop(g, sx, sy, saveCx, bTop, g.colors.goldSoft);
          if (spendShare > 1 && Math.random() < 0.35) {
            g.particles.spawn({
              x: spendCx + (Math.random() - 0.5) * bw * 0.9, y: groundY - 4,
              vx: (Math.random() - 0.5) * 30, vy: 30, g: 140,
              size: 2.5, life: 0.8, color: g.colors.rust, alpha: 0.85
            });
          }
        }

        bucket(g, spendCx, bTop, bw, bh, Math.min(1, spendShare), g.colors.teal,
          "Spending", money(g.values.spend) + " /mo", spendShare > 1);
        bucket(g, saveCx, bTop, bw, bh, clamp(rate / 0.4, 0, 1), g.colors.gold,
          "Savings", money(g.m.savings) + " /mo", false);

        groundLine(g, groundY);
        mascot.draw(ctx, w * 0.5, groundY, Math.min(h * 0.21, 84), { gaze: rate >= 0.05 ? 0.5 : -0.5 });
      }
    }
  });

  /* ============================================================
     LEVEL 2 — Protection: the shield
     ============================================================ */

  var shieldRef = { ratio: 1, x: 0 }; // read by hazard particles in flight

  engine.registerLevel("insurance", {
    name: "Protection",
    title: "The Shield",
    inputs: [
      { key: "income", label: "Monthly income", min: 1000, max: 30000, step: 100, value: 5000, fmt: "money" },
      { key: "cover", label: "Current life / takaful cover", min: 0, max: 2000000, step: 10000, value: 100000, fmt: "money" },
      { key: "deps", label: "People depending on you", min: 0, max: 6, step: 1, value: 2, fmt: "people" }
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
        joyful: "Full shield! Nothing gets past us.",
        stable: "Decent armour. A few thin spots.",
        cautious: "My shield is flickering a bit…",
        concerned: "This shield is barely holding!"
      }[mood === "risk-averse" ? "cautious" : mood];
      var coach = {
        joyful: "Cover meets the safety target, so a worst day wouldn't become a financial one too. Worth reviewing whenever income or family grows.",
        stable: "You're mostly protected — the remaining gap is the deductible life would charge your family. Often cheap to close with term cover.",
        "risk-averse": "Sen is being careful: under half the target means your dependants would feel a real shortfall. Comparing 8+ providers usually finds an affordable fix.",
        concerned: "A thin shield with people relying on you is the riskiest spot on this whole journey. The good news: protection is usually the cheapest problem to solve."
      }[mood];
      return {
        mood: mood,
        score: clamp(Math.round(ratio * 100), 0, 100),
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
        var groundY = h * 0.82;
        var size = Math.min(h * 0.22, 88);
        var mx = w * 0.36;
        var ratio = clamp(g.m.ratio, 0, 1.2);
        var cy = groundY - size * 0.55;
        var R = size * 1.1;

        shieldRef.ratio = ratio;
        shieldRef.x = mx + R * 0.9;

        glow(g, mx, cy, h * 0.45, "rgba(159,216,196,0.07)");
        groundLine(g, groundY);

        // incoming "life happens" hazards
        if (!g.reduced && g.dt && Math.random() < 0.07) {
          g.particles.spawn({
            x: w + 10,
            y: h * 0.25 + Math.random() * (groundY - h * 0.3),
            vx: -(90 + Math.random() * 70), vy: 0,
            size: 3, life: 8, color: "rgba(242,236,224,0.55)", alpha: 0.8,
            update: function (p) {
              if (p.resolved || p.x > shieldRef.x) return;
              p.resolved = true;
              if (Math.random() < Math.min(1, shieldRef.ratio)) {
                p.vx = 130 + Math.random() * 60;   // deflected
                p.vy = -70 - Math.random() * 50;
                p.g = 220;
                p.color = "#e0c98c";
                p.life = p.age + 0.55;
              } else {
                p.color = "rgba(208,122,94,0.85)"; // slipped through the gap
                p.life = p.age + 0.6;
              }
            }
          });
        }

        // the shield — thickness and steadiness scale with cover ratio
        var flicker = 1;
        if (ratio < 0.45 && !g.reduced) {
          flicker = clamp(0.45 + 0.55 * Math.sin(g.t * 13) * Math.sin(g.t * 5.1), 0.18, 1);
        }
        var lw = 3 + 13 * Math.min(1, ratio);
        var alpha = (0.25 + 0.75 * Math.min(1, ratio)) * flicker;
        ctx.lineCap = "round";
        ctx.strokeStyle = g.colors.gold;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(mx, cy, R, -0.95, 0.95);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.45;
        ctx.lineWidth = lw * 0.45;
        ctx.beginPath();
        ctx.arc(mx, cy, R * 0.86, -0.85, 0.85);
        ctx.stroke();
        if (ratio >= 1) {
          ctx.globalAlpha = 0.14 + 0.06 * Math.sin(g.t * 3);
          ctx.lineWidth = lw * 2.2;
          ctx.beginPath();
          ctx.arc(mx, cy, R * 1.06, -1, 1);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        text(g, Math.round(Math.min(ratio, 1.2) * 100) + "% shielded",
          mx + R * 0.7, cy - R * 0.95,
          { color: "rgba(224,201,140,0.9)", size: 13 });

        mascot.draw(ctx, mx, groundY, size, { gaze: 0.7 });
      }
    }
  });

  /* ============================================================
     LEVEL 3 — Future: the climb (growth trajectory)
     ============================================================ */

  engine.registerLevel("retirement", {
    name: "Future",
    title: "The Climb",
    inputs: [
      { key: "age", label: "Your age today", min: 20, max: 60, step: 1, value: 30, fmt: "age" },
      { key: "retireAge", label: "Retirement age", min: 40, max: 70, step: 1, value: 60, fmt: "age" },
      { key: "monthly", label: "Invested monthly", min: 0, max: 10000, step: 50, value: 600, fmt: "money" },
      { key: "wantIncome", label: "Retirement income you want", min: 1000, max: 20000, step: 100, value: 3000, fmt: "money" }
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
        joyful: "The summit! I can see it from here!",
        growth: "What a view — keep climbing!",
        stable: "Halfway up. One step at a time.",
        cautious: "This slope is gentler than I'd like…",
        concerned: "The peak looks very far away."
      }[mood];
      var coach = {
        joyful: "Your projected pot clears the target with room to spare. Now it's about the right vehicles — EPF, unit trusts, Shariah-compliant options — and staying the course.",
        growth: "You're on a strong trajectory. A small bump in monthly contributions, or a year or two more of compounding, closes the rest.",
        stable: "Solid base camp. Compounding does the heavy lifting from here — the earlier you raise contributions, the cheaper the summit gets.",
        cautious: "The maths says the current pace lands well short. Retiring slightly later or automating a bigger contribution changes this curve dramatically.",
        concerned: "At this pace the pot covers only a fraction of the income you want. Don't panic — starting is the hard part, and the curve is very sensitive to small changes."
      }[mood];
      return {
        mood: mood,
        score: clamp(Math.round(ratio * 100), 0, 100),
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
        var x0 = w * 0.1, x1 = w * 0.9;
        var baseY = h * 0.8, topY = h * 0.16;
        var maxClimb = baseY - topY;
        var SCALE = 1.3;
        var ratio = clamp(g.m.ratio, 0, SCALE);
        var climb = maxClimb * (ratio / SCALE);
        var a = 2.0; // growth-curve steepness

        function px(p) { return lerp(x0, x1, p); }
        function py(p) { return baseY - climb * ((Math.exp(a * p) - 1) / (Math.exp(a) - 1)); }

        glow(g, x1, topY + maxClimb * (1 - 1 / SCALE), h * 0.4, "rgba(201,161,74,0.10)");

        // goal line (= 100% of the target pot)
        var goalY = baseY - maxClimb * (1 / SCALE);
        ctx.setLineDash([6, 7]);
        ctx.strokeStyle = "rgba(224,201,140,0.45)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x0, goalY);
        ctx.lineTo(x1, goalY);
        ctx.stroke();
        ctx.setLineDash([]);
        text(g, "Goal", x0 - 8, goalY + 4, { align: "right", color: "rgba(224,201,140,0.7)" });

        // trajectory area + line
        ctx.beginPath();
        ctx.moveTo(x0, baseY);
        for (var i = 0; i <= 40; i++) ctx.lineTo(px(i / 40), py(i / 40));
        ctx.lineTo(x1, baseY);
        ctx.closePath();
        var fillGrad = ctx.createLinearGradient(0, topY, 0, baseY);
        fillGrad.addColorStop(0, "rgba(201,161,74,0.16)");
        fillGrad.addColorStop(1, "rgba(201,161,74,0.02)");
        ctx.fillStyle = fillGrad;
        ctx.fill();
        ctx.beginPath();
        for (var j = 0; j <= 40; j++) {
          var pp = j / 40;
          if (j === 0) ctx.moveTo(px(pp), py(pp));
          else ctx.lineTo(px(pp), py(pp));
        }
        ctx.strokeStyle = g.colors.gold;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.stroke();

        groundLine(g, baseY);

        // age markers
        var v = g.values;
        [0, 0.5, 1].forEach(function (p) {
          var ageAt = Math.round(lerp(v.age, v.retireAge, p));
          ctx.strokeStyle = g.colors.line;
          ctx.beginPath();
          ctx.moveTo(px(p), baseY);
          ctx.lineTo(px(p), baseY + 6);
          ctx.stroke();
          text(g, String(ageAt), px(p), baseY + 22);
        });

        // the goal "sun" at the end of the path
        var sunY = py(1) - 26;
        if (ratio >= 1) {
          glow(g, x1, sunY, 46, "rgba(224,201,140,0.5)");
          ctx.fillStyle = g.colors.goldSoft;
          ctx.beginPath();
          ctx.arc(x1, sunY, 13, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = "rgba(224,201,140,0.6)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x1, sunY, 11, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Sen walks the trajectory on loop
        var pw = g.reduced ? 0.55 : (g.t * 0.055) % 1;
        var slope = (py(Math.min(1, pw + 0.02)) - py(pw)) / (px(0.02) - px(0));
        mascot.draw(ctx, px(pw), py(pw) + 2, Math.min(h * 0.16, 64), {
          walk: g.t * 7,
          lean: Math.atan(slope) * 0.35,
          gaze: 0.8
        });

        // sparkle trail on strong trajectories
        if (!g.reduced && g.dt && ratio >= 0.8 && Math.random() < 0.2) {
          g.particles.spawn({
            x: px(pw) - 10, y: py(pw) - 8,
            vx: -20 - Math.random() * 20, vy: -10 - Math.random() * 20,
            size: 2, life: 0.9, color: g.colors.goldSoft, alpha: 0.7
          });
        }
      }
    }
  });

  /* ============================================================
     LEVEL 4 — Legacy: the map home
     (handled gently — a calm scene, never an alarmed mascot)
     ============================================================ */

  engine.registerLevel("legacy", {
    name: "Legacy",
    title: "The Map Home",
    inputs: [
      { key: "loved", label: "Loved ones to provide for", min: 1, max: 8, step: 1, value: 3, fmt: "people" },
      { key: "docs", label: "Assets listed & documented", min: 0, max: 100, step: 5, value: 25, fmt: "percent" },
      { key: "will", label: "Will / wasiat written", type: "toggle", value: 0 }
    ],
    compute: function (v) {
      var readiness = (v.will ? 0.5 : 0) + (v.docs / 100) * 0.5;
      var mood = readiness >= 0.7 ? "serene" : readiness >= 0.35 ? "calm" : "thoughtful";
      var say = {
        serene: "Everything in its place. They'll be okay.",
        calm: "A good start. We'll go gently.",
        thoughtful: "It's tender to think about… but it's love, really."
      }[mood];
      var coach = {
        serene: "With a will or wasiat in place and your assets mapped, you've given your loved ones clarity instead of paperwork during the hardest week of their lives.",
        calm: "You've begun the map — every account you list and every wish you write down is a burden lifted from someone you love. No rush; just keep going.",
        thoughtful: "Most Malaysians put this off, and that's completely human. A simple list of what you own and a basic will or wasiat is a profound act of care — and easier than it feels."
      }[mood];
      return {
        mood: mood,
        score: Math.round(readiness * 100),
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
        var groundY = h * 0.84;
        var v = g.values;

        // quiet night sky
        glow(g, w * 0.65, h * 0.3, h * 0.6, "rgba(159,216,196,0.05)");
        for (var i = 0; i < 26; i++) {
          var sxr = ((i * 73) % 97) / 97, syr = ((i * 41) % 89) / 89;
          ctx.globalAlpha = 0.1 + 0.4 * Math.abs(Math.sin(g.t * 0.6 + i * 1.3));
          ctx.fillStyle = g.colors.cream;
          ctx.fillRect(sxr * w, syr * h * 0.5, 1.6, 1.6);
        }
        ctx.globalAlpha = 1;

        // the family map
        var mw = Math.min(w * 0.46, 330), mh = Math.min(h * 0.56, 250);
        var mcx = w * 0.65, mcy = h * 0.5;
        ctx.save();
        ctx.translate(mcx, mcy);
        ctx.rotate(-0.03);
        g.rr(ctx, -mw / 2, -mh / 2, mw, mh, 18);
        ctx.fillStyle = "rgba(246,241,231,0.07)";
        ctx.fill();
        ctx.strokeStyle = "rgba(201,161,74,0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        g.rr(ctx, -mw / 2 + 8, -mh / 2 + 8, mw - 16, mh - 16, 12);
        ctx.strokeStyle = "rgba(201,161,74,0.18)";
        ctx.stroke();

        // home node → loved-one nodes
        var hx = 0, hy = -mh * 0.26;
        var n = v.loved;
        var solid = Math.round((v.docs / 100) * n);
        for (var k = 0; k < n; k++) {
          var nx = n === 1 ? 0 : -mw * 0.36 + (mw * 0.72) * (k / (n - 1));
          var ny = mh * 0.26 + Math.sin(k * 2.1) * mh * 0.05;
          var documented = k < solid;
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.quadraticCurveTo((hx + nx) / 2, (hy + ny) / 2 + 14, nx, ny);
          if (documented) {
            ctx.setLineDash([]);
            ctx.strokeStyle = "rgba(224,201,140,0.85)";
            ctx.lineWidth = 2;
          } else {
            ctx.setLineDash([3, 6]);
            ctx.strokeStyle = "rgba(242,236,224,0.25)";
            ctx.lineWidth = 1.2;
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = documented ? g.colors.goldSoft : "rgba(242,236,224,0.4)";
          ctx.beginPath();
          ctx.arc(nx, ny, documented ? 6 : 4.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // home: a little house
        ctx.fillStyle = g.colors.gold;
        ctx.beginPath();
        ctx.arc(hx, hy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = g.colors.goldSoft;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(hx - 9, hy - 9);
        ctx.lineTo(hx, hy - 17);
        ctx.lineTo(hx + 9, hy - 9);
        ctx.stroke();

        // wasiat seal in the map corner
        var wx = mw / 2 - 26, wy = mh / 2 - 26;
        ctx.beginPath();
        ctx.arc(wx, wy, 13, 0, Math.PI * 2);
        if (v.will) {
          ctx.fillStyle = g.colors.gold;
          ctx.fill();
          ctx.strokeStyle = g.colors.ink;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(wx - 5, wy);
          ctx.lineTo(wx - 1.5, wy + 4);
          ctx.lineTo(wx + 5.5, wy - 4);
          ctx.stroke();
        } else {
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = "rgba(224,201,140,0.45)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();

        // drifting fireflies
        if (!g.reduced && g.dt && Math.random() < 0.05) {
          g.particles.spawn({
            x: mcx + (Math.random() - 0.5) * mw,
            y: mcy + mh * 0.4,
            vx: (Math.random() - 0.5) * 8, vy: -10 - Math.random() * 10,
            size: 1.8, life: 4, color: g.colors.goldSoft, alpha: 0.45
          });
        }

        groundLine(g, groundY);
        mascot.draw(ctx, w * 0.2, groundY, Math.min(h * 0.2, 80), { gaze: 0.8 });
      }
    }
  });

  /* ============================================================
     DOM wiring — chips, sliders, coach copy, vibe meter
     ============================================================ */

  var chipsEl = document.getElementById("journeyLevels");
  var controlsEl = document.getElementById("journeyControls");
  var titleEl = document.getElementById("journeyTitle");
  var tagEl = document.getElementById("journeyLevelTag");
  var headlineEl = document.getElementById("journeyHeadline");
  var coachEl = document.getElementById("journeyCoach");
  var bubbleEl = document.getElementById("journeyBubble");
  var vibeEl = document.getElementById("journeyVibe");

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
      row.className = "journey__control";
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
    tagEl.textContent = "Level " + (i + 1) + " of " + engine.order.length;
    titleEl.textContent = e.def.title;
    buildControls(e.def);
    for (var id in chips) chips[id].classList.toggle("is-active", id === e.id);
    lastSay = "";
  });

  engine.on("state", function (s) {
    headlineEl.textContent = s.headline || "";
    coachEl.textContent = s.coach || "";
    if (s.say && s.say !== lastSay) {
      lastSay = s.say;
      bubbleEl.textContent = s.say;
      bubbleEl.classList.remove("is-pop");
      void bubbleEl.offsetWidth; // restart the pop animation
      bubbleEl.classList.add("is-pop");
    }
    progress[engine.levelId] = s.score || 0;
    var total = 0;
    engine.order.forEach(function (id) { total += progress[id] || 0; });
    vibeEl.style.width = Math.round(total / engine.order.length) + "%";
    engine.order.forEach(function (id) {
      chips[id].classList.toggle("is-done", (progress[id] || 0) >= 60);
    });
  });

  engine.start(engine.order[0]);
  // re-measure once layout (fonts, grid) has settled
  requestAnimationFrame(function () { engine._resize(); });
})();
