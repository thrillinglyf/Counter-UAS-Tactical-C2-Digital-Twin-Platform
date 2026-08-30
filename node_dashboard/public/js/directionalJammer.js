/**
 * Directional EW Beamforming & Parabolic Antenna Jammer Engine
 * 
 * Features:
 * 1. Steerable High-Gain Parabolic RF Horn Antenna Model:
 *    - Main Lobe Gain: G_main (e.g. +18 dBi)
 *    - Half-Power Beamwidth (HPBW): Theta_3dB (e.g. 25 deg)
 *    - Side Lobe Attenuation: SLL (e.g. -20 dB down from peak)
 * 2. Closed-Loop Target Tracking Servo:
 *    - Azimuth Slew Rate: omega_max (e.g. 60 deg/sec)
 *    - Slews beam direction dynamically toward target's estimated bearing
 * 3. Spatial Radiation Pattern & JSR Calculation:
 *    - Off-boresight angle delta_theta = |theta_target - theta_boresight|
 *    - Sinc/Cosine power roll-off pattern
 *    - Computes concentrated directional JSR on active FHSS channels
 */

class DirectionalBeamJammer {
    constructor(params = {}) {
        const {
            totalPowerDbm = 33.0,       // 2 Watts base RF output
            mainLobeGainDbi = 18.0,      // +18 dBi parabolic reflector gain
            beamwidthDeg = 28.0,         // Half-Power Beamwidth (HPBW)
            sideLobeLevelDb = -18.0,     // Side lobe suppression
            slewRateDegPerSec = 60.0,    // Tracking gimbal speed (deg/s)
            origin = [0, 0]              // Base HQ emitter location
        } = params;

        this.totalPowerDbm = totalPowerDbm;
        this.mainLobeGainDbi = mainLobeGainDbi;
        this.beamwidthRad = (beamwidthDeg * Math.PI) / 180.0;
        this.beamwidthDeg = beamwidthDeg;
        this.sideLobeLevelDb = sideLobeLevelDb;
        this.slewRateRadPerSec = (slewRateDegPerSec * Math.PI) / 180.0;
        this.origin = origin;
        this.currentAzimuthRad = 0.0; // Current physical pointing angle
    }

    reset() {
        this.currentAzimuthRad = 0.0;
    }

    /**
     * Slews antenna boresight toward target bearing and evaluates gain on target
     * @param {number} t Time in seconds
     * @param {number} targetX Target Easting
     * @param {number} targetY Target Northing
     * @param {number} dt Time step
     * @returns {Object} Antenna state: boresight angle, gain on target (dBi), effective EIRP (dBm)
     */
    trackAndEvaluate(t, targetX, targetY, dt = 0.1) {
        const dx = targetX - this.origin[0];
        const dy = targetY - this.origin[1];
        const targetBearingRad = Math.atan2(dy, dx);

        // Compute shortest angular delta
        let angleDelta = targetBearingRad - this.currentAzimuthRad;
        while (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
        while (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;

        // Apply slew rate limiter (mechanical/electronic phase steering)
        const maxStep = this.slewRateRadPerSec * dt;
        const step = Math.max(-maxStep, Math.min(maxStep, angleDelta));
        this.currentAzimuthRad += step;
        while (this.currentAzimuthRad > Math.PI) this.currentAzimuthRad -= 2 * Math.PI;
        while (this.currentAzimuthRad < -Math.PI) this.currentAzimuthRad += 2 * Math.PI;

        // Off-boresight angle
        let offBoresight = Math.abs(targetBearingRad - this.currentAzimuthRad);
        while (offBoresight > Math.PI) offBoresight = Math.abs(offBoresight - 2 * Math.PI);

        // Radiation Pattern Gain: Gaussian/Cosine model
        let antennaGainDbi;
        const halfBw = this.beamwidthRad / 2.0;

        if (offBoresight <= halfBw * 1.8) {
            // Main beam roll-off: -12 * (theta / HPBW)^2
            const rollOff = -12.0 * Math.pow(offBoresight / this.beamwidthRad, 2);
            antennaGainDbi = this.mainLobeGainDbi + rollOff;
        } else {
            // Sidelobe floor
            antennaGainDbi = this.mainLobeGainDbi + this.sideLobeLevelDb;
        }

        const effectiveEirpDbm = this.totalPowerDbm + antennaGainDbi;
        const isBoresightLocked = offBoresight <= halfBw;

        return {
            boresightAngleRad: this.currentAzimuthRad,
            boresightAngleDeg: (this.currentAzimuthRad * 180.0) / Math.PI,
            targetBearingDeg: (targetBearingRad * 180.0) / Math.PI,
            offBoresightDeg: (offBoresight * 180.0) / Math.PI,
            gainDbi: antennaGainDbi,
            effectiveEirpDbm,
            isLocked: isBoresightLocked
        };
    }

    /**
     * Computes the 2D polygon wedge representing the active directed RF energy beam for visualization
     */
    getBeamConePolygon(rangeM = 550.0, numSegments = 16) {
        const halfBw = this.beamwidthRad / 2.0;
        const startAngle = this.currentAzimuthRad - halfBw;
        const endAngle = this.currentAzimuthRad + halfBw;

        const polyX = [this.origin[0]];
        const polyY = [this.origin[1]];

        for (let i = 0; i <= numSegments; i++) {
            const angle = startAngle + (i / numSegments) * (endAngle - startAngle);
            polyX.push(this.origin[0] + rangeM * Math.cos(angle));
            polyY.push(this.origin[1] + rangeM * Math.sin(angle));
        }

        polyX.push(this.origin[0]);
        polyY.push(this.origin[1]);

        return { x: polyX, y: polyY };
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { DirectionalBeamJammer };
}
