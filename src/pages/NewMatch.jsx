import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Upload, X, Plus, ArrowLeft, Loader2, Video, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewMatch() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '', date: '', home_team: '', away_team: '',
    competition: '', venue: '', score_home: '', score_away: '', notes: ''
  });
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState([]);

  const createMutation = useMutation({
    mutationFn: async (data) => base44.entities.Match.create(data),
    onSuccess: (match) => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      navigate(`/matches/${match.id}`);
    },
  });

  const handleFileAdd = (e) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      const videoUrls = [];
      const progress = files.map(() => 0);
      setUploadProgress([...progress]);

      for (let i = 0; i < files.length; i++) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: files[i] });
        videoUrls.push(file_url);
        progress[i] = 100;
        setUploadProgress([...progress]);
      }

      await createMutation.mutateAsync({
        ...form,
        score_home: form.score_home !== '' ? Number(form.score_home) : undefined,
        score_away: form.score_away !== '' ? Number(form.score_away) : undefined,
        video_urls: videoUrls,
        camera_count: files.length || 1,
        status: videoUrls.length > 0 ? 'processing' : 'uploading',
      });
    } finally {
      setUploading(false);
    }
  };

  const f = (k) => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) });

  return (
    <div className="p-6 lg:p-8 min-h-screen max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <button onClick={() => navigate('/matches')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Zurück zu Spiele
        </button>
        <h1 className="text-3xl font-grotesk font-bold text-foreground mb-2">Neues Spiel</h1>
        <p className="text-muted-foreground mb-8">Spieldaten eingeben und Videos hochladen</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Match Info */}
          <div className="glass rounded-xl p-6 space-y-4">
            <h2 className="font-grotesk font-semibold text-foreground mb-4">Spielinformationen</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-muted-foreground mb-1.5 block text-xs uppercase tracking-wide">Spieltitel *</Label>
                <Input {...f('title')} placeholder="z.B. FC Bayern vs BVB" required className="bg-muted border-border" />
              </div>
              <div>
                <Label className="text-muted-foreground mb-1.5 block text-xs uppercase tracking-wide">Heimteam *</Label>
                <Input {...f('home_team')} placeholder="Heimteam" required className="bg-muted border-border" />
              </div>
              <div>
                <Label className="text-muted-foreground mb-1.5 block text-xs uppercase tracking-wide">Auswärtsteam *</Label>
                <Input {...f('away_team')} placeholder="Auswärtsteam" required className="bg-muted border-border" />
              </div>
              <div>
                <Label className="text-muted-foreground mb-1.5 block text-xs uppercase tracking-wide">Datum *</Label>
                <Input type="date" {...f('date')} required className="bg-muted border-border" />
              </div>
              <div>
                <Label className="text-muted-foreground mb-1.5 block text-xs uppercase tracking-wide">Wettbewerb</Label>
                <Input {...f('competition')} placeholder="z.B. Bundesliga" className="bg-muted border-border" />
              </div>
              <div>
                <Label className="text-muted-foreground mb-1.5 block text-xs uppercase tracking-wide">Ergebnis Heim</Label>
                <Input type="number" {...f('score_home')} placeholder="0" min="0" className="bg-muted border-border" />
              </div>
              <div>
                <Label className="text-muted-foreground mb-1.5 block text-xs uppercase tracking-wide">Ergebnis Auswärts</Label>
                <Input type="number" {...f('score_away')} placeholder="0" min="0" className="bg-muted border-border" />
              </div>
              <div className="col-span-2">
                <Label className="text-muted-foreground mb-1.5 block text-xs uppercase tracking-wide">Stadion/Ort</Label>
                <Input {...f('venue')} placeholder="Spielort" className="bg-muted border-border" />
              </div>
            </div>
          </div>

          {/* Video Upload */}
          <div className="glass rounded-xl p-6">
            <h2 className="font-grotesk font-semibold text-foreground mb-1">Video-Upload</h2>
            <p className="text-sm text-muted-foreground mb-4">Mehrere Kamera-Perspektiven möglich</p>

            <label className="block cursor-pointer">
              <input type="file" accept="video/*" multiple onChange={handleFileAdd} className="hidden" />
              <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 text-center transition-all duration-200 hover:bg-primary/5">
                <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <div className="font-medium text-foreground mb-1">Videos hier ablegen</div>
                <div className="text-sm text-muted-foreground">oder klicken zum Auswählen · MP4, MOV, AVI</div>
                <div className="mt-2 text-xs text-primary">Mehrere Kameras = bessere Analyse</div>
              </div>
            </label>

            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center gap-3 bg-muted rounded-lg px-3 py-2">
                    <Video className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm text-foreground flex-1 truncate">{file.name}</span>
                    {uploadProgress[i] === 100
                      ? <CheckCircle2 className="w-4 h-4 text-primary" />
                      : uploading
                      ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                      : (
                        <button type="button" onClick={() => setFiles(f => f.filter((_, idx) => idx !== i))}>
                          <X className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
                        </button>
                      )
                    }
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/matches')} className="flex-1 border-border" disabled={uploading}>
              Abbrechen
            </Button>
            <Button type="submit" className="flex-2 bg-primary text-primary-foreground hover:bg-primary/90 neon-glow gap-2" disabled={uploading || !form.title || !form.date || !form.home_team || !form.away_team}>
              {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird hochgeladen...</> : <><Plus className="w-4 h-4" /> Spiel erstellen</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}