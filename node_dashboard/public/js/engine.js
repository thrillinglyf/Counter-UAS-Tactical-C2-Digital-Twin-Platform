/**
 * Pure JavaScript Physics & Simulation Engine for Counter-Drone Tactical Twin
 * High accuracy mathematical parity with Python NumPy / SciPy implementation.
 */

// ── Pseudo-Random Number Generator (seeded PCG / Mulberry32) ───────────
class RandomGenerator {
    constructor(seed = 42) {
        this.s = seed ? Math.abs(seed) : 42;
    }

    random() {
        let t = (this.s += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    integers(min, max) {
        return Math.floor(this.random() * (max - min)) + min;
    }

    // Box-Muller Gaussian Distribution
    normal(mean = 0, std = 1) {
        let u = 0, v = 0;
        while (u === 0) u = this.random();
        while (v === 0) v = this.random();
        let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return mean + num * std;
    }
}

// ── Layer 1: Drone Motion Model ───────────────────────────────────────
class DroneMotionModel {
    constructor(speed = 15.0, dt = 0.1, altitude = 50.0) {
        this.speed = speed;
        this.dt = dt;
        this.altitude = altitude;
    }

    generateWaypointTrajectory(waypoints) {
        const records = [];
        let t = 0.0;
        const stepDist = this.speed * this.dt;

        for (let i = 0; i < waypoints.length - 1; i++) {
            const start = waypoints[i];
            const end = waypoints[i + 1];
            const dx = end[0] - start[0];
            const dy = end[1] - start[1];
            const segLen = Math.hypot(dx, dy);

            if (segLen < 1e-9) continue;
            const dirX = dx / segLen;
            const dirY = dy / segLen;
            let traveled = 0.0;

            while (traveled < segLen) {
                const posX = start[0] + dirX * traveled;
                const posY = start[1] + dirY * traveled;
                records.push({ t, x: posX, y: posY, z: this.altitude });
                traveled += stepDist;
                t += this.dt;
            }
        }

        const last = waypoints[waypoints.length - 1];
        records.push({ t, x: last[0], y: last[1], z: this.altitude });
        return records;
    }

    generateRandomWalk(start = [-500, -400], target = [0, 0], duration = 40.0, biasStrength = 0.65, noiseStd = 6.0, seed = 42) {
        const rng = new RandomGenerator(seed);
        const steps = Math.floor(duration / this.dt);
        const records = [];
        let pos = [start[0], start[1]];
        const stepDist = this.speed * this.dt;

        for (let i = 0; i < steps; i++) {
            const t = i * this.dt;
            records.push({ t, x: pos[0], y: pos[1], z: this.altitude });

            const toTarget = [target[0] - pos[0], target[1] - pos[1]];
            const dist = Math.hypot(toTarget[0], toTarget[1]);
            if (dist < 1.0) continue;

            const dir = [toTarget[0] / dist, toTarget[1] / dist];
            const noiseX = rng.normal(0, noiseStd) * this.dt;
            const noiseY = rng.normal(0, noiseStd) * this.dt;

            let stepX = dir[0] * stepDist * biasStrength + noiseX;
            let stepY = dir[1] * stepDist * biasStrength + noiseY;
            const stepMag = Math.hypot(stepX, stepY);
            const maxStep = stepDist * 1.5;

            if (stepMag > maxStep) {
                stepX = (stepX / stepMag) * maxStep;
                stepY = (stepY / stepMag) * maxStep;
            }

            pos[0] += stepX;
            pos[1] += stepY;
        }

        return records;
    }
}

// ── Layer 1: FHSS Simulator ───────────────────────────────────────────
class FHSSSimulator {
    constructor(nChannels = 50, baseFreqMhz = 2400.0, channelSpacingMhz = 1.0, hopRate = 100.0, seed = 42) {
        this.nChannels = nChannels;
        this.baseFreqMhz = baseFreqMhz;
        this.channelSpacingMhz = channelSpacingMhz;
        this.hopRate = hopRate;
        this.sequenceLen = 100000;
        
        const rng = new RandomGenerator(seed);
        this.hopSequence = new Int32Array(this.sequenceLen);
        for (let i = 0; i < this.sequenceLen; i++) {
            this.hopSequence[i] = rng.integers(0, nChannels);
        }
    }

    getChannel(t) {
        const hopIndex = Math.floor(t * this.hopRate) % this.sequenceLen;
        return this.hopSequence[hopIndex];
    }
}

// ── Layer 1: Electronic Warfare Jammer & Link Calculator ──────────────
class JammerModel {
    jsrOnChannel(t, activeChannel) { return -Infinity; }
    isJammed(t, activeChannel) { return false; }
}

class BarrageJammer extends JammerModel {
    constructor(totalPowerDbm = 30.0, nChannels = 50) {
        super();
        this.totalPowerDbm = totalPowerDbm;
        this.nChannels = nChannels;
    }
    jsrOnChannel(t, activeChannel) {
        return this.totalPowerDbm - 10.0 * Math.log10(this.nChannels);
    }
    isJammed(t, activeChannel) { return true; }
}

class SweepJammer extends JammerModel {
    constructor(totalPowerDbm = 30.0, nChannels = 50, sweepRate = 200.0) {
        super();
        this.totalPowerDbm = totalPowerDbm;
        this.nChannels = nChannels;
        this.sweepRate = sweepRate;
    }
    sweptChannel(t) {
        return Math.floor(t * this.sweepRate) % this.nChannels;
    }
    jsrOnChannel(t, activeChannel) {
        return this.sweptChannel(t) === activeChannel ? this.totalPowerDbm : -Infinity;
    }
    isJammed(t, activeChannel) {
        return this.sweptChannel(t) === activeChannel;
    }
}

class ReactiveJammer extends JammerModel {
    constructor(totalPowerDbm = 30.0, detectionProb = 0.6, reactionDelay = 0.005, hopRate = 100.0, seed = 99) {
        super();
        this.totalPowerDbm = totalPowerDbm;
        this.detectionProb = detectionProb;
        this.reactionDelay = reactionDelay;
        this.hopRate = hopRate;
        const rng = new RandomGenerator(seed);
        this.draws = new Float32Array(50000);
        for (let i = 0; i < this.draws.length; i++) this.draws[i] = rng.random();
    }
    isJammed(t, activeChannel) {
        const hi = Math.floor(t * this.hopRate) % this.draws.length;
        const timeInHop = t - (Math.floor(t * this.hopRate) / this.hopRate);
        const detected = this.draws[hi] < this.detectionProb;
        const reacted = timeInHop >= this.reactionDelay;
        return detected && reacted;
    }
    jsrOnChannel(t, activeChannel) {
        return this.isJammed(t, activeChannel) ? this.totalPowerDbm : -Infinity;
    }
}

class LinkQualityCalculator {
    constructor(signalPowerDbm = -50.0, noiseFloorDbm = -90.0, snrThresholdDb = 10.0, sigmoidSteepness = 0.5) {
        this.signalPowerDbm = signalPowerDbm;
        this.noiseFloorDbm = noiseFloorDbm;
        this.snrThresholdDb = snrThresholdDb;
        this.sigmoidSteepness = sigmoidSteepness;
    }

    computeSnr(jsrDb) {
        let interferenceDbm;
        if (!isFinite(jsrDb) && jsrDb < 0) {
            interferenceDbm = this.noiseFloorDbm;
        } else {
            const noiseLin = Math.pow(10, this.noiseFloorDbm / 10.0);
            const jamLin = Math.pow(10, jsrDb / 10.0);
            interferenceDbm = 10.0 * Math.log10(noiseLin + jamLin);
        }
        return this.signalPowerDbm - interferenceDbm;
    }

    packetSuccessProbability(snrDb) {
        const exponent = -this.sigmoidSteepness * (snrDb - this.snrThresholdDb);
        const clampedExp = Math.max(-500, Math.min(500, exponent));
        return 1.0 / (1.0 + Math.exp(clampedExp));
    }

    linkQuality(jsrDb) {
        const snr = this.computeSnr(jsrDb);
        const lq = this.packetSuccessProbability(snr);
        return { snr, lq };
    }
}

// ── Layer 2: Sensor Network ───────────────────────────────────────────
class SensorNode {
    constructor(nodeId, x, y, detectionRange = 500.0, noiseStdDb = 3.0) {
        this.nodeId = nodeId;
        this.x = x;
        this.y = y;
        this.detectionRange = detectionRange;
        this.noiseStdDb = noiseStdDb;
    }
}

class SensorNetwork {
    constructor(txPowerDbm = 20.0, freqMhz = 2400.0) {
        this.sensors = [];
        this.txPowerDbm = txPowerDbm;
        this.freqMhz = freqMhz;
    }

    placeRing(center = [0, 0], radius = 400.0, nSensors = 8, detectionRange = 500.0, noiseStdDb = 3.0) {
        this.sensors = [];
        for (let i = 0; i < nSensors; i++) {
            const angle = (2 * Math.PI * i) / nSensors;
            const sx = center[0] + radius * Math.cos(angle);
            const sy = center[1] + radius * Math.sin(angle);
            this.sensors.push(new SensorNode(i, sx, sy, detectionRange, noiseStdDb));
        }
    }

    fsplDb(distanceM, freqMhz) {
        if (distanceM <= 0) return 0.0;
        return 20.0 * Math.log10(distanceM) + 20.0 * Math.log10(freqMhz) + 32.44;
    }

    measureRssi(droneX, droneY, droneZ = 50.0, rng = null) {
        const r = rng || new RandomGenerator();
        const readings = [];
        for (const s of this.sensors) {
            const dx = droneX - s.x;
            const dy = droneY - s.y;
            const dz = droneZ;
            const dist = Math.hypot(dx, dy, dz);

            if (dist > s.detectionRange) {
                readings.push(null);
                continue;
            }

            const fspl = this.fsplDb(dist, this.freqMhz);
            const noise = r.normal(0, s.noiseStdDb);
            const rssi = this.txPowerDbm - fspl + noise;
            readings.push({
                sensorId: s.nodeId,
                rssiDbm: rssi,
                distance: dist
            });
        }
        return readings;
    }

    measureTrajectory(trajectory, seed = 7) {
        const rng = new RandomGenerator(seed);
        return trajectory.map(pt => this.measureRssi(pt.x, pt.y, pt.z, rng));
    }
}

// ── Layer 2: Non-Linear Least Squares Trilateration & GDOP ────────────
class Localizer {
    constructor(txPowerDbm = 20.0, freqMhz = 2400.0, minSensors = 3) {
        this.txPowerDbm = txPowerDbm;
        this.freqMhz = freqMhz;
        this.minSensors = minSensors;
    }

    rssiToDistance(rssiDbm) {
        const exponent = (this.txPowerDbm - rssiDbm - 20.0 * Math.log10(this.freqMhz) - 32.44) / 20.0;
        return Math.pow(10.0, exponent);
    }

    // Levenberg-Marquardt optimizer for 2D trilateration
    trilaterate(sensorPositions, estimatedDistances, initialGuess = null) {
        const m = sensorPositions.length;
        let pos = initialGuess ? [...initialGuess] : [0, 0];
        if (!initialGuess) {
            let sx = 0, sy = 0;
            sensorPositions.forEach(p => { sx += p[0]; sy += p[1]; });
            pos = [sx / m, sy / m];
        }

        let lambda = 1e-3;
        const maxIter = 50;
        let bestRes = Infinity;

        for (let iter = 0; iter < maxIter; iter++) {
            // Compute residual vector & Jacobian (J)
            let J00 = 0, J01 = 0, J11 = 0;
            let g0 = 0, g1 = 0;
            let sumSqRes = 0;

            for (let i = 0; i < m; i++) {
                const sp = sensorPositions[i];
                const dx = pos[0] - sp[0];
                const dy = pos[1] - sp[1];
                const d = Math.max(1e-6, Math.hypot(dx, dy));
                const res = d - estimatedDistances[i];
                sumSqRes += res * res;

                const jx = dx / d;
                const jy = dy / d;

                J00 += jx * jx;
                J01 += jx * jy;
                J11 += jy * jy;

                g0 += jx * res;
                g1 += jy * res;
            }

            bestRes = sumSqRes;

            // (J^T J + lambda * I) delta = -g
            const H00 = J00 + lambda;
            const H01 = J01;
            const H11 = J11 + lambda;

            const det = H00 * H11 - H01 * H01;
            if (Math.abs(det) < 1e-12) {
                lambda *= 10;
                continue;
            }

            const inv00 = H11 / det;
            const inv01 = -H01 / det;
            const inv11 = H00 / det;

            const delta0 = -(inv00 * g0 + inv01 * g1);
            const delta1 = -(inv01 * g0 + inv11 * g1);

            const nextPos = [pos[0] + delta0, pos[1] + delta1];

            // Evaluate next residual
            let nextRes = 0;
            for (let i = 0; i < m; i++) {
                const sp = sensorPositions[i];
                const d = Math.hypot(nextPos[0] - sp[0], nextPos[1] - sp[1]);
                const r = d - estimatedDistances[i];
                nextRes += r * r;
            }

            if (nextRes < sumSqRes) {
                pos = nextPos;
                lambda = Math.max(1e-7, lambda / 10);
                if (Math.hypot(delta0, delta1) < 1e-4) break;
            } else {
                lambda *= 10;
            }
        }

        return { pos, residual: bestRes };
    }

    computeGdop(sensorPositions, estPos) {
        const n = sensorPositions.length;
        if (n < 2) return 999.0;

        let H00 = 0, H01 = 0, H11 = 0;
        for (let i = 0; i < n; i++) {
            const sp = sensorPositions[i];
            const dx = estPos[0] - sp[0];
            const dy = estPos[1] - sp[1];
            const d = Math.max(1e-6, Math.hypot(dx, dy));
            const hx = dx / d;
            const hy = dy / d;
            H00 += hx * hx;
            H01 += hx * hy;
            H11 += hy * hy;
        }

        const det = H00 * H11 - H01 * H01;
        if (Math.abs(det) < 1e-9) return 999.0;

        const trace = (H00 + H11) / det;
        return Math.sqrt(Math.max(0, trace));
    }

    scoreConfidence(numSensors, residual, gdop) {
        const sensorFactor = Math.min(numSensors / 6.0, 1.0);
        const residualFactor = Math.exp(-residual / 500.0);
        const gdopFactor = 1.0 / (1.0 + gdop / 5.0);
        const raw = 0.4 * sensorFactor + 0.35 * residualFactor + 0.25 * gdopFactor;
        return Math.max(0.0, Math.min(1.0, raw));
    }

    localizeTrajectory(times, allReadings, sensorNodes) {
        const results = [];
        let prevEstimate = null;

        for (let i = 0; i < times.length; i++) {
            const t = times[i];
            const readings = allReadings[i];
            
            const active = [];
            readings.forEach((r, sIdx) => {
                if (r !== null) active.push({ sensor: sensorNodes[sIdx], reading: r });
            });

            if (active.length < this.minSensors) {
                results.push({
                    time: t,
                    estX: null,
                    estY: null,
                    confidence: 0.0,
                    numSensors: active.length,
                    residual: Infinity,
                    hasFix: false
                });
                continue;
            }

            const sensorPos = active.map(a => [a.sensor.x, a.sensor.y]);
            const distances = active.map(a => this.rssiToDistance(a.reading.rssiDbm));

            const { pos, residual } = this.trilaterate(sensorPos, distances, prevEstimate);
            const gdop = this.computeGdop(sensorPos, pos);
            const confidence = this.scoreConfidence(active.length, residual, gdop);

            prevEstimate = pos;
            results.push({
                time: t,
                estX: pos[0],
                estY: pos[1],
                confidence,
                numSensors: active.length,
                residual,
                hasFix: true
            });
        }

        return results;
    }
}

// ── Layer 3: Rules & Threat Alerting Engine ───────────────────────────
class RulesEngine {
    constructor(zoneVertices = [[-150, -150], [150, -150], [150, 150], [-150, 150]], confidenceThreshold = 0.5, persistenceCount = 3, approachBufferM = 100.0) {
        this.zoneVertices = zoneVertices;
        this.confidenceThreshold = confidenceThreshold;
        this.persistenceCount = persistenceCount;
        this.approachBufferM = approachBufferM;
        this.consecutiveInside = 0;
        this.alerts = [];
    }

    // Ray-casting point in polygon
    isInsidePolygon(point, vs) {
        const x = point[0], y = point[1];
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i][0], yi = vs[i][1];
            const xj = vs[j][0], yj = vs[j][1];
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // Minimum distance from point to polygon edges
    distanceToPolygon(point, vs) {
        let minDist = Infinity;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const p1 = vs[j], p2 = vs[i];
            const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
            const lenSq = dx * dx + dy * dy;
            let t = lenSq === 0 ? 0 : ((point[0] - p1[0]) * dx + (point[1] - p1[1]) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = p1[0] + t * dx;
            const projY = p1[1] + t * dy;
            const dist = Math.hypot(point[0] - projX, point[1] - projY);
            if (dist < minDist) minDist = dist;
        }
        return minDist;
    }

    evaluateTrack(locResults) {
        this.alerts = [];
        this.consecutiveInside = 0;

        for (const loc of locResults) {
            if (!loc.hasFix || loc.confidence < this.confidenceThreshold) {
                this.consecutiveInside = 0;
                continue;
            }

            const pt = [loc.estX, loc.estY];
            const insideZone = this.isInsidePolygon(pt, this.zoneVertices);
            const distEdge = this.distanceToPolygon(pt, this.zoneVertices);
            const insideBuffer = insideZone || (distEdge <= this.approachBufferM);

            if (insideZone) {
                this.consecutiveInside++;
            } else {
                this.consecutiveInside = 0;
            }

            let alert = null;
            if (insideZone && this.consecutiveInside >= this.persistenceCount) {
                alert = {
                    timestamp: loc.time,
                    estX: loc.estX,
                    estY: loc.estY,
                    severity: "CRITICAL",
                    message: `CRITICAL: Drone persisting inside no-fly zone (${this.consecutiveInside} consecutive fixes). Position: (${loc.estX.toFixed(1)}, ${loc.estY.toFixed(1)})`
                };
            } else if (insideZone) {
                alert = {
                    timestamp: loc.time,
                    estX: loc.estX,
                    estY: loc.estY,
                    severity: "WARNING",
                    message: `WARNING: Drone crossed no-fly zone boundary. Position: (${loc.estX.toFixed(1)}, ${loc.estY.toFixed(1)})`
                };
            } else if (insideBuffer) {
                alert = {
                    timestamp: loc.time,
                    estX: loc.estX,
                    estY: loc.estY,
                    severity: "INFO",
                    message: `INFO: Drone approaching no-fly zone (${this.approachBufferM.toFixed(0)}m buffer). Position: (${loc.estX.toFixed(1)}, ${loc.estY.toFixed(1)})`
                };
            }

            if (alert) {
                this.alerts.push(alert);
            }
        }

        return this.alerts;
    }
}

// ── Master Pipeline Orchestrator ──────────────────────────────────────
function runSimulationPipeline(params = {}) {
    const {
        droneSpeed = 15.0,
        droneAltitude = 50.0,
        trajectoryMode = "Waypoint Incursion",
        nChannels = 50,
        hopRate = 100.0,
        jammerType = "None",
        jamPower = 30.0,
        nSensors = 8,
        sensorRadius = 400.0,
        sensorRange = 600.0,
        noiseStd = 3.0,
        simDt = 0.1
    } = params;

    // 1. Layer 1 Motion
    const drone = new DroneMotionModel(droneSpeed, simDt, droneAltitude);
    let trajectory;
    if (trajectoryMode === "Waypoint Incursion") {
        const waypoints = [
            [-500, -300],
            [-300, -100],
            [-100, 0],
            [0, 50],
            [100, 80],
            [200, 50],
            [300, -50]
        ];
        trajectory = drone.generateWaypointTrajectory(waypoints);
    } else {
        trajectory = drone.generateRandomWalk([-500, -400], [0, 0], 40.0, 0.65, 6.0, 42);
    }

    const times = trajectory.map(p => p.t);

    // 2. Layer 1 FHSS
    const fhss = new FHSSSimulator(nChannels, 2400.0, 1.0, hopRate, 42);
    const channels = times.map(t => fhss.getChannel(t));

    // 3. Layer 1 Jammer & Link Quality
    let jammer;
    if (jammerType === "Barrage") {
        jammer = new BarrageJammer(jamPower, nChannels);
    } else if (jammerType === "Sweep") {
        jammer = new SweepJammer(jamPower, nChannels, 200.0);
    } else if (jammerType === "Reactive") {
        jammer = new ReactiveJammer(jamPower, 0.6, 0.005, hopRate, 99);
    } else {
        jammer = new JammerModel();
    }

    const linkCalc = new LinkQualityCalculator();
    const snrSeries = [];
    const lqSeries = [];
    const jammedSeries = [];

    for (let i = 0; i < times.length; i++) {
        const t = times[i];
        const ch = channels[i];
        const jsr = jammer.jsrOnChannel(t, ch);
        const isJammed = jammer.isJammed(t, ch);
        const { snr, lq } = linkCalc.linkQuality(jsr);

        snrSeries.push(snr);
        lqSeries.push(lq);
        jammedSeries.push(isJammed);
    }

    // 4. Layer 2 Sensor Network
    const net = new SensorNetwork(20.0, 2400.0);
    net.placeRing([0, 0], sensorRadius, nSensors, sensorRange, noiseStd);
    const allReadings = net.measureTrajectory(trajectory, 7);

    // 5. Layer 2 Localization
    const localizer = new Localizer(20.0, 2400.0, 3);
    const locResults = localizer.localizeTrajectory(times, allReadings, net.sensors);

    const errors = [];
    for (let i = 0; i < locResults.length; i++) {
        const loc = locResults[i];
        if (loc.hasFix) {
            const dx = loc.estX - trajectory[i].x;
            const dy = loc.estY - trajectory[i].y;
            errors.push(Math.hypot(dx, dy));
        } else {
            errors.push(null);
        }
    }

    // 6. Layer 3 Rules Engine
    const zoneVerts = [[-150, -150], [150, -150], [150, 150], [-150, 150]];
    const rules = new RulesEngine(zoneVerts);
    const alerts = rules.evaluateTrack(locResults);

    return {
        trajectory,
        times,
        channels,
        snrSeries,
        lqSeries,
        jammedSeries,
        sensorNodes: net.sensors,
        locResults,
        errors,
        alerts,
        zoneVertices: zoneVerts,
        approachBufferM: rules.approachBufferM
    };
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        RandomGenerator,
        DroneMotionModel,
        FHSSSimulator,
        BarrageJammer,
        SweepJammer,
        ReactiveJammer,
        LinkQualityCalculator,
        SensorNetwork,
        Localizer,
        RulesEngine,
        runSimulationPipeline
    };
}
