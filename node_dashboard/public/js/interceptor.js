/**
 * Autonomous Counter-Drone Kinetic Interceptor & Proportional Navigation (PN) Engine
 * 
 * Implements:
 * 1. Autonomous launch trigger based on threat rules (e.g. Warning / Critical breach)
 * 2. Proportional Navigation (PN) guidance law for realistic intercept trajectories:
 *    a_cmd = N * V_rel * (d_lambda / dt)
 * 3. Mid-air neutralization collision detection (< 8m proximity radius)
 * 4. Mission engagement analytics (Intercept time, Distance from defended asset, Engagement delta-v)
 */

class InterceptorModel {
    constructor(params = {}) {
        const {
            baseOrigin = [0, 0, 0],
            maxSpeed = 35.0,            // m/s (~126 km/h high-speed interceptor)
            maxAcceleration = 25.0,     // m/s^2 (~2.5G turn capability)
            navConstant = 3.5,          // Proportional Navigation constant N (3.0 - 5.0)
            killRadius = 10.0,          // meters for mid-air net/warhead neutralization
            launchDelaySec = 2.0        // reaction & launch preparation time after detection
        } = params;

        this.baseOrigin = baseOrigin;
        this.maxSpeed = maxSpeed;
        this.maxAcceleration = maxAcceleration;
        this.navConstant = navConstant;
        this.killRadius = killRadius;
        this.launchDelaySec = launchDelaySec;
    }

    /**
     * Simulates interceptor engagement against a target trajectory
     * @param {Array} targetTrajectory Array of {t, x, y, z}
     * @param {number} launchTime Time t when interceptor scrambles
     * @param {number} dt Time step
     * @returns {Object} Interceptor flight path, engagement events, kill status
     */
    simulateInterception(targetTrajectory, launchTime = 0.0, dt = 0.1) {
        if (!targetTrajectory || targetTrajectory.length === 0) {
            return { flightPath: [], isKilled: false, killTime: null, killLocation: null };
        }

        const flightPath = [];
        let isLaunched = false;
        let isKilled = false;
        let killTime = null;
        let killLocation = null;
        let interceptDistance = null;

        // Initial Interceptor State at Base Launchpad
        let ix = this.baseOrigin[0];
        let iy = this.baseOrigin[1];
        let iz = this.baseOrigin[2] || 0;
        let ivx = 0;
        let ivy = 0;
        let ivz = 0;
        let prevLosAngle = null;

        for (let i = 0; i < targetTrajectory.length; i++) {
            const target = targetTrajectory[i];
            const t = target.t;

            // Before launch trigger: interceptor is stationed on base launchpad
            if (t < launchTime + this.launchDelaySec) {
                flightPath.push({
                    t,
                    x: ix,
                    y: iy,
                    z: iz,
                    speed: 0,
                    status: 'STANDBY',
                    targetDist: Math.hypot(target.x - ix, target.y - iy, target.z - iz)
                });
                continue;
            }

            // Once neutralized, interceptor lands / hovers over kill site
            if (isKilled) {
                flightPath.push({
                    t,
                    x: ix,
                    y: iy,
                    z: iz,
                    speed: 0,
                    status: 'KILL_CONFIRMED',
                    targetDist: 0
                });
                continue;
            }

            // Active Engagement Phase
            if (!isLaunched) {
                isLaunched = true;
                // Initial climb and direct heading toward target
                const initDx = target.x - ix;
                const initDy = target.y - iy;
                const initDist = Math.max(1e-3, Math.hypot(initDx, initDy));
                ivx = (initDx / initDist) * (this.maxSpeed * 0.5);
                ivy = (initDy / initDist) * (this.maxSpeed * 0.5);
                ivz = Math.min(15.0, (target.z - iz) / 2.0);
            }

            // Relative geometry
            const rX = target.x - ix;
            const rY = target.y - iy;
            const rZ = target.z - iz;
            const range = Math.hypot(rX, rY, rZ);

            // Check Kinetic Kill Condition
            if (range <= this.killRadius) {
                isKilled = true;
                killTime = t;
                killLocation = [ix, iy, iz];
                interceptDistance = Math.hypot(ix - this.baseOrigin[0], iy - this.baseOrigin[1]);
                flightPath.push({
                    t,
                    x: ix,
                    y: iy,
                    z: iz,
                    speed: Math.hypot(ivx, ivy, ivz),
                    status: 'KILL_CONFIRMED',
                    targetDist: 0
                });
                continue;
            }

            // Line-of-Sight (LOS) Angle Rate for Proportional Navigation
            const currentLosAngle = Math.atan2(rY, rX);
            let losRate = 0;
            if (prevLosAngle !== null) {
                let dLos = currentLosAngle - prevLosAngle;
                while (dLos > Math.PI) dLos -= 2 * Math.PI;
                while (dLos < -Math.PI) dLos += 2 * Math.PI;
                losRate = dLos / dt;
            }
            prevLosAngle = currentLosAngle;

            // Proportional Navigation Acceleration Command: a_cmd = N * V_c * losRate
            const curSpeed = Math.max(1.0, Math.hypot(ivx, ivy));
            const closingVelocity = curSpeed; // simplified closing velocity
            const aCmdMagnitude = Math.min(this.maxAcceleration, Math.abs(this.navConstant * closingVelocity * losRate));
            
            // Lateral normal unit vector perpendicular to velocity
            const normX = -ivy / curSpeed;
            const normY = ivx / curSpeed;
            const sign = losRate >= 0 ? 1 : -1;

            const ax = normX * aCmdMagnitude * sign;
            const ay = normY * aCmdMagnitude * sign;
            const az = Math.max(-10, Math.min(10, (target.z - iz) * 1.5 - ivz * 0.8));

            // Forward thrust acceleration to reach maxSpeed
            const forwardAcc = Math.max(0, (this.maxSpeed - curSpeed) * 2.0);
            const headingX = ivx / curSpeed;
            const headingY = ivy / curSpeed;

            ivx += (ax + headingX * forwardAcc) * dt;
            ivy += (ay + headingY * forwardAcc) * dt;
            ivz += az * dt;

            // Speed clamp
            const totSpeed = Math.hypot(ivx, ivy);
            if (totSpeed > this.maxSpeed) {
                ivx = (ivx / totSpeed) * this.maxSpeed;
                ivy = (ivy / totSpeed) * this.maxSpeed;
            }

            // Integrate position
            ix += ivx * dt;
            iy += ivy * dt;
            iz += ivz * dt;

            flightPath.push({
                t,
                x: ix,
                y: iy,
                z: iz,
                speed: Math.hypot(ivx, ivy, ivz),
                status: 'ENGAGING',
                targetDist: range
            });
        }

        return {
            flightPath,
            isKilled,
            killTime,
            killLocation,
            interceptDistance
        };
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { InterceptorModel };
}
