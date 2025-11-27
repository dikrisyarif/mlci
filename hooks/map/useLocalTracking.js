import { useEffect, useState } from "react";
import { loadTrackingData } from "../../services/map/trackingMapService";

export default function useLocalTracking(employeeName) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    async function run() {
      console.log(`[useLocalTracking] RUN for: ${employeeName}`);
      setLoading(true);

      const res = await loadTrackingData(employeeName);
      setResult(res);

      console.log(`[useLocalTracking] Result received:`, res);
      setLoading(false);
      console.log(`[useLocalTracking] Loading finished`);
    }
    run();
  }, [employeeName]);

  return { loading, result };
}
