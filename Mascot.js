/* Mascot.js — "Capy", an 8-bit pixel-art capybara in a tuxedo.
   A forward-facing bust (head + suit) rendered from a pixel map, with a
   moodState driven by financial data. Capy is both the mood indicator and
   the "speaker" of the read-out, so the expression + motion carry the tone.

   Moods are parameter sets (eyes / brows / mouth / effects + a motion
   style) composited onto the base sprite, so new states never require
   touching the renderer:
     Mascot.registerMood('zen', { eyes: 'closed', blush: true });
     mascot.setMood('zen');

   Sprite frames are cached on tiny offscreen canvases and blitted with
   integer scaling — cheap enough for low-end mobile GPUs. */

(function (global) {
  "use strict";

  /* ---------- palette ---------- */
  var PAL = {
    o: "#3a2412",   // outline / darkest fur
    b: "#9c6a3c",   // body fur
    d: "#7c5230",   // fur shadow
    l: "#bd8a52",   // fur highlight
    s: "#a87a4e",   // muzzle
    m: "#c39a6b",   // muzzle highlight
    n: "#2b1a10",   // nose / nostril
    k: "#1c1008",   // ink (eyes / mouth)
    W: "#fbf6ea",   // eye shine
    w: "#f2ead8",   // dress shirt
    g: "#d7cab0",   // shirt shadow
    j: "#1e1e26",   // tuxedo jacket
    J: "#33333f",   // jacket highlight / lapel
    t: "#121216",   // bow tie
    r: "#d77a5e",   // blush / tongue
    G: "#f6e7bd",   // gold sparkle
    e: "#e7c069",   // gold star eye
    c: "#bfe6f2"    // sweat / tear (cool)
  };

  // 24 wide × 42 tall — head + full body + legs, facing the viewer.
  var BODY = [
    // head (rows 0-17)
    ".....oo.........oo......",
    "....obbo........obbo....",
    "...obbbbbbbbbbbbbbbbo...",
    "..obbbbbbbbbbbbbbbbbbo..",
    "..obbbbbbbbbbbbbbbbbbo..",
    ".obbbbbbbbbbbbbbbbbbbbo.",
    ".obllbbbbbbbbbbbbbbbbbo.",
    ".obbbbbbbbbbbbbbbbbbbbo.",
    ".obbbbbbbbbbbbbbbbbbbbo.",
    ".obbbbbbbbbbbbbbbbbbbbo.",
    "..obbbssssssssssssbbbo..",
    "..obbbssssnnnnssssbbbo..",
    "..obbbsssssnnsssssbbbo..",
    "..obbbssssssssssssbbbo..",
    "..obbbbssssssssssbbbbo..",
    "...obbbbssssssssbbbbo...",
    "....odbbbbbbbbbbbbdo....",
    ".....oddbbbbbbbbddo.....",
    // tuxedo top (rows 18-25)
    "....jjjjwwwttwwwjjjj....",
    "..jjjjjjwwttttwwjjjjjj..",
    ".jjjjjjjwwwwwwwwjjjjjjj.",
    ".jJjjjjjwwwwwwwwjjjjjJj.",
    "jJjjjjjjwwwwwwwwjjjjjjJj",
    "jJjjjjjjwwwwwwwwjjjjjjJj",
    "jjjjjjjjwwwwwwwwjjjjjjjj",
    "jjjjjjjjwwwwwwwwjjjjjjjj",
    // barrel body (rows 26-33)
    "jjjjjjjjwwwwwwwwjjjjjjjj",
    "jjjjjjjjwwwwwwwwjjjjjjjj",
    "jjjjjjjjwwwwwwwwjjjjjjjj",
    "jjjjjjjjwwwwwwwwjjjjjjjj",
    "jjjjjjjjwwwwwwwwjjjjjjjj",
    ".jjjjjjjwwwwwwwwjjjjjjj.",
    "..jjjjjjwwwwwwwwjjjjjj..",
    "...jjjjjwwwwwwwwjjjjj...",
    // belly (rows 34-37)
    "...ojbbbwwwwwwwwbbbjo...",
    "...obbbbbbbbbbbbbbbbо...",
    "..obbbbbbbbbbbbbbbbbbo..",
    ".obbbbbbbbbbbbbbbbbbbbo.",
    // legs (rows 38-41)
    "..ojbbbb......bbbbjo....",
    "..ojbbbb......bbbbjo....",
    "..ojbbbb......bbbbjo....",
    "..oddddd......dddddо...."
  ];

  /* face feature overlays — [x, y, paletteChar] (eyes rows 7-8, mouth 13-14) */
  var EYES = {
    open:    [[7,7,"k"],[8,7,"k"],[7,8,"k"],[8,8,"k"],[15,7,"k"],[16,7,"k"],[15,8,"k"],[16,8,"k"],[7,7,"W"],[15,7,"W"]],
    happy:   [[6,8,"k"],[7,7,"k"],[8,7,"k"],[9,8,"k"],[14,8,"k"],[15,7,"k"],[16,7,"k"],[17,8,"k"]],
    star:    [[7,7,"e"],[8,7,"e"],[7,8,"e"],[8,8,"e"],[15,7,"e"],[16,7,"e"],[15,8,"e"],[16,8,"e"],[7,7,"W"],[15,7,"W"]],
    closed:  [[6,8,"k"],[7,8,"k"],[8,8,"k"],[9,8,"k"],[14,8,"k"],[15,8,"k"],[16,8,"k"],[17,8,"k"]],
    soft:    [[7,8,"k"],[8,8,"k"],[15,8,"k"],[16,8,"k"]],
    worried: [[7,8,"k"],[8,8,"k"],[8,7,"k"],[15,8,"k"],[16,8,"k"],[15,7,"k"]],
    up:      [[7,7,"k"],[8,7,"k"],[15,7,"k"],[16,7,"k"],[7,7,"W"],[15,7,"W"]],
    wide:    [[7,6,"k"],[8,6,"k"],[7,7,"k"],[8,7,"k"],[7,8,"k"],[8,8,"k"],[15,6,"k"],[16,6,"k"],[15,7,"k"],[16,7,"k"],[15,8,"k"],[16,8,"k"],[8,6,"W"],[16,6,"W"]]
  };
  var BROWS = {
    none:  [],
    flat:  [[6,6,"o"],[7,6,"o"],[8,6,"o"],[15,6,"o"],[16,6,"o"],[17,6,"o"]],
    knit:  [[7,5,"o"],[8,6,"o"],[9,7,"o"],[14,7,"o"],[15,6,"o"],[16,5,"o"]],
    raise: [[6,5,"o"],[7,4,"o"],[8,4,"o"],[15,4,"o"],[16,4,"o"],[17,5,"o"]]
  };
  var MOUTHS = {
    none:  [],
    smile: [[9,13,"k"],[10,14,"k"],[11,14,"k"],[12,14,"k"],[13,14,"k"],[14,13,"k"]],
    grin:  [[9,13,"k"],[10,13,"k"],[11,13,"k"],[12,13,"k"],[13,13,"k"],[14,13,"k"],[10,14,"r"],[11,14,"r"],[12,14,"r"],[13,14,"r"]],
    flat:  [[10,14,"k"],[11,14,"k"],[12,14,"k"],[13,14,"k"]],
    frown: [[9,14,"k"],[10,13,"k"],[11,13,"k"],[12,13,"k"],[13,13,"k"],[14,14,"k"]],
    o:     [[11,13,"k"],[12,13,"k"],[11,14,"n"],[12,14,"n"],[11,15,"k"],[12,15,"k"]]
  };
  var BLUSH = [[3,9,"r"],[4,9,"r"],[19,9,"r"],[20,9,"r"]];

  var SPR_W = 24, SPR_H = 42;
  var frameCache = {};

  function buildFrame(eyes, brow, mouth, blush) {
    var key = [eyes, brow, mouth, blush ? 1 : 0].join("|");
    if (frameCache[key]) return frameCache[key];
    var c = document.createElement("canvas");
    c.width = SPR_W;
    c.height = SPR_H;
    var ctx = c.getContext("2d");
    for (var y = 0; y < BODY.length; y++) {
      var rowStr = BODY[y];
      for (var x = 0; x < SPR_W; x++) {
        var ch = rowStr[x];
        if (ch && ch !== ".") {
          ctx.fillStyle = PAL[ch] || PAL.b;
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

  /* motion — how Capy moves so he never feels static:
       bounce  · idle vertical hop amplitude (internal px)
       speed   · idle tempo
       sway    · horizontal drift amplitude (internal px)
       shake   · rapid nervous jitter (concerned)
     eyes / brows / mouth / blush · sprite overlays
     sparkle / sweat / tear / hearts / think · ambient pixel effects */
  Mascot.MOODS = {
    stable:     { bounce: 2, speed: 2.4, sway: 1, shake: false, eyes: "open",    brows: "none",  mouth: "smile", blush: false, sparkle: false, sweat: false, tear: false, hearts: false, think: false },
    joyful:     { bounce: 6, speed: 7.0, sway: 1, shake: false, eyes: "happy",   brows: "none",  mouth: "grin",  blush: true,  sparkle: true,  sweat: false, tear: false, hearts: false, think: false },
    growth:     { bounce: 4, speed: 4.8, sway: 2, shake: false, eyes: "star",    brows: "raise", mouth: "grin",  blush: false, sparkle: true,  sweat: false, tear: false, hearts: false, think: false },
    cautious:   { bounce: 1, speed: 1.6, sway: 2, shake: false, eyes: "open",    brows: "flat",  mouth: "flat",  blush: false, sparkle: false, sweat: false, tear: false, hearts: false, think: false },
    concerned:  { bounce: 0, speed: 1.0, sway: 0, shake: true,  eyes: "worried", brows: "knit",  mouth: "frown", blush: false, sparkle: false, sweat: true,  tear: false, hearts: false, think: false },
    serene:     { bounce: 2, speed: 1.1, sway: 1, shake: false, eyes: "closed",  brows: "none",  mouth: "smile", blush: true,  sparkle: false, sweat: false, tear: false, hearts: true,  think: false },
    calm:       { bounce: 2, speed: 1.5, sway: 1, shake: false, eyes: "soft",    brows: "none",  mouth: "smile", blush: false, sparkle: false, sweat: false, tear: false, hearts: false, think: false },
    thoughtful: { bounce: 1, speed: 1.2, sway: 3, shake: false, eyes: "up",      brows: "raise", mouth: "flat",  blush: false, sparkle: false, sweat: false, tear: false, hearts: false, think: true },
    surprised:  { bounce: 3, speed: 3.0, sway: 0, shake: false, eyes: "wide",    brows: "raise", mouth: "o",     blush: false, sparkle: false, sweat: false, tear: false, hearts: false, think: false }
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
       x, y — ground anchor (bottom-centre of the bust)
       size — target sprite height in CSS px
       o.gaze / o.flip kept for API compatibility (the bust is symmetric) */
  Mascot.prototype.draw = function (ctx, x, y, size, o) {
    o = o || {};
    var m = this.mood(), t = this.t;

    var px = Math.max(1, Math.round(size / SPR_H));
    var hop = Math.round(Math.abs(Math.sin(t * m.speed)) * m.bounce);
    hop += Math.round(Math.sin(this.pulse * Math.PI) * 5);
    // horizontal life: a gentle sway, or a nervous tremble when concerned
    var dxp = 0;
    if (m.shake) dxp = (Math.round(t * 22) % 2 ? 1 : -1);
    else if (m.sway) dxp = Math.round(Math.sin(t * (m.speed * 0.5 + 0.6)) * m.sway);

    var eyes = this.blink > 0 && m.eyes !== "closed" ? "closed" : m.eyes;
    var spr = buildFrame(eyes, m.brows, m.mouth, m.blush);

    var dw = SPR_W * px, dh = SPR_H * px;
    var dx = Math.round(x - dw / 2 + dxp * px), dy = Math.round(y - dh - hop * px);

    // chunky ground shadow (shrinks as he hops)
    var shW = dw * (0.6 - hop * 0.015);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(Math.round(x - shW / 2), Math.round(y - px), Math.round(shW), px * 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, dx, dy, dw, dh);
    ctx.restore();

    // ambient effects, pixel-aligned in screen space
    var headX = Math.round(x + dxp * px), headTop = dy;
    if (m.sparkle) {
      for (var i = 0; i < 3; i++) {
        var ang = t * 2 + i * 2.1;
        var sx2 = Math.round(headX + Math.cos(ang) * dw * 0.62);
        var sy2 = Math.round(headTop + dh * 0.28 + Math.sin(ang * 1.3) * dh * 0.32);
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i * 1.7));
        ctx.fillStyle = PAL.G;
        ctx.fillRect(sx2, sy2 - px, px, px * 3);
        ctx.fillRect(sx2 - px, sy2, px * 3, px);
      }
      ctx.globalAlpha = 1;
    }
    if (m.sweat) {
      var drop = (t * 13) % 18;
      ctx.globalAlpha = Math.max(0, 1 - drop / 18);
      ctx.fillStyle = PAL.c;
      ctx.fillRect(Math.round(headX + dw * 0.34), Math.round(headTop + dh * 0.18 + drop * px * 0.4), px, px * 2);
      ctx.globalAlpha = 1;
    }
    if (m.tear) {
      var tr = (t * 8) % 22;
      ctx.globalAlpha = Math.max(0, 1 - tr / 22);
      ctx.fillStyle = PAL.c;
      ctx.fillRect(Math.round(headX - dw * 0.27), Math.round(headTop + dh * 0.34 + tr * px * 0.3), px, px * 2);
      ctx.globalAlpha = 1;
    }
    if (m.hearts) {
      var cyc = (t * 0.5) % 1;
      ctx.globalAlpha = Math.max(0, 0.85 - cyc);
      ctx.fillStyle = PAL.r;
      var hx2 = Math.round(headX + dw * 0.34), hy2 = Math.round(headTop - 4 * px - cyc * 16 * px);
      ctx.fillRect(hx2, hy2, px, px);
      ctx.fillRect(hx2 + px * 2, hy2, px, px);
      ctx.fillRect(hx2, hy2 + px, px * 3, px);
      ctx.fillRect(hx2 + px, hy2 + px * 2, px, px);
      ctx.globalAlpha = 1;
    }
    if (m.think) {
      // a little drifting "…" thought, top-right
      for (var d = 0; d < 3; d++) {
        var ph = (t * 0.9 + d * 0.4) % 2;
        ctx.globalAlpha = Math.max(0, 0.7 - ph * 0.35);
        ctx.fillStyle = PAL.w;
        var tx = Math.round(headX + dw * 0.4 + d * px * 2);
        var ty = Math.round(headTop + dh * 0.02 - d * px * 2 - ph * px * 3);
        ctx.fillRect(tx, ty, px + (d === 2 ? px : 0), px + (d === 2 ? px : 0));
      }
      ctx.globalAlpha = 1;
    }
  };

  global.Mascot = Mascot;
})(window);
