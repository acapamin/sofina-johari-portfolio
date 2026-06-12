/* Mascot.js — "Sen", the little gold coin who guides the money journey.
   Canvas-2D character with a moodState driven by financial data.

   Moods are pure parameter sets interpreted by one renderer, so new
   states never require touching the draw/update core:
     Mascot.registerMood('zen', { eyes: 'closed', mouth: 'smile' });
     mascot.setMood('zen');
*/

(function (global) {
  "use strict";

  var TAU = Math.PI * 2;

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var ang = (Math.PI / 4) * i - Math.PI / 2;
      var rad = i % 2 === 0 ? r : r * 0.42;
      if (i === 0) ctx.moveTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
      else ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
    }
    ctx.closePath();
  }

  function Mascot(opts) {
    opts = opts || {};
    this.moodState = "stable";
    this.palette = Object.assign({
      body: "#ecd7a0",
      bodyDeep: "#c9a14a",
      rim: "#8c6a26",
      ink: "#0b1f1a",
      cheek: "rgba(196, 90, 60, 0.30)",
      spark: "#f6e7bd"
    }, opts.palette);
    this.t = Math.random() * 100;
    this.pulse = 0;            // squash-pop envelope fired on mood change
    this.blink = 0;
    this._nextBlink = 2 + Math.random() * 3;
  }

  /* bounce: idle hop amplitude · speed: idle tempo
     stretch: resting vertical scale (>1 proud, <1 squashed/worried)
     eyes / mouth / brows: feature styles · sparkle: ambient sparks
     breathe: chest rise amplitude */
  Mascot.MOODS = {
    stable:     { bounce: 0.030, speed: 1.6, stretch: 1.00, eyes: "open",    mouth: "smile", brows: "none",  sparkle: false, breathe: 0.012 },
    joyful:     { bounce: 0.110, speed: 3.4, stretch: 1.04, eyes: "happy",   mouth: "grin",  brows: "none",  sparkle: true,  breathe: 0.014 },
    growth:     { bounce: 0.060, speed: 2.4, stretch: 1.10, eyes: "star",    mouth: "grin",  brows: "none",  sparkle: true,  breathe: 0.012 },
    cautious:   { bounce: 0.018, speed: 1.2, stretch: 0.94, eyes: "open",    mouth: "flat",  brows: "knit",  sparkle: false, breathe: 0.016 },
    concerned:  { bounce: 0.010, speed: 0.9, stretch: 0.86, eyes: "worried", mouth: "frown", brows: "knit",  sparkle: false, breathe: 0.020 },
    serene:     { bounce: 0.016, speed: 0.8, stretch: 1.00, eyes: "closed",  mouth: "smile", brows: "none",  sparkle: true,  breathe: 0.022 },
    calm:       { bounce: 0.020, speed: 1.0, stretch: 0.98, eyes: "soft",    mouth: "smile", brows: "none",  sparkle: false, breathe: 0.018 },
    thoughtful: { bounce: 0.014, speed: 0.9, stretch: 0.94, eyes: "soft",    mouth: "hmm",   brows: "raise", sparkle: false, breathe: 0.018 }
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
    if (this._nextBlink <= 0) { this.blink = 0.16; this._nextBlink = 2.4 + Math.random() * 3.6; }
    if (this.blink > 0) this.blink = Math.max(0, this.blink - dt);
  };

  /* draw(ctx, x, y, size [, o])
       x, y  — ground anchor (bottom-centre of the body)
       o.walk — walking phase in radians (adds a step gait + feet)
       o.lean — body lean in radians
       o.gaze — -1..1 pupil shift toward a point of interest */
  Mascot.prototype.draw = function (ctx, x, y, size, o) {
    o = o || {};
    var m = this.mood(), p = this.palette, t = this.t;

    var hop = Math.abs(Math.sin(t * m.speed)) * m.bounce * size;
    if (o.walk) hop += Math.abs(Math.sin(o.walk)) * size * 0.05;
    var popSin = Math.sin(this.pulse * Math.PI);
    var breathe = Math.sin(t * 1.5) * m.breathe;
    var sy = Math.max(0.6, m.stretch + breathe - popSin * 0.16);
    var sx = 1 / Math.sqrt(sy);
    var w = size * sx;
    var h = size * 0.96 * sy;
    var bx = x - w / 2;
    var by = y - h - hop;

    // ground shadow
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.22 * (1 - hop / (size * 0.4)));
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.02, w * 0.42, size * 0.07, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    if (o.lean) {
      ctx.translate(x, y - hop);
      ctx.rotate(o.lean);
      ctx.translate(-x, -(y - hop));
    }

    // feet while walking
    if (o.walk) {
      var step = Math.sin(o.walk) * size * 0.1;
      ctx.fillStyle = p.bodyDeep;
      ctx.beginPath(); ctx.ellipse(x - w * 0.2 + step, y - hop * 0.4, size * 0.1, size * 0.05, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + w * 0.2 - step, y - hop * 0.4, size * 0.1, size * 0.05, 0, 0, TAU); ctx.fill();
    }

    // body — rounded gold bean
    var grad = ctx.createLinearGradient(0, by, 0, by + h);
    grad.addColorStop(0, p.body);
    grad.addColorStop(1, p.bodyDeep);
    ctx.fillStyle = grad;
    roundRect(ctx, bx, by, w, h, w * 0.4);
    ctx.fill();
    ctx.strokeStyle = p.rim;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // subtle coin ring on the belly
    ctx.strokeStyle = p.ink;
    ctx.globalAlpha = 0.1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, by + h * 0.64, size * 0.16, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // face
    var fx = x, fy = by + h * 0.34;
    var ex = w * 0.185, er = size * 0.052;
    var gaze = (o.gaze || 0) * er * 0.5;
    ctx.lineWidth = Math.max(1.6, size * 0.028);
    ctx.lineCap = "round";

    var eyeStyle = this.blink > 0 && m.eyes !== "closed" ? "blink" : m.eyes;
    for (var s = -1; s <= 1; s += 2) {
      var cx2 = fx + s * ex + gaze, cy2 = fy;
      ctx.fillStyle = p.ink;
      ctx.strokeStyle = p.ink;
      ctx.beginPath();
      switch (eyeStyle) {
        case "happy":
          ctx.arc(cx2, cy2 + er * 0.4, er * 1.05, Math.PI, TAU);
          ctx.stroke();
          break;
        case "closed":
          ctx.arc(cx2, cy2 + er * 0.2, er, Math.PI * 1.08, Math.PI * 1.92);
          ctx.stroke();
          break;
        case "star":
          star(ctx, cx2, cy2, er * 1.5);
          ctx.fill();
          break;
        case "worried":
          ctx.arc(cx2, cy2, er * 0.8, 0, TAU);
          ctx.fill();
          ctx.fillStyle = p.spark;
          ctx.beginPath();
          ctx.arc(cx2 - er * 0.25, cy2 - er * 0.25, er * 0.22, 0, TAU);
          ctx.fill();
          break;
        case "soft":
          ctx.ellipse(cx2, cy2, er * 0.85, er * 0.6, 0, 0, TAU);
          ctx.fill();
          break;
        case "blink":
          ctx.moveTo(cx2 - er * 0.8, cy2);
          ctx.lineTo(cx2 + er * 0.8, cy2);
          ctx.stroke();
          break;
        default: // open
          ctx.arc(cx2, cy2, er, 0, TAU);
          ctx.fill();
          ctx.fillStyle = p.spark;
          ctx.beginPath();
          ctx.arc(cx2 - er * 0.3, cy2 - er * 0.3, er * 0.28, 0, TAU);
          ctx.fill();
      }
    }

    // brows
    ctx.strokeStyle = p.ink;
    if (m.brows === "knit") {
      ctx.beginPath();
      ctx.moveTo(fx - ex - er, fy - er * 2.4); ctx.lineTo(fx - ex + er * 0.7, fy - er * 1.6);
      ctx.moveTo(fx + ex + er, fy - er * 2.4); ctx.lineTo(fx + ex - er * 0.7, fy - er * 1.6);
      ctx.stroke();
    } else if (m.brows === "raise") {
      ctx.beginPath();
      ctx.arc(fx - ex, fy - er * 2.2, er * 0.9, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }

    // mouth
    var my = fy + size * 0.14;
    ctx.beginPath();
    switch (m.mouth) {
      case "grin":
        ctx.arc(fx + gaze * 0.5, my - size * 0.015, size * 0.105, 0, Math.PI);
        ctx.fillStyle = p.ink;
        ctx.fill();
        break;
      case "flat":
        ctx.moveTo(fx - size * 0.07, my); ctx.lineTo(fx + size * 0.07, my);
        ctx.stroke();
        break;
      case "frown":
        ctx.arc(fx, my + size * 0.06, size * 0.08, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        break;
      case "hmm":
        ctx.moveTo(fx - size * 0.05, my + size * 0.012);
        ctx.lineTo(fx + size * 0.05, my - size * 0.012);
        ctx.stroke();
        break;
      default: // smile
        ctx.arc(fx + gaze * 0.5, my - size * 0.02, size * 0.09, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
    }

    // cheeks
    if (m.mouth === "grin" || this.moodState === "serene") {
      ctx.fillStyle = p.cheek;
      ctx.beginPath(); ctx.ellipse(fx - ex * 1.6, fy + er * 1.5, er * 1.1, er * 0.7, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(fx + ex * 1.6, fy + er * 1.5, er * 1.1, er * 0.7, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // ambient sparkles for celebratory / serene moods
    if (m.sparkle) {
      ctx.save();
      for (var i = 0; i < 3; i++) {
        var ang = t * 1.3 + i * (TAU / 3);
        var a = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i * 1.7));
        ctx.globalAlpha = a * 0.8;
        ctx.fillStyle = p.spark;
        star(ctx,
          x + Math.cos(ang) * size * 0.78,
          (by + h * 0.4) + Math.sin(ang) * size * 0.35,
          size * 0.045 * (0.7 + a * 0.5));
        ctx.fill();
      }
      ctx.restore();
    }
  };

  global.Mascot = Mascot;
})(window);
