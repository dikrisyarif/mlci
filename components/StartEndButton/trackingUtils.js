export function getLocalISOString(offsetHours = 7) {
  const now = new Date();
  now.setHours(now.getHours() + offsetHours);
  return now.toISOString().slice(0, 19);
}

export async function getBestAddress({ latitude, longitude }) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
    );
    const data = await response.json();
    return data.display_name || "Unknown location";
  } catch (error) {
    console.warn("getBestAddress failed:", error);
    return "Unknown location";
  }
}
