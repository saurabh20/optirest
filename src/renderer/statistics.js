let statsData = {};

// ── Statistics ────────────────────────────────────────────────────────────────

async function loadStatistics() {
    try {
        statsData = await window.electronAPI.invoke('get-statistics');

        document.getElementById('totalBreaks').textContent     = statsData.totalBreaks     || 0;
        document.getElementById('completedBreaks').textContent = statsData.completedBreaks || 0;
        document.getElementById('skippedBreaks').textContent   = statsData.skippedBreaks   || 0;

        const rate = statsData.totalBreaks > 0
            ? Math.round((statsData.completedBreaks / statsData.totalBreaks) * 100) : 0;
        document.getElementById('complianceRate').textContent = `${rate}%`;

        if (statsData.lastBreakTime) {
            document.getElementById('lastBreakTime').textContent =
                getTimeAgo(new Date(statsData.lastBreakTime));
        }

        createWeeklyChart(statsData.dailyStats || {});
    } catch (err) {
        console.error('Failed to load statistics:', err);
    }
}

function getTimeAgo(date) {
    const m = Math.floor((Date.now() - date) / 60000);
    if (m < 1)    return 'Just now';
    if (m < 60)   return `${m} minute${m > 1 ? 's' : ''} ago`;
    if (m < 1440) { const h = Math.floor(m/60); return `${h} hour${h>1?'s':''} ago`; }
    const d = Math.floor(m/1440); return `${d} day${d>1?'s':''} ago`;
}

function createWeeklyChart(dailyStats) {
    const canvas = document.getElementById('weekChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const labels = [], completed = [], skipped = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        const day = dailyStats[d.toDateString()] || {};
        completed.push(day.completed || 0);
        skipped.push(day.skipped    || 0);
    }
    new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Completed', data: completed, backgroundColor: '#4CAF50', borderRadius: 4 },
                { label: 'Skipped',   data: skipped,   backgroundColor: '#f44336', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

// ── Share platform logic ──────────────────────────────────────────────────────

const HASHTAGS = '#EyeCare #ProtectYourEyes #HealthyVision #DigitalEyeStrain #EyeHealthMatters #VisionCare #ScreenFatigue #EyeWellness';
const SITE_URL = 'https://www.blogsaays.com';

function getStats() {
    const total     = statsData.totalBreaks     || 0;
    const completed = statsData.completedBreaks || 0;
    const skipped   = statsData.skippedBreaks   || 0;
    const rate      = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, skipped, rate };
}

/**
 * Format text per platform.
 * X:        ≤280 chars (URL counts as 23 by Twitter t.co wrapping)
 * WhatsApp: supports *bold*, no limit, full detail
 * Facebook: plain text, post copied to clipboard; sharer opens URL
 * TikTok:   caption + TikTok hashtags, copied to clipboard
 */
function formatText(platform) {
    const { total, completed, skipped, rate } = getStats();

    switch (platform) {
        case 'x':
            // Keep well under 280. URL (blogsaays.com) counts as 23 via t.co.
            return (
                `👁️ OptiRest Eye Stats\n` +
                `✅ ${completed} done · ⏭️ ${skipped} skipped · 📊 ${rate}% compliance\n\n` +
                `${HASHTAGS}\n` +
                `${SITE_URL}`
            );

        case 'whatsapp':
            return (
                `👁️ *My OptiRest Eye Health Stats*\n\n` +
                `✅ ${completed} breaks completed\n` +
                `⏭️ ${skipped} breaks skipped\n` +
                `📊 ${rate}% compliance rate\n` +
                `👀 ${total} total breaks tracked\n\n` +
                `Protect your eyes with the 20-20-20 rule 👇\n` +
                `${SITE_URL}\n\n` +
                `${HASHTAGS}`
            );

        case 'facebook':
            // Facebook sharer doesn't accept arbitrary text via URL params reliably.
            // Copy text to clipboard; sharer opens blogsaays.com for OG preview.
            return (
                `👁️ My OptiRest Eye Health Stats\n\n` +
                `✅ ${completed} breaks completed\n` +
                `⏭️ ${skipped} breaks skipped\n` +
                `📊 ${rate}% compliance rate\n\n` +
                `${HASHTAGS}`
            );

        case 'tiktok':
            // TikTok captions support hashtags; no web share URL — clipboard only
            return (
                `Protecting my eyes with the 20-20-20 rule! 👁️✨\n\n` +
                `✅ ${completed} eye breaks completed\n` +
                `📊 ${rate}% compliance rate\n\n` +
                `Try OptiRest 👇 ${SITE_URL}\n\n` +
                `${HASHTAGS} #EyeTok #HealthTok #EyeHealth #20_20_20Rule`
            );
    }
}

function getShareUrl(platform, text) {
    const enc = encodeURIComponent(text);
    switch (platform) {
        case 'x':
            return `https://x.com/intent/tweet?text=${enc}`;
        case 'whatsapp':
            // wa.me works on both desktop (opens WhatsApp Web) and mobile
            return `https://wa.me/?text=${enc}`;
        case 'facebook':
            // Sharer with u= opens OG preview of the page; text goes to clipboard
            return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE_URL)}`;
        case 'tiktok':
            return null; // No public web share endpoint — clipboard only
    }
}

async function executeShare(platform) {
    const text = formatText(platform);
    const url  = getShareUrl(platform, text);
    const feedback = document.getElementById('shareFeedback');

    // Always copy text to clipboard
    await window.electronAPI.invoke('copy-to-clipboard', text);

    if (url) {
        await window.electronAPI.invoke('open-external', url);
    }

    const messages = {
        x:         '✓ Opened X. Tweet text copied to clipboard as fallback.',
        whatsapp:  '✓ Opened WhatsApp Web with your message.',
        facebook:  '✓ Opened Facebook. Stats copied to clipboard — paste in your post.',
        tiktok:    '✓ Caption copied to clipboard. Open TikTok and paste in your video caption.'
    };

    feedback.textContent = messages[platform] || '✓ Done';
    feedback.className   = 'share-feedback visible';

    // Auto-close modal after a beat
    if (platform !== 'tiktok') {
        setTimeout(() => closeShareModal(), 1800);
    }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openShareModal() {
    const { completed, skipped, rate } = getStats();
    document.getElementById('sharePreview').textContent =
        `✅ ${completed} completed · ⏭️ ${skipped} skipped · 📊 ${rate}% compliance`;
    document.getElementById('shareFeedback').className = 'share-feedback';
    document.getElementById('shareModal').classList.add('visible');
}

function closeShareModal() {
    document.getElementById('shareModal').classList.remove('visible');
}

function showToast(msg) {
    const t = document.getElementById('shareToast');
    t.textContent = msg;
    t.classList.add('visible');
    setTimeout(() => t.classList.remove('visible'), 3500);
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('shareBtn').addEventListener('click', openShareModal);
    document.getElementById('closeModal').addEventListener('click', closeShareModal);

    // Close on backdrop click
    document.getElementById('shareModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('shareModal')) closeShareModal();
    });

    // Platform buttons
    document.querySelectorAll('.platform-btn').forEach(btn => {
        btn.addEventListener('click', () => executeShare(btn.dataset.platform));
    });

    loadStatistics();
});
