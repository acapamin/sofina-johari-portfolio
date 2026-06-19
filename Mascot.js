/* Mascot.js — "Capy", a soft 3D cute capybara guide built with three.js.

   Capy is a small THREE.Group of rounded, matte primitives (capsule body,
   sphere head, soft snout, little ears and legs). A `moodState` driven by
   the financial engine smoothly morphs the face (eye openness, smile/frown,
   blush) and body bounce — so new emotional states never require touching
   the geometry:

     Mascot.registerMood('zen', { happy: 1, blush: 1, bounce: 0.4 });
     capy.setMood('zen');

   Public API (kept stable for FinancialEngine + the worlds):
     var capy = new Mascot();
     capy.object3d            -> THREE.Group to drop into any scene
     capy.setMood(name)       -> ease toward a mood
     capy.update(dt)          -> idle breathing, blink, mood easing
     capy.setGaze(dir)        -> -1 left … +1 right (head turn)
     capy.setWalk(phase)      -> leg cycle for the climbing world
     capy.height              -> world-units tall (~1.35) for scene framing */

(function (global) {
  "use strict";

  var THREE = global.THREE;

  /* ---------- palette ---------- */
  var PAL = {
    body: 0xc89a68,     // warm capybara brown
    bodyDark: 0xa97c4c,
    snout: 0xb88a57,
    ink: 0x2b1a10,      // eyes / nose
    blush: 0xef9a93
  };

  /* mood presets — each is a small set of facial / posture targets.
       happy   : -1 (sad/frown) … +1 (big smile)
       eyeOpen : 0 (squint/closed-happy) … 1 (wide)
       blush   : 0 … 1 (cheek glow + scale)
       bounce  : idle bob amplitude multiplier */
  var MOODS = {
    neutral:       { happy: 0.2, eyeOpen: 1.0, blush: 0.15, bounce: 1.0 },
    stable:        { happy: 0.4, eyeOpen: 0.95, blush: 0.3, bounce: 1.0 },
    joyful:        { happy: 1.0, eyeOpen: 0.25, blush: 0.9, bounce: 1.6 },
    growth:        { happy: 0.8, eyeOpen: 0.8, blush: 0.7, bounce: 1.3 },
    cautious:      { happy: -0.2, eyeOpen: 1.0, blush: 0.2, bounce: 0.8 },
    "risk-averse": { happy: -0.3, eyeOpen: 1.0, blush: 0.2, bounce: 0.7 },
    concerned:     { happy: -0.8, eyeOpen: 1.0, blush: 0.1, bounce: 0.5 },
    serene:        { happy: 0.8, eyeOpen: 0.15, blush: 0.8, bounce: 0.9 },
    calm:          { happy: 0.5, eyeOpen: 0.7, blush: 0.5, bounce: 0.9 },
    thoughtful:    { happy: 0.1, eyeOpen: 0.85, blush: 0.3, bounce: 0.8 }
  };

  function softMat(color, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({
      color: color, roughness: 0.78, metalness: 0.0
    }, extra || {}));
  }

  function Mascot(opts) {
    opts = opts || {};
    this.height = 1.35;

    if (!THREE) {
      // headless / no-WebGL guard so the page never throws
      var noop = { set: function () {} };
      this.object3d = { position: noop, rotation: noop, scale: noop, visible: true };
      return;
    }

    var g = new THREE.Group();
    this.object3d = g;

    var bodyMat = softMat(PAL.body);
    var darkMat = softMat(PAL.bodyDark);
    var snoutMat = softMat(PAL.snout);
    var inkMat = softMat(PAL.ink, { roughness: 0.4 });

    // ---- body: a soft fat capsule, slightly squashed for a chubby look ----
    var body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.34, 8, 16), bodyMat);
    body.rotation.z = Math.PI / 2;          // lie the capsule on its side
    body.scale.set(1.0, 0.92, 0.88);
    body.position.y = 0.5;
    body.castShadow = true;
    g.add(body);
    this._body = body;

    // ---- head: rounded sphere sitting up front ----
    var headPivot = new THREE.Group();
    headPivot.position.set(0.34, 0.78, 0);
    g.add(headPivot);
    this._head = headPivot;

    var head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 16), bodyMat);
    head.scale.set(1.0, 0.95, 0.96);
    head.castShadow = true;
    headPivot.add(head);

    // muzzle / snout — the signature blocky capybara nose, softened
    var snout = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), snoutMat);
    snout.scale.set(1.05, 0.8, 0.9);
    snout.position.set(0.28, -0.06, 0);
    headPivot.add(snout);
    var nostrils = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), inkMat);
    nostrils.scale.set(0.6, 1, 2.4);
    nostrils.position.set(0.46, -0.04, 0);
    headPivot.add(nostrils);

    // ears — tiny rounded nubs
    [-1, 1].forEach(function (s) {
      var ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), darkMat);
      ear.position.set(-0.06, 0.3, 0.22 * s);
      ear.scale.set(0.9, 1.1, 0.7);
      headPivot.add(ear);
    });

    // eyes — dark glossy beads; scale.y is driven by blink + mood squint
    this._eyes = [];
    [-1, 1].forEach(function (s) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 12), inkMat);
      eye.position.set(0.2, 0.1, 0.16 * s);
      headPivot.add(eye);
      var spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.022, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      spark.position.set(0.06, 0.03, 0.02);   // tiny catch-light for cuteness
      eye.add(spark);
      this._eyes.push(eye);
    }, this);

    // smile — a torus arc we morph between smile (∪) and frown (∩)
    var mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.08, 0.018, 8, 16, Math.PI),
      inkMat
    );
    mouth.position.set(0.34, -0.12, 0);
    mouth.rotation.z = Math.PI;             // start as a gentle smile
    headPivot.add(mouth);
    this._mouth = mouth;

    // blush — soft cheek discs that fade in on happy moods
    this._blush = [];
    [-1, 1].forEach(function (s) {
      var bm = new THREE.MeshStandardMaterial({
        color: PAL.blush, roughness: 0.6, transparent: true, opacity: 0.0
      });
      var b = new THREE.Mesh(new THREE.CircleGeometry(0.07, 14), bm);
      b.position.set(0.28, -0.02, 0.2 * s);
      b.lookAt(0.6, -0.02, 0.2 * s + s * 0.3);
      headPivot.add(b);
      this._blush.push(b);
    }, this);

    // legs — four little capsules; pairs swing while climbing
    this._legs = [];
    var legGeo = new THREE.CapsuleGeometry(0.09, 0.16, 4, 8);
    [[0.22, 0.26], [0.22, -0.26], [-0.26, 0.26], [-0.26, -0.26]].forEach(function (p) {
      var leg = new THREE.Mesh(legGeo, darkMat);
      leg.position.set(p[0], 0.16, p[1]);
      leg.castShadow = true;
      g.add(leg);
      this._legs.push(leg);
    }, this);

    // a stubby tail nub for charm
    var tail = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), darkMat);
    tail.position.set(-0.44, 0.52, 0);
    g.add(tail);

    // ---- animation state ----
    this._t = Math.random() * 10;
    this._blinkAt = 1.5 + Math.random() * 2;
    this._blink = 0;            // 0 open … 1 shut
    this._walk = 0;            // walk phase (0 = idle)
    this._gaze = 0;            // target head turn
    this._gazeNow = 0;
    this.cur = Object.assign({}, MOODS.neutral);
    this.target = Object.assign({}, MOODS.neutral);
  }

  Mascot.registerMood = function (name, def) {
    MOODS[name] = Object.assign({ happy: 0, eyeOpen: 1, blush: 0, bounce: 1 }, def);
  };

  Mascot.prototype.setMood = function (name) {
    this.target = MOODS[name] || MOODS.neutral;
    this.moodName = name;
  };

  Mascot.prototype.setGaze = function (dir) { this._gaze = Math.max(-1, Math.min(1, dir || 0)); };
  Mascot.prototype.setWalk = function (phase) { this._walk = phase || 0; };

  Mascot.prototype.update = function (dt) {
    if (!THREE || !this._body) return;
    dt = dt || 0.016;
    this._t += dt;
    var t = this._t;

    // ease mood targets
    var k = 1 - Math.exp(-dt * 6);
    var cur = this.cur, tgt = this.target;
    for (var key in tgt) cur[key] += (tgt[key] - cur[key]) * k;

    // blink timer
    this._blinkAt -= dt;
    if (this._blinkAt <= 0) { this._blink = 1; this._blinkAt = 2 + Math.random() * 3; }
    if (this._blink > 0) this._blink = Math.max(0, this._blink - dt * 10);

    // idle breathing + bob
    var bob = Math.sin(t * 2.2) * 0.025 * cur.bounce;
    this._body.position.y = 0.5 + bob;
    this._head.position.y = 0.78 + bob * 1.1;
    this._body.scale.y = 0.92 * (1 + Math.sin(t * 2.2) * 0.02);

    // head gaze + a little happy tilt
    this._gazeNow += (this._gaze - this._gazeNow) * (1 - Math.exp(-dt * 8));
    this._head.rotation.y = this._gazeNow * 0.5;
    this._head.rotation.z = cur.happy * 0.08 + Math.sin(t * 1.3) * 0.02;

    // eyes: combine mood squint with blink
    var open = (0.35 + 0.65 * cur.eyeOpen) * (1 - this._blink);
    for (var i = 0; i < this._eyes.length; i++) {
      this._eyes[i].scale.y = Math.max(0.08, open);
    }

    // mouth morph: smile (rot.z=PI) ↔ frown (rot.z=0)
    var happy01 = (cur.happy + 1) / 2;
    this._mouth.rotation.z = Math.PI * happy01;
    var ms = 0.7 + Math.abs(cur.happy) * 0.7;
    this._mouth.scale.set(ms, 0.7 + happy01 * 0.6, 1);
    this._mouth.position.y = -0.12 + (0.5 - happy01) * 0.04;

    // blush fade
    for (var b = 0; b < this._blush.length; b++) {
      this._blush[b].material.opacity = cur.blush * 0.85;
      var bs = 0.7 + cur.blush * 0.6;
      this._blush[b].scale.set(bs, bs, bs);
    }

    // legs: gentle climb cycle when walking, tiny idle otherwise
    for (var l = 0; l < this._legs.length; l++) {
      var leg = this._legs[l];
      var phase = this._walk + (l % 2 === 0 ? 0 : Math.PI);
      leg.position.y = 0.16 + (this._walk ? Math.max(0, Math.sin(phase)) * 0.06 : 0) + bob;
      leg.rotation.z = this._walk ? Math.sin(phase) * 0.18 : Math.sin(t * 2 + l) * 0.015;
    }
  };

  global.Mascot = Mascot;
})(window);
