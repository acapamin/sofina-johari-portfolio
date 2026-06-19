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

  /* ---------- shared soft-3D scene helpers ---------- */

  function rmShort(v) {
    v = Math.round(v);
    if (v >= 1e6) return "RM" + (Math.round(v / 1e5) / 10) + "M";
    if (v >= 1e4) return "RM" + Math.round(v / 1e3) + "K";
    if (v >= 1e3) return "RM" + (Math.round(v / 100) / 10) + "K";
    return "RM" + v;
  }

  /* ---------- shared soft-3D scene builders ----------
     World frame: ground at y=0, camera looks at ~(0,2.7,0); visible
     roughly x∈[-6.5,6.5], y∈[0,8.5]. The single Capy instance is shared,
     so addCapy() just re-parents it into the active stage each level. */

  function addCapy(g, x, y, z, scale) {
    var c = g.mascot.object3d;
    c.scale.setScalar(scale || 1.5);
    c.position.set(x || 0, y || 0, z || 0);
    c.rotation.set(0, 0, 0);
    c.visible = true;
    g.mascot.setWalk(0);
    g.mascot.setGaze(0);
    g.group.add(c);
    return c;
  }

  // a soft rounded platform that grounds each world
  function softGround(g, color, radius) {
    var T = g.THREE;
    var disc = new T.Mesh(
      new T.CylinderGeometry(radius || 7.5, (radius || 7.5) * 1.04, 0.6, 48),
      g.kit.soft(color, { roughness: 0.96 })
    );
    disc.position.y = -0.3;
    disc.receiveShadow = true;
    g.group.add(disc);
    return disc;
  }

  // a ballistic coin/spark that arcs from (x0,y0) to (x1,y1) over ~0.7s
  function spawnArc(g, x0, y0, x1, y1, color) {
    var T = 0.7, grav = -9.0;
    g.particles.spawn({
      x: x0 + (Math.random() - 0.5) * 0.4, y: y0, z: (Math.random() - 0.5) * 0.3,
      vx: (x1 - x0) / T,
      vy: (y1 - y0) / T - 0.5 * grav * T,
      vz: 0, g: grav, size: 0.34, life: T, color: color, spin: 5
    });
  }

  // a tiny chibi capybara for the "loved ones" crowd in World 1-4
  function makeMiniCapy(g) {
    var T = g.THREE;
    var grp = new T.Group();
    var bodyMat = g.kit.soft(0xc89a68);
    var body = new T.Mesh(new T.SphereGeometry(0.34, 14, 12), bodyMat);
    body.scale.set(1.15, 0.9, 1); body.position.y = 0.32; body.castShadow = true;
    grp.add(body);
    var head = new T.Mesh(new T.SphereGeometry(0.22, 12, 10), bodyMat);
    head.position.set(0.28, 0.5, 0); grp.add(head);
    [-1, 1].forEach(function (s) {
      var ear = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), g.kit.soft(0x8f6238));
      ear.position.set(0.2, 0.66, 0.12 * s); grp.add(ear);
    });
    var eyeMat = g.kit.soft(0x2b1a10, { roughness: 0.4 });
    [-1, 1].forEach(function (s) {
      var e = new T.Mesh(new T.SphereGeometry(0.035, 8, 8), eyeMat);
      e.position.set(0.42, 0.52, 0.09 * s); grp.add(e);
    });
    return grp;
  }

  /* ============================================================
     WORLD 1-1 — Cashflow: the coin pipes
     ============================================================ */

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
      bg: ["#bfe7f2", "#e9f7ec"],
      build: function (g) {
        var T = g.THREE, c = g.colors;
        softGround(g, 0xd9f0e4, 7.5);
        var capy = addCapy(g, 0, 0, 0, 1.55);
        capy.rotation.y = -0.6;   // turn the cute face toward the camera

        // floating "?" pay block above Capy
        var block = new T.Mesh(
          new T.BoxGeometry(1.5, 1.5, 1.5),
          g.kit.soft(c.gold, { emissive: c.goldDark, emissiveIntensity: 0.25 })
        );
        block.position.set(0, 5.4, -0.5); block.castShadow = true;
        g.group.add(block); g.store.block = block;
        var q = g.kit.label("?", { size: 1.0, color: "#7a5410", halo: false });
        q.position.set(0, 5.4, 0.78); g.group.add(q);

        // SPEND drain pipe (left)
        var pipe = new T.Mesh(
          new T.CylinderGeometry(0.72, 0.94, 2.4, 20),
          g.kit.soft(0x6fcf97, { emissive: 0x2e7d4f, emissiveIntensity: 0.12 })
        );
        pipe.position.set(-3.7, 1.2, 0); pipe.castShadow = true; g.group.add(pipe);
        var rim = new T.Mesh(new T.TorusGeometry(0.82, 0.16, 10, 22), g.kit.soft(0x9be3b8));
        rim.position.set(-3.7, 2.4, 0); rim.rotation.x = Math.PI / 2; g.group.add(rim);
        var sl = g.kit.label("SPEND", { size: 0.55, color: "#1b5e3a" });
        sl.position.set(-3.7, 3.25, 0); g.group.add(sl);

        // SAVE jar (right): translucent glass with a gold fill that grows
        var jarMat = new T.MeshPhysicalMaterial({
          color: 0xffffff, roughness: 0.1, metalness: 0, transmission: 0.85,
          transparent: true, opacity: 0.38, thickness: 0.5
        });
        var jar = new T.Mesh(new T.CylinderGeometry(0.95, 0.95, 2.6, 24, 1, true), jarMat);
        jar.position.set(3.7, 1.4, 0); g.group.add(jar);
        var base = new T.Mesh(new T.CylinderGeometry(0.97, 0.97, 0.2, 24),
          g.kit.soft(0xbfe0f2, { transparent: true, opacity: 0.6 }));
        base.position.set(3.7, 0.2, 0); g.group.add(base);
        var fill = new T.Mesh(new T.CylinderGeometry(0.86, 0.86, 1, 24),
          g.kit.glossy(c.gold, { emissive: c.goldDark, emissiveIntensity: 0.2 }));
        fill.position.set(3.7, 0.3, 0); fill.scale.y = 0.02; g.group.add(fill);
        g.store.fill = fill;
        var vl = g.kit.label("SAVE", { size: 0.55, color: "#9a6b15" });
        vl.position.set(3.7, 3.35, 0); g.group.add(vl);

        // soft drifting bokeh
        g.store.bokeh = [];
        for (var i = 0; i < 6; i++) {
          var b = g.kit.glow(i % 2 ? c.mint : c.goldLight, 0.9 + Math.random());
          b.position.set((Math.random() - 0.5) * 11, 1 + Math.random() * 6, -2 - Math.random() * 3);
          b.material.opacity = 0.16; g.group.add(b); g.store.bokeh.push(b);
        }
        g.store.coinT = 0;
      },
      update: function (g) {
        var c = g.colors, dt = g.dt || 0.016;
        var rate = g.clamp(g.m.rate || 0, 0, 0.6);
        var spendShare = g.clamp(g.m.spendShare == null ? 1 : g.m.spendShare, 0, 1.5);

        if (g.store.block) {
          g.store.block.position.y = 5.4 + Math.sin(g.t * 2) * 0.18;
          g.store.block.rotation.y = Math.sin(g.t * 0.8) * 0.25;
        }
        if (g.store.fill) {
          var target = Math.max(0.02, g.clamp(rate / 0.4, 0, 1) * 2.4);
          var fy = g.store.fill.scale.y;
          fy += (target - fy) * (1 - Math.exp(-dt * 4));
          g.store.fill.scale.y = fy;
          g.store.fill.position.y = 0.3 + fy / 2 - 0.5;
        }
        if (!g.reduced && g.dt) {
          g.store.coinT += dt;
          while (g.store.coinT > 0.12) {
            g.store.coinT -= 0.12;
            var toSave = Math.random() < g.clamp(rate * 2, 0, 0.85);
            spawnArc(g, 0, 4.7, toSave ? 3.7 : -3.7, toSave ? 1.6 : 2.3, toSave ? c.gold : 0x8fe0b0);
          }
          if (spendShare > 1 && Math.random() < 0.25) {
            g.particles.spawn({ x: -3.7, y: 2.4, z: 0, vx: (Math.random() - 0.5) * 1.2, vy: 1.8, vz: 0, g: -3, size: 0.28, life: 0.9, color: c.rust, alpha: 0.9 });
          }
        }
        g.mascot.setGaze(rate >= 0.05 ? 0.7 : -0.7);
        if (g.store.bokeh) for (var i = 0; i < g.store.bokeh.length; i++) {
          var b = g.store.bokeh[i];
          b.position.y += Math.sin(g.t * 0.6 + i) * 0.004;
          b.position.x += Math.cos(g.t * 0.4 + i) * 0.003;
        }
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

  var FULL_MED = 1000000;                  // RM 1M annual limit = a maxed force field

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
      bg: ["#cdbff0", "#dff1ec"],
      build: function (g) {
        var T = g.THREE, c = g.colors;
        softGround(g, 0xe3ddf5, 7.5);
        var capy = addCapy(g, -1.6, 0, 0, 1.5);
        capy.rotation.y = -0.5;   // face the viewer over the shield

        // force-field dome around Capy (medical card / RM1M)
        var dome = new T.Mesh(
          new T.SphereGeometry(2.0, 28, 20),
          new T.MeshPhysicalMaterial({ color: c.teal, roughness: 0.15, metalness: 0, transmission: 0.6, transparent: true, opacity: 0.22, emissive: c.teal, emissiveIntensity: 0.25, side: T.DoubleSide })
        );
        dome.position.set(-1.6, 1.6, 0); g.group.add(dome); g.store.dome = dome;
        var wire = new T.Mesh(new T.SphereGeometry(2.04, 16, 12),
          new T.MeshBasicMaterial({ color: c.teal, wireframe: true, transparent: true, opacity: 0.12 }));
        wire.position.copy(dome.position); g.group.add(wire); g.store.wire = wire;

        // brick shield wall (life cover)
        g.store.bricks = [];
        var bw = 0.86, bh = 0.66, rows = 5, cols = 2, wallX = 2.3;
        for (var r = 0; r < rows; r++) for (var col = 0; col < cols; col++) {
          var brick = new T.Mesh(new T.BoxGeometry(bw, bh, 0.7),
            g.kit.soft(c.gold, { emissive: c.goldDark, emissiveIntensity: 0.2 }));
          brick.position.set(wallX + col * (bw + 0.08), bh / 2 + r * (bh + 0.08), 0);
          brick.castShadow = true; g.group.add(brick); g.store.bricks.push(brick);
        }
        var bl = g.kit.label("SHIELD", { size: 0.5, color: "#9a6b15" });
        bl.position.set(2.75, 4.2, 0); g.group.add(bl);

        // medical card (gold) hovering top-left
        var card = new T.Group();
        card.add(new T.Mesh(new T.BoxGeometry(1.4, 0.9, 0.08), g.kit.glossy(c.gold)));
        var cv = new T.Mesh(new T.BoxGeometry(0.16, 0.5, 0.1), g.kit.soft(0x2e7d4f));
        var ch = new T.Mesh(new T.BoxGeometry(0.5, 0.16, 0.1), g.kit.soft(0x2e7d4f));
        cv.position.z = ch.position.z = 0.05; card.add(cv, ch);
        card.position.set(-4.4, 4.6, 0); card.rotation.set(-0.1, 0.3, 0.05);
        g.group.add(card); g.store.card = card;

        var alert = g.kit.label("⚠ NO MED CARD", { size: 0.62, color: "#fff0ea" });
        alert.position.set(0, 6.4, 0); alert.visible = false; g.group.add(alert);
        g.store.alert = alert;
        g.store.hazT = 0;
      },
      update: function (g) {
        var c = g.colors, dt = g.dt || 0.016;
        var ratio = g.clamp(g.m.ratio || 0, 0, 1.2);
        var field = g.clamp(g.m.forcefield || 0, 0, 1.2);
        var noCard = !g.values.medlimit;

        if (g.store.dome) {
          var dm = g.store.dome.material;
          var col = noCard ? c.rust : field >= 1 ? c.teal : field >= 0.5 ? c.gold : 0xe0a04a;
          dm.color.set(col); dm.emissive.set(col);
          dm.opacity = noCard ? 0.1 + (Math.sin(g.t * 8) * 0.5 + 0.5) * 0.08 : 0.14 + field * 0.3;
          g.store.dome.scale.setScalar(1 + Math.sin(g.t * 2) * 0.02);
          g.store.wire.material.color.set(col);
          g.store.wire.material.opacity = noCard ? 0.05 : 0.06 + field * 0.14;
          g.store.wire.rotation.y += dt * 0.3;
        }
        if (g.store.bricks) {
          var n = g.store.bricks.length, lit = Math.round(g.clamp(ratio, 0, 1) * n);
          var weak = ratio < 0.45;
          for (var i = 0; i < n; i++) {
            var b = g.store.bricks[i], m = b.material;
            if (i < lit && (!weak || g.reduced || ((g.t * 6) | 0) % 3 !== 0)) {
              m.color.set(c.gold); m.emissiveIntensity = 0.25; m.transparent = false; m.opacity = 1; b.scale.setScalar(1);
            } else {
              m.color.set(0x6b5a3a); m.emissiveIntensity = 0; m.transparent = true; m.opacity = 0.25; b.scale.setScalar(0.9);
            }
          }
        }
        if (g.store.card) {
          g.store.card.visible = !noCard;
          if (!noCard) { g.store.card.position.y = 4.6 + Math.sin(g.t * 1.6) * 0.12; g.store.card.rotation.y = 0.3 + Math.sin(g.t * 0.8) * 0.15; }
        }
        if (g.store.alert) g.store.alert.visible = noCard && (g.reduced || ((g.t * 3) | 0) % 2 === 0);

        if (!g.reduced && g.dt) {
          g.store.hazT += dt;
          if (g.store.hazT > 0.5) {
            g.store.hazT = 0;
            g.particles.spawn({
              x: 7, y: 1.4 + Math.random() * 2.6, z: 0, vx: -3.4, vy: 0, vz: 0,
              size: 0.4, life: 6, color: 0xf0ece0, alpha: 0.85,
              update: function (p) {
                if (p.resolved || p.sprite.position.x > 3.6) return;
                p.resolved = true;
                if (Math.random() < Math.min(1, ratio)) { p.vx = 4.5; p.vy = 4; p.g = -9; p.sprite.material.color.set(c.goldLight); p.life = p.age + 0.7; }
                else { p.sprite.material.color.set(c.rust); p.vx = -1.5; p.life = p.age + 0.8; }
              }
            });
          }
          if (field >= 1 && Math.random() < 0.2) {
            var a = Math.random() * Math.PI * 2;
            g.particles.spawn({ x: -1.6 + Math.cos(a) * 2, y: 1.6 + Math.sin(a) * 1.6, z: 0, vx: 0, vy: 0.6, vz: 0, size: 0.2, life: 0.7, color: c.goldLight, additive: true });
          }
        }
        g.mascot.setGaze(0.5);
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
      bg: ["#ffe7c2", "#e9f6ef"],
      build: function (g) {
        var T = g.THREE, c = g.colors;
        softGround(g, 0xeaf3d9, 8);
        addCapy(g, 0, 0, 0, 1.4);

        var nSteps = 8; g.store.nSteps = nSteps;
        g.store.x0 = -5.2; g.store.x1 = 4.4; g.store.maxClimb = 6.2;
        var span = g.store.x1 - g.store.x0, stepW = span / nSteps;
        g.store.steps = [];
        for (var i = 0; i < nSteps; i++) {
          var mound = i === 0;
          var step = new T.Mesh(new T.BoxGeometry(stepW * 0.92, 1, 1.4),
            mound ? g.kit.glossy(c.gold, { emissive: c.goldDark, emissiveIntensity: 0.2 })
                  : g.kit.soft(0x8fd0b6, { emissive: 0x2e6b52, emissiveIntensity: 0.08 }));
          step.position.set(g.store.x0 + i * stepW + stepW / 2, 0.5, 0);
          step.castShadow = true; step.receiveShadow = true;
          g.group.add(step); g.store.steps.push(step);
        }
        // flag pole + flag
        var poleH = g.store.maxClimb + 1.4;
        g.store.poleX = g.store.x1 + 0.5;
        var pole = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, poleH, 12), g.kit.glossy(0x9fb4ab));
        pole.position.set(g.store.poleX, poleH / 2, 0); g.group.add(pole);
        var ball = new T.Mesh(new T.SphereGeometry(0.16, 12, 12), g.kit.glossy(c.goldLight));
        ball.position.set(g.store.poleX, poleH, 0); g.group.add(ball);
        var flag = new T.Mesh(new T.PlaneGeometry(0.9, 0.6),
          g.kit.soft(c.gold, { side: T.DoubleSide, emissive: c.goldDark, emissiveIntensity: 0.2 }));
        flag.position.set(g.store.poleX - 0.45, 2, 0); g.group.add(flag); g.store.flag = flag;
        var goal = g.kit.label("GOAL", { size: 0.5, color: "#9a6b15" });
        goal.position.set(g.store.x0 + 0.6, g.store.maxClimb / 1.3 + 0.5, 0);
        g.group.add(goal); g.store.goal = goal;
        g.store.fwT = 0;
      },
      update: function (g) {
        var c = g.colors, dt = g.dt || 0.016, SCALE = 1.3;
        var ratio = g.clamp(g.m.ratio || 0, 0, SCALE);
        var startR = g.clamp(g.m.startRatio == null ? 0 : g.m.startRatio, 0, 1);
        var nSteps = g.store.nSteps, maxClimb = g.store.maxClimb;
        var goalClimb = maxClimb / SCALE, climb = maxClimb * (ratio / SCALE);
        var launchH = Math.min(climb, goalClimb * startR), ea = Math.exp(2) - 1, tops = [];
        for (var i = 0; i < nSteps; i++) {
          var sh = i === 0 ? launchH : launchH + (climb - launchH) * ((Math.exp(2 * i / (nSteps - 1)) - 1) / ea);
          sh = Math.max(0.4, sh);
          var step = g.store.steps[i], cy = step.scale.y;
          cy += (sh - cy) * (1 - Math.exp(-dt * 4));
          step.scale.y = cy; step.position.y = cy / 2; tops.push(cy);
        }
        if (g.store.goal) g.store.goal.position.y = goalClimb + 0.5;
        if (g.store.flag) {
          var fy = g.lerp(1.2, maxClimb + 0.6, g.clamp(ratio, 0, 1));
          g.store.flag.position.y += (fy - g.store.flag.position.y) * (1 - Math.exp(-dt * 4));
          g.store.flag.position.x = g.store.poleX - 0.45 + Math.sin(g.t * 3) * 0.04;
          g.store.flag.material.color.set(ratio >= 1 ? c.gold : 0xcdb06a);
        }
        var p = g.reduced ? 0.6 : (g.t * 0.06) % 1;
        var idx = Math.min(nSteps - 1, Math.floor(p * nSteps));
        g.mascot.object3d.position.set(g.store.x0 + p * (g.store.x1 - g.store.x0), tops[idx], 0);
        g.mascot.setWalk(g.reduced ? 0 : g.t * 7);
        g.mascot.setGaze(0.6);
        if (ratio >= 1 && !g.reduced) {
          g.store.fwT += dt;
          if (g.store.fwT > 0.5) {
            g.store.fwT = 0;
            var fx = g.store.poleX - 1 + Math.random() * 2, fyy = maxClimb + 1 + Math.random() * 0.6;
            for (var s = 0; s < 10; s++) {
              var a = (s / 10) * Math.PI * 2;
              g.particles.spawn({ x: fx, y: fyy, z: 0, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, vz: 0, g: -3, size: 0.22, life: 0.9, color: s % 2 ? c.goldLight : c.teal, additive: true });
            }
          }
        }
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
      bg: ["#3a2f5e", "#5e7a73"],
      build: function (g) {
        var T = g.THREE, c = g.colors;
        softGround(g, 0x46506a, 8);
        var capy = addCapy(g, -4.2, 0, 0, 1.4); capy.rotation.y = -0.35;

        // moon + soft glow
        var moon = g.kit.glow(0xfff3d0, 3.2); moon.position.set(-1.5, 6.4, -4); moon.material.opacity = 0.5; g.group.add(moon);
        var moonBall = new T.Mesh(new T.SphereGeometry(0.7, 20, 16),
          g.kit.soft(0xf6e7bd, { emissive: 0xf6e7bd, emissiveIntensity: 0.5 }));
        moonBall.position.set(-1.5, 6.4, -4); g.group.add(moonBall);

        // star field
        g.store.stars = [];
        for (var i = 0; i < 26; i++) {
          var st = g.kit.glow(0xffffff, 0.25 + Math.random() * 0.2);
          st.position.set((Math.random() - 0.5) * 13, 3 + Math.random() * 4.5, -3 - Math.random() * 2);
          st.material.opacity = 0.5; g.group.add(st); g.store.stars.push(st);
        }

        // Willow gate: two pillars + a stepped arch ring
        var gate = new T.Group(); g.store.gateMats = [];
        function gmat() { var m = g.kit.soft(0xb9a888); g.store.gateMats.push(m); return m; }
        var gx = 1.4, pillarH = 3.6;
        [-1, 1].forEach(function (s) {
          var pil = new T.Mesh(new T.BoxGeometry(0.5, pillarH, 0.5), gmat());
          pil.position.set(s * gx, pillarH / 2, 0); pil.castShadow = true; gate.add(pil);
        });
        var ringN = 9;
        for (var a = 0; a <= ringN; a++) {
          var ang = Math.PI * (a / ringN);
          var vb = new T.Mesh(new T.BoxGeometry(0.5, 0.5, 0.5), gmat());
          vb.position.set(-Math.cos(ang) * gx, pillarH + Math.sin(ang) * 1.1, 0);
          vb.rotation.z = ang; gate.add(vb);
        }
        g.group.add(gate);

        // willow strands hanging from the arch
        g.store.willows = [];
        for (var s2 = 0; s2 < 6; s2++) {
          var wv = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.9, 5),
            g.kit.soft(c.teal, { transparent: true, opacity: 0.7 }));
          wv.position.set(-1.1 + s2 * 0.44, pillarH + 0.55, 0.1); g.group.add(wv); g.store.willows.push(wv);
        }

        // family home (right)
        var home = new T.Group();
        var body = new T.Mesh(new T.BoxGeometry(1.9, 1.7, 1.6), g.kit.soft(0xd8b86a));
        body.position.y = 0.85; body.castShadow = true; home.add(body);
        var roof = new T.Mesh(new T.ConeGeometry(1.55, 1.1, 4), g.kit.soft(0xb5894a));
        roof.position.y = 2.25; roof.rotation.y = Math.PI / 4; home.add(roof);
        home.add(new T.Mesh(new T.BoxGeometry(0.5, 0.9, 0.1), g.kit.soft(0x5a3d1e)).translateZ(0.81).translateY(0.45));
        g.store.windows = [];
        [-1, 1].forEach(function (s) {
          var win = new T.Mesh(new T.BoxGeometry(0.4, 0.4, 0.1),
            g.kit.soft(0xf6e7bd, { emissive: 0xf6e7bd, emissiveIntensity: 0.6 }));
          win.position.set(s * 0.55, 1.0, 0.81); home.add(win); g.store.windows.push(win);
        });
        home.position.set(4.4, 0, -0.3); g.group.add(home);

        // waiting loved ones (rebuilt when the count changes)
        g.store.cluster = new T.Group(); g.group.add(g.store.cluster); g.store.clusterBuilt = -1;

        // frozen coin stack — slides through the gate when a Will is written
        var stack = new T.Group();
        for (var r = 0; r < 3; r++) for (var cc = 0; cc < (3 - r); cc++) {
          var coin = g.kit.coin(0.32);
          coin.position.set(cc * 0.5 - (2 - r) * 0.25, 0.32 + r * 0.34, 0); stack.add(coin);
        }
        stack.position.set(-2.6, 0, 0); g.group.add(stack); g.store.stack = stack;
        g.store.willPrev = null; g.store.epfT = 0; g.store.hibahT = 0;
      },
      update: function (g) {
        var c = g.colors, dt = g.dt || 0.016, v = g.values;
        var epf = !!v.epf, hibah = !!v.hibah, will = !!v.will;
        var loved = Math.max(1, Math.round(v.loved || 1));

        for (var i = 0; i < g.store.gateMats.length; i++) {
          var m = g.store.gateMats[i];
          m.color.set(will ? c.gold : 0x8a7d63);
          m.emissive.set(will ? c.goldDark : 0x000000);
          m.emissiveIntensity = will ? 0.3 : 0;
        }
        for (var s = 0; s < g.store.willows.length; s++) {
          var wv = g.store.willows[s];
          wv.rotation.z = Math.sin(g.t * 1.4 + s) * 0.18;
          wv.material.opacity = will ? 0.85 : 0.45;
        }
        for (var w = 0; w < g.store.windows.length; w++) g.store.windows[w].material.emissiveIntensity = will ? 0.95 : 0.35;
        for (var st = 0; st < g.store.stars.length; st++) g.store.stars[st].material.opacity = 0.25 + 0.4 * Math.abs(Math.sin(g.t * 0.8 + st));

        if (g.store.clusterBuilt !== loved) {
          g.store.clusterBuilt = loved;
          while (g.store.cluster.children.length) g.store.cluster.remove(g.store.cluster.children[0]);
          for (var k = 0; k < loved; k++) {
            var mc = makeMiniCapy(g), rowI = k >= 4 ? 1 : 0, colI = rowI ? k - 4 : k;
            mc.position.set(3.0 - colI * 0.7, 0, 0.4 - rowI * 0.7); mc.rotation.y = -0.6;
            g.store.cluster.add(mc);
          }
        }

        if (g.store.willPrev !== null && g.store.willPrev !== will && g.gsap && !g.reduced) {
          g.gsap.killTweensOf(g.store.stack.position);
          if (will) {
            g.gsap.to(g.store.stack.position, { x: 3.0, duration: 0.9, ease: "power2.inOut" });
            g.gsap.to(g.store.stack.position, { y: 1.2, duration: 0.45, yoyo: true, repeat: 1, ease: "sine.inOut" });
          } else {
            g.gsap.to(g.store.stack.position, { x: -2.6, y: 0, duration: 0.6, ease: "power2.out" });
          }
        } else if (g.reduced || g.store.willPrev === null) {
          g.store.stack.position.set(will ? 3.0 : -2.6, 0, 0);
        }
        g.store.willPrev = will;

        if (epf && !g.reduced && g.dt) {
          g.store.epfT += dt;
          if (g.store.epfT > 0.18) { g.store.epfT = 0; g.particles.spawn({ x: -3.8, y: 1.6, z: 0, vx: 1.4, vy: 0.3, vz: 0, g: -0.4, size: 0.3, life: 1.6, color: c.pink, alpha: 0.95 }); }
        }
        if (hibah && !g.reduced && g.dt) {
          g.store.hibahT += dt;
          if (g.store.hibahT > 0.1) { g.store.hibahT = 0; g.particles.spawn({ x: -3.6, y: 1.2, z: 0.2, vx: 3.0, vy: 0.4, vz: 0, size: 0.26, life: 1.1, color: c.teal, additive: true }); }
        }
        g.mascot.setGaze(0.5);
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
