/* Sofina Johari — landing page interactions
   GSAP scroll choreography + Three.js particle fields & water simulation */

(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGSAP = typeof gsap !== "undefined";
  var hasThree = typeof THREE !== "undefined";

  document.getElementById("year").textContent = new Date().getFullYear();

  /* ---------- Mobile menu ---------- */
  var toggle = document.getElementById("navToggle");
  var menu = document.getElementById("mobileMenu");
  function closeMenu() {
    toggle.classList.remove("is-open");
    menu.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  toggle.addEventListener("click", function () {
    var open = !menu.classList.contains("is-open");
    toggle.classList.toggle("is-open", open);
    menu.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
  });
  menu.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", closeMenu);
  });

  /* ---------- Nav scroll state ---------- */
  var nav = document.getElementById("nav");
  function onScroll() {
    nav.classList.toggle("is-scrolled", window.scrollY > 40);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Three.js particle field ---------- */
  var particleSprite = null;
  function getParticleSprite() {
    if (particleSprite || !hasThree) return particleSprite;
    var size = 64;
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var ctx = c.getContext("2d");
    var grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.6)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    particleSprite = new THREE.CanvasTexture(c);
    return particleSprite;
  }

  function createParticleField(canvas, opts) {
    if (!hasThree || prefersReducedMotion) {
      canvas.style.display = "none";
      return null;
    }
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
    } catch (e) {
      canvas.style.display = "none";
      return null;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 8;

    var isSmall = window.innerWidth < 768;
    var count = isSmall ? Math.floor(opts.count * 0.5) : opts.count;

    var positions = new Float32Array(count * 3);
    var seeds = new Float32Array(count);
    for (var i = 0; i < count; i++) {
      // distribute on a flattened sphere shell for depth
      var r = 4 + Math.random() * 5;
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta) * 1.6;
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.8;
      positions[i * 3 + 2] = r * Math.cos(phi) * 0.7 - 2;
      seeds[i] = Math.random() * Math.PI * 2;
    }
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    var basePositions = positions.slice();

    var material = new THREE.PointsMaterial({
      color: opts.color,
      size: opts.size,
      map: getParticleSprite(),
      sizeAttenuation: true,
      transparent: true,
      opacity: opts.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var points = new THREE.Points(geometry, material);
    scene.add(points);

    // second sparse layer in gold
    var goldCount = Math.floor(count * 0.18);
    var goldPos = new Float32Array(goldCount * 3);
    for (var g = 0; g < goldCount; g++) {
      goldPos[g * 3] = (Math.random() - 0.5) * 16;
      goldPos[g * 3 + 1] = (Math.random() - 0.5) * 9;
      goldPos[g * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
    }
    var goldGeo = new THREE.BufferGeometry();
    goldGeo.setAttribute("position", new THREE.BufferAttribute(goldPos, 3));
    var goldMat = new THREE.PointsMaterial({
      color: 0xc9a14a,
      size: opts.size * 1.8,
      map: getParticleSprite(),
      sizeAttenuation: true,
      transparent: true,
      opacity: opts.opacity * 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var goldPoints = new THREE.Points(goldGeo, goldMat);
    scene.add(goldPoints);

    var mouseX = 0, mouseY = 0;
    if (opts.parallax) {
      window.addEventListener("pointermove", function (e) {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }

    function resize() {
      var w = canvas.clientWidth || canvas.parentElement.clientWidth;
      var h = canvas.clientHeight || canvas.parentElement.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    var clock = new THREE.Clock();
    var visible = true;
    var observer = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    });
    observer.observe(canvas);

    function tick() {
      requestAnimationFrame(tick);
      if (!visible) return;
      var t = clock.getElapsedTime();
      var pos = geometry.attributes.position.array;
      for (var i = 0; i < count; i++) {
        var s = seeds[i];
        pos[i * 3 + 1] = basePositions[i * 3 + 1] + Math.sin(t * 0.4 + s) * 0.25;
        pos[i * 3] = basePositions[i * 3] + Math.cos(t * 0.3 + s) * 0.18;
      }
      geometry.attributes.position.needsUpdate = true;
      points.rotation.y = t * 0.02 + mouseX * 0.06;
      points.rotation.x = mouseY * 0.04;
      goldPoints.rotation.y = -t * 0.015 + mouseX * 0.03;
      renderer.render(scene, camera);
    }
    tick();
    return renderer;
  }

  createParticleField(document.getElementById("heroCanvas"), {
    count: 900, color: 0x9fd8c4, size: 0.045, opacity: 0.75, parallax: true
  });
  createParticleField(document.getElementById("ctaCanvas"), {
    count: 450, color: 0x9fd8c4, size: 0.04, opacity: 0.5, parallax: false
  });

  /* ---------- Story water simulation ----------
     GPU height-field ripple solver (ping-pong render targets) layered
     with procedural ambient waves, shaded with fresnel + gold sun glints. */
  function createWaterSurface(canvas, pointerTarget) {
    if (!canvas) return null;
    if (!hasThree || prefersReducedMotion) {
      canvas.style.display = "none";
      return null;
    }
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
    } catch (e) {
      canvas.style.display = "none";
      return null;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    var SIM_RES = 256;
    var rtOptions = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false
    };
    var rtA = new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, rtOptions);
    var rtB = new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, rtOptions);

    var quadVert = [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = vec4(position.xy, 0.0, 1.0);",
      "}"
    ].join("\n");

    /* r = height, g = velocity */
    var simFrag = [
      "precision highp float;",
      "varying vec2 vUv;",
      "uniform sampler2D uPrev;",
      "uniform vec2 uTexel;",
      "uniform vec2 uDrop;",
      "uniform float uDropStrength;",
      "uniform float uDropRadius;",
      "void main() {",
      "  vec2 c = texture2D(uPrev, vUv).rg;",
      "  float l = texture2D(uPrev, vUv - vec2(uTexel.x, 0.0)).r;",
      "  float r = texture2D(uPrev, vUv + vec2(uTexel.x, 0.0)).r;",
      "  float b = texture2D(uPrev, vUv - vec2(0.0, uTexel.y)).r;",
      "  float t = texture2D(uPrev, vUv + vec2(0.0, uTexel.y)).r;",
      "  float lap = (l + r + b + t) * 0.25 - c.r;",
      "  float vel = (c.g + lap * 1.7) * 0.984;",
      "  float h = (c.r + vel) * 0.9985;",
      "  if (uDrop.x >= 0.0) {",
      "    float d = distance(vUv, uDrop);",
      "    h += uDropStrength * exp(-d * d / (uDropRadius * uDropRadius));",
      "  }",
      "  gl_FragColor = vec4(h, vel, 0.0, 1.0);",
      "}"
    ].join("\n");

    var renderFrag = [
      "precision highp float;",
      "varying vec2 vUv;",
      "uniform sampler2D uHeight;",
      "uniform vec2 uTexel;",
      "uniform float uTime;",
      "uniform float uAspect;",
      "float ambient(vec2 p, float t) {",
      "  float h = 0.0;",
      "  h += 0.40 * sin(dot(p, vec2(5.2, 1.4)) + t * 0.9);",
      "  h += 0.28 * sin(dot(p, vec2(-3.1, 4.7)) + t * 0.7);",
      "  h += 0.20 * sin(dot(p, vec2(8.6, -3.2)) + t * 1.3);",
      "  h += 0.12 * sin(dot(p, vec2(-11.4, -7.3)) + t * 1.8);",
      "  h += 0.08 * sin(dot(p, vec2(16.0, 9.0)) + t * 2.4);",
      "  return h;",
      "}",
      "void main() {",
      "  vec2 p = vec2(vUv.x * uAspect, vUv.y) * 4.0;",
      "  float e = 0.04;",
      "  float hs  = texture2D(uHeight, vUv).r;",
      "  float hsx = texture2D(uHeight, vUv + vec2(uTexel.x, 0.0)).r;",
      "  float hsy = texture2D(uHeight, vUv + vec2(0.0, uTexel.y)).r;",
      "  float ha  = ambient(p, uTime);",
      "  float hax = ambient(p + vec2(e, 0.0), uTime);",
      "  float hay = ambient(p + vec2(0.0, e), uTime);",
      "  vec2 slope = vec2(hsx - hs, hsy - hs) * 55.0",
      "             + vec2(hax - ha, hay - ha) / e * 0.10;",
      "  vec3 n = normalize(vec3(-slope, 1.0));",
      "  vec3 viewDir = normalize(vec3(0.0, 0.30, 1.0));",
      "  vec3 lightDir = normalize(vec3(-0.45, 0.65, 0.55));",
      "  float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);",
      "  vec3 deep = vec3(0.031, 0.110, 0.090);",
      "  vec3 shallow = vec3(0.125, 0.310, 0.255);",
      "  vec3 skyCol = vec3(0.78, 0.81, 0.74);",
      "  vec3 gold = vec3(0.788, 0.631, 0.290);",
      "  vec2 ruv = clamp(vUv + n.xy * 0.12, 0.0, 1.0);",
      "  float crest = clamp(hs * 7.0 + ha * 0.5 + 0.5, 0.0, 1.0);",
      "  vec3 col = mix(deep, shallow, crest * 0.55 + ruv.y * 0.45);",
      "  col = mix(col, skyCol, fresnel * 0.5);",
      "  vec3 hv = normalize(lightDir + viewDir);",
      "  float ndh = max(dot(n, hv), 0.0);",
      "  col += gold * pow(ndh, 140.0) * 1.6;",
      "  col += gold * pow(ndh, 12.0) * 0.15;",
      "  float ca = ambient(p * 2.1 + vec2(uTime * 0.12, -uTime * 0.08), uTime * 1.5);",
      "  float web = pow(clamp(1.0 - abs(ca), 0.0, 1.0), 11.0);",
      "  float mask = smoothstep(-0.2, 0.9, ambient(p * 0.6 + vec2(uTime * 0.05, 0.0), uTime * 0.35));",
      "  col += vec3(0.50, 0.68, 0.57) * web * mask * 0.2 * (1.0 - fresnel);",
      "  col += vec3(0.93, 0.86, 0.68) * smoothstep(0.5, 1.1, vUv.y) * 0.12;",
      "  float vig = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x)",
      "            * smoothstep(0.0, 0.10, vUv.y) * smoothstep(1.0, 0.90, vUv.y);",
      "  col *= mix(0.62, 1.0, vig);",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n");

    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    var simMaterial = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: simFrag,
      uniforms: {
        uPrev: { value: null },
        uTexel: { value: new THREE.Vector2(1 / SIM_RES, 1 / SIM_RES) },
        uDrop: { value: new THREE.Vector2(-1, -1) },
        uDropStrength: { value: 0 },
        uDropRadius: { value: 0.02 }
      },
      depthTest: false,
      depthWrite: false
    });
    var renderMaterial = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: renderFrag,
      uniforms: {
        uHeight: { value: null },
        uTexel: { value: new THREE.Vector2(1 / SIM_RES, 1 / SIM_RES) },
        uTime: { value: 0 },
        uAspect: { value: 1 }
      },
      depthTest: false,
      depthWrite: false
    });

    var quadGeo = new THREE.PlaneGeometry(2, 2);
    var simScene = new THREE.Scene();
    var simMesh = new THREE.Mesh(quadGeo, simMaterial);
    simMesh.frustumCulled = false;
    simScene.add(simMesh);
    var renderScene = new THREE.Scene();
    var renderMesh = new THREE.Mesh(quadGeo, renderMaterial);
    renderMesh.frustumCulled = false;
    renderScene.add(renderMesh);

    var drops = [];
    function addDrop(u, v, strength, radius) {
      if (drops.length > 8) drops.shift();
      drops.push({ u: u, v: v, strength: strength, radius: radius });
    }

    var lastU = -10, lastV = -10;
    pointerTarget.addEventListener("pointermove", function (e) {
      var rect = canvas.getBoundingClientRect();
      var u = (e.clientX - rect.left) / rect.width;
      var v = 1 - (e.clientY - rect.top) / rect.height;
      if (u < 0 || u > 1 || v < 0 || v > 1) return;
      var dx = u - lastU, dy = v - lastV;
      if (dx * dx + dy * dy < 0.0002) return;
      lastU = u; lastV = v;
      addDrop(u, v, 0.05, 0.02);
    }, { passive: true });
    pointerTarget.addEventListener("pointerdown", function (e) {
      var rect = canvas.getBoundingClientRect();
      addDrop(
        (e.clientX - rect.left) / rect.width,
        1 - (e.clientY - rect.top) / rect.height,
        0.22, 0.035
      );
    }, { passive: true });

    function resize() {
      var w = canvas.clientWidth || canvas.parentElement.clientWidth;
      var h = canvas.clientHeight || canvas.parentElement.clientHeight;
      renderer.setSize(w, h, false);
      renderMaterial.uniforms.uAspect.value = w / h;
    }
    resize();
    window.addEventListener("resize", resize);

    var visible = true;
    var observer = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    });
    observer.observe(canvas);

    /* occasional ambient raindrop */
    var nextRain = 1.2;
    var clock = new THREE.Clock();

    function simStep() {
      var drop = drops.shift();
      if (drop) {
        simMaterial.uniforms.uDrop.value.set(drop.u, drop.v);
        simMaterial.uniforms.uDropStrength.value = drop.strength;
        simMaterial.uniforms.uDropRadius.value = drop.radius;
      } else {
        simMaterial.uniforms.uDrop.value.set(-1, -1);
      }
      simMaterial.uniforms.uPrev.value = rtA.texture;
      renderer.setRenderTarget(rtB);
      renderer.render(simScene, camera);
      var tmp = rtA; rtA = rtB; rtB = tmp;
    }

    function tick() {
      requestAnimationFrame(tick);
      if (!visible) return;
      var t = clock.getElapsedTime();
      if (t > nextRain) {
        nextRain = t + 1.6 + Math.random() * 2.4;
        addDrop(0.12 + Math.random() * 0.76, 0.12 + Math.random() * 0.76,
          0.08 + Math.random() * 0.1, 0.02 + Math.random() * 0.02);
      }
      simStep();
      simStep();
      renderMaterial.uniforms.uHeight.value = rtA.texture;
      renderMaterial.uniforms.uTime.value = t;
      renderer.setRenderTarget(null);
      renderer.render(renderScene, camera);
    }
    tick();
    return renderer;
  }

  createWaterSurface(
    document.getElementById("storyWaterCanvas"),
    document.getElementById("storyWater")
  );

  createWaterSurface(
    document.getElementById("preloaderCanvas"),
    document.getElementById("preloader")
  );

  var finePointer = window.matchMedia("(pointer: fine)").matches;

  /* ---------- Service card pointer sheen ----------
     Tracks the cursor so the gold glow follows the pointer across the card. */
  if (finePointer) {
    document.querySelectorAll(".service-card").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
        card.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
      }, { passive: true });
    });
  }

  /* ---------- Magnetic primary buttons ----------
     A subtle pull toward the cursor — premium tactility, desktop only. */
  if (finePointer && !prefersReducedMotion) {
    document.querySelectorAll(".btn--gold, .bridge__cta").forEach(function (btn) {
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        var mx = e.clientX - (r.left + r.width / 2);
        var my = e.clientY - (r.top + r.height / 2);
        btn.style.transform = "translate(" + mx * 0.18 + "px," + my * 0.3 + "px)";
      });
      btn.addEventListener("pointerleave", function () {
        btn.style.transform = "";
      });
    });
  }

  /* ---------- Contextual content-to-CTA bridge ----------
     Once a visitor actively engages with the journey tool (or opens Amy),
     a contextual CTA slides into view with copy tuned to their progress,
     bridging interactive play straight into booking a consultation. */
  (function setupBridge() {
    var bridge = document.getElementById("bridge");
    if (!bridge) return;
    var titleEl = document.getElementById("bridgeTitle");
    var eyebrowEl = document.getElementById("bridgeEyebrow");
    var closeBtn = document.getElementById("bridgeClose");
    var ctaEl = document.getElementById("bridgeCta");
    var controls = document.getElementById("journeyControls");
    var vibePct = document.getElementById("journeyVibePct");

    var dismissed = false, shown = false, moves = 0, contactInView = false;
    try { dismissed = sessionStorage.getItem("bridgeDismissed") === "1"; } catch (e) {}

    function copyForPct(pct) {
      if (pct >= 75) return { e: "You're building real momentum", t: "Let's turn this into a personalised plan." };
      if (pct >= 40) return { e: "You're on your way", t: "See how much further a tailored plan goes." };
      return { e: "Every plan starts here", t: "Ready to make these numbers real?" };
    }
    function show() {
      if (dismissed || shown || contactInView) return;
      shown = true;
      var pct = parseInt((vibePct && vibePct.textContent) || "0", 10) || 0;
      var c = copyForPct(pct);
      eyebrowEl.textContent = c.e;
      titleEl.textContent = c.t;
      bridge.hidden = false;
      bridge.setAttribute("aria-hidden", "false");
      requestAnimationFrame(function () { bridge.classList.add("is-visible"); });
    }
    function hide() {
      if (!shown) return;
      shown = false;
      bridge.classList.remove("is-visible");
      bridge.setAttribute("aria-hidden", "true");
    }
    function dismiss() {
      dismissed = true;
      hide();
      try { sessionStorage.setItem("bridgeDismissed", "1"); } catch (e) {}
    }

    // Hide whenever the contact section is on screen — never compete with it.
    var contact = document.getElementById("contact");
    if (contact && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        contactInView = entries[0].isIntersecting;
        if (contactInView) hide();
      }, { threshold: 0.1 }).observe(contact);
    }

    if (controls) {
      controls.addEventListener("input", function () {
        if (++moves >= 3) show();
      });
    }
    var chatLaunch = document.getElementById("chatLaunch");
    if (chatLaunch) {
      chatLaunch.addEventListener("click", function () { setTimeout(show, 500); });
    }
    closeBtn.addEventListener("click", dismiss);
    ctaEl.addEventListener("click", function () { setTimeout(dismiss, 350); });
  })();

  /* ---------- GSAP ---------- */
  if (!hasGSAP || prefersReducedMotion) {
    document.documentElement.classList.add("gsap-off");
    var pre = document.getElementById("preloader");
    if (pre) pre.style.display = "none";
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* Preloader -> hero intro */
  var intro = gsap.timeline();
  intro
    .to(".preloader__name", { opacity: 1, duration: 0.6, ease: "power2.out" })
    .to(".preloader__line", { scaleX: 1, duration: 0.7, ease: "power3.inOut" }, "-=0.2")
    .to(".preloader__inner", { opacity: 0, y: -20, duration: 0.45, ease: "power2.in", delay: 0.15 })
    .to("#preloader", {
      yPercent: -100, duration: 0.7, ease: "power4.inOut",
      onComplete: function () { document.getElementById("preloader").remove(); }
    })
    .from(".hero__eyebrow", { y: 24, opacity: 0, duration: 0.7, ease: "power3.out" }, "-=0.25")
    .from(".hero__line > span", {
      yPercent: 110, duration: 1.05, ease: "power4.out", stagger: 0.12
    }, "-=0.45")
    .from(".hero__sub", { y: 26, opacity: 0, duration: 0.8, ease: "power3.out" }, "-=0.6")
    .from(".hero__actions .btn", {
      y: 22, opacity: 0, duration: 0.6, ease: "power3.out", stagger: 0.1
    }, "-=0.5")
    .from(".hero__scroll", { opacity: 0, duration: 0.8 }, "-=0.2");

  /* Marquee — seamless loop (groups are duplicated in JS) */
  var track = document.getElementById("marqueeTrack");
  var group = track.querySelector(".marquee__group");
  for (var c = 0; c < 3; c++) track.appendChild(group.cloneNode(true));
  gsap.to(track, { xPercent: -25, duration: 22, ease: "none", repeat: -1 });

  /* Generic reveals — batched so elements entering together cascade in,
     giving each section a choreographed rhythm rather than popping at once. */
  ScrollTrigger.batch(".reveal", {
    start: "top 88%",
    onEnter: function (batch) {
      gsap.to(batch, {
        opacity: 1, y: 0, duration: 0.9, ease: "power3.out",
        stagger: 0.09, overwrite: true
      });
    }
  });

  /* Stat counters */
  gsap.utils.toArray(".stat__num").forEach(function (el) {
    var target = parseInt(el.dataset.count, 10);
    var obj = { v: 0 };
    gsap.to(obj, {
      v: target, duration: 1.6, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
      onUpdate: function () { el.textContent = Math.round(obj.v); }
    });
  });

  /* Portrait gentle parallax */
  gsap.fromTo(".story__portrait", { y: 40 }, {
    y: -40, ease: "none",
    scrollTrigger: { trigger: ".story", start: "top bottom", end: "bottom top", scrub: true }
  });
})();
