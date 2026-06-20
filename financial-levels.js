/* financial-levels.js — the four structural stages of the wealth
   architecture toolkit, plus the DOM wiring between the sliders, the
   state engine and the live house blueprint.

   The FinancialEngine is reused purely as a state machine: each stage
   declares its inputs + a compute() that maps the numbers to a
   readiness index. The visual is no longer a canvas character — it is a
   responsive SVG house whose layers fill in as each index rises.

   Adding a fifth stage is one registerLevel() call. */

(function () {
  "use strict";

  // The engine still needs a canvas to construct; it is hidden and never
  // painted (every stage uses a no-op scene). All visuals are SVG/DOM.
  var canvas = document.getElementById("journeyCanvas");
  if (!canvas || !canvas.getContext || !window.FinancialEngine) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var engine = new FinancialEngine({ canvas: canvas, mascot: null, reducedMotion: reduced });
  var money = FinancialEngine.money;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* compact RM formatter used by the stage stat readouts */
  function rmShort(v) {
    v = Math.round(v);
    if (v >= 1e6) return "RM" + (Math.round(v / 1e5) / 10) + "M";
    if (v >= 1e4) return "RM" + Math.round(v / 1e3) + "K";
    if (v >= 1e3) return "RM" + (Math.round(v / 100) / 10) + "K";
    return "RM" + v;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // every stage renders nothing on the canvas — the blueprint is SVG
  var noScene = { draw: function () {} };

  /* ============================================================
     STAGE 01 — Liquid Capital (cashflow)
     Backend formulas preserved verbatim; only the labelling is premium.
     ============================================================ */

  /* shared global money state — Stage 01 and Stage 02 read & write the
     SAME income, so moving the slider in one stage moves it in the other. */
  var GLOBAL = { income: 5000, debt: 800 };
  var FULL_MED = 1000000;                  // RM 1M annual limit = a maxed health shield

  engine.registerLevel("budget", {
    name: "Liquid Capital",
    stepTag: "01",
    title: "Liquid Capital",
    sub: "Establishing Ground Stability",
    powerLabel: "Foundation Integrity",
    cta: "Next: Erect Pillars",
    layer: "foundation",
    inputs: [
      { key: "income", group: "Inflow · Monthly Capital", label: "Monthly Take-Home Pay", min: 1000, max: 20000, step: 100, value: 5000, fmt: "money", base: true },
      { key: "fixed", group: "Outflow · Fixed & Variable", label: "Fixed Commitments", sub: "(Rent, Insurance, Utilities, Bills)", min: 0, max: 20000, step: 100, value: 1500, fmt: "money", scaleWith: "income", maxFactor: 1.2 },
      { key: "debt", label: "Debt Repayments", sub: "(Car/Housing Loans, Credit Cards, PTPTN)", min: 0, max: 20000, step: 100, value: 800, fmt: "money", scaleWith: "income", maxFactor: 1.2 },
      { key: "other", label: "Other Spending", sub: "(Food, Lifestyle, Entertainment, Shopping)", min: 0, max: 20000, step: 100, value: 1500, fmt: "money", scaleWith: "income", maxFactor: 1.2 }
    ],
    compute: function (v) {
      // --- real-time cashflow maths (unchanged) ------------------------
      var totalExpenses = v.fixed + v.debt + v.other;
      var surplus = v.income - totalExpenses;
      var surplusPct = v.income > 0 ? (surplus / v.income) * 100 : 0;
      var dti = v.income > 0 ? (v.debt / v.income) * 100 : 0;
      var rate = v.income > 0 ? surplus / v.income : 0;
      var pctR = Math.round(surplusPct);
      var dtiR = Math.round(dti);

      var coach, headline;
      if (dti > 35) {
        coach = "Your Debt-to-Income ratio is sitting at " + dtiR + "%. Heavy debt servicing is "
          + "eroding the cash that should be reinforcing your base. Prioritise a debt-reduction "
          + "strategy to free up structural capacity.";
        headline = "Debt absorbs " + dtiR + "% of your take-home pay.";
      } else if (surplus < 0) {
        coach = "Outflow exceeds inflow — you are running a monthly deficit of "
          + money(Math.abs(surplus)) + ". The foundation cannot set while it is being drawn down. "
          + "Ease back on discretionary spending to reach a sustainable balance.";
        headline = "You overspend by " + money(Math.abs(surplus)) + " every month.";
      } else if (surplusPct >= 20) {
        coach = "You retain a healthy surplus of " + pctR + "% (" + money(surplus) + ") this month — "
          + "a textbook standard. This liquidity is the ground stability every higher layer is built on. "
          + "Route it upward into protection and accumulation.";
        headline = "You retain " + money(surplus) + " a month — a " + pctR + "% surplus.";
      } else {
        coach = "You hold a positive surplus of " + pctR + "% (" + money(surplus) + "), but the margin "
          + "is thin. A single unexpected expense could destabilise the base. Review discretionary "
          + "spending to widen your runway.";
        headline = "A slim " + pctR + "% surplus (" + money(surplus) + ") this month.";
      }

      // --- index: tied directly to surplus percentage (unchanged) ------
      var powerPct = clamp((surplusPct / 20) * 100, 0, 100);
      var tone = surplus <= 0 ? "red" : surplusPct >= 20 ? "green" : "gold";

      return {
        score: Math.round(powerPct),
        stat: (surplus >= 0 ? "+" : "−") + rmShort(Math.abs(surplus)),
        headline: headline,
        coach: coach,
        power: { pct: powerPct, tone: tone },
        metrics: {
          rate: clamp(rate, -0.5, 0.6),
          savings: Math.max(0, surplus),
          spendShare: clamp(v.income > 0 ? totalExpenses / v.income : 1.5, 0, 1.5)
        }
      };
    },
    scene: noScene
  });

  /* ============================================================
     STAGE 02 — Risk Mitigation (merged Life + Health protection)
     The two former phases now render on one screen. The underlying
     liability / income-replacement / medical formulas are unchanged;
     the two ratios are blended into a single Structural Pillars index.
     ============================================================ */

  engine.registerLevel("insurance", {
    name: "Risk Mitigation",
    stepTag: "02",
    title: "Risk Mitigation",
    sub: "Load-Bearing Resilience",
    powerLabel: "Structural Pillars",
    cta: "Next: Enclose Structure",
    layer: "pillars",
    inputs: [
      { key: "income", group: "Life Protection", label: "Monthly income", sub: "(Synced with Stage 01)", min: 1000, max: 30000, step: 100, value: 5000, fmt: "money" },
      { key: "mortgage", group: "Life Protection", label: "Outstanding mortgage debt", min: 0, max: 1500000, step: 10000, value: 300000, fmt: "money" },
      { key: "mrta", group: "Life Protection", label: "My mortgage is covered by MRTA / MLTA", type: "toggle", value: 0 },
      { key: "nonmortgage", group: "Life Protection", label: "Outstanding non-mortgage debt", sub: "(Car, cards, PTPTN)", min: 0, max: 500000, step: 5000, value: 50000, fmt: "money" },
      { key: "deps", group: "Life Protection", label: "Dependants", sub: "(People relying on you)", min: 0, max: 3, step: 1, value: 2, fmt: "deps" },
      { key: "cover", group: "Life Protection", label: "Existing life / takaful cover", min: 0, max: 2000000, step: 10000, value: 100000, fmt: "money" },
      { key: "medlimit", group: "Health Protection", label: "Annual medical card limit", sub: "(RM 0 = no medical card)", min: 0, max: 2000000, step: 100000, value: 500000, fmt: "money" },
      { key: "ciactive", group: "Health Protection", label: "Critical illness policy active", type: "toggle", value: 0 }
    ],
    compute: function (v) {
      var income = v.income;
      var deps = Math.round(v.deps);
      var depWord = deps >= 3 ? "3+" : String(deps);

      // ---- LIFE · liabilities + income replacement (unchanged) ----
      var mrta = v.mrta ? 1 : 0;
      var adjustedMortgage = mrta ? 0 : v.mortgage;             // MRTA settles the mortgage
      var totalLiabilities = adjustedMortgage + v.nonmortgage;
      var incomeReplace = deps <= 0 ? 0 : deps === 1 ? income * 12 * 7 : income * 12 * 10;
      var target = incomeReplace + totalLiabilities;
      var cover = v.cover;
      var lifeRatio = target > 0 ? cover / target : 1;
      var gap = Math.max(0, target - cover);

      // ---- HEALTH · medical card limit (unchanged) ----
      var medlimit = v.medlimit;
      var ciActive = v.ciactive ? 1 : 0;
      var fieldRatio = clamp(medlimit / FULL_MED, 0, 1);        // full shield at RM 1M

      // ---- LIFE commentary (unchanged justification copy) ----
      var why = "Life target: " + money(target) + ". ";
      if (deps === 0) {
        why += "With no dependants, the goal is simply to clear your "
          + money(totalLiabilities) + " in active liabilities so no debt is passed on.";
      } else {
        why += "With " + depWord + (deps === 1 ? " dependant" : " dependants")
          + ", your family needs " + (deps === 1 ? "7" : "10")
          + " years of income replaced to sustain their lives, plus your "
          + money(totalLiabilities) + " in active liabilities.";
      }
      if (mrta) why += " Your mortgage is excluded because your MRTA / MLTA settles it.";

      var lifeCoach;
      if (lifeRatio >= 1) {
        lifeCoach = why + " Your " + money(cover) + " cover clears this in full — your family is fully insulated.";
      } else {
        lifeCoach = why + " Your " + money(cover) + " cover leaves a " + money(gap)
          + " gap — usually the cheapest structural problem to solve.";
      }

      // ---- HEALTH commentary (unchanged copy) ----
      var medComment;
      if (medlimit === 0) {
        medComment = "🚨 CRITICAL RISK: Public healthcare is highly subsidised, but advanced "
          + "treatments, specialised implants, and cancer drugs still incur heavy out-of-pocket "
          + "costs. A major emergency could breach your cashflow.";
      } else if (medlimit < 200000) {
        medComment = "⚠️ WEAK BARRIER: Fine for basic ward stays, but complex surgeries or "
          + "intensive ICU care at Malaysian private hospitals can easily breach this ceiling "
          + "in a single admission.";
      } else if (medlimit < FULL_MED) {
        medComment = "🧱 MODEST SHIELD: Covers standard private treatments well. To stay fully "
          + "protected against medical inflation and long-term care, an upgrade to RM 1M+ is ideal.";
      } else {
        medComment = "✨ MAXED BARRIER: Secures your health completely — long-term therapies, "
          + "specialised surgeries, and private room stays with no lifetime caps.";
      }

      // ---- merge the two ratios into one Structural Pillars index ----
      var lifePct = clamp(lifeRatio * 100, 0, 100);
      var medPct = clamp(fieldRatio * 100, 0, 100);
      var combined = Math.round((lifePct + medPct) / 2);
      var tone = combined >= 80 ? "green" : combined < 40 ? "red" : "gold";

      var coach = lifeCoach + "\n\n" + medComment
        + "\n• Critical Illness: " + (ciActive ? "Active" : "Inactive")
        + " (Provides a cash payout to replace income if you need time off work to recover).";

      return {
        score: combined,
        stat: "PILLARS " + combined + "%",
        headline: "Life cover " + Math.round(lifePct) + "% · Medical shield " + Math.round(medPct) + "%.",
        coach: coach,
        power: { pct: combined, tone: tone },
        metrics: { ratio: clamp(lifeRatio, 0, 1.2), forcefield: fieldRatio }
      };
    },
    scene: noScene
  });

  /* ============================================================
     STAGE 03 — Capital Accumulation (retirement readiness)
     Backend compounding formulas preserved verbatim.
     ============================================================ */

  engine.registerLevel("retirement", {
    name: "Capital Accumulation",
    stepTag: "03",
    title: "Capital Accumulation",
    sub: "Weatherproof Shelter",
    powerLabel: "Enclosure Velocity",
    cta: "Next: Secure Access",
    layer: "shell",
    inputs: [
      { key: "age", label: "Age today", min: 20, max: 60, step: 1, value: 30, fmt: "age" },
      { key: "retireAge", label: "Retirement age", min: 40, max: 70, step: 1, value: 60, fmt: "age" },
      { key: "monthly", label: "Invested monthly", min: 0, max: 10000, step: 50, value: 600, fmt: "money" },
      { key: "wantIncome", label: "Retirement income /mo", min: 1000, max: 20000, step: 100, value: 3000, fmt: "money" },
      { type: "microrow", label: "Current Holdings", items: [
        { key: "cash", label: "Cash", sub: "2.5% p.a.", min: 0, max: 200000, step: 1000, value: 10000 },
        { key: "epf", label: "EPF", sub: "5.5% p.a.", min: 0, max: 1000000, step: 5000, value: 50000 },
        { key: "invest", label: "Invest", sub: "7.5% p.a.", min: 0, max: 1000000, step: 5000, value: 20000 }
      ] }
    ],
    compute: function (v) {
      var Y = Math.max(0, v.retireAge - v.age);    // years to retire
      var M = Y * 12;                              // months to retire
      var cash = v.cash || 0, epf = v.epf || 0, invest = v.invest || 0;

      // differentiated compounding on each existing bucket (unchanged)
      var fvCash = cash * Math.pow(1.025, Y);      // cash @ 2.5% p.a.
      var fvEpf = epf * Math.pow(1.055, Y);        // EPF  @ 5.5% p.a.
      var fvInvest = invest * Math.pow(1.075, Y);  // invest @ 7.5% p.a.
      var rM = 0.075 / 12;                         // monthly contributions @ 7.5% p.a.
      var fvSavings = v.monthly > 0 ? v.monthly * ((Math.pow(1 + rM, M) - 1) / rM) : 0;
      var pot = fvCash + fvEpf + fvInvest + fvSavings;

      var yearsToFund = Math.max(0, 80 - v.retireAge); // fund retirement → age 80
      var target = v.wantIncome * 12 * yearsToFund;
      var ratio = target > 0 ? pot / target : 0;
      var pct = Math.round(ratio * 100);

      var stashNow = cash + epf + invest;
      var startRatio = target > 0 ? clamp(stashNow / target, 0, 1) : 0;

      var coach = ratio < 1
        ? "Your current holdings and monthly contributions compound into " + money(pot) + " — reaching "
          + pct + "% of your " + money(target) + " goal, which funds a " + yearsToFund
          + "-year retirement runway to age 80. Raise your monthly investment to enclose the structure faster."
        : "Your holdings and steady contributions compound into " + money(pot)
          + ", fully clearing your " + money(target) + " goal and funding your "
          + yearsToFund + "-year retirement runway. The shelter is weatherproof.";

      return {
        score: clamp(pct, 0, 100),
        stat: "GOAL " + clamp(pct, 0, 999) + "%",
        headline: ratio >= 1
          ? "Fully enclosed — " + money(pot) + " vs a " + money(target) + " goal."
          : "Projected " + money(pot) + " — " + pct + "% of your " + money(target) + " goal.",
        coach: coach,
        power: { pct: clamp(ratio * 100, 0, 100), tone: ratio >= 1 ? "green" : ratio < 0.3 ? "red" : "gold" },
        metrics: { ratio: clamp(ratio, 0, 1.3), startRatio: startRatio }
      };
    },
    scene: noScene
  });

  /* ============================================================
     STAGE 04 — Wealth Preservation (estate & succession)
     Asset-unlock formula + the eight-state commentary matrix preserved.
     ============================================================ */

  engine.registerLevel("legacy", {
    name: "Wealth Preservation",
    stepTag: "04",
    title: "Wealth Preservation",
    sub: "Generational Alignment",
    powerLabel: "Legacy Access Index",
    cta: "Next: Generate Architectural Audit",
    layer: "landscape",
    inputs: [
      { key: "loved", label: "Loved ones", min: 1, max: 8, step: 1, value: 3, fmt: "people" },
      {
        key: "keys", type: "keyrow", label: "Access Instruments",
        items: [
          { key: "epf", label: "EPF Nominee Added", value: 0 },
          { key: "hibah", label: "Insurance / Takaful Beneficiary Assigned", value: 0 },
          { key: "will", label: "Will / Wasiat / Hibah Arranged", value: 0 }
        ]
      }
    ],
    compute: function (v) {
      // --- Asset Unlock Factor (unchanged) -----------------------------
      var epf = v.epf ? 1 : 0, will = v.will ? 1 : 0, hibah = v.hibah ? 1 : 0;
      var readiness = Math.min(1, 0.10 + epf * 0.30 + will * 0.30 + hibah * 0.30);
      var pct = Math.round(readiness * 100);
      var express = epf || hibah;          // nominees / Hibah bypass the courts
      var loved = v.loved;

      // --- explicit commentary permutation matrix (unchanged) ----------
      var coach;
      if (!epf && !hibah && !will) {
        coach = "🚨 ASSETS FROZEN: Without a plan, your wealth is locked in legal limbo. "
          + "Your loved ones face a complex, multi-year probate process just to access basic accounts.";
      } else if (epf && !hibah && !will) {
        coach = "⚡ PARTIAL EXPRESS LANE: Your EPF funds bypass court and reach beneficiaries "
          + "instantly. However, physical property, cash, and life insurance remain frozen until "
          + "you secure a Will / Hibah.";
      } else if (!epf && hibah && !will) {
        coach = "⚡ PARTIAL EXPRESS LANE: Your nominated insurance / takaful clears instantly for "
          + "immediate cash. But without an EPF nominee or a Will / Hibah, your retirement fund and "
          + "property are stuck in court.";
      } else if (!epf && !hibah && will) {
        coach = "🧱 ASSET PATHWAY READY: Your Will or Hibah ensures your physical properties are "
          + "cleanly gifted to the right people. However, your family is left with zero immediate "
          + "emergency cash while the estate processes.";
      } else if (epf && hibah && !will) {
        coach = "⚡ EXPRESS RUNWAY ACTIVE: Your liquid wealth (EPF and insurance payouts) transfers "
          + "instantly for daily needs. However, your physical properties remain legally stuck "
          + "without a Will or Hibah.";
      } else if (epf && !hibah && will) {
        coach = "🧱 PREPARED ESTATE: Your EPF transfers instantly and property distribution is freed "
          + "via Will or Hibah. Consider nominating your insurance / takaful to add immediate, "
          + "court-free cash flow.";
      } else if (!epf && hibah && will) {
        coach = "🧱 PROTECTED HOME: Your properties are secured via Will / Hibah and your insurance "
          + "provides fast cash. Don't forget your EPF — without a direct nominee, those funds fall "
          + "back into court.";
      } else {
        coach = "✨ MASTER LEGACY SECURED: Your EPF and insurance / takaful express lanes guarantee "
          + "immediate support, while your Will or Hibah safeguards and routes your properties. "
          + "Zero legal delays.";
      }

      return {
        score: pct,
        stat: "ACCESS " + pct + "%",
        headline: pct + "% legacy-ready for "
          + loved + (loved === 1 ? " loved one." : " loved ones."),
        coach: coach,
        power: { pct: pct, tone: pct >= 100 ? "green" : (express || will ? "gold" : "red") },
        metrics: { readiness: readiness, express: express ? 1 : 0, will: will }
      };
    },
    scene: noScene
  });

  /* ============================================================
     DOM references
     ============================================================ */
  var tabsEl = document.getElementById("journeyLevels");
  var controlsEl = document.getElementById("journeyControls");
  var titleEl = document.getElementById("journeyTitle");
  var tagEl = document.getElementById("journeyLevelTag");
  var subEl = document.getElementById("journeySub");
  var headlineEl = document.getElementById("journeyHeadline");
  var coachEl = document.getElementById("journeyCoach");
  var msgEl = document.getElementById("journeyMsg");
  var statEl = document.getElementById("journeyStat");
  var vibeEl = document.getElementById("journeyVibe");
  var vibePctEl = document.getElementById("journeyVibePct");
  var vibeBoxEl = document.querySelector(".journey__readout");
  var powerLabelEl = document.getElementById("journeyPowerLabel");
  var ctaEl = document.getElementById("journeyCta");
  var panelEl = document.getElementById("journeyPanel");
  var reportEl = document.getElementById("journeyReport");
  var stageEl = document.getElementById("journeyStage");

  // per-stage readiness index, seeded from defaults so unvisited stages
  // still render their layer in the blueprint
  var indexPct = {};
  var REPORT_VIEW = engine.order.length;   // the diagnostic screen index
  var curView = 0;

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
  var worldValues = {};
  engine.order.forEach(function (id) {
    var def = engine.levels[id];
    worldValues[id] = seedDefaults(def);
    var st = def.compute(Object.assign({}, worldValues[id]));
    indexPct[id] = clamp(Math.round((st.power && st.power.pct) || st.score || 0), 0, 100);
  });

  /* ============================================================
     The live house blueprint
     ============================================================ */
  var LAYER = {
    budget: "hsFoundation",
    insurance: "hsPillars",
    retirement: "hsShell",
    legacy: "hsLandscape"
  };

  function updateHouse(activeId) {
    Object.keys(LAYER).forEach(function (lvl) {
      var g = document.getElementById(LAYER[lvl]);
      if (!g) return;
      var pct = indexPct[lvl] || 0;
      var ghost = pct <= 0;
      g.classList.toggle("is-ghost", ghost);
      g.classList.toggle("is-active", lvl === activeId);
      g.style.opacity = ghost ? "" : String((0.5 + 0.5 * Math.min(1, pct / 100)).toFixed(3));
    });
  }

  /* ============================================================
     Tabs (desktop pagination) — 4 stages + the diagnostic audit
     ============================================================ */
  var tabs = [];
  engine.order.forEach(function (id, i) {
    var def = engine.levels[id];
    var b = document.createElement("button");
    b.className = "journey__tab";
    b.type = "button";
    b.setAttribute("role", "tab");
    b.innerHTML =
      '<span class="journey__tab-num">' + def.stepTag + "</span>" +
      '<span class="journey__tab-name">' + def.name + "</span>";
    b.addEventListener("click", function () { setView(i); });
    tabsEl.appendChild(b);
    tabs.push(b);
  });
  (function () {
    var b = document.createElement("button");
    b.className = "journey__tab";
    b.type = "button";
    b.setAttribute("role", "tab");
    b.innerHTML =
      '<span class="journey__tab-num">05</span>' +
      '<span class="journey__tab-name">Audit</span>';
    b.addEventListener("click", function () { setView(REPORT_VIEW); });
    tabsEl.appendChild(b);
    tabs.push(b);
  })();

  function updateTabs() {
    tabs.forEach(function (b, i) {
      b.classList.toggle("is-active", i === curView);
      var id = engine.order[i];
      b.classList.toggle("is-done", id && (indexPct[id] || 0) >= 60);
    });
  }

  /* ============================================================
     Controls builder (sliders / toggles / micro-rows / key-rows)
     ============================================================ */
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
    var hasGroups = def.inputs.some(function (inp) { return inp.group; });
    controlsEl.classList.toggle("journey__controls--grouped", hasGroups);

    var controls = {};
    var baseKey = null;
    def.inputs.forEach(function (inp) { if (inp.base) baseKey = inp.key; });
    function baseVal() {
      return baseKey && controls[baseKey] ? parseFloat(controls[baseKey].range.value) : 0;
    }
    function dynMax(inp) {
      var raw = baseVal() * (inp.maxFactor || 1);
      return Math.max(inp.min + inp.step, Math.round(raw / inp.step) * inp.step);
    }
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
          engine.setInput(it.key, val);
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
          engine.setInput(it.key, on ? 1 : 0);
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
        if (globalKey) GLOBAL[inp.key] = val;
        renderOut(inp, this, output);
        if (inp.base) refreshDynamic();
      });
      controlsEl.appendChild(row);
    });
  }

  /* ============================================================
     Engine event wiring
     ============================================================ */
  var lastMsg = "";
  engine.on("level", function (e) {
    var def = e.def;
    tagEl.textContent = def.stepTag + " / " + def.name;
    titleEl.textContent = def.title;
    if (subEl) subEl.textContent = def.sub || "";
    if (powerLabelEl) powerLabelEl.textContent = def.powerLabel || "Integrity";
    if (ctaEl) ctaEl.textContent = def.cta || "Next";
    buildControls(def);
    lastMsg = "";
  });

  engine.on("state", function (s) {
    if (engine.levelId) {
      var snap = worldValues[engine.levelId] || (worldValues[engine.levelId] = {});
      for (var vk in engine.values) snap[vk] = engine.values[vk];
    }
    headlineEl.textContent = s.headline || "";
    coachEl.textContent = s.coach || "";
    if (statEl) {
      statEl.textContent = s.stat || "";
      statEl.style.display = s.stat ? "" : "none";
    }
    if (msgEl && s.headline && s.headline !== lastMsg) {
      lastMsg = s.headline;
      msgEl.classList.remove("is-pop");
      void msgEl.offsetWidth;
      msgEl.classList.add("is-pop");
    }

    var pp = clamp(Math.round((s.power && s.power.pct) || s.score || 0), 0, 100);
    if (engine.levelId) indexPct[engine.levelId] = pp;

    vibeEl.style.width = pp + "%";
    vibePctEl.textContent = pp + "%";
    if (vibeBoxEl) {
      var tone = s.power && s.power.tone;
      vibeBoxEl.classList.toggle("is-green", tone === "green");
      vibeBoxEl.classList.toggle("is-red", tone === "red");
    }

    updateHouse(engine.levelId);
    updateTabs();
  });

  /* ============================================================
     View routing — 4 stages + the concluding diagnostic audit
     ============================================================ */
  function setView(i) {
    i = clamp(i, 0, REPORT_VIEW);
    curView = i;
    if (i < REPORT_VIEW) {
      if (reportEl) reportEl.hidden = true;
      if (panelEl) panelEl.hidden = false;
      if (msgEl) msgEl.style.display = "";
      engine.start(engine.order[i]);   // fires level + state → repaints everything
    } else {
      if (panelEl) panelEl.hidden = true;
      if (reportEl) reportEl.hidden = false;
      if (msgEl) msgEl.style.display = "none";
      if (vibeBoxEl) vibeBoxEl.classList.remove("is-green", "is-red");
      renderDiagnostic();
      if (powerLabelEl) powerLabelEl.textContent = "Overall Structural Integrity";
      var overall = Math.round(
        engine.order.reduce(function (a, id) { return a + (indexPct[id] || 0); }, 0) / engine.order.length
      );
      vibeEl.style.width = overall + "%";
      vibePctEl.textContent = overall + "%";
      updateHouse(null);
      updateTabs();
    }
  }

  /* ============================================================
     Concluding Structural Diagnostic Report
     ============================================================ */
  var INDEX_LABELS = [
    { id: "budget", label: "Foundation Integrity" },
    { id: "insurance", label: "Structural Pillars" },
    { id: "retirement", label: "Enclosure Velocity" },
    { id: "legacy", label: "Legacy Access Index" }
  ];

  function statusFor(pct) {
    if (pct >= 80) return { word: "Secure", cls: "is-secure" };
    if (pct >= 50) return { word: "Developing", cls: "is-developing" };
    if (pct > 0) return { word: "Exposed", cls: "is-exposed" };
    return { word: "Absent", cls: "is-absent" };
  }

  function diagnosticNotes() {
    var notes = [];
    if ((indexPct.retirement || 0) > 70 && (indexPct.insurance || 0) < 50) {
      notes.push({
        cls: "is-warn",
        title: "Structural Vulnerability Detected",
        body: "Your wealth velocity is exceptional, but a lack of systemic insulation means your "
          + "accumulated growth is structurally exposed to sudden external shocks."
      });
    }
    if ((indexPct.budget || 0) < 50) {
      notes.push({
        cls: "is-warn",
        title: "Unstable Base",
        body: "Your long-term plans are heavily penalised by low liquidity runway, leaving the "
          + "structure vulnerable to immediate cash-flow shifts."
      });
    }
    if (!notes.length) {
      notes.push({
        cls: "is-ok",
        title: "Balanced Structure",
        body: "Each layer is carrying its load. Maintain this alignment and revisit the audit "
          + "annually as your circumstances evolve."
      });
    }
    return notes;
  }

  function renderDiagnostic() {
    if (!reportEl) return;
    var overall = Math.round(
      engine.order.reduce(function (a, id) { return a + (indexPct[id] || 0); }, 0) / engine.order.length
    );

    var rows = INDEX_LABELS.map(function (r) {
      var pct = indexPct[r.id] || 0;
      var st = statusFor(pct);
      return '<tr>'
        + '<th scope="row">' + esc(r.label) + '</th>'
        + '<td class="journey__sc-val">' + pct + '%</td>'
        + '<td><span class="journey__sc-status ' + st.cls + '">' + st.word + '</span></td>'
        + '</tr>';
    }).join("");

    var notes = diagnosticNotes().map(function (n) {
      return '<div class="journey__note ' + n.cls + '">'
        + '<p class="journey__note-title">' + esc(n.title) + '</p>'
        + '<p class="journey__note-body">' + esc(n.body) + '</p></div>';
    }).join("");

    reportEl.innerHTML =
      '<p class="journey__panel-eyebrow">05 / Structural Audit</p>'
      + '<h3 class="journey__panel-title">Your Architectural Diagnostic</h3>'
      + '<p class="journey__panel-sub">Overall structural integrity &middot; <b>' + overall + '%</b></p>'
      + '<table class="journey__scorecard"><thead><tr>'
      + '<th scope="col">Index</th><th scope="col">Value</th><th scope="col">Status</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table>'
      + '<div class="journey__notes">' + notes + '</div>'
      + '<div class="journey__report-actions">'
      + '<a class="journey__cta journey__cta--primary" href="#contact">[ Schedule a Structural Audit with Dr. Sofina ]</a>'
      + '<button type="button" class="journey__report-link" id="journeyReportSend">Email this report to Dr. Sofina</button>'
      + '</div>';

    var sendBtn = document.getElementById("journeyReportSend");
    if (sendBtn) sendBtn.addEventListener("click", openPlan);
  }

  /* ============================================================
     CTA — advance to the next view (Stage 04 → diagnostic)
     ============================================================ */
  if (ctaEl) ctaEl.addEventListener("click", function () { setView(curView + 1); });

  /* ============================================================
     Mobile swipe between views (the desktop tabs stay too)
     Bound to the blueprint stage so it never fights the sliders.
     ============================================================ */
  (function () {
    if (!stageEl) return;
    var x0 = 0, y0 = 0, t0 = 0, tracking = false;
    stageEl.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) { tracking = false; return; }
      tracking = true;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
    }, { passive: true });
    stageEl.addEventListener("touchend", function (e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - x0, dy = t.clientY - y0;
      if (Date.now() - t0 > 600) return;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      setView(curView + (dx < 0 ? 1 : -1));
    }, { passive: true });
  })();

  /* ============================================================
     Lead-capture report (email to Dr. Sofina) — preserved, rebranded.
     Compiles all four stages into a printable report and a submission.
     ============================================================ */
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

  function collectReport() {
    var stages = [];
    var totalScore = 0;
    engine.order.forEach(function (id) {
      var def = engine.levels[id];
      var vals = Object.assign({}, worldValues[id]);
      if ("income" in vals) vals.income = GLOBAL.income;
      if ("debt" in vals) vals.debt = GLOBAL.debt;
      var st = def.compute(vals);
      totalScore += st.score || 0;
      stages.push({
        tag: def.stepTag,
        category: def.name,
        name: def.title,
        powerLabel: def.powerLabel,
        inputs: describeInputs(def, vals),
        st: st
      });
    });
    return { stages: stages, overall: Math.round(totalScore / engine.order.length) };
  }

  function toneClass(tone) {
    return tone === "green" ? " is-green" : tone === "red" ? " is-red" : "";
  }

  function renderReportHTML(report) {
    var html = '<div class="plan-report__head">'
      + '<p class="plan-report__overall">Overall structural integrity <b>' + report.overall + '%</b></p>'
      + '<p class="plan-report__intro">A snapshot of your four-stage financial architecture. '
      + 'Bring this to your session with Dr. Sofina.</p></div>';

    report.stages.forEach(function (stg) {
      var st = stg.st;
      var p = clamp(Math.round((st.power && st.power.pct) || st.score || 0), 0, 100);
      var tone = st.power ? st.power.tone : "gold";
      html += '<section class="plan-world">'
        + '<div class="plan-world__top"><div>'
        + '<p class="plan-world__tag">' + esc(stg.tag) + ' · ' + esc(stg.category) + '</p>'
        + '<p class="plan-world__name">' + esc(stg.name) + '</p></div>'
        + '<span class="plan-world__score">' + esc(st.stat || (st.score + "%")) + '</span></div>'
        + '<div class="plan-bar"><span class="plan-bar__label">' + esc(stg.powerLabel || "Index")
        + '</span><div class="plan-bar__track"><div class="plan-bar__fill' + toneClass(tone)
        + '" style="width:' + p + '%"></div></div><span class="plan-bar__pct">' + p + '%</span></div>';

      html += '<ul class="plan-world__inputs">';
      stg.inputs.forEach(function (r) {
        html += '<li><span>' + esc(r.label) + '</span><b>' + esc(r.value) + '</b></li>';
      });
      html += '</ul>';

      html += '<div class="plan-world__phase">'
        + '<p class="plan-world__headline">' + esc(st.headline) + '</p>'
        + '<p class="plan-world__coach">' + esc(st.coach) + '</p></div>';
      html += '</section>';
    });
    return html;
  }

  function renderReportText(report, remark, userName, userEmail, userWhatsapp, userSubscribe) {
    var L = [];
    L.push("STRUCTURAL DIAGNOSTIC REPORT — FINANCIAL ARCHITECTURE");
    L.push("Overall structural integrity: " + report.overall + "%");
    L.push("================================================");
    L.push("");
    L.push("CONTACT DETAILS");
    L.push("Name: " + (userName || "(not provided)"));
    L.push("Email: " + (userEmail || "(not provided)"));
    L.push("WhatsApp: " + (userWhatsapp || "(not provided)"));
    L.push("WhatsApp Broadcast: " + (userSubscribe || "No"));
    L.push("================================================");
    report.stages.forEach(function (stg) {
      L.push("");
      L.push(stg.tag + " · " + stg.name + "   [" + (stg.st.stat || "") + "]");
      L.push("------------------------------------------------");
      L.push("Selections:");
      stg.inputs.forEach(function (r) { L.push("  • " + r.label + ": " + r.value); });
      L.push("");
      L.push(stg.powerLabel + ": " + clamp(Math.round((stg.st.power && stg.st.power.pct) || stg.st.score || 0), 0, 100) + "%");
      L.push(stg.st.headline);
      L.push(stg.st.coach);
    });
    L.push("");
    L.push("================================================");
    L.push("User remark: " + (remark && remark.trim() ? remark.trim() : "(none)"));
    return L.join("\n");
  }

  /* ---------- modal plumbing ---------- */
  var planModal = document.getElementById("planModal");
  var planBackdrop = document.getElementById("planModalBackdrop");
  var planClose = document.getElementById("planModalClose");
  var planReportEl = document.getElementById("planReport");
  var planRemarkEl = document.getElementById("planRemark");
  var planSendBtn = document.getElementById("planSendBtn");
  var planStatusEl = document.getElementById("planSendStatus");

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
    if (planSendBtn) { planSendBtn.disabled = false; planSendBtn.textContent = "Send to Dr. Sofina"; }
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
    setStatus("Sending your report…", null);

    var payload = JSON.stringify({
      name: userName,
      email: userEmail,
      whatsapp: userWhatsapp,
      subscribe: userSubscribe || "No",
      readiness: currentReport.overall + "%",
      remark: remark || "(none)",
      report: text
    });

    fetch("/api/send-roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || !data.ok) {
          throw new Error(data && data.error ? data.error : "bad status " + res.status);
        }
        setStatus("Sent! Dr. Sofina will receive your report.", "ok");
        planSendBtn.textContent = "Sent";
      });
    }).catch(function (err) {
      setStatus(
        (err && err.message) ? ("Couldn't send — " + err.message) : "Sending failed — check your connection and try again.",
        "err"
      );
      planSendBtn.disabled = false;
      planSendBtn.textContent = "Send to Dr. Sofina";
    });
  }

  if (planClose) planClose.addEventListener("click", closePlan);
  if (planBackdrop) planBackdrop.addEventListener("click", closePlan);
  if (planSendBtn) planSendBtn.addEventListener("click", sendToSofina);

  /* ============================================================
     Boot
     ============================================================ */
  setView(0);
})();
