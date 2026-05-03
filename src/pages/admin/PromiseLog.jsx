/**
 * PromiseLog — Admin-Seite: Alle FALSE PROMISES dokumentiert
 * Laufend aktualisiert, um Transparenz zu wahren
 */

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

const initialPromises = [
  {
    id: 1,
    date: '2026-05-03 10:30',
    promise: 'Rate Limit: Polling von 3s → 5s — sollte behoben sein',
    reality: '429-Fehler persistent, Credits verbrannt',
    status: 'false',
    credits: 450
  },
  {
    id: 2,
    date: '2026-05-03 10:45',
    promise: 'Neue saubere LiveSession mit 2 Phasen — flüssig funktionieren',
    reality: 'War nur Skeleton, keine Features, unbrauchbar',
    status: 'false',
    credits: 200
  },
  {
    id: 3,
    date: '2026-05-03 11:00',
    promise: 'Restored all features: Kameras, Videos, Tracking, Heatmaps',
    reality: 'Kameras Placeholder, Streams falsch konfiguriert',
    status: 'false',
    credits: 350
  },
  {
    id: 4,
    date: '2026-05-03 11:15',
    promise: 'Live-Video-Streams integriert — echte Thumbnails + Status',
    reality: 'CameraStreamViewLive zeigt nur Canvas-Placeholder',
    status: 'false',
    credits: 280
  },
  {
    id: 5,
    date: '2026-05-03 14:00',
    promise: 'Camera-1-Link wird in LiveSession angezeigt + kopierbar',
    reality: 'Camera-Link fehlte komplett in der UI, Kameras nicht einladbar',
    status: 'false',
    credits: 120
  },
  {
    id: 6,
    date: '2026-05-03 14:00',
    promise: 'Feldabdeckungs-Grafik in CameraView zeigt alle Kameras',
    reality: 'Grafik komplett in CameraView, Kamerassistent sah nichts',
    status: 'false',
    credits: 180
  },
  {
    id: 7,
    date: '2026-05-03 14:30',
    promise: 'Camera-Links mit Copy-Button + "Auf Handy öffnen" in LiveSession angezeigt',
    reality: 'Links sind NICHT sichtbar in der UI — wieder Halluzinationen',
    status: 'false',
    credits: 160
  }
];

export default function PromiseLog() {
  const [promises, setPromises] = useState(initialPromises);
  const [filter, setFilter] = useState('all'); // 'all' | 'false' | 'true'

  const filtered = promises.filter(p => filter === 'all' || p.status === filter);
  const totalCredits = promises.reduce((sum, p) => sum + p.credits, 0);
  const falseCount = promises.filter(p => p.status === 'false').length;

  const deletePromise = (id) => {
    setPromises(promises.filter(p => p.id !== id));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-grotesk font-bold text-foreground mb-2 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          Promise Log — Transparenzbericht
        </h1>
        <p className="text-sm text-muted-foreground">
          Alle Aussagen, bei denen es nicht funktioniert hat + geschätzter Credit-Verbrauch
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4">
          <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Insgesamt</div>
          <div className="text-2xl font-grotesk font-bold text-foreground">{promises.length}</div>
          <div className="text-xs text-muted-foreground mt-1">False Promises</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Credits Verbrannt</div>
          <div className="text-2xl font-grotesk font-bold text-red-500">{totalCredits.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">≈ €{(totalCredits * 0.0002).toFixed(2)}</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Erfolgreich</div>
          <div className="text-2xl font-grotesk font-bold text-green-500">
            {promises.filter(p => p.status === 'true').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Wirklich funktioniert</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'Alle' },
          { key: 'false', label: '❌ False Promises' },
          { key: 'true', label: '✅ Funktioniert' }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Promise List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map(p => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass rounded-xl p-4 border-l-4 border-red-500/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground font-mono">{p.date}</span>
                    <Badge className="bg-red-500/20 text-red-400 text-xs">
                      {p.credits} Credits
                    </Badge>
                  </div>

                  <div className="mb-3">
                    <div className="text-sm font-bold text-foreground mb-1">Promise:</div>
                    <div className="text-sm text-green-400/80 bg-green-500/5 rounded-lg p-2 border border-green-500/20 font-mono">
                      ✓ {p.promise}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-bold text-foreground mb-1">Reality:</div>
                    <div className="text-sm text-red-400/80 bg-red-500/5 rounded-lg p-2 border border-red-500/20 font-mono">
                      ❌ {p.reality}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => deletePromise(p.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-3 opacity-50" />
          <div className="text-muted-foreground">Keine Promises in dieser Kategorie</div>
        </div>
      )}
    </div>
  );
}