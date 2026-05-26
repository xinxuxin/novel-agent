import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "@renderer/app/App";
import { ErrorBoundary } from "@components/ErrorBoundary";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
