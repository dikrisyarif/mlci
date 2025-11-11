// Core database functionality
export { initDatabase, getDb, resetDatabase } from './core';

// Tracking operations
export { 
    saveBackgroundLocation, 
    getUnuploadedTracks, 
    markTracksAsUploaded 
} from './tracking';

// Contract operations
export { 
    saveContracts, 
    getContracts 
} from './contracts';
export { getContractsRaw } from './contracts';

// Check-in operations
export { 
    addCheckin,
    saveContractCheckin,
    getUnuploadedCheckins,
    isContractCheckedIn,
    markCheckinAsUploaded
} from './checkins';

// State management
export { 
    saveAppState, 
    getAppState 
} from './state';

// Maintenance operations
export { cleanDailyData } from './maintenance';