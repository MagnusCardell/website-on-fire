import React from "react";
import ReactDOM from "react-dom/client";
import "./solitaire.css";      // The game's own stylesheet, nothing shared with the site
import { SolitaireApp } from "./SolitaireApp";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SolitaireApp />
  </React.StrictMode>
);
