/**
 * NotificationBanner – Toast-ähnliche Notifications für Live-Events
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Zap, Trophy } from 'lucide-react';

const NOTIFICATION_CONFIG = {
  goal: { icon: '⚽', title: 'TOR!', bgClass: 'bg-red-500/20 border-red-500/40', textClass: 'text-red-400', duration: 5000 },
  offside: { icon: '🚩', title: 'Abseits', bgClass: 'bg-yellow-500/20 border-yellow-500/40', textClass: 'text-yellow-400', duration: 3000 },
  red_card: { icon: '🟥', title: 'Rote Karte!', bgClass: 'bg-red-600/30 border-red-600/60', textClass: 'text-red-300', duration: 4000 },
  yellow_card: { icon: '🟨', title: 'Gelbe Karte', bgClass: 'bg-yellow-500/20 border-yellow-500/40', textClass: 'text-yellow-400', duration: 3000 },
  ball_in_goal_area: { icon: '⚠️', title: 'Ball im Torraum!', bgClass: 'bg-orange-500/20 border-orange-500/40', textClass: 'text-orange-400', duration: 3000 },
  corner: { icon: '📐', title: 'Ecke', bgClass: 'bg-blue-500/20 border-blue-500/40', textClass: 'text-blue-400', duration: 2000 },
};

export default function NotificationBanner({ notification, onDismiss }) {
  const [isVisible, setIsVisible] = useState(true);

  const config = NOTIFICATION_CONFIG[notification?.type] || {
    icon: '•',
    title: notification?.type,
    bgClass: 'bg-primary/20 border-primary/40',
    textClass: 'text-primary',
    duration: 3000,
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, config.duration);

    return () => clearTimeout(timer);
  }, [notification, config.duration, onDismiss]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-40 px-6 py-4 rounded-xl border ${config.bgClass} backdrop-blur`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{config.icon}</span>
            <div>
              <div className={`font-grotesk font-bold ${config.textClass}`}>
                {config.title}
              </div>
              {notification?.message && (
                <div className="text-xs text-foreground/60">
                  {notification.message}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setIsVisible(false);
                onDismiss?.();
              }}
              className={`ml-2 p-1 rounded-lg hover:bg-white/10 transition-all ${config.textClass}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}