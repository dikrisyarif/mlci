import { handleStartTracking } from "./trackingStart";
import { handleStopTracking } from "./trackingStop";

export const handleStart = async (params) => {
  return await handleStartTracking(params);
};

export const handleStop = async (params) => {
  return await handleStopTracking(params);
};
