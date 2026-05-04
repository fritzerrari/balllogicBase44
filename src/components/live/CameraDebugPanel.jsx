/**
 * CameraDebugPanel — Live Debug für Kamera-Browser
 * Zeigt: Frames uploaded, Errors, Network Status, Canvas State
 * Nur in Development sichtbar
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

export default function CameraDebugPanel({ frameStats, errors = [], isConnected, videoReady, canvasReady }) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState('summary'); // 'summary' | 'errors' | 'network'

  if (typeof window === 'undefined') return null; // SSR safety

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-xs">
      <motion.div
        layout
        className="glass border border-purple-500/40 rounded-xl overflow-hidden text-[10px] font-mono"
      >
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-purple-500/5 transition-colors"
        >
          <span className="text-purple-400 font-bold">🔧 DEBUG PANEL</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-purple-500/20 overflow-hidden bg-black/60"
            >
              {/* Mode Tabs */}
              <div className="flex border-b border-purple-500/20 p-2 gap-1">
                {['summary', 'errors', 'network'].map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-2 py-1 rounded text-[9px] font-bold transition-colors ${
                      mode === m
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="p-2 space-y-1 max-h-48 overflow-y-auto text-purple-300">
                {mode === 'summary' && (
                  <>
                    <div className={`flex justify-between ${frameStats?.uploadedCount > 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                      <span>Uploaded:</span>
                      <strong>{frameStats?.uploadedCount ?? 0}</strong>
                    </div>
                    <div className={`flex justify-between ${frameStats?.capturedCount > 0 ? 'text-blue-400' : 'text-gray-500'}`}>
                      <span>Captured:</span>
                      <strong>{frameStats?.capturedCount ?? 0}</strong>
                    </div>
                    <div className={`flex justify-between ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                      <span>Connected:</span>
                      <strong>{isConnected ? '✓' : '✗'}</strong>
                    </div>
                    <div className={`flex justify-between ${videoReady ? 'text-green-400' : 'text-yellow-400'}`}>
                      <span>Video:</span>
                      <strong>{videoReady ? 'ready' : 'init...'}</strong>
                    </div>
                    <div className={`flex justify-between ${canvasReady ? 'text-green-400' : 'text-yellow-400'}`}>
                      <span>Canvas:</span>
                      <strong>{canvasReady ? 'ok' : 'wait'}</strong>
                    </div>
                  </>
                )}

                {mode === 'errors' && (
                  <>
                    {errors.length === 0 ? (
                      <div className="text-green-400">✓ Keine Fehler</div>
                    ) : (
                      errors.slice(-5).map((err, i) => (
                        <div key={i} className="text-red-400 text-[9px] break-words">
                          {err}
                        </div>
                      ))
                    )}
                  </>
                )}

                {mode === 'network' && (
                  <>
                    <div className="text-gray-400">Upload Rate: {frameStats?.uploadedCount > 0 ? 'active' : 'waiting'}</div>
                    <div className="text-gray-400">Interval: 5000ms</div>
                    <div className="text-gray-400">Last Upload: {frameStats?.lastUploadTime ? new Date(frameStats.lastUploadTime).toLocaleTimeString('de') : 'never'}</div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}