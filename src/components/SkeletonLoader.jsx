import { motion } from 'framer-motion';

export function SkeletonCard() {
  return (
    <motion.div animate={{ opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 2, repeat: Infinity }}
      className="glass rounded-xl p-4 h-24 border border-border/20" />
  );
}

export function SkeletonList() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <motion.div animate={{ opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 2, repeat: Infinity }}
      className="glass rounded-xl p-5 h-40 border border-border/20" />
  );
}