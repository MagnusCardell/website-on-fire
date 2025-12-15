import React from "react";
import ReactDOM from "react-dom/client";
import "../src/index.css";         // Tailwind pipeline from your main site
import "./solitaire.css";      // Game-specific animations
import { SolitaireApp } from "./SolitaireApp";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SolitaireApp />
  </React.StrictMode>
);
