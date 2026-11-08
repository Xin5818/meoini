import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./app/App.tsx";
import "./index.css";
import { I18nProvider } from "./i18n/I18nProvider";
import { DeckProvider } from "./features/decks/DeckContext";

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <DeckProvider><App /></DeckProvider>
    </I18nProvider>
  </StrictMode>,
);
