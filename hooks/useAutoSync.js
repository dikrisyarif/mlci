// hooks/useAutoSync.js
import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMap } from '../context/MapContext';
import AutoSyncWorker from '../utils/autoSyncWorker';
import * as Database from '../utils/database';

export const useAutoSync = () => {
  const { state: authState } = useAuth();
  const { checkinLocations } = useMap();
  const isStartedRef = useRef(false);

  useEffect(() => {
    const checkTrackingStatus = async () => {
      const lastStart = await Database.getAppState('lastCheckinStartTimestamp');
      isStartedRef.current = !!lastStart;
    };

    checkTrackingStatus();
  }, [checkinLocations]);

  useEffect(() => {
    const isLoggedIn = !!authState?.userToken;
    const isTrackingStarted = isStartedRef.current;

    if (isLoggedIn && isTrackingStarted) {
      console.log('[AutoSync] User logged in & tracking active → starting AutoSyncWorker');
      AutoSyncWorker.start();
    } else {
      console.log('[AutoSync] User logged out or tracking stopped → stopping AutoSyncWorker');
      AutoSyncWorker.stop();
    }

    return () => {
      AutoSyncWorker.stop();
    };
  }, [authState?.userToken, checkinLocations.length]);
};
