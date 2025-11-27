import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveTrackingLocation } from './locationService';
import { getLocalWIBString, normalizeTimestamp } from '../../utils/trackingHelper';
import * as Database from '../../utils/database';

/**
 * Migrate pending locations stored in AsyncStorage to SQLite.
 * Options:
 *  - mode: 'today' (default) will only migrate pending locations whose date (WIB) is today.
 *          'all' will migrate all pending locations.
 *  - dryRun: if true, only logs what would be migrated/deleted without performing DB writes.
 *  - pruneAfterMigrateDays: when mode === 'all' and a number is provided, prune local DB rows older than N days after migration.
 */
export async function migratePendingLocationsToDatabase(options = {}) {
  const { mode = 'today', dryRun = false, pruneAfterMigrateDays = null } = options;

  try {
    const pendingLocationsStr = await AsyncStorage.getItem('pendingLocations');
    if (!pendingLocationsStr) return { migrated: 0, skipped: 0 };

    const parsed = JSON.parse(pendingLocationsStr);
    const pendingLocations = Array.isArray(parsed) ? parsed : [];
    if (!pendingLocations.length) return { migrated: 0, skipped: 0 };

    const todayWIB = getLocalWIBString(new Date()).slice(0, 10); // YYYY-MM-DD

    let toMigrate = [];
    if (mode === 'today') {
      toMigrate = pendingLocations.filter((loc) => {
        try {
          const ts = normalizeTimestamp(loc.timestamp).slice(0, 10);
          return ts === todayWIB;
        } catch (e) {
          return false;
        }
      });
    } else {
      toMigrate = pendingLocations.slice();
    }

    let migrated = 0;
    for (const location of toMigrate) {
      if (dryRun) {
        console.log('[migrationService] dry-run migrate location:', location && location.timestamp);
      } else {
        try {
          await saveTrackingLocation(location);
          migrated++;
        } catch (e) {
          console.warn('[migrationService] failed saving location during migrate:', e?.message || e);
        }
      }
    }

    // Persist remaining pendingLocations back to AsyncStorage if we only migrated today's items
    if (mode === 'today') {
      const remaining = pendingLocations.filter((p) => !toMigrate.includes(p));
      if (dryRun) {
        console.log(`[migrationService] dry-run remaining count: ${remaining.length}`);
      } else {
        if (remaining.length) {
          await AsyncStorage.setItem('pendingLocations', JSON.stringify(remaining));
        } else {
          await AsyncStorage.removeItem('pendingLocations');
        }
      }
    } else {
      // mode === 'all'
      if (dryRun) {
        console.log('[migrationService] dry-run would remove pendingLocations key');
      } else {
        await AsyncStorage.removeItem('pendingLocations');
      }

      // Optionally prune older DB rows after migrating everything
      if (pruneAfterMigrateDays && !dryRun) {
        await pruneOldRecords(pruneAfterMigrateDays, false);
      }
    }

    return { migrated, skipped: pendingLocations.length - toMigrate.length };
  } catch (error) {
    console.error('[migrationService] Error migrating pending locations:', error?.message || error);
    return { migrated: 0, skipped: 0, error };
  }
}

/**
 * Prune local DB tables deleting rows older than `days` days (based on WIB local date portion of timestamp).
 * If dryRun=true, returns counts that would be deleted without performing deletion.
 */
export async function pruneOldRecords(days = 30, dryRun = false) {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const cutoffDate = getLocalWIBString(cutoff).slice(0, 10);

    const tables = [
      { name: 'background_tracks', where: `substr(timestamp,1,10) < ?` },
      { name: 'checkin_startstop', where: `substr(timestamp,1,10) < ?` },
      { name: 'contract_checkins', where: `substr(timestamp,1,10) < ?` },
    ];

    const results = {};
    for (const t of tables) {
      if (dryRun) {
        const res = await Database.executeWithLog('getFirstAsync', `SELECT COUNT(*) AS cnt FROM ${t.name} WHERE ${t.where};`, [cutoffDate]);
        // executeWithLog may return object or array depending on implementation
        results[t.name] = (res && (res.cnt ?? res.CNT ?? res.count)) ?? 0;
      } else {
        const delSql = `DELETE FROM ${t.name} WHERE ${t.where};`;
        await Database.executeWithLog('runAsync', delSql, [cutoffDate], false, true);
        results[t.name] = 'deleted';
      }
    }

    if (dryRun) console.log('[migrationService] prune dry-run counts:', results);
    else console.log('[migrationService] pruned old records older than', cutoffDate);

    return results;
  } catch (error) {
    console.warn('[migrationService] pruneOldRecords error:', error?.message || error);
    throw error;
  }
}
