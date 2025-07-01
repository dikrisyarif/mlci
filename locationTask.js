import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error(error);
    return;
  }
  if (data) {
    const { locations } = data;
    try {
      const oldData = await AsyncStorage.getItem('locationLogs');
      const parsed = JSON.parse(oldData || '[]');

      // Tambahkan lokasi baru
      const updated = [
        ...parsed,
        {
          timestamp: locations[0].timestamp,
          latitude: locations[0].coords.latitude,
          longitude: locations[0].coords.longitude,
        },
      ];

      await AsyncStorage.setItem('locationLogs', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save location logs', e);
    }
  }
});
