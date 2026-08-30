"""
Localization via Trilateration
==============================
Estimates the drone's 2-D position from multiple RSSI readings using
least-squares trilateration (scipy.optimize.least_squares).
Includes confidence scoring based on residual error, sensor count,
and geometric dilution of precision (GDOP).
"""

import numpy as np
from scipy.optimize import least_squares
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Tuple


@dataclass
class LocalizationResult:
    """Result of a single trilateration fix."""

    time: float
    est_x: float
    est_y: float
    confidence: float
    num_sensors: int
    residual: float
    has_fix: bool


@dataclass
class Localizer:
    """
    Estimates drone position from sensor RSSI readings.

    Parameters
    ----------
    tx_power_dBm : float
        Assumed drone transmit power (must match sensor network config).
    freq_mhz : float
        Operating frequency in MHz.
    min_sensors : int
        Minimum sensors needed for a fix (default 3).
    """

    tx_power_dBm: float = 20.0
    freq_mhz: float = 2400.0
    min_sensors: int = 3

    # ── Distance from RSSI ────────────────────────────────────────────

    def rssi_to_distance(self, rssi_dBm: float) -> float:
        """
        Invert free-space path loss to estimate distance.

        d = 10^((P_tx - RSSI - 20·log10(f) - 32.44) / 20)
        """
        exponent = (self.tx_power_dBm - rssi_dBm - 20 * np.log10(self.freq_mhz) - 32.44) / 20.0
        return 10.0 ** exponent

    # ── Trilateration ─────────────────────────────────────────────────

    def trilaterate(
        self,
        sensor_positions: np.ndarray,
        estimated_distances: np.ndarray,
        initial_guess: Optional[np.ndarray] = None,
    ) -> Tuple[np.ndarray, float]:
        """
        Least-squares trilateration.

        Parameters
        ----------
        sensor_positions : np.ndarray, shape (M, 2)
            (x, y) of each detecting sensor.
        estimated_distances : np.ndarray, shape (M,)
            Distance estimates from RSSI.
        initial_guess : np.ndarray, shape (2,)
            Starting point for optimizer (defaults to centroid).

        Returns
        -------
        position : np.ndarray, shape (2,)
            Estimated (x, y).
        residual : float
            Sum of squared residuals.
        """
        if initial_guess is None:
            initial_guess = sensor_positions.mean(axis=0)

        def cost(pos):
            diffs = np.linalg.norm(sensor_positions - pos, axis=1) - estimated_distances
            return diffs

        result = least_squares(cost, initial_guess, method="lm")
        return result.x, float(np.sum(result.fun ** 2))

    # ── GDOP (Geometric Dilution of Precision) ────────────────────────

    @staticmethod
    def _compute_gdop(sensor_positions: np.ndarray, est_position: np.ndarray) -> float:
        """
        Simple 2-D GDOP — lower is better geometry.

        Computes the trace of (Hᵀ H)⁻¹ where H is the Jacobian of the
        range equations w.r.t. position.
        """
        n = len(sensor_positions)
        if n < 2:
            return 999.0

        H = np.zeros((n, 2))
        for i, sp in enumerate(sensor_positions):
            vec = est_position - sp
            dist = np.linalg.norm(vec)
            if dist < 1e-6:
                dist = 1e-6
            H[i] = vec / dist

        try:
            cov = np.linalg.inv(H.T @ H)
            return float(np.sqrt(np.trace(cov)))
        except np.linalg.LinAlgError:
            return 999.0

    # ── Confidence scoring ────────────────────────────────────────────

    def _score_confidence(
        self, num_sensors: int, residual: float, gdop: float
    ) -> float:
        """
        Heuristic confidence ∈ [0, 1]:
          - More sensors → higher confidence
          - Lower residual → higher confidence
          - Lower GDOP → higher confidence
        """
        sensor_factor = min(num_sensors / 6.0, 1.0)  # saturates at 6
        residual_factor = np.exp(-residual / 500.0)    # decays with residual
        gdop_factor = 1.0 / (1.0 + gdop / 5.0)       # penalty for poor geometry

        raw = 0.4 * sensor_factor + 0.35 * residual_factor + 0.25 * gdop_factor
        return float(np.clip(raw, 0.0, 1.0))

    # ── Full localization step ────────────────────────────────────────

    def localize(
        self,
        time: float,
        readings: list,
        sensor_nodes: list,
        prev_estimate: Optional[np.ndarray] = None,
    ) -> LocalizationResult:
        """
        Run one localization cycle from raw sensor readings.

        Parameters
        ----------
        time : float
            Current timestamp.
        readings : list
            Output of ``SensorNetwork.measure_rssi`` (list with None
            for non-detecting sensors and dicts for detecting ones).
        sensor_nodes : list of SensorNode
            The sensor network's node list.
        prev_estimate : np.ndarray or None
            Previous position estimate (used as initial guess).

        Returns
        -------
        LocalizationResult
        """
        # Filter out non-detections
        active = [
            (sensor_nodes[i], r)
            for i, r in enumerate(readings)
            if r is not None
        ]

        if len(active) < self.min_sensors:
            return LocalizationResult(
                time=time,
                est_x=np.nan,
                est_y=np.nan,
                confidence=0.0,
                num_sensors=len(active),
                residual=np.inf,
                has_fix=False,
            )

        sensor_pos = np.array([[s.x, s.y] for s, _ in active])
        distances = np.array([self.rssi_to_distance(r["rssi_dBm"]) for _, r in active])

        guess = prev_estimate if prev_estimate is not None else None
        est_pos, residual = self.trilaterate(sensor_pos, distances, initial_guess=guess)

        gdop = self._compute_gdop(sensor_pos, est_pos)
        confidence = self._score_confidence(len(active), residual, gdop)

        return LocalizationResult(
            time=time,
            est_x=float(est_pos[0]),
            est_y=float(est_pos[1]),
            confidence=confidence,
            num_sensors=len(active),
            residual=residual,
            has_fix=True,
        )

    # ── Batch localization ────────────────────────────────────────────

    def localize_trajectory(
        self,
        times: np.ndarray,
        all_readings: list,
        sensor_nodes: list,
    ) -> List[LocalizationResult]:
        """
        Localize for every timestep in a trajectory.

        Parameters
        ----------
        times : np.ndarray, shape (N,)
        all_readings : list of list
            Output of ``SensorNetwork.measure_trajectory``.
        sensor_nodes : list of SensorNode

        Returns
        -------
        results : list of LocalizationResult
        """
        results = []
        prev_est = None
        for t, readings in zip(times, all_readings):
            loc = self.localize(t, readings, sensor_nodes, prev_estimate=prev_est)
            if loc.has_fix:
                prev_est = np.array([loc.est_x, loc.est_y])
            results.append(loc)
        return results
