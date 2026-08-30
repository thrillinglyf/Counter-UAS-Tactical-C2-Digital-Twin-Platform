"""
Streamlit Dashboard Visualizations
==================================
High-tech tactical command-and-control visualization components.

Panels:
  1. 2-D Tactical Situational Map (true path, estimated path, sensors + range rings, no-fly zone + buffer)
  2. Link Quality & RF Spectrum Timeline (SNR, packet success rate, jammer activation zones)
  3. Tracking Error & Confidence Analytics
  4. FHSS Channel Hop Waterfall / Occupancy Heatmap
  5. Styled Alert Intelligence Log
"""

import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from shapely.geometry import Polygon

from ..layer3_alerting.rules_engine import Alert, Severity


# ═══════════════════════════════════════════════════════════════════════
#  Futuristic Tactical Color Palette
# ═══════════════════════════════════════════════════════════════════════

COLORS = {
    "bg": "#0a0c16",
    "card": "#121629",
    "card_border": "rgba(0, 212, 255, 0.18)",
    "accent_cyan": "#00f0ff",
    "accent_purple": "#7000ff",
    "accent_pink": "#ff007f",
    "true_path": "#00ff66",
    "est_path": "#ff9900",
    "sensor": "#00b0ff",
    "sensor_range": "rgba(0, 176, 255, 0.08)",
    "sensor_range_border": "rgba(0, 176, 255, 0.25)",
    "zone_fill": "rgba(255, 23, 68, 0.18)",
    "zone_border": "#ff1744",
    "buffer_fill": "rgba(255, 152, 0, 0.08)",
    "buffer_border": "rgba(255, 152, 0, 0.35)",
    "alert_info": "#00b0ff",
    "alert_warn": "#ff9100",
    "alert_crit": "#ff1744",
    "grid": "#1a2038",
    "text": "#e2e8f0",
    "text_muted": "#94a3b8",
}

SEVERITY_COLORS = {
    Severity.INFO: COLORS["alert_info"],
    Severity.WARNING: COLORS["alert_warn"],
    Severity.CRITICAL: COLORS["alert_crit"],
    "INFO": COLORS["alert_info"],
    "WARNING": COLORS["alert_warn"],
    "CRITICAL": COLORS["alert_crit"],
}

SEVERITY_EMOJI = {
    Severity.INFO: "🔵",
    Severity.WARNING: "🟡",
    Severity.CRITICAL: "🔴",
    "INFO": "🔵",
    "WARNING": "🟡",
    "CRITICAL": "🔴",
}


def get_severity_emoji(sev) -> str:
    val = sev.value if hasattr(sev, "value") else str(sev)
    return SEVERITY_EMOJI.get(val, SEVERITY_EMOJI.get(sev, "⚪"))


def get_severity_color(sev) -> str:
    val = sev.value if hasattr(sev, "value") else str(sev)
    return SEVERITY_COLORS.get(val, SEVERITY_COLORS.get(sev, COLORS["accent_cyan"]))


# ═══════════════════════════════════════════════════════════════════════
#  2-D Tactical Map Figure
# ═══════════════════════════════════════════════════════════════════════

def build_map_figure(
    trajectory: np.ndarray,
    loc_results: list,
    sensor_nodes: list,
    zone_polygon: Polygon,
    alerts: list,
    approach_buffer_m: float = 100.0,
) -> go.Figure:
    """Build high-resolution tactical radar map."""

    fig = go.Figure()

    # ── Approach Buffer Zone ──────────────────────────────────────────
    buffered_zone = zone_polygon.buffer(approach_buffer_m)
    bx, by = buffered_zone.exterior.xy
    fig.add_trace(
        go.Scatter(
            x=list(bx),
            y=list(by),
            fill="toself",
            fillcolor=COLORS["buffer_fill"],
            line=dict(color=COLORS["buffer_border"], width=1.5, dash="dot"),
            name=f"Warning Buffer ({approach_buffer_m:.0f}m)",
            hoverinfo="name",
        )
    )

    # ── Critical No-Fly Zone ──────────────────────────────────────────
    zx, zy = zone_polygon.exterior.xy
    fig.add_trace(
        go.Scatter(
            x=list(zx),
            y=list(zy),
            fill="toself",
            fillcolor=COLORS["zone_fill"],
            line=dict(color=COLORS["zone_border"], width=2.5),
            name="No-Fly Zone",
            hoverinfo="name",
        )
    )

    # ── Sensor Coverage Circles ───────────────────────────────────────
    for idx, s in enumerate(sensor_nodes):
        theta = np.linspace(0, 2 * np.pi, 60)
        cx = s.x + s.detection_range * np.cos(theta)
        cy = s.y + s.detection_range * np.sin(theta)
        fig.add_trace(
            go.Scatter(
                x=cx,
                y=cy,
                fill="toself",
                fillcolor=COLORS["sensor_range"],
                line=dict(color=COLORS["sensor_range_border"], width=1, dash="dash"),
                name=f"Sensor {s.node_id} Coverage" if idx == 0 else None,
                showlegend=(idx == 0),
                hoverinfo="skip",
            )
        )

    # ── Sensor Node Markers ───────────────────────────────────────────
    sx = [s.x for s in sensor_nodes]
    sy = [s.y for s in sensor_nodes]
    fig.add_trace(
        go.Scatter(
            x=sx,
            y=sy,
            mode="markers+text",
            marker=dict(
                size=14,
                color=COLORS["sensor"],
                symbol="diamond",
                line=dict(width=2, color="#ffffff"),
            ),
            text=[f"S{s.node_id}" for s in sensor_nodes],
            textposition="top center",
            textfont=dict(size=11, color=COLORS["accent_cyan"], family="Consolas, monospace"),
            name="RF Sensor Nodes",
        )
    )

    # ── True Drone Trajectory ─────────────────────────────────────────
    fig.add_trace(
        go.Scatter(
            x=trajectory[:, 1],
            y=trajectory[:, 2],
            mode="lines",
            line=dict(color=COLORS["true_path"], width=3),
            name="Ground Truth Path",
            opacity=0.9,
        )
    )

    # Start & End Waypoints
    fig.add_trace(
        go.Scatter(
            x=[trajectory[0, 1]],
            y=[trajectory[0, 2]],
            mode="markers+text",
            marker=dict(size=14, color=COLORS["true_path"], symbol="circle-open", line=dict(width=3)),
            text=["START"],
            textposition="bottom left",
            textfont=dict(size=10, color=COLORS["true_path"]),
            name="Origin",
            showlegend=False,
        )
    )
    fig.add_trace(
        go.Scatter(
            x=[trajectory[-1, 1]],
            y=[trajectory[-1, 2]],
            mode="markers+text",
            marker=dict(size=14, color=COLORS["true_path"], symbol="x"),
            text=["DEST"],
            textposition="top right",
            textfont=dict(size=10, color=COLORS["true_path"]),
            name="Destination",
            showlegend=False,
        )
    )

    # ── Estimated Path (Trilateration) ────────────────────────────────
    est_x = [r.est_x for r in loc_results if r.has_fix]
    est_y = [r.est_y for r in loc_results if r.has_fix]
    fig.add_trace(
        go.Scatter(
            x=est_x,
            y=est_y,
            mode="lines+markers",
            line=dict(color=COLORS["est_path"], width=2, dash="dot"),
            marker=dict(size=4, color=COLORS["est_path"]),
            name="Trilateration Estimate",
            opacity=0.85,
        )
    )

    # ── Alert Detection Events ────────────────────────────────────────
    for sev in Severity:
        ax = [a.est_x for a in alerts if a.severity == sev]
        ay = [a.est_y for a in alerts if a.severity == sev]
        if ax:
            fig.add_trace(
                go.Scatter(
                    x=ax,
                    y=ay,
                    mode="markers",
                    marker=dict(
                        size=11,
                        color=SEVERITY_COLORS[sev],
                        symbol="triangle-up",
                        line=dict(width=1.5, color="#ffffff"),
                    ),
                    name=f"Alert: {sev.value}",
                )
            )

    # ── Layout & Tactical Styling ─────────────────────────────────────
    fig.update_layout(
        title=dict(
            text="<b>🎯 2D TACTICAL AIRSPACE & SENSOR NETWORK DIGITAL TWIN</b>",
            font=dict(size=16, color=COLORS["accent_cyan"], family="Consolas, monospace"),
            x=0.01,
            y=0.97,
        ),
        paper_bgcolor=COLORS["card"],
        plot_bgcolor=COLORS["bg"],
        font=dict(color=COLORS["text"], family="Inter, sans-serif"),
        xaxis=dict(
            title="X Coordinate (meters)",
            gridcolor=COLORS["grid"],
            zerolinecolor=COLORS["grid"],
            showgrid=True,
            scaleanchor="y",
        ),
        yaxis=dict(
            title="Y Coordinate (meters)",
            gridcolor=COLORS["grid"],
            zerolinecolor=COLORS["grid"],
            showgrid=True,
        ),
        legend=dict(
            bgcolor="rgba(10, 12, 22, 0.85)",
            bordercolor=COLORS["card_border"],
            borderwidth=1,
            font=dict(size=10),
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="left",
            x=0.01,
        ),
        margin=dict(l=50, r=30, t=80, b=50),
        height=620,
    )

    return fig


# ═══════════════════════════════════════════════════════════════════════
#  Link Quality & RF Spectrum Timeline Figure
# ═══════════════════════════════════════════════════════════════════════

def build_link_quality_figure(
    times: np.ndarray,
    snr_series: np.ndarray,
    lq_series: np.ndarray,
    jammed_series: np.ndarray,
) -> go.Figure:
    """SNR and link-quality over time with glowing jammed regions."""

    fig = make_subplots(
        rows=2, cols=1,
        shared_xaxes=True,
        row_heights=[0.55, 0.45],
        vertical_spacing=0.1,
        subplot_titles=["<b>Signal-to-Noise Ratio (SNR dB)</b>", "<b>Packet Link Quality (0–100%)</b>"],
    )

    # SNR Line
    fig.add_trace(
        go.Scatter(
            x=times,
            y=snr_series,
            mode="lines",
            line=dict(color=COLORS["accent_purple"], width=2),
            name="SNR (dB)",
        ),
        row=1, col=1,
    )

    # Link Quality Line
    fig.add_trace(
        go.Scatter(
            x=times,
            y=lq_series * 100,
            mode="lines",
            line=dict(color=COLORS["accent_cyan"], width=2),
            name="Link Quality (%)",
            fill="tozeroy",
            fillcolor="rgba(0, 240, 255, 0.08)",
        ),
        row=2, col=1,
    )

    # Shade jammed regions
    jammed_mask = jammed_series.astype(bool)
    if jammed_mask.any():
        diff = np.diff(jammed_mask.astype(int))
        starts = np.where(diff == 1)[0] + 1
        ends = np.where(diff == -1)[0] + 1
        if jammed_mask[0]:
            starts = np.concatenate([[0], starts])
        if jammed_mask[-1]:
            ends = np.concatenate([ends, [len(times) - 1]])

        for s_idx, e_idx in zip(starts, ends):
            for row in [1, 2]:
                fig.add_vrect(
                    x0=times[s_idx], x1=times[e_idx],
                    fillcolor="rgba(255, 23, 68, 0.15)",
                    line_width=1,
                    line_color="rgba(255, 23, 68, 0.4)",
                    annotation_text="JAMMED" if row == 1 and s_idx == starts[0] else None,
                    annotation_font=dict(color="#ff1744", size=9),
                    row=row, col=1,
                )

    fig.update_layout(
        paper_bgcolor=COLORS["card"],
        plot_bgcolor=COLORS["bg"],
        font=dict(color=COLORS["text"], family="Inter, sans-serif"),
        height=380,
        margin=dict(l=50, r=30, t=40, b=40),
        showlegend=False,
    )
    for i in [1, 2]:
        fig.update_xaxes(gridcolor=COLORS["grid"], row=i, col=1)
        fig.update_yaxes(gridcolor=COLORS["grid"], row=i, col=1)

    fig.update_xaxes(title_text="Time (seconds)", row=2, col=1)

    return fig


# ═══════════════════════════════════════════════════════════════════════
#  Tracking Error & Confidence Analytics Figure
# ═══════════════════════════════════════════════════════════════════════

def build_tracking_error_figure(
    times: np.ndarray,
    errors: np.ndarray,
    loc_results: list,
) -> go.Figure:
    """Euclidean tracking error and detection confidence analytics."""

    fig = make_subplots(
        rows=2, cols=1,
        shared_xaxes=True,
        row_heights=[0.6, 0.4],
        vertical_spacing=0.1,
        subplot_titles=["<b>Localization Error (meters)</b>", "<b>Detection Confidence (0–1.0)</b>"],
    )

    valid_mask = ~np.isnan(errors)
    fig.add_trace(
        go.Scatter(
            x=times[valid_mask],
            y=errors[valid_mask],
            mode="lines",
            line=dict(color="#ff9100", width=2),
            fill="tozeroy",
            fillcolor="rgba(255, 145, 0, 0.1)",
            name="Error (m)",
        ),
        row=1, col=1,
    )

    # Mean error reference line
    if valid_mask.any():
        mean_err = float(np.nanmean(errors))
        fig.add_hline(
            y=mean_err,
            line=dict(color=COLORS["accent_cyan"], width=1.5, dash="dash"),
            annotation_text=f"Avg: {mean_err:.1f}m",
            annotation_font=dict(color=COLORS["accent_cyan"], size=10),
            row=1, col=1,
        )

    # Confidence curve
    confidences = np.array([r.confidence for r in loc_results])
    fig.add_trace(
        go.Scatter(
            x=times,
            y=confidences,
            mode="lines",
            line=dict(color=COLORS["true_path"], width=1.8),
            fill="tozeroy",
            fillcolor="rgba(0, 255, 102, 0.08)",
            name="Confidence",
        ),
        row=2, col=1,
    )

    fig.update_layout(
        paper_bgcolor=COLORS["card"],
        plot_bgcolor=COLORS["bg"],
        font=dict(color=COLORS["text"], family="Inter, sans-serif"),
        height=380,
        margin=dict(l=50, r=30, t=40, b=40),
        showlegend=False,
    )
    for i in [1, 2]:
        fig.update_xaxes(gridcolor=COLORS["grid"], row=i, col=1)
        fig.update_yaxes(gridcolor=COLORS["grid"], row=i, col=1)

    fig.update_xaxes(title_text="Time (seconds)", row=2, col=1)
    fig.update_yaxes(title_text="Meters", row=1, col=1)
    fig.update_yaxes(title_text="Score", row=2, col=1, range=[0, 1.05])

    return fig


# ═══════════════════════════════════════════════════════════════════════
#  FHSS Channel Hop Distribution Chart
# ═══════════════════════════════════════════════════════════════════════

def build_fhss_waterfall_figure(
    times: np.ndarray,
    channels: np.ndarray,
    n_channels: int,
) -> go.Figure:
    """Channel occupancy distribution scatter plot showing FHSS hopping."""

    fig = go.Figure()

    fig.add_trace(
        go.Scatter(
            x=times,
            y=channels,
            mode="markers",
            marker=dict(
                size=4,
                color=channels,
                colorscale="Viridis",
                showscale=False,
                opacity=0.8,
            ),
            name="Active Hop Channel",
        )
    )

    fig.update_layout(
        title=dict(
            text="<b>📡 FHSS FREQUENCY-HOPPING CHANNEL OCCUPANCY WATERFALL</b>",
            font=dict(size=14, color=COLORS["accent_cyan"], family="Consolas, monospace"),
            x=0.01,
        ),
        paper_bgcolor=COLORS["card"],
        plot_bgcolor=COLORS["bg"],
        font=dict(color=COLORS["text"], family="Inter, sans-serif"),
        xaxis=dict(title="Time (seconds)", gridcolor=COLORS["grid"]),
        yaxis=dict(title="Channel Index (0–N)", gridcolor=COLORS["grid"], range=[-1, n_channels]),
        height=300,
        margin=dict(l=50, r=30, t=45, b=40),
    )

    return fig


# ═══════════════════════════════════════════════════════════════════════
#  Styled Alert DataFrame Builder
# ═══════════════════════════════════════════════════════════════════════

def alerts_to_dataframe(alerts: list) -> pd.DataFrame:
    """Convert alert list to a clean, readable DataFrame."""
    if not alerts:
        return pd.DataFrame(columns=["Time (s)", "Severity", "Position (X, Y)", "Intelligence & Alert Message"])

    rows = []
    for a in alerts:
        rows.append(
            {
                "Time (s)": f"{a.timestamp:.2f}",
                "Severity": f"{SEVERITY_EMOJI[a.severity]} {a.severity.value}",
                "Position (X, Y)": f"({a.est_x:.1f}, {a.est_y:.1f})",
                "Intelligence & Alert Message": a.message,
            }
        )
    return pd.DataFrame(rows)
