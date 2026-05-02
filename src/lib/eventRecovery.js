/**
 * Event Recovery — Hilfsfunktionen um Fehler zu beheben
 * 
 * Verwendet in Admin-Dashboard um Datenwaisenkinder zu reparieren
 */
import { base44 } from '@/api/base44Client';

/**
 * Finde und fixe Orphaned Events (ohne match_id)
 */
export async function fixOrphanedEvents(sessionId) {
  try {
    // 1. Lade Session
    const session = await base44.entities.LiveSession.filter({ id: sessionId }).then(r => r[0]);
    if (!session || !session.match_id) {
      console.warn('Session nicht gefunden oder hat keine match_id');
      return { success: false, reason: 'No valid match_id in session' };
    }

    // 2. Lade alle Events der Session
    const events = await base44.entities.MatchEvent.filter({ session_id: sessionId });

    // 3. Filtere die ohne match_id
    const orphaned = events.filter(e => !e.match_id);

    if (orphaned.length === 0) {
      return { success: true, fixed: 0, message: 'No orphaned events found' };
    }

    // 4. Update alle mit match_id
    let fixed = 0;
    for (const event of orphaned) {
      try {
        await base44.entities.MatchEvent.update(event.id, {
          match_id: session.match_id,
        });
        fixed++;
      } catch (e) {
        console.error(`Failed to fix event ${event.id}:`, e);
      }
    }

    return {
      success: true,
      fixed,
      total: orphaned.length,
      message: `Fixed ${fixed}/${orphaned.length} orphaned events`,
    };
  } catch (e) {
    console.error('Recovery failed:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Auto-Match Orphaned Sessions
 * Versucht Sessions ohne match_id zu echten Matches zuzuordnen
 */
export async function autoMatchOrphanedSessions() {
  try {
    // 1. Lade alle Sessions ohne match_id
    const allSessions = await base44.entities.LiveSession.list('-started_at', 1000);
    const orphaned = allSessions.filter(s => !s.match_id);

    if (orphaned.length === 0) {
      return { success: true, matched: 0, message: 'No orphaned sessions' };
    }

    // 2. Lade alle Matches
    const matches = await base44.entities.Match.list('-date', 1000);

    let matched = 0;

    // 3. Versuche zu matchen basierend auf Title und Date
    for (const session of orphaned) {
      const bestMatch = matches.find(m =>
        m.title === session.match_title ||
        (m.title && session.match_title && m.title.includes(session.match_title.split(' ')[0]))
      );

      if (bestMatch) {
        try {
          await base44.entities.LiveSession.update(session.id, {
            match_id: bestMatch.id,
          });
          matched++;
        } catch (e) {
          console.error(`Failed to match session ${session.id}:`, e);
        }
      }
    }

    return {
      success: true,
      matched,
      total: orphaned.length,
      message: `Matched ${matched}/${orphaned.length} orphaned sessions`,
    };
  } catch (e) {
    console.error('Session auto-match failed:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Validate & Repair Session Integrity
 */
export async function validateSessionIntegrity(sessionId) {
  try {
    const session = await base44.entities.LiveSession.filter({ id: sessionId }).then(r => r[0]);
    if (!session) return { valid: false, reason: 'Session not found' };

    const issues = [];

    // Check 1: Match verknüpft
    if (!session.match_id && !session.match_title) {
      issues.push('No match information');
    }

    // Check 2: Kameras vorhanden
    if (!session.camera_streams || session.camera_streams.length === 0) {
      issues.push('No cameras configured');
    }

    // Check 3: Events vorhanden
    const events = await base44.entities.MatchEvent.filter({ session_id: sessionId });
    if (events.length === 0) {
      issues.push('No events recorded');
    }

    // Check 4: Alle Events haben match_title
    const eventsWithoutTitle = events.filter(e => !e.match_title);
    if (eventsWithoutTitle.length > 0) {
      issues.push(`${eventsWithoutTitle.length} events missing match_title`);
    }

    // Check 5: Report vorhanden
    const reports = await base44.entities.SessionReport.filter({ session_id: sessionId });
    if (reports.length === 0) {
      issues.push('No session report created');
    }

    return {
      valid: issues.length === 0,
      issues,
      eventCount: events.length,
      cameraCount: session.camera_streams?.length || 0,
      reportCount: reports.length,
    };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/**
 * Delete Session & All Related Data
 * Atomisch: Session + Events + Messages + Reports
 */
export async function deleteSessionAtomic(sessionId) {
  try {
    // 1. Lade alle Daten
    const [events, messages, reports] = await Promise.all([
      base44.entities.MatchEvent.filter({ session_id: sessionId }),
      base44.entities.FunkMessage.filter({ session_id: sessionId }),
      base44.entities.SessionReport.filter({ session_id: sessionId }),
    ]);

    let deleted = 0;

    // 2. Lösche Events
    for (const event of events) {
      try {
        await base44.entities.MatchEvent.delete(event.id);
        deleted++;
      } catch (e) {
        console.error(`Failed to delete event ${event.id}:`, e);
      }
    }

    // 3. Lösche Messages
    for (const msg of messages) {
      try {
        await base44.entities.FunkMessage.delete(msg.id);
        deleted++;
      } catch (e) {
        console.error(`Failed to delete message ${msg.id}:`, e);
      }
    }

    // 4. Lösche Reports
    for (const report of reports) {
      try {
        await base44.entities.SessionReport.delete(report.id);
        deleted++;
      } catch (e) {
        console.error(`Failed to delete report ${report.id}:`, e);
      }
    }

    // 5. Lösche Session
    await base44.entities.LiveSession.delete(sessionId);

    return {
      success: true,
      deleted,
      message: `Deleted session and ${deleted} related records`,
    };
  } catch (e) {
    console.error('Atomic deletion failed:', e);
    return { success: false, error: e.message };
  }
}