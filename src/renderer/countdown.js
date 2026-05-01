let countdownInterval;
let currentTime;
let totalDuration;
let breathingAnimation;
let imageRotator;
let currentImageIndex = 0;
let bgImages = [];
let activeLayer = 'A'; // which bg-layer is currently visible

const radius = 90;
const circumference = 2 * Math.PI * radius;

const EXERCISES = [
  { title: 'Rest Your Eyes',   instruction: 'Look at something 20 feet away' },
  { title: 'Blink Reset',      instruction: 'Blink rapidly 10–15 times, then close eyes' },
  { title: 'Eye Roll',         instruction: 'Slowly roll your eyes in a full circle' },
  { title: 'Palming',          instruction: 'Cup warm hands over closed eyes, breathe deeply' },
  { title: 'Near & Far Focus', instruction: 'Alternate focusing on your thumb and something distant' },
  { title: 'Figure-8 Trace',   instruction: 'Slowly trace a figure-8 with your eyes' },
];

document.addEventListener('DOMContentLoaded', () => {
  const ring = document.querySelector('.progress-ring');
  if (ring) {
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = 0;
  }
  window.electronAPI.on('start-countdown',  (data)   => startCountdown(data));
  window.electronAPI.on('background-config', (config) => applyBackground(config));
});

// ── Background ────────────────────────────────────────────────────────────────

function applyBackground(config) {
  const overlay = document.querySelector('.overlay');
  const layerA  = document.getElementById('bgLayerA');
  const layerB  = document.getElementById('bgLayerB');
  if (!overlay) return;

  stopImageRotator();

  // Reset both layers to invisible without transition (instant)
  [layerA, layerB].forEach(l => {
    l.style.transition = 'none';
    l.style.opacity = '0';
    l.style.backgroundImage = '';
  });
  activeLayer = 'A';

  if (config.mode === 'gradient') {
    overlay.style.background =
      `linear-gradient(${config.gradientAngle}deg, ${config.gradientStart}, ${config.gradientEnd})`;
    applyAdaptiveTextColor(avgHexColors(config.gradientStart, config.gradientEnd));

  } else if (config.mode === 'images' && config.urls && config.urls.length > 0) {
    // Dark fallback while first image loads
    overlay.style.background = '#0a0e27';
    bgImages = config.urls;
    currentImageIndex = 0;
    // Preload then show first image (no crossfade — direct show)
    preloadImage(bgImages[0], () => {
      layerA.style.transition = 'none';
      layerA.style.backgroundImage = `url("${bgImages[0]}")`;
      layerA.style.opacity = '1';
      activeLayer = 'A';
      sampleImageAndAdaptText(bgImages[0]);
    });
    if (bgImages.length > 1) startImageRotator();

  } else {
    // Default deep-blue gradient
    overlay.style.background =
      'linear-gradient(135deg, #0a0e27 0%, #0d2137 50%, #0a1a2e 100%)';
    setTextColor('#ffffff');
  }
}

// Preload image, call cb when ready (or immediately on error)
function preloadImage(url, cb) {
  const img = new Image();
  img.onload  = cb;
  img.onerror = cb; // still show even if broken
  img.src = url;
}

// Crossfade: preload next image on the hidden layer, then swap opacities
function crossfadeTo(url) {
  const layerA = document.getElementById('bgLayerA');
  const layerB = document.getElementById('bgLayerB');

  const incoming = activeLayer === 'A' ? layerB : layerA;
  const outgoing = activeLayer === 'A' ? layerA : layerB;

  // Stage: load URL on hidden layer (opacity still 0)
  incoming.style.transition = 'none';
  incoming.style.backgroundImage = `url("${url}")`;
  incoming.style.opacity = '0';

  preloadImage(url, () => {
    // Re-enable transitions, then fade in new / fade out old
    requestAnimationFrame(() => {
      incoming.style.transition = 'opacity 0.9s ease-in-out';
      outgoing.style.transition = 'opacity 0.9s ease-in-out';
      incoming.style.opacity = '1';
      outgoing.style.opacity = '0';
      activeLayer = activeLayer === 'A' ? 'B' : 'A';
      sampleImageAndAdaptText(url);
    });
  });
}

function startImageRotator() {
  // Spread evenly across the break duration
  const interval = Math.max(4000, (totalDuration * 1000) / bgImages.length);
  imageRotator = setInterval(() => {
    currentImageIndex = (currentImageIndex + 1) % bgImages.length;
    crossfadeTo(bgImages[currentImageIndex]);
  }, interval);
}

function stopImageRotator() {
  if (imageRotator) { clearInterval(imageRotator); imageRotator = null; }
}

// ── Adaptive text contrast (WCAG relative luminance) ─────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}

function relativeLuminance({ r, g, b }) {
  return [r, g, b].reduce((acc, v, i) => {
    v /= 255;
    const lin = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    return acc + lin * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}

function avgHexColors(hex1, hex2) {
  const a = hexToRgb(hex1), b = hexToRgb(hex2);
  return { r: (a.r+b.r)/2, g: (a.g+b.g)/2, b: (a.b+b.b)/2 };
}

function applyAdaptiveTextColor(rgb) {
  setTextColor(relativeLuminance(rgb) > 0.35 ? '#111111' : '#ffffff');
}

function setTextColor(color) {
  const content = document.querySelector('.content');
  if (!content) return;
  content.style.color = color;
  const isDark = color === '#111111';
  document.querySelectorAll('kbd').forEach(k => {
    k.style.background   = isDark ? 'rgba(0,0,0,0.1)'   : 'rgba(255,255,255,0.08)';
    k.style.borderColor  = isDark ? 'rgba(0,0,0,0.2)'   : 'rgba(255,255,255,0.15)';
    k.style.color        = isDark ? '#111'               : '#fff';
  });
}

function sampleImageAndAdaptText(url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 10; canvas.height = 10;
      const ctx = canvas.getContext('2d');
      // Sample centre 40% of the image
      ctx.drawImage(img, img.width*0.3, img.height*0.3, img.width*0.4, img.height*0.4, 0, 0, 10, 10);
      const data = ctx.getImageData(0, 0, 10, 10).data;
      let r=0, g=0, b=0, n=0;
      for (let i = 0; i < data.length; i += 4) { r+=data[i]; g+=data[i+1]; b+=data[i+2]; n++; }
      applyAdaptiveTextColor({ r:r/n, g:g/n, b:b/n });
    } catch { setTextColor('#ffffff'); }
  };
  img.onerror = () => setTextColor('#ffffff');
  img.src = url;
}

// ── Countdown ─────────────────────────────────────────────────────────────────

function startCountdown(data) {
  totalDuration = data.duration;
  currentTime   = data.duration;

  const ex = EXERCISES[Math.floor(Math.random() * EXERCISES.length)];
  const h1 = document.getElementById('reminderMessage');
  const inst = document.querySelector('.instruction');
  if (h1) h1.textContent = (data.message && data.message !== 'Time to rest your eyes')
    ? data.message : ex.title;
  if (inst) inst.textContent = ex.instruction;

  if (countdownInterval) clearInterval(countdownInterval);
  startBreathingAnimation();
  countdownInterval = setInterval(updateCountdown, 1000);
}

function setProgress(percent) {
  const ring = document.querySelector('.progress-ring');
  if (ring) ring.style.strokeDashoffset = circumference - (percent / 100) * circumference;
}

function updateCountdown() {
  currentTime--;
  const text = document.querySelector('.countdown-text');
  if (text) text.textContent = currentTime;
  setProgress(((totalDuration - currentTime) / totalDuration) * 100);
  if (currentTime <= 0) {
    clearInterval(countdownInterval);
    stopBreathingAnimation();
    stopImageRotator();
    completeCountdown();
  }
}

function completeCountdown() {
  window.electronAPI.send('countdown-complete');
  const h1   = document.querySelector('h1');
  const inst  = document.querySelector('.instruction');
  const text  = document.querySelector('.countdown-text');
  if (h1)   h1.textContent   = 'Great job!';
  if (inst)  inst.textContent = 'Your eyes thank you ✨';
  if (text)  text.textContent = '✓';
  document.querySelector('.progress-ring')?.classList.add('complete');
  setTimeout(() => window.close(), 1500);
}

// ── Breathing animation ───────────────────────────────────────────────────────

function startBreathingAnimation() {
  const circle = document.querySelector('.countdown-circle');
  if (!circle) return;
  let expanding = true, step = 0;
  const INHALE = 40, EXHALE = 60;
  breathingAnimation = setInterval(() => {
    step++;
    const total = expanding ? INHALE : EXHALE;
    if (step >= total) { step = 0; expanding = !expanding; }
    const eased = 0.5 - Math.cos((step / total) * Math.PI) / 2;
    const scale = expanding ? 1 + eased * 0.07 : 1.07 - eased * 0.07;
    circle.style.transform = `scale(${scale.toFixed(4)})`;
  }, 100);
}

function stopBreathingAnimation() {
  if (breathingAnimation) {
    clearInterval(breathingAnimation);
    const c = document.querySelector('.countdown-circle');
    if (c) c.style.transform = 'scale(1)';
  }
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
    if (e.key === 'P' || e.key === 'p') {
      clearInterval(countdownInterval);
      stopBreathingAnimation();
      stopImageRotator();
      window.electronAPI.send('postpone-break');
    } else if (e.key === 'K' || e.key === 'k') {
      clearInterval(countdownInterval);
      stopBreathingAnimation();
      stopImageRotator();
      window.electronAPI.send('skip-break');
    }
  }
});
