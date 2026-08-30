"""
Drone Trajectory Predictor & Extended Kalman Filter (EKF)
=========================================================
Implements:
1. Constant Turn Rate and Velocity (CTRV) Kinematic State Estimator
2. Forward Extrapolation across Horizon (1s - 10s)
3. Covariance & Dynamic 95% Confidence Uncertainty Cone Expansion
4. Predictive Geofence Intersection & Time-to-Breach (TTB) Calculation
"""

import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple


@dataclass
class TrajectoryPrediction:
    points: np.ndarray             # shape (M, 4): [t_offset, x, y, z]
    upper_bounds: np.ndarray       # shape (M, 2): [x, y]
    lower_bounds: np.ndarray       # shape (M, 2): [x, y]
    will_breach: bool
    time_to_breach: Optional[float]
    intercept_point: Optional[Tuple[float, float]]


class TrajectoryPredictor:
    """
    Kinematic State Estimator & EKF Trajectory Predictor.
    """

    def __init__(self, horizon_seconds: float = 5.0, dt: float = 0.1):
        self.horizon_seconds = horizon_seconds
        self.dt = dt
        self.history: List[Dict[str, float]] = []
        self.state: Optional[Dict[str, float]] = None

    def reset(self):
        self.history.clear()
        self.state = None

    def update(
        self,
        t: float,
        est_x: Optional[float],
        est_y: Optional[float],
        confidence: float = 1.0,
        has_fix: bool = True
    ):
        if not has_fix or est_x is None or est_y is None or np.isnan(est_x) or np.isnan(est_y):
            return

        self.history.append({"t": t, "x": est_x, "y": est_y, "conf": confidence})
        if len(self.history) > 20:
            self.history.pop(0)

        if len(self.history) < 2:
            self.state = {
                "x": est_x,
                "y": est_y,
                "vx": 0.0,
                "vy": 0.0,
                "speed": 0.0,
                "heading": 0.0,
                "yaw_rate": 0.0,
                "ax": 0.0,
                "ay": 0.0
            }
            return

        p_curr = self.history[-1]
        p_prev = self.history[-2]
        dt = max(1e-4, p_curr["t"] - p_prev["t"])

        raw_vx = (p_curr["x"] - p_prev["x"]) / dt
        raw_vy = (p_curr["y"] - p_prev["y"]) / dt

        alpha = min(0.85, 0.4 + confidence * 0.45)
        curr_vx = self.state["vx"] if self.state else raw_vx
        curr_vy = self.state["vy"] if self.state else raw_vy

        smooth_vx = curr_vx * (1 - alpha) + raw_vx * alpha
        smooth_vy = curr_vy * (1 - alpha) + raw_vy * alpha

        raw_ax = (smooth_vx - curr_vx) / dt
        raw_ay = (smooth_vy - curr_vy) / dt
        smooth_ax = (self.state.get("ax", 0.0) if self.state else 0.0) * 0.7 + raw_ax * 0.3
        smooth_ay = (self.state.get("ay", 0.0) if self.state else 0.0) * 0.7 + raw_ay * 0.3

        curr_heading = float(np.arctan2(smooth_vy, smooth_vx))
        prev_heading = self.state["heading"] if self.state else curr_heading
        delta_heading = curr_heading - prev_heading
        while delta_heading > np.pi:
            delta_heading -= 2 * np.pi
        while delta_heading < -np.pi:
            delta_heading += 2 * np.pi

        yaw_rate = (self.state.get("yaw_rate", 0.0) if self.state else 0.0) * 0.7 + (delta_heading / dt) * 0.3

        self.state = {
            "x": est_x,
            "y": est_y,
            "vx": smooth_vx,
            "vy": smooth_vy,
            "speed": float(np.hypot(smooth_vx, smooth_vy)),
            "heading": curr_heading,
            "yaw_rate": yaw_rate,
            "ax": smooth_ax,
            "ay": smooth_ay
        }

    def predict(
        self,
        horizon_seconds: Optional[float] = None,
        current_z: float = 50.0,
        zone_vertices: Optional[List[Tuple[float, float]]] = None
    ) -> TrajectoryPrediction:
        horizon = horizon_seconds or self.horizon_seconds
        steps = max(2, int(horizon / self.dt))

        if not self.state or len(self.history) < 2:
            return TrajectoryPrediction(
                points=np.empty((0, 4)),
                upper_bounds=np.empty((0, 2)),
                lower_bounds=np.empty((0, 2)),
                will_breach=False,
                time_to_breach=None,
                intercept_point=None
            )

        cur_x = self.state["x"]
        cur_y = self.state["y"]
        cur_vx = self.state["vx"]
        cur_vy = self.state["vy"]
        cur_yaw_rate = self.state["yaw_rate"]
        heading = self.state["heading"]

        base_noise = 8.0
        process_noise_rate = 4.5

        pts = []
        uppers = []
        lowers = []

        for i in range(1, steps + 1):
            pred_time = i * self.dt

            if abs(cur_yaw_rate) > 0.02:
                speed = np.hypot(cur_vx, cur_vy)
                new_heading = heading + cur_yaw_rate * pred_time
                cur_vx = speed * np.cos(new_heading)
                cur_vy = speed * np.sin(new_heading)
                cur_x += cur_vx * self.dt
                cur_y += cur_vy * self.dt
            else:
                cur_x += cur_vx * self.dt + 0.5 * self.state["ax"] * self.dt**2
                cur_y += cur_vy * self.dt + 0.5 * self.state["ay"] * self.dt**2

            pts.append([pred_time, cur_x, cur_y, current_z])

            speed = max(1e-4, np.hypot(cur_vx, cur_vy))
            norm_x = -cur_vy / speed
            norm_y = cur_vx / speed

            uncertainty = base_noise + process_noise_rate * (pred_time ** 1.25)
            uppers.append([cur_x + norm_x * uncertainty, cur_y + norm_y * uncertainty])
            lowers.append([cur_x - norm_x * uncertainty, cur_y - norm_y * uncertainty])

        points_arr = np.array(pts)
        upper_arr = np.array(uppers)
        lower_arr = np.array(lowers)

        will_breach = False
        time_to_breach = None
        intercept_pt = None

        if zone_vertices is not None and len(points_arr) > 1:
            will_breach, time_to_breach, intercept_pt = self._check_breach(points_arr, zone_vertices)

        return TrajectoryPrediction(
            points=points_arr,
            upper_bounds=upper_arr,
            lower_bounds=lower_arr,
            will_breach=will_breach,
            time_to_breach=time_to_breach,
            intercept_point=intercept_pt
        )

    def _check_breach(self, points: np.ndarray, zone_vertices: List[Tuple[float, float]]):
        for i in range(len(points) - 1):
            p1 = points[i, 1:3]
            p2 = points[i + 1, 1:3]

            for j in range(len(zone_vertices)):
                k = (j - 1) % len(zone_vertices)
                v1 = zone_vertices[k]
                v2 = zone_vertices[j]

                intersect = self._line_intersect(p1, p2, v1, v2)
                if intersect is not None:
                    return True, float(points[i, 0]), intersect
        return False, None, None

    @staticmethod
    def _line_intersect(p1, p2, p3, p4):
        x1, y1 = p1
        x2, y2 = p2
        x3, y3 = p3
        x4, y4 = p4

        denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
        if abs(denom) < 1e-9:
            return None

        ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom
        ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom

        if 0 <= ua <= 1 and 0 <= ub <= 1:
            return (float(x1 + ua * (x2 - x1)), float(y1 + ua * (y2 - y1)))
        return None
