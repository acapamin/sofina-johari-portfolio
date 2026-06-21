/* Mascot.js — "Capy", the 8-bit pixel-art capybara guide.
   NES-style sprite rendered from a pixel map, with a moodState
   driven by financial data.

   Moods are parameter sets (eyes / brows / mouth / blush / effects)
   composited onto the base sprite, so new states never require
   touching the renderer:
     Mascot.registerMood('zen', { eyes: 'closed', blush: true });
     mascot.setMood('zen');

   Sprite frames are cached on tiny offscreen canvases and blitted
   with integer scaling — cheap enough for low-end mobile GPUs. */

(function (global) {
  "use strict";

  /* ---------- pixel art ---------- */

  var PAL = {
    o: "#2b1a10",   // outline / dark fur
    b: "#b07d46",   // body brown
    s: "#8a5d33",   // snout
    n: "#2b1a10",   // nostril
    k: "#1c1008",   // eye / facial ink
    g: "#e7c069",   // gold (star eyes)
    G: "#f6e7bd",   // light gold
    r: "#d96a4a"    // blush
  };

  // 17 × 13, facing right; legs rows 11–12 swap per walk frame
  var BODY = [
    ".........oo..oo..",
    "...ooooooooooooo.",
    "..obbbbbbbbbbbbbo",
    ".obbbbbbbbbbbbbbo",
    ".obbbbbbbbbbbbbbo",
    ".obbbbbbbbbbbssso",
    ".obbbbbbbbbbbsnso",
    ".obbbbbbbbbbbssso",
    ".obbbbbbbbbbbbboo",
    ".obbbbbbbbbbbbbo.",
    "..obbbbbbbbbbbo.."
  ];
  var LEGS = [
    ["..oo...oo...oo...",
     "..oo...oo...oo..."],
    ["...oo...oo...oo..",
     "...oo...oo...oo.."]
  ];

  /* Face overlays are deliberately chunky (2×2 eyes, thick brows,
     visible mouths) so the mood reads even at small mobile sizes. */
  var EYES = {
    open:    [[12, 3, "k"], [11, 4, "k"], [12, 4, "k"], [11, 3, "G"]],
    happy:   [[10, 4, "k"], [11, 3, "k"], [12, 3, "k"], [13, 4, "k"]],
    star:    [[11, 2, "g"], [10, 3, "g"], [12, 3, "g"], [11, 4, "g"], [11, 3, "G"]],
    closed:  [[10, 4, "k"], [11, 4, "k"], [12, 4, "k"], [13, 4, "k"]],
    soft:    [[10, 5, "k"], [11, 5, "k"], [12, 5, "k"]],
    worried: [[11, 5, "k"], [12, 5, "k"], [11, 6, "k"], [12, 6, "k"]]
  };
  var BROWS = {
    none:  [],
    knit:  [[9, 2, "k"], [10, 3, "k"], [11, 4, "k"]],
    flat:  [[10, 2, "k"], [11, 2, "k"], [12, 2, "k"]],
    raise: [[9, 3, "k"], [10, 2, "k"], [11, 2, "k"], [12, 3, "k"]]
  };
  var MOUTHS = {
    none: [],
    grin: [[12, 8, "k"], [13, 8, "k"], [14, 8, "k"], [13, 9, "k"]],
    sad:  [[11, 9, "k"], [12, 9, "k"], [13, 9, "k"]]
  };
  var BLUSH = [[9, 6, "r"], [10, 6, "r"]];

  var SPR_W = 17, SPR_H = 13;
  var frameCache = {};

  function buildFrame(eyes, brow, mouth, blush, leg) {
    var key = [eyes, brow, mouth, blush ? 1 : 0, leg].join("|");
    if (frameCache[key]) return frameCache[key];
    var c = document.createElement("canvas");
    c.width = SPR_W;
    c.height = SPR_H;
    var ctx = c.getContext("2d");
    var rows = BODY.concat(LEGS[leg]);
    for (var y = 0; y < rows.length; y++) {
      for (var x = 0; x < SPR_W; x++) {
        var ch = rows[y][x];
        if (ch && ch !== ".") {
          ctx.fillStyle = PAL[ch];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    function overlay(list) {
      for (var i = 0; i < list.length; i++) {
        ctx.fillStyle = PAL[list[i][2]];
        ctx.fillRect(list[i][0], list[i][1], 1, 1);
      }
    }
    overlay(EYES[eyes] || EYES.open);
    overlay(BROWS[brow] || []);
    overlay(MOUTHS[mouth] || []);
    if (blush) overlay(BLUSH);
    frameCache[key] = c;
    return c;
  }

  /* ---------- mascot ---------- */

  function Mascot() {
    this.moodState = "stable";
    this.t = Math.random() * 100;
    this.pulse = 0;            // hop envelope fired on mood change
    this.blink = 0;
    this._nextBlink = 2 + Math.random() * 3;
  }

  /* bounce: idle hop amplitude (internal px) · speed: idle tempo
     eyes / brows / mouth / blush: sprite overlays
     sparkle / sweat / hearts: ambient pixel effects */
  Mascot.MOODS = {
    stable:     { bounce: 1, speed: 2.0, eyes: "open",    brows: "none",  mouth: "none", blush: false, sparkle: false, sweat: false, hearts: false },
    joyful:     { bounce: 4, speed: 6.0, eyes: "happy",   brows: "none",  mouth: "grin", blush: true,  sparkle: true,  sweat: false, hearts: false },
    growth:     { bounce: 3, speed: 4.0, eyes: "star",    brows: "none",  mouth: "grin", blush: false, sparkle: true,  sweat: false, hearts: false },
    cautious:   { bounce: 1, speed: 1.2, eyes: "open",    brows: "flat",  mouth: "none", blush: false, sparkle: false, sweat: false, hearts: false },
    concerned:  { bounce: 0, speed: 0.9, eyes: "worried", brows: "knit",  mouth: "sad",  blush: false, sparkle: false, sweat: true,  hearts: false },
    serene:     { bounce: 1, speed: 1.0, eyes: "closed",  brows: "none",  mouth: "none", blush: true,  sparkle: false, sweat: false, hearts: true },
    calm:       { bounce: 1, speed: 1.4, eyes: "soft",    brows: "none",  mouth: "none", blush: false, sparkle: false, sweat: false, hearts: false },
    thoughtful: { bounce: 0, speed: 1.0, eyes: "soft",    brows: "raise", mouth: "none", blush: false, sparkle: false, sweat: false, hearts: false }
  };

  Mascot.MOOD_ALIASES = { "risk-averse": "cautious", happy: "joyful", worried: "concerned" };

  /* Emotion scale: stress → joy. Used across four financial worlds.
     Each mood maps to a financial readiness threshold and visual personality.
  */
  Mascot.EMOTION_SCALE = [
    {
      name: "concerned",
      rank: 1,
      category: "Crisis",
      label: "Distressed",
      color: "#d96a4a",
      description: "Anxious, overwhelmed — cashflow negative or debt-heavy",
      triggers: [
        "• Monthly deficit (spending > income)",
        "• Debt-to-income > 35%",
        "• No medical protection active",
        "• Estate completely unplanned"
      ],
      expression: "Worried eyes, knit brows, sad mouth, sweat droplets",
      energy: "Frozen — no bounce, sluggish movement (0.9×)"
    },
    {
      name: "cautious",
      rank: 2,
      category: "Risk",
      label: "Alert",
      color: "#e7c069",
      description: "Guarded, watchful — risky territory requiring attention",
      triggers: [
        "• Weak surplus (0–20% of income)",
        "• Life protection gap (45–75% of target)",
        "• Medical coverage < RM 200k",
        "• Retirement progress < 25% of goal"
      ],
      expression: "Open eyes, flat brows, neutral mouth",
      energy: "Minimal movement — careful pace (1.2×)"
    },
    {
      name: "thoughtful",
      rank: 3,
      category: "Reflective",
      label: "Contemplative",
      color: "#9fd8c4",
      description: "Introspective, deliberate — engaged in planning decisions",
      triggers: [
        "• Estate planning phase (not yet activated)",
        "• Evaluating legacy keys and succession"
      ],
      expression: "Soft eyes, raised brows (thinking), neutral mouth",
      energy: "Still and measured — deliberate tempo (1.0×)"
    },
    {
      name: "stable",
      rank: 4,
      category: "Baseline",
      label: "Balanced",
      color: "#b07d46",
      description: "Steady, grounded — meeting requirements with tight margins",
      triggers: [
        "• Healthy surplus (1–20% of income)",
        "• Life protection solid (75%+ of target)",
        "• Medical coverage modest (RM 200k–1M)",
        "• Retirement progress 50–80% of goal"
      ],
      expression: "Open eyes, no brows, neutral mouth",
      energy: "Normal pace — balanced movement (2.0×)"
    },
    {
      name: "calm",
      rank: 5,
      category: "Secure",
      label: "Peaceful",
      color: "#9fd8c4",
      description: "Relaxed, comfortable — solid protections in place",
      triggers: [
        "• Good life insurance coverage",
        "• Modest medical shield (standard private care)",
        "• Estate partially secured (1–2 keys active)"
      ],
      expression: "Soft eyes, no brows, neutral mouth, no blush",
      energy: "Relaxed movement — unhurried pace (1.4×)"
    },
    {
      name: "serene",
      rank: 6,
      category: "Complete",
      label: "Content",
      color: "#9fd8c4",
      description: "At peace, fulfilled — all protections fully activated and secured",
      triggers: [
        "• Estate 100% ready (all three legacy keys active)",
        "• All dependants covered by will/hibah"
      ],
      expression: "Closed eyes, rosy blush, floating hearts",
      energy: "Peaceful rhythm — calm movement (1.0×)"
    },
    {
      name: "growth",
      rank: 7,
      category: "Progress",
      label: "Optimistic",
      color: "#e7c069",
      description: "Excited, climbing — making strong progress toward goals",
      triggers: [
        "• Retirement savings 80%–110% of goal",
        "• Steady compounding and contributions"
      ],
      expression: "Star eyes (✨), grinning mouth, golden sparkles",
      energy: "Energetic bounce — upbeat tempo (4.0×)"
    },
    {
      name: "joyful",
      rank: 8,
      category: "Thriving",
      label: "Delighted",
      color: "#e7c069",
      description: "Thriving, celebrating — exceeding all targets and goals",
      triggers: [
        "• Surplus ≥ 20% of income (Cashflow mastery)",
        "• Life insurance 100%+ of target (Full brick shield)",
        "• Medical coverage maxed at RM 1M+ (Force field)",
        "• Retirement savings 110%+ of goal (Flagpole conquered)"
      ],
      expression: "Happy bright eyes, grinning mouth, rosy blush, golden sparkles",
      energy: "Bouncy, celebratory — high energy (6.0×)"
    }
  ];

  Mascot.registerMood = function (name, def) {
    Mascot.MOODS[name] = Object.assign({}, Mascot.MOODS.stable, def);
  };

  Mascot.prototype.setMood = function (name) {
    var key = Mascot.MOOD_ALIASES[name] || name;
    if (!Mascot.MOODS[key] || key === this.moodState) return;
    this.moodState = key;
    this.pulse = 1;
  };

  Mascot.prototype.mood = function () {
    return Mascot.MOODS[this.moodState] || Mascot.MOODS.stable;
  };

  Mascot.prototype.update = function (dt) {
    this.t += dt;
    if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 2.4);
    this._nextBlink -= dt;
    if (this._nextBlink <= 0) { this.blink = 0.14; this._nextBlink = 2.4 + Math.random() * 3.6; }
    if (this.blink > 0) this.blink = Math.max(0, this.blink - dt);
  };

  /* draw(ctx, x, y, size [, o])
       x, y   — ground anchor (bottom-centre of the sprite)
       o.walk — walking phase; alternates the leg frame + gait hop
       o.gaze — negative values flip the sprite to face left
       o.flip — force facing left */
  Mascot.prototype.draw = function (ctx, x, y, size, o) {
    o = o || {};
    var m = this.mood(), t = this.t;

    var px = Math.max(1, Math.round(size / SPR_H));
    var hop = Math.round(Math.abs(Math.sin(t * m.speed)) * m.bounce);
    if (o.walk) hop += Math.round(Math.abs(Math.sin(o.walk * Math.PI)) * 2);
    hop += Math.round(Math.sin(this.pulse * Math.PI) * 4);

    var eyes = this.blink > 0 && m.eyes !== "closed" ? "closed" : m.eyes;
    var leg = o.walk ? (Math.floor(o.walk) % 2) : 0;
    var spr = buildFrame(eyes, m.brows, m.mouth, m.blush, leg);

    var dw = SPR_W * px, dh = SPR_H * px;
    var dx = Math.round(x - dw / 2), dy = Math.round(y - dh - hop * px);
    var flip = o.flip || (o.gaze != null && o.gaze < 0);

    // chunky ground shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(Math.round(x - dw * 0.32), Math.round(y), Math.round(dw * 0.64), px);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (flip) {
      ctx.translate(Math.round(x) * 2, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(spr, dx, dy, dw, dh);
    ctx.restore();

    // ambient effects (drawn in screen space, pixel-aligned)
    var headX = Math.round(x), headY = dy;
    if (m.sparkle) {
      for (var i = 0; i < 2; i++) {
        var ang = t * 2 + i * Math.PI;
        var sx2 = Math.round(headX + Math.cos(ang) * dw * 0.7);
        var sy2 = Math.round(headY + dh * 0.3 + Math.sin(ang * 1.3) * dh * 0.4);
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i * 1.7));
        ctx.fillStyle = PAL.G;
        ctx.fillRect(sx2, sy2 - px, px, px * 3);
        ctx.fillRect(sx2 - px, sy2, px * 3, px);
        ctx.globalAlpha = 1;
      }
    }
    if (m.sweat) {
      var drop = (t * 14) % 16;
      ctx.globalAlpha = Math.max(0, 1 - drop / 16);
      ctx.fillStyle = "#9fd8c4";
      ctx.fillRect(Math.round(x + dw * 0.42), Math.round(headY + drop), px, px * 2);
      ctx.globalAlpha = 1;
    }
    if (m.hearts) {
      var cyc = (t * 0.5) % 1;
      ctx.globalAlpha = Math.max(0, 0.8 - cyc);
      ctx.fillStyle = PAL.r;
      var hx2 = Math.round(x + dw * 0.4), hy2 = Math.round(headY - 4 - cyc * 14);
      ctx.fillRect(hx2, hy2, px, px);
      ctx.fillRect(hx2 + px * 2, hy2, px, px);
      ctx.fillRect(hx2, hy2 + px, px * 3, px);
      ctx.fillRect(hx2 + px, hy2 + px * 2, px, px);
      ctx.globalAlpha = 1;
    }
  };

  global.Mascot = Mascot;
})(window);
