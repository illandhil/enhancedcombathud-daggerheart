export async function rollTrait(actor, traitKey, {
  event = {},
  title = game.i18n.localize('DAGGERHEART.GENERAL.dualityRoll'),
  traitValue = null,
  target = null,
  label = 'Duality Roll',
  difficulty = null,
  advantage = null,
  reaction = false,
  data = null,
} = {}) {
  const RollClass = actor.rollClass || CONFIG.Dice.daggerheart.DualityRoll;
  if (!RollClass) {
    ui.notifications.error("No DualityRoll class found.");
    return;
  }

  const config = {
    event,
    title,
    roll: {
      formula: "1d12 + 1d12",
      trait: traitValue && target ? traitValue : null,
      label,
      difficulty,
      advantage,
      type: reaction ? 'reaction' : 'trait',
    },
    data: data ?? (target?.system ?? { experiences: {}, traits: {} }),
    source: { actor: target?.uuid ?? null },
    dialog: { configure: true },
    type: 'trait',
    hasRoll: true,
  };

  const roll = await RollClass.buildConfigure(config);
  if (!roll) return;
  await RollClass.buildEvaluate(roll, config);
  await RollClass.buildPost(roll, config);
}
