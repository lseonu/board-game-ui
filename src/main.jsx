import React from "react";
import ReactDOM from "react-dom/client";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <Theme appearance="light" accentColor="pink" grayColor="sand" scaling="100%">
    <App />
  </Theme>
);