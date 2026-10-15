import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./context/AuthContext";
import { SSEProvider } from "./context/SSEContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <SSEProvider>
        <App />
      </SSEProvider>
    </AuthProvider>
  </React.StrictMode>
);
