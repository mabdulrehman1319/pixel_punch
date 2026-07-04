// ── Prevent dropdown parent links (#) from jumping to page top ──
document.addEventListener('click', (e) => {
    const link = e.target.closest('a.has-dropdown');
    if (link && link.getAttribute('href') === '#') {
        e.preventDefault();
    }
});

// ──────────────────────────────────────────────
// AUTH HELPERS
// ──────────────────────────────────────────────

function showAuthMessage(message, type) {
    const el = document.getElementById('authMessage');
    if (!el) return;
    el.textContent = message;
    el.className = `auth-message ${type}`;
    el.style.display = 'block';
    if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ── REGISTER FORM ──
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username        = document.getElementById('regUsername').value.trim();
        const email           = document.getElementById('regEmail').value.trim();
        const password        = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;

        if (password !== confirmPassword) {
            showAuthMessage('Passwords do not match.', 'error');
            return;
        }
        if (password.length < 6) {
            showAuthMessage('Password must be at least 6 characters.', 'error');
            return;
        }

        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Creating Account...';

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, email, password })
            });

            const result = await response.json();

            if (response.ok) {
                localStorage.setItem('pp_username', result.username);
                localStorage.setItem('pp_user_id', result.user_id);
                showAuthMessage('Account created! Redirecting...', 'success');
                localStorage.setItem('pp_banner', JSON.stringify({
                    type: 'register',
                    message: `🎉 Welcome to Pixel Punch, ${result.username}! Your account has been created successfully.`
                }));
                setTimeout(() => { window.location.href = 'index.html'; }, 1500);
            } else {
                showAuthMessage(result.error || 'Registration failed.', 'error');
            }

        } catch (err) {
            showAuthMessage('Could not connect to server. Make sure Flask is running.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    });
}

// ── LOGIN FORM ──
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Logging in...';

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();

            if (response.ok) {
                localStorage.setItem('pp_username', result.username);
                localStorage.setItem('pp_user_id', result.user_id);
                showAuthMessage(`✅ Welcome back, ${result.username}! Redirecting...`, 'success');
                const redirect = localStorage.getItem('pp_redirect') || 'index.html';
                localStorage.removeItem('pp_redirect');
                setTimeout(() => { window.location.href = redirect; }, 1500);
            } else {
                showAuthMessage('❌ ' + (result.error || 'Invalid username or password.'), 'error');
            }

        } catch (err) {
            showAuthMessage('Could not connect to server. Make sure Flask is running.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Login';
        }
    });
}

// ── LOGOUT BUTTON (works on any page) ──
document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'logoutBtn') {
        try {
            await fetch('/api/logout', { method: 'POST', credentials: 'include' });
        } catch (_) {}
        localStorage.removeItem('pp_username');
        localStorage.removeItem('pp_user_id');
        localStorage.removeItem('pp_theme');
        localStorage.removeItem('pp_default_game');
        localStorage.setItem('pp_banner', JSON.stringify({
            type: 'logout',
            message: '👋 You have been logged out. See you next time!'
        }));
        window.location.href = 'index.html';
    }
});

// ──────────────────────────────────────────────
// HARDWARE PROFILES (benchmark page)
// ──────────────────────────────────────────────

async function initProfiles() {
    const profileSection     = document.getElementById('profileSection');
    const saveProfileSection = document.getElementById('saveProfileSection');
    if (!profileSection) return;

    // Only show profile UI if user is logged in
    const username = localStorage.getItem('pp_username');
    if (!username) return;

    profileSection.style.display     = 'block';
    saveProfileSection.style.display = 'block';

    await loadProfileDropdown();
}

async function loadProfileDropdown() {
    try {
        const response = await fetch('/api/profiles', { credentials: 'include' });
        if (!response.ok) return;

        const data     = await response.json();
        const dropdown = document.getElementById('profileDropdown');
        if (!dropdown) return;

        // Clear existing options except placeholder
        dropdown.innerHTML = '<option value="">-- Select a profile --</option>';

        data.profiles.forEach(p => {
            const opt   = document.createElement('option');
            opt.value   = p.profile_id;
            opt.dataset.cpu      = p.cpu_name;
            opt.dataset.cpuSpeed = p.cpu_speed;
            opt.dataset.ram      = p.ram;
            opt.dataset.gpu      = p.gpu_name;
            opt.dataset.gpuMem   = p.gpu_memory;
            opt.textContent = `${p.profile_name} — ${p.cpu_name} / ${p.gpu_name} / ${p.ram}GB RAM`;
            dropdown.appendChild(opt);
        });

    } catch (err) {
        console.log('Could not load profiles:', err);
    }
}

function showProfileMsg(elId, message, type) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent  = message;
    el.style.color  = type === 'success' ? '#4ade80' : '#f87171';
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// Load Profile button
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'loadProfileBtn') {
        const dropdown = document.getElementById('profileDropdown');
        const selected = dropdown.options[dropdown.selectedIndex];
        if (!selected || !selected.value) {
            showProfileMsg('profileMessage', 'Please select a profile first.', 'error');
            return;
        }

        // Map RAM value to nearest select option
        const ramMap = { 4: '4', 8: '8', 16: '16', 32: '32' };
        const gpuMap = { 1: '1', 2: '2', 4: '4', 8: '8', 12: '12', 16: '16' };

        // Auto-fill the form fields
        const cpuSelect = document.getElementById('cpuName');
        const ramSelect = document.getElementById('ramSize');
        const gpuMemSelect = document.getElementById('gpuMemory');

        // Set CPU dropdown
        Array.from(cpuSelect.options).forEach(opt => {
            if (opt.value === selected.dataset.cpu) cpuSelect.value = opt.value;
        });

        document.getElementById('cpuSpeed').value  = selected.dataset.cpuSpeed;
        ramSelect.value                             = ramMap[parseInt(selected.dataset.ram)] || '';
        document.getElementById('gpuName').value   = selected.dataset.gpu;
        gpuMemSelect.value                          = gpuMap[parseInt(selected.dataset.gpuMem)] || '';

        showProfileMsg('profileMessage', `✓ Profile loaded! Select a game and run benchmark.`, 'success');
    }
});

// Delete Profile button
document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'deleteProfileBtn') {
        const dropdown  = document.getElementById('profileDropdown');
        const profileId = dropdown.value;
        if (!profileId) {
            showProfileMsg('profileMessage', 'Please select a profile to delete.', 'error');
            return;
        }
        const profileName = dropdown.options[dropdown.selectedIndex].textContent.split('—')[0].trim();
        if (!confirm(`Delete profile "${profileName}"?`)) return;

        try {
            const response = await fetch(`/api/profiles/${profileId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const result = await response.json();
            if (response.ok) {
                showProfileMsg('profileMessage', '✓ Profile deleted.', 'success');
                await loadProfileDropdown();
            } else {
                showProfileMsg('profileMessage', result.error || 'Delete failed.', 'error');
            }
        } catch (err) {
            showProfileMsg('profileMessage', 'Could not connect to server.', 'error');
        }
    }
});

// Save Profile button
document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'saveProfileBtn') {
        const profileName = (document.getElementById('profileNameInput').value || '').trim();
        const cpuName     = document.getElementById('cpuName').value;
        const cpuSpeed    = parseFloat(document.getElementById('cpuSpeed').value);
        const ram         = parseInt(document.getElementById('ramSize').value);
        const gpuName     = document.getElementById('gpuName').value;
        const gpuMemory   = parseInt(document.getElementById('gpuMemory').value);

        if (!profileName) {
            showProfileMsg('saveProfileMessage', 'Please enter a profile name.', 'error');
            return;
        }
        if (!cpuName || !cpuSpeed || !ram || !gpuName || !gpuMemory) {
            showProfileMsg('saveProfileMessage', 'Please fill in all specs before saving.', 'error');
            return;
        }

        try {
            const response = await fetch('/api/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ profile_name: profileName, cpu_name: cpuName, cpu_speed: cpuSpeed, ram, gpu_name: gpuName, gpu_memory: gpuMemory })
            });
            const result = await response.json();
            if (response.ok) {
                showProfileMsg('saveProfileMessage', `✓ ${result.message}`, 'success');
                document.getElementById('profileNameInput').value = '';
                await loadProfileDropdown();
            } else {
                showProfileMsg('saveProfileMessage', result.error || 'Save failed.', 'error');
            }
        } catch (err) {
            showProfileMsg('saveProfileMessage', 'Could not connect to server.', 'error');
        }
    }
});

// Initialise profiles when benchmark page loads
if (document.getElementById('benchmarkForm')) {
    initProfiles();
}

// ──────────────────────────────────────────────
// BENCHMARK FORM SUBMIT
// ──────────────────────────────────────────────

let charts = {
    fps: null,
    temp: null,
    usage: null
};

// Check if we're on the benchmark page
if (document.getElementById('benchmarkForm')) {
    document.getElementById('benchmarkForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        // Check login before submitting
        const username = localStorage.getItem('pp_username');
        if (!username) {
            alert('You must be logged in to run a benchmark.\nRedirecting to login page...');
            window.location.href = 'login.html';
            return;
        }
        
        const formData = {
            cpu_name: document.getElementById('cpuName').value,
            cpu_speed: parseFloat(document.getElementById('cpuSpeed').value),
            ram_size: parseInt(document.getElementById('ramSize').value),
            gpu_name: document.getElementById('gpuName').value,
            gpu_memory: parseInt(document.getElementById('gpuMemory').value),
            game: document.getElementById('gameSelect').value
        };

        // Disable submit button and show loading
        document.getElementById('submitBtn').disabled = true;
        document.getElementById('loadingIndicator').classList.add('active');

        try {
            // Backend API call
            const response = await fetch('/api/benchmark', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            // Handle not logged in
            if (response.status === 401) {
                alert('Session expired. Please log in again.');
                window.location.href = 'login.html';
                return;
            }

            if (!response.ok) {
                throw new Error('Benchmark analysis failed');
            }

            const results = await response.json();
            
            // Store results in localStorage
            localStorage.setItem('benchmarkResults', JSON.stringify(results));
            localStorage.setItem('benchmarkSpecs', JSON.stringify(formData));
            
            // Redirect to results page
            window.location.href = 'result.html';
            
        } catch (error) {
            console.error('Error:', error);
            alert('Error connecting to backend. Using demo data for demonstration purposes.');
            
            // Demo data for testing frontend
            const demoResults = {
                fps: {
                    min: 58,
                    max: 144,
                    avg: 98
                },
                usage: {
                    cpu: 72,
                    gpu: 95,
                    ram: 68
                },
                temperature: {
                    avg_cpu: 65,
                    avg_gpu: 72,
                    max_cpu: 78,
                    max_gpu: 81
                }
            };
            
            // Store demo results
            localStorage.setItem('benchmarkResults', JSON.stringify(demoResults));
            localStorage.setItem('benchmarkSpecs', JSON.stringify(formData));
            
            // Redirect to results page
            window.location.href = 'result.html';
        } finally {
            document.getElementById('submitBtn').disabled = false;
            document.getElementById('loadingIndicator').classList.remove('active');
        }
    });
}

// Check if we're on the results page
if (document.getElementById('resultsContainer')) {
    document.addEventListener('DOMContentLoaded', () => {
        const results = localStorage.getItem('benchmarkResults');
        const specs = localStorage.getItem('benchmarkSpecs');
        
        if (results && specs) {
            displayResults(JSON.parse(results), JSON.parse(specs));
        } else {
            document.getElementById('noResults').style.display = 'block';
            document.getElementById('resultsContainer').style.display = 'none';
        }
    });
}

// Check if we're on the comments page
if (document.getElementById('historySection') && document.getElementById('notLoggedIn')) {
    const username = localStorage.getItem('pp_username');
    if (!username) {
        document.getElementById('notLoggedIn').style.display = 'block';
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            loadBenchmarkHistory();
        });
    }
}

async function loadBenchmarkHistory() {
    const historySection = document.getElementById('historySection');
    const historyList    = document.getElementById('historyList');
    if (!historySection || !historyList) return;

    try {
        const response = await fetch('/api/benchmark/history', { credentials: 'include' });
        if (!response.ok) return;

        const data = await response.json();
        if (!data.history || data.history.length === 0) {
            const noHistory = document.getElementById('noHistory');
            if (noHistory) noHistory.style.display = 'block';
            return;
        }

        historySection.style.display = 'block';

        // Render each history card with a placeholder for comments
        historyList.innerHTML = data.history.map(item => `
            <div class="spec-display" style="margin-bottom:1.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                    <h3 style="margin:0; color:#c77dff;">${item.game}</h3>
                    <span style="font-size:0.85rem; color:#9d4edd;">${new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <div class="spec-grid" style="margin-top:1rem;">
                    <div class="spec-item">
                        <div class="spec-label">CPU</div>
                        <div class="spec-value">${item.cpu}</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">GPU</div>
                        <div class="spec-value">${item.gpu}</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">RAM</div>
                        <div class="spec-value">${item.ram} GB</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Avg FPS</div>
                        <div class="spec-value">${item.fps.avg} FPS</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Min / Max FPS</div>
                        <div class="spec-value">${item.fps.min} / ${item.fps.max}</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">GPU Usage</div>
                        <div class="spec-value">${item.usage.gpu}%</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">CPU Usage</div>
                        <div class="spec-value">${item.usage.cpu}%</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Avg Temp</div>
                        <div class="spec-value">${item.temperature.avg}°C</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Peak Temp</div>
                        <div class="spec-value">${item.temperature.peak}°C</div>
                    </div>
                </div>
                <div id="comments_placeholder_${item.result_id}"></div>
            </div>
        `).join('');

        // Load comments for each result and inject into placeholder
        for (const item of data.history) {
            const comments = await loadCommentsForResult(item.result_id);
            const placeholder = document.getElementById(`comments_placeholder_${item.result_id}`);
            if (placeholder) {
                placeholder.innerHTML = buildCommentSection(item.result_id, comments);
            }
        }

    } catch (err) {
        console.log('Could not load history:', err);
    }
}

function displayResults(data, specs) {
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('resultsContainer').classList.add('active');

    // Display specs
    const specGrid = document.getElementById('specGrid');
    specGrid.innerHTML = `
        <div class="spec-item">
            <div class="spec-label">CPU</div>
            <div class="spec-value">${specs.cpu_name}</div>
        </div>
        <div class="spec-item">
            <div class="spec-label">CPU Speed</div>
            <div class="spec-value">${specs.cpu_speed} GHz</div>
        </div>
        <div class="spec-item">
            <div class="spec-label">RAM</div>
            <div class="spec-value">${specs.ram_size} GB</div>
        </div>
        <div class="spec-item">
            <div class="spec-label">GPU</div>
            <div class="spec-value">${specs.gpu_name}</div>
        </div>
        <div class="spec-item">
            <div class="spec-label">GPU Memory</div>
            <div class="spec-value">${specs.gpu_memory} GB</div>
        </div>
        <div class="spec-item">
            <div class="spec-label">Game</div>
            <div class="spec-value">${specs.game}</div>
        </div>
    `;

    // Performance table
    document.getElementById('minFps').textContent = data.fps.min;
    document.getElementById('maxFps').textContent = data.fps.max;
    document.getElementById('avgFps').textContent = data.fps.avg;

    // Resource table
    document.getElementById('cpuUsage').textContent = data.usage.cpu + '%';
    document.getElementById('gpuUsage').textContent = data.usage.gpu + '%';
    document.getElementById('ramUsage').textContent = data.usage.ram + '%';

    // Thermal table
    document.getElementById('avgCpuTemp').textContent = data.temperature.avg_cpu + '°C';
    document.getElementById('avgGpuTemp').textContent = data.temperature.avg_gpu + '°C';
    document.getElementById('maxCpuTemp').textContent = data.temperature.max_cpu + '°C';
    document.getElementById('maxGpuTemp').textContent = data.temperature.max_gpu + '°C';

    // Create charts
    createCharts(data);
}

function createCharts(data) {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                labels: {
                    color: '#c77dff'
                }
            }
        },
        scales: {
            y: {
                ticks: { color: '#9d4edd' },
                grid: { color: 'rgba(123, 44, 191, 0.2)' }
            },
            x: {
                ticks: { color: '#9d4edd' },
                grid: { color: 'rgba(123, 44, 191, 0.2)' }
            }
        }
    };

    // Destroy existing charts if they exist
    if (charts.fps) charts.fps.destroy();
    if (charts.temp) charts.temp.destroy();
    if (charts.usage) charts.usage.destroy();

    // FPS Chart
    const fpsCanvas = document.getElementById('fpsChart');
    if (fpsCanvas) {
        charts.fps = new Chart(fpsCanvas, {
            type: 'bar',
            data: {
                labels: ['Minimum FPS', 'Average FPS', 'Maximum FPS'],
                datasets: [{
                    label: 'Frame Rate',
                    data: [data.fps.min, data.fps.avg, data.fps.max],
                    backgroundColor: [
                        'rgba(123, 44, 191, 0.7)',
                        'rgba(168, 106, 218, 0.7)',
                        'rgba(108, 42, 158, 0.7)'
                    ],
                    borderColor: [
                        'rgba(123, 44, 191, 0.7)',
                        'rgba(168, 106, 218, 0.7)',
                        'rgba(108, 42, 158, 0.7)'
                    ],
                    borderWidth: 2
                }]
            },
            options: chartOptions
        });
    }

    // Temperature Chart
    const tempCanvas = document.getElementById('tempChart');
    if (tempCanvas) {
        charts.temp = new Chart(tempCanvas, {
            type: 'line',
            data: {
                labels: ['Avg CPU', 'Avg GPU', 'Max CPU', 'Max GPU'],
                datasets: [{
                    label: 'Temperature (°C)',
                    data: [
                        data.temperature.avg_cpu,
                        data.temperature.avg_gpu,
                        data.temperature.max_cpu,
                        data.temperature.max_gpu
                    ],
                    backgroundColor: 'rgba(199, 125, 255, 0.2)',
                    borderColor: 'rgba(199, 125, 255, 1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: chartOptions
        });
    }

    // Usage Chart
    const usageCanvas = document.getElementById('usageChart');
    if (usageCanvas) {
        charts.usage = new Chart(usageCanvas, {
            type: 'doughnut',
            data: {
                labels: ['CPU Usage', 'GPU Usage', 'RAM Usage'],
                datasets: [{
                    label: 'Usage (%)',
                    data: [data.usage.cpu, data.usage.gpu, data.usage.ram],
                    backgroundColor: [
                        'rgba(123, 44, 191, 0.7)',
                        'rgba(157, 78, 221, 0.7)',
                        'rgba(199, 125, 255, 0.7)'
                    ],
                    borderColor: [
                        'rgba(123, 44, 191, 1)',
                        'rgba(157, 78, 221, 1)',
                        'rgba(199, 125, 255, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#c77dff'
                        }
                    }
                }
            }
        });
    }
}
// ──────────────────────────────────────────────
// BENCHMARK COMPARISONS PAGE
// ──────────────────────────────────────────────

if (document.getElementById('compareBtn')) {
    const username = localStorage.getItem('pp_username');
    if (!username) {
        document.getElementById('notLoggedIn').style.display = 'block';
        document.getElementById('compareUI').style.display   = 'none';
    } else {
        initComparePage();
    }
}

async function initComparePage() {
    await populateResultDropdowns();
    await loadPastComparisons();

    document.getElementById('compareBtn').addEventListener('click', async () => {
        const idA = document.getElementById('resultA').value;
        const idB = document.getElementById('resultB').value;

        if (!idA || !idB) {
            showCompareMsg('Please select two results.', 'error');
            return;
        }
        if (idA === idB) {
            showCompareMsg('Please select two different results.', 'error');
            return;
        }

        const btn = document.getElementById('compareBtn');
        btn.disabled    = true;
        btn.textContent = 'Comparing...';

        try {
            const response = await fetch('/api/compare', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ result_id_a: parseInt(idA), result_id_b: parseInt(idB) })
            });
            const data = await response.json();

            if (!response.ok) {
                showCompareMsg(data.error || 'Comparison failed.', 'error');
                return;
            }

            renderComparison(data.result_a, data.result_b);
            showSaveMsg('✓ Comparison saved to database!', 'success');
            await loadPastComparisons();

        } catch (err) {
            showCompareMsg('Could not connect to server.', 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Compare Now';
        }
    });
}

async function populateResultDropdowns() {
    try {
        const response = await fetch('/api/benchmark/history', { credentials: 'include' });
        if (!response.ok) return;

        const data = await response.json();
        if (!data.history || data.history.length === 0) {
            showCompareMsg('No benchmark results found. Run some benchmarks first!', 'error');
            return;
        }

        const selectA = document.getElementById('resultA');
        const selectB = document.getElementById('resultB');

        data.history.forEach(item => {
            const label = `#${item.result_id} — ${item.game} | Avg ${item.fps.avg} FPS | ${new Date(item.timestamp).toLocaleDateString()}`;
            [selectA, selectB].forEach(sel => {
                const opt   = document.createElement('option');
                opt.value   = item.result_id;
                opt.textContent = label;
                sel.appendChild(opt);
            });
        });

    } catch (err) {
        console.log('Could not load results for compare:', err);
    }
}

function renderComparison(a, b) {
    document.getElementById('comparisonResult').style.display = 'block';
    document.getElementById('comparisonResult').scrollIntoView({ behavior: 'smooth' });

    // Update column headers
    document.getElementById('colA').textContent = `A: ${a.game}`;
    document.getElementById('colB').textContent = `B: ${b.game}`;

    // Header cards
    document.getElementById('headerA').innerHTML = buildHeaderCard(a);
    document.getElementById('headerB').innerHTML = buildHeaderCard(b);

    // Build comparison rows
    const metrics = [
        { label: 'Game',        va: a.game,              vb: b.game,              higherBetter: null },
        { label: 'CPU',         va: a.cpu,               vb: b.cpu,               higherBetter: null },
        { label: 'GPU',         va: a.gpu,               vb: b.gpu,               higherBetter: null },
        { label: 'RAM',         va: `${a.ram} GB`,       vb: `${b.ram} GB`,       higherBetter: true,  numA: a.ram,              numB: b.ram },
        { label: 'Min FPS',     va: `${a.fps.min} FPS`,  vb: `${b.fps.min} FPS`,  higherBetter: true,  numA: a.fps.min,          numB: b.fps.min },
        { label: 'Avg FPS',     va: `${a.fps.avg} FPS`,  vb: `${b.fps.avg} FPS`,  higherBetter: true,  numA: a.fps.avg,          numB: b.fps.avg },
        { label: 'Max FPS',     va: `${a.fps.max} FPS`,  vb: `${b.fps.max} FPS`,  higherBetter: true,  numA: a.fps.max,          numB: b.fps.max },
        { label: 'CPU Usage',   va: `${a.usage.cpu}%`,   vb: `${b.usage.cpu}%`,   higherBetter: false, numA: a.usage.cpu,        numB: b.usage.cpu },
        { label: 'GPU Usage',   va: `${a.usage.gpu}%`,   vb: `${b.usage.gpu}%`,   higherBetter: false, numA: a.usage.gpu,        numB: b.usage.gpu },
        { label: 'RAM Usage',   va: `${a.usage.ram}%`,   vb: `${b.usage.ram}%`,   higherBetter: false, numA: a.usage.ram,        numB: b.usage.ram },
        { label: 'Avg Temp',    va: `${a.temperature.avg}°C`,  vb: `${b.temperature.avg}°C`,  higherBetter: false, numA: a.temperature.avg,  numB: b.temperature.avg },
        { label: 'Peak Temp',   va: `${a.temperature.peak}°C`, vb: `${b.temperature.peak}°C`, higherBetter: false, numA: a.temperature.peak, numB: b.temperature.peak },
    ];

    const tbody = document.getElementById('comparisonTable');
    tbody.innerHTML = metrics.map(m => {
        let winner = '—';
        let styleA = '', styleB = '';
        if (m.higherBetter !== null && m.numA !== undefined) {
            if (m.numA > m.numB) {
                winner  = m.higherBetter ? '🏆 A' : '🏆 B';
                styleA  = m.higherBetter ? 'color:#4ade80; font-weight:700;' : 'color:#f87171; font-weight:700;';
                styleB  = m.higherBetter ? '' : 'color:#4ade80; font-weight:700;';
            } else if (m.numB > m.numA) {
                winner  = m.higherBetter ? '🏆 B' : '🏆 A';
                styleB  = m.higherBetter ? 'color:#4ade80; font-weight:700;' : 'color:#f87171; font-weight:700;';
                styleA  = m.higherBetter ? '' : 'color:#4ade80; font-weight:700;';
            } else {
                winner = 'Tie';
            }
        }
        return `<tr>
            <td style="color:#c77dff; font-weight:600;">${m.label}</td>
            <td style="${styleA}">${m.va}</td>
            <td style="${styleB}">${m.vb}</td>
            <td style="text-align:center;">${winner}</td>
        </tr>`;
    }).join('');
}

function buildHeaderCard(r) {
    return `
        <div style="font-size:0.9rem; line-height:2;">
            <div><span style="color:#9d4edd;">Game:</span> ${r.game}</div>
            <div><span style="color:#9d4edd;">CPU:</span> ${r.cpu}</div>
            <div><span style="color:#9d4edd;">GPU:</span> ${r.gpu}</div>
            <div><span style="color:#9d4edd;">RAM:</span> ${r.ram} GB</div>
            <div><span style="color:#9d4edd;">Date:</span> ${new Date(r.timestamp).toLocaleString()}</div>
        </div>`;
}

function showCompareMsg(message, type) {
    const el = document.getElementById('selectMessage');
    if (!el) return;
    el.textContent  = message;
    el.style.color  = type === 'success' ? '#4ade80' : '#f87171';
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function showSaveMsg(message, type) {
    const el = document.getElementById('saveCompareMsg');
    if (!el) return;
    el.textContent  = message;
    el.style.color  = type === 'success' ? '#4ade80' : '#f87171';
    el.style.display = 'block';
}

async function loadPastComparisons() {
    try {
        const response = await fetch('/api/compare/history', { credentials: 'include' });
        if (!response.ok) return;

        const data = await response.json();
        if (!data.history || data.history.length === 0) return;

        const section = document.getElementById('pastComparisons');
        const list    = document.getElementById('pastComparisonsList');
        section.style.display = 'block';

        list.innerHTML = data.history.map(c => `
            <div class="spec-display" style="margin-bottom:1.5rem;">
                <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">
                    <h3 style="margin:0; color:#c77dff;">Comparison #${c.comparison_id}</h3>
                    <span style="font-size:0.85rem; color:#9d4edd;">${new Date(c.created_at).toLocaleString()}</span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                    <div class="spec-item">
                        <div class="spec-label">Result A</div>
                        <div class="spec-value">${c.a.game}</div>
                        <div style="font-size:0.85rem; color:#b3b3b3; margin-top:0.3rem;">${c.a.cpu} · ${c.a.gpu}</div>
                        <div style="font-size:0.85rem; color:#4ade80; margin-top:0.2rem;">Avg FPS: ${c.a.avg_fps}</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Result B</div>
                        <div class="spec-value">${c.b.game}</div>
                        <div style="font-size:0.85rem; color:#b3b3b3; margin-top:0.3rem;">${c.b.cpu} · ${c.b.gpu}</div>
                        <div style="font-size:0.85rem; color:#4ade80; margin-top:0.2rem;">Avg FPS: ${c.b.avg_fps}</div>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.log('Could not load past comparisons:', err);
    }
}

// ──────────────────────────────────────────────
// GAME REQUIREMENTS PAGE
// ──────────────────────────────────────────────

if (document.getElementById('checkReqBtn')) {
    document.getElementById('checkReqBtn').addEventListener('click', async () => {
        const ram   = document.getElementById('reqRam').value;
        const vram  = document.getElementById('reqVram').value;
        const game  = document.getElementById('reqGame').value;

        if (!ram || !vram || !game) {
            showReqMsg('Please fill in all fields.', 'error');
            return;
        }

        const btn = document.getElementById('checkReqBtn');
        btn.disabled    = true;
        btn.textContent = 'Checking...';

        try {
            const response = await fetch('/api/requirements', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game, ram: parseInt(ram), vram: parseInt(vram) })
            });
            const data = await response.json();

            if (!response.ok) {
                showReqMsg(data.error || 'Check failed.', 'error');
                return;
            }

            renderRequirements(data);

        } catch (err) {
            showReqMsg('Could not connect to server.', 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Check Requirements';
        }
    });
}

function renderRequirements(data) {
    const panel = document.getElementById('reqResultPanel');
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth' });

    // Game info banner
    document.getElementById('reqGameTitle').textContent = data.game;
    document.getElementById('reqGameInfo').innerHTML = `
        <div class="spec-item">
            <div class="spec-label">Genre</div>
            <div class="spec-value">${data.genre}</div>
        </div>
        <div class="spec-item">
            <div class="spec-label">Difficulty</div>
            <div class="spec-value">${getDifficultyLabel(data.difficulty)}</div>
        </div>
    `;

    // Build a requirement row
    function reqRow(label, required, yours, meets) {
        const icon  = meets ? '✅' : '❌';
        const style = meets ? 'color:#4ade80; font-weight:700;' : 'color:#f87171; font-weight:700;';
        return `<tr>
            <td style="color:#c77dff; font-weight:600;">${label}</td>
            <td>${required} GB</td>
            <td style="${style}">${yours} GB</td>
            <td style="text-align:center; font-size:1.2rem;">${icon}</td>
        </tr>`;
    }

    // Minimum table
    document.getElementById('minReqTable').innerHTML =
        reqRow('RAM',  data.checks.min.ram.required,  data.checks.min.ram.yours,  data.checks.min.ram.meets) +
        reqRow('VRAM', data.checks.min.vram.required, data.checks.min.vram.yours, data.checks.min.vram.meets);

    // Recommended table
    document.getElementById('recReqTable').innerHTML =
        reqRow('RAM',  data.checks.recommended.ram.required,  data.checks.recommended.ram.yours,  data.checks.recommended.ram.meets) +
        reqRow('VRAM', data.checks.recommended.vram.required, data.checks.recommended.vram.yours, data.checks.recommended.vram.meets);

    // Verdict banner
    const verdict = document.getElementById('verdictBanner');
    const verdictMap = {
        recommended: {
            text:  '🏆 Your system meets the RECOMMENDED requirements!',
            color: '#4ade80',
            bg:    'rgba(34, 197, 94, 0.1)',
            border:'rgba(34, 197, 94, 0.4)'
        },
        minimum: {
            text:  '⚠️ Your system meets the MINIMUM requirements. Expect lower settings.',
            color: '#facc15',
            bg:    'rgba(250, 204, 21, 0.1)',
            border:'rgba(250, 204, 21, 0.4)'
        },
        below: {
            text:  '❌ Your system does NOT meet the minimum requirements for this game.',
            color: '#f87171',
            bg:    'rgba(239, 68, 68, 0.1)',
            border:'rgba(239, 68, 68, 0.4)'
        }
    };

    const v = verdictMap[data.verdict];
    verdict.textContent         = v.text;
    verdict.style.color         = v.color;
    verdict.style.background    = v.bg;
    verdict.style.borderColor   = v.border;
}

function getDifficultyLabel(d) {
    if (d <= 0.4) return 'Very Easy';
    if (d <= 0.6) return 'Easy';
    if (d <= 0.75) return 'Moderate';
    if (d <= 0.85) return 'Demanding';
    return 'Very Demanding';
}

function showReqMsg(message, type) {
    const el = document.getElementById('reqMessage');
    if (!el) return;
    el.textContent   = message;
    el.style.color   = type === 'success' ? '#4ade80' : '#f87171';
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ──────────────────────────────────────────────
// SETTINGS PAGE
// ──────────────────────────────────────────────

if (document.getElementById('saveSettingsBtn')) {
    const username = localStorage.getItem('pp_username');
    if (!username) {
        document.getElementById('notLoggedIn').style.display = 'block';
    } else {
        document.getElementById('settingsUI').style.display = 'block';
        loadSettings();
    }

    document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
        const theme      = document.getElementById('themeSelect').value;
        const resolution = document.getElementById('resolutionSelect').value;
        const defaultGame = document.getElementById('defaultGameSelect').value;

        const btn = document.getElementById('saveSettingsBtn');
        btn.disabled    = true;
        btn.textContent = 'Saving...';

        try {
            const response = await fetch('/api/settings', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ theme, resolution, default_game: defaultGame || null })
            });
            const data = await response.json();

            const msgEl = document.getElementById('settingsMessage');
            if (response.ok) {
                // Apply theme immediately
                applyTheme(theme);
                localStorage.setItem('pp_theme', theme);
                localStorage.setItem('pp_default_game', defaultGame || '');

                msgEl.textContent = '✓ ' + data.message;
                msgEl.className   = 'auth-message success';
                msgEl.style.display = 'block';
                showCurrentSettings(theme, resolution, defaultGame);
                setTimeout(() => { msgEl.style.display = 'none'; }, 3500);
            } else {
                msgEl.textContent = data.error || 'Save failed.';
                msgEl.className   = 'auth-message error';
                msgEl.style.display = 'block';
            }
        } catch (err) {
            const msgEl = document.getElementById('settingsMessage');
            msgEl.textContent = 'Could not connect to server.';
            msgEl.className   = 'auth-message error';
            msgEl.style.display = 'block';
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Save Settings';
        }
    });
}

async function loadSettings() {
    try {
        const response = await fetch('/api/settings', { credentials: 'include' });
        if (!response.ok) return;

        const data = await response.json();

        // Pre-select saved values in the form
        if (data.theme) {
            document.getElementById('themeSelect').value = data.theme;
            applyTheme(data.theme);
        }
        if (data.resolution) {
            document.getElementById('resolutionSelect').value = data.resolution;
        }
        if (data.default_game) {
            document.getElementById('defaultGameSelect').value = data.default_game;
        }

        showCurrentSettings(data.theme, data.resolution, data.default_game);

    } catch (err) {
        console.log('Could not load settings:', err);
    }
}

function showCurrentSettings(theme, resolution, defaultGame) {
    const section = document.getElementById('currentSettings');
    const grid    = document.getElementById('savedSettingsGrid');
    if (!section || !grid) return;

    section.style.display = 'block';
    grid.innerHTML = `
        <div class="spec-item">
            <div class="spec-label">Theme</div>
            <div class="spec-value">${theme || 'Dark'}</div>
        </div>
        <div class="spec-item">
            <div class="spec-label">Resolution</div>
            <div class="spec-value">${resolution || '1920x1080'}</div>
        </div>
        <div class="spec-item">
            <div class="spec-label">Default Game</div>
            <div class="spec-value">${defaultGame || 'None'}</div>
        </div>
    `;
}

// ── Apply theme globally (runs on every page load) ──
function applyTheme(theme) {
    if (theme === 'Light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

// ── On every page: apply saved theme + default game + nav auth state ──
(function initGlobalSettings() {
    const savedTheme = localStorage.getItem('pp_theme');
    if (savedTheme) applyTheme(savedTheme);

    // ── Show page banner (after register / logout redirect) ──
    const pendingBanner = localStorage.getItem('pp_banner');
    if (pendingBanner) {
        localStorage.removeItem('pp_banner');
        try {
            const b = JSON.parse(pendingBanner);
            // Inject banner just inside the container, before h1
            const container = document.querySelector('.container');
            if (container) {
                const banner = document.createElement('div');
                banner.className = `page-banner ${b.type}-banner`;
                banner.textContent = b.message;
                banner.style.display = 'block';
                container.insertBefore(banner, container.firstChild);
                // Auto-hide after 5 seconds
                setTimeout(() => { banner.style.display = 'none'; }, 5000);
            }
        } catch (_) {}
    }

    const username = localStorage.getItem('pp_username');

    // ── PAGE PROTECTION ──
    const page = window.location.pathname.split('/').pop();
    const protectedPages = ['benchmark.html', 'result.html', 'compare.html', 'requirements.html', 'comments.html'];

    if (protectedPages.includes(page) && !username) {
        localStorage.setItem('pp_redirect', page);
        alert('You must be logged in to access this page. Redirecting to login...');
        window.location.href = 'login.html';
        return;
    }

    // User is logged in and on a protected page — clear any stale redirect
    if (protectedPages.includes(page) && username) {
        localStorage.removeItem('pp_redirect');
    }

    // On benchmark page: pre-select default game
    const gameSelect = document.getElementById('gameSelect');
    if (gameSelect) {
        const defaultGame = localStorage.getItem('pp_default_game');
        if (defaultGame) gameSelect.value = defaultGame;
    }

    // ── Update nav Account dropdown based on login state ──
    const allDropdowns = document.querySelectorAll('nav .dropdown');
    let accountDrop = null;
    allDropdowns.forEach(d => {
        if (d.querySelector('#nav-login') || d.querySelector('#nav-register')) {
            accountDrop = d;
        }
    });

    if (accountDrop) {
        if (username) {
            const loginLink    = accountDrop.querySelector('#nav-login');
            const registerLink = accountDrop.querySelector('#nav-register');
            if (loginLink)    loginLink.style.display    = 'none';
            if (registerLink) registerLink.style.display = 'none';

            if (!accountDrop.querySelector('.nav-user-info')) {
                const userInfo = document.createElement('div');
                userInfo.className   = 'nav-user-info';
                userInfo.textContent = username;
                accountDrop.insertBefore(userInfo, accountDrop.firstChild);

                const logoutBtn = document.createElement('button');
                logoutBtn.className   = 'btn-logout';
                logoutBtn.id          = 'logoutBtn';
                logoutBtn.textContent = 'Logout';
                accountDrop.appendChild(logoutBtn);
            }
        } else {
            const loginLink    = accountDrop.querySelector('#nav-login');
            const registerLink = accountDrop.querySelector('#nav-register');
            if (loginLink)    loginLink.style.display    = '';
            if (registerLink) registerLink.style.display = '';
        }
    }
})();

// ──────────────────────────────────────────────
// REVIEWS PAGE
// ──────────────────────────────────────────────

if (document.getElementById('submitReviewBtn')) {
    const username = localStorage.getItem('pp_username');

    // Show write section only if logged in
    if (username) {
        document.getElementById('writeReviewSection').style.display = 'block';
    } else {
        document.getElementById('loginPrompt').style.display = 'block';
    }

    // ── Star rating interaction ──
    let selectedRating = 0;
    const stars = document.querySelectorAll('.star-rating .star');
    const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

    stars.forEach(star => {
        star.addEventListener('mouseover', () => {
            const val = parseInt(star.dataset.value);
            stars.forEach(s => {
                s.classList.toggle('hover', parseInt(s.dataset.value) <= val);
            });
        });
        star.addEventListener('mouseout', () => {
            stars.forEach(s => s.classList.remove('hover'));
        });
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.value);
            stars.forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.value) <= selectedRating);
            });
            document.getElementById('ratingLabel').textContent =
                `${selectedRating}/5 — ${ratingLabels[selectedRating]}`;
        });
    });

    // ── Submit review ──
    document.getElementById('submitReviewBtn').addEventListener('click', async () => {
        const game       = document.getElementById('reviewGame').value;
        const reviewText = document.getElementById('reviewText').value.trim();

        if (!game) { showReviewMsg('Please select a game.', 'error'); return; }
        if (selectedRating === 0) { showReviewMsg('Please select a star rating.', 'error'); return; }
        if (!reviewText) { showReviewMsg('Please write a review.', 'error'); return; }

        const btn = document.getElementById('submitReviewBtn');
        btn.disabled    = true;
        btn.textContent = 'Submitting...';

        try {
            const response = await fetch('/api/reviews', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ game, star_rating: selectedRating, review_text: reviewText })
            });
            const data = await response.json();

            if (response.ok) {
                showReviewMsg('✓ ' + data.message, 'success');
                // Reset form
                document.getElementById('reviewGame').value  = '';
                document.getElementById('reviewText').value  = '';
                selectedRating = 0;
                stars.forEach(s => s.classList.remove('active'));
                document.getElementById('ratingLabel').textContent = 'Click a star to rate';

                // If currently browsing this game, refresh the list
                const browseGame = document.getElementById('browseGame').value;
                if (browseGame === game) fetchReviews(game);
            } else {
                showReviewMsg(data.error || 'Submission failed.', 'error');
            }

        } catch (err) {
            showReviewMsg('Could not connect to server.', 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Submit Review';
        }
    });

    // ── Browse reviews by game ──
    document.getElementById('browseGame').addEventListener('change', async () => {
        const game = document.getElementById('browseGame').value;
        if (!game) {
            document.getElementById('reviewsList').style.display = 'none';
            return;
        }
        await fetchReviews(game);
    });
}

async function fetchReviews(game) {
    try {
        const response = await fetch(`/api/reviews/${encodeURIComponent(game)}`, {
            credentials: 'include'
        });
        const data = await response.json();

        const listSection = document.getElementById('reviewsList');
        listSection.style.display = 'block';
        listSection.scrollIntoView({ behavior: 'smooth' });

        document.getElementById('reviewsGameTitle').textContent = game;

        // Average rating display
        const avgEl = document.getElementById('avgRatingDisplay');
        if (data.avg_rating) {
            const fullStars = Math.round(data.avg_rating);
            avgEl.innerHTML = `${'★'.repeat(fullStars)}${'☆'.repeat(5 - fullStars)}
                <span style="color:#e0e0e0; font-size:0.95rem; margin-left:0.5rem;">
                    ${data.avg_rating}/5 (${data.total} review${data.total !== 1 ? 's' : ''})
                </span>`;
        } else {
            avgEl.textContent = 'No reviews yet';
        }

        // Render review cards
        const container = document.getElementById('reviewsContainer');
        if (!data.reviews || data.reviews.length === 0) {
            container.innerHTML = '<div class="no-reviews">No reviews yet for this game. Be the first!</div>';
            return;
        }

        container.innerHTML = data.reviews.map(r => {
            const stars  = '★'.repeat(r.star_rating) + '☆'.repeat(5 - r.star_rating);
            const date   = new Date(r.created_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric'
            });
            return `
                <div class="review-card">
                    <div class="review-header">
                        <span class="review-username">👤 ${r.username}</span>
                        <span class="review-date">${date}</span>
                    </div>
                    <div class="review-stars">${stars}</div>
                    <div class="review-text">${r.review_text}</div>
                </div>`;
        }).join('');

    } catch (err) {
        console.log('Could not fetch reviews:', err);
    }
}

function showReviewMsg(message, type) {
    const el = document.getElementById('reviewMessage');
    if (!el) return;
    el.textContent   = message;
    el.style.color   = type === 'success' ? '#4ade80' : '#f87171';
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ──────────────────────────────────────────────
// COMMENTS (on Results page history section)
// ──────────────────────────────────────────────

async function loadCommentsForResult(resultId) {
    try {
        const response = await fetch(`/api/comments/${resultId}`);
        const data     = await response.json();
        return data.comments || [];
    } catch (err) {
        return [];
    }
}

function buildCommentSection(resultId, comments) {
    const isLoggedIn = !!localStorage.getItem('pp_username');
    const commentCards = comments.length === 0
        ? '<p style="color:#9d4edd; font-size:0.9rem; padding:0.5rem 0;">No comments yet. Be the first!</p>'
        : comments.map(c => `
            <div class="comment-card">
                <div class="comment-meta">
                    <span class="comment-username">👤 ${c.username}</span>
                    <span class="comment-date">${new Date(c.created_at).toLocaleString()}</span>
                </div>
                <div class="comment-text">${c.comment_text}</div>
            </div>`).join('');

    const inputSection = isLoggedIn ? `
        <div style="display:flex; gap:0.75rem; margin-top:0.75rem; flex-wrap:wrap;">
            <input type="text" id="commentInput_${resultId}"
                placeholder="Write a comment..."
                maxlength="1000"
                style="flex:1; min-width:200px; padding:0.6rem 0.75rem;
                       background:rgba(10,5,15,0.8); border:1px solid #7b2cbf;
                       border-radius:4px; color:#e0e0e0; font-size:0.9rem;">
            <button onclick="postComment(${resultId})"
                style="padding:0.6rem 1.2rem; background:linear-gradient(135deg,#7b2cbf,#9d4edd);
                       color:#fff; border:none; border-radius:4px; cursor:pointer;
                       font-weight:600; font-size:0.9rem; white-space:nowrap;">
                Post Comment
            </button>
        </div>
        <div id="commentMsg_${resultId}" style="display:none; font-size:0.85rem; margin-top:0.4rem;"></div>`
        : `<p style="color:#9d4edd; font-size:0.85rem; margin-top:0.5rem;">
               <a href="login.html" style="color:#c77dff;">Login</a> to post a comment.
           </p>`;

    return `
        <div style="margin-top:1.25rem; border-top:1px solid rgba(123,44,191,0.3); padding-top:1rem;">
            <h3 style="font-size:1rem; margin:0 0 0.75rem 0; color:#9d4edd;">
                💬 Comments
            </h3>
            <div id="commentsList_${resultId}">${commentCards}</div>
            ${inputSection}
        </div>`;
}

async function postComment(resultId) {
    const input  = document.getElementById(`commentInput_${resultId}`);
    const msgEl  = document.getElementById(`commentMsg_${resultId}`);
    const text   = (input.value || '').trim();

    if (!text) {
        msgEl.textContent  = 'Comment cannot be empty.';
        msgEl.style.color  = '#f87171';
        msgEl.style.display = 'block';
        return;
    }

    try {
        const response = await fetch('/api/comments', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ result_id: resultId, comment_text: text })
        });
        const data = await response.json();

        if (response.ok) {
            // Append new comment to the list immediately
            const listEl = document.getElementById(`commentsList_${resultId}`);
            const now    = new Date().toLocaleString();
            const username = localStorage.getItem('pp_username');
            listEl.innerHTML += `
                <div class="comment-card">
                    <div class="comment-meta">
                        <span class="comment-username">👤 ${username}</span>
                        <span class="comment-date">${now}</span>
                    </div>
                    <div class="comment-text">${text}</div>
                </div>`;
            input.value        = '';
            msgEl.textContent  = '✓ Comment posted!';
            msgEl.style.color  = '#4ade80';
            msgEl.style.display = 'block';
            setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
        } else {
            msgEl.textContent  = data.error || 'Failed to post comment.';
            msgEl.style.color  = '#f87171';
            msgEl.style.display = 'block';
        }
    } catch (err) {
        msgEl.textContent  = 'Could not connect to server.';
        msgEl.style.color  = '#f87171';
        msgEl.style.display = 'block';
    }
}

// ──────────────────────────────────────────────
// NOTIFICATIONS
// ──────────────────────────────────────────────

// ── Bell badge: runs on every page ──
async function loadNotificationBadge() {
    if (!localStorage.getItem('pp_username')) return;
    try {
        const response = await fetch('/api/notifications', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();

        // Inject bell badge into nav if unread count > 0
        const notifLink = document.querySelector('a[href="notifications.html"]');
        if (notifLink && data.unread_count > 0) {
            notifLink.classList.add('notif-bell');
            // Remove any existing badge first
            const old = notifLink.querySelector('.notif-badge');
            if (old) old.remove();
            const badge = document.createElement('span');
            badge.className   = 'notif-badge';
            badge.textContent = data.unread_count > 9 ? '9+' : data.unread_count;
            notifLink.appendChild(badge);
        }
    } catch (err) {
        console.log('Could not load notification badge:', err);
    }
}

// ── Notifications page ──
if (document.getElementById('markAllReadBtn')) {
    const username = localStorage.getItem('pp_username');
    if (!username) {
        document.getElementById('notLoggedIn').style.display      = 'block';
        document.getElementById('notificationsUI').style.display  = 'none';
    } else {
        document.getElementById('notificationsUI').style.display = 'block';
        loadNotificationsPage();
    }

    document.getElementById('markAllReadBtn').addEventListener('click', async () => {
        try {
            await fetch('/api/notifications/read', {
                method: 'POST',
                credentials: 'include'
            });
            // Re-render with all marked read
            loadNotificationsPage();
        } catch (err) {
            console.log('Could not mark as read:', err);
        }
    });
}

async function loadNotificationsPage() {
    try {
        const response = await fetch('/api/notifications', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();

        const list    = document.getElementById('notificationsList');
        const noNotif = document.getElementById('noNotifications');
        const countEl = document.getElementById('unreadCount');

        if (!data.notifications || data.notifications.length === 0) {
            list.innerHTML         = '';
            noNotif.style.display  = 'block';
            countEl.textContent    = '';
            return;
        }

        noNotif.style.display = 'none';
        countEl.textContent   = data.unread_count > 0
            ? `You have ${data.unread_count} unread notification${data.unread_count !== 1 ? 's' : ''}.`
            : 'All caught up! No unread notifications.';

        // Pick icon based on message content
        function getIcon(msg) {
            if (msg.includes('Benchmark') || msg.includes('✅')) return '🖥️';
            if (msg.includes('comment')   || msg.includes('💬')) return '💬';
            if (msg.includes('review')    || msg.includes('⭐')) return '⭐';
            return '🔔';
        }

        list.innerHTML = data.notifications.map(n => `
            <div class="notif-card ${n.is_read ? '' : 'unread'}">
                <div class="notif-icon">${getIcon(n.message)}</div>
                <div class="notif-body">
                    <div class="notif-msg">${n.message}</div>
                    <div class="notif-time">${new Date(n.created_at).toLocaleString()}</div>
                </div>
                ${!n.is_read ? '<div class="notif-dot"></div>' : ''}
            </div>`
        ).join('');

    } catch (err) {
        console.log('Could not load notifications:', err);
    }
}

// Run badge loader on every page
loadNotificationBadge();
