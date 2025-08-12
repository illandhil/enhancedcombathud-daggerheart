import { MODULE_ID } from "./main.js";

export function registerSettings() {
    const settings = {
        showWeaponsItems: {
            name: game.i18n.localize("enhancedcombathud-daggerheart.settings.showWeaponsItems.name"),
            hint: game.i18n.localize("enhancedcombathud-daggerheart.settings.showWeaponsItems.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            onChange: (sett) => {
                ui.ARGON.constructor.daggerheart.itemTypes.consumable = ui.ARGON.constructor.daggerheart.itemTypes.consumable.filter(i => i !== "weapon");
                if(sett) ui.ARGON.constructor.daggerheart.itemTypes.consumable.push("weapon");
                ui.ARGON.refresh()
            },
        },
        showClassActions: {
            name: game.i18n.localize("enhancedcombathud-daggerheart.settings.showClassActions.name"),
            hint: game.i18n.localize("enhancedcombathud-daggerheart.settings.showClassActions.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: (sett) => {
                ui.ARGON.constructor.daggerheart.mainBarFeatures = ui.ARGON.constructor.daggerheart.mainBarFeatures.filter(i => i !== "class");
                if(sett) ui.ARGON.constructor.daggerheart.mainBarFeatures.push("class");
                ui.ARGON.refresh()
            },
        },
        macroPanel: {
            name: game.i18n.localize("enhancedcombathud-daggerheart.settings.macroPanel.name"),
            hint: game.i18n.localize("enhancedcombathud-daggerheart.settings.macroPanel.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            requiresReload: true,
            onChange: () => ui.ARGON.refresh(),
        },
    };

    registerSettingsArray(settings);
}

export function getSetting(key) {
    return game.settings.get(MODULE_ID, key);
}

export async function setSetting(key, value) {
    return await game.settings.set(MODULE_ID, key, value);
}

function registerSettingsArray(settings) {
    for(const [key, value] of Object.entries(settings)) {
        game.settings.register(MODULE_ID, key, value);
    }
}