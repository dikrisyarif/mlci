import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Database from './database/index';
import { saveCheckinToServer } from '../api/listApi';
import NetInfo from '@react-native-community/netinfo';

const LAST_CLEANUP_KEY = 'lastCleanupDate';

// Helper to get next midnight
function getNextMidnight() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

// Helper to check if cleanup is needed
async function isCleanupNeeded() {
  try {
    const lastCleanup = await AsyncStorage.getItem(LAST_CLEANUP_KEY);
    if (!lastCleanup) return true;

    const today = new Date().toISOString().split('T')[0];
    return lastCleanup !== today;
  } catch (error) {
    console.error('Error checking cleanup status:', error);
    return true;
  }
}

// Perform auto-stop if needed
async function performAutoStop(employeeName) {
  try {
    const netInfo = await NetInfo.fetch();
      // Pastikan database sudah siap sebelum operasi
      await Database.initDatabase();
      if (!netInfo.isConnected) {
      //console.log('No internet connection for auto-stop, will try next time');
      return;
    }

    const now = new Date();
    await saveCheckinToServer({
      EmployeeName: employeeName,
      CreatedDate: now.toISOString(),
      type: 'stop',
      tipechekin: 'stop',
    });
    
    //console.log('Auto-stop completed successfully');
  } catch (error) {
    console.error('Error during auto-stop:', error);
  }
}

// Main scheduling function
export async function scheduleMidnightCleanup(employeeName) {
  // First check if we need to do a cleanup now
    await Database.initDatabase();
    if (await isCleanupNeeded()) {
    //console.log('Performing pending cleanup...');
    try {
      // Clean database and check if tracking was active
      const wasTracking = await Database.cleanDailyData();
      
      // If was tracking, perform auto-stop
      if (wasTracking) {
        //console.log('Found active tracking, performing auto-stop...');
        await performAutoStop(employeeName);
      }

      // Mark cleanup as done for today
      await AsyncStorage.setItem(LAST_CLEANUP_KEY, new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  // Schedule next cleanup
  const now = new Date();
  const midnight = getNextMidnight();
  const msUntilMidnight = midnight - now;

  // Schedule cleanup
  setTimeout(async () => {
    try {
      // Clean database and check if tracking was active
      const wasTracking = await Database.cleanDailyData();
      
      // If was tracking, perform auto-stop
      if (wasTracking) {
        //console.log('Found active tracking at midnight, performing auto-stop...');
        await performAutoStop(employeeName);
      }

      // Mark cleanup as done
      await AsyncStorage.setItem(LAST_CLEANUP_KEY, new Date().toISOString().split('T')[0]);
      
      // Schedule next day's cleanup
      scheduleMidnightCleanup(employeeName);
    } catch (error) {
      console.error('Error during midnight cleanup:', error);
      // Try to reschedule even if there was an error
      scheduleMidnightCleanup(employeeName);
    }
  }, msUntilMidnight);

  //console.log(`Next cleanup scheduled for: ${midnight.toLocaleString()}`);
}