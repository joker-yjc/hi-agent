import React from "react";

export default React.createContext<{
  sessionId: string;
  setCurrentSessionId: (id: string) => void;
}>({ sessionId: '', setCurrentSessionId: () => { } });
