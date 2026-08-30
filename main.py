"""
Counter-Drone Simulation — Main Pipeline & Tactical Dashboard
===============================================================
Orchestrates all three simulation layers and renders an advanced C2 Command Center UI.

Usage:
    streamlit run counter_drone_sim/main.py
"""

import sys
import os
from datetime import datetime

# Ensure project root is on sys.path
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

import numpy as np
import pandas as pd
import streamlit as st

# ── Layer 1 ───────────────────────────────────────────────────────────
from counter_drone_sim.layer1_comms.drone_model import DroneMotionModel
from counter_drone_sim.layer1_comms.fhss_sim import FHSSSimulator
from counter_drone_sim.layer1_comms.jammer_sim import (
    create_jammer,
    LinkQualityCalculator,
    NoJammer,
)

# ── Layer 2 ───────────────────────────────────────────────────────────
from counter_drone_sim.layer2_sensors.sensor_network import SensorNetwork
from counter_drone_sim.layer2_sensors.localization import Localizer

# ── Layer 3 ───────────────────────────────────────────────────────────
from counter_drone_sim.layer3_alerting.rules_engine import RulesEngine, Severity
from counter_drone_sim.layer3_alerting.dashboard import (
    build_map_figure,
    build_link_quality_figure,
    build_tracking_error_figure,
    build_fhss_waterfall_figure,
    alerts_to_dataframe,
    COLORS,
    SEVERITY_EMOJI,
)


# ═══════════════════════════════════════════════════════════════════════
#  Page Config & Advanced Glassmorphism CSS
# ═══════════════════════════════════════════════════════════════════════

st.set_page_config(
    page_title="C-UAS Tactical Command Twin",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap');

    /* Global Dark Theme Background */
    .stApp {
        background: radial-gradient(circle at 50% 0%, #181d38 0%, #0a0c16 60%, #05060b 100%);
        font-family: 'Inter', sans-serif;
        color: #e2e8f0;
    }

    /* Hide standard top header padding */
    .block-container {
        padding-top: 1.5rem !important;
        padding-bottom: 2rem !important;
    }

    /* Sidebar Glassmorphism */
    section[data-testid="stSidebar"] {
        background: rgba(15, 18, 34, 0.85) !important;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-right: 1px solid rgba(0, 240, 255, 0.15);
    }
    section[data-testid="stSidebar"] .stMarkdown h2, 
    section[data-testid="stSidebar"] .stMarkdown h3 {
        font-family: 'JetBrains Mono', monospace;
        letter-spacing: 1px;
    }

    /* Tabs Styling */
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
        background: rgba(18, 22, 41, 0.6);
        padding: 6px;
        border-radius: 12px;
        border: 1px solid rgba(0, 240, 255, 0.12);
    }
    .stTabs [data-baseweb="tab"] {
        height: 44px;
        border-radius: 8px;
        color: #94a3b8;
        font-weight: 600;
        font-size: 0.9rem;
        padding: 0 20px;
        border: none !important;
    }
    .stTabs [aria-selected="true"] {
        background: linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(112, 0, 255, 0.2)) !important;
        color: #00f0ff !important;
        border: 1px solid rgba(0, 240, 255, 0.4) !important;
        box-shadow: 0 0 15px rgba(0, 240, 255, 0.25);
    }

    /* Tactical KPI Cards */
    .kpi-card {
        background: rgba(18, 22, 41, 0.7);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(0, 240, 255, 0.15);
        border-radius: 14px;
        padding: 16px 20px;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.35);
        transition: transform 0.2s ease, border-color 0.2s ease;
        position: relative;
        overflow: hidden;
    }
    .kpi-card:hover {
        transform: translateY(-2px);
        border-color: rgba(0, 240, 255, 0.4);
    }
    .kpi-card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; width: 4px; height: 100%;
        background: #00f0ff;
    }
    .kpi-card.warn::before { background: #ff9100; }
    .kpi-card.crit::before { background: #ff1744; }
    .kpi-card.success::before { background: #00ff66; }

    .kpi-label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        color: #94a3b8;
        font-family: 'JetBrains Mono', monospace;
    }
    .kpi-value {
        font-size: 1.6rem;
        font-weight: 700;
        color: #ffffff;
        margin: 6px 0 2px 0;
        font-family: 'JetBrains Mono', monospace;
    }
    .kpi-sub {
        font-size: 0.75rem;
        color: #64748b;
    }

    /* Command Header Banner */
    .c2-header {
        background: linear-gradient(135deg, rgba(18, 22, 41, 0.95), rgba(10, 12, 22, 0.95));
        border: 1px solid rgba(0, 240, 255, 0.25);
        border-radius: 16px;
        padding: 18px 28px;
        margin-bottom: 20px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(0, 240, 255, 0.05);
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .c2-title {
        font-family: 'JetBrains Mono', monospace;
        font-size: 1.6rem;
        font-weight: 800;
        background: linear-gradient(90deg, #00f0ff, #7000ff, #ff007f);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0;
        letter-spacing: -0.5px;
    }
    .c2-subtitle {
        color: #94a3b8;
        font-size: 0.85rem;
        margin-top: 4px;
    }

    /* Status Badges */
    .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 700;
        font-family: 'JetBrains Mono', monospace;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    .status-badge.crit {
        background: rgba(255, 23, 68, 0.18);
        border: 1px solid #ff1744;
        color: #ff1744;
        box-shadow: 0 0 12px rgba(255, 23, 68, 0.4);
    }
    .status-badge.warn {
        background: rgba(255, 145, 0, 0.18);
        border: 1px solid #ff9100;
        color: #ff9100;
    }
    .status-badge.clear {
        background: rgba(0, 255, 102, 0.15);
        border: 1px solid #00ff66;
        color: #00ff66;
    }

    /* Pulsing Status Dot */
    .pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
        box-shadow: 0 0 8px currentColor;
        animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(1.3); }
        100% { opacity: 1; transform: scale(1); }
    }

    /* Custom Streamlit Button Styling */
    div.stButton > button {
        background: linear-gradient(135deg, #00f0ff 0%, #7000ff 100%) !important;
        color: #ffffff !important;
        font-weight: 700 !important;
        border: none !important;
        border-radius: 10px !important;
        padding: 12px 24px !important;
        font-family: 'JetBrains Mono', monospace !important;
        letter-spacing: 1px !important;
        box-shadow: 0 4px 20px rgba(0, 240, 255, 0.3) !important;
        transition: all 0.3s ease !important;
    }
    div.stButton > button:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 25px rgba(0, 240, 255, 0.5) !important;
    }

    /* Dataframe Table styling */
    .stDataFrame {
        border-radius: 12px !important;
        overflow: hidden !important;
        border: 1px solid rgba(0, 240, 255, 0.15) !important;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


# ═══════════════════════════════════════════════════════════════════════
#  Sidebar Controls
# ═══════════════════════════════════════════════════════════════════════

with st.sidebar:
    st.markdown("<h3 style='color:#00f0ff;'>🛡️ SIMULATION PARAMETERS</h3>", unsafe_allow_html=True)
    st.markdown("---")

    st.markdown("#### 🚁 **Layer 1: Drone Kinematics**")
    drone_speed = st.slider("Ground Speed (m/s)", 5.0, 40.0, 15.0, 1.0)
    drone_altitude = st.slider("Flight Altitude (m)", 10.0, 200.0, 50.0, 5.0)
    trajectory_mode = st.selectbox("Flight Path Profile", ["Waypoint Incursion", "Random Walk"])

    st.markdown("---")
    st.markdown("#### 📡 **Layer 1: FHSS Transmitter**")
    n_channels = st.slider("Hop Channels (N)", 10, 200, 50, 5)
    hop_rate = st.slider("Hop Dwell Rate (hops/s)", 10, 500, 100, 10)

    st.markdown("---")
    st.markdown("#### ⚡ **Layer 1: Electronic Warfare**")
    jammer_type = st.selectbox(
        "Jammer Archetype",
        ["None", "Barrage", "Sweep", "Reactive"],
    )
    if jammer_type != "None":
        jam_power = st.slider("Jammer EIRP (dBm)", 10.0, 50.0, 30.0, 1.0)
    else:
        jam_power = 0.0

    st.markdown("---")
    st.markdown("#### 📡 **Layer 2: Sensor Perimeter**")
    n_sensors = st.slider("Active Sensor Nodes", 4, 16, 8, 1)
    sensor_radius = st.slider("Defended Ring Radius (m)", 200.0, 800.0, 400.0, 25.0)
    sensor_range = st.slider("Sensor Range cutoff (m)", 300.0, 1000.0, 600.0, 25.0)
    noise_std = st.slider("RSSI Gaussian Noise σ (dB)", 0.5, 10.0, 3.0, 0.5)

    st.markdown("---")
    st.markdown("#### ⚙️ **Simulation Engine**")
    sim_dt = st.select_slider("Clock Delta (s)", options=[0.05, 0.1, 0.2, 0.5], value=0.1)

    st.markdown("---")
    run_btn = st.button("🚀 EXECUTE SIMULATION", use_container_width=True)


# ═══════════════════════════════════════════════════════════════════════
#  Pipeline Execution Function
# ═══════════════════════════════════════════════════════════════════════

@st.cache_data(show_spinner=False)
def run_pipeline(
    drone_speed, drone_altitude, trajectory_mode,
    n_channels, hop_rate,
    jammer_type, jam_power,
    n_sensors, sensor_radius, sensor_range, noise_std,
    sim_dt,
):
    # Layer 1 Motion
    drone = DroneMotionModel(speed=drone_speed, dt=sim_dt, altitude=drone_altitude)
    if trajectory_mode == "Waypoint Incursion":
        waypoints = [
            (-500, -300),
            (-300, -100),
            (-100, 0),
            (0, 50),
            (100, 80),
            (200, 50),
            (300, -50),
        ]
        trajectory = drone.generate_waypoint_trajectory(waypoints)
    else:
        trajectory = drone.generate_random_walk(
            start=(-500, -400),
            target=(0, 0),
            duration=40.0,
            bias_strength=0.65,
            noise_std=6.0,
            seed=42,
        )

    times = trajectory[:, 0]

    # Layer 1 FHSS
    fhss = FHSSSimulator(n_channels=n_channels, hop_rate=hop_rate, seed=42)
    channels = fhss.get_hop_series(times)

    # Layer 1 Jammer
    jammer_kwargs = {}
    if jammer_type != "None":
        jammer_kwargs["total_power_dBm"] = jam_power
        jammer_kwargs["n_channels"] = n_channels
        if jammer_type == "Sweep":
            jammer_kwargs["sweep_rate"] = 200.0
        elif jammer_type == "Reactive":
            jammer_kwargs["hop_rate"] = hop_rate
            jammer_kwargs["detection_prob"] = 0.6
            jammer_kwargs.pop("n_channels", None)

    jammer = create_jammer(jammer_type.lower(), **jammer_kwargs)
    link_calc = LinkQualityCalculator()

    snr_series = np.zeros(len(times))
    lq_series = np.zeros(len(times))
    jammed_series = np.zeros(len(times), dtype=bool)

    for i, (t, ch) in enumerate(zip(times, channels)):
        jsr = jammer.jsr_on_channel(t, int(ch))
        jammed_series[i] = jammer.is_jammed(t, int(ch))
        snr_series[i], lq_series[i] = link_calc.link_quality(jsr)

    # Layer 2 Sensor Network
    net = SensorNetwork(tx_power_dBm=20.0, freq_mhz=2400.0)
    net.place_ring(
        center=(0, 0),
        radius=sensor_radius,
        n_sensors=n_sensors,
        detection_range=sensor_range,
        noise_std_dB=noise_std,
    )
    all_readings = net.measure_trajectory(trajectory, seed=7)

    # Layer 2 Localization
    localizer = Localizer(tx_power_dBm=20.0, freq_mhz=2400.0)
    loc_results = localizer.localize_trajectory(times, all_readings, net.sensors)

    errors = np.full(len(times), np.nan)
    for i, loc in enumerate(loc_results):
        if loc.has_fix:
            dx = loc.est_x - trajectory[i, 1]
            dy = loc.est_y - trajectory[i, 2]
            errors[i] = np.sqrt(dx**2 + dy**2)

    # Layer 3 Rules Engine
    zone_verts = [(-150, -150), (150, -150), (150, 150), (-150, 150)]
    rules = RulesEngine(zone_vertices=zone_verts)
    alerts = rules.evaluate_track(loc_results)

    return {
        "trajectory": trajectory,
        "times": times,
        "channels": channels,
        "snr_series": snr_series,
        "lq_series": lq_series,
        "jammed_series": jammed_series,
        "sensor_nodes": net.sensors,
        "loc_results": loc_results,
        "errors": errors,
        "alerts": alerts,
        "zone_polygon": rules.zone_polygon,
    }


# ═══════════════════════════════════════════════════════════════════════
#  Main UI Rendering
# ═══════════════════════════════════════════════════════════════════════

# Execute simulation pipeline
if run_btn or "results" not in st.session_state:
    with st.spinner("⚡ Running 3-Layer C-UAS Digital Twin Engine..."):
        results = run_pipeline(
            drone_speed, drone_altitude, trajectory_mode,
            n_channels, hop_rate,
            jammer_type, jam_power,
            n_sensors, sensor_radius, sensor_range, noise_std,
            sim_dt,
        )
        st.session_state["results"] = results

results = st.session_state.get("results")

if results is None:
    st.info("👈 Select options on the left and click **Execute Simulation**.")
    st.stop()

# Compute summary stats
valid_errors = results["errors"][~np.isnan(results["errors"])]
mean_err = float(np.nanmean(valid_errors)) if len(valid_errors) > 0 else float("nan")
max_err = float(np.nanmax(valid_errors)) if len(valid_errors) > 0 else float("nan")

def get_sev_val(s):
    return s.value if hasattr(s, "value") else str(s)

first_alert_time = None
for a in results["alerts"]:
    if get_sev_val(a.severity) in ("WARNING", "CRITICAL"):
        first_alert_time = a.timestamp
        break

n_critical = sum(1 for a in results["alerts"] if get_sev_val(a.severity) == "CRITICAL")
n_warning = sum(1 for a in results["alerts"] if get_sev_val(a.severity) == "WARNING")
n_info = sum(1 for a in results["alerts"] if get_sev_val(a.severity) == "INFO")

avg_lq = float(np.mean(results["lq_series"]))
jam_pct = float(np.mean(results["jammed_series"])) * 100

# Threat Level Badge Status
if n_critical > 0:
    badge_class = "crit"
    badge_text = "DEFCON 1: CRITICAL INTRUSION"
elif n_warning > 0:
    badge_class = "warn"
    badge_text = "DEFCON 2: PERIMETER BREACH"
else:
    badge_class = "clear"
    badge_text = "DEFCON 4: AIRSPACE CLEAR"

# ── Header Command Banner ─────────────────────────────────────────────
st.markdown(
    f"""
    <div class="c2-header">
        <div>
            <h1 class="c2-title">🛡️ COUNTER-UAS DIGITAL TWIN C2 COMMAND CENTER</h1>
            <div class="c2-subtitle">
                Synthetic RF-Based Detection • Distributed Trilateration • FHSS Link Quality • Real-Time Alerting
            </div>
        </div>
        <div style="text-align: right;">
            <div class="status-badge {badge_class}">
                <div class="pulse-dot"></div>
                {badge_text}
            </div>
            <div style="font-family:'JetBrains Mono', monospace; font-size:0.75rem; color:#94a3b8; margin-top:8px;">
                JAMMER MODE: <span style="color:#00f0ff;">{jammer_type.upper()}</span> | ACTIVE SENSORS: <span style="color:#00f0ff;">{n_sensors}</span>
            </div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# ── Glassmorphic KPI Cards Row ────────────────────────────────────────
k1, k2, k3, k4, k5, k6 = st.columns(6)

k1.markdown(
    f"""
    <div class="kpi-card">
        <div class="kpi-label">MEAN TRACK ERROR</div>
        <div class="kpi-value">{mean_err:.1f}m</div>
        <div class="kpi-sub">Euclidean deviation</div>
    </div>
    """,
    unsafe_allow_html=True,
)

k2.markdown(
    f"""
    <div class="kpi-card warn">
        <div class="kpi-label">MAX ERROR PEAK</div>
        <div class="kpi-value">{max_err:.1f}m</div>
        <div class="kpi-sub">Worst trilateration fix</div>
    </div>
    """,
    unsafe_allow_html=True,
)

k3.markdown(
    f"""
    <div class="kpi-card">
        <div class="kpi-label">ALERT LATENCY</div>
        <div class="kpi-value">{first_alert_time:.2f}s</div>
        <div class="kpi-sub">Time to 1st breach fix</div>
    </div>
    """ if first_alert_time else """
    <div class="kpi-card success">
        <div class="kpi-label">ALERT LATENCY</div>
        <div class="kpi-value">N/A</div>
        <div class="kpi-sub">No boundary breach</div>
    </div>
    """,
    unsafe_allow_html=True,
)

k4.markdown(
    f"""
    <div class="kpi-card {"crit" if n_critical > 0 else "success"}">
        <div class="kpi-label">CRITICAL ALERTS</div>
        <div class="kpi-value">{n_critical}</div>
        <div class="kpi-sub">Persisting inside zone</div>
    </div>
    """,
    unsafe_allow_html=True,
)

k5.markdown(
    f"""
    <div class="kpi-card {"warn" if avg_lq < 0.5 else "success"}">
        <div class="kpi-label">AVG LINK QUALITY</div>
        <div class="kpi-value">{avg_lq:.1%}</div>
        <div class="kpi-sub">Telemetry packet success</div>
    </div>
    """,
    unsafe_allow_html=True,
)

k6.markdown(
    f"""
    <div class="kpi-card {"crit" if jam_pct > 20 else "success"}">
        <div class="kpi-label">EW JAMMED DWELL</div>
        <div class="kpi-value">{jam_pct:.1f}%</div>
        <div class="kpi-sub">RF link degraded</div>
    </div>
    """,
    unsafe_allow_html=True,
)

st.markdown("<div style='margin-bottom: 20px;'></div>", unsafe_allow_html=True)

# ── Tabbed View Organization ──────────────────────────────────────────
tab_map, tab_analytics, tab_alerts = st.tabs(
    [
        "🎯 TACTICAL SITUATIONAL TWIN",
        "📈 RF SPECTRUM & TRACKING ANALYTICS",
        "🚨 THREAT INTELLIGENCE LOG",
    ]
)

# ── TAB 1: Tactical Map ───────────────────────────────────────────────
with tab_map:
    st.plotly_chart(
        build_map_figure(
            results["trajectory"],
            results["loc_results"],
            results["sensor_nodes"],
            results["zone_polygon"],
            results["alerts"],
        ),
        use_container_width=True,
        key="main_tactical_map",
    )

# ── TAB 2: RF & Tracking Analytics ───────────────────────────────────
with tab_analytics:
    c1, c2 = st.columns(2)
    with c1:
        st.plotly_chart(
            build_link_quality_figure(
                results["times"],
                results["snr_series"],
                results["lq_series"],
                results["jammed_series"],
            ),
            use_container_width=True,
            key="link_quality_chart",
        )
    with c2:
        st.plotly_chart(
            build_tracking_error_figure(
                results["times"],
                results["errors"],
                results["loc_results"],
            ),
            use_container_width=True,
            key="tracking_error_chart",
        )

    st.plotly_chart(
        build_fhss_waterfall_figure(
            results["times"],
            results["channels"],
            n_channels,
        ),
        use_container_width=True,
        key="fhss_waterfall_chart",
    )

# ── TAB 3: Threat Intelligence Log ────────────────────────────────────
with tab_alerts:
    st.markdown("### 📋 **C-UAS Real-Time Alert Event Log**")

    if results["alerts"]:
        a1, a2, a3 = st.columns(3)
        a1.markdown(
            f"""
            <div style="background:rgba(0, 176, 255, 0.1); border:1px solid #00b0ff; border-radius:10px; padding:12px; text-align:center;">
                <span style="font-size:1.2rem; font-weight:700; color:#00b0ff;">🔵 INFO ALERTS</span>
                <h3 style="margin:4px 0 0 0; color:#ffffff;">{n_info}</h3>
            </div>
            """,
            unsafe_allow_html=True,
        )
        a2.markdown(
            f"""
            <div style="background:rgba(255, 145, 0, 0.1); border:1px solid #ff9100; border-radius:10px; padding:12px; text-align:center;">
                <span style="font-size:1.2rem; font-weight:700; color:#ff9100;">🟡 WARNING ALERTS</span>
                <h3 style="margin:4px 0 0 0; color:#ffffff;">{n_warning}</h3>
            </div>
            """,
            unsafe_allow_html=True,
        )
        a3.markdown(
            f"""
            <div style="background:rgba(255, 23, 68, 0.1); border:1px solid #ff1744; border-radius:10px; padding:12px; text-align:center;">
                <span style="font-size:1.2rem; font-weight:700; color:#ff1744;">🔴 CRITICAL ALERTS</span>
                <h3 style="margin:4px 0 0 0; color:#ffffff;">{n_critical}</h3>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown("<div style='margin-bottom:15px;'></div>", unsafe_allow_html=True)
        alert_df = alerts_to_dataframe(results["alerts"])
        st.dataframe(
            alert_df,
            use_container_width=True,
            height=450,
        )
    else:
        st.success("✅ **Airspace Clear**: No perimeter violations or anomalies logged.")

# Footer
st.markdown("---")
st.markdown(
    """
    <div style="text-align:center; color:#64748b; font-size:0.8rem; font-family:'JetBrains Mono', monospace; padding: 10px 0;">
        SIMULATED COUNTER-DRONE C2 DIGITAL TWIN PIPELINE &bull; SOFTWARE-ONLY SIMULATION &bull; ALL RIGHTS RESERVED
    </div>
    """,
    unsafe_allow_html=True,
)
