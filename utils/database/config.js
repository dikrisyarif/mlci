// Database configuration
export const DB_CONFIG = {
  name: 'TrackingDB.db',
  version: 1,
  retries: {
    max: 3,
    baseDelay: 300,
    maxDelay: 2000
  },
  transaction: {
    timeout: 5000 // 5 seconds timeout for transactions
  },
  tables: {
    metadata: 'metadata',
    background_tracks: 'background_tracks',
    contract_checkins: 'contract_checkins',
    contracts: 'contracts',
    app_state: 'app_state'
  }
};

// Helper for delays
export const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));