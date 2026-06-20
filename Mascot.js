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

  };

  global.Mascot = Mascot;
})(window);
