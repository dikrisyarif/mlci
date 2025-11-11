// Database monitoring state
export const DB_MONITOR = {
  operations: new Set(),
  lastError: null,
  startTime: Date.now(),
  stats: {
    totalOperations: 0,
    failedOperations: 0,
    locks: 0,
    lastResetTime: null
  }
};

// Enhanced logging with transaction tracking
export const logDbOperation = (operation, status, details = null) => {
  const timestamp = new Date().toISOString();
  const message = `[Database ${timestamp}] ${operation}: ${status}${
    details ? '\n' + JSON.stringify(details, null, 2) : ''
  }`;
  //console.log(message);
  
  // Track active operations
  if (status === 'started') {
    DB_MONITOR.operations.add(operation);
  } else if (status === 'completed' || status === 'failed') {
    DB_MONITOR.operations.delete(operation);
  }
  
  // Update statistics
  DB_MONITOR.stats.totalOperations++;
  if (status === 'failed') {
    DB_MONITOR.stats.failedOperations++;
    DB_MONITOR.lastError = {
      operation,
      timestamp,
      details
    };
  }
  if (details?.error?.message?.includes('database is locked')) {
    DB_MONITOR.stats.locks++;
  }
};

// Get current monitoring stats
export const getMonitorStats = () => ({
  ...DB_MONITOR.stats,
  activeOperations: Array.from(DB_MONITOR.operations),
  lastError: DB_MONITOR.lastError
});

// Reset monitoring stats
export const resetMonitorStats = () => {
  DB_MONITOR.stats = {
    totalOperations: 0,
    failedOperations: 0,
    locks: 0,
    lastResetTime: new Date().toISOString()
  };
  DB_MONITOR.operations.clear();
  DB_MONITOR.lastError = null;
};