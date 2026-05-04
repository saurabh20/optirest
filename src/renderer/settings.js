let currentSettings = {};
let appExceptions = []; // array of strings

// ── Helpers ──────────────────────────────────────────────────────────────────

function bindSlider(sliderId, valId, hiddenId) {
    const slider = document.getElementById(sliderId);
    const valEl  = document.getElementById(valId);
    const hidden = document.getElementById(hiddenId);
    slider.addEventListener('input', () => {
        valEl.textContent = slider.value;
        hidden.value = slider.value;
    });
}

function setSlider(sliderId, valId, hiddenId, val) {
    document.getElementById(sliderId).value = val;
    document.getElementById(valId).textContent = val;
    document.getElementById(hiddenId).value = val;
}

// ── Background mode tabs ──────────────────────────────────────────────────────

function switchBgMode(mode) {
    document.getElementById('backgroundMode').value = mode;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    document.getElementById('panelGradient').style.display = mode === 'gradient' ? 'block' : 'none';
    document.getElementById('panelImages').style.display   = mode === 'images'   ? 'block' : 'none';
}

// ── Gradient preview ──────────────────────────────────────────────────────────

function updateGradientPreview() {
    const start = document.getElementById('gradientStart').value;
    const end   = document.getElementById('gradientEnd').value;
    const angle = document.getElementById('gradientAngle').value || 135;
    document.getElementById('gradientPreview').style.background =
        `linear-gradient(${angle}deg, ${start}, ${end})`;
}

// ── Image grid ────────────────────────────────────────────────────────────────

let loadedImages = []; // [{fname, url}]

function renderImageGrid() {
    const grid = document.getElementById('imageGrid');
    const countBadge = document.getElementById('imgCount');
    countBadge.textContent = `${loadedImages.length}/5`;
    grid.innerHTML = '';

    loadedImages.forEach(({ fname, url }) => {
        const card = document.createElement('div');
        card.className = 'img-card';
        card.innerHTML = `
            <img src="${url}" alt="background">
            <button class="img-remove" data-fname="${fname}" title="Remove">✕</button>
        `;
        card.querySelector('.img-remove').addEventListener('click', async (e) => {
            const f = e.currentTarget.dataset.fname;
            loadedImages = await window.electronAPI.invoke('remove-background-image', f);
            // API returns plain array of fnames — refresh
            await reloadImages();
        });
        grid.appendChild(card);
    });

    document.getElementById('uploadImagesBtn').disabled = loadedImages.length >= 5;
}

async function reloadImages() {
    loadedImages = await window.electronAPI.invoke('get-background-images');
    renderImageGrid();
}

// ── App Exceptions ────────────────────────────────────────────────────────────

function renderExceptionTags() {
    const container = document.getElementById('exceptionTags');
    container.innerHTML = '';
    appExceptions.forEach((name, idx) => {
        const tag = document.createElement('span');
        tag.className = 'exception-tag';
        tag.innerHTML = `${name}<button class="tag-remove" data-idx="${idx}" title="Remove">✕</button>`;
        tag.querySelector('.tag-remove').addEventListener('click', (e) => {
            appExceptions.splice(parseInt(e.currentTarget.dataset.idx), 1);
            renderExceptionTags();
        });
        container.appendChild(tag);
    });
}

function addException(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (appExceptions.some(e => e.toLowerCase() === trimmed.toLowerCase())) return; // no dupes
    appExceptions.push(trimmed);
    renderExceptionTags();
}

// ── Load / Save ───────────────────────────────────────────────────────────────

async function loadSettings() {
    currentSettings = await window.electronAPI.invoke('get-settings');

    setSlider('breakIntervalSlider',  'breakIntervalVal',  'breakInterval',  currentSettings.breakInterval);
    setSlider('breakDurationSlider',  'breakDurationVal',  'breakDuration',  currentSettings.breakDuration);
    setSlider('postponeDurationSlider','postponeDurationVal','postponeDuration', currentSettings.postponeDuration);

    document.getElementById('soundEnabled').checked   = currentSettings.soundEnabled;
    document.getElementById('autoStart').checked      = currentSettings.autoStart;
    document.getElementById('reminderMessage').value  = currentSettings.reminderMessage || '';

    const whEnabled = currentSettings.workingHoursEnabled || false;
    document.getElementById('workingHoursEnabled').checked = whEnabled;
    document.getElementById('workingHoursStart').value = currentSettings.workingHoursStart || '09:00';
    document.getElementById('workingHoursEnd').value   = currentSettings.workingHoursEnd   || '18:00';
    toggleWorkingHoursFields(whEnabled);

    // Background
    const mode = currentSettings.backgroundMode || 'default';
    switchBgMode(mode);

    document.getElementById('gradientStart').value = currentSettings.gradientStart || '#0a0e27';
    document.getElementById('gradientEnd').value   = currentSettings.gradientEnd   || '#0d2137';
    setSlider('gradientAngleSlider', 'gradientAngleVal', 'gradientAngle',
              currentSettings.gradientAngle != null ? currentSettings.gradientAngle : 135);
    updateGradientPreview();

    await reloadImages();

    // App exceptions
    appExceptions = Array.isArray(currentSettings.appExceptions) ? [...currentSettings.appExceptions] : [];
    renderExceptionTags();
}

function toggleWorkingHoursFields(enabled) {
    const fields = document.getElementById('workingHoursFields');
    fields.style.opacity = enabled ? '1' : '0.4';
    fields.querySelectorAll('input').forEach(el => el.disabled = !enabled);
}

async function saveSettings() {
    const newSettings = {
        breakInterval:       parseInt(document.getElementById('breakInterval').value),
        breakDuration:       parseInt(document.getElementById('breakDuration').value),
        postponeDuration:    parseInt(document.getElementById('postponeDuration').value),
        soundEnabled:        document.getElementById('soundEnabled').checked,
        autoStart:           document.getElementById('autoStart').checked,
        reminderMessage:     document.getElementById('reminderMessage').value.trim(),
        workingHoursEnabled: document.getElementById('workingHoursEnabled').checked,
        workingHoursStart:   document.getElementById('workingHoursStart').value,
        workingHoursEnd:     document.getElementById('workingHoursEnd').value,
        backgroundMode:      document.getElementById('backgroundMode').value,
        gradientStart:       document.getElementById('gradientStart').value,
        gradientEnd:         document.getElementById('gradientEnd').value,
        gradientAngle:       parseInt(document.getElementById('gradientAngle').value),
        backgroundImages:    loadedImages.map(i => i.fname),
        appExceptions:       [...appExceptions]
    };

    if (newSettings.workingHoursEnabled) {
        const [sh, sm] = newSettings.workingHoursStart.split(':').map(Number);
        const [eh, em] = newSettings.workingHoursEnd.split(':').map(Number);
        if (sh * 60 + sm >= eh * 60 + em) {
            alert('Working hours end time must be after start time.');
            return;
        }
    }

    try {
        const result = await window.electronAPI.invoke('save-settings', newSettings);
        if (result) {
            const saveBtn = document.getElementById('saveBtn');
            saveBtn.textContent = 'Saved!';
            saveBtn.classList.add('saved');
            setTimeout(() => {
                saveBtn.textContent = 'Save';
                saveBtn.classList.remove('saved');
                window.close();
            }, 900);
        }
    } catch (error) {
        console.error('Failed to save settings:', error);
        alert('Failed to save settings. Please try again.');
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    bindSlider('breakIntervalSlider',   'breakIntervalVal',   'breakInterval');
    bindSlider('breakDurationSlider',   'breakDurationVal',   'breakDuration');
    bindSlider('postponeDurationSlider','postponeDurationVal','postponeDuration');

    // Gradient slider
    const angleSlider = document.getElementById('gradientAngleSlider');
    angleSlider.addEventListener('input', () => {
        document.getElementById('gradientAngleVal').textContent = angleSlider.value;
        document.getElementById('gradientAngle').value = angleSlider.value;
        updateGradientPreview();
    });
    document.getElementById('gradientStart').addEventListener('input', updateGradientPreview);
    document.getElementById('gradientEnd').addEventListener('input', updateGradientPreview);

    // Background mode tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchBgMode(btn.dataset.mode));
    });

    // Image upload
    const fileInput = document.getElementById('imageFileInput');
    document.getElementById('uploadImagesBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        const files = Array.from(fileInput.files).map(f => f.path);
        if (files.length === 0) return;
        const result = await window.electronAPI.invoke('upload-background-images', files);
        if (result.error) { alert(result.error); return; }
        await reloadImages();
        fileInput.value = '';
    });

    // Working hours toggle
    document.getElementById('workingHoursEnabled').addEventListener('change', (e) => {
        toggleWorkingHoursFields(e.target.checked);
    });

    // App exceptions
    const exInput = document.getElementById('exceptionInput');
    document.getElementById('addExceptionBtn').addEventListener('click', () => {
        addException(exInput.value);
        exInput.value = '';
        exInput.focus();
    });
    exInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addException(exInput.value);
            exInput.value = '';
        }
    });

    document.getElementById('saveBtn').addEventListener('click', saveSettings);
    document.getElementById('cancelBtn').addEventListener('click', () => window.close());

    loadSettings();
});
