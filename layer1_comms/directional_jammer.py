"""
Directional EW Beamforming & Parabolic Antenna Jammer Model
===========================================================
Simulates steerable high-gain parabolic horn antennas,
closed-loop gimbal slew rates, and radiation pattern gain.
"""

import numpy as np
from dataclasses import dataclass
from typing import Dict, Tuple, List, Optional


@dataclass
class DirectionalBeamState:
    boresight_angle_rad: float
    boresight_angle_deg: float
    gain_dbi: float
    effective_eirp_dbm: float
    is_locked: bool


class DirectionalBeamJammer:
    def __init__(
        self,
        total_power_dbm: float = 33.0,
        main_gain_dbi: float = 18.0,
        beamwidth_deg: float = 28.0,
        sidelobe_level_db: float = -18.0,
        slew_rate_deg_per_sec: float = 60.0,
        origin: Tuple[float, float] = (0.0, 0.0)
    ):
        self.total_power_dbm = total_power_dbm
        self.main_gain_dbi = main_gain_dbi
        self.beamwidth_rad = np.radians(beamwidth_deg)
        self.beamwidth_deg = beamwidth_deg
        self.sidelobe_level_db = sidelobe_level_db
        self.slew_rate_rad = np.radians(slew_rate_deg_per_sec)
        self.origin = origin
        self.current_azimuth_rad = 0.0

    def track_and_evaluate(self, t: float, target_x: float, target_y: float, dt: float = 0.1) -> DirectionalBeamState:
        dx = target_x - self.origin[0]
        dy = target_y - self.origin[1]
        target_bearing = float(np.arctan2(dy, dx))

        angle_delta = target_bearing - self.current_azimuth_rad
        while angle_delta > np.pi: angle_delta -= 2 * np.pi
        while angle_delta < -np.pi: angle_delta += 2 * np.pi

        max_step = self.slew_rate_rad * dt
        step = np.clip(angle_delta, -max_step, max_step)
        self.current_azimuth_rad += float(step)

        off_boresight = abs(target_bearing - self.current_azimuth_rad)
        while off_boresight > np.pi: off_boresight = abs(off_boresight - 2 * np.pi)

        half_bw = self.beamwidth_rad / 2.0
        if off_boresight <= half_bw * 1.8:
            gain_dbi = self.main_gain_dbi - 12.0 * ((off_boresight / self.beamwidth_rad) ** 2)
        else:
            gain_dbi = self.main_gain_dbi + self.sidelobe_level_db

        is_locked = bool(off_boresight <= half_bw)
        eirp = self.total_power_dbm + gain_dbi

        return DirectionalBeamState(
            boresight_angle_rad=self.current_azimuth_rad,
            boresight_angle_deg=float(np.degrees(self.current_azimuth_rad)),
            gain_dbi=float(gain_dbi),
            effective_eirp_dbm=float(eirp),
            is_locked=is_locked
        )
