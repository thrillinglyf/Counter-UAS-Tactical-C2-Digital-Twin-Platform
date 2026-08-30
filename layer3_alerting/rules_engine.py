"""
Rules Engine
============
No-fly zone enforcement, boundary-crossing detection, persistence
checks, and severity-graded alerting.
"""

import numpy as np
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Tuple
from shapely.geometry import Point, Polygon


class Severity(Enum):
    """Alert severity levels."""
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


@dataclass
class Alert:
    """A single alert record."""
    timestamp: float
    est_x: float
    est_y: float
    severity: Severity
    message: str


@dataclass
class RulesEngine:
    """
    Evaluates detection rules against estimated drone positions.

    Parameters
    ----------
    zone_vertices : list of (x, y)
        Vertices defining the no-fly zone polygon.
    confidence_threshold : float
        Minimum confidence to trigger alerts (default 0.5).
    persistence_count : int
        Number of consecutive inside-zone detections before CRITICAL
        alert fires (default 3).
    approach_buffer_m : float
        Distance (meters) outside the zone at which INFO alerts start
        (default 100).
    """

    zone_vertices: List[Tuple[float, float]] = field(
        default_factory=lambda: [
            (-150, -150),
            (150, -150),
            (150, 150),
            (-150, 150),
        ]
    )
    confidence_threshold: float = 0.5
    persistence_count: int = 3
    approach_buffer_m: float = 100.0

    def __post_init__(self):
        self._zone = Polygon(self.zone_vertices)
        self._buffered_zone = self._zone.buffer(self.approach_buffer_m)
        self._consecutive_inside = 0
        self.alerts: List[Alert] = []

    @property
    def zone_polygon(self) -> Polygon:
        return self._zone

    def reset(self):
        """Clear alert history and persistence counter."""
        self._consecutive_inside = 0
        self.alerts.clear()

    def evaluate(
        self,
        time: float,
        est_x: float,
        est_y: float,
        confidence: float,
        has_fix: bool,
    ) -> Optional[Alert]:
        """
        Evaluate a single timestep against the rule set.

        Returns an ``Alert`` if any rule fires, else ``None``.
        """
        if not has_fix:
            # Can't evaluate without a position fix
            self._consecutive_inside = 0
            return None

        if confidence < self.confidence_threshold:
            # Below confidence gate — don't alert
            self._consecutive_inside = 0
            return None

        point = Point(est_x, est_y)
        inside_zone = self._zone.contains(point)
        inside_buffer = self._buffered_zone.contains(point)

        if inside_zone:
            self._consecutive_inside += 1
        else:
            self._consecutive_inside = 0

        alert = None

        if inside_zone and self._consecutive_inside >= self.persistence_count:
            alert = Alert(
                timestamp=time,
                est_x=est_x,
                est_y=est_y,
                severity=Severity.CRITICAL,
                message=(
                    f"CRITICAL: Drone persisting inside no-fly zone "
                    f"({self._consecutive_inside} consecutive fixes). "
                    f"Position: ({est_x:.1f}, {est_y:.1f})"
                ),
            )
        elif inside_zone:
            alert = Alert(
                timestamp=time,
                est_x=est_x,
                est_y=est_y,
                severity=Severity.WARNING,
                message=(
                    f"WARNING: Drone crossed no-fly zone boundary. "
                    f"Position: ({est_x:.1f}, {est_y:.1f})"
                ),
            )
        elif inside_buffer:
            alert = Alert(
                timestamp=time,
                est_x=est_x,
                est_y=est_y,
                severity=Severity.INFO,
                message=(
                    f"INFO: Drone approaching no-fly zone "
                    f"({self.approach_buffer_m:.0f}m buffer). "
                    f"Position: ({est_x:.1f}, {est_y:.1f})"
                ),
            )

        if alert is not None:
            self.alerts.append(alert)
        return alert

    def evaluate_track(
        self,
        loc_results: list,
    ) -> List[Alert]:
        """
        Run rules over an entire localization track.

        Parameters
        ----------
        loc_results : list of LocalizationResult

        Returns
        -------
        alerts : list of Alert
        """
        self.reset()
        for loc in loc_results:
            self.evaluate(
                time=loc.time,
                est_x=loc.est_x,
                est_y=loc.est_y,
                confidence=loc.confidence,
                has_fix=loc.has_fix,
            )
        return list(self.alerts)
