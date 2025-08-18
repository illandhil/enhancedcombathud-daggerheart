import { MODULE_ID } from "./main.js";

export function registerSettings() {
    const settings = {
        showTooltipCost: {
            name: game.i18n.localize("enhancedcombathud-daggerheart.settings.showTooltipCost.name"),
            hint: game.i18n.localize("enhancedcombathud-daggerheart.settings.showTooltipCost.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => ui.ARGON?.refresh(),
        },
        showTooltipRecallCost: {
            name: game.i18n.localize("enhancedcombathud-daggerheart.settings.showTooltipRecallCost.name"),
            hint: game.i18n.localize("enhancedcombathud-daggerheart.settings.showTooltipRecallCost.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => ui.ARGON?.refresh(),
        },
        showTooltipRecovery: {
            name: game.i18n.localize("enhancedcombathud-daggerheart.settings.showTooltipRecovery.name"),
            hint: game.i18n.localize("enhancedcombathud-daggerheart.settings.showTooltipRecovery.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => ui.ARGON?.refresh(),
        },
        showTooltipResources: {
            name: game.i18n.localize("enhancedcombathud-daggerheart.settings.showTooltipResources.name"),
            hint: game.i18n.localize("enhancedcombathud-daggerheart.settings.showTooltipResources.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => ui.ARGON?.refresh(),
        },
        showTooltipRange: {
            name: game.i18n.localize("enhancedcombathud-daggerheart.settings.showTooltipRange.name"),
            hint: game.i18n.localize("enhancedcombathud-daggerheart.settings.showTooltipRange.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => ui.ARGON?.refresh(),
        },
        showDomainMetadata: {
            name: game.i18n.localize("enhancedcombathud-daggerheart.settings.showDomainMetadata.name"),
            hint: game.i18n.localize("enhancedcombathud-daggerheart.settings.showDomainMetadata.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => ui.ARGON?.refresh(),
        },
        includeVaultDomainCards: {
            name: game.i18n.localize("enhancedcombathud-daggerheart.settings.includeVaultDomainCards.name"),
            hint: game.i18n.localize("enhancedcombathud-daggerheart.settings.includeVaultDomainCards.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            onChange: () => ui.ARGON?.refresh(),
        },
        showPassiveActions: {
            name: game.i18n.localize("enhancedcombathud-daggerheart.settings.showPassiveActions.name"),
            hint: game.i18n.localize("enhancedcombathud-daggerheart.settings.showPassiveActions.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => ui.ARGON?.refresh(),
        },
        showLootItems: {
            name: game.i18n.localize("enhancedcombathud-daggerheart.settings.showLootItems.name"),
            hint: game.i18n.localize("enhancedcombathud-daggerheart.settings.showLootItems.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => ui.ARGON?.refresh(),
        },
        macroPanel: {
            name: game.i18n.localize("enhancedcombathud-daggerheart.settings.macroPanel.name"),
            hint: game.i18n.localize("enhancedcombathud-daggerheart.settings.macroPanel.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            requiresReload: true,
            onChange: () => ui.ARGON?.refresh(),
        },
        // Debug: enable verbose console logging when true
        debug: {
            name: game.i18n.localize("enhancedcombathud-daggerheart.settings.debug.name"),
            hint: game.i18n.localize("enhancedcombathud-daggerheart.settings.debug.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            onChange: () => ui.ARGON?.refresh(),
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