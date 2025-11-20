import React, { createContext, useContext, useState } from "react";

const TrackingContext = createContext();

export function TrackingProvider({ children }) {
  const [isStarted, setIsStarted] = useState(false);

  return (
    <TrackingContext.Provider value={{ isStarted, setIsStarted }}>
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking() {
  return useContext(TrackingContext);
}
