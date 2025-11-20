import NetInfo from '@react-native-community/netinfo';
import * as Database from '../../utils/database';
import { isStartedApi } from '../../api/listApi';

/**
 * Load and sync tracking status with server
 */
export async function loadTrackingStatus(profile) {
  try {
    const savedStatus = await Database.getAppState('isTracking');
    let status = savedStatus === 'true';

    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected && profile?.UserName) {
      const now = new Date();
      const res = await isStartedApi({
        EmployeeName: profile.UserName,
        CreatedDate: now.toISOString(),
      });

      if (res?.Data?.NextAction) {
        status = res.Data.NextAction === 'Stop';
        await Database.saveAppState('isTracking', status ? 'true' : 'false');
      }
    }

    return status;
  } catch (error) {
    // console.error('[stateService] Error loading tracking status stateService:', error);
    return false;
  }
}

/**
 * Toggle tracking state both locally and via API
 */
export async function toggleTrackingStatus(profile, currentStatus) {
  try {
    const newStatus = !currentStatus;
    await Database.saveAppState('isTracking', newStatus ? 'true' : 'false');

    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected && profile?.UserName) {
      const now = new Date();
      await isStartedApi({
        EmployeeName: profile.UserName,
        CreatedDate: now.toISOString(),
      });
    }

    return newStatus;
  } catch (error) {
    // console.error('[stateService] Error toggling tracking status:', error);
    throw error;
  }
}
