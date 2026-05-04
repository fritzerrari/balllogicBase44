/**
 * analyzeSquadNeeds — KI analysiert Kaderbedarf und empfiehlt Transferziele
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { club_id } = await req.json();
    if (!club_id) return Response.json({ error: 'club_id required' }, { status: 400 });

    const [clubs, players, stats] = await Promise.all([
      base44.asServiceRole.entities.Club.filter({ id: club_id }),
      base44.asServiceRole.entities.Player.filter({ club_id }),
      base44.asServiceRole.entities.PlayerStat.list('-created_date', 100)
    ]);

    const club = clubs[0];
    if (!club) return Response.json({ error: 'Club not found' }, { status: 404 });

    // Spieler mit ablaufenden Verträgen (< 12 Monate)
    const now = new Date();
    const in12Months = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const expiringContracts = players.filter(p => {
      if (!p.contract_until) return false;
      const exp = new Date(p.contract_until);
      return exp <= in12Months;
    });

    // Positionen auswerten
    const positionCount = {};
    players.forEach(p => {
      positionCount[p.position] = (positionCount[p.position] || 0) + 1;
    });

    const prompt = `Du bist ein erfahrener Fußball-Scout und Transferexperte.

Verein: ${club.name} (${club.league || 'Unbekannte Liga'})
Formation: ${club.standard_formation || '4-3-3'}
Aktuelle Saison: ${club.current_season || '2025/26'}
Tabellenplatz: ${club.current_table_position ? '#' + club.current_table_position : 'unbekannt'}

Aktueller Kader (${players.length} Spieler):
${players.map(p => `- ${p.name}, ${p.position}, ${p.age ? p.age + ' Jahre' : 'Alter unbekannt'}, Vertrag bis: ${p.contract_until || 'unbekannt'}`).join('\n')}

Positionsverteilung: ${JSON.stringify(positionCount)}

Ablaufende Verträge (< 12 Monate):
${expiringContracts.map(p => `- ${p.name} (${p.position}), läuft ab: ${p.contract_until}`).join('\n') || 'Keine'}

Analysiere:
1. Welche Positionen sind unterbesetzt oder brauchen Verstärkung?
2. Welche Spieler sollten ersetzt werden?
3. Empfehle 5-8 konkrete Spieler, die für diesen Verein geeignet wären (aus aktuell verfügbaren Spielern auf dem Markt, Ablösekandidaten, ablaufende Verträge).
4. Gib für jeden Transfer-Kandidaten: Name, aktueller Verein, Position, Alter, Marktwert-Schätzung, Stärken, Schwächen, Empfehlungs-Score (0-100).

Berücksichtige aktuelle Transfermarkt-Informationen.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          squad_assessment: { type: 'string' },
          weak_positions: { type: 'array', items: { type: 'string' } },
          positions_to_replace: { type: 'array', items: { type: 'string' } },
          expiring_risk: { type: 'string' },
          transfer_targets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                player_name: { type: 'string' },
                current_club: { type: 'string' },
                position: { type: 'string' },
                age: { type: 'number' },
                market_value: { type: 'string' },
                contract_until: { type: 'string' },
                strengths: { type: 'string' },
                weaknesses: { type: 'string' },
                recommendation_score: { type: 'number' },
                ai_recommendation: { type: 'string' }
              }
            }
          }
        }
      }
    });

    // Transfer-Targets in DB speichern
    if (result.transfer_targets?.length > 0) {
      // Alte Suggestions löschen
      const oldTargets = await base44.asServiceRole.entities.TransferTarget.filter({ club_id, status: 'suggested' });
      await Promise.all(oldTargets.map(t => base44.asServiceRole.entities.TransferTarget.delete(t.id)));

      // Neue speichern
      await Promise.all(result.transfer_targets.map(t =>
        base44.asServiceRole.entities.TransferTarget.create({
          ...t,
          club_id,
          status: 'suggested',
          source: 'AI'
        })
      ));
    }

    return Response.json({ ...result, expiring_contracts: expiringContracts });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});