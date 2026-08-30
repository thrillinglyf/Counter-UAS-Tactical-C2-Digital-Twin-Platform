/**
 * After-Action Report (AAR), Telemetry Exporter & Battlespace Heatmap Engine
 * 
 * Features:
 * 1. Automated Mission Evaluation Scorecard:
 *    - Grades defense performance (A+, A, B, C, F)
 *    - Computes Intercept Efficiency %, Airspace Integrity %, Mean Localization Error, Packet Denial %
 * 2. Telemetry Data Exporters:
 *    - Export Mission Data to CSV / JSON
 * 3. Battlespace Sensor GDOP & RF Coverage Heatmap Grids:
 *    - 2D grid matrix of GDOP geometric precision & RSSI signal strength across the battlespace
 */

class AnalyticsEngine {
    constructor() {}

    /**
     * Generates a comprehensive military After-Action Report (AAR)
     * @param {Object} simResults 
     * @param {Object} params 
     * @returns {Object} Scorecard metrics and assessment summary
     */
    generateAfterActionReport(simResults, params) {
        if (!simResults) return null;

        const totalSteps = simResults.times.length;
        const validErrors = simResults.errors.filter(e => e !== null);
        const meanTrackErr = validErrors.length ? (validErrors.reduce((a, b) => a + b, 0) / validErrors.length) : 0;
        const maxTrackErr = validErrors.length ? Math.max(...validErrors) : 0;

        const nCrit = simResults.alerts.filter(a => a.severity === 'CRITICAL').length;
        const nWarn = simResults.alerts.filter(a => a.severity === 'WARNING').length;

        // Airspace integrity: percentage of time no critical breach existed
        const integrityScore = Math.max(0, 100 - (nCrit * 12.0) - (nWarn * 3.0));

        // Jammer effectiveness: mean packet loss induced
        const meanLq = simResults.lqSeries.reduce((a, b) => a + b, 0) / totalSteps;
        const ewDenialScore = (1.0 - meanLq) * 100.0;

        // Kinetic Interception Outcome
        let interceptStatus = 'NOT DEPLOYED';
        let interceptEfficiency = 50;
        if (simResults.interception) {
            if (simResults.interception.isKilled) {
                interceptStatus = 'SUCCESSFUL (TARGET DESTROYED)';
                const killDist = simResults.interception.interceptDistance || 150;
                // Higher score if intercepted further from base HQ
                interceptEfficiency = Math.min(100, Math.max(60, (killDist / 300.0) * 100.0));
            } else {
                interceptStatus = 'FAILED (TARGET PENETRATED)';
                interceptEfficiency = 20;
            }
        }

        // Composite Overall Defense Score (0 - 100)
        const compositeScore = (integrityScore * 0.40) + (interceptEfficiency * 0.35) + (ewDenialScore * 0.15) + (Math.max(0, 100 - meanTrackErr * 4) * 0.10);

        let letterGrade = 'A+';
        let assessmentClass = 'crit';
        if (compositeScore >= 90) { letterGrade = 'A+'; assessmentClass = 'clear'; }
        else if (compositeScore >= 80) { letterGrade = 'A'; assessmentClass = 'clear'; }
        else if (compositeScore >= 70) { letterGrade = 'B'; assessmentClass = 'warn'; }
        else if (compositeScore >= 55) { letterGrade = 'C'; assessmentClass = 'warn'; }
        else { letterGrade = 'F'; assessmentClass = 'crit'; }

        return {
            letterGrade,
            compositeScore: compositeScore.toFixed(1),
            assessmentClass,
            integrityScore: integrityScore.toFixed(1),
            interceptStatus,
            interceptEfficiency: interceptEfficiency.toFixed(1),
            ewDenialScore: ewDenialScore.toFixed(1),
            meanTrackErr: meanTrackErr.toFixed(2),
            maxTrackErr: maxTrackErr.toFixed(2),
            criticalBreaches: nCrit,
            perimeterCrossings: nWarn,
            missionDuration: simResults.times[totalSteps - 1].toFixed(1)
        };
    }

    /**
     * Computes a 2D battlespace GDOP geometric precision heatmap grid (-600m to +600m)
     */
    generateCoverageHeatmap(sensorNodes, gridResolution = 25) {
        const xRange = [];
        const yRange = [];
        const minCoord = -600;
        const maxCoord = 600;
        const step = (maxCoord - minCoord) / gridResolution;

        for (let i = minCoord; i <= maxCoord; i += step) {
            xRange.push(i);
            yRange.push(i);
        }

        const zValues = []; // GDOP values (lower is better, capped at 10)

        for (let j = 0; j < yRange.length; j++) {
            const row = [];
            const y = yRange[j];
            for (let i = 0; i < xRange.length; i++) {
                const x = xRange[i];
                // Check active sensors within range
                const inRange = sensorNodes.filter(s => Math.hypot(x - s.x, y - s.y) <= s.detectionRange);
                if (inRange.length < 3) {
                    row.push(10.0); // blindspot
                } else {
                    // Compute simplified geometric dilution
                    let H00 = 0, H01 = 0, H11 = 0;
                    inRange.forEach(s => {
                        const dx = x - s.x;
                        const dy = y - s.y;
                        const d = Math.max(1e-4, Math.hypot(dx, dy));
                        const hx = dx / d;
                        const hy = dy / d;
                        H00 += hx * hx;
                        H01 += hx * hy;
                        H11 += hy * hy;
                    });
                    const det = H00 * H11 - H01 * H01;
                    if (Math.abs(det) < 1e-6) {
                        row.push(10.0);
                    } else {
                        const trace = (H00 + H11) / det;
                        const gdop = Math.min(10.0, Math.sqrt(Math.max(0, trace)));
                        row.push(gdop);
                    }
                }
            }
            zValues.push(row);
        }

        return { x: xRange, y: yRange, z: zValues };
    }

    /**
     * Exports full mission telemetry into a downloadable CSV file
     */
    exportTelemetryCsv(simResults) {
        if (!simResults) return;

        let csv = 'Timestamp_s,Hostile_X,Hostile_Y,Hostile_Z,Est_X,Est_Y,Error_m,Sensors_Active,SNR_dB,Link_Quality_Pct,Jammed,Defcon_Alert\n';
        for (let i = 0; i < simResults.times.length; i++) {
            const t = simResults.times[i];
            const p = simResults.trajectory[i];
            const loc = simResults.locResults[i];
            const err = simResults.errors[i] !== null ? simResults.errors[i].toFixed(2) : 'N/A';
            const snr = simResults.snrSeries[i].toFixed(1);
            const lq = (simResults.lqSeries[i] * 100).toFixed(1);
            const jammed = simResults.jammedSeries[i] ? 'TRUE' : 'FALSE';
            const alert = simResults.alerts.find(a => Math.abs(a.timestamp - t) < 0.05);
            const alertMsg = alert ? alert.severity : 'CLEAR';

            csv += `${t.toFixed(2)},${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)},${loc.estX !== null ? loc.estX.toFixed(2) : 'N/A'},${loc.estY !== null ? loc.estY.toFixed(2) : 'N/A'},${err},${loc.numSensors},${snr},${lq},${jammed},${alertMsg}\n`;
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `C-UAS_Mission_Telemetry_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Exports full mission dataset into JSON
     */
    exportTelemetryJson(simResults) {
        if (!simResults) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(simResults, null, 2));
        const link = document.createElement('a');
        link.setAttribute('href', dataStr);
        link.setAttribute('download', `C-UAS_Mission_Dataset_${Date.now()}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { AnalyticsEngine };
}
