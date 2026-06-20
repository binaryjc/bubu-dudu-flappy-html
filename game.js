(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const sharePanel = document.getElementById("sharePanel");
  const shareBtn = document.getElementById("shareBtn");
  const shareX = document.getElementById("shareX");
  const shareFacebook = document.getElementById("shareFacebook");
  const shareWhatsApp = document.getElementById("shareWhatsApp");
  const copyShareBtn = document.getElementById("copyShareBtn");
  const shareStatus = document.getElementById("shareStatus");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const fullscreenTarget = document.getElementById("fullscreenTarget") || canvas.parentElement;
  const controlsBtn = document.getElementById("controlsBtn");
  const controlsPanel = document.getElementById("controlsPanel");
  const controlsCloseBtn = document.getElementById("controlsCloseBtn");
  const fullscreenEnterLabel = fullscreenBtn
    ? fullscreenBtn.dataset.enterLabel || fullscreenBtn.textContent.trim() || "Fullscreen"
    : "Fullscreen";

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const GROUND_HEIGHT = 76;
  const GROUND_Y = HEIGHT - GROUND_HEIGHT;

  const CONFIG = {
    gravity: 0.36,
    flapImpulse: -6.6,
    maxFallSpeed: 10.5,
    scrollSpeed: 2.55,
    pipeWidth: 82,
    pipeGap: 178,
    pipeSpacing: 292,
    pipeCount: 5,
    bubuStartX: 220,
    bubuRadius: 22,
    bubuDrawSize: 84,
    duduDrawSize: 70,
    duduFollowOffset: 58,
    difficultyStep: 20,
    minPipeGap: 150,
    maxSpeedMultiplier: 1.3,
    fireballRadius: 20,
    fireballWarningTime: 90,
    shareUrl: "", // Optional: set your deployed game URL here.
    highScoreKey: "bubuDuduFlappyHighScore",
  };

  const state = {
    mode: "start", // start | playing | gameover
    score: 0,
    highScore: readHighScore(),
    time: 0,
    scroll: 0,
    hitFlash: 0,
    difficultyTier: 0,
    levelUpTimer: 0,
    levelUpText: "",
    fireballCooldown: 0,
  };

  const bubu = {
    x: CONFIG.bubuStartX,
    y: HEIGHT * 0.42,
    vy: 0,
    radius: CONFIG.bubuRadius,
    rotation: 0,
  };

  const dudu = {
    x: CONFIG.bubuStartX - CONFIG.duduFollowOffset,
    y: HEIGHT * 0.42 + 10,
    rotation: 0,
  };

  const followerTrail = [];
  const pipes = [];
  const fireballs = [];
  let pipeSequence = 0;

  const clouds = [
    { x: 30, y: 86, size: 30, speed: 0.12 },
    { x: 170, y: 132, size: 24, speed: 0.17 },
    { x: 310, y: 72, size: 34, speed: 0.09 },
    { x: 470, y: 116, size: 28, speed: 0.14 },
    { x: 620, y: 92, size: 22, speed: 0.2 },
    { x: 770, y: 142, size: 30, speed: 0.11 },
    { x: 910, y: 76, size: 25, speed: 0.16 },
  ];

  const assets = {
    bubu: loadImage("bubu.png"),
    dudu: loadImage("dudu.png"),
  };

  const audio = {
    ctx: null,
    enabled: true,
  };

  function loadImage(sources) {
    const candidates = Array.isArray(sources) ? sources : [sources];
    const img = new Image();
    let index = 0;

    const tryNext = () => {
      if (index >= candidates.length) {
        img.failed = true;
        return;
      }

      img.src = candidates[index];
      index += 1;
    };

    img.onerror = () => {
      tryNext();
    };

    tryNext();
    return img;
  }

  function imageReady(img) {
    return img && img.complete && img.naturalWidth > 0 && !img.failed;
  }

  function readHighScore() {
    try {
      return Number(localStorage.getItem(CONFIG.highScoreKey)) || 0;
    } catch {
      return 0;
    }
  }

  function writeHighScore(value) {
    try {
      localStorage.setItem(CONFIG.highScoreKey, String(value));
    } catch {
      // Ignore storage errors (private mode, blocked storage, etc.).
    }
  }

  function getFullscreenElement() {
    return (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      null
    );
  }

  function updateFullscreenButton() {
    if (!fullscreenBtn) return;
    fullscreenBtn.textContent = getFullscreenElement() ? "Exit Fullscreen" : fullscreenEnterLabel;
  }

  function setControlsOpen(isOpen) {
    if (!controlsPanel || !controlsBtn) return;

    controlsPanel.hidden = !isOpen;
    controlsBtn.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) {
      controlsCloseBtn?.focus();
    } else {
      controlsBtn.focus();
    }
  }

  function applyFullscreenLayout() {
    const fullscreenElement = getFullscreenElement();
    const isActive = Boolean(fullscreenElement);
    const usingFallbackLayer = Boolean(isActive && fullscreenElement && fullscreenElement !== fullscreenTarget);

    document.body.classList.toggle("app-fullscreen", isActive);
    fullscreenTarget.classList.toggle("fullscreen-fallback-layer", usingFallbackLayer);

    if (!isActive) {
      canvas.style.width = "";
      canvas.style.height = "";
      fullscreenTarget.style.width = "";
      fullscreenTarget.style.height = "";
      return;
    }

    const viewport = window.visualViewport;
    const viewportW = viewport ? viewport.width : window.innerWidth;
    const viewportH = viewport ? viewport.height : window.innerHeight;
    const padding = Math.max(8, Math.min(20, Math.min(viewportW, viewportH) * 0.02));
    const maxW = Math.max(1, viewportW - padding * 2);
    const maxH = Math.max(1, viewportH - padding * 2);
    const scale = Math.min(maxW / WIDTH, maxH / HEIGHT);
    const targetW = Math.max(1, Math.round(WIDTH * scale));
    const targetH = Math.max(1, Math.round(HEIGHT * scale));

    canvas.style.width = `${targetW}px`;
    canvas.style.height = `${targetH}px`;

    if (usingFallbackLayer) {
      fullscreenTarget.style.width = "100vw";
      fullscreenTarget.style.height = "100vh";
    } else {
      fullscreenTarget.style.width = "";
      fullscreenTarget.style.height = "";
    }
  }

  async function requestElementFullscreen(element) {
    if (!element) return false;

    const requestFn =
      element.requestFullscreen ||
      element.webkitRequestFullscreen ||
      element.mozRequestFullScreen ||
      element.msRequestFullscreen;

    if (!requestFn) return false;

    const result = requestFn.call(element);
    if (result && typeof result.then === "function") {
      try {
        await result;
      } catch {
        return false;
      }
    }
    return true;
  }

  async function exitFullscreen() {
    const exitFn =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.mozCancelFullScreen ||
      document.msExitFullscreen;

    if (!exitFn) return false;

    const result = exitFn.call(document);
    if (result && typeof result.then === "function") {
      try {
        await result;
      } catch {
        return false;
      }
    }
    return true;
  }

  async function toggleFullscreen() {
    if (getFullscreenElement()) {
      await exitFullscreen();
      updateFullscreenButton();
      return;
    }

    const targetOk = await requestElementFullscreen(fullscreenTarget);
    if (!targetOk) {
      await requestElementFullscreen(document.documentElement);
    }
    updateFullscreenButton();
  }

  function getShareUrl() {
    if (CONFIG.shareUrl) {
      return CONFIG.shareUrl;
    }

    if (window.location.protocol === "file:") {
      return window.location.href.split("#")[0];
    }

    return `${window.location.origin}${window.location.pathname}${window.location.search}`;
  }

  function getSharePayload() {
    return {
      title: "Bubu & Dudu Flappy",
      text: `I scored ${state.score} in Bubu & Dudu Flappy. Can you beat me?`,
      url: getShareUrl(),
    };
  }

  function updateShareLinks() {
    if (!shareX || !shareFacebook || !shareWhatsApp) return;

    const payload = getSharePayload();
    const encodedUrl = encodeURIComponent(payload.url);
    const encodedText = encodeURIComponent(payload.text);
    const encodedFullText = encodeURIComponent(`${payload.text} ${payload.url}`);

    shareX.href = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    shareFacebook.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
    shareWhatsApp.href = `https://api.whatsapp.com/send?text=${encodedFullText}`;
  }

  function setShareStatus(message) {
    if (!shareStatus) return;
    shareStatus.textContent = message;
  }

  function updateSharePanelVisibility() {
    if (!sharePanel) return;

    const isVisible = state.mode === "gameover";
    sharePanel.hidden = !isVisible;

    if (!isVisible) {
      setShareStatus("");
      return;
    }

    updateShareLinks();
  }

  async function copyShareText() {
    const payload = getSharePayload();
    const textToCopy = `${payload.text} ${payload.url}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setShareStatus("Copied share text.");
      return;
    } catch {
      const area = document.createElement("textarea");
      area.value = textToCopy;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.focus();
      area.select();
      try {
        document.execCommand("copy");
        setShareStatus("Copied share text.");
      } catch {
        setShareStatus("Copy failed. Use a social button.");
      }
      document.body.removeChild(area);
    }
  }

  async function shareScore() {
    updateShareLinks();
    const payload = getSharePayload();

    if (navigator.share) {
      try {
        await navigator.share(payload);
        setShareStatus("Shared.");
        return;
      } catch (error) {
        if (error && error.name === "AbortError") {
          return;
        }
      }
    }

    setShareStatus("Use the social buttons or Copy.");
  }

  function initAudio() {
    if (!audio.enabled || audio.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audio.ctx = new AudioCtx();
  }

  function resumeAudio() {
    initAudio();
    if (audio.ctx && audio.ctx.state === "suspended") {
      audio.ctx.resume();
    }
  }

  function playTone(
    frequency,
    duration,
    { type = "sine", volume = 0.05, endFrequency = frequency, startOffset = 0 } = {}
  ) {
    if (!audio.enabled || !audio.ctx) return;

    const now = audio.ctx.currentTime + startOffset;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, frequency), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(audio.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playFlapSound() {
    playTone(700, 0.08, { type: "triangle", volume: 0.035, endFrequency: 530 });
  }

  function playScoreSound() {
    playTone(880, 0.06, {
      type: "square",
      volume: 0.025,
      endFrequency: 1120,
      startOffset: 0,
    });
    playTone(1120, 0.06, {
      type: "square",
      volume: 0.022,
      endFrequency: 1320,
      startOffset: 0.06,
    });
  }

  function playGameOverSound() {
    playTone(360, 0.15, { type: "sawtooth", volume: 0.03, endFrequency: 240, startOffset: 0 });
    playTone(240, 0.17, { type: "sawtooth", volume: 0.028, endFrequency: 130, startOffset: 0.1 });
  }

  function playLevelUpSound() {
    playTone(660, 0.08, { type: "triangle", volume: 0.03, endFrequency: 820 });
    playTone(880, 0.1, {
      type: "triangle",
      volume: 0.032,
      endFrequency: 1120,
      startOffset: 0.08,
    });
  }

  function getDifficultySettings(tier = state.difficultyTier) {
    const advancedSteps = Math.max(0, tier - 3);
    const speedMultiplier = Math.min(
      CONFIG.maxSpeedMultiplier,
      1 + advancedSteps * 0.05
    );

    return {
      tier,
      stage: tier + 1,
      movingPipes: tier === 1 || tier >= 3,
      fireballs: tier === 2 || tier >= 3,
      scrollSpeed: CONFIG.scrollSpeed * speedMultiplier,
      pipeGap: Math.max(CONFIG.minPipeGap, CONFIG.pipeGap - advancedSteps * 4),
      movingAmplitude: Math.min(58, 38 + advancedSteps * 3),
      fireballSpeed: Math.min(7.2, 5.4 + advancedSteps * 0.25),
      fireballCooldown: Math.max(240, 360 - advancedSteps * 20),
    };
  }

  function getDifficultyLabel(tier = state.difficultyTier) {
    if (tier === 0) return "Warm-up";
    if (tier === 1) return "Moving Pipes";
    if (tier === 2) return "Fireballs";
    if (tier === 3) return "Double Trouble";
    return "Faster Hazards";
  }

  function getLevelUpMessage(tier) {
    if (tier === 1) return "Moving pipes unlocked!";
    if (tier === 2) return "Fireballs incoming!";
    if (tier === 3) return "Pipes + fireballs!";
    return "Speed increased!";
  }

  function setDifficultyTier(tier) {
    if (tier === state.difficultyTier) return;

    state.difficultyTier = tier;
    state.levelUpText = getLevelUpMessage(tier);
    state.levelUpTimer = 150;
    state.fireballCooldown = tier === 2 || tier >= 3 ? 180 : 0;
    playLevelUpSound();
  }

  function addScore() {
    state.score += 1;
    const nextTier = Math.floor(state.score / CONFIG.difficultyStep);

    if (nextTier > state.difficultyTier) {
      setDifficultyTier(nextTier);
    }
  }

  function getGapCenterBounds(gapSize) {
    return {
      min: 100 + gapSize * 0.5,
      max: GROUND_Y - 60 - gapSize * 0.5,
    };
  }

  function randomGapY(gapSize = getDifficultySettings().pipeGap) {
    const { min, max } = getGapCenterBounds(gapSize);
    return min + Math.random() * (max - min);
  }

  function configurePipe(pipe, x) {
    const gapSize = getDifficultySettings().pipeGap;
    const gapY = randomGapY(gapSize);

    pipe.x = x;
    pipe.baseGapY = gapY;
    pipe.gapY = gapY;
    pipe.moveOffset = 0;
    pipe.movePhase = Math.random() * Math.PI * 2;
    pipe.moving = pipeSequence % 3 === 1;
    pipe.scored = false;
    pipeSequence += 1;
  }

  function initPipes() {
    pipes.length = 0;
    pipeSequence = 0;
    const firstX = Math.round(WIDTH * 0.68);

    for (let i = 0; i < CONFIG.pipeCount; i += 1) {
      const pipe = {};
      configurePipe(pipe, firstX + i * CONFIG.pipeSpacing);
      pipes.push(pipe);
    }
  }

  function resetGame() {
    state.mode = "start";
    state.score = 0;
    state.scroll = 0;
    state.hitFlash = 0;
    state.difficultyTier = 0;
    state.levelUpTimer = 0;
    state.levelUpText = "";
    state.fireballCooldown = 0;
    fireballs.length = 0;

    bubu.x = CONFIG.bubuStartX;
    bubu.y = HEIGHT * 0.42;
    bubu.vy = 0;
    bubu.rotation = 0;

    dudu.x = bubu.x - CONFIG.duduFollowOffset;
    dudu.y = bubu.y + 10;
    dudu.rotation = 0;

    followerTrail.length = 0;
    for (let i = 0; i < 20; i += 1) {
      followerTrail.push({ x: dudu.x, y: dudu.y, rotation: 0 });
    }

    initPipes();
    updateSharePanelVisibility();
  }

  function startRun() {
    state.mode = "playing";
  }

  function flap() {
    bubu.vy = CONFIG.flapImpulse;
    playFlapSound();
  }

  function toGameOver() {
    if (state.mode === "gameover") return;

    state.mode = "gameover";
    state.hitFlash = 1;
    playGameOverSound();

    if (state.score > state.highScore) {
      state.highScore = state.score;
      writeHighScore(state.highScore);
    }

    updateSharePanelVisibility();
  }

  function handleAction() {
    resumeAudio();

    if (state.mode === "start") {
      startRun();
      flap();
      return;
    }

    if (state.mode === "playing") {
      flap();
      return;
    }

    if (state.mode === "gameover") {
      resetGame();
      startRun();
      flap();
    }
  }

  function updatePipes(dt) {
    const difficulty = getDifficultySettings();
    const { min: minGapY, max: maxGapY } = getGapCenterBounds(difficulty.pipeGap);

    for (const pipe of pipes) {
      pipe.x -= difficulty.scrollSpeed * dt;

      const shouldMove = difficulty.movingPipes && pipe.moving;
      const targetOffset = shouldMove
        ? Math.sin(state.time * 0.025 + pipe.movePhase) * difficulty.movingAmplitude
        : 0;
      pipe.moveOffset += (targetOffset - pipe.moveOffset) * Math.min(1, 0.035 * dt);
      pipe.gapY = clamp(pipe.baseGapY + pipe.moveOffset, minGapY, maxGapY);

      if (!pipe.scored && pipe.x + CONFIG.pipeWidth < bubu.x - bubu.radius) {
        pipe.scored = true;
        addScore();
        playScoreSound();
      }

      if (pipe.x + CONFIG.pipeWidth < -20) {
        const farthestX = pipes.reduce((maxX, p) => Math.max(maxX, p.x), 0);
        configurePipe(pipe, farthestX + CONFIG.pipeSpacing);
      }
    }
  }

  function chooseFireballY() {
    const lanes = [135, 220, 305, 390];
    const safeLanes = lanes.filter((laneY) => Math.abs(laneY - bubu.y) > 95);
    const choices = safeLanes.length > 0 ? safeLanes : lanes;
    return choices[Math.floor(Math.random() * choices.length)];
  }

  function spawnFireball() {
    fireballs.push({
      mode: "warning",
      x: WIDTH + 50,
      y: chooseFireballY(),
      radius: CONFIG.fireballRadius,
      warningTimer: CONFIG.fireballWarningTime,
      spin: 0,
    });
  }

  function updateFireballs(dt) {
    const difficulty = getDifficultySettings();

    if (!difficulty.fireballs) {
      fireballs.length = 0;
      return;
    }

    state.fireballCooldown -= dt;

    if (state.fireballCooldown <= 0 && fireballs.length === 0) {
      spawnFireball();
      state.fireballCooldown = difficulty.fireballCooldown + Math.random() * 90;
    }

    for (let i = fireballs.length - 1; i >= 0; i -= 1) {
      const fireball = fireballs[i];

      if (fireball.mode === "warning") {
        fireball.warningTimer -= dt;
        if (fireball.warningTimer <= 0) {
          fireball.mode = "flying";
          fireball.x = WIDTH + fireball.radius + 18;
        }
        continue;
      }

      fireball.x -= difficulty.fireballSpeed * dt;
      fireball.spin += 0.12 * dt;

      if (fireball.x + fireball.radius < -40) {
        fireballs.splice(i, 1);
      }
    }
  }

  function checkCollision() {
    if (bubu.y + bubu.radius >= GROUND_Y) {
      bubu.y = GROUND_Y - bubu.radius;
      toGameOver();
      return;
    }

    for (const pipe of pipes) {
      const withinX =
        bubu.x + bubu.radius > pipe.x && bubu.x - bubu.radius < pipe.x + CONFIG.pipeWidth;

      if (!withinX) continue;

      const pipeGap = getDifficultySettings().pipeGap;
      const gapTop = pipe.gapY - pipeGap * 0.5;
      const gapBottom = pipe.gapY + pipeGap * 0.5;

      if (bubu.y - bubu.radius < gapTop || bubu.y + bubu.radius > gapBottom) {
        toGameOver();
        return;
      }
    }

    for (const fireball of fireballs) {
      if (fireball.mode !== "flying") continue;

      const dx = bubu.x - fireball.x;
      const dy = bubu.y - fireball.y;
      const collisionDistance = (bubu.radius + fireball.radius) * 0.82;

      if (dx * dx + dy * dy < collisionDistance * collisionDistance) {
        toGameOver();
        return;
      }
    }
  }

  function updateFollower(dt) {
    followerTrail.unshift({ x: bubu.x, y: bubu.y, rotation: bubu.rotation });

    if (followerTrail.length > 30) {
      followerTrail.pop();
    }

    const targetIndex = Math.min(11, followerTrail.length - 1);
    const target = followerTrail[targetIndex] || {
      x: bubu.x - CONFIG.duduFollowOffset,
      y: bubu.y + 10,
      rotation: 0,
    };

    const posSmoothing = Math.min(1, 0.14 * dt);
    const rotSmoothing = Math.min(1, 0.18 * dt);

    dudu.x += (target.x - CONFIG.duduFollowOffset - dudu.x) * posSmoothing;
    dudu.y += (target.y + 11 - dudu.y) * posSmoothing;
    dudu.rotation += (target.rotation * 0.7 - dudu.rotation) * rotSmoothing;
  }

  function update(dt, nowMs) {
    state.time += dt;
    state.hitFlash = Math.max(0, state.hitFlash - 0.05 * dt);
    state.levelUpTimer = Math.max(0, state.levelUpTimer - dt);

    if (state.mode === "playing") {
      const difficulty = getDifficultySettings();
      state.scroll += difficulty.scrollSpeed * dt;

      bubu.vy = Math.min(CONFIG.maxFallSpeed, bubu.vy + CONFIG.gravity * dt);
      bubu.y += bubu.vy * dt;

      if (bubu.y - bubu.radius < 0) {
        bubu.y = bubu.radius;
        bubu.vy = 0;
      }

      bubu.rotation = clamp(bubu.vy * 0.09, -0.6, 1.1);

      updatePipes(dt);
      updateFireballs(dt);
      checkCollision();
    } else if (state.mode === "start") {
      const floatTargetY = HEIGHT * 0.42 + Math.sin(nowMs * 0.004) * 8;
      bubu.y += (floatTargetY - bubu.y) * Math.min(1, 0.12 * dt);
      bubu.rotation = Math.sin(nowMs * 0.003) * 0.05;
      bubu.vy = 0;

      state.scroll += CONFIG.scrollSpeed * 0.35 * dt;
    } else if (state.mode === "gameover") {
      state.scroll += CONFIG.scrollSpeed * 0.35 * dt;

      bubu.vy = Math.min(CONFIG.maxFallSpeed, bubu.vy + CONFIG.gravity * dt);
      bubu.y = Math.min(GROUND_Y - bubu.radius, bubu.y + bubu.vy * dt);
      bubu.rotation = Math.min(1.25, bubu.rotation + 0.05 * dt);
    }

    updateFollower(dt);
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, "#b6ebff");
    sky.addColorStop(0.55, "#d9f6ff");
    sky.addColorStop(1, "#fff3ce");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Sun glow
    ctx.fillStyle = "rgba(255, 228, 139, 0.55)";
    ctx.beginPath();
    ctx.arc(WIDTH - 62, 72, 34, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < clouds.length; i += 1) {
      const cloud = clouds[i];
      const span = WIDTH + 180;
      const rawX = cloud.x - state.scroll * cloud.speed;
      const x = ((rawX % span) + span) % span - 90;
      const y = cloud.y + Math.sin((state.time + i * 11) * 0.06) * 2;
      drawCloud(x, y, cloud.size);
    }

    drawHillLayer("#aee2b8", GROUND_Y - 40, 0.13, 24);
    drawHillLayer("#92d6a5", GROUND_Y - 18, 0.2, 19);
  }

  function drawCloud(x, y, size) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.arc(x + size * 0.45, y - size * 0.15, size * 0.42, 0, Math.PI * 2);
    ctx.arc(x + size * 0.92, y, size * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHillLayer(color, baseline, speedFactor, amp) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    ctx.lineTo(0, baseline);

    for (let x = 0; x <= WIDTH; x += 6) {
      const y = baseline + Math.sin((x + state.scroll * speedFactor * 12) * 0.025) * amp;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();
  }

  function drawPipes() {
    const pipeGap = getDifficultySettings().pipeGap;

    for (const pipe of pipes) {
      const gapTop = pipe.gapY - pipeGap * 0.5;
      const gapBottom = pipe.gapY + pipeGap * 0.5;

      drawHoneyPipe(pipe.x, 0, CONFIG.pipeWidth, gapTop, true);
      drawHoneyPipe(pipe.x, gapBottom, CONFIG.pipeWidth, GROUND_Y - gapBottom, false);
    }
  }

  function drawFireballs() {
    for (const fireball of fireballs) {
      if (fireball.mode === "warning") {
        drawFireballWarning(fireball);
      } else {
        drawFireball(fireball);
      }
    }
  }

  function drawFireballWarning(fireball) {
    const pulse = 0.65 + Math.sin(state.time * 0.22) * 0.25;
    const iconX = WIDTH - 48;

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = "#d84922";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(bubu.x + 90, fireball.y);
    ctx.lineTo(iconX - 28, fireball.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#fff3dc";
    ctx.strokeStyle = "#d84922";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(iconX, fireball.y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#c9391c";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = 'bold 28px "Trebuchet MS", sans-serif';
    ctx.fillText("!", iconX, fireball.y + 1);
    ctx.restore();
  }

  function drawFireball(fireball) {
    const flicker = Math.sin(state.time * 0.35) * 3;

    ctx.save();
    ctx.translate(fireball.x, fireball.y);

    ctx.fillStyle = "rgba(255, 107, 26, 0.38)";
    ctx.beginPath();
    ctx.moveTo(12, -13);
    ctx.quadraticCurveTo(43 + flicker, -3, 57, 0);
    ctx.quadraticCurveTo(42 - flicker, 8, 11, 14);
    ctx.closePath();
    ctx.fill();

    ctx.rotate(fireball.spin);
    const glow = ctx.createRadialGradient(-5, -6, 2, 0, 0, fireball.radius + 8);
    glow.addColorStop(0, "#fff7a8");
    glow.addColorStop(0.35, "#ffc33d");
    glow.addColorStop(0.72, "#f26322");
    glow.addColorStop(1, "rgba(190, 36, 16, 0.25)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, fireball.radius + 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f0441f";
    ctx.beginPath();
    ctx.arc(0, 0, fireball.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffd85a";
    ctx.beginPath();
    ctx.arc(-6, -6, fireball.radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHoneyPipe(x, y, width, height, capAtBottom) {
    if (height <= 0) return;

    const bodyColor = "#f0b23d";
    const edgeColor = "#9a631c";

    ctx.fillStyle = bodyColor;
    roundRect(ctx, x, y, width, height, 10);
    ctx.fill();

    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, width, height, 10);
    ctx.stroke();

    // Honeycomb texture dots.
    for (let row = y + 10; row < y + height - 8; row += 12) {
      const offset = Math.floor((row - y) / 12) % 2 === 0 ? 0 : 6;
      for (let col = x + 10 + offset; col < x + width - 8; col += 12) {
        drawHex(col, row, 4.2, "#ffd36e", "rgba(154, 99, 28, 0.22)");
      }
    }

    const capHeight = 16;
    const capY = capAtBottom ? y + height - capHeight : y;

    ctx.fillStyle = "#ffd26f";
    roundRect(ctx, x - 6, capY, width + 12, capHeight, 8);
    ctx.fill();

    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 2;
    roundRect(ctx, x - 6, capY, width + 12, capHeight, 8);
    ctx.stroke();

  }

  function drawHex(x, y, radius, fill, stroke) {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.PI / 3 * i;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    ctx.fillStyle = fill;
    ctx.fill();

    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawGround() {
    const groundGradient = ctx.createLinearGradient(0, GROUND_Y, 0, HEIGHT);
    groundGradient.addColorStop(0, "#ffd98c");
    groundGradient.addColorStop(1, "#f3b74b");

    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, GROUND_Y, WIDTH, GROUND_HEIGHT);

    ctx.strokeStyle = "#9f6f2f";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(WIDTH, GROUND_Y);
    ctx.stroke();

    const stripeWidth = 24;
    const drift = (state.scroll * 1.4) % stripeWidth;

    for (let x = -stripeWidth; x < WIDTH + stripeWidth; x += stripeWidth) {
      ctx.fillStyle = "rgba(255, 238, 173, 0.45)";
      ctx.fillRect(x - drift, GROUND_Y + 18, 14, 8);
      ctx.fillRect(x + 8 - drift, GROUND_Y + 36, 12, 7);
      ctx.fillRect(x - 4 - drift, GROUND_Y + 54, 10, 6);
    }
  }

  function drawCharacter(entity, image, isDudu) {
    const wingBeat = Math.sin(state.time * 0.25 + (isDudu ? 0.9 : 0)) * 0.55;
    const bob = Math.sin(state.time * 0.13 + (isDudu ? 0.8 : 0)) * 1.5;

    ctx.save();
    ctx.translate(entity.x, entity.y + bob);
    ctx.rotate(entity.rotation);

    if (imageReady(image)) {
      const size = isDudu ? CONFIG.duduDrawSize : CONFIG.bubuDrawSize;
      ctx.globalAlpha = isDudu ? 0.84 : 1;
      ctx.scale(1 + wingBeat * 0.03, 1 - wingBeat * 0.03);
      ctx.drawImage(image, -size / 2, -size / 2, size, size);
      ctx.globalAlpha = 1;
    } else {
      drawBearPlaceholder(isDudu, wingBeat);
    }

    ctx.restore();
  }

  function drawBearPlaceholder(isDudu, wingBeat) {
    const body = isDudu ? "#bf9a77" : "#a36f45";
    const belly = isDudu ? "#f9e3cc" : "#ffe7c8";
    const ear = isDudu ? "#d5b090" : "#c98a57";
    const eye = "#2f1d12";

    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, isDudu ? 17 : 20, isDudu ? 15 : 17, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = ear;
    ctx.beginPath();
    ctx.arc(-10, -12, 6, 0, Math.PI * 2);
    ctx.arc(10, -12, 6, 0, Math.PI * 2);
    ctx.fill();

    const wingYOffset = wingBeat * 2;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(-14, 1 + wingYOffset, 7, 5, -0.4, 0, Math.PI * 2);
    ctx.ellipse(14, 1 - wingYOffset, 7, 5, 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(0, 4, isDudu ? 9 : 11, isDudu ? 8 : 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(-5, -2, 1.6, 0, Math.PI * 2);
    ctx.arc(5, -2, 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 2, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawScore() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = 'bold 44px "Trebuchet MS", "Comic Sans MS", sans-serif';

    ctx.fillStyle = "rgba(65, 39, 21, 0.3)";
    ctx.fillText(String(state.score), WIDTH * 0.5, 64 + 2);

    ctx.fillStyle = "#fffef8";
    ctx.fillText(String(state.score), WIDTH * 0.5, 64);
  }

  function drawDifficultyHud() {
    if (state.mode !== "playing") return;

    const difficulty = getDifficultySettings();
    const label = `Stage ${difficulty.stage} • ${getDifficultyLabel()}`;

    ctx.save();
    ctx.font = 'bold 15px "Trebuchet MS", "Comic Sans MS", sans-serif';
    const width = ctx.measureText(label).width + 30;
    ctx.fillStyle = "rgba(65, 39, 21, 0.68)";
    roundRect(ctx, 18, 18, width, 36, 18);
    ctx.fill();
    ctx.fillStyle = "#fffdf7";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 33, 36);
    ctx.restore();
  }

  function drawLevelUpNotice() {
    if (state.levelUpTimer <= 0 || !state.levelUpText) return;

    const fadeIn = Math.min(1, (150 - state.levelUpTimer) / 18);
    const fadeOut = Math.min(1, state.levelUpTimer / 25);
    const alpha = Math.min(fadeIn, fadeOut);
    const panelWidth = 390;
    const panelHeight = 76;
    const panelX = (WIDTH - panelWidth) / 2;
    const panelY = 92;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(255, 251, 237, 0.95)";
    roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 18);
    ctx.fill();
    ctx.strokeStyle = "#f08a2a";
    ctx.lineWidth = 3;
    roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 18);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#a7421d";
    ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    ctx.fillText(`MILESTONE ${state.difficultyTier * CONFIG.difficultyStep}`, WIDTH / 2, panelY + 23);
    ctx.fillStyle = "#5d3e24";
    ctx.font = 'bold 25px "Trebuchet MS", "Comic Sans MS", sans-serif';
    ctx.fillText(state.levelUpText, WIDTH / 2, panelY + 51);
    ctx.restore();
  }

  function drawStartScreen() {
    const panelWidth = 520;
    const panelX = (WIDTH - panelWidth) / 2;
    drawPanel(panelX, HEIGHT * 0.2, panelWidth, 222);

    ctx.textAlign = "center";
    ctx.fillStyle = "#5d3e24";
    ctx.font = 'bold 34px "Trebuchet MS", "Comic Sans MS", sans-serif';
    ctx.fillText("Bubu & Dudu Flappy", WIDTH / 2, HEIGHT * 0.2 + 64);

    ctx.font = 'bold 26px "Trebuchet MS", "Comic Sans MS", sans-serif';
    ctx.fillStyle = "#7b532f";
    ctx.fillText("Tap to Start", WIDTH / 2, HEIGHT * 0.2 + 114);

    ctx.font = '18px "Trebuchet MS", "Comic Sans MS", sans-serif';
    ctx.fillStyle = "#7d6248";
    ctx.fillText("Tap / Click / Space to flap", WIDTH / 2, HEIGHT * 0.2 + 156);
    ctx.fillText(`High Score: ${state.highScore}`, WIDTH / 2, HEIGHT * 0.2 + 188);
  }

  function drawGameOverScreen() {
    const panelWidth = 470;
    const panelX = (WIDTH - panelWidth) / 2;
    drawPanel(panelX, HEIGHT * 0.18, panelWidth, 238);

    ctx.textAlign = "center";
    ctx.fillStyle = "#5d3e24";
    ctx.font = 'bold 36px "Trebuchet MS", "Comic Sans MS", sans-serif';
    ctx.fillText("Game Over", WIDTH / 2, HEIGHT * 0.18 + 58);

    ctx.font = 'bold 24px "Trebuchet MS", "Comic Sans MS", sans-serif';
    ctx.fillStyle = "#7a532e";
    ctx.fillText(`Score: ${state.score}`, WIDTH / 2, HEIGHT * 0.18 + 104);
    ctx.fillText(`High Score: ${state.highScore}`, WIDTH / 2, HEIGHT * 0.18 + 138);

    ctx.font = '18px "Trebuchet MS", "Comic Sans MS", sans-serif';
    ctx.fillStyle = "#7d6248";
    ctx.fillText("Tap / Click / Space to Restart", WIDTH / 2, HEIGHT * 0.18 + 184);
  }

  function drawPanel(x, y, width, height) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    roundRect(ctx, x, y, width, height, 18);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 196, 105, 0.95)";
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, width, height, 18);
    ctx.stroke();
  }

  function render() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    drawBackground();
    drawPipes();
    drawFireballs();
    drawGround();

    drawCharacter(dudu, assets.dudu, true);
    drawCharacter(bubu, assets.bubu, false);

    drawScore();
    drawDifficultyHud();
    drawLevelUpNotice();

    if (state.mode === "start") {
      drawStartScreen();
    } else if (state.mode === "gameover") {
      drawGameOverScreen();
    }

    if (state.hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.35 * state.hitFlash})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }

  function roundRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width * 0.5, height * 0.5);

    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handleAction();
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape" && controlsPanel && !controlsPanel.hidden) {
      event.preventDefault();
      setControlsOpen(false);
      return;
    }

    if (event.code !== "Space") return;
    const activeTag = document.activeElement ? document.activeElement.tagName : "";
    if (["BUTTON", "A", "INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) return;
    event.preventDefault();
    handleAction();
  });

  if (shareBtn) {
    shareBtn.addEventListener("click", () => {
      resumeAudio();
      shareScore();
    });
  }

  if (copyShareBtn) {
    copyShareBtn.addEventListener("click", () => {
      copyShareText();
    });
  }

  if (controlsBtn && controlsPanel) {
    controlsBtn.addEventListener("click", () => {
      setControlsOpen(controlsPanel.hidden);
    });

    controlsCloseBtn?.addEventListener("click", () => {
      setControlsOpen(false);
    });

    controlsPanel.addEventListener("pointerdown", (event) => {
      if (event.target === controlsPanel) {
        setControlsOpen(false);
      }
    });
  }

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", () => {
      resumeAudio();
      toggleFullscreen();
    });

    const onFullscreenChange = () => {
      updateFullscreenButton();
      applyFullscreenLayout();
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    document.addEventListener("mozfullscreenchange", onFullscreenChange);
    document.addEventListener("MSFullscreenChange", onFullscreenChange);
    document.addEventListener("msfullscreenchange", onFullscreenChange);
    window.addEventListener("resize", applyFullscreenLayout);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", applyFullscreenLayout);
      window.visualViewport.addEventListener("scroll", applyFullscreenLayout);
    }
    updateFullscreenButton();
    applyFullscreenLayout();
  }

  resetGame();

  let previousTime = 0;
  function gameLoop(timestamp) {
    if (!previousTime) {
      previousTime = timestamp;
    }

    const deltaMs = Math.min(33, timestamp - previousTime);
    const dt = deltaMs / 16.6667;
    previousTime = timestamp;

    update(dt, timestamp);
    render();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
})();
