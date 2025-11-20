import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { saveTrackingLocation } from './locationService';
/**
 * Move pending locations from AsyncStorage to SQLite
 */
export async function migratePendingLocationsToDatabase() {
  try {
    const pendingLocationsStr = await AsyncStorage.getItem('pendingLocations');
    if (!pendingLocationsStr) return;

    const pendingLocations = JSON.parse(pendingLocationsStr);
    for (const location of pendingLocations) {
      await saveTrackingLocation(location);
    }

    await AsyncStorage.removeItem('pendingLocations');
  } catch (error) {
    // console.error('[migrationService] Error migrating pending locations:', error);
  }
}
