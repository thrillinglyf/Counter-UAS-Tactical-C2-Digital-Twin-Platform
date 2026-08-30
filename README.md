# 🛡️ Counter-UAS Tactical C2 Digital Twin Platform
### Multi-Drone Swarm Defense, Directional Electronic Warfare & Kinetic Interception Matrix

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://www.python.org/)
[![Status](https://img.shields.io/badge/Status-Operational-success.svg)]()

An enterprise military-grade Counter-Unmanned Aerial System (C-UAS) Command-and-Control (C2) simulation environment. It models how integrated air defense networks detect, track, localize, jam, and kinetically intercept rogue hostile drones and coordinated swarms in real time.

---

## 🎯 Key System Features

- **🐝 Multi-Drone Swarm Attack Formations**:
  - *Pincer Attack (2-Axis Incursion)*, *Decoy & Strike (Feint)*, and *4-Drone Saturation*.
  - Real-time Threat Prioritization Scorer assigning dynamic `#1, #2, #3` threat cards ($1\% \to 99\%$).
- **📡 Steerable Directional EW Beamforming**:
  - Parabolic Horn Antenna with **$+18\text{ dBi}$** focused main lobe, $-18\text{ dB}$ sidelobes, and $60^\circ/\text{s}$ closed-loop gimbal slew tracking.
  - Interactive 2D shaded energy wedge and 3D directed RF beam vector.
- **🔮 Extended Kalman Filter (EKF) & Trajectory Prediction**:
  - Constant Turn Rate and Velocity (CTRV) kinematic model forward projecting $1\text{s} \to 10\text{s}$.
  - Dynamic expanding 95% confidence uncertainty cone with ray-intersection Time-to-Breach (TTB).
- **💥 Autonomous Kinetic Interceptor**:
  - Proportional Navigation (PN) acceleration pursuit ($a_{\text{cmd}} = N \cdot V_c \cdot \dot{\lambda}$).
  - Automatic scramble upon DEFCON 2 breach and mid-air dogfight neutralization.
- **🎖️ Mission After-Action Report (AAR) & Telemetry Exporters**:
  - Automatic military letter grade ($A+, A, B, C, F$) defense scorecard.
  - $30 \times 30$ 2D Battlespace GDOP Accuracy Heatmap.
  - 1-click **`📥 EXPORT CSV TELEMETRY`** & **`📦 EXPORT JSON DATASET`**.
- **🎨 Minimalist Executive C2 Interface**:
  - Dark glassmorphism military HUD, Zulu UTC clock, synthetic audio radar cues, full-width 2D/3D Plotly viewports.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LAYER 1: COMMS & ELECTRONIC WARFARE                    │
│  • 3D Flight Kinematics & Swarm Formations (Pincer, Decoy, Saturation)      │
│  • Frequency-Hopping Spread Spectrum (FHSS) Telemetry (50-200 Channels)     │
│  • Defensive Jammers (Barrage, Fast-Sweep, Reactive, Directional Horn)      │
│  • SNR, Bit Error Rate (BER), and Link Quality % Calculation                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LAYER 2: SENSOR GRID & MULTILATERATION                 │
│  • Passive RF Sensor Perimeter (Free-Space Path Loss Ranging)               │
│  • Levenberg-Marquardt Non-Linear Least-Squares Localization Fixes          │
│  • Geometric Dilution of Precision (GDOP) Accuracy Confidence Scoring       │
│  • 2D Battlespace Sensor Precision Heatmap Grid                             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LAYER 3: THREAT RULES & ACTIVE DEFENSE MATRIX          │
│  • Computational Geometry Geofencing (100m Buffer & Critical Base Polygon)  │
│  • Extended Kalman Filter (EKF) CTRV Trajectory Prediction + 95% Cone       │
│  • Autonomous Kinetic Interceptors with Proportional Navigation Guidance    │
│  • Real-Time Threat Prioritization Matrix & Mission After-Action Report (AAR│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
.
├── node_dashboard/              # Web-based C2 Digital Twin
│   ├── public/
│   │   ├── js/
│   │   │   ├── engine.js               # Physics, FHSS, RSSI & trilateration
│   │   │   ├── trajectoryPredictor.js  # CTRV Extended Kalman Filter (EKF)
│   │   │   ├── interceptor.js          # Kinetic Interceptor with Proportional Navigation
│   │   │   ├── swarmEngine.js          # Swarm formations & threat ranking matrix
│   │   │   ├── directionalJammer.js    # Steerable parabolic horn antenna beamforming
│   │   │   ├── analyticsEngine.js      # AAR scorecard, telemetry exporter & heatmap
│   │   │   └── app.js                  # Master C2 controller & Plotly visualizer
│   │   ├── index.html                  # Minimalist 3-tab C2 tactical interface
│   │   └── style.css                   # Military dark glassmorphism design system
│   ├── package.json
│   └── server.js                       # Express web server
├── layer1_comms/                # Python RF Comms & EW Simulation
│   ├── drone_model.py
│   ├── fhss_sim.py
│   ├── jammer_sim.py
│   ├── trajectory_predictor.py
│   ├── interceptor_model.py
│   ├── swarm_engine.py
│   └── directional_jammer.py
├── layer2_sensors/              # Python Sensor Grid & Localization
│   ├── sensor_network.py
│   └── localization.py
├── layer3_alerting/             # Python Alerting & Analytics
│   ├── rules_engine.py
│   ├── mission_analytics.py
│   └── dashboard.py
├── main.py                      # Python / Streamlit application entry point
├── requirements.txt             # Python dependencies
├── start_node_dashboard.bat     # 1-click launcher for Node.js Web C2
├── launch_dashboard.bat         # 1-click launcher for Python/Streamlit
└── DOCUMENTATION.md             # Complete mathematical & technical documentation
```

---

## 🚀 Quick Start Guide

### Option 1: Node.js C2 Web Twin (Recommended)

1. Navigate to `node_dashboard`:
   ```bash
   cd node_dashboard
   npm install
   npm start
   ```
   *(Or double-click `start_node_dashboard.bat` on Windows)*

2. Open **`http://localhost:3000`** in your browser.

---

### Option 2: Python / Streamlit App

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Launch Streamlit:
   ```bash
   streamlit run main.py
   ```
   *(Or double-click `launch_dashboard.bat` on Windows)*

3. Open **`http://localhost:8501`** in your browser.

---

## 🛠️ Simulation Controls & Presets

- **Standard Incursion**: Baseline trajectory into defended airspace.
- **Pincer Swarm Attack**: Dual-axis flanking hostile incursion.
- **Decoy & Strike Swarm**: Fast northern decoy with low-altitude strike penetrator.
- **Full Saturation Swarm**: 4 coordinated drones converging on base HQ.
- **Directional EW Beam**: Steerable high-gain parabolic horn tracking target bearing.
- **Kinetic Interceptor**: Autonomous interceptor dogfight pursuit with Proportional Navigation.

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
