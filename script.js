(() => {
  "use strict";

  // Always start at the top: no restored scroll position and no #section hash jump.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  window.scrollTo(0, 0);
  addEventListener("pageshow", (e) => { if (e.persisted) window.scrollTo(0, 0); });

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = typeof window.gsap !== "undefined";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  // Page variants (sangeet, wedding, ...) set data-first / data-root / data-fx / data-particles on <body>.
  const BODY = document.body.dataset;
  const ROOT = BODY.root || "";
  const NOTES = BODY.particles === "notes";
  const FIRST_EVENT = new Date(BODY.first || "2026-11-30T09:15:00+05:30").getTime();

  /* ---------- Hanging string lights (sangeet pages) ---------- */
  const fairy = $(".fairy");
  if (fairy && !reduce) {
    for (let i = 0; i < 26; i++) {
      const s = document.createElement("i");
      s.style.left = (i / 26) * 100 + Math.random() * 2 + "%";
      s.style.setProperty("--h", 14 + Math.random() * 34 + "vh");
      s.style.setProperty("--d", 2 + Math.random() * 3 + "s");
      s.style.animationDelay = -Math.random() * 4 + "s";
      fairy.appendChild(s);
    }
  }

  /* ---------- Split hero names into letters ---------- */
  $$("[data-split]").forEach((el) => {
    const text = el.textContent;
    el.setAttribute("aria-hidden", "true");
    el.textContent = "";
    [...text].forEach((c) => {
      const s = document.createElement("span");
      s.className = "ch";
      s.textContent = c;
      el.appendChild(s);
    });
  });

  /* ---------- Countdown ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const cdEls = Object.fromEntries($$("#countdown [data-u]").map((e) => [e.dataset.u, e]));
  function tick() {
    const diff = FIRST_EVENT - Date.now();
    if (diff <= 0) {
      $("#countdown").hidden = true;
      $("#countNote").textContent = "The celebrations have begun";
      return;
    }
    const s = Math.floor(diff / 1000);
    cdEls.d.textContent = pad(Math.floor(s / 86400));
    cdEls.h.textContent = pad(Math.floor((s % 86400) / 3600));
    cdEls.m.textContent = pad(Math.floor((s % 3600) / 60));
    cdEls.s.textContent = pad(s % 60);
  }
  tick();
  setInterval(tick, 1000);

  /* ---------- Petals canvas ---------- */
  const canvas = $("#petals");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, petals = [], burst = 0, rafId = 0;
  const COLORS = NOTES ? ["#f1d28a", "#ffffff", "#e7b4c8", "#f3c969"] : ["#f6d9d8", "#ffffff", "#f2b9c4", "#efd9a0", "#fbe9e7"];
  const GLYPHS = ["♪", "♫"]; // widely supported music glyphs (♬ shows as a box on some devices)
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function makePetal(fromTop = true) {
    return {
      x: Math.random() * W,
      y: fromTop ? -20 - Math.random() * H * 0.5 : Math.random() * H,
      r: NOTES ? 6 + Math.random() * 6 : 3 + Math.random() * 5,
      g: GLYPHS[(Math.random() * GLYPHS.length) | 0],
      vy: 0.4 + Math.random() * 0.8,
      vx: -0.3 + Math.random() * 0.6,
      rot: Math.random() * Math.PI * 2,
      vr: -0.02 + Math.random() * 0.04,
      sway: Math.random() * Math.PI * 2,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      a: 0.4 + Math.random() * 0.35,
    };
  }
  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.a;
    ctx.fillStyle = p.c;
    if (NOTES) {
      ctx.font = `${p.r * 3}px "Apple Symbols", "Segoe UI Symbol", "Noto Sans Symbols 2", serif`;
      ctx.textAlign = "center";
      ctx.fillText(p.g, 0, 0);
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function loop() {
    ctx.clearRect(0, 0, W, H);
    for (const p of petals) {
      p.sway += 0.02;
      p.x += p.vx + Math.sin(p.sway) * 0.6;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y > H + 20) Object.assign(p, makePetal(true), { x: Math.random() * W });
      drawPetal(p);
    }
    if (burst > 0 && petals.length < 22) {
      petals.push(makePetal(true));
      burst--;
    }
    rafId = requestAnimationFrame(loop);
  }
  function startPetals() {
    resize();
    const count = innerWidth < 600 ? 5 : 9;
    petals = Array.from({ length: count }, () => makePetal(false));
    if (!reduce) loop();
  }
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(rafId);
    else if (!reduce) loop();
  });
  startPetals();

  /* ---------- Music ---------- */
  // Browsers only allow sound after a user gesture, so we try to play immediately and,
  // if that is blocked, start on the visitor's very first tap / key / scroll.
  const music = (() => {
    const audio = $("#bgm"), fab = $("#fab");
    let userPaused = false;
    audio.volume = 0.7;
    const sync = () => {
      const on = !audio.paused;
      fab.classList.toggle("on", on);
      fab.setAttribute("aria-pressed", String(on));
    };
    const tryPlay = () => (userPaused ? Promise.resolve() : audio.play().catch(() => {}));
    const player = $("#player"), playBtn = $("#playBtn"), seek = $("#seek"), tCur = $("#tCur"), tDur = $("#tDur");
    const fmt = (t) => (isFinite(t) ? Math.floor(t / 60) + ":" + pad(Math.floor(t % 60)) : "0:00");
    const toggle = () => {
      if (audio.paused) { userPaused = false; audio.play().catch(() => {}); }
      else { userPaused = true; audio.pause(); }
    };
    const syncAll = () => {
      sync();
      player.classList.toggle("playing", !audio.paused);
      playBtn.setAttribute("aria-label", audio.paused ? "Play song" : "Pause song");
    };
    audio.addEventListener("play", syncAll);
    audio.addEventListener("pause", syncAll);
    audio.addEventListener("loadedmetadata", () => { tDur.textContent = fmt(audio.duration); });
    audio.addEventListener("durationchange", () => { tDur.textContent = fmt(audio.duration); });
    audio.addEventListener("timeupdate", () => {
      tCur.textContent = fmt(audio.currentTime);
      const p = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      seek.value = p; seek.style.setProperty("--p", p + "%");
    });
    seek.addEventListener("input", () => { if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration; });
    playBtn.addEventListener("click", toggle);
    fab.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
    tryPlay();
    const events = ["pointerdown", "keydown", "touchstart", "wheel"];
    const first = (e) => {
      if (e.target.closest && e.target.closest("#fab, #playBtn")) return;
      tryPlay().then(() => {
        if (!audio.paused) events.forEach((n) => removeEventListener(n, first, true));
      });
    };
    events.forEach((n) => addEventListener(n, first, { capture: true, passive: true }));
    return { start: tryPlay };
  })();

  /* ---------- Gate ---------- */
  const gate = $("#gate");
  const openBtn = $("#openBtn");
  let opened = false;

  function openInvite() {
    if (opened) return;
    opened = true;
    burst = 8;
    window.scrollTo(0, 0);
    document.documentElement.classList.remove("locked");
    document.body.classList.remove("locked");
    $("#nav").classList.add("in");
    music.start();

    if (!hasGsap || reduce) {
      gate.remove();
      return;
    }
    const tl = gsap.timeline();
    tl.to(".gate-cta", { opacity: 0, y: 30, duration: 0.5, ease: "power2.in" })
      .to(".gate-card", { scale: 1.6, opacity: 0, duration: 1.4, ease: "power3.inOut" }, 0.15)
      .to(gate, { opacity: 0, duration: 0.9, ease: "power2.out", onComplete: () => gate.remove() }, 0.8)
      .add(heroIn, 0.9);
    // Safety net: never leave the gate covering the page if animation is throttled.
    setTimeout(() => gate.isConnected && gate.remove(), 4000);
  }
  openBtn.addEventListener("click", openInvite);

  function heroIn() {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(".hero-bg", { scale: 1.25, duration: 2.6, ease: "power2.out" }, 0)
      .from(".mantra", { y: 20, opacity: 0, duration: 1, stagger: 0.15 }, 0.1)
      .from(".name .ch", { yPercent: 120, rotate: 6, opacity: 0, duration: 1.1, stagger: 0.07 }, 0.3)
      .from(".amp", { scale: 0, opacity: 0, duration: 0.9, ease: "back.out(2)" }, 1)
      .from(".hero-date, .hero-place", { y: 20, opacity: 0, duration: 0.9, stagger: 0.12 }, 1.2)
      .from(".countdown > div", { y: 30, opacity: 0, duration: 0.8, stagger: 0.1 }, 1.4)
      .from(".count-note, .scroll-cue", { opacity: 0, duration: 1 }, 1.9);
  }

  /* If GSAP failed to load, open instantly on first interaction and show everything. */
  if (!hasGsap) {
    document.documentElement.classList.add("no-gsap");
    return initPlain();
  }

  /* ---------- Scroll animations ---------- */
  gsap.registerPlugin(ScrollTrigger);

  if (!reduce) {
    // Hide hero items until opened
    gsap.set([".mantra", ".name .ch", ".amp", ".hero-date", ".hero-place", ".countdown > div", ".count-note", ".scroll-cue"], { opacity: 0 });
    // heroIn uses .from so reset to visible-start state right before
    const origHeroIn = heroIn;
    heroIn = () => {
      gsap.set([".mantra", ".name .ch", ".amp", ".hero-date", ".hero-place", ".countdown > div", ".count-note", ".scroll-cue"], { clearProps: "opacity" });
      origHeroIn();
    };

    // Generic reveals
    $$(".reveal").forEach((el) => {
      gsap.from(el, { y: 40, opacity: 0, duration: 1.1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
    });
    $$(".reveal-card").forEach((el, i) => {
      gsap.from(el, { y: 70, opacity: 0, scale: 0.96, duration: 1.2, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
    });

    // Parallax backgrounds
    $$(".parallax").forEach((el) => {
      gsap.fromTo(el, { yPercent: -8 }, { yPercent: 8, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
    });

    // Big names pop
    $$(".big-name").forEach((el) => {
      gsap.from(el, { scale: 0.85, opacity: 0, y: 30, duration: 1.4, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%", once: true } });
    });

    // Timeline fill
    gsap.to("#tlFill", { scaleY: 1, ease: "none", scrollTrigger: { trigger: ".timeline", start: "top 70%", end: "bottom 70%", scrub: true } });

    // Gallery entrance: photos fade/slide in as the strip comes into view
    gsap.from(".m", { y: 60, opacity: 0, duration: 1, stagger: 0.08, ease: "power3.out", scrollTrigger: { trigger: "#track", start: "top 85%", once: true } });
  }

  // Progress bar + nav state
  const bar = $(".progress span");
  const nav = $("#nav");
  ScrollTrigger.create({
    start: 0, end: "max",
    onUpdate: (self) => {
      bar.style.transform = `scaleX(${self.progress})`;
      nav.classList.toggle("solid", scrollY > innerHeight * 0.6);
    },
  });

  // Pinned sections measure their start/end once; re-measure whenever late-loading fonts,
  // images or the gate removal change the page height, otherwise a blank pin gap can appear.
  let refreshTimer = 0;
  const refreshSoon = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 150);
  };
  addEventListener("load", refreshSoon);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshSoon);
  $$("img").forEach((img) => { if (!img.complete) img.addEventListener("load", refreshSoon, { once: true }); });

  initCommon();

  /* Used when GSAP is missing: still make the page usable. */
  function initPlain() {
    openBtn.addEventListener("click", () => {});
    initCommon();
  }

  /* ---------- Features that don't need GSAP ---------- */
  function initCommon() {
    // Gallery strip: arrow buttons + mouse drag (touch uses native swipe)
    const track = $("#track");
    if (track) {
      const step = () => Math.min(track.clientWidth * 0.8, 700);
      $("#galPrev")?.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
      $("#galNext")?.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
      let down = false, startX = 0, startLeft = 0, moved = false;
      track.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "mouse") return;
        down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
      });
      addEventListener("pointermove", (e) => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 5) { moved = true; track.classList.add("dragging"); }
        if (moved) track.scrollLeft = startLeft - dx;
      });
      addEventListener("pointerup", () => {
        if (!down) return;
        down = false;
        setTimeout(() => track.classList.remove("dragging"), 0);
      });
      track.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    }

    // Load the map only once it is on screen (embedded maps can grab focus and yank scroll on load).
    const mapFrame = $(".map iframe");
    if (mapFrame && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          mapFrame.src = mapFrame.dataset.src;
          io.disconnect();
        }
      }, { threshold: 0.35 });
      io.observe(mapFrame);
    } else if (mapFrame) {
      mapFrame.src = mapFrame.dataset.src;
    }

    // Lightbox
    const lb = $("#lb"), lbImg = $("#lbImg");
    const openLb = (src, alt = "") => { lbImg.src = src; lbImg.alt = alt; lb.hidden = false; $("#lbClose").focus(); };
    const closeLb = () => { lb.hidden = true; lbImg.removeAttribute("src"); };
    $$("[data-lb]").forEach((f) => f.addEventListener("click", () => openLb(f.dataset.lb, $("img", f)?.alt)));
    $$("[data-card]").forEach((b) => b.addEventListener("click", () => openLb(`${ROOT}cards/card-${b.dataset.card}.jpg`, "Invitation card")));
    lb.addEventListener("click", (e) => { if (e.target !== lbImg) closeLb(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lb.hidden) closeLb(); });

    // Directions + calendar
    $$(".ev").forEach((ev) => {
      const q = encodeURIComponent(ev.dataset.q);
      $("[data-dir]", ev).href = `https://www.google.com/maps/search/?api=1&query=${q}`;
      $("[data-cal]", ev).addEventListener("click", () => downloadIcs(ev));
    });
  }

  function downloadIcs(ev) {
    const start = new Date(ev.dataset.start + ":00+05:30");
    const end = new Date(start.getTime() + Number(ev.dataset.hours) * 3600e3);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const esc = (s) => s.replace(/[,;\\]/g, "\\$&").replace(/\n/g, "\\n");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rohit and Saloni//Wedding//EN", "BEGIN:VEVENT",
      `UID:${fmt(start)}-${ev.dataset.title.replace(/\W/g, "")}@rohit-saloni`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
      `SUMMARY:${esc(ev.dataset.title + " · Rohit & Saloni")}`,
      `LOCATION:${esc(ev.dataset.loc)}`,
      "DESCRIPTION:" + esc("Wedding celebration of Rohit & Saloni. RSVP: Ashish Attal 8949474832"),
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: ev.dataset.title.replace(/\W+/g, "-").toLowerCase() + ".ics" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
})();
