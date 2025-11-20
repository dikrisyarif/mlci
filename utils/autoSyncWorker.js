// utils/autoSyncWorker.js
import SyncEngine from "../services/sync";
import NetInfo from "@react-native-community/netinfo";

class AutoSyncWorker {
  constructor() {
    this.interval = null;
    this.isRunning = false;
    this.intervalTime = 120000;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.interval = setInterval(async () => {
      const net = await NetInfo.fetch();
      if (net.isConnected) {
        console.log("[AutoSyncWorker] Online → SyncEngine.run()");
        console.log("[SYNC] Mulai sync");
        console.log("[SYNC] Pending rows:", pendingList.length);

        await SyncEngine.run();
      } else {
        console.log("[AutoSyncWorker] Offline → skip");
      }
    }, this.intervalTime);

    console.log("[AutoSyncWorker] Worker aktif, interval", this.intervalTime);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isRunning = false;
    }
  }
}

export default new AutoSyncWorker();
