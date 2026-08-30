# Counter-Drone Tactical Simulation & C2 Digital Twin Platform
## Comprehensive Technical & Architecture Documentation

---

## 1. Executive Overview

The **Counter-Unmanned Aerial System (C-UAS) Tactical Command-and-Control (C2) Digital Twin** is an aerospace defense simulation and real-time operations matrix designed to model how modern integrated air defense networks detect, track, localize, jam, and kinetically intercept rogue hostile drones and coordinated swarms.

The platform provides a complete **mathematical and physics-accurate simulation pipeline** paired with an **enterprise military aerospace dashboard** (inspired by systems such as *Anduril Lattice* and *Raytheon C2*).

---

## 2. Core Defense Architecture (3-Layer Model)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LAYER 1: COMMS & ELECTRONIC WARFARE                    │
│  • 3D Flight Kinematics & Swarm Formations (Pincer, Decoy, Saturation)      │
│  • Frequency-Hopping Spread Spectrum (FHSS) Telemetry Links (50-200 Ch)     │
│  • Defensive Jammers (Barrage, Fast-Sweep, Reactive Follower, Directional)  │
│  • SNR, Bit Error Rate (BER), and Link Quality Sigmoid Calculations         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LAYER 2: SENSOR GRID & MULTILATERATION                 │
│  • Passive RF Ground Sensor Perimeter (FSPL Shadow Fading Ranging)          │
│  • Levenberg-Marquardt Non-Linear Least-Squares Localization Solver        │
│  • GDOP (Geometric Dilution of Precision) Jacobian Condition Scoring        │
│  • 2D Battlespace Sensor Accuracy Heatmap Grid ($30 \times 30$ matrix)      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LAYER 3: THREAT RULES & ACTIVE DEFENSE MATRIX          │
│  • Computational Geometry Geofencing (100m Buffer & Critical No-Fly Zone)   │
│  • Extended Kalman Filter (EKF) CTRV Trajectory Prediction + 95% Cone       │
│  • Autonomous Kinetic Interceptors with Proportional Navigation (PN)        │
│  • Real-Time Threat Prioritization Matrix & Mission After-Action Report (AAR│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Subsystem Implementations & Physics Models

### A. Threat Drone Motion & Swarms (`swarmEngine.js` / `swarm_engine.py`)
- **Kinematics**: Generates continuous 3D coordinate paths $(x, y, z)$ across time steps $\Delta t$.
- **Swarm Attack Formations**:
  1. **Single Hostile**: Direct waypoint penetration strike.
  2. **Pincer Attack**: Simultaneous 2-axis coordinated flanking incursion (North-West + South-West).
  3. **Decoy & Strike**: 3-drone split formation with a high-RCS decoy drawing attention while primary warheads penetrate low.
  4. **Full Saturation**: 4-drone multi-quadrant convergence attack.
- **Threat Prioritization Matrix**: Real-time evaluation scoring targets ($1\% \to 99\%$) based on:
  $$\text{Threat Score} = w_1 \cdot \left(1 - \frac{d_{\text{base}}}{d_{\text{max}}}\right) + w_2 \cdot \left(\frac{v}{v_{\text{max}}}\right)$$

---

### B. RF Telemetry & Electronic Warfare (`directionalJammer.js` / `engine.js`)
- **FHSS Telemetry**: Drones hop across $N$ channels (e.g. 50 channels in 2.4 GHz band) at rates up to 500 hops/sec.
- **Defensive Electronic Countermeasures (EW)**:
  - **Barrage Jammer**: Floods all hop channels with wideband RF noise.
  - **Sweep Jammer**: Rapidly cycles across frequencies at 200 Hz.
  - **Reactive Jammer**: Cognitively locks onto active hops within dwell time.
  - **Directional Beamforming (Parabolic Horn)**: Steerable narrow RF cone ($28^\circ\text{ HPBW}$) injecting **$+18\text{ dBi}$** peak main-lobe gain with $-18\text{ dB}$ sidelobes and a $60^\circ/\text{s}$ azimuth tracking servo.
- **Link Budget**:
  $$\text{RSSI} = P_{\text{tx}} - 20\log_{10}(d) - 20\log_{10}(f) - 32.44 + \mathcal{N}(0, \sigma^2)$$
  $$\text{SNR} = P_{\text{signal}} - 10\log_{10}\left(10^{P_{\text{noise}}/10} + 10^{P_{\text{jam}}/10}\right)$$

---

### C. Trajectory Prediction & Extended Kalman Filter (`trajectoryPredictor.js`)
- **Constant Turn Rate and Velocity (CTRV) Model**: Smooths noisy sensor fixes and calculates instantaneous velocity vector $(\dot{x}, \dot{y})$, heading $(\theta)$, yaw rate $(\dot{\theta})$, and acceleration $(\ddot{x}, \ddot{y})$.
- **Prediction Horizon ($1.0\text{s} \to 10.0\text{s}$)**: Forward extrapolates flight path.
- **95% Confidence Uncertainty Cone**: Envelope expands quadratically with horizon reflecting sensor noise and possible evasive turns.
- **Predictive Geofencing**: Computes exact ray-line intersections to calculate **Time-to-Breach (TTB)** and **Predicted Intercept Points (PIP)** before perimeter penetration occurs.

---

### D. Autonomous Kinetic Interceptor (`interceptor.js` / `interceptor_model.py`)
- **Proportional Navigation (PN) Law**: Implements missile pursuit acceleration guidance:
  $$a_{\text{cmd}} = N \cdot V_{\text{closing}} \cdot \dot{\lambda}$$
  where $N$ is the navigation constant (e.g. 3.5) and $\dot{\lambda}$ is the Line-of-Sight (LOS) angular rate.
- **Autonomous Scramble**: Automatically launches high-speed interceptor drone ($35\text{ m/s} \to 60\text{ m/s}$) from Base HQ upon DEFCON 2 perimeter breach.
- **Kinetic Neutralization**: Destroys hostile targets in mid-air upon entering a $10\text{m}$ proximity envelope.

---

### E. Mission Analytics & After-Action Report (`analyticsEngine.js` / `mission_analytics.py`)
- **Automated Scorecard**: Evaluates composite defense efficiency and assigns military letter grades ($A+, A, B, C, F$).
- **Telemetry Exporters**:
  - **`📥 EXPORT CSV TELEMETRY`**: Full time-series export of ground truth coordinates, sensor fixes, SNR, and DEFCON alert states.
  - **`📦 EXPORT JSON DATASET`**: Structured mission dataset for defense research and AI model training.
- **2D Battlespace GDOP Heatmap**: $30 \times 30$ grid mapping sensor precision across $[-600\text{m}, +600\text{m}]$ of the battlespace.

---

## 4. UI/UX Architecture & Layout System

The platform features a **Minimalist Executive Tactical Interface**:

1. **Top Classification Bar**:
   - Classification Tag (`// UNCLASSIFIED // C2 DIGITAL TWIN //`), Mission Callsign, Audio Sound FX Toggle, Zulu UTC Military Clock.
2. **Tab 1: 🎯 Tactical Radar (Primary Screen)**:
   - **Executive 4-Metric Strip**: Airspace DEFCON Status, Distance to Base, Predicted Time-to-Breach (TTB), RF Link Quality.
   - **Full-Width Tactical Radar**: 2D & 3D Volumetric Radar, range rings ($200\text{m}, 400\text{m}, 600\text{m}$), multi-target swarm reticles, steerable directional EW beam cone, and kinetic dogfight trails.
   - **Live Swarm Priority Cards**: Dynamic `#1, #2, #3, #4` threat ranking badges.
   - **Slim Playback Bar**: $1\times, 2\times, 5\times$ speed multipliers, timeline scrubber, and live telemetry pills.
3. **Tab 2: ⚙️ Simulation Lab & Filters**:
   - Modular parameter tuning cards for Kinematics, Comms/EW, Sensor Perimeter, AI Prediction, and Kinetic Interceptors.
   - Scenario Presets (*Standard Incursion*, *Pincer Swarm*, *Decoy Swarm*, *4-Drone Saturation*, *Barrage Jam*, *Reactive Jam*).
   - **🚀 RUN & APPLY SIMULATION** action button.
4. **Tab 3: 📈 RF Spectrum & Intelligence**:
   - **Mission After-Action Report (AAR) Scorecard Banner**.
   - **Circular SVG Telemetry Dials** (Link Quality %, SNR dB, GDOP Confidence %).
   - **Battlespace Sensor GDOP Coverage Heatmap**.
   - **Bit-Error Rate & Localization Error Curves**.
   - **FHSS Waterfall Spectrogram & Threat Log Table**.

---

## 5. Repository File Structure

```
counter_drone_sim/
├── node_dashboard/
│   ├── public/
│   │   ├── js/
│   │   │   ├── engine.js               # Core physics, FHSS, sensor ranging, trilateration
│   │   │   ├── trajectoryPredictor.js  # CTRV Extended Kalman Filter (EKF) & geofencing
│   │   │   ├── interceptor.js          # Kinetic Interceptor with Proportional Navigation
│   │   │   ├── swarmEngine.js          # Multi-drone swarm formations & threat ranking
│   │   │   ├── directionalJammer.js    # Steerable parabolic horn antenna beamforming
│   │   │   ├── analyticsEngine.js      # AAR scorecard, telemetry exporter & GDOP heatmap
│   │   │   └── app.js                  # C2 controller, Web Audio sound FX, Plotly charts
│   │   ├── index.html                  # Minimalist C2 tabbed layout
│   │   └── style.css                   # Military dark glassmorphism design system
│   ├── package.json                    # Node.js manifest (Express backend)
│   └── server.js                       # Express web server & REST API
├── layer1_comms/
│   ├── drone_model.py                  # Python drone kinematics
│   ├── fhss_sim.py                     # Python FHSS channel hopper
│   ├── jammer_sim.py                   # Python EW jammer models
│   ├── trajectory_predictor.py         # Python EKF & prediction counterpart
│   ├── interceptor_model.py            # Python Kinetic Interceptor counterpart
│   ├── swarm_engine.py                 # Python Swarm counterpart
│   └── directional_jammer.py           # Python Directional Beamforming counterpart
├── layer2_sensors/
│   ├── sensor_network.py               # Python sensor placement & RSSI
│   └── localization.py                 # Python non-linear trilateration & GDOP
├── layer3_alerting/
│   ├── rules_engine.py                 # Python geofencing rules
│   ├── mission_analytics.py            # Python AAR scorecard & CSV exporter
│   └── dashboard.py                    # Python Plotly chart definitions
├── main.py                             # Python Streamlit orchestration pipeline
├── start_node_dashboard.bat            # 1-click launcher for Node.js C2 Web Twin
├── launch_dashboard.bat                # 1-click launcher for Python/Streamlit
└── DOCUMENTATION.md                    # System architecture documentation
```

---

## 6. Execution & Deployment Guide

### Node.js Command Twin (Recommended)
1. Run the batch launcher:
   ```powershell
   & "c:\Users\paven\OneDrive\Desktop\projects\new\counter_drone_sim\start_node_dashboard.bat"
   ```
2. Or start manually via PowerShell:
   ```powershell
   cd "c:\Users\paven\OneDrive\Desktop\projects\new\counter_drone_sim\node_dashboard"
   node server.js
   ```
3. Access **[http://localhost:3000](http://localhost:3000)** in any modern web browser.

### Python / Streamlit Edition
1. Run the Python batch launcher:
   ```powershell
   & "c:\Users\paven\OneDrive\Desktop\projects\new\counter_drone_sim\launch_dashboard.bat"
   ```
2. Access **[http://localhost:8501](http://localhost:8501)**.
