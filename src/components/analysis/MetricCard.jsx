export default function MetricCard({ label, homeVal, awayVal, homeTeam, awayTeam, icon: Icon, suffix = '' }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground truncate max-w-[60%]">{homeTeam}</span>
          <span className="font-grotesk font-bold text-primary text-sm">{homeVal}{suffix}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground truncate max-w-[60%]">{awayTeam}</span>
          <span className="font-grotesk font-bold text-red-400 text-sm">{awayVal}{suffix}</span>
        </div>
      </div>
    </div>
  );
}