import * as Database from './database';
import NetInfo from '@react-native-community/netinfo';
import { saveCheckinToServer } from '../api/listApi';
import { isStartedApi } from '../api/saveCheckinApi';

class SyncService {
    constructor() {
        this.syncInterval = null;
        this.isSyncing = false;
        this.batchSize = 5;
        this.retryDelay = 5000;
        this.maxRetries = 3;
    }

    async init() {
        await Database.initDatabase();
    }

    startSync(interval = 120000) {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(async () => {
            await this.syncData();
        }, interval);
    }

    stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    async isConnected() {
        const netInfo = await NetInfo.fetch();
        return netInfo.isConnected;
    }

    async syncData() {
        if (this.isSyncing || !await this.isConnected()) {
            //console.log(this.isSyncing ? 'Sync already in progress' : 'No internet connection, skipping sync');
            return;
        }

        this.isSyncing = true;

        try {
            // 1. Sync background tracks
            let processedCount = 0;
            let failedCount = 0;
            let successIds = [];

            const unuploadedTracks = await Database.getUnuploadedTracks();
            //console.log(`Mulai sync ${unuploadedTracks.length} tracks...`);

            for (let i = 0; i < unuploadedTracks.length; i += this.batchSize) {
                const batch = unuploadedTracks.slice(i, i + this.batchSize);
                
                await Promise.all(batch.map(async (track) => {
                    let retries = 0;
                    while (retries < this.maxRetries) {
                        try {
                            await saveCheckinToServer({
                                EmployeeName: track.employee_name,
                                Lattitude: track.latitude,
                                Longtitude: track.longitude,
                                CreatedDate: track.timestamp,
                                tipechekin: 'background'
                            });
                            successIds.push(track.id);
                            processedCount++;
                            break;
                        } catch (error) {
                            retries++;
                            if (retries === this.maxRetries) {
                                console.error(`Failed to upload track after ${this.maxRetries} retries:`, error);
                                failedCount++;
                            } else {
                                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                            }
                        }
                    }
                }));

                if (successIds.length > 0) {
                    await Database.markTracksAsUploaded(successIds);
                    successIds = [];
                }

                await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
            }

            //console.log(`Background tracks sync complete. Success: ${processedCount}, Failed: ${failedCount}`);

            // 2. Sync contract checkins
            processedCount = 0;
            failedCount = 0;
            successIds = [];

            const unuploadedCheckins = await Database.getUnuploadedCheckins();
            //console.log(`Mulai sync ${unuploadedCheckins.length} checkins...`);

            for (let i = 0; i < unuploadedCheckins.length; i += this.batchSize) {
                const batch = unuploadedCheckins.slice(i, i + this.batchSize);

                await Promise.all(batch.map(async (checkin) => {
                    let retries = 0;
                    let lastResponse = null;
                    while (retries < this.maxRetries) {
                        try {
                            const payload = {
                                EmployeeName: checkin.employee_name,
                                Lattitude: checkin.latitude,
                                Longtitude: checkin.longitude,
                                CreatedDate: checkin.timestamp,
                                tipechekin: checkin.lease_no ? 'kontrak' : 
                                          checkin.comment === 'Start tracking' ? 'start' :
                                          checkin.comment === 'Stop tracking' ? 'stop' : 'tracking',
                                LeaseNo: checkin.lease_no,
                                Comment: checkin.comment
                            };
                            //console.log('[SyncService] Uploading checkin:', payload);
                            lastResponse = await saveCheckinToServer(payload);
                            //console.log('[SyncService] API response:', lastResponse);
                            // If API response indicates success, mark as uploaded
                            if (lastResponse?.Status === 1) {
                                successIds.push(checkin.id);
                                processedCount++;
                                break;
                            } else {
                                throw new Error('API response not successful: ' + JSON.stringify(lastResponse));
                            }
                        } catch (error) {
                            retries++;
                            if (retries === this.maxRetries) {
                                console.error(`Failed to upload checkin after ${this.maxRetries} retries:`, error, { lastResponse });
                                failedCount++;
                            } else {
                                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                            }
                        }
                    }
                }));

                if (successIds.length > 0) {
                    await Database.markCheckinAsUploaded(successIds);
                    successIds = [];
                }

                await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
            }

            //console.log(`Contract checkins sync complete. Success: ${processedCount}, Failed: ${failedCount}`);

        } catch (error) {
            console.error('Error during sync:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    async syncStatus(isStarted, employeeName) {
        if (!await this.isConnected()) return;

        try {
            await isStartedApi({
                EmployeeName: employeeName,
                CreatedDate: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to sync status:', error);
        }
    }
}

export default new SyncService();