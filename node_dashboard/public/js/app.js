/**
 * Enterprise Military-Grade Frontend Controller & Visualizer
 * Counter-Drone Tactical Command Twin
 * Features:
 *   1. Web Audio API Synthetic Radar Ping & DEFCON Alert Sound Effects
 *   2. Circular SVG Telemetry Gauges (Link Quality %, SNR dB, GDOP Accuracy %)
 *   3. Range Compass Rose & Millimeter Crosshairs on 2D Radar
 *   4. UTC Military Zulu Clock & Mission Selector
 *   5. Interactive Timeline Flight Scrubber with HUD Telemetry
 *   6. 3D Volumetric Tactical Battlespace
 */

const THEME = {
    bg: '#080a12',
    card: '#0e1222',
    cardBorder: 'rgba(0, 240, 255, 0.16)',
    accentCyan: '#00f0ff',
    accentBlue: '#00b0ff',
    accentPurple: '#7000ff',
    accentPink: '#ff007f',
    truePath: '#00ff66',
    estPath: '#ffaa00',
    sensor: '#00b0ff',
    sensorActive: '#00ff66',
    sensorRange: 'rgba(0, 176, 255, 0.05)',
    sensorRangeBorder: 'rgba(0, 176, 255, 0.2)',
    zoneFill: 'rgba(255, 23, 68, 0.16)',
    zoneBorder: '#ff1744',
    bufferFill: 'rgba(255, 170, 0, 0.06)',
    bufferBorder: 'rgba(255, 170, 0, 0.35)',
    alertInfo: '#00b0ff',
    alertWarn: '#ffaa00',
    alertCrit: '#ff1744',
    grid: '#141a2e',
    text: '#f1f5f9',
    textMuted: '#94a3b8'
};

const plotlyLayoutDefaults = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: THEME.bg,
    font: {
        family: 'JetBrains Mono, monospace',
        color: THEME.text,
        size: 11
    },
    xaxis: {
        gridcolor: THEME.grid,
        zerolinecolor: THEME.grid,
        showgrid: true
    },
    yaxis: {
        gridcolor: THEME.grid,
        zerolinecolor: THEME.grid,
        showgrid: true
    },
    margin: { l: 50, r: 30, t: 40, b: 60 },
    legend: {
        orientation: 'h',
        x: 0.5,
        xanchor: 'center',
        y: -0.12,
        yanchor: 'top',
        bgcolor: 'rgba(14, 18, 34, 0.85)',
        bordercolor: 'rgba(0, 240, 255, 0.25)',
        borderwidth: 1,
        font: { size: 10 }
    }
};

// ── Web Audio API Synthetic Sound Engine ──
class TacticalSoundFX {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    ping() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5 note
            osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.08);

            gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.12);
        } catch (e) { }
    }

    alarm() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(440, this.ctx.currentTime);
            osc.frequency.setValueAtTime(587.33, this.ctx.currentTime + 0.1);

            gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.25);
        } catch (e) { }
    }
}

const soundFX = new TacticalSoundFX();

// ── Global Simulation State ──
let currentSimResults = null;
let currentParams = null;
let playbackIndex = 0;
let isPlaying = false;
let playInterval = null;
let playbackSpeed = 1;
let currentViewMode = '2D'; // '2D' or '3D'

// ── DOM Bindings ──
const inputs = {
    swarmFormation: document.getElementById('swarmFormation'),
    droneSpeed: document.getElementById('droneSpeed'),
    droneSpeedVal: document.getElementById('droneSpeedVal'),
    droneAltitude: document.getElementById('droneAltitude'),
    droneAltitudeVal: document.getElementById('droneAltitudeVal'),
    nChannels: document.getElementById('nChannels'),
    nChannelsVal: document.getElementById('nChannelsVal'),
    hopRate: document.getElementById('hopRate'),
    hopRateVal: document.getElementById('hopRateVal'),
    jammerType: document.getElementById('jammerType'),
    jamPowerContainer: document.getElementById('jamPowerContainer'),
    jamPower: document.getElementById('jamPower'),
    jamPowerVal: document.getElementById('jamPowerVal'),
    beamwidthContainer: document.getElementById('beamwidthContainer'),
    beamWidth: document.getElementById('beamWidth'),
    beamWidthVal: document.getElementById('beamWidthVal'),
    nSensors: document.getElementById('nSensors'),
    nSensorsVal: document.getElementById('nSensorsVal'),
    sensorRadius: document.getElementById('sensorRadius'),
    sensorRadiusVal: document.getElementById('sensorRadiusVal'),
    sensorRange: document.getElementById('sensorRange'),
    sensorRangeVal: document.getElementById('sensorRangeVal'),
    noiseStd: document.getElementById('noiseStd'),
    noiseStdVal: document.getElementById('noiseStdVal'),
    predHorizon: document.getElementById('predHorizon'),
    predHorizonVal: document.getElementById('predHorizonVal'),
    predModel: document.getElementById('predModel'),
    showUncertaintyCone: document.getElementById('showUncertaintyCone'),
    interceptorSpeed: document.getElementById('interceptorSpeed'),
    interceptorSpeedVal: document.getElementById('interceptorSpeedVal'),
    interceptorNavN: document.getElementById('interceptorNavN'),
    interceptorNavNVal: document.getElementById('interceptorNavNVal'),
    interceptorAutoLaunch: document.getElementById('interceptorAutoLaunch'),
    simDt: document.getElementById('simDt'),
    runSimBtn: document.getElementById('runSimBtn')
};

// Engines Instances
const predictor = new TrajectoryPredictor(5.0, 0.1);
const interceptor = new InterceptorModel();
const swarmEngine = new SwarmEngine();
const analyticsEngine = new AnalyticsEngine();
const directionalJammer = new DirectionalBeamJammer();

// Export Buttons DOM
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');

if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
        analyticsEngine.exportTelemetryCsv(currentSimResults);
    });
}
if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
        analyticsEngine.exportTelemetryJson(currentSimResults);
    });
}

// Presets
const PRESETS = {
    clean: { swarmFormation: 'Single', droneSpeed: 15, droneAltitude: 50, nChannels: 50, hopRate: 100, jammerType: 'None', jamPower: 30, nSensors: 8, sensorRadius: 400, sensorRange: 600, noiseStd: 3.0, simDt: 0.1 },
    pincer: { swarmFormation: 'Pincer', droneSpeed: 18, droneAltitude: 45, nChannels: 60, hopRate: 120, jammerType: 'None', jamPower: 30, nSensors: 8, sensorRadius: 400, sensorRange: 600, noiseStd: 3.0, simDt: 0.1 },
    decoy: { swarmFormation: 'Decoy', droneSpeed: 20, droneAltitude: 50, nChannels: 50, hopRate: 100, jammerType: 'Barrage', jamPower: 32, nSensors: 10, sensorRadius: 450, sensorRange: 650, noiseStd: 3.5, simDt: 0.1 },
    saturation: { swarmFormation: 'Saturation', droneSpeed: 16, droneAltitude: 60, nChannels: 80, hopRate: 150, jammerType: 'Reactive', jamPower: 35, nSensors: 12, sensorRadius: 500, sensorRange: 700, noiseStd: 4.0, simDt: 0.1 },
    barrage: { swarmFormation: 'Single', droneSpeed: 15, droneAltitude: 50, nChannels: 50, hopRate: 100, jammerType: 'Barrage', jamPower: 35, nSensors: 8, sensorRadius: 400, sensorRange: 600, noiseStd: 3.0, simDt: 0.1 },
    reactive: { swarmFormation: 'Single', droneSpeed: 15, droneAltitude: 50, nChannels: 50, hopRate: 100, jammerType: 'Reactive', jamPower: 35, nSensors: 8, sensorRadius: 400, sensorRange: 600, noiseStd: 3.0, simDt: 0.1 }
};

// Top Bar Elements
const utcClockDisplay = document.getElementById('utcClockDisplay');
const audioToggleBtn = document.getElementById('audioToggleBtn');
const audioStatusText = document.getElementById('audioStatusText');
const assetSelect = document.getElementById('assetSelect');
const chipJammer = document.getElementById('chipJammer');

// Playback DOM
const playBtn = document.getElementById('playBtn');
const resetPlayBtn = document.getElementById('resetPlayBtn');
const stepPlayBtn = document.getElementById('stepPlayBtn');
const timeScrubber = document.getElementById('timeScrubber');
const playbackTimeDisplay = document.getElementById('playbackTimeDisplay');
const playbackTimeMax = document.getElementById('playbackTimeMax');
const livePositionPill = document.getElementById('livePositionPill');
const liveSensorsPill = document.getElementById('liveSensorsPill');
const liveSnrPill = document.getElementById('liveSnrPill');
const liveTtbPill = document.getElementById('liveTtbPill');
const radarViewport = document.getElementById('radarViewport');
const hudDefcon = document.getElementById('hudDefcon');

// 3D / 2D Switch
const view2dBtn = document.getElementById('view2dBtn');
const view3dBtn = document.getElementById('view3dBtn');

// Guide Modal
const openGuideBtn = document.getElementById('openGuideBtn');
const closeGuideBtn = document.getElementById('closeGuideBtn');
const guideModal = document.getElementById('guideModal');

// Circular SVG Gauges
const gaugeLqCircle = document.getElementById('gaugeLqCircle');
const gaugeLqText = document.getElementById('gaugeLqText');
const gaugeSnrCircle = document.getElementById('gaugeSnrCircle');
const gaugeSnrText = document.getElementById('gaugeSnrText');
const gaugeAccCircle = document.getElementById('gaugeAccCircle');
const gaugeAccText = document.getElementById('gaugeAccText');

// ── Live UTC Clock ──
function updateUtcClock() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const zulu = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}Z`;
    utcClockDisplay.textContent = zulu;
}
setInterval(updateUtcClock, 1000);
updateUtcClock();

// Audio Toggle Trigger
audioToggleBtn.addEventListener('click', () => {
    soundFX.enabled = !soundFX.enabled;
    audioStatusText.textContent = soundFX.enabled ? 'AUDIO: ON' : 'AUDIO: MUTED';
    audioToggleBtn.style.borderColor = soundFX.enabled ? 'rgba(0, 240, 255, 0.5)' : 'rgba(255, 23, 68, 0.5)';
});

// Slider Value Bindings
['droneSpeed', 'droneAltitude', 'nChannels', 'hopRate', 'jamPower', 'beamWidth', 'nSensors', 'sensorRadius', 'sensorRange', 'noiseStd', 'predHorizon', 'interceptorSpeed', 'interceptorNavN'].forEach(id => {
    const input = inputs[id];
    const display = inputs[id + 'Val'];
    if (input && display) {
        input.addEventListener('input', () => {
            display.textContent = input.value;
            if (id === 'predHorizon' || id === 'beamWidth') {
                renderTacticalMap();
            }
        });
    }
});

if (inputs.showUncertaintyCone) {
    inputs.showUncertaintyCone.addEventListener('change', renderTacticalMap);
}
if (inputs.predModel) {
    inputs.predModel.addEventListener('change', renderTacticalMap);
}

// Toggle Jammer Power Slider
inputs.jammerType.addEventListener('change', () => {
    const isJam = inputs.jammerType.value !== 'None';
    const isDirectional = inputs.jammerType.value === 'Directional';
    inputs.jamPowerContainer.style.display = isJam ? 'block' : 'none';
    if (inputs.beamwidthContainer) {
        inputs.beamwidthContainer.style.display = isDirectional ? 'block' : 'none';
    }
    chipJammer.className = isJam ? 'chip active' : 'chip nominal';
    chipJammer.innerHTML = `<span class="chip-dot"></span> EW JAMMER: ${isJam ? inputs.jammerType.value.toUpperCase() : 'STANDBY'}`;
});

// Tab Switcher
document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.tab);
        if (target) {
            target.classList.add('active');
            window.dispatchEvent(new Event('resize'));
        }
    });
});

// Guide Modal Triggers
openGuideBtn.addEventListener('click', () => guideModal.classList.add('active'));
closeGuideBtn.addEventListener('click', () => guideModal.classList.remove('active'));
guideModal.addEventListener('click', (e) => {
    if (e.target === guideModal) guideModal.classList.remove('active');
});

// 2D vs 3D Mode Switcher
view2dBtn.addEventListener('click', () => {
    currentViewMode = '2D';
    view2dBtn.classList.add('active');
    view3dBtn.classList.remove('active');
    renderTacticalMap();
});

view3dBtn.addEventListener('click', () => {
    currentViewMode = '3D';
    view3dBtn.classList.add('active');
    view2dBtn.classList.remove('active');
    renderTacticalMap();
});

document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const p = PRESETS[btn.dataset.preset];
        if (p) {
            applyPreset(p);
            executeSimulation();
        }
    });
});

function applyPreset(p) {
    if (p.swarmFormation && inputs.swarmFormation) inputs.swarmFormation.value = p.swarmFormation;
    inputs.droneSpeed.value = p.droneSpeed;
    inputs.droneSpeedVal.textContent = p.droneSpeed;
    inputs.droneAltitude.value = p.droneAltitude;
    inputs.droneAltitudeVal.textContent = p.droneAltitude;
    inputs.nChannels.value = p.nChannels;
    inputs.nChannelsVal.textContent = p.nChannels;
    inputs.hopRate.value = p.hopRate;
    inputs.hopRateVal.textContent = p.hopRate;
    inputs.jammerType.value = p.jammerType;
    inputs.jamPowerContainer.style.display = p.jammerType === 'None' ? 'none' : 'block';
    inputs.jamPower.value = p.jamPower;
    inputs.jamPowerVal.textContent = p.jamPower;
    inputs.nSensors.value = p.nSensors;
    inputs.nSensorsVal.textContent = p.nSensors;
    inputs.sensorRadius.value = p.sensorRadius;
    inputs.sensorRadiusVal.textContent = p.sensorRadius;
    inputs.sensorRange.value = p.sensorRange;
    inputs.sensorRangeVal.textContent = p.sensorRange;
    inputs.noiseStd.value = p.noiseStd;
    inputs.noiseStdVal.textContent = p.noiseStd;
    inputs.simDt.value = p.simDt;

    const isJam = p.jammerType !== 'None';
    chipJammer.className = isJam ? 'chip active' : 'chip nominal';
    chipJammer.innerHTML = `<span class="chip-dot"></span> EW JAMMER: ${isJam ? p.jammerType.toUpperCase() : 'STANDBY'}`;
}

// ── Master Simulation Execution ──
function getParams() {
    return {
        swarmFormation: inputs.swarmFormation ? inputs.swarmFormation.value : "Single",
        droneSpeed: parseFloat(inputs.droneSpeed.value),
        droneAltitude: parseFloat(inputs.droneAltitude.value),
        trajectoryMode: "Waypoint Incursion",
        nChannels: parseInt(inputs.nChannels.value, 10),
        hopRate: parseFloat(inputs.hopRate.value),
        jammerType: inputs.jammerType.value,
        jamPower: parseFloat(inputs.jamPower.value),
        nSensors: parseInt(inputs.nSensors.value, 10),
        sensorRadius: parseFloat(inputs.sensorRadius.value),
        sensorRange: parseFloat(inputs.sensorRange.value),
        noiseStd: parseFloat(inputs.noiseStd.value),
        simDt: parseFloat(inputs.simDt.value)
    };
}

function executeSimulation() {
    pausePlayback();
    currentParams = getParams();

    // 1. Generate Multi-Drone Swarm Trajectories
    const swarmDrones = swarmEngine.generateSwarmTrajectories(
        currentParams.swarmFormation,
        currentParams.droneSpeed,
        currentParams.droneAltitude,
        currentParams.simDt
    );

    // Primary baseline simulation runs for Lead Drone
    currentSimResults = runSimulationPipeline(currentParams);
    currentSimResults.swarmDrones = swarmDrones;
    // Replace lead trajectory with primary swarm drone trajectory
    currentSimResults.trajectory = swarmDrones[0].trajectory;

    // Calculate Kinetic Interceptor Engagement against Lead/Most Threatening Drone
    const autoLaunchTrigger = inputs.interceptorAutoLaunch ? inputs.interceptorAutoLaunch.value : 'warning';
    let launchTime = 0.0;

    if (autoLaunchTrigger === 'warning') {
        const firstWarn = currentSimResults.alerts.find(a => a.severity === 'WARNING' || a.severity === 'CRITICAL');
        launchTime = firstWarn ? firstWarn.timestamp : 999.0;
    } else if (autoLaunchTrigger === 'info') {
        const firstInfo = currentSimResults.alerts.find(a => a.severity === 'INFO');
        launchTime = firstInfo ? firstInfo.timestamp : 999.0;
    } else if (autoLaunchTrigger === 'immediate') {
        launchTime = 0.0;
    } else {
        launchTime = 9999.0; // disabled
    }

    interceptor.maxSpeed = parseFloat(inputs.interceptorSpeed ? inputs.interceptorSpeed.value : 35.0);
    interceptor.navConstant = parseFloat(inputs.interceptorNavN ? inputs.interceptorNavN.value : 3.5);
    
    currentSimResults.interception = interceptor.simulateInterception(
        currentSimResults.trajectory,
        launchTime,
        currentParams.simDt
    );

    // Calculate Directional Beamforming EW Tracking
    if (currentParams.jammerType === 'Directional') {
        const beamBw = parseFloat(inputs.beamWidth ? inputs.beamWidth.value : 28.0);
        directionalJammer.totalPowerDbm = currentParams.jamPower;
        directionalJammer.beamwidthDeg = beamBw;
        directionalJammer.beamwidthRad = (beamBw * Math.PI) / 180.0;
        directionalJammer.reset();

        const beamHistory = [];
        for (let i = 0; i < currentSimResults.times.length; i++) {
            const t = currentSimResults.times[i];
            const p = currentSimResults.trajectory[i];
            const track = directionalJammer.trackAndEvaluate(t, p.x, p.y, currentParams.simDt);
            beamHistory.push(track);

            // Dynamically recalculate SNR based on high-gain directional beam lock
            if (track.isLocked) {
                currentSimResults.snrSeries[i] = Math.max(-15.0, currentSimResults.snrSeries[i] - 18.0);
                currentSimResults.lqSeries[i] = Math.max(0.02, currentSimResults.lqSeries[i] * 0.15);
                currentSimResults.jammedSeries[i] = true;
            }
        }
        currentSimResults.beamHistory = beamHistory;
    }

    const totalSteps = currentSimResults.trajectory.length - 1;
    timeScrubber.min = 0;
    timeScrubber.max = totalSteps;
    timeScrubber.value = totalSteps;
    playbackIndex = totalSteps;

    const maxT = currentSimResults.times[totalSteps];
    playbackTimeMax.textContent = `${maxT.toFixed(1)}s`;

    renderDashboard();
    updatePlaybackTelemetry();
}

inputs.runSimBtn.addEventListener('click', () => {
    soundFX.ping();
    executeSimulation();
    
    // Automatically switch back to Tactical Radar tab to view simulated mission
    document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const radarTabBtn = document.querySelector('.nav-tab-btn[data-tab="tab-map"]');
    const radarPane = document.getElementById('tab-map');
    if (radarTabBtn && radarPane) {
        radarTabBtn.classList.add('active');
        radarPane.classList.add('active');
        window.dispatchEvent(new Event('resize'));
    }
});

// ── Playback Engine ──
function startPlayback() {
    if (isPlaying) return;
    if (playbackIndex >= currentSimResults.trajectory.length - 1) {
        playbackIndex = 0;
    }
    isPlaying = true;
    playBtn.textContent = '⏸ PAUSE';
    playBtn.style.background = 'linear-gradient(135deg, #ffaa00, #ff1744)';
    playBtn.style.color = '#ffffff';

    const stepMs = Math.max(20, (currentParams.simDt * 1000) / playbackSpeed);
    playInterval = setInterval(() => {
        if (playbackIndex < currentSimResults.trajectory.length - 1) {
            playbackIndex++;
            timeScrubber.value = playbackIndex;
            updatePlaybackTelemetry();
            renderTacticalMap();
        } else {
            pausePlayback();
        }
    }, stepMs);
}

function pausePlayback() {
    isPlaying = false;
    if (playInterval) clearInterval(playInterval);
    playBtn.textContent = '▶ PLAY';
    playBtn.style.background = 'linear-gradient(135deg, #00f0ff, #00b0ff)';
    playBtn.style.color = '#05060b';
}

playBtn.addEventListener('click', () => {
    if (isPlaying) pausePlayback();
    else startPlayback();
});

resetPlayBtn.addEventListener('click', () => {
    pausePlayback();
    playbackIndex = 0;
    timeScrubber.value = 0;
    updatePlaybackTelemetry();
    renderTacticalMap();
});

stepPlayBtn.addEventListener('click', () => {
    pausePlayback();
    if (playbackIndex < currentSimResults.trajectory.length - 1) {
        playbackIndex++;
        timeScrubber.value = playbackIndex;
        updatePlaybackTelemetry();
        renderTacticalMap();
    }
});

timeScrubber.addEventListener('input', () => {
    pausePlayback();
    playbackIndex = parseInt(timeScrubber.value, 10);
    updatePlaybackTelemetry();
    renderTacticalMap();
});

document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        playbackSpeed = parseFloat(btn.dataset.speed);
        if (isPlaying) {
            pausePlayback();
            startPlayback();
        }
    });
});

function updatePlaybackTelemetry() {
    if (!currentSimResults) return;
    const pt = currentSimResults.trajectory[playbackIndex];
    const loc = currentSimResults.locResults[playbackIndex];
    const t = currentSimResults.times[playbackIndex];
    const snr = currentSimResults.snrSeries[playbackIndex];
    const lq = currentSimResults.lqSeries[playbackIndex];

    playbackTimeDisplay.textContent = `${t.toFixed(2)}s`;
    livePositionPill.textContent = `POS: (${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}, ${pt.z.toFixed(0)}m)`;
    liveSensorsPill.textContent = `SENSORS: ${loc.numSensors} DETECTING`;
    liveSensorsPill.style.color = loc.numSensors >= 3 ? THEME.accentGreen : THEME.alertWarn;
    liveSnrPill.textContent = `SNR: ${snr > 0 ? '+' : ''}${snr.toFixed(1)} dB`;
    liveSnrPill.style.color = snr >= 10 ? THEME.accentCyan : THEME.alertCrit;

    // Update Floating HUD Target Coordinate tag
    const hudTargetPos = document.getElementById('hudTargetPos');
    if (hudTargetPos) {
        hudTargetPos.textContent = `POS: (${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}, ${pt.z.toFixed(0)}m)`;
    }

    // Distance to base (origin [0, 0])
    const distBase = Math.hypot(pt.x, pt.y);
    const execDistBase = document.getElementById('execDistBase');
    if (execDistBase) {
        execDistBase.textContent = `${distBase.toFixed(0)}m`;
        execDistBase.style.color = distBase < 200 ? THEME.alertCrit : (distBase < 400 ? THEME.alertWarn : '#ffffff');
    }

    const execLq = document.getElementById('execLq');
    if (execLq) {
        execLq.textContent = `${(lq * 100).toFixed(0)}%`;
        execLq.style.color = lq > 0.6 ? THEME.accentCyan : THEME.alertCrit;
    }

    // Update Circular Gauges in Tab 3
    if (gaugeLqCircle && gaugeLqText) {
        setCircularGauge(gaugeLqCircle, gaugeLqText, lq * 100, '%', lq > 0.6 ? THEME.accentGreen : THEME.alertCrit);
    }
    if (gaugeSnrCircle && gaugeSnrText) {
        setCircularGauge(gaugeSnrCircle, gaugeSnrText, snr, 'dB', snr >= 10 ? THEME.accentCyan : THEME.alertCrit, true);
    }
    if (gaugeAccCircle && gaugeAccText) {
        setCircularGauge(gaugeAccCircle, gaugeAccText, loc.confidence * 100, '%', loc.confidence > 0.5 ? THEME.accentBlue : THEME.alertWarn);
    }

    // Update Swarm Threat Ranking Matrix Strip
    const threatStrip = document.getElementById('swarmThreatStrip');
    if (threatStrip && currentSimResults.swarmDrones) {
        const rankings = swarmEngine.evaluateThreatPriorities(currentSimResults.swarmDrones, playbackIndex, currentSimResults.zoneVertices);
        let stripHtml = '';
        rankings.forEach((r, rankIdx) => {
            const badgeClass = r.threatLevel === 'CRITICAL' ? 'crit' : (r.threatLevel === 'ELEVATED' ? 'warn' : 'clear');
            stripHtml += `
                <div style="background: rgba(13, 17, 30, 0.9); border: 1px solid ${r.color}; border-radius: 8px; padding: 6px 10px; min-width: 200px; display: flex; align-items: center; justify-content: space-between; font-family: var(--font-mono); font-size: 0.72rem; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                    <div>
                        <div style="color: ${r.color}; font-weight: 800;">#${rankIdx + 1} ${r.callsign}</div>
                        <div style="color: var(--text-muted); font-size: 0.65rem;">${r.role} &bull; ${r.distBase.toFixed(0)}m TO HQ</div>
                    </div>
                    <div style="text-align: right;">
                        <span class="status-badge ${badgeClass}" style="padding: 2px 6px; font-size: 0.65rem; margin:0;">${r.threatScore.toFixed(0)}% THREAT</span>
                    </div>
                </div>
            `;
        });
        threatStrip.innerHTML = stripHtml;
    }

    // Audio cue on alert events during playback
    const currentAlert = currentSimResults.alerts.find(a => Math.abs(a.timestamp - t) < currentParams.simDt * 0.9);
    if (currentAlert) {
        if (currentAlert.severity === 'CRITICAL') {
            soundFX.alarm();
            radarViewport.classList.add('threat-active');
        } else {
            radarViewport.classList.remove('threat-active');
        }
    } else {
        radarViewport.classList.remove('threat-active');
    }
}

function setCircularGauge(circleElem, textElem, val, unit, color, isRawVal = false) {
    const radius = 40;
    const circumference = 2 * Math.PI * radius; // ~251.2
    const displayVal = isRawVal ? (val > 0 ? `+${val.toFixed(0)}` : `${val.toFixed(0)}`) : `${Math.round(val)}`;
    textElem.textContent = `${displayVal}${unit}`;

    const percent = Math.max(0, Math.min(100, isRawVal ? Math.max(0, (val + 20) * 1.5) : val));
    const offset = circumference - (percent / 100) * circumference;
    circleElem.style.strokeDashoffset = offset;
    circleElem.style.stroke = color;
}

// ── Rendering Dashboard ──
function renderDashboard() {
    updateKPIs();
    renderAARScorecard();
    renderTacticalMap();
    if (document.getElementById('coverageHeatmapChart')) renderCoverageHeatmap();
    if (document.getElementById('linkQualityChart')) renderLinkQuality();
    if (document.getElementById('trackingErrorChart')) renderTrackingError();
    if (document.getElementById('waterfallChart')) renderWaterfall();
    if (document.getElementById('alertsTableBody')) renderAlerts();
}

function renderAARScorecard() {
    const banner = document.getElementById('aarBanner');
    if (!banner || !currentSimResults) return;

    const report = analyticsEngine.generateAfterActionReport(currentSimResults, currentParams);
    if (!report) return;

    const badge = document.getElementById('aarGradeBadge');
    if (badge) {
        badge.textContent = report.letterGrade;
        badge.style.color = report.letterGrade.startsWith('A') ? THEME.accentEmerald : (report.letterGrade === 'B' ? THEME.accentAmber : THEME.alertCrit);
        badge.style.borderColor = badge.style.color;
        badge.style.background = `rgba(${report.letterGrade.startsWith('A') ? '0,255,102' : (report.letterGrade === 'B' ? '255,170,0' : '255,23,68')}, 0.15)`;
    }

    const summaryText = document.getElementById('aarSummaryText');
    if (summaryText) {
        summaryText.innerHTML = `
            SCORE: <strong style="color:var(--accent-cyan)">${report.compositeScore}%</strong> &bull; 
            INTEGRITY: <strong style="color:var(--accent-emerald)">${report.integrityScore}%</strong> &bull; 
            INTERCEPT: <strong style="color:${report.interceptStatus.includes('SUCCESS') ? 'var(--accent-emerald)' : 'var(--accent-amber)'}">${report.interceptStatus}</strong> &bull; 
            EW DENIAL: <strong style="color:var(--accent-purple)">${report.ewDenialScore}%</strong> &bull; 
            MEAN ERROR: <strong style="color:var(--text-primary)">${report.meanTrackErr}m</strong>
        `;
    }
}

function renderCoverageHeatmap() {
    const res = currentSimResults;
    const heatmap = analyticsEngine.generateCoverageHeatmap(res.sensorNodes, 30);

    const trace = {
        x: heatmap.x,
        y: heatmap.y,
        z: heatmap.z,
        type: 'heatmap',
        colorscale: [
            [0.0, '#00ff66'],   // Sub-meter GDOP precision (optimal)
            [0.25, '#00b0ff'],
            [0.5, '#ffaa00'],
            [0.75, '#ff007f'],
            [1.0, '#141a2e']    // Sensor blindspot
        ],
        zmin: 1.0,
        zmax: 10.0,
        colorbar: {
            title: 'GDOP (Dilution)',
            titleside: 'right',
            tickfont: { color: THEME.accentCyan, family: 'JetBrains Mono' }
        },
        hoverinfo: 'x+y+z'
    };

    const layout = {
        ...plotlyLayoutDefaults,
        title: { text: '🗺️ BATTLESPACE SENSOR GDOP & ACCURACY COVERAGE MATRIX', font: { size: 12, color: THEME.accentCyan } },
        xaxis: { ...plotlyLayoutDefaults.xaxis, title: 'Easting (m)', scaleanchor: 'y', scaleratio: 1 },
        yaxis: { ...plotlyLayoutDefaults.yaxis, title: 'Northing (m)' },
        showlegend: false
    };

    Plotly.newPlot('coverageHeatmapChart', [trace], layout, { responsive: true });
}

function updateKPIs() {
    const res = currentSimResults;
    const validErrors = res.errors.filter(e => e !== null);
    const meanErr = validErrors.length ? (validErrors.reduce((a, b) => a + b, 0) / validErrors.length) : 0;
    const maxErr = validErrors.length ? Math.max(...validErrors) : 0;

    const nCrit = res.alerts.filter(a => a.severity === 'CRITICAL').length;
    const nWarn = res.alerts.filter(a => a.severity === 'WARNING').length;
    const nInfo = res.alerts.filter(a => a.severity === 'INFO').length;

    const kpiMeanErr = document.getElementById('kpiMeanErr');
    if (kpiMeanErr) kpiMeanErr.textContent = `${meanErr.toFixed(1)}m`;
    const kpiMaxErr = document.getElementById('kpiMaxErr');
    if (kpiMaxErr) kpiMaxErr.textContent = `${maxErr.toFixed(1)}m`;
    const kpiCrit = document.getElementById('kpiCrit');
    if (kpiCrit) kpiCrit.textContent = nCrit;

    const badge = document.getElementById('statusBadge');
    const badgeText = document.getElementById('badgeText');
    if (badge && badgeText) {
        badge.className = 'status-badge';
        if (nCrit > 0) {
            badge.classList.add('crit');
            badgeText.textContent = 'DEFCON 1: INTRUSION';
            hudDefcon.textContent = 'DEFCON 1 (INTRUSION)';
            hudDefcon.style.color = THEME.alertCrit;
        } else if (nWarn > 0) {
            badge.classList.add('warn');
            badgeText.textContent = 'DEFCON 2: BREACH';
            hudDefcon.textContent = 'DEFCON 2 (BREACH)';
            hudDefcon.style.color = THEME.alertWarn;
        } else {
            badge.classList.add('clear');
            badgeText.textContent = 'DEFCON 4: CLEAR';
            hudDefcon.textContent = 'DEFCON 4 (CLEAR)';
            hudDefcon.style.color = THEME.accentGreen;
        }
    }
}

// ── Chart 1: Tactical Radar Map (2D & 3D Volumetric) ──
function renderTacticalMap() {
    if (!currentSimResults) return;

    if (currentViewMode === '3D') {
        render3DMap();
    } else {
        render2DMap();
    }
}

function render2DMap() {
    const res = currentSimResults;
    const traces = [];
    const curIdx = playbackIndex;
    const curPt = res.trajectory[curIdx];
    const curLoc = res.locResults[curIdx];

    // 0. Range Concentric Compass Grid (200m, 400m, 600m)
    [200, 400, 600].forEach(r => {
        const theta = Array.from({ length: 90 }, (_, i) => (2 * Math.PI * i) / 89);
        traces.push({
            x: theta.map(th => r * Math.cos(th)),
            y: theta.map(th => r * Math.sin(th)),
            mode: 'lines',
            line: { color: 'rgba(0, 240, 255, 0.08)', width: 1, dash: 'dot' },
            name: `${r}m Radar Range`,
            hoverinfo: 'skip',
            showlegend: false
        });
    });

    // 1. Warning Buffer Zone
    const zv = res.zoneVertices;
    const bufferVerts = [
        [zv[0][0] - 100, zv[0][1] - 100],
        [zv[1][0] + 100, zv[1][1] - 100],
        [zv[2][0] + 100, zv[2][1] + 100],
        [zv[3][0] - 100, zv[3][1] + 100],
        [zv[0][0] - 100, zv[0][1] - 100]
    ];
    traces.push({
        x: bufferVerts.map(p => p[0]),
        y: bufferVerts.map(p => p[1]),
        fill: 'toself',
        fillcolor: THEME.bufferFill,
        line: { color: THEME.bufferBorder, width: 1.5, dash: 'dot' },
        name: `Warning Buffer (100m)`,
        hoverinfo: 'name'
    });

    // 2. Critical No-Fly Zone
    const zoneClosed = [...zv, zv[0]];
    traces.push({
        x: zoneClosed.map(p => p[0]),
        y: zoneClosed.map(p => p[1]),
        fill: 'toself',
        fillcolor: THEME.zoneFill,
        line: { color: THEME.zoneBorder, width: 2.5 },
        name: 'No-Fly Zone',
        hoverinfo: 'name'
    });

    // 3. Sensor Coverage Rings
    res.sensorNodes.forEach((s, idx) => {
        const theta = Array.from({ length: 60 }, (_, i) => (2 * Math.PI * i) / 59);
        const cx = theta.map(th => s.x + s.detectionRange * Math.cos(th));
        const cy = theta.map(th => s.y + s.detectionRange * Math.sin(th));
        traces.push({
            x: cx,
            y: cy,
            fill: 'toself',
            fillcolor: THEME.sensorRange,
            line: { color: THEME.sensorRangeBorder, width: 1, dash: 'dash' },
            name: idx === 0 ? 'Sensor Coverage' : undefined,
            showlegend: idx === 0,
            hoverinfo: 'skip'
        });
    });

    // 4. Live Sensor Detection Pings & Rays (Current Step)
    const detectingSensors = [];
    res.sensorNodes.forEach(s => {
        const dist = Math.hypot(curPt.x - s.x, curPt.y - s.y, curPt.z);
        if (dist <= s.detectionRange) {
            detectingSensors.push(s);
            traces.push({
                x: [s.x, curPt.x],
                y: [s.y, curPt.y],
                mode: 'lines',
                line: { color: 'rgba(0, 255, 102, 0.45)', width: 2, dash: 'dot' },
                hoverinfo: 'skip',
                showlegend: false
            });
        }
    });

    // 5. Sensor Nodes Markers (Green if detecting, blue if idle)
    traces.push({
        x: res.sensorNodes.map(s => s.x),
        y: res.sensorNodes.map(s => s.y),
        mode: 'markers+text',
        marker: {
            size: 14,
            color: res.sensorNodes.map(s => detectingSensors.includes(s) ? THEME.sensorActive : THEME.sensor),
            symbol: 'diamond',
            line: { width: 2, color: '#ffffff' }
        },
        text: res.sensorNodes.map(s => `S${s.nodeId}`),
        textposition: 'top center',
        textfont: { size: 10, color: THEME.accentCyan, family: 'JetBrains Mono' },
        name: 'RF Sensors'
    });

    // 6. Multi-Drone Swarm Flight Paths (up to current index)
    if (res.swarmDrones && res.swarmDrones.length > 1) {
        res.swarmDrones.forEach((d, dIdx) => {
            const pastSwarm = d.trajectory.slice(0, curIdx + 1);
            const curSwarmPt = d.trajectory[curIdx];

            traces.push({
                x: pastSwarm.map(p => p.x),
                y: pastSwarm.map(p => p.y),
                mode: 'lines',
                line: { color: d.color, width: dIdx === 0 ? 3 : 2, dash: dIdx === 0 ? 'solid' : 'dot' },
                name: `${d.callsign} (${d.role})`,
                opacity: 0.85
            });

            if (curSwarmPt) {
                traces.push({
                    x: [curSwarmPt.x],
                    y: [curSwarmPt.y],
                    mode: 'markers+text',
                    marker: {
                        size: 16,
                        color: d.color,
                        symbol: 'cross-thin-open',
                        line: { width: 3, color: d.color }
                    },
                    text: [`[${d.id}] ${d.callsign}`],
                    textposition: 'bottom right',
                    textfont: { size: 9, color: d.color, family: 'JetBrains Mono' },
                    showlegend: false
                });
            }
        });
    } else {
        // Single Drone Fallback Path
        const pastTrajectory = res.trajectory.slice(0, curIdx + 1);
        traces.push({
            x: pastTrajectory.map(p => p.x),
            y: pastTrajectory.map(p => p.y),
            mode: 'lines',
            line: { color: THEME.truePath, width: 3 },
            name: 'Ground Truth Path',
            opacity: 0.9
        });

        traces.push({
            x: [curPt.x],
            y: [curPt.y],
            mode: 'markers+text',
            marker: {
                size: 18,
                color: '#00f0ff',
                symbol: 'cross-thin-open',
                line: { width: 4, color: '#00f0ff' }
            },
            text: [`[TARGET 01] ALT:${curPt.z.toFixed(0)}m`],
            textposition: 'bottom right',
            textfont: { size: 10, color: '#00f0ff', family: 'JetBrains Mono' },
            name: 'Hostile Drone Target'
        });
    }

    // 7. Estimated Path (up to current index)
    const pastLocs = res.locResults.slice(0, curIdx + 1).filter(l => l.hasFix);
    if (pastLocs.length) {
        traces.push({
            x: pastLocs.map(l => l.estX),
            y: pastLocs.map(l => l.estY),
            mode: 'lines+markers',
            line: { color: THEME.estPath, width: 2, dash: 'dot' },
            marker: { size: 4, color: THEME.estPath },
            name: 'Trilateration Fixes',
            opacity: 0.85
        });
    }

    // 9. Trajectory Prediction & EKF Projection
    const horizon = parseFloat(inputs.predHorizon ? inputs.predHorizon.value : 5.0);
    predictor.reset();
    predictor.dt = currentParams.simDt;

    // Feed recent localization fixes up to curIdx
    const feedStart = Math.max(0, curIdx - 15);
    for (let k = feedStart; k <= curIdx; k++) {
        const lFix = res.locResults[k];
        const tStep = res.times[k];
        if (lFix && lFix.hasFix) {
            predictor.update(tStep, lFix.estX, lFix.estY, lFix.confidence, true);
        } else {
            // Fallback to ground truth if sensor lost fix
            predictor.update(tStep, res.trajectory[k].x, res.trajectory[k].y, 0.5, true);
        }
    }

    const prediction = predictor.predict(horizon, curPt.z);
    const breachInfo = predictor.checkGeofenceBreach(prediction.points, zv);

    // Update Live TTB Telemetry Pill and Executive Metric Card
    const execTtb = document.getElementById('execTtb');
    if (liveTtbPill) {
        if (breachInfo.willBreach) {
            liveTtbPill.textContent = `PREDICTED TTB: ${breachInfo.timeToBreach.toFixed(1)}s (BREACH)`;
            liveTtbPill.style.color = THEME.alertCrit;
            liveTtbPill.style.borderColor = THEME.alertCrit;
            if (execTtb) {
                execTtb.textContent = `${breachInfo.timeToBreach.toFixed(1)}s`;
                execTtb.className = 'exec-val highlight-red';
            }
        } else {
            liveTtbPill.textContent = `PREDICTED TTB: NONE (CLEAR)`;
            liveTtbPill.style.color = THEME.accentGreen;
            liveTtbPill.style.borderColor = 'rgba(0, 240, 255, 0.2)';
            if (execTtb) {
                execTtb.textContent = `CLEAR`;
                execTtb.className = 'exec-val highlight-amber';
            }
        }
    }

    // Render 95% Uncertainty Cone Envelope
    const showCone = inputs.showUncertaintyCone ? inputs.showUncertaintyCone.checked : true;
    if (showCone && prediction.upperBounds.length > 0) {
        const coneX = [
            curPt.x,
            ...prediction.upperBounds.map(p => p.x),
            ...prediction.lowerBounds.slice().reverse().map(p => p.x),
            curPt.x
        ];
        const coneY = [
            curPt.y,
            ...prediction.upperBounds.map(p => p.y),
            ...prediction.lowerBounds.slice().reverse().map(p => p.y),
            curPt.y
        ];

        traces.push({
            x: coneX,
            y: coneY,
            fill: 'toself',
            fillcolor: 'rgba(255, 0, 127, 0.08)',
            line: { color: 'rgba(255, 0, 127, 0.25)', width: 1, dash: 'dot' },
            name: `Prediction Cone (±95% Conf)`,
            hoverinfo: 'name'
        });
    }

    // Render Predicted Flight Path Line
    if (prediction.points.length > 0) {
        traces.push({
            x: [curPt.x, ...prediction.points.map(p => p.x)],
            y: [curPt.y, ...prediction.points.map(p => p.y)],
            mode: 'lines',
            line: { color: '#ff007f', width: 3, dash: 'dash' },
            name: `Predicted Path (+${horizon.toFixed(1)}s)`,
            opacity: 0.95
        });

        // Projected End Horizon Waypoint
        const endPred = prediction.points[prediction.points.length - 1];
        traces.push({
            x: [endPred.x],
            y: [endPred.y],
            mode: 'markers+text',
            marker: { size: 10, color: '#ff007f', symbol: 'star' },
            text: [`T+${horizon.toFixed(1)}s`],
            textposition: 'top right',
            textfont: { size: 9, color: '#ff007f', family: 'JetBrains Mono' },
            showlegend: false,
            name: 'Predicted Horizon Target'
        });
    }

    // Render Predicted Intercept Crosshair if breach is imminent
    if (breachInfo.willBreach && breachInfo.interceptPoint) {
        traces.push({
            x: [breachInfo.interceptPoint[0]],
            y: [breachInfo.interceptPoint[1]],
            mode: 'markers+text',
            marker: {
                size: 14,
                color: THEME.alertCrit,
                symbol: 'x-thin-open',
                line: { width: 3, color: THEME.alertCrit }
            },
            text: [`⚠️ BREACH INTERCEPT (T+${breachInfo.timeToBreach.toFixed(1)}s)`],
            textposition: 'top center',
            textfont: { size: 10, color: THEME.alertCrit, family: 'JetBrains Mono' },
            name: 'Predicted Breach Intercept Point'
        });
    }

    // 10. Live Estimated Fix Marker & Uncertainty Ring
    if (curLoc && curLoc.hasFix) {
        traces.push({
            x: [curLoc.estX],
            y: [curLoc.estY],
            mode: 'markers',
            marker: {
                size: 14,
                color: THEME.estPath,
                symbol: 'circle-dot',
                line: { width: 2, color: '#ffffff' }
            },
            name: 'Estimated Multilateration Fix'
        });
    }

    // 11. Autonomous Kinetic Interceptor Trail & Engagement
    if (res.interception && res.interception.flightPath.length > 0) {
        const interceptorPath = res.interception.flightPath.slice(0, curIdx + 1);
        const curInt = res.interception.flightPath[curIdx];

        if (curInt && curInt.status !== 'STANDBY') {
            // Interceptor Pursuit Trail
            traces.push({
                x: interceptorPath.map(p => p.x),
                y: interceptorPath.map(p => p.y),
                mode: 'lines',
                line: { color: '#00ff66', width: 3, dash: 'solid' },
                name: 'Friendly Interceptor Flight Path',
                opacity: 0.9
            });

            // Interceptor Head Marker
            traces.push({
                x: [curInt.x],
                y: [curInt.y],
                mode: 'markers+text',
                marker: {
                    size: 16,
                    color: '#00ff66',
                    symbol: 'triangle-up',
                    line: { width: 2, color: '#ffffff' }
                },
                text: [`[DEFENSE 01] ${curInt.speed.toFixed(0)}m/s`],
                textposition: 'top center',
                textfont: { size: 10, color: '#00ff66', family: 'JetBrains Mono' },
                name: 'Counter-Drone Interceptor'
            });

            // Mid-Air Kill Explosion Marker if neutralized
            if (curInt.status === 'KILL_CONFIRMED') {
                traces.push({
                    x: [curInt.x],
                    y: [curInt.y],
                    mode: 'markers+text',
                    marker: {
                        size: 26,
                        color: 'rgba(255, 23, 68, 0.8)',
                        symbol: 'star-diamond',
                        line: { width: 3, color: '#ffffff' }
                    },
                    text: [`💥 KINETIC NEUTRALIZATION CONFIRMED`],
                    textposition: 'bottom center',
                    textfont: { size: 11, color: '#ff1744', family: 'JetBrains Mono' },
                    name: 'Target Neutralization Event'
                });
            }
        }
    }

    // 12. Steerable Directional Beamforming EW RF Cone
    if (res.beamHistory && res.beamHistory[curIdx]) {
        const beam = res.beamHistory[curIdx];
        directionalJammer.currentAzimuthRad = beam.boresightAngleRad;
        const cone = directionalJammer.getBeamConePolygon(600.0, 20);

        traces.push({
            x: cone.x,
            y: cone.y,
            fill: 'toself',
            fillcolor: beam.isLocked ? 'rgba(255, 23, 68, 0.18)' : 'rgba(255, 170, 0, 0.12)',
            line: {
                color: beam.isLocked ? '#ff1744' : '#ffaa00',
                width: 2,
                dash: 'dash'
            },
            name: `EW Beam (${beam.isLocked ? '🎯 LOCKED +18dBi' : 'SLEWING'})`,
            hoverinfo: 'name'
        });
    }

    const layout = {
        ...plotlyLayoutDefaults,
        title: { text: `🎯 TACTICAL SITUATIONAL RADAR MATRIX (T = ${curPt.t.toFixed(2)}s &bull; PREDICTION +${horizon.toFixed(1)}s)`, font: { size: 13, color: THEME.accentCyan } },
        xaxis: { ...plotlyLayoutDefaults.xaxis, title: 'EASTING (METERS)', scaleanchor: 'y', scaleratio: 1 },
        yaxis: { ...plotlyLayoutDefaults.yaxis, title: 'NORTHING (METERS)' },
        showlegend: true
    };

    Plotly.newPlot('tacticalMapChart', traces, layout, {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d']
    });
}

function render3DMap() {
    const res = currentSimResults;
    const curIdx = playbackIndex;
    const curPt = res.trajectory[curIdx];

    const traces = [];

    // 1. Ground Truth Flight Path 3D
    const pastTrajectory = res.trajectory.slice(0, curIdx + 1);
    traces.push({
        type: 'scatter3d',
        x: pastTrajectory.map(p => p.x),
        y: pastTrajectory.map(p => p.y),
        z: pastTrajectory.map(p => p.z),
        mode: 'lines',
        line: { color: THEME.truePath, width: 6 },
        name: '3D Hostile Flight Trajectory'
    });

    // 2. Trilateration 3D Fixes
    const pastLocs = res.locResults.slice(0, curIdx + 1).filter(l => l.hasFix);
    if (pastLocs.length) {
        traces.push({
            type: 'scatter3d',
            x: pastLocs.map(l => l.estX),
            y: pastLocs.map(l => l.estY),
            z: pastLocs.map(() => currentParams.droneAltitude),
            mode: 'lines+markers',
            line: { color: THEME.estPath, width: 4, dash: 'dot' },
            marker: { size: 3, color: THEME.estPath },
            name: 'Estimated 3D Multilateration'
        });
    }

    // 3. Predicted 3D Trajectory
    const horizon = parseFloat(inputs.predHorizon ? inputs.predHorizon.value : 5.0);
    predictor.reset();
    predictor.dt = currentParams.simDt;
    const feedStart = Math.max(0, curIdx - 15);
    for (let k = feedStart; k <= curIdx; k++) {
        const lFix = res.locResults[k];
        const tStep = res.times[k];
        if (lFix && lFix.hasFix) {
            predictor.update(tStep, lFix.estX, lFix.estY, lFix.confidence, true);
        } else {
            predictor.update(tStep, res.trajectory[k].x, res.trajectory[k].y, 0.5, true);
        }
    }
    const pred3D = predictor.predict(horizon, curPt.z);
    if (pred3D.points.length > 0) {
        traces.push({
            type: 'scatter3d',
            x: [curPt.x, ...pred3D.points.map(p => p.x)],
            y: [curPt.y, ...pred3D.points.map(p => p.y)],
            z: [curPt.z, ...pred3D.points.map(p => p.z)],
            mode: 'lines',
            line: { color: '#ff007f', width: 6, dash: 'dash' },
            name: `3D Predicted Route (+${horizon.toFixed(1)}s)`
        });
    }

    // 4. Sensor Ground Nodes (Z=0)
    traces.push({
        type: 'scatter3d',
        x: res.sensorNodes.map(s => s.x),
        y: res.sensorNodes.map(s => s.y),
        z: res.sensorNodes.map(() => 0),
        mode: 'markers+text',
        marker: { size: 8, color: THEME.sensor, symbol: 'diamond' },
        text: res.sensorNodes.map(s => `S${s.nodeId}`),
        textposition: 'top center',
        name: 'Ground RF Nodes'
    });

    // 5. Friendly Interceptor 3D Flight Path
    if (res.interception && res.interception.flightPath.length > 0) {
        const interceptorPath = res.interception.flightPath.slice(0, curIdx + 1);
        const curInt = res.interception.flightPath[curIdx];

        if (curInt && curInt.status !== 'STANDBY') {
            traces.push({
                type: 'scatter3d',
                x: interceptorPath.map(p => p.x),
                y: interceptorPath.map(p => p.y),
                z: interceptorPath.map(p => p.z),
                mode: 'lines',
                line: { color: '#00ff66', width: 6 },
                name: '3D Friendly Interceptor Route'
            });

            traces.push({
                type: 'scatter3d',
                x: [curInt.x],
                y: [curInt.y],
                z: [curInt.z],
                mode: 'markers+text',
                marker: { size: 10, color: '#00ff66', symbol: 'diamond' },
                text: ['[DEFENSE 01]'],
                textposition: 'top center',
                name: 'Friendly Interceptor'
            });
        }
    }

    // 6. 3D Directional EW Beam Ray
    if (res.beamHistory && res.beamHistory[curIdx]) {
        const beam = res.beamHistory[curIdx];
        const beamEndX = 550.0 * Math.cos(beam.boresightAngleRad);
        const beamEndY = 550.0 * Math.sin(beam.boresightAngleRad);

        traces.push({
            type: 'scatter3d',
            x: [0, beamEndX],
            y: [0, beamEndY],
            z: [0, curPt.z],
            mode: 'lines',
            line: {
                color: beam.isLocked ? '#ff1744' : '#ffaa00',
                width: 8
            },
            name: `3D Directed EW Beam (${beam.isLocked ? 'LOCKED' : 'SLEWING'})`
        });
    }

    // 6. Live Drone 3D Marker
    traces.push({
        type: 'scatter3d',
        x: [curPt.x],
        y: [curPt.y],
        z: [curPt.z],
        mode: 'markers+text',
        marker: { size: 10, color: '#00f0ff', symbol: 'circle' },
        text: [`TARGET (Alt: ${curPt.z.toFixed(0)}m)`],
        textposition: 'top center',
        name: 'Active Target 3D'
    });

    // 5. 3D No-Fly Zone Perimeter
    const zv = res.zoneVertices;
    const zx = [...zv.map(p => p[0]), zv[0][0]];
    const zy = [...zv.map(p => p[1]), zv[0][1]];
    const maxAlt = 150;

    traces.push({
        type: 'scatter3d',
        x: zx,
        y: zy,
        z: zx.map(() => 0),
        mode: 'lines',
        line: { color: THEME.zoneBorder, width: 6 },
        name: 'No-Fly Base Perimeter'
    });
    traces.push({
        type: 'scatter3d',
        x: zx,
        y: zy,
        z: zx.map(() => maxAlt),
        mode: 'lines',
        line: { color: THEME.zoneBorder, width: 6, dash: 'dot' },
        name: 'No-Fly Ceiling (150m)'
    });

    const layout = {
        paper_bgcolor: 'transparent',
        scene: {
            bgcolor: THEME.bg,
            xaxis: { title: 'East (m)', gridcolor: THEME.grid, zerolinecolor: THEME.grid },
            yaxis: { title: 'North (m)', gridcolor: THEME.grid, zerolinecolor: THEME.grid },
            zaxis: { title: 'Altitude (m)', range: [0, 200], gridcolor: THEME.grid, zerolinecolor: THEME.grid },
            camera: {
                eye: { x: 1.5, y: -1.5, z: 1.2 }
            }
        },
        margin: { l: 0, r: 0, t: 30, b: 0 },
        legend: { bgcolor: 'rgba(14, 18, 34, 0.85)', font: { color: THEME.text, size: 10 } }
    };

    Plotly.newPlot('tacticalMapChart', traces, layout, { responsive: true });
}

// ── Chart 2: Link Quality & SNR ──
function renderLinkQuality() {
    const res = currentSimResults;
    const traceSnr = {
        x: res.times,
        y: res.snrSeries,
        mode: 'lines',
        name: 'SNR (dB)',
        line: { color: THEME.accentCyan, width: 2 }
    };
    const traceLq = {
        x: res.times,
        y: res.lqSeries.map(v => v * 100),
        mode: 'lines',
        name: 'Packet Success (%)',
        yaxis: 'y2',
        line: { color: THEME.truePath, width: 2, dash: 'dot' }
    };

    const layout = {
        ...plotlyLayoutDefaults,
        title: { text: '📡 EW RF LINK QUALITY & INTERFERENCE TIMELINE', font: { size: 12, color: THEME.accentCyan } },
        xaxis: { ...plotlyLayoutDefaults.xaxis, title: 'Mission Elapsed Time (s)' },
        yaxis: { ...plotlyLayoutDefaults.yaxis, title: 'SNR (dB)' },
        yaxis2: {
            title: 'Packet Success (%)',
            overlaying: 'y',
            side: 'right',
            range: [0, 105],
            gridcolor: 'transparent',
            font: { color: THEME.truePath }
        },
        showlegend: true
    };

    Plotly.newPlot('linkQualityChart', [traceSnr, traceLq], layout, { responsive: true });
}

// ── Chart 3: Tracking Error Analytics ──
function renderTrackingError() {
    const res = currentSimResults;
    const traceError = {
        x: res.times,
        y: res.errors,
        mode: 'lines',
        name: 'Error (m)',
        line: { color: THEME.alertWarn, width: 2 },
        fill: 'tozeroy',
        fillcolor: 'rgba(255, 170, 0, 0.08)'
    };
    const traceConf = {
        x: res.times,
        y: res.locResults.map(l => l.confidence * 100),
        mode: 'lines',
        name: 'Confidence (%)',
        yaxis: 'y2',
        line: { color: THEME.accentCyan, width: 1.5, dash: 'dot' }
    };

    const layout = {
        ...plotlyLayoutDefaults,
        title: { text: '🎯 TRILATERATION LOCALIZATION DEVIATION & CONFIDENCE', font: { size: 12, color: THEME.accentCyan } },
        xaxis: { ...plotlyLayoutDefaults.xaxis, title: 'Mission Elapsed Time (s)' },
        yaxis: { ...plotlyLayoutDefaults.yaxis, title: 'Radial Error (m)' },
        yaxis2: {
            title: 'Confidence (%)',
            overlaying: 'y',
            side: 'right',
            range: [0, 105],
            gridcolor: 'transparent',
            font: { color: THEME.accentCyan }
        },
        showlegend: true
    };

    Plotly.newPlot('trackingErrorChart', [traceError, traceConf], layout, { responsive: true });
}

// ── Chart 4: FHSS Waterfall Spectrogram ──
function renderWaterfall() {
    const res = currentSimResults;
    const trace = {
        x: res.times,
        y: res.channels,
        mode: 'markers',
        marker: {
            size: 5,
            color: res.jammedSeries.map(j => j ? '#ff1744' : '#00f0ff'),
            symbol: 'square'
        },
        name: 'Active Frequency Hop'
    };

    const layout = {
        ...plotlyLayoutDefaults,
        title: { text: `🌊 FHSS HOPPING WATERFALL SPECTROGRAM (${currentParams.nChannels} Channels)`, font: { size: 12, color: THEME.accentCyan } },
        xaxis: { ...plotlyLayoutDefaults.xaxis, title: 'Mission Elapsed Time (s)' },
        yaxis: { ...plotlyLayoutDefaults.yaxis, title: 'Hop Channel Index', range: [0, currentParams.nChannels] },
        showlegend: false
    };

    Plotly.newPlot('waterfallChart', [trace], layout, { responsive: true });
}

// ── Alert Table & Stats ──
function renderAlerts() {
    const res = currentSimResults;
    const nCrit = res.alerts.filter(a => a.severity === 'CRITICAL').length;
    const nWarn = res.alerts.filter(a => a.severity === 'WARNING').length;
    const nInfo = res.alerts.filter(a => a.severity === 'INFO').length;

    document.getElementById('statCrit').textContent = nCrit;
    document.getElementById('statWarn').textContent = nWarn;
    document.getElementById('statInfo').textContent = nInfo;

    const tbody = document.getElementById('alertsTableBody');
    tbody.innerHTML = '';

    if (res.alerts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#00ff66; padding:20px;">✅ Airspace Nominal: Zero perimeter violations or anomalous incursions logged.</td></tr>`;
        return;
    }

    res.alerts.forEach(a => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${a.timestamp.toFixed(2)}s</strong></td>
            <td><span class="badge-sev ${a.severity}">${a.severity}</span></td>
            <td><code>GRID (${a.estX.toFixed(1)}, ${a.estY.toFixed(1)})</code></td>
            <td>${a.message}</td>
        `;
        tbody.appendChild(row);
    });
}

// Initial simulation run on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', executeSimulation);
} else {
    executeSimulation();
}
