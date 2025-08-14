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
      // You can also preset advantage, disadvantage, or a difficulty
      // advantage: 1, // 1 for advantage, -1 for disadvantage
      // difficulty: 12,
    },

    // This flag tells the system that a roll should be performed.
    hasRoll: true,
  };

  // Call the actor's diceRoll method with the configuration.
  //await actor.diceRoll(config)

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
