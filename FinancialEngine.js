/* FinancialEngine.js — a small "financial state engine" that maps
   numerical inputs (savings, coverage, contributions…) to a soft 3D scene
   built with three.js: a mascot mood, smoothed display metrics and a
   billboarded particle layer, all animated with GSAP.

   Levels are plug-ins. Each level declares:
     inputs : [{ key, label, min, max, step, value, fmt | type:'toggle' }]
     compute(values) -> { mood, score, headline, coach, say, metrics }
     scene  : {
       bg?    : [topCss, bottomCss],     // soft backdrop gradient
       build(g)  -> create persistent THREE objects into g.group / g.store
       update(g) -> animate them each frame from eased metrics (g.m)
     }

   The engine owns the WebGL renderer, camera, render loop, input → state
   recomputation, metric easing and particles — so adding a new financial
   level never touches Mascot.js or the other levels:

     engine.registerLevel('zakat', { inputs, compute, scene });

   The numerical API (registerLevel / start / setInput / on / values /
   metrics / state / order / levels / levelId) is unchanged, so the DOM
   wiring and the cross-world roadmap keep working exactly as before. */

(function (global) {
  "use strict";

  var THREE = global.THREE;
  var gsap = global.gsap;

  /* soft pastel-friendly palette (hex numbers for three.js) */
  var COLORS = {
    cream: 0xf6f1e7, gold: 0xe7c069, goldLight: 0xf6e7bd, goldDark: 0xb98a3a,
    teal: 0x9fd8c4, mint: 0xbfeede, rust: 0xd9876a, pink: 0xf3b6c2,
    sky: 0xbfe3ef, ink: 0x2b1a10, leaf: 0x7cc196, stone: 0xcdbfa6,
    ice: 0xbfe0f2, plum: 0xb9a7e0
  };

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, k) { return a + (b - a) * k; }

  function money(v) {
    var neg = v < 0;
    v = Math.abs(Math.round(v));
    var s = String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "−RM " : "RM ") + s;
  }

  /* ---------- shared soft-3D building kit ---------- */
  var _softTex = null;
  function softTexture() {
    if (_softTex) return _softTex;
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var x = c.getContext("2d");
    var grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.35, "rgba(255,255,255,0.9)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = grd;
    x.fillRect(0, 0, 64, 64);
    _softTex = new THREE.CanvasTexture(c);
    return _softTex;
  }

  var KIT = {
    soft: function (color, extra) {
      return new THREE.MeshStandardMaterial(Object.assign({
        color: color, roughness: 0.74, metalness: 0.04
      }, extra || {}));
    },
    glossy: function (color, extra) {
      return new THREE.MeshStandardMaterial(Object.assign({
        color: color, roughness: 0.25, metalness: 0.55
      }, extra || {}));
    },
    // a flat gold coin standing up, facing camera
    coin: function (r) {
      r = r || 0.32;
      var g = new THREE.Group();
      var disc = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, r * 0.34, 22),
        KIT.glossy(COLORS.gold, { emissive: COLORS.goldDark, emissiveIntensity: 0.18 })
      );
      disc.rotation.x = Math.PI / 2;
      disc.castShadow = true;
      g.add(disc);
      var rim = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.62, r * 0.12, 8, 20),
        KIT.glossy(COLORS.goldLight)
      );
      g.add(rim);
      return g;
    },
    glow: function (color, size) {
      var s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: softTexture(), color: color, transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9
      }));
      s.scale.setScalar(size || 1);
      return s;
    },
    // a vertical-gradient backdrop plane, far behind the stage
    backdrop: function (topCss, botCss) {
      var c = document.createElement("canvas");
      c.width = 16; c.height = 256;
      var x = c.getContext("2d");
      var grd = x.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, topCss); grd.addColorStop(1, botCss);
      x.fillStyle = grd; x.fillRect(0, 0, 16, 256);
      var tex = new THREE.CanvasTexture(c);
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 34),
        new THREE.MeshBasicMaterial({ map: tex, depthWrite: false, fog: false })
      );
      m.position.set(0, 6, -12);
      return m;
    },
    // crisp text on a transparent sprite — for SPEND / SAVE / GOAL labels
    label: function (text, opts) {
      opts = opts || {};
      var size = opts.size || 0.7;            // world height
      var pad = 16, fs = 64;
      var c = document.createElement("canvas");
      var x = c.getContext("2d");
      var font = (opts.weight || "800") + " " + fs + "px " +
        (opts.font || "'Instrument Sans','Segoe UI',sans-serif");
      x.font = font;
      var w = Math.ceil(x.measureText(text).width) + pad * 2;
      c.width = w; c.height = fs + pad * 2;
      x.font = font;
      x.textBaseline = "middle";
      x.textAlign = "center";
      if (opts.halo !== false) {
        x.shadowColor = "rgba(0,0,0,0.45)";
        x.shadowBlur = 8; x.shadowOffsetY = 2;
      }
      x.fillStyle = opts.color || "#fffaf0";
      x.fillText(text, c.width / 2, c.height / 2);
      var tex = new THREE.CanvasTexture(c);
      tex.minFilter = THREE.LinearFilter;
      var spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, depthTest: opts.depthTest !== false
      }));
      spr.scale.set(size * (c.width / c.height), size, 1);
      spr.userData.aspect = c.width / c.height;
      return spr;
    }
  };

  /* ---------- 3D particle system (pooled billboards) ---------- */
  function Particles(scene, max) {
    this.max = max || 160;
    this.items = [];
    this.pool = [];
    this.scene = scene;
    var tex = softTexture();
    for (var i = 0; i < this.max; i++) {
      var s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, opacity: 0
      }));
      s.visible = false;
      scene.add(s);
      this.pool.push(s);
    }
  }
  Particles.prototype.reset = function () {
    for (var i = 0; i < this.items.length; i++) {
      this.items[i].sprite.visible = false;
      this.pool.push(this.items[i].sprite);
    }
    this.items.length = 0;
  };
  Particles.prototype.spawn = function (p) {
    var sprite = this.pool.pop();
    if (!sprite) return;                       // pool exhausted — drop it
    sprite.visible = true;
    sprite.position.set(p.x || 0, p.y || 0, p.z || 0);
    var sz = (p.size || 0.2);
    sprite.scale.setScalar(sz);
    sprite.material.color.set(p.color == null ? COLORS.gold : p.color);
    sprite.material.opacity = p.alpha == null ? 1 : p.alpha;
    sprite.material.blending = p.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.items.push({
      sprite: sprite,
      vx: p.vx || 0, vy: p.vy || 0, vz: p.vz || 0,
      g: p.g || 0, size: sz, life: p.life || 1, age: 0,
      alpha: p.alpha == null ? 1 : p.alpha, spin: p.spin || 0,
      update: p.update || null
    });
  };
  Particles.prototype.update = function (dt) {
    for (var i = this.items.length - 1; i >= 0; i--) {
      var it = this.items[i];
      it.age += dt;
      if (it.age >= it.life) {
        it.sprite.visible = false;
        this.pool.push(it.sprite);
        this.items.splice(i, 1);
        continue;
      }
      it.vy += it.g * dt;
      var s = it.sprite;
      s.position.x += it.vx * dt;
      s.position.y += it.vy * dt;
      s.position.z += it.vz * dt;
      if (it.update) it.update(it, dt);
      var k = 1 - it.age / it.life;
      s.material.opacity = it.alpha * Math.min(1, k * 3);
      s.material.rotation += it.spin * dt;
    }
  };

  /* ---------- engine ---------- */
  function FinancialEngine(opts) {
    this.canvas = opts.canvas;
    this.mascot = opts.mascot || null;
    this.reduced = !!opts.reducedMotion;

    this.levels = {};
    this.order = [];
    this.levelId = null;
    this.level = null;
    this.values = {};
    this.state = null;
    this.metrics = {};        // smoothed copies of state.metrics

    this.t = 0;
    this._last = 0;
    this._running = false;
    this._visible = true;
    this._listeners = {};
    this.store = {};
    this.ok = false;

    this._initThree();

    var self = this;
    window.addEventListener("resize", function () { self._resize(); });
    if ("ResizeObserver" in window) {
      new ResizeObserver(function () { self._resize(); }).observe(this.canvas);
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        self._visible = entries[0].isIntersecting;
      }).observe(this.canvas);
    }
    this._resize();
  }

  FinancialEngine.prototype._initThree = function () {
    if (!THREE) return;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas, antialias: true, alpha: true, powerPreference: "high-performance"
      });
    } catch (e) { this.ok = false; return; }
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ("outputColorSpace" in this.renderer) this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.root = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1.5, 0.1, 100);
    this.camera.position.set(0, 3.6, 13.4);
    this.camera.lookAt(0, 2.7, 0);

    // soft, even lighting for a gentle "kawaii" look
    var hemi = new THREE.HemisphereLight(0xffffff, 0x9fb6c7, 0.95);
    this.root.add(hemi);
    var key = new THREE.DirectionalLight(0xfff3df, 1.05);
    key.position.set(5, 11, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1; key.shadow.camera.far = 40;
    key.shadow.camera.left = -12; key.shadow.camera.right = 12;
    key.shadow.camera.top = 12; key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.0004;
    this.root.add(key);
    var fill = new THREE.DirectionalLight(0xbfe3ef, 0.35);
    fill.position.set(-7, 4, 5);
    this.root.add(fill);

    // a soft catch-all ground shadow plane shared by every world
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 40),
      new THREE.ShadowMaterial({ opacity: 0.16 })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0;
    this.ground.receiveShadow = true;
    this.root.add(this.ground);

    this.particles = new Particles(this.root, 160);
    this.ok = true;
  };

  FinancialEngine.prototype.on = function (evt, fn) {
    (this._listeners[evt] = this._listeners[evt] || []).push(fn);
    return this;
  };
  FinancialEngine.prototype._emit = function (evt, data) {
    (this._listeners[evt] || []).forEach(function (fn) { fn(data); });
  };

  FinancialEngine.prototype.registerLevel = function (id, def) {
    this.levels[id] = def;
    this.order.push(id);
    return this;
  };

  FinancialEngine.prototype._ctx = function (dt) {
    return {
      THREE: THREE, gsap: gsap, kit: KIT,
      group: this.stage, scene: this.root, camera: this.camera,
      store: this.store,
      t: this.t, dt: dt || 0,
      values: this.values, state: this.state, m: this.metrics,
      mascot: this.mascot, particles: this.particles,
      colors: COLORS, money: money, clamp: clamp, lerp: lerp,
      reduced: this.reduced
    };
  };

  FinancialEngine.prototype.start = function (id) {
    var def = this.levels[id];
    if (!def) return;
    this.levelId = id;
    this.level = def;
    this.values = {};
    var self = this;
    def.inputs.forEach(function (inp) { self.values[inp.key] = inp.value; });
    this.metrics = {};
    this._emit("level", { id: id, def: def });
    this._compute(true);

    if (this.ok) {
      // detach the shared mascot, tear down the old stage, build the new one
      if (this.mascot && this.mascot.object3d.parent) {
        this.mascot.object3d.parent.remove(this.mascot.object3d);
      }
      if (this.stage) { this._disposeGroup(this.stage); this.root.remove(this.stage); }
      this.particles.reset();
      this.store = {};
      this.stage = new THREE.Group();
      this.root.add(this.stage);

      // per-world backdrop
      if (this._backdrop) { this.root.remove(this._backdrop); }
      var bg = def.scene.bg || ["#bfe3ef", "#e7f3ec"];
      this._backdrop = KIT.backdrop(bg[0], bg[1]);
      this.root.add(this._backdrop);
      this.root.fog = new THREE.Fog(new THREE.Color(bg[1]).getHex(), 16, 34);

      def.scene.build(this._ctx(0));

      // gentle entrance: the whole stage pops up into place
      if (gsap && !this.reduced) {
        gsap.killTweensOf(this.stage.scale);
        gsap.killTweensOf(this.stage.position);
        this.stage.scale.set(0.86, 0.86, 0.86);
        this.stage.position.y = -0.6;
        gsap.to(this.stage.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: "back.out(1.6)" });
        gsap.to(this.stage.position, { y: 0, duration: 0.7, ease: "power3.out" });
      }
    }

    if (!this._running) this._run();
    if (this.reduced) this._renderFrame(0);
  };

  FinancialEngine.prototype.setInput = function (key, value) {
    if (!this.level) return;
    this.values[key] = value;
    this._compute(false);
    if (this.reduced) this._renderFrame(0);
  };

  FinancialEngine.prototype._compute = function (snap) {
    var out = this.level.compute(this.values, { clamp: clamp, money: money });
    this.state = out;
    if (out.mood && this.mascot) this.mascot.setMood(out.mood);
    if (snap && out.metrics) {
      for (var k in out.metrics) this.metrics[k] = out.metrics[k];
    }
    this._emit("state", out);
  };

  FinancialEngine.prototype._disposeGroup = function (grp) {
    grp.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        var mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(function (m) { if (m.map && m.map.dispose) m.map.dispose(); m.dispose(); });
      }
    });
  };

  FinancialEngine.prototype._resize = function () {
    if (!this.ok) return;
    var cw = this.canvas.clientWidth || 640;
    var ch = this.canvas.clientHeight || 440;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(cw, ch, false);
    this.camera.aspect = cw / ch;
    // pull the camera back a touch on portrait/narrow stages so nothing clips
    var fov = cw / ch < 1.1 ? 50 : 40;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    if (this.reduced && this.level) this._renderFrame(0);
  };

  FinancialEngine.prototype._run = function () {
    this._running = true;
    if (this.reduced) return;   // static mode: repaint on input changes only
    var self = this;
    this._last = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!self._visible || !self.level) { self._last = now; return; }
      var dt = Math.min(0.05, (now - self._last) / 1000) || 0.016;
      self._last = now;
      self._renderFrame(dt);
    })(this._last);
  };

  FinancialEngine.prototype._renderFrame = function (dt) {
    if (!this.ok) return;
    this.t += dt;
    if (this.mascot) this.mascot.update(dt);

    // ease displayed metrics toward computed targets
    var target = (this.state && this.state.metrics) || {};
    var k = dt ? 1 - Math.exp(-dt * 5) : 1;
    for (var key in target) {
      var cur = this.metrics[key];
      this.metrics[key] = cur == null ? target[key] : lerp(cur, target[key], k);
    }

    this.particles.update(dt);
    if (this.level && this.level.scene.update) this.level.scene.update(this._ctx(dt));

    this.renderer.render(this.root, this.camera);
  };

  FinancialEngine.COLORS = COLORS;
  FinancialEngine.kit = KIT;
  FinancialEngine.money = money;
  global.FinancialEngine = FinancialEngine;
})(window);
