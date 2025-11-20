// utils/requestLocks.js
export const requestLocks = {
  tokenRefresh: false,
  pendingTokenResolvers: [],
  endpointLocks: new Map(),   // endpoint -> queue lock
};

// waiters for token refresh
export const waitForTokenRefresh = () =>
  new Promise((resolve) => {
    requestLocks.pendingTokenResolvers.push(resolve);
  });

export const resolvePendingTokenWaiters = (token) => {
  requestLocks.pendingTokenResolvers.forEach((r) => r(token));
  requestLocks.pendingTokenResolvers = [];
};

// NEW → endpoint-specific lock
export const acquireEndpointLock = (endpoint) => {
  return new Promise((resolve) => {
    if (!requestLocks.endpointLocks.has(endpoint)) {
      requestLocks.endpointLocks.set(endpoint, []);
    }

    const queue = requestLocks.endpointLocks.get(endpoint);

    const tryExecute = () => {
      if (queue[0] === tryExecute) {
        resolve(() => {
          // release lock
          queue.shift();
          if (queue.length > 0) {
            queue[0]();
          }
        });
      }
    };

    queue.push(tryExecute);

    if (queue.length === 1) {
      tryExecute();
    }
  });
};
