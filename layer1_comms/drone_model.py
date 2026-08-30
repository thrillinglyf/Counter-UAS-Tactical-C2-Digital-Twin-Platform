"""
Drone Motion Model
==================
Generates synthetic drone trajectories via waypoint interpolation or biased random walk.
"""

import numpy as np
from dataclasses import dataclass, field
from typing import List, Tuple, Optional


@dataclass
class DroneMotionModel:
    """
    Simulates a drone flying through a sequence of waypoints or performing
    a random walk biased toward a target position.

    Parameters
    ----------
    speed : float
        Drone ground speed in meters per second (default 15 m/s).
    dt : float
        Simulation timestep in seconds (default 0.1 s).
    altitude : float
        Fixed flight altitude in meters (default 50 m).
    """

    speed: float = 15.0
    dt: float = 0.1
    altitude: float = 50.0

    # ── Waypoint-based trajectory ──────────────────────────────────────

    def generate_waypoint_trajectory(
        self,
        waypoints: List[Tuple[float, float]],
    ) -> np.ndarray:
        """
        Fly through a list of (x, y) waypoints at constant speed and altitude.

        Returns
        -------
        trajectory : np.ndarray, shape (N, 4)
            Columns: [time, x, y, z]
        """
        waypoints = np.asarray(waypoints, dtype=float)
        if waypoints.ndim != 2 or waypoints.shape[1] != 2:
            raise ValueError("waypoints must be shape (M, 2)")

        records: List[List[float]] = []
        t = 0.0
        step_dist = self.speed * self.dt

        for seg_idx in range(len(waypoints) - 1):
            start = waypoints[seg_idx]
            end = waypoints[seg_idx + 1]
            segment_vec = end - start
            segment_len = np.linalg.norm(segment_vec)
            if segment_len < 1e-9:
                continue
            direction = segment_vec / segment_len
            traveled = 0.0

            while traveled < segment_len:
                pos = start + direction * traveled
                records.append([t, pos[0], pos[1], self.altitude])
                traveled += step_dist
                t += self.dt

        # Append final waypoint
        records.append([t, waypoints[-1, 0], waypoints[-1, 1], self.altitude])

        return np.array(records)

    # ── Random-walk trajectory (biased toward target) ──────────────────

    def generate_random_walk(
        self,
        start: Tuple[float, float],
        target: Tuple[float, float],
        duration: float,
        bias_strength: float = 0.7,
        noise_std: float = 5.0,
        seed: Optional[int] = None,
    ) -> np.ndarray:
        """
        Random walk with a bias toward *target*.  The drone drifts generally
        toward the target but with Gaussian lateral perturbations.

        Parameters
        ----------
        start : (x, y)
        target : (x, y)
        duration : seconds of flight
        bias_strength : 0–1, fraction of step in the target direction
        noise_std : std-dev of per-step lateral noise (meters)
        seed : optional RNG seed

        Returns
        -------
        trajectory : np.ndarray, shape (N, 4) — [time, x, y, z]
        """
        rng = np.random.default_rng(seed)
        steps = int(duration / self.dt)
        records = []
        pos = np.array(start, dtype=float)
        step_dist = self.speed * self.dt

        for i in range(steps):
            t = i * self.dt
            records.append([t, pos[0], pos[1], self.altitude])

            # Direction toward target
            to_target = np.array(target) - pos
            dist_to_target = np.linalg.norm(to_target)
            if dist_to_target < 1.0:
                # Close enough — stop advancing
                continue
            direction = to_target / dist_to_target

            # Biased step + noise
            noise = rng.normal(0, noise_std, size=2) * self.dt
            step = direction * step_dist * bias_strength + noise
            # Clamp step magnitude to avoid teleporting
            step_mag = np.linalg.norm(step)
            if step_mag > step_dist * 1.5:
                step = step / step_mag * step_dist * 1.5
            pos = pos + step

        return np.array(records)
