"""
Mission After-Action Report (AAR) & Telemetry Exporter
======================================================
Evaluates defense performance, generates letter grades,
and exports full simulation logs.
"""

import json
import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import Dict, Any, Optional


@dataclass
class MissionScorecard:
    letter_grade: str
    composite_score: float
    integrity_score: float
    intercept_status: str
    ew_denial_score: float
    mean_track_error: float
    critical_breaches: int


class MissionAnalytics:
    @staticmethod
    def evaluate_mission(
        errors: np.ndarray,
        lq_series: np.ndarray,
        alerts: list,
        interception_killed: bool = False
    ) -> MissionScorecard:
        valid_errs = [e for e in errors if e is not None and not np.isnan(e)]
        mean_err = float(np.mean(valid_errs)) if valid_errs else 0.0

        n_crit = sum(1 for a in alerts if a.get("severity") == "CRITICAL")
        n_warn = sum(1 for a in alerts if a.get("severity") == "WARNING")

        integrity = max(0.0, 100.0 - (n_crit * 12.0) - (n_warn * 3.0))
        ew_denial = float((1.0 - np.mean(lq_series)) * 100.0)
        intercept_eff = 95.0 if interception_killed else 30.0

        composite = (integrity * 0.4) + (intercept_eff * 0.35) + (ew_denial * 0.15) + (max(0.0, 100.0 - mean_err * 4) * 0.1)

        grade = "A+" if composite >= 90 else ("A" if composite >= 80 else ("B" if composite >= 70 else ("C" if composite >= 55 else "F")))

        return MissionScorecard(
            letter_grade=grade,
            composite_score=round(composite, 1),
            integrity_score=round(integrity, 1),
            intercept_status="SUCCESSFUL (TARGET DESTROYED)" if interception_killed else "PENETRATED",
            ew_denial_score=round(ew_denial, 1),
            mean_track_error=round(mean_err, 2),
            critical_breaches=n_crit
        )

    @staticmethod
    def export_csv(times, trajectory, loc_results, filepath: str = "telemetry.csv"):
        df = pd.DataFrame({
            "Time_s": times,
            "Target_X": [p[1] if isinstance(p, (list, np.ndarray)) else p.get("x") for p in trajectory],
            "Target_Y": [p[2] if isinstance(p, (list, np.ndarray)) else p.get("y") for p in trajectory],
        })
        df.to_csv(filepath, index=False)
