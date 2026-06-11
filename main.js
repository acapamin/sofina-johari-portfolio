/* Sofina Johari — landing page interactions
   GSAP scroll choreography + Three.js particle fields */

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

  /* Generic reveals */
  gsap.utils.toArray(".reveal").forEach(function (el) {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 0.9, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 86%" }
    });
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

  /* Hero content drifts up as you scroll away */
  gsap.to(".hero__content", {
    yPercent: -12, opacity: 0.25, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom 35%", scrub: true }
  });

  /* Portrait gentle parallax */
  gsap.fromTo(".story__portrait", { y: 40 }, {
    y: -40, ease: "none",
    scrollTrigger: { trigger: ".story", start: "top bottom", end: "bottom top", scrub: true }
  });
})();
