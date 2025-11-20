import * as Database from '../../utils/database';
import { TRACKING_CONFIG } from '../../config/trackingConfig';

/**
 * Get unuploaded locations in batches
 */
export async function getUnuploadedLocations() {
  try {
    return await Database.getUnuploadedTracks(TRACKING_CONFIG.MAX_BATCH_SIZE);
  } catch (error) {
    // console.error('[syncService] Get unuploaded error:', error);
    return [];
  }
}

/**
 * Mark records as uploaded
 */
export async function markLocationsAsUploaded(locationIds) {
  try {
    await Database.markTracksAsUploaded(locationIds);
  } catch (error) {
    // console.error('[syncService] Mark uploaded error:', error);
    throw error;
  }
}
