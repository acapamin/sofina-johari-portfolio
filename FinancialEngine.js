/* FinancialEngine.js — a small "financial state engine" that maps
   numerical inputs (savings, coverage, contributions…) to visual
   animation state: a mascot mood, smoothed display metrics and a
   particle layer.

   Levels are plug-ins. Each level declares:
     inputs : [{ key, label, min, max, step, value, fmt | type:'toggle' }]
     compute(values) -> { mood, score, headline, coach, say, metrics }
     scene.draw(g)   -> renders the level using the frame context `g`

   The engine owns the render loop, input → state recomputation,
   metric easing and particles — so adding a new financial level
   never requires changes to Mascot.js or to other levels:

     engine.registerLevel('zakat', { inputs, compute, scene });
*/

(function (global) {
  "use strict";

  var COLORS = {
    ink: "#0b1f1a", inkSoft: "#12302a", cream: "#f6f1e7",
    gold: "#c9a14a", goldSoft: "#e0c98c", teal: "#9fd8c4",
    rust: "#d07a5e",
    line: "rgba(242, 236, 224, 0.14)",
    muted: "rgba(242, 236, 224, 0.55)"
  };

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, k) { return a + (b - a) * k; }

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

  function money(v) {
    var neg = v < 0;
    v = Math.abs(Math.round(v));
    var s = String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "−RM " : "RM ") + s;
  }

  /* ---------- particles ---------- */
  function Particles(max) {
    this.max = max || 240;
    this.items = [];
  }
  Particles.prototype.spawn = function (p) {
    if (this.items.length >= this.max) this.items.shift();
    this.items.push(Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, g: 0,
      size: 3, life: 1, age: 0,
      color: COLORS.gold, alpha: 1
    }, p));
  };
  Particles.prototype.update = function (dt) {
    for (var i = this.items.length - 1; i >= 0; i--) {
      var p = this.items[i];
      p.age += dt;
      if (p.age >= p.life) { this.items.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.update) p.update(p, dt);
    }
  };
  Particles.prototype.draw = function (ctx) {
    for (var i = 0; i < this.items.length; i++) {
      var p = this.items[i];
      var k = 1 - p.age / p.life;
      ctx.globalAlpha = p.alpha * Math.min(1, k * 3);
      ctx.fillStyle = p.color;
      var s = Math.max(1, Math.round(p.size));
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
  };

  /* ---------- engine ---------- */
  function FinancialEngine(opts) {
    this.canvas = opts.canvas;
    this.ctx = this.canvas.getContext("2d");
    this.mascot = opts.mascot || null;
    this.reduced = !!opts.reducedMotion;

    this.levels = {};
    this.order = [];
    this.levelId = null;
    this.level = null;
    this.values = {};
    this.state = null;
    this.metrics = {};        // smoothed copies of state.metrics
    this.particles = new Particles();

    this.t = 0;
    this._last = 0;
    this._running = false;
    this._visible = true;
    this._listeners = {};

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

  FinancialEngine.prototype.start = function (id) {
    var def = this.levels[id];
    if (!def) return;
    this.levelId = id;
    this.level = def;
    this.values = {};
    var self = this;
    def.inputs.forEach(function (inp) { self.values[inp.key] = inp.value; });
    this.particles.items.length = 0;
    this.metrics = {};
    this._emit("level", { id: id, def: def });
    this._compute(true);
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

  /* Retro mode: render to a low-resolution backing buffer and let CSS
     (image-rendering: pixelated) blow it up to chunky NES pixels.
     This is also a big mobile win — far fewer pixels to fill. */
  FinancialEngine.prototype._resize = function () {
    var cw = this.canvas.clientWidth || 640;
    var ch = this.canvas.clientHeight || 420;
    this.scale = cw > 560 ? 3 : 2;
    this.w = Math.max(120, Math.floor(cw / this.scale));
    this.h = Math.max(100, Math.floor(ch / this.scale));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx.imageSmoothingEnabled = false;
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

    var ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.w, this.h);
    this.level.scene.draw({
      ctx: ctx, w: this.w, h: this.h, t: this.t, dt: dt,
      values: this.values, state: this.state, m: this.metrics,
      mascot: this.mascot, particles: this.particles,
      colors: COLORS, rr: roundRect, money: money,
      clamp: clamp, lerp: lerp, reduced: this.reduced,
      pixelScale: this.scale
    });
    this.particles.draw(ctx);
  };

  FinancialEngine.COLORS = COLORS;
  FinancialEngine.money = money;
  global.FinancialEngine = FinancialEngine;
})(window);
