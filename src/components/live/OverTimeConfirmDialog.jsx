/**
 * OverTimeConfirmDialog — Bestätigung für Überlänge
 * Nach 90min: Trainer bestätigt ob Extra-Zeit gespielt wird
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OverTimeConfirmDialog({ onConfirm, onSkip }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="glass rounded-2xl p-8 max-w-sm w-full text-center space-y-4"
      >
        <div className="text-5xl">⏰</div>
        <h2 className="font-grotesk text-2xl font-bold">Überlänge?</h2>
        <p className="text-sm text-muted-foreground">90 Minuten gespielt — wird Extra-Zeit gespielt?</p>
        
        <div className="flex gap-3 pt-2">
          <Button onClick={onSkip} variant="outline" className="flex-1 h-11">
            ❌ Nein, Ende
          </Button>
          <Button onClick={onConfirm} className="flex-1 h-11 bg-primary gap-2">
            <Clock className="w-4 h-4" />
            ✅ Ja, Extra-Zeit
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}