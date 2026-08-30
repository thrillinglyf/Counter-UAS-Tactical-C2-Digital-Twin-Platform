"""
Multi-Drone Swarm Defense & Threat Ranking Engine
=================================================
Generates coordinated drone swarms (Pincer, Decoy, Saturation)
and computes real-time threat prioritization matrices.
"""

import numpy as np
from dataclasses import dataclass
from typing import List, Dict, Tuple


@dataclass
class SwarmDrone:
    drone_id: str
    callsign: str
    role: str
    color: str
    trajectory: np.ndarray    # shape (N, 4): [t, x, y, z]


class SwarmEngine:
    def __init__(self):
        pass

    def generate_swarm(
        self,
        formation: str = "Single",
        drone_speed: float = 15.0,
        altitude: float = 50.0,
        dt: float = 0.1
    ) -> List[SwarmDrone]:
        drones = []

        if formation == "Single":
            wps = np.array([[-500, -300], [-300, -100], [-100, 0], [0, 50], [100, 80], [200, 50], [300, -50]])
            drones.append(SwarmDrone("DRONE-01", "HOSTILE-ALPHA", "LEAD STRIKE", "#00f0ff", self._generate_path(wps, drone_speed, altitude, dt)))
        elif formation == "Pincer":
            wp1 = np.array([[-550, -250], [-350, -50], [-120, 20], [0, 40], [150, 40], [300, -20]])
            wp2 = np.array([[-450, -450], [-250, -280], [-80, -100], [0, -30], [120, 10], [280, 50]])
            drones.append(SwarmDrone("DRONE-01", "PINCER-NORTH", "NORTH FLANK", "#00f0ff", self._generate_path(wp1, drone_speed, altitude, dt)))
            drones.append(SwarmDrone("DRONE-02", "PINCER-SOUTH", "SOUTH FLANK", "#ff00aa", self._generate_path(wp2, drone_speed, altitude, dt)))
        elif formation == "Decoy":
            wp_decoy = np.array([[-500, 200], [-300, 350], [-100, 450], [150, 480], [350, 400]])
            wp_strike = np.array([[-550, -200], [-300, -80], [-100, 0], [0, 20], [120, 40]])
            drones.append(SwarmDrone("DRONE-01", "DECOY-FEINT", "DECOY", "#ffaa00", self._generate_path(wp_decoy, drone_speed * 1.2, altitude + 30, dt)))
            drones.append(SwarmDrone("DRONE-02", "STRIKE-LEAD", "PRIMARY WARHEAD", "#ff1744", self._generate_path(wp_strike, drone_speed, altitude, dt)))
        else:
            wp1 = np.array([[-500, 300], [-250, 150], [0, 50], [150, 20]])
            wp2 = np.array([[-500, -400], [-250, -180], [0, -40], [150, 0]])
            wp3 = np.array([[-550, -50], [-300, 0], [-50, 10], [100, 30]])
            wp4 = np.array([[-450, 100], [-200, 80], [0, 60], [120, 50]])
            drones.append(SwarmDrone("DRONE-01", "SWARM-01", "NORTH FLANK", "#00f0ff", self._generate_path(wp1, drone_speed, altitude, dt)))
            drones.append(SwarmDrone("DRONE-02", "SWARM-02", "SOUTH FLANK", "#ff00aa", self._generate_path(wp2, drone_speed, altitude, dt)))
            drones.append(SwarmDrone("DRONE-03", "SWARM-03", "PENETRATOR", "#ff1744", self._generate_path(wp3, drone_speed, altitude, dt)))
            drones.append(SwarmDrone("DRONE-04", "SWARM-04", "OVERWATCH", "#ffaa00", self._generate_path(wp4, drone_speed, altitude, dt)))

        min_len = min(len(d.trajectory) for d in drones)
        for d in drones:
            d.trajectory = d.trajectory[:min_len]

        return drones

    def _generate_path(self, waypoints: np.ndarray, speed: float, altitude: float, dt: float) -> np.ndarray:
        pts = [waypoints[0]]
        for i in range(len(waypoints) - 1):
            p1, p2 = waypoints[i], waypoints[i + 1]
            dist = np.hypot(p2[0] - p1[0], p2[1] - p1[1])
            steps = max(2, int(dist / (speed * dt)))
            for s in range(1, steps + 1):
                frac = s / steps
                pts.append(p1 + frac * (p2 - p1))
        
        traj = []
        for idx, p in enumerate(pts):
            traj.append([idx * dt, p[0], p[1], altitude])
        return np.array(traj)

    def rank_threats(self, drones: List[SwarmDrone], step_idx: int) -> List[Dict]:
        rankings = []
        for d in drones:
            if step_idx >= len(d.trajectory):
                continue
            pt = d.trajectory[step_idx]
            dist = float(np.hypot(pt[1], pt[2]))
            score = max(1.0, min(99.0, (1.0 - dist / 800.0) * 70.0 + 30.0))
            rankings.append({
                "drone_id": d.drone_id,
                "callsign": d.callsign,
                "role": d.role,
                "distance": dist,
                "threat_score": score,
                "level": "CRITICAL" if score > 70 else ("ELEVATED" if score > 40 else "LOW")
            })
        rankings.sort(key=lambda x: x["threat_score"], reverse=True)
        return rankings
