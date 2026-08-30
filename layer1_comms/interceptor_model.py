"""
Counter-Drone Autonomous Kinetic Interceptor Model
==================================================
Implements Proportional Navigation (PN) pursuit guidance:
a_cmd = N * V_closing * d(LOS)/dt
"""

import numpy as np
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple


@dataclass
class InterceptorEngagement:
    flight_path: np.ndarray      # shape (N, 4): [t, x, y, z]
    is_killed: bool
    kill_time: Optional[float]
    kill_location: Optional[Tuple[float, float, float]]
    intercept_distance_from_base: Optional[float]


class InterceptorModel:
    def __init__(
        self,
        base_origin: Tuple[float, float, float] = (0.0, 0.0, 0.0),
        max_speed: float = 35.0,
        max_accel: float = 25.0,
        nav_constant: float = 3.5,
        kill_radius: float = 10.0,
        launch_delay: float = 2.0
    ):
        self.base_origin = base_origin
        self.max_speed = max_speed
        self.max_accel = max_accel
        self.nav_constant = nav_constant
        self.kill_radius = kill_radius
        self.launch_delay = launch_delay

    def simulate_interception(
        self,
        target_trajectory: List[Dict[str, float]],
        launch_time: float = 0.0,
        dt: float = 0.1
    ) -> InterceptorEngagement:
        if not target_trajectory:
            return InterceptorEngagement(
                flight_path=np.empty((0, 4)),
                is_killed=False,
                kill_time=None,
                kill_location=None,
                intercept_distance_from_base=None
            )

        flight = []
        is_launched = False
        is_killed = False
        kill_time = None
        kill_loc = None
        intercept_dist = None

        ix, iy, iz = self.base_origin
        ivx, ivy, ivz = 0.0, 0.0, 0.0
        prev_los = None

        for pt in target_trajectory:
            t = pt["t"]
            tx, ty, tz = pt["x"], pt["y"], pt["z"]

            if t < launch_time + self.launch_delay:
                flight.append([t, ix, iy, iz])
                continue

            if is_killed:
                flight.append([t, ix, iy, iz])
                continue

            if not is_launched:
                is_launched = True
                dx = tx - ix
                dy = ty - iy
                d_init = max(1e-3, np.hypot(dx, dy))
                ivx = (dx / d_init) * (self.max_speed * 0.5)
                ivy = (dy / d_init) * (self.max_speed * 0.5)
                ivz = min(15.0, (tz - iz) / 2.0)

            rx = tx - ix
            ry = ty - iy
            rz = tz - iz
            r_tot = np.hypot(rx, ry, rz)

            if r_tot <= self.kill_radius:
                is_killed = True
                kill_time = t
                kill_loc = (float(ix), float(iy), float(iz))
                intercept_dist = float(np.hypot(ix - self.base_origin[0], iy - self.base_origin[1]))
                flight.append([t, ix, iy, iz])
                continue

            curr_los = float(np.arctan2(ry, rx))
            los_rate = 0.0
            if prev_los is not None:
                d_los = curr_los - prev_los
                while d_los > np.pi:
                    d_los -= 2 * np.pi
                while d_los < -np.pi:
                    d_los += 2 * np.pi
                los_rate = d_los / dt
            prev_los = curr_los

            spd = max(1.0, float(np.hypot(ivx, ivy)))
            a_mag = min(self.max_accel, abs(self.nav_constant * spd * los_rate))
            norm_x = -ivy / spd
            norm_y = ivx / spd
            sign = 1.0 if los_rate >= 0 else -1.0

            ax = norm_x * a_mag * sign
            ay = norm_y * a_mag * sign
            az = max(-10.0, min(10.0, (tz - iz) * 1.5 - ivz * 0.8))

            fwd = max(0.0, (self.max_speed - spd) * 2.0)
            hx = ivx / spd
            hy = ivy / spd

            ivx += (ax + hx * fwd) * dt
            ivy += (ay + hy * fwd) * dt
            ivz += az * dt

            tot_spd = np.hypot(ivx, ivy)
            if tot_spd > self.max_speed:
                ivx = (ivx / tot_spd) * self.max_speed
                ivy = (ivy / tot_spd) * self.max_speed

            ix += ivx * dt
            iy += ivy * dt
            iz += ivz * dt

            flight.append([t, ix, iy, iz])

        return InterceptorEngagement(
            flight_path=np.array(flight),
            is_killed=is_killed,
            kill_time=kill_time,
            kill_location=kill_loc,
            intercept_distance_from_base=intercept_dist
        )
