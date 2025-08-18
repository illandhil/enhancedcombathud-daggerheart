import { MODULE_ID } from "./main.js";

export function dlog(...args) {
  try {
    if (!game.settings.get(MODULE_ID, 'debug')) return;
    console.debug('enhancedcombathud-daggerheart:DEBUG', ...args);
  } catch (e) {
    console.debug('enhancedcombathud-daggerheart:DEBUG error', e);
  }
}

export async function rollCharacterTrait(actor, traitKey) {
  if (!actor) {
    ui.notifications.warn("No valid actor provided for the trait roll.");
    return;
  }

  // Ensure the provided traitKey is valid.
  if (
    ![
      "agility",
      "strength",
      "finesse",
      "instinct",
      "presence",
      "knowledge",
    ].includes(traitKey)
  ) {
    ui.notifications.error(`Invalid trait key: "${traitKey}"`);
    return;
  }

  // Get the localized, user-friendly name of the trait for the chat message.
  const abilityLabel = game.i18n.localize(
    CONFIG.DH.ACTOR.abilities[traitKey].label
  );

  // Construct the configuration object for the roll.
  const config = {
    // The event can be an empty object if not triggered by a specific user click.
    event: {},

    // This title appears as the header of the roll configuration dialog.
    title: `${game.i18n.localize("DAGGERHEART.GENERAL.dualityRoll")}: ${
      actor.name
    }`,

    // This title is used in the final chat message.
    headerTitle: game.i18n.format(
      "DAGGERHEART.UI.Chat.dualityRoll.abilityCheckTitle",
      {
        ability: abilityLabel,
      }
    ),

    // This object contains the core parameters for the roll itself.
    roll: {
      trait: traitKey, // <-- This is the crucial part.
    },

    // This flag tells the system that a roll should be performed.
    hasRoll: true,
  };

  // Call the actor's diceRoll method with the configuration.
  const result = await actor.diceRoll({
    ...config,
    headerTitle: `${game.i18n.localize("DAGGERHEART.GENERAL.dualityRoll")}: ${
      actor.name
    }`,
    title: game.i18n.format(
      "DAGGERHEART.UI.Chat.dualityRoll.abilityCheckTitle",
      {
        ability: abilityLabel,
      }
    ),
  });

  consumeResource(actor, result?.costs);
}

async function consumeResource(actor, costs) {
  if (!costs?.length || !actor) return;
  const usefulResources = {
    ...foundry.utils.deepClone(actor.system.resources),
    fear: {
      value: game.settings.get(
        CONFIG.DH.id,
        CONFIG.DH.SETTINGS.gameSettings.Resources.Fear
      ),
      max: game.settings.get(
        CONFIG.DH.id,
        CONFIG.DH.SETTINGS.gameSettings.Homebrew
      ).maxFear,
      reversed: false,
    },
  };
  const resources = game.system.api.fields.ActionFields.CostField.getRealCosts(
    costs
  ).map((c) => {
    const resource = usefulResources[c.key];
    return {
      key: c.key,
      value: (c.total ?? c.value) * (resource.isReversed ? 1 : -1),
      target: resource.target,
      keyIsID: resource.keyIsID,
    };
  });

  await actor.modifyResource(resources);
}

export async function rollAdversaryReaction(actor) {
  // 1. Validate the actor object.
  if (!actor) {
    ui.notifications.warn("No valid actor provided for the reaction roll.");
    return;
  }

  // 2. Ensure the actor is actually an adversary.
  if (actor.type !== "adversary") {
    ui.notifications.warn(
      `Cannot make a reaction roll for a non-adversary actor of type "${actor.type}".`
    );
    return;
  }

  // 3. Construct the configuration object for the roll.
  const config = {
    // The event can be an empty object if not triggered by a specific UI click.
    event: {},

    // This title appears at the top of the roll configuration dialog.
    title: `Reaction Roll: ${actor.name}`,

    // This title is used in the header of the final chat message.
    headerTitle: "Adversary Reaction Roll",

    // This object contains the core parameters for the roll itself.
    roll: {
      type: "reaction", // <-- This is the key part that triggers a reaction roll.
    },

    // This flag tells the system that a roll should be performed.
    hasRoll: true,
  };

  // 4. Call the actor's diceRoll method with the configuration.
  await actor.diceRoll(config);
}

export async function rollCompanionAttack(actor) {
  // 1. Validate actor.
  if (!actor) {
    ui.notifications.warn(
      "No valid actor provided for the companion attack roll."
    );
    return;
  }

  // 2. Ensure actor is a companion.
  if (actor.type !== "companion") {
    ui.notifications.warn(
      `Cannot make an attack roll for a non-companion actor of type "${actor.type}".`
    );
    return;
  }

  // 3. Check if attack action exists.
  const attackAction = actor.system.attack;
  if (!attackAction) {
    ui.notifications.error(`Companion ${actor.name} has no attack defined.`);
    return;
  }

  // 4. Use the attack action.
  // The .use() method on an action handles preparing the roll configuration and executing it.
  await attackAction.use({});
}

export function hasActions(actions) {
  if (!actions) return false;
  if (actions instanceof Map) return actions.size > 0;
  if (Array.isArray(actions)) return actions.length > 0;
  if (typeof actions === "object") return Object.keys(actions).length > 0;
  return false;
}

export function makeCategory(labelKey, iconPath) {
  return {
    label: game.i18n.localize(labelKey),
    icon: iconPath,
    buttons: [],
    passiveButtons: [],
  };
}

/** Convert a Daggerheart cost structure into a readable string. */
export function formatCost(rawCost, item) {
  if (!rawCost) return "";
  try {
    if (Array.isArray(rawCost)) {
      dlog("debugCost", "formatCost array input", rawCost, item);
      return rawCost
        .map((c) => {
          let value = c?.value ?? c?.amount ?? c?.qty ?? "";
          const key = c?.key ?? c?.type ?? "";
          const keyIsID = !!c?.keyIsID;

          // Try to resolve common keys to readable labels
          let label = key;
          if (!label) label = "";
          else if (!keyIsID) label = label.charAt(0).toUpperCase() + label.slice(1);

          // If this looks like an ID, try some fallbacks to get a readable name
          if (keyIsID && item) {
            // Check item-level resource object
            const itemRes = item.system?.resource;
            if (itemRes && (itemRes.key === key || itemRes.id === key)) {
              label = itemRes.type || itemRes.name || "Resource";
            } else if (item.parent?.system?.resources) {
              const actorRes = item.parent.system.resources;
              const found = Object.entries(actorRes).find(([k, v]) => k === key || v?.id === key || v?.key === key);
              if (found) label = found[0].charAt(0).toUpperCase() + found[0].slice(1);
            }

            const abilityCosts = {
              hitPoints: { id: "hitPoints", label: "DAGGERHEART.CONFIG.HealingType.hitPoints.name", group: "Global" },
              stress: { id: "stress", label: "DAGGERHEART.CONFIG.HealingType.stress.name", group: "Global" },
              hope: { id: "hope", label: "Hope", group: "TYPES.Actor.character" },
              armor: { id: "armor", label: "Armor Slot", group: "TYPES.Actor.character" },
              fear: { id: "fear", label: "Fear", group: "TYPES.Actor.adversary" },
            };

            if ((!label || label === key)) {
              if (abilityCosts.hasOwnProperty(key)) {
                const candidateLabel = abilityCosts[key].label;
                // Localize if possible
                label = game?.i18n && game.i18n.has && game.i18n.has(candidateLabel) ? game.i18n.localize(candidateLabel) : candidateLabel;
              } else {
                // Unknown key -> classify as Special and don't show a numeric value
                label = "Special";
                value = "";
              }
            }
          }

          if (label === "Special") {
            dlog("debugCost", "formatCost special label for", c, "->", label);
            return `${label}`.trim();
          } else {
            return `${value ?? ""} ${label}`.trim();
          }
        })
        .filter(Boolean)
        .join(", ");
    }

    if (typeof rawCost === "object") {
      const value = rawCost?.value ?? rawCost?.amount ?? "";
      const key = rawCost?.key ?? rawCost?.type ?? "";
      return `${value} ${key}`.trim();
    }

    return String(rawCost);
  } catch (e) {
    console.warn("enhancedcombathud-daggerheart: formatCost failed", e);
    dlog("debugCost", "formatCost exception", e, rawCost, item);
    return "";
  }
}

export function pushStatBlock(statBlocks, labelKey, id, value, max = null) {
  const text = max !== null ? `${value ?? 0} / ${max ?? 0}` : `${value ?? 0}`;
  statBlocks.push([
    { text: game.i18n.localize(labelKey), id },
    { text, id: `${id}-value` },
  ]);
}