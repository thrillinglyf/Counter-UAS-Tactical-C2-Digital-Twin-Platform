"""
Sensor Network
==============
Models a distributed RF sensor network with configurable placement
and realistic RSSI measurements using free-space path loss.
"""

import numpy as np
from dataclasses import dataclass, field
from typing import List, Optional, Dict


@dataclass
class SensorNode:
    """
    A single RF sensor node.

    Parameters
    ----------
    node_id : int
        Unique identifier.
    x, y : float
        Position in meters (2-D ground plane).
    detection_range : float
        Maximum range (meters) at which the sensor can detect a signal.
    noise_std_dB : float
        Standard deviation of Gaussian RSSI measurement noise (dB).
    """

    node_id: int
    x: float
    y: float
    detection_range: float = 500.0
    noise_std_dB: float = 3.0


@dataclass
class SensorNetwork:
    """
    A collection of sensor nodes arranged around a defended area.

    Parameters
    ----------
    sensors : list of SensorNode
        Manually supplied sensor list.  If empty, use ``place_ring`` or
        ``place_grid`` to auto-generate sensors.
    tx_power_dBm : float
        Assumed drone transmit power (dBm). Default 20 dBm (100 mW).
    freq_mhz : float
        Operating frequency (MHz) for path-loss calc. Default 2400.
    """

    sensors: List[SensorNode] = field(default_factory=list)
    tx_power_dBm: float = 20.0
    freq_mhz: float = 2400.0

    # ── Placement helpers ─────────────────────────────────────────────

    def place_ring(
        self,
        center: tuple = (0.0, 0.0),
        radius: float = 400.0,
        n_sensors: int = 8,
        detection_range: float = 500.0,
        noise_std_dB: float = 3.0,
    ) -> None:
        """Place *n_sensors* evenly around a circle."""
        self.sensors.clear()
        for i in range(n_sensors):
            angle = 2 * np.pi * i / n_sensors
            sx = center[0] + radius * np.cos(angle)
            sy = center[1] + radius * np.sin(angle)
            self.sensors.append(
                SensorNode(
                    node_id=i,
                    x=sx,
                    y=sy,
                    detection_range=detection_range,
                    noise_std_dB=noise_std_dB,
                )
            )

    def place_grid(
        self,
        origin: tuple = (-400.0, -400.0),
        spacing: float = 200.0,
        rows: int = 5,
        cols: int = 5,
        detection_range: float = 500.0,
        noise_std_dB: float = 3.0,
    ) -> None:
        """Place sensors on a rectangular grid."""
        self.sensors.clear()
        idx = 0
        for r in range(rows):
            for c in range(cols):
                sx = origin[0] + c * spacing
                sy = origin[1] + r * spacing
                self.sensors.append(
                    SensorNode(
                        node_id=idx,
                        x=sx,
                        y=sy,
                        detection_range=detection_range,
                        noise_std_dB=noise_std_dB,
                    )
                )
                idx += 1

    # ── RSSI model ────────────────────────────────────────────────────

    @staticmethod
    def _fspl_dB(distance_m: float, freq_mhz: float) -> float:
        """Free-Space Path Loss in dB (ITU model)."""
        if distance_m <= 0:
            return 0.0
        return 20 * np.log10(distance_m) + 20 * np.log10(freq_mhz) + 32.44

    def measure_rssi(
        self,
        drone_x: float,
        drone_y: float,
        drone_z: float = 50.0,
        rng: Optional[np.random.Generator] = None,
    ) -> List[Optional[Dict]]:
        """
        Compute RSSI at each sensor for a drone at (x, y, z).

        Returns a list (one entry per sensor).  Each entry is either:
          - ``{"sensor_id": int, "rssi_dBm": float, "distance": float}``
          - ``None``  (drone out of detection range)

        Parameters
        ----------
        drone_x, drone_y, drone_z : float
            Drone 3-D position.
        rng : numpy Generator, optional
            For reproducible noise draws.
        """
        if rng is None:
            rng = np.random.default_rng()

        readings = []
        for s in self.sensors:
            dx = drone_x - s.x
            dy = drone_y - s.y
            dz = drone_z  # sensors assumed at ground level (z=0)
            dist = np.sqrt(dx**2 + dy**2 + dz**2)

            if dist > s.detection_range:
                readings.append(None)
                continue

            fspl = self._fspl_dB(dist, self.freq_mhz)
            noise = rng.normal(0, s.noise_std_dB)
            rssi = self.tx_power_dBm - fspl + noise

            readings.append(
                {
                    "sensor_id": s.node_id,
                    "rssi_dBm": rssi,
                    "distance": dist,
                }
            )

        return readings

    # ── Bulk measurement for a full trajectory ────────────────────────

    def measure_trajectory(
        self,
        trajectory: np.ndarray,
        seed: Optional[int] = 0,
    ) -> list:
        """
        Run ``measure_rssi`` for every row in *trajectory*.

        Parameters
        ----------
        trajectory : np.ndarray, shape (N, 4)
            Columns [time, x, y, z].
        seed : int
            RNG seed.

        Returns
        -------
        all_readings : list of list
            ``all_readings[i]`` is the sensor readings at timestep *i*.
        """
        rng = np.random.default_rng(seed)
        all_readings = []
        for row in trajectory:
            _, x, y, z = row
            readings = self.measure_rssi(x, y, z, rng=rng)
            all_readings.append(readings)
        return all_readings
