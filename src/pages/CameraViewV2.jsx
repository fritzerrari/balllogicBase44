/**
 * CameraViewV2 — Re-export SimpleCameraAssistant
 * Auth: Nur Kameramänner und Admins dürfen Camera-View zugreifen
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import SimpleCameraAssistant from '@/components/live/SimpleCameraAssistant';

export default function CameraViewV2() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(null);

  useEffect(() => {
    base44.auth.me()
      .then(u => {
        if (u && ['admin', 'cameraman', 'camera'].some(r => u.role?.toLowerCase().includes(r))) {
          setAuthorized(true);
        } else {
          setAuthorized(false);
          setTimeout(() => navigate('/'), 2000);
        }
      })
      .catch(() => {
        setAuthorized(false);
        setTimeout(() => base44.auth.redirectToLogin(), 1000);
      });
  }, [navigate]);

  if (authorized === null) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white text-center p-4">
        <div className="space-y-3">
          <div className="text-4xl">🚫</div>
          <p className="font-bold">Zugriff verweigert</p>
          <p className="text-sm text-gray-400">Nur Kameramänner dürfen Camera-Views öffnen</p>
        </div>
      </div>
    );
  }

  return <SimpleCameraAssistant />;
}