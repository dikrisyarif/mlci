import NetInfo from '@react-native-community/netinfo';
import * as Database from '../../utils/database';
import { saveCheckinToServer, updateCheckin } from '../../api/listApi';
import { isStartedApi } from '../../api/saveCheckinApi';
import { ContractService } from '../ContractService';

import { syncTrackingBatch } from './syncTracking';
import { syncCheckinBatch } from './syncCheckin';

class SyncEngine {
  constructor() {
    this.syncInterval = null;
    this.isSyncing = false;
    this.batchSize = 5;
    this.retryDelay = 5000;
    this.maxRetries = 3;
  }

  async start(interval = 120000) {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => this.sync(), interval);
  }

  stop() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = null;
  }

  async isConnected() {
    const info = await NetInfo.fetch();
    return info.isConnected;
  }

  async sync() {
    if (this.isSyncing || !(await this.isConnected())) return;
    this.isSyncing = true;

    try {
      await this.syncTracking();
      await this.syncCheckins();
      console.log('[SyncEngine] Sync selesai');
    } catch (e) {
    //   console.error('[SyncEngine] Error:', e);
    } finally {
      this.isSyncing = false;
    }
  }

  async syncTracking() {
    const unuploaded = await Database.getUnuploadedTracks();
    if (unuploaded.length === 0) return;

    console.log(`[SyncEngine] Tracking pending: ${unuploaded.length}`);

    await syncTrackingBatch(unuploaded, {
      save: saveCheckinToServer,
      batchSize: this.batchSize,
      retry: this.maxRetries,
      delay: this.retryDelay,
      markUploaded: Database.markTracksAsUploaded,
    });
  }

  async syncCheckins() {
    const unuploaded = await Database.getUnuploadedCheckins();
    if (unuploaded.length === 0) return;

    console.log(`[SyncEngine] Checkins pending: ${unuploaded.length}`);

    await syncCheckinBatch(unuploaded, {
      save: saveCheckinToServer,
      updateStatus: updateCheckin,
      contractFlag: ContractService.updateLocalContractFlag,
      batchSize: this.batchSize,
      retry: this.maxRetries,
      delay: this.retryDelay,
      markUploaded: Database.markCheckinAsUploaded,
    });
  }

  async syncStatus(employeeName) {
    if (!(await this.isConnected())) return;
    try {
      await isStartedApi({
        EmployeeName: employeeName,
        CreatedDate: new Date().toISOString(),
      });
    } catch (e) {
    //   console.error('[SyncEngine] syncStatus error:', e);
    }
  }
}

export default new SyncEngine();
