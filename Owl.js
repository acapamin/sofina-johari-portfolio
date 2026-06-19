/* Owl.js — "Capy", the engraved line-art owl guide.
   A refined bank-note / heraldic-crest mascot rendered as thin gold
   line work, with a moodState driven by financial data.

   Same contract as the previous pixel Mascot: levels call
   `mascot.setMood(name)`, the engine ticks `mascot.update(dt)`, and
   `mascot.draw(ctx, x, y, size, o)` renders the owl perched at (x, y)
   with its feet resting on y. Five visual states map the engine's
   seven moods onto the messaging vocabulary:

     radiant   ← joyful / serene / growth   (Excellent)
     content   ← stable / calm               (Good)
     attentive ← thoughtful                  (Neutral)
     alert     ← cautious / risk-averse      (Bad)
     ruffled   ← concerned / worried         (Alarming)

   Strokes are drawn at the canvas's native resolution — the engine
   is resized to full backing pixels for the colonnade, so the line
   art stays crisp. */

(function (global) {
  "use strict";

  var GOLD = "#c9a14a";
  var GOLD_SOFT = "#e0c98c";
  var GOLD_DEEP = "#7a5a1e";
  var CREAM = "#f6f1e7";
  var INK = "#0b1f1a";
  var RUST = "#d07a5e";
  var TEAL = "#9fd8c4";

  /* ---------- mood table ----------
     eye / brow / posture / ruffle / glow drive the line work:
       eye      — "round" | "soft" | "wide" | "closed" | "star"
       brow     — "flat" | "raise" | "knit" | "arch"
       posture  — "upright" | "tiltUp" | "tiltDown" | "leanFwd"
       ruffle   — 0..1   feather zigzag amplitude
       glow     — 0..1   gold halo strength
       blink    — boolean whether the owl blinks while idle
  */
  var MOODS = {
    radiant:   { eye: "star",   brow: "raise", posture: "tiltUp",   ruffle: 0,    glow: 1,    blink: false },
    content:   { eye: "soft",   brow: "flat",  posture: "upright",  ruffle: 0,    glow: 0.35, blink: true  },
    attentive: { eye: "round",  brow: "flat",  posture: "upright",  ruffle: 0,    glow: 0.15, blink: true  },
    alert:     { eye: "round",  brow: "knit",  posture: "leanFwd",  ruffle: 0.35, glow: 0,    blink: true  },
    ruffled:   { eye: "wide",   brow: "arch",  posture: "tiltDown", ruffle: 0.85, glow: 0,    blink: false }
  };

  var ALIASES = {
    "risk-averse": "alert",
    "cautious": "alert",
    "happy": "radiant",
    "worried": "ruffled",
    "joyful": "radiant",
    "serene": "radiant",
    "growth": "radiant",
    "stable": "content",
    "calm": "content",
    "thoughtful": "attentive",
    "concerned": "ruffled"
  };

  function lerp(a, b, k) { return a + (b - a) * k; }

  /* ---------- owl ---------- */

  function Owl() {
    this.moodState = "content";
    this.t = Math.random() * 100;
    this.pulse = 0;                 // ease envelope fired on mood change
    this.blink = 0;
    this._nextBlink = 2.4 + Math.random() * 3.2;
  }

  Owl.MOODS = MOODS;
  Owl.MOOD_ALIASES = ALIASES;

  Owl.registerMood = function (name, def) {
    MOODS[name] = Object.assign({}, MOODS.content, def);
  };

  Owl.prototype.setMood = function (name) {
    var key = ALIASES[name] || name;
    if (!MOODS[key] || key === this.moodState) return;
    this.moodState = key;
    this.pulse = 1;
  };

  Owl.prototype.mood = function () {
    return MOODS[this.moodState] || MOODS.content;
  };

  Owl.prototype.update = function (dt) {
    this.t += dt;
    if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 2.2);
    var m = this.mood();
    if (m.blink) {
      this._nextBlink -= dt;
      if (this._nextBlink <= 0) { this.blink = 0.16; this._nextBlink = 3 + Math.random() * 4; }
      if (this.blink > 0) this.blink = Math.max(0, this.blink - dt);
    } else {
      this.blink = 0;
    }
  };

  /* draw(ctx, x, y, size [, o])
       x, y    — perch anchor (the owl's feet grip y)
       size    — overall height of the owl in canvas pixels
       o.gaze  — currently unused; kept for parity with Mascot
       o.flip  — mirror horizontally (kept for parity; rarely needed) */
  Owl.prototype.draw = function (ctx, x, y, size, o) {
    o = o || {};
    var m = this.mood();
    var t = this.t;

    // pulse: a gentle settle on mood change (no hop — a statue doesn't hop)
    var settle = Math.sin(this.pulse * Math.PI) * 0.04;
    var breath = Math.sin(t * m.breathSpeed || 1.4) * 0.015;
    var posture = m.posture;
    var tilt = 0;
    if (posture === "tiltUp") tilt = -0.10 + settle;
    else if (posture === "tiltDown") tilt = 0.10 + settle;
    else if (posture === "leanFwd") tilt = -0.02;
    else tilt = breath;

    var s = Math.max(8, size);
    var cx = Math.round(x);
    var perchY = Math.round(y);

    // proportions — a horned owl silhouette
    var bodyH = s;
    var bodyW = s * 0.78;
    var headR = s * 0.34;
    var headCY = perchY - bodyH * 0.72;
    var bodyTopY = headCY + headR * 0.55;
    var bodyBotY = perchY - s * 0.04;

    // ground / perch shadow
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(cx, perchY + 1, bodyW * 0.42, Math.max(1.5, s * 0.025), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // glow halo (radial) for radiant moods
    if (m.glow > 0.02) {
      var glowR = s * 0.95;
      var grd = ctx.createRadialGradient(cx, headCY, 1, cx, headCY, glowR);
      var a = 0.30 * m.glow;
      grd.addColorStop(0, "rgba(201,161,74," + a.toFixed(3) + ")");
      grd.addColorStop(0.55, "rgba(201,161,74," + (a * 0.35).toFixed(3) + ")");
      grd.addColorStop(1, "rgba(201,161,74,0)");
      ctx.save();
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, headCY, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(cx, perchY);
    ctx.rotate(tilt);
    ctx.translate(-cx, -perchY);

    var lineW = Math.max(1.2, s * 0.026);
    ctx.lineWidth = lineW;
    ctx.strokeStyle = GOLD;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // ---- body: a soft teardrop/oval resting on the perch ----
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.5, bodyTopY + bodyH * 0.10);
    ctx.bezierCurveTo(
      cx - bodyW * 0.58, bodyTopY + bodyH * 0.50,
      cx - bodyW * 0.40, bodyBotY - bodyH * 0.05,
      cx, bodyBotY
    );
    ctx.bezierCurveTo(
      cx + bodyW * 0.40, bodyBotY - bodyH * 0.05,
      cx + bodyW * 0.58, bodyTopY + bodyH * 0.50,
      cx + bodyW * 0.5, bodyTopY + bodyH * 0.10
    );
    ctx.bezierCurveTo(
      cx + bodyW * 0.42, bodyTopY - bodyH * 0.05,
      cx - bodyW * 0.42, bodyTopY - bodyH * 0.05,
      cx - bodyW * 0.5, bodyTopY + bodyH * 0.10
    );
    ctx.closePath();
    ctx.stroke();

    // breast hatching — bank-note engraving: 4 thin vertical arcs
    ctx.save();
    ctx.strokeStyle = "rgba(201,161,74,0.55)";
    ctx.lineWidth = Math.max(0.6, lineW * 0.45);
    var breastTop = bodyTopY + bodyH * 0.18;
    var breastBot = bodyBotY - bodyH * 0.06;
    for (var i = -2; i <= 2; i++) {
      var bx = cx + i * (bodyW * 0.10);
      ctx.beginPath();
      ctx.moveTo(bx, breastTop);
      ctx.quadraticCurveTo(bx + i * 1.2, (breastTop + breastBot) / 2, bx, breastBot);
      ctx.stroke();
    }
    ctx.restore();

    // feather ruffle — small zigzag lines on the flanks when alert/ruffled
    if (m.ruffle > 0.02) {
      ctx.save();
      ctx.strokeStyle = "rgba(201,161,74," + (0.45 + m.ruffle * 0.45).toFixed(2) + ")";
      ctx.lineWidth = Math.max(0.7, lineW * 0.55);
      var flanks = [
        { sx: cx - bodyW * 0.5, dy: 0.18, dir: -1 },
        { sx: cx + bodyW * 0.5, dy: 0.18, dir: 1 }
      ];
      flanks.forEach(function (f) {
        for (var r = 0; r < 3; r++) {
          var ry = bodyTopY + bodyH * (f.dy + r * 0.20);
          var amp = 2 + m.ruffle * 3.5;
          var wobble = m.ruffle * Math.sin(t * 6 + r * 1.4) * 1.2;
          ctx.beginPath();
          ctx.moveTo(f.sx + f.dir * 1, ry);
          ctx.lineTo(f.sx + f.dir * (3 + wobble), ry - amp * 0.5);
          ctx.lineTo(f.sx + f.dir * (5 + wobble), ry + amp * 0.5);
          ctx.lineTo(f.sx + f.dir * (7 + wobble), ry - amp * 0.5);
          ctx.stroke();
        }
      });
      ctx.restore();
    }

    // ---- feet: two small gripping claws on the perch ----
    ctx.save();
    ctx.strokeStyle = GOLD_DEEP;
    ctx.lineWidth = Math.max(1, lineW * 0.8);
    var footW = bodyW * 0.18;
    var footY = perchY - 1;
    [-1, 1].forEach(function (dir) {
      var fx = cx + dir * footW * 0.6;
      ctx.beginPath();
      ctx.moveTo(fx, bodyBotY - 1);
      ctx.lineTo(fx, footY);
      ctx.stroke();
      // three toes gripping
      ctx.beginPath();
      ctx.moveTo(fx, footY);
      ctx.lineTo(fx - 3, footY + 2);
      ctx.moveTo(fx, footY);
      ctx.lineTo(fx, footY + 3);
      ctx.moveTo(fx, footY);
      ctx.lineTo(fx + 3, footY + 2);
      ctx.stroke();
    });
    ctx.restore();

    // ---- head: a circle sitting atop the body ----
    ctx.beginPath();
    ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
    ctx.stroke();

    // facial disk — a softer heart-shaped outline around the eyes
    ctx.save();
    ctx.strokeStyle = "rgba(201,161,74,0.55)";
    ctx.lineWidth = Math.max(0.8, lineW * 0.55);
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.85, headCY - headR * 0.15);
    ctx.bezierCurveTo(
      cx - headR * 0.95, headCY + headR * 0.55,
      cx - headR * 0.30, headCY + headR * 0.80,
      cx, headCY + headR * 0.40
    );
    ctx.bezierCurveTo(
      cx + headR * 0.30, headCY + headR * 0.80,
      cx + headR * 0.95, headCY + headR * 0.55,
      cx + headR * 0.85, headCY - headR * 0.15
    );
    ctx.stroke();
    ctx.restore();

    // ---- ear tufts (horned owl) ----
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.65, headCY - headR * 0.75);
    ctx.lineTo(cx - headR * 0.95, headCY - headR * 1.30);
    ctx.lineTo(cx - headR * 0.30, headCY - headR * 0.90);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + headR * 0.65, headCY - headR * 0.75);
    ctx.lineTo(cx + headR * 0.95, headCY - headR * 1.30);
    ctx.lineTo(cx + headR * 0.30, headCY - headR * 0.90);
    ctx.stroke();

    // ---- eyes ----
    var eyeY = headCY - headR * 0.05;
    var eyeDX = headR * 0.42;
    var eyeR = headR * 0.34;
    var irisR = eyeR * 0.62;
    var blinkAmt = this.blink > 0 ? Math.min(1, this.blink / 0.16) : 0;
    var eyeShape = m.eye;

    // brows
    var browY = eyeY - eyeR * 1.05;
    ctx.save();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = lineW * 1.05;
    [-1, 1].forEach(function (dir) {
      var ex = cx + dir * eyeDX;
      ctx.beginPath();
      if (m.brow === "flat") {
        ctx.moveTo(ex - eyeR * 0.85, browY);
        ctx.lineTo(ex + eyeR * 0.85, browY);
      } else if (m.brow === "raise") {
        ctx.moveTo(ex - eyeR * 0.85, browY + eyeR * 0.25);
        ctx.quadraticCurveTo(ex, browY - eyeR * 0.45, ex + eyeR * 0.85, browY + eyeR * 0.25);
      } else if (m.brow === "knit") {
        // angled inward & down
        var innerX = cx + dir * (eyeDX - eyeR * 0.4);
        var outerX = cx + dir * (eyeDX + eyeR * 0.85);
        ctx.moveTo(outerX, browY - eyeR * 0.20);
        ctx.lineTo(innerX, browY + eyeR * 0.40);
      } else if (m.brow === "arch") {
        // high arched — alarmed
        ctx.moveTo(ex - eyeR * 0.85, browY + eyeR * 0.30);
        ctx.quadraticCurveTo(ex, browY - eyeR * 0.85, ex + eyeR * 0.85, browY + eyeR * 0.30);
      }
      ctx.stroke();
    });
    ctx.restore();

    [-1, 1].forEach(function (dir) {
      var ex = cx + dir * eyeDX;
      // eye outer ring
      ctx.beginPath();
      ctx.arc(ex, eyeY, eyeR, 0, Math.PI * 2);
      ctx.stroke();

      if (eyeShape === "closed" || blinkAmt > 0.6) {
        // closed eye: a gentle curve
        ctx.save();
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = lineW * 0.9;
        ctx.beginPath();
        ctx.moveTo(ex - eyeR * 0.85, eyeY);
        ctx.quadraticCurveTo(ex, eyeY + eyeR * 0.55, ex + eyeR * 0.85, eyeY);
        ctx.stroke();
        ctx.restore();
        return;
      }

      // iris
      var irisColor = GOLD;
      var pupilColor = INK;
      var irisAlpha = 1;
      if (eyeShape === "star") {
        irisColor = GOLD_SOFT;
        irisAlpha = 1;
      } else if (eyeShape === "wide" || eyeShape === "round") {
        irisColor = m.glow > 0.2 ? GOLD : GOLD_DEEP;
      } else if (eyeShape === "soft") {
        irisColor = GOLD;
      }
      ctx.save();
      ctx.globalAlpha = irisAlpha;
      ctx.fillStyle = irisColor;
      ctx.beginPath();
      ctx.arc(ex, eyeY, irisR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // pupil
      ctx.save();
      ctx.fillStyle = pupilColor;
      var pupilR = irisR * (eyeShape === "wide" ? 0.62 : 0.50);
      ctx.beginPath();
      ctx.arc(ex, eyeY, pupilR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // gold catchlight — small bright speck (skip on ruffled)
      if (m.glow > 0.02) {
        ctx.save();
        ctx.fillStyle = CREAM;
        ctx.beginPath();
        ctx.arc(ex - pupilR * 0.45, eyeY - pupilR * 0.45, pupilR * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // star-eye sparkle: two short crossed lines on radiant moods
      if (eyeShape === "star") {
        ctx.save();
        ctx.strokeStyle = CREAM;
        ctx.lineWidth = Math.max(0.8, lineW * 0.6);
        var sp = irisR * 0.95;
        ctx.beginPath();
        ctx.moveTo(ex - sp, eyeY); ctx.lineTo(ex + sp, eyeY);
        ctx.moveTo(ex, eyeY - sp); ctx.lineTo(ex, eyeY + sp);
        ctx.stroke();
        ctx.restore();
      }

      // wide-eye: an extra outer ring (alarmed)
      if (eyeShape === "wide") {
        ctx.save();
        ctx.strokeStyle = "rgba(208,122,94,0.65)";
        ctx.lineWidth = lineW * 0.7;
        ctx.beginPath();
        ctx.arc(ex, eyeY, eyeR * 1.18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    });

    // ---- beak: a small hooked triangle between the eyes ----
    var beakTopY = eyeY + eyeR * 0.55;
    var beakBotY = headCY + headR * 0.55;
    var beakW = headR * 0.26;
    ctx.save();
    ctx.strokeStyle = GOLD_DEEP;
    ctx.fillStyle = "rgba(201,161,74,0.45)";
    ctx.lineWidth = Math.max(0.9, lineW * 0.75);
    ctx.beginPath();
    ctx.moveTo(cx - beakW, beakTopY);
    ctx.lineTo(cx + beakW, beakTopY);
    ctx.lineTo(cx + beakW * 0.55, beakBotY);
    ctx.lineTo(cx, beakBotY + beakW * 0.55);
    ctx.lineTo(cx - beakW * 0.55, beakBotY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore(); // tilt
  };

  global.Owl = Owl;
})(window);
