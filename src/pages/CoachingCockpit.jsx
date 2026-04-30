/**
 * CoachingCockpit — Trainer-Haupt-Dashboard während der Live-Session
 * Zeigt alle Kamera-Feeds, ermöglicht Kommunikation mit Assistenten,
 * RF-DETR Tracking-Simulation & Live-Event-Log
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio, Camera, Mic, MicOff, MessageSquare, Send,
  Zap, Users, Circle, Target, Shield, ChevronUp,
  Maximize2, Volume2, VolumeX, PhoneCall, Copy, Check,
  Smartphone, QrCode, Share2, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import FootballPitch from '@/components/pitch/FootballPitch';
import TrackingOverlay from '@/components/live/TrackingOverlay';
import CameraFeedCard from '@/components/live/CameraFeedCard';
import ShareCameraLink from '@/components/live/ShareCameraLink';

const POSITIONS = ['Tribüne Mitte', 'Tor-Linie Heim', 'Tor-Linie Gäste', 'Tribüne Links', 'Tribüne Rechts', 'Erhöht Mitte'];

// Simulated tracking data (RF-DETR output would replace this via backend)
const generateTracking = (t) => {
  const seed = (n) => Math.sin(t * 0.03 + n) * 0.5 + 0.5;
  const players = [];
  // Home team (11 players)
  for (let i = 0; i < 11; i++) {
    players.push({ x: 15 + seed(i) * 45, y: 10 + seed(i * 3) * 80, number: i + 1, team: 'home', speed: (seed(i * 7) * 28).toFixed(1) });
  }
  // Away team (11 players)
  for (let i = 0; i < 11; i++) {
    players.push({ x: 50 + seed(i * 2) * 40, y: 10 + seed(i * 5) * 80, number: i + 1, team: 'away', speed: (seed(i * 11) * 28).toFixed(1) });
  }
  // Ball
  const ball = { x: 30 + seed(99) * 50, y: 20 + seed(88) * 60 };
  return { players, ball };
};

export default function CoachingCockpit() {
  const queryClient = useQueryClient();
  const [selectedCam, setSelectedCam] = useState(null);
  const [messages, setMessages] = useState({});
  const [inputMsg, setInputMsg] = useState({});
  const [micActive, setMicActive] = useState({});
  const [trackTick, setTrackTick] = useState(0);
  const [showShare, setShowShare] = useState(null); // camera object
  const [showTracking, setShowTracking] = useState(true);
  const [copiedCode, setCopiedCode] = useState(null);

  // Live tracking animation
  useEffect(() => {
    const id = setInterval(() => setTrackTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const { data: sessions = [] } = useQuery({
    queryKey: ['liveSessions'],
    queryFn: () => base44.entities.LiveSession.filter({ status: 'active' }),
    refetchInterval: 5000,
  });

  const activeSession = sessions[0];
  const cameras = activeSession?.camera_streams || [
    { camera_id: '1', label: 'Tribüne Mitte', code: '382741', status: 'connected' },
    { camera_id: '2', label: 'Torlinie Heim', code: '194822', status: 'connected' },
    { camera_id: '3', label: 'Torlinie Gäste', code: '571039', status: 'waiting' },
  ];

  const tracking = generateTracking(trackTick);

  const sendMessage = (camId) => {
    const msg = inputMsg[camId]?.trim();
    if (!msg) return;
    setMessages(prev => ({
      ...prev,
      [camId]: [...(prev[camId] || []), { from: 'coach', text: msg, time: new Date().toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' }) }]
    }));
    setInputMsg(prev => ({ ...prev, [camId]: '' }));
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const liveUrl = `${window.location.origin}/cam`;

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 font-bold text-sm uppercase tracking-widest">Coaching Cockpit</span>
          </div>
          {activeSession && (
            <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">{activeSession.match_title}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTracking(s => !s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${showTracking ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground'}`}>
            <Users className="w-3.5 h-3.5 inline mr-1" /> Tracking {showTracking ? 'AN' : 'AUS'}
          </button>
        </div>
      </div>

      {/* No active session */}
      {!activeSession && (
        <div className="glass rounded-xl p-6 mb-4 border border-yellow-500/20 bg-yellow-500/5 text-sm text-yellow-400 flex items-center gap-2">
          <Radio className="w-4 h-4" /> Keine aktive Live-Session — starte eine Session unter "Live-Analyse"
          <span className="text-muted-foreground text-xs ml-2">(Demo-Daten werden angezeigt)</span>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-4">

        {/* === LEFT: Camera Grid === */}
        <div className="lg:col-span-7 space-y-4">
          {/* Camera grid */}
          <div className={`grid gap-3 ${cameras.length > 2 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
            {cameras.map((cam) => (
              <CameraFeedCard
                key={cam.camera_id}
                cam={cam}
                isSelected={selectedCam === cam.camera_id}
                onSelect={() => setSelectedCam(selectedCam === cam.camera_id ? null : cam.camera_id)}
                onShare={() => setShowShare(cam)}
                onCopyCode={() => copyCode(cam.code || cam.camera_id)}
                copied={copiedCode === (cam.code || cam.camera_id)}
                liveUrl={liveUrl}
                messages={messages[cam.camera_id] || []}
                inputMsg={inputMsg[cam.camera_id] || ''}
                onInputChange={(v) => setInputMsg(prev => ({ ...prev, [cam.camera_id]: v }))}
                onSend={() => sendMessage(cam.camera_id)}
                micActive={!!micActive[cam.camera_id]}
                onMicToggle={() => setMicActive(prev => ({ ...prev, [cam.camera_id]: !prev[cam.camera_id] }))}
              />
            ))}
            {/* Add camera slot */}
            <div className="aspect-video rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/30 cursor-pointer transition-all group"
              onClick={() => setShowShare({ camera_id: 'new', label: 'Neue Kamera', code: Math.floor(100000 + Math.random() * 900000).toString() })}>
              <Camera className="w-6 h-6 group-hover:text-primary transition-colors" />
              <span className="text-xs">+ Kamera hinzufügen</span>
            </div>
          </div>

          {/* Pitch with tracking overlay */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-grotesk font-semibold text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> Live-Tracking
                <span className="text-xs text-muted-foreground font-normal">(RF-DETR Spieler-, Ball- & Torerkennung)</span>
              </span>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-primary"><Circle className="w-2 h-2 fill-current" /> Heim ({tracking.players.filter(p => p.team === 'home').length})</span>
                <span className="flex items-center gap-1 text-red-400"><Circle className="w-2 h-2 fill-current" /> Gäste ({tracking.players.filter(p => p.team === 'away').length})</span>
                <span className="flex items-center gap-1 text-yellow-400"><Circle className="w-2 h-2 fill-current" /> Ball</span>
              </div>
            </div>
            <div className="relative aspect-[3/2] max-h-[300px]">
              <FootballPitch
                players={showTracking ? tracking.players : []}
                dangerZones={[
                  { x: tracking.ball.x, y: tracking.ball.y, intensity: 0.9, team: 'home' }
                ]}
                showGrid
              />
              {showTracking && <TrackingOverlay players={tracking.players} ball={tracking.ball} />}
            </div>
            <div className="mt-2 px-1 flex items-center gap-4 text-xs text-muted-foreground">
              <span>🤖 RF-DETR: Spieler erkannt · Ball getrackt · Formationslinie automatisch</span>
              <span className="ml-auto text-yellow-500/70">⚠ Echtzeit-Tracking benötigt Python-Backend (Builder+ Feature)</span>
            </div>
          </div>
        </div>

        {/* === RIGHT: Team Chat & Stats === */}
        <div className="lg:col-span-5 space-y-4">

          {/* RF-DETR Status */}
          <div className="glass rounded-xl p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">KI-Erkennungs-Status</div>
            <div className="space-y-2">
              {[
                { label: 'Spieler-Tracking', icon: Users, status: 'aktiv', color: 'text-primary' },
                { label: 'Ball-Tracking', icon: Circle, status: 'aktiv', color: 'text-yellow-400' },
                { label: 'Tore erkannt', icon: Target, status: 'aktiv', color: 'text-primary' },
                { label: 'Schiedsrichter', icon: Shield, status: 'aktiv', color: 'text-orange-400' },
                { label: 'RF-DETR Modell', icon: Zap, status: 'simuliert*', color: 'text-muted-foreground' },
              ].map(({ label, icon: Icon, status, color }) => (
                <div key={label} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                    {label}
                  </div>
                  <span className={`text-xs font-medium ${color}`}>{status}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[10px] text-muted-foreground border-t border-border pt-2">
              *RF-DETR (roboflow/rf-detr) ist ein Python/PyTorch-Modell. Echtzeit-Integration erfordert einen separaten Analyse-Server. Die Visualisierung zeigt simulierte Tracking-Daten.
            </div>
          </div>

          {/* Team Broadcast */}
          <div className="glass rounded-xl p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5" /> Team-Broadcast
            </div>
            <div className="bg-muted rounded-lg p-3 mb-3 max-h-32 overflow-y-auto space-y-2">
              <div className="text-xs text-muted-foreground text-center">Nachrichten an alle Assistenten</div>
              {(messages['broadcast'] || []).map((m, i) => (
                <div key={i} className="bg-primary/10 rounded-lg px-3 py-1.5 text-xs text-foreground flex justify-between">
                  <span>{m.text}</span><span className="text-muted-foreground">{m.time}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nachricht an alle Assistenten..."
                value={inputMsg['broadcast'] || ''}
                onChange={e => setInputMsg(prev => ({ ...prev, broadcast: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && sendMessage('broadcast')}
                className="bg-muted border-border text-xs flex-1"
              />
              <Button size="sm" onClick={() => sendMessage('broadcast')} className="bg-primary text-primary-foreground px-3">
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Camera codes & share */}
          <div className="glass rounded-xl p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5" /> Kameras einladen
            </div>
            <div className="space-y-2">
              {cameras.map((cam) => {
                const code = cam.code || cam.camera_id;
                const camUrl = `${liveUrl}?code=${code}`;
                return (
                  <div key={cam.camera_id} className="bg-muted rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-foreground">{cam.label}</span>
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${cam.status === 'connected' ? 'bg-primary' : 'bg-yellow-400'} animate-pulse`} />
                        <span className={`text-[10px] ${cam.status === 'connected' ? 'text-primary' : 'text-yellow-400'}`}>
                          {cam.status === 'connected' ? 'Verbunden' : 'Wartet'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xl font-grotesk font-bold text-primary tracking-[0.2em] flex-1">{code}</div>
                      <button onClick={() => copyCode(code)}
                        className="p-1.5 rounded-lg bg-background border border-border text-muted-foreground hover:text-primary transition-colors">
                        {copiedCode === code ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setShowShare(cam)}
                        className="p-1.5 rounded-lg bg-background border border-border text-muted-foreground hover:text-primary transition-colors">
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground truncate">{camUrl}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {showShare && (
          <ShareCameraLink cam={showShare} liveUrl={liveUrl} onClose={() => setShowShare(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}