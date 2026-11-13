import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "./providers/AppProviders";
import "./styles/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Élément #root introuvable dans index.html.");

createRoot(root).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);
