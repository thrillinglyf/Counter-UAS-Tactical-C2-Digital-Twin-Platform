/**
 * Multi-Drone Swarm Tactical Engine & Threat Priority Scorer
 * 
 * Supports:
 * 1. Swarm Attack Formations:
 *    - "Single Drone (Baseline)"
 *    - "Pincer Attack (2-Axis Flanking Incursion)"
 *    - "Decoy & Strike (3-Drone Split Attack)"
 *    - "Full Saturation Swarm (5-Drone Convergence)"
 * 2. Automated Threat Prioritization Matrix:
 *    - Computes Threat Score = w1 * (1/TTB) + w2 * (1/Distance) + w3 * Speed
 *    - Ranks targets in real time for C2 operator engagement
 */

class SwarmEngine {
    constructor() {
        this.threatWeights = {
            ttb: 0.5,
            proximity: 0.3,
            speed: 0.2
        };
    }

    /**
     * Generates trajectories for all drones in the swarm according to attack formation
     */
    generateSwarmTrajectories(formation = "Single", droneSpeed = 15.0, altitude = 50.0, simDt = 0.1) {
        const drone = new DroneMotionModel(droneSpeed, simDt, altitude);
        const drones = [];

        if (formation === "Single") {
            const waypoints = [
                [-500, -300], [-300, -100], [-100, 0], [0, 50], [100, 80], [200, 50], [300, -50]
            ];
            drones.push({
                id: 'DRONE-01',
                callsign: 'HOSTILE-ALPHA',
                role: 'LEAD STRIKE',
                color: '#00f0ff',
                trajectory: drone.generateWaypointTrajectory(waypoints)
            });
        } else if (formation === "Pincer") {
            // Flank North-West
            const wp1 = [
                [-550, -250], [-350, -50], [-120, 20], [0, 40], [150, 40], [300, -20]
            ];
            // Flank South-West
            const wp2 = [
                [-450, -450], [-250, -280], [-80, -100], [0, -30], [120, 10], [280, 50]
            ];
            drones.push({
                id: 'DRONE-01',
                callsign: 'PINCER-NORTH',
                role: 'NORTH FLANK',
                color: '#00f0ff',
                trajectory: drone.generateWaypointTrajectory(wp1)
            });
            drones.push({
                id: 'DRONE-02',
                callsign: 'PINCER-SOUTH',
                role: 'SOUTH FLANK',
                color: '#ff00aa',
                trajectory: drone.generateWaypointTrajectory(wp2)
            });
        } else if (formation === "Decoy") {
            // Decoy 1: Fast feint to North-East to draw interceptors
            const wpDecoy = [
                [-500, 200], [-300, 350], [-100, 450], [150, 480], [350, 400]
            ];
            // Strike 1: Center low-altitude penetrator
            const wpStrike1 = [
                [-550, -200], [-300, -80], [-100, 0], [0, 20], [120, 40]
            ];
            // Strike 2: Trailing evasive walk
            const droneWalk = new DroneMotionModel(droneSpeed * 0.85, simDt, altitude);
            const walk = droneWalk.generateRandomWalk([-500, -380], [0, 0], 35.0, 0.7, 5.0, 101);

            drones.push({
                id: 'DRONE-01',
                callsign: 'DECOY-FEINT',
                role: 'DECOY (HIGH RADAR)',
                color: '#ffaa00',
                trajectory: drone.generateWaypointTrajectory(wpDecoy)
            });
            drones.push({
                id: 'DRONE-02',
                callsign: 'STRIKE-LEAD',
                role: 'PRIMARY WARHEAD',
                color: '#ff1744',
                trajectory: drone.generateWaypointTrajectory(wpStrike1)
            });
            drones.push({
                id: 'DRONE-03',
                callsign: 'STRIKE-TRAIL',
                role: 'RECON / TRAIL',
                color: '#00f0ff',
                trajectory: walk
            });
        } else {
            // Full 4-Drone Saturation
            const wpNorth = [[-500, 300], [-250, 150], [0, 50], [150, 20]];
            const wpSouth = [[-500, -400], [-250, -180], [0, -40], [150, 0]];
            const wpEast = [[-550, -50], [-300, 0], [-50, 10], [100, 30]];
            const wpHigh = [[-450, 100], [-200, 80], [0, 60], [120, 50]];

            drones.push({ id: 'DRONE-01', callsign: 'SWARM-01', role: 'VANGUARD NORTH', color: '#00f0ff', trajectory: drone.generateWaypointTrajectory(wpNorth) });
            drones.push({ id: 'DRONE-02', callsign: 'SWARM-02', role: 'VANGUARD SOUTH', color: '#ff00aa', trajectory: drone.generateWaypointTrajectory(wpSouth) });
            drones.push({ id: 'DRONE-03', callsign: 'SWARM-03', role: 'DIRECT PENETRATOR', color: '#ff1744', trajectory: drone.generateWaypointTrajectory(wpEast) });
            drones.push({ id: 'DRONE-04', callsign: 'SWARM-04', role: 'HIGH OVERWATCH', color: '#ffaa00', trajectory: drone.generateWaypointTrajectory(wpHigh) });
        }

        // Align all trajectories to matching timeline length
        const minLen = Math.min(...drones.map(d => d.trajectory.length));
        drones.forEach(d => {
            d.trajectory = d.trajectory.slice(0, minLen);
        });

        return drones;
    }

    /**
     * Scores and ranks all active swarm targets at time index
     * @param {Array} drones List of drone objects with trajectories
     * @param {number} idx Current playback index
     * @param {Array} zoneVertices Protected perimeter polygon
     * @returns {Array} Sorted list of drone targets with priority scores
     */
    evaluateThreatPriorities(drones, idx, zoneVertices) {
        const rankings = [];

        drones.forEach(d => {
            const pt = d.trajectory[idx];
            if (!pt) return;

            const distBase = Math.hypot(pt.x, pt.y);
            const speed = pt.vx ? Math.hypot(pt.vx, pt.vy) : 15.0;

            // Simplified proximity & closure score
            const proxScore = Math.max(0, 1.0 - (distBase / 800.0));
            const speedScore = Math.min(1.0, speed / 30.0);

            // Normalized Threat Score (0.0 to 100.0)
            const rawScore = (proxScore * 65.0) + (speedScore * 35.0);

            rankings.push({
                id: d.id,
                callsign: d.callsign,
                role: d.role,
                color: d.color,
                x: pt.x,
                y: pt.y,
                z: pt.z,
                distBase: distBase,
                threatScore: Math.min(99.9, Math.max(1.0, rawScore)),
                threatLevel: rawScore > 70 ? 'CRITICAL' : (rawScore > 40 ? 'ELEVATED' : 'LOW')
            });
        });

        // Sort descending by Threat Score
        rankings.sort((a, b) => b.threatScore - a.threatScore);
        return rankings;
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { SwarmEngine };
}
