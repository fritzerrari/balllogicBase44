/**
 * LiveStats — Echtzeit-Statistiken aus Tracking-Daten
 * Ballbesitz, Pressing-Linie, Spieleranzahl, Torwächter-Position
 */
export default function LiveStats({ stats, playerCounts }) {
  const home = stats?.possession_home ?? 50;
  const away = stats?.possession_away ?? 50;

  return (
    <div className="glass rounded-xl p-4">
      <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Live-Statistiken</div>

      {/* Possession bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-primary font-medium">Heim {home}%</span>
          <span className="text-muted-foreground text-[10px]">Ballbesitz</span>
          <span className="text-red-400 font-medium">{away}% Gäste</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden flex">
          <div className="h-full bg-primary transition-all duration-500 rounded-l-full" style={{ width: `${home}%` }} />
          <div className="h-full bg-red-400 transition-all duration-500 rounded-r-full" style={{ width: `${away}%` }} />
        </div>
      </div>

      {/* Pressing line */}
      {stats?.pressing_line_home != null && (
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Pressing-Linie Heim</span>
            <span className="text-primary font-mono">{stats.pressing_line_home}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary/60 transition-all duration-500" style={{ width: `${stats.pressing_line_home}%` }} />
          </div>
        </div>
      )}

      {/* Player counts */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Heim', value: playerCounts?.home ?? '—', color: 'text-primary' },
          { label: 'Gäste', value: playerCounts?.away ?? '—', color: 'text-red-400' },
          { label: 'SR', value: playerCounts?.referee ?? '—', color: 'text-orange-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-muted rounded-lg py-2">
            <div className={`font-grotesk font-bold text-lg ${color}`}>{value}</div>
            <div className="text-[10px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* Compactness */}
      {stats?.compactness_home != null && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Kompaktheit Heim</span>
            <span className="text-primary font-mono">{stats.compactness_home}/100</span>
          </div>
        </div>
      )}
    </div>
  );
}