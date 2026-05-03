/**
 * SimpleSessionSetup — Super Einfache Konfiguration
 * Nur: Match-Name + Kamera-Count (optional)
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, AlertCircle } from 'lucide-react';

export default function SimpleSessionSetup({ onStart, isLoading }) {
  const [title, setTitle] = useState('');
  const [cameraCount, setCameraCount] = useState(1);

  const handleStart = () => {
    if (!title.trim()) {
      alert('⚠️ Bitte Match-Namen eingeben\nz.B. "Bayern vs Dortmund"');
      return;
    }

    const cameras = Array.from({ length: cameraCount }, (_, i) => ({
      id: (i + 1).toString(),
      label: cameraCount === 1 ? 'Hauptkamera' : `Kamera ${i + 1}`,
    }));

    onStart({
      match_title: title,
      status: 'active',
      half_time: 1,
      started_at: new Date().toISOString(),
      camera_streams: cameras.map((c, i) => ({
        camera_id: c.id,
        label: c.label,
        stream_url: '',
        status: 'waiting',
        code: Math.random().toString(36).substring(2, 8).toUpperCase()
      })),
    });
  };

  return (
    <div className="space-y-4">
      {/* Match Title */}
      <div>
        <label className="text-xs font-bold uppercase text-muted-foreground block mb-2">
          Match-Name
        </label>
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleStart()}
          placeholder="z.B. Bayern vs Dortmund"
          className="text-lg font-bold"
          disabled={isLoading}
          autoFocus
        />
      </div>

      {/* Camera Count */}
      <div>
        <label className="text-xs font-bold uppercase text-muted-foreground block mb-2">
          📷 Wieviele Kameras? ({cameraCount})
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(n => (
            <button
              key={n}
              onClick={() => setCameraCount(n)}
              disabled={isLoading}
              className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${
                cameraCount === n
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted border border-border hover:border-primary/40'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Start Button */}
      <Button
        onClick={handleStart}
        disabled={!title.trim() || isLoading}
        className="w-full h-12 text-base font-bold bg-red-600 hover:bg-red-700 gap-2"
      >
        {isLoading ? (
          <>⏳ Wird gestartet...</>
        ) : (
          <>
            <Play className="w-5 h-5" /> Session Starten
          </>
        )}
      </Button>

      {/* Tips */}
      <div className="text-[11px] text-muted-foreground space-y-1">
        <div className="flex gap-2">
          <span>💡</span>
          <span>Kameramänner erhalten direkte Links zum Öffnen auf Handy</span>
        </div>
        <div className="flex gap-2">
          <span>💡</span>
          <span>Alle Kameras können unabhängig starten (nicht blockiert)</span>
        </div>
      </div>
    </div>
  );
}