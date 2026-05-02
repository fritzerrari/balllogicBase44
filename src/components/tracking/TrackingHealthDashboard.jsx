/**
 * TrackingHealthDashboard – System-Health + Live-Monitoring für Admin
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Wifi, WifiOff, Activity, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function TrackingHealthDashboard() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await base44.functions.invoke('trackingHealthMonitor', {});
        setHealth(res?.data || null);
      } catch (err) {
        console.error('Health monitor failed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 10000); // Poll alle 10s
    return () => clearInterval(interval);
  }, []);

  if (loading || !health) return null;

  const { tracking, auto_events: events, warnings } = health;
  const statusColor = tracking.success_rate >= 90 ? 'text-green-400' : tracking.success_rate >= 70 ? 'text-yellow-400' : 'text-red-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 border border-primary/20 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-grotesk font-bold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Tracking Health
        </h3>
        <div className={`text-sm font-bold ${statusColor}`}>
          {tracking.success_rate}% erfolgreich
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Frames</div>
          <div className="font-bold text-foreground">{tracking.total_frames}</div>
          <div className="text-[10px] text-muted-foreground">{tracking.successful_frames} ✓</div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Quality</div>
          <div className={`font-bold ${tracking.avg_quality >= 70 ? 'text-green-400' : 'text-yellow-400'}`}>
            {tracking.avg_quality}%
          </div>
          <div className="text-[10px] text-muted-foreground">Avg.</div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Latency</div>
          <div className={`font-bold ${tracking.avg_processing_time_ms <= 3000 ? 'text-green-400' : 'text-orange-400'}`}>
            {tracking.avg_processing_time_ms}ms
          </div>
          <div className="text-[10px] text-muted-foreground">Avg.</div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Events</div>
          <div className="font-bold text-foreground">{events.pending}</div>
          <div className="text-[10px] text-primary">Ausstehend</div>
        </div>
      </div>

      {/* Auto-Events Stats */}
      <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total Events:</span>
          <span className="font-bold">{events.total}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-green-400">✓ Approved:</span>
          <span className="font-bold">{events.approved}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-red-400">✕ Rejected:</span>
          <span className="font-bold">{events.rejected}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-yellow-400">⏳ Pending:</span>
          <span className="font-bold">{events.pending}</span>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-border/30">
          <span className="text-muted-foreground">Approval Rate:</span>
          <span className="font-bold text-primary">{events.approval_rate}%</span>
        </div>
      </div>

      {/* Warnings */}
      {health.warnings?.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 space-y-1">
          {health.warnings.map((warn, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-yellow-400">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {warn}
            </div>
          ))}
        </div>
      )}

      {/* Recent Errors */}
      {tracking.errors?.length > 0 && (
        <div className="text-xs space-y-1 max-h-24 overflow-y-auto">
          <div className="text-muted-foreground font-bold">Recent Errors:</div>
          {tracking.errors.slice(0, 3).map((err, i) => (
            <div key={i} className="text-red-400/80 text-[10px] flex items-start gap-2">
              <span className="flex-shrink-0">•</span>
              <span>{err.error}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}