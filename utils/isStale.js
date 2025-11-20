export const isContractsStale = (lastSyncIso) => {
  if (!lastSyncIso) return true;

  const last = new Date(lastSyncIso).setHours(0,0,0,0);
  const today = new Date().setHours(0,0,0,0);

  return last < today; // ✅ kalau kemarin/lebih lama → stale
};
