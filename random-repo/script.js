// ── Particles ──
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function createParticle() {
    return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.4,
        speedY: (Math.random() - 0.5) * 0.4,
        opacity: Math.random() * 0.5 + 0.1,
    };
}

for (let i = 0; i < 50; i++) particles.push(createParticle());

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const color = isDark ? '63, 185, 80' : '35, 134, 54';

    particles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0 || p.x > canvas.width) p.speedX *= -1;
        if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${p.opacity * 0.4})`;
        ctx.fill();
    });

    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.strokeStyle = `rgba(${color}, ${(1 - dist / 120) * 0.08})`;
                ctx.stroke();
            }
        }
    }

    requestAnimationFrame(animateParticles);
}
animateParticles();

// ── Theme ──
const themeToggle = document.getElementById('themeToggle');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
let currentTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}
setTheme(currentTheme);

themeToggle.addEventListener('click', () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(currentTheme);
});

// ── DOM refs ──
const redirectBtn = document.getElementById('redirectBtn');
const diceEl = document.getElementById('dice');
const statusEl = document.getElementById('status');
const statusText = statusEl.querySelector('.status-text');

let cachedRepos = null;

// ── Dice rotations ──
// Maps value 1-6 to the rotation that brings that cube face to the viewer
const faceRotations = {
    1: { x: 0,   y: -90 },  // right face
    2: { x: 0,   y: 90 },   // left face
    3: { x: -90, y: 0 },    // top face
    4: { x: 90,  y: 0 },    // bottom face
    5: { x: 0,   y: 0 },    // front face
    6: { x: 0,   y: 180 },  // back face
};

let spinCount = 0;

function rollDice() {
    const value = Math.floor(Math.random() * 6) + 1;
    const { x, y } = faceRotations[value];
    spinCount++;
    // Accumulate full spins so the dice always rotates forward
    diceEl.style.transform = `rotateX(${x + 360 * spinCount}deg) rotateY(${y + 360 * spinCount}deg)`;
    return value;
}

function resetDice() {
    diceEl.style.transition = 'none';
    diceEl.style.transform = 'rotateX(0deg) rotateY(0deg)';
    spinCount = 0;
    diceEl.offsetHeight; // force reflow
    diceEl.style.transition = '';
}

// ── Auto-roll every 3 seconds ──
let autoRollTimer = null;

function startAutoRoll() {
    stopAutoRoll();
    autoRollTimer = setInterval(rollDice, 3000);
}

function stopAutoRoll() {
    if (autoRollTimer) {
        clearInterval(autoRollTimer);
        autoRollTimer = null;
    }
}

// Show a random face immediately on load (no animation)
(function initDice() {
    const value = Math.floor(Math.random() * 6) + 1;
    const { x, y } = faceRotations[value];
    spinCount = 1;
    diceEl.style.transition = 'none';
    diceEl.style.transform = `rotateX(${x + 360}deg) rotateY(${y + 360}deg)`;
    diceEl.offsetHeight; // force reflow
    diceEl.style.transition = '';
})();
startAutoRoll();

// ── Status helpers ──
function setStatus(text, isError = false) {
    statusText.textContent = text;
    statusEl.classList.toggle('error', isError);
    statusEl.classList.toggle('visible', !!text);
    statusEl.querySelector('.spinner').style.display = isError ? 'none' : '';
}

// ── Redirect logic ──
async function redirectToRandomRepo(minStars = 100, pageSize = 100) {
    const API_URL = `https://api.github.com/search/repositories?q=stars:>${minStars}&sort=stars&order=desc&per_page=${pageSize}`;
    const CACHE_KEY = `gh_repos_${minStars}`;
    const CACHE_TTL = 3600000;

    try {
        stopAutoRoll();
        redirectBtn.classList.add('loading-btn');
        resetDice();
        diceEl.classList.add('rolling');
        setStatus('Discovering...');

        const cached = sessionStorage.getItem(CACHE_KEY);
        let repos = cached ? JSON.parse(cached).data : null;

        if (cached) {
            const cacheData = JSON.parse(cached);
            if (Date.now() - cacheData.timestamp > CACHE_TTL) repos = null;
        }

        if (!repos) {
            setStatus('Fetching repos...');
            const response = await fetch(API_URL, {
                headers: { 'Accept': 'application/vnd.github.v3+json' }
            });

            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            const data = await response.json();
            repos = data.items;

            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: repos
            }));
        }

        cachedRepos = repos;

        if (repos?.length > 0) {
            diceEl.classList.remove('rolling');
            rollDice();
            setStatus('Redirecting...');
            const randomRepo = repos[Math.floor(Math.random() * repos.length)];
            setTimeout(() => location.replace(randomRepo.html_url), 700);
            return;
        }

        throw new Error('No repositories found');

    } catch (error) {
        console.error('Redirect failed:', error);
        diceEl.classList.remove('rolling');
        rollDice();
        startAutoRoll();
        redirectBtn.classList.remove('loading-btn');
        setStatus(error.message, true);
        redirectBtn.textContent = 'Try Again';
    }
}

redirectBtn.addEventListener('click', () => {
    stopAutoRoll();
    if (cachedRepos?.length > 0) {
        resetDice();
        diceEl.classList.add('rolling');
        setStatus('Rolling...');
        redirectBtn.classList.add('loading-btn');
        setTimeout(() => {
            diceEl.classList.remove('rolling');
            rollDice();
            setTimeout(() => {
                const randomRepo = cachedRepos[Math.floor(Math.random() * cachedRepos.length)];
                location.replace(randomRepo.html_url);
            }, 700);
        }, 600);
    } else {
        redirectToRandomRepo();
    }
});

// Auto redirect on load
window.addEventListener('DOMContentLoaded', () => {
    redirectToRandomRepo();
});
