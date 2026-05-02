/**
 * StreamMonitor — Real-time Stream-Health Dashboard
 * Zeigt Latency, Quality, Frame-Rate pro Kamera
 */

import { motion } from 'framer-motion';
import { Activity, AlertTriangle, CheckCircle2, Wifi, WifiOff } from 'lucide-react';

export default function StreamMonitor({ cameraHealth, globalHealth }) {
  const getHealthColor = (score) => {
    if (score > 80) return 'text-primary';
    if (score > 60) return 'text-yellow-400';
    return 'text-destructive';
  };

  const getHealthBg = (score) => {
    if (score > 80) return 'bg-primary/10 border-primary/30';
    if (score > 60) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-destructive/10 border-destructive/30';
  };

  const cameras = Object.entries(cameraHealth);

  return (
    <div className="glass rounded-xl p-4 border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="font-grotesk font-semibold text-foreground">Stream-Status</span>
        </div>
        <motion.div
          animate={{ scale: globalHealth > 60 ? 1 : [1, 1.05, 1] }}
          className={`text-sm font-bold px-3 py-1 rounded-full ${getHealthBg(globalHealth)} border ${getHealthColor(globalHealth)}`}
        >
          {globalHealth}% Gesamt
        </motion.div>
      </div>

      {cameras.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-4">
          Warte auf Stream-Daten...
        </div>
      ) : (
        <div className="space-y-2">
          {cameras.map(([camId, health]) => (
            <motion.div
              key={camId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`rounded-lg p-3 border ${getHealthBg(health.healthScore)}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  {health.healthScore > 60 ? (
                    <Wifi className={`w-4 h-4 ${getHealthColor(health.healthScore)}`} />
                  ) : (
                    <WifiOff className="w-4 h-4 text-destructive" />
                  )}
                  <span className="text-xs font-medium text-foreground">
                    {camId === 'camera-main' ? '📷 Hauptkamera' : camId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold ${getHealthColor(health.healthScore)}`}>
                    {health.healthScore}%
                  </span>
                  <span className="text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded">
                    {health.quality?.toUpperCase() || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Latency Bar */}
              <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground flex justify-between">
                  <span>Latency</span>
                  <span className="font-mono">{health.avgLatency}ms</span>
                </div>
                <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((health.avgLatency / 1000) * 100, 100)}%` }}
                    className={`h-full transition-all ${
                      health.avgLatency < 200 ? 'bg-primary' :
                      health.avgLatency < 500 ? 'bg-yellow-500' :
                      'bg-destructive'
                    }`}
                  />
                </div>
              </div>

              {/* Frame Count */}
              <div className="text-[10px] text-muted-foreground mt-1.5 flex justify-between">
                <span>Frames</span>
                <span className="font-mono">{health.frameCount || 0}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Health Tips */}
      {globalHealth < 60 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-[10px] text-yellow-400 flex gap-2"
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Stream-Qualität reduziert</div>
            <div className="text-yellow-400/70">Netzwerk-Belastung erkannt. Quality-Anpassung aktiv.</div>
          </div>
        </motion.div>
      )}
    </div>
  );
}