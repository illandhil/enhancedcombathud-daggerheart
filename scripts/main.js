import { initConfig } from "./config.js";
import { registerSettings } from "./settings.js";

export const MODULE_ID = "enhancedcombathud-daggerheart";

Hooks.on("setup", () => {
  registerSettings();
  initConfig();
});