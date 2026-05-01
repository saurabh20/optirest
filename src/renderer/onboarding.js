let currentStep = 1;
const TOTAL_STEPS = 5;
let chosenInterval = 20;
let chosenAutoStart = true;

const stepLabels = ['', 'Get Started →', 'Next →', 'Next →', 'Next →', 'Start OptiRest 🚀'];

function goTo(n) {
    document.getElementById(`step${currentStep}`).classList.remove('active', 'exit');
    document.getElementById(`step${currentStep}`).classList.add('exit');

    setTimeout(() => {
        document.getElementById(`step${currentStep}`).classList.remove('exit');
    }, 300);

    currentStep = n;
    const step = document.getElementById(`step${currentStep}`);
    step.classList.add('active');

    // Dots
    document.querySelectorAll('.dot').forEach((d, i) => {
        d.classList.toggle('active', i < currentStep);
    });

    // Back button
    document.getElementById('backBtn').style.visibility = currentStep > 1 ? 'visible' : 'hidden';

    // Next button label
    document.getElementById('nextBtn').textContent = stepLabels[currentStep];

    // Step 5: populate summary
    if (currentStep === 5) buildSummary();
}

function buildSummary() {
    document.getElementById('firstBreakIn').textContent = chosenInterval;
    document.getElementById('summaryBox').innerHTML = `
        <div class="summary-row">
            <span>⏱️ Break every</span><strong>${chosenInterval} minutes</strong>
        </div>
        <div class="summary-row">
            <span>🚀 Start at login</span><strong>${chosenAutoStart ? 'Yes' : 'No'}</strong>
        </div>
        <div class="summary-row">
            <span>⏳ Break duration</span><strong>20 seconds</strong>
        </div>
    `;
}

async function finish() {
    document.getElementById('nextBtn').disabled = true;
    document.getElementById('nextBtn').textContent = 'Launching…';

    await window.electronAPI.invoke('complete-onboarding', {
        autoStart: chosenAutoStart,
        breakInterval: chosenInterval
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Interval slider
    const slider = document.getElementById('intervalSlider');
    slider.addEventListener('input', () => {
        chosenInterval = parseInt(slider.value);
        document.getElementById('intervalValue').textContent = chosenInterval;
    });

    // Auto-start choice cards
    document.getElementById('choiceYes').addEventListener('click', () => {
        chosenAutoStart = true;
        document.getElementById('choiceYes').classList.add('selected');
        document.getElementById('choiceNo').classList.remove('selected');
    });
    document.getElementById('choiceNo').addEventListener('click', () => {
        chosenAutoStart = false;
        document.getElementById('choiceNo').classList.add('selected');
        document.getElementById('choiceYes').classList.remove('selected');
    });

    // Navigation
    document.getElementById('nextBtn').addEventListener('click', () => {
        if (currentStep < TOTAL_STEPS) {
            goTo(currentStep + 1);
        } else {
            finish();
        }
    });

    document.getElementById('backBtn').addEventListener('click', () => {
        if (currentStep > 1) goTo(currentStep - 1);
    });
});
