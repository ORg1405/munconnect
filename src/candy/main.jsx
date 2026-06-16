import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Candy from "./Candy.jsx";

createRoot(document.getElementById("candy-root")).render(
  <StrictMode>
    <Candy />
  </StrictMode>
);
