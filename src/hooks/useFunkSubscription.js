/**
 * useFunkSubscription — Real-time Funk Messages
 * Polling (2s) + WebSocket wenn verfügbar
 * Korrekte Session-Filterung, keine Duplikate
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const MAX_MESSAGES = 100;
const POLL_INTERVAL_MS = 2000;

export default function useFunkSubscription(sessionId) {
  const [messages, setMessages] = useState([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const pollRef = useRef(null);
  const subscriptionRef = useRef(null);
  const speakerTimerRef = useRef(null);

  const setActiveSpeakerSafe = useCallback((label) => {
    setActiveSpeaker(label);
    clearTimeout(speakerTimerRef.current);
    speakerTimerRef.current = setTimeout(() => setActiveSpeaker(null), 5000);
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!sessionId) return;
    try {
      const all = await base44.entities.FunkMessage.filter({ session_id: sessionId });
      const sorted = all.sort((a, b) => (a.timestamp_ms || 0) - (b.timestamp_ms || 0));
      setMessages(sorted.slice(-MAX_MESSAGES));

      // Active speaker
      const recentPtt = sorted.slice().reverse().find(m => m.is_ppt && m.ppt_active);
      if (recentPtt && Date.now() - (recentPtt.timestamp_ms || 0) < 5000) {
        setActiveSpeakerSafe(recentPtt.from_label || recentPtt.from);
      } else {
        setActiveSpeaker(null);
      }
    } catch (e) {
      // ignore
    }
  }, [sessionId, setActiveSpeakerSafe]);

  useEffect(() => {
    if (!sessionId) return;

    // Initial fetch
    fetchMessages();

    // Polling fallback (always active as baseline)
    pollRef.current = setInterval(fetchMessages, POLL_INTERVAL_MS);

    // Try WebSocket on top
    if (base44.entities?.FunkMessage?.subscribe) {
      subscriptionRef.current = base44.entities.FunkMessage.subscribe((event) => {
        if (event.data?.session_id !== sessionId) return;
        setIsSubscribed(true);
        // Re-fetch for consistency (avoid partial updates)
        fetchMessages();
        if (event.data?.is_ppt && event.data?.ppt_active) {
          setActiveSpeakerSafe(event.data.from_label || event.data.from);
        }
      });
    }

    return () => {
      clearInterval(pollRef.current);
      clearTimeout(speakerTimerRef.current);
      subscriptionRef.current?.();
    };
  }, [sessionId, fetchMessages]);

  return { messages, isSubscribed, activeSpeaker };
}