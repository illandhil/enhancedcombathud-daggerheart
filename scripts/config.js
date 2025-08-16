import { MODULE_ID } from "./main.js";
import { rollCharacterTrait } from "./utils.js";
import { rollAdversaryReaction } from "./utils.js";
import { rollCompanionAttack } from "./utils.js";

export function initConfig() {
  Hooks.on("argonInit", (CoreHUD) => {
    const ARGON = CoreHUD.ARGON;

    if (!ARGON) {
      return ui.notifications.error(
        "Argon - Daggerheart | Could not find CONFIG.ARGON."
      );
    }

    // --- Get Argon's Component Classes ---
    const ItemButton = ARGON.MAIN.BUTTONS.ItemButton;
    const ButtonPanelButton = ARGON.MAIN.BUTTONS.ButtonPanelButton;
    const AccordionPanel = ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanel;
    const AccordionPanelCategory = ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanelCategory;

    // =============================================================
    // Helpers
    // =============================================================
    function makeCategory(labelKey, iconPath) {
      return {
        label: game.i18n.localize(labelKey),
        icon: iconPath,
        buttons: [],
        passiveButtons: [],
      };
    }

    function hasActions(actions) {
      if (!actions) return false;
      if (actions instanceof Map) return actions.size > 0;
      if (Array.isArray(actions)) return actions.length > 0;
      if (typeof actions === "object") return Object.keys(actions).length > 0;
      return false;
    }

    function addButtonsToCategory(categories, categoryKey, item, actions) {
      if (actions.length === 0) {
        actions = [
          {
            name: item.name,
            img: item.img,
            actionType: "passive",
            execute: () => {},
          },
        ];
      }

      for (const action of actions) {
        if (!action.actionType) action.actionType = "passive";

        const btn = new DaggerheartActionButton({ item, action });
        btn.cssClasses = ["daggerheart-action", `daggerheart-${action.actionType}`];

        const cleanDescription = item.system.description?.replace(/<[^>]*>?/gm, "") || item.name;
        btn.element?.setAttribute("data-tooltip", cleanDescription);
        btn.element?.setAttribute("data-tooltip-direction", "UP");

        if (action.actionType === "passive") {
          btn.cssClasses.push("daggerheart-passive");
          categories[categoryKey].passiveButtons.push(btn);
        } else {
          categories[categoryKey].buttons.push(btn);
        }
      }
    }

    function pushStatBlock(statBlocks, labelKey, id, value, max = null) {
      const text = max !== null ? `${value ?? 0} / ${max ?? 0}` : `${value ?? 0}`;
      statBlocks.push([
        { text: game.i18n.localize(labelKey), id },
        { text, id: `${id}-value` },
      ]);
    }

    // =============================================================
    // Components
    // =============================================================

    // Minimal no-op component; used for Argon extension points we don't need.
    class DummyComponent extends ARGON.CORE.ArgonComponent {
      async render() {
        this.element.classList.add("hidden");
        return this.element;
      }
    }

    // Simple multi-span button used in the Traits drawer grid.
    class DaggerheartDrawerButton {
      constructor(buttonData, id) {
        this.buttonData = buttonData;
        this.id = id;
        this.element = document.createElement("button");
        this.element.classList.add("dh-drawer-button");
      }

      async render() {
        this.element.innerHTML = "";
        for (const data of this.buttonData) {
          const span = document.createElement("span");
          span.textContent = data.label || "";
          if (data.style) span.style = data.style;
          this.element.appendChild(span);

          if (data.onClick) {
            this.element.style.cursor = "pointer";
            this.element.addEventListener("click", data.onClick);
          }
        }
        return this.element;
      }

      setGrid(gridCols) {
        this.element.style.display = "grid";
        this.element.style.gridTemplateColumns = gridCols || "1fr";
      }

      setAlign(alignArr) {
        const spans = this.element.querySelectorAll("span");
        spans.forEach((span, idx) => {
          span.style.textAlign = alignArr?.[idx] || "left";
        });
      }
    }

    // Drawer panel showing character traits in a two-column grid.
    class DaggerheartTraitsPanel extends ARGON.DRAWER.DrawerPanel {
      get title() {
        if (this.actor?.type === "adversary") {
          return game.i18n.localize("enhancedcombathud-daggerheart.hud.traits.adversary");
        } else if (this.actor?.type === "companion") {
          return game.i18n.localize("enhancedcombathud-daggerheart.hud.traits.companion");
        }
        return game.i18n.localize("enhancedcombathud-daggerheart.hud.traits.character");
      }

      get categories() {
        if (!this.actor || this.actor.type === "adversary" || this.actor.type === "companion") return [];
        if (!this.actor?.system?.traits || !this.actor?.system?.experiences) return [];

        const traits = this.actor.system.traits;

        const buttons = Object.entries(traits).map(([key, val]) =>
          new DaggerheartDrawerButton(
            [
              {
                label: key.charAt(0).toUpperCase() + key.slice(1),
                onClick: () => rollCharacterTrait(this.actor, key),
              },
              { label: val.value.toString() },
            ],
            key
          )
        );

        return [
          {
            title: game.i18n.localize("enhancedcombathud-daggerheart.hud.traits.character"),
            categories: [
              {
                gridCols: "2fr 1fr",
                captions: [
                  { label: game.i18n.localize("enhancedcombathud-daggerheart.hud.traits.trait"), align: "center" },
                  { label: game.i18n.localize("enhancedcombathud-daggerheart.hud.traits.value"), align: "center" },
                ],
                buttons: buttons,
              },
            ],
          },
        ];
      }

      static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
          template: "modules/enhancedcombathud-daggerheart/templates/traits-drawer.hbs",
          id: "daggerheart-traits-drawer",
          title: game.i18n.localize("enhancedcombathud-daggerheart.hud.traits.character"),
          classes: ["daggerheart", "drawer", "traits"],
          width: 300,
          height: "auto",
          resizable: true,
        });
      }
    }

    // Button HUD: short/long rest for characters; reaction/attack rolls for others.
    class DaggerheartButtonHud extends ARGON.ButtonHud {
      async _getButtons() {
        if (!this.actor) return [];

        if (this.actor.type === "adversary") {
          return [
            {
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.buttonhud.reactionRoll"),
              onClick: (e) => this._onReactionRoll(e),
              icon: "fas fa-dice",
            },
          ];
        } else if (this.actor.type === "companion") {
          return [
            {
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.buttonhud.attackRoll"),
              onClick: (e) => this._onCompanionAttackRoll(e),
              icon: "fas fa-dice",
            },
          ];
        } else {
          return [
            {
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.buttonhud.longRest"),
              onClick: (e) => this._onLongRest(e),
              icon: "fas fa-bed",
            },
            {
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.buttonhud.shortRest"),
              onClick: (e) => this._onShortRest(e),
              icon: "fas fa-coffee",
            },
          ];
        }
      }

      _onReactionRoll(e) {
        e?.preventDefault();
        rollAdversaryReaction(this.actor);
      }
      _onCompanionAttackRoll(e) {
        e?.preventDefault();
        rollCompanionAttack(this.actor);
      }
      _onLongRest(e) {
        e?.preventDefault();
        new game.system.api.applications.dialogs.Downtime(this.actor, false).render({ force: true });
      }
      _onShortRest(e) {
        e?.preventDefault();
        new game.system.api.applications.dialogs.Downtime(this.actor, true).render({ force: true });
      }
    }

    // Buttons inside categories.
    class DaggerheartActionButton extends ItemButton {
      constructor({ item, action }) {
        super({ item });
        this.action = action;
      }
      get label() {
        const itemName = this.item.name;
        const actionName = this.action.name;
        if (actionName === itemName || actionName === "Attack") return itemName;
        if (this.item.isProxy) return actionName;
        return actionName === undefined ? `${itemName}` : `${itemName}: ${actionName}`;
      }
      get icon() {
        return this.action.img || this.item.img;
      }
      async _onLeftClick(event) {
        if (this.item && typeof this.item.use === "function") this.item.use(event);
        else ui.notifications.warn(`Action for '${this.label}' is not usable.`);
      }
    }

    // Portrait stats panel.
    class DaggerheartPortraitPanel extends ARGON.PORTRAIT.PortraitPanel {
      async getStatBlocks() {
        const actor = this.actor;
        if (!actor || actor.type === "environment") return [];

        const statBlocks = [];
        const system = actor.system;

        if (actor.type === "character") {
          const hp = system.resources?.hitPoints;
          const evasion = system.evasion ?? 0;
          const hope = system.resources?.hope;
          const stress = system.resources?.stress;
          const armor = actor.items
            .filter((i) => i.type === "armor" && i.system.equipped)
            .reduce(
              (acc, i) => ({
                value: acc.value + (i.system.marks?.value || 0),
                max: acc.max + (i.system.baseScore || 0),
              }),
              { value: 0, max: 0 }
            );

          if (hp) pushStatBlock(statBlocks, "enhancedcombathud-daggerheart.hud.portrait.hp", "hp", hp.value, hp.max);
          if (hope) pushStatBlock(statBlocks, "enhancedcombathud-daggerheart.hud.portrait.hope", "hope", hope.value, hope.max);
          if (stress) pushStatBlock(statBlocks, "enhancedcombathud-daggerheart.hud.portrait.stress", "stress", stress.value, stress.max);
          if (armor?.max > 0) pushStatBlock(statBlocks, "enhancedcombathud-daggerheart.hud.portrait.armor", "armor", armor.value, armor.max);
          if (evasion) pushStatBlock(statBlocks, "enhancedcombathud-daggerheart.hud.portrait.evasion", "evasion", evasion);
        } else if (actor.type === "adversary") {
          const hp = system.resources?.hitPoints;
          const stress = system.resources?.stress;
          const difficulty = system.difficulty ?? 0;
          if (hp) pushStatBlock(statBlocks, "enhancedcombathud-daggerheart.hud.portrait.hp", "hp", hp.value, hp.max);
          if (stress) pushStatBlock(statBlocks, "enhancedcombathud-daggerheart.hud.portrait.stress", "stress", stress.value, stress.max);
          if (difficulty) pushStatBlock(statBlocks, "enhancedcombathud-daggerheart.hud.portrait.difficulty", "difficulty", difficulty);
        } else if (actor.type === "companion") {
          const stress = system.resources?.stress;
          const evasion = system.evasion ?? 0;
          if (stress) pushStatBlock(statBlocks, "enhancedcombathud-daggerheart.hud.portrait.stress", "stress", stress.value, stress.max);
          if (evasion) pushStatBlock(statBlocks, "enhancedcombathud-daggerheart.hud.portrait.evasion", "evasion", evasion);
        }

        return statBlocks;
      }
    }

    // Accordion view for a single category (splits into Use/Passive accordions)
    class DaggerheartCategoryPanel extends AccordionPanel {
      constructor({ buttons, passiveButtons, id, label, icon, description }) {
        const panelCategories = [];
        if (buttons?.length)
          panelCategories.push(
            new AccordionPanelCategory({
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.categories.use"),
              buttons,
            })
          );
        if (passiveButtons?.length)
          panelCategories.push(
            new AccordionPanelCategory({
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.categories.passive"),
              buttons: passiveButtons,
            })
          );
        super({ id, accordionPanelCategories: panelCategories });
      }
    }

    // Category tile in the main Action Panel.
    class DaggerheartCategoryButton extends ButtonPanelButton {
      constructor({ label, icon, description, buttons, passiveButtons }) {
        super();
        this._label = label;
        this._icon = icon;
        this._description = description;
        this._buttons = buttons;
        this._passiveButtons = passiveButtons;
      }
      get label() {
        return this._label;
      }
      get icon() {
        return this._icon;
      }
      get description() {
        return this._description;
      }
      async _getPanel() {
        return new DaggerheartCategoryPanel({
          buttons: this._buttons,
          passiveButtons: this._passiveButtons,
          id: this.label,
          label: this.label,
          icon: this.icon,
          description: this.description,
        });
      }
    }

    // =============================================================
    // Main Action Panel
    // =============================================================
    class DaggerheartActionPanel extends ARGON.MAIN.ActionPanel {
      get label() {
        return game.i18n.localize("enhancedcombathud-daggerheart.hud.categories.moves");
      }

      async _getButtons() {
        const actor = this.actor;
        if (!actor || actor.type === "environment") return [];

        const categoryButtons = [];

        // --- LOGIC FOR CHARACTER ACTORS ---
        if (actor.type === "character") {
          const categoryOrder = [
            "equipment",
            "domain",
            "class",
            "subclass",
            "heritage",
            "feature",
          ];
          const categories = {
            equipment: makeCategory(
              "enhancedcombathud-daggerheart.hud.categories.equipment",
              "icons/svg/item-bag.svg"
            ),
            domain: makeCategory(
              "enhancedcombathud-daggerheart.hud.categories.domain",
              "systems/daggerheart/assets/icons/documents/items/card-play.svg"
            ),
            class: makeCategory(
              "enhancedcombathud-daggerheart.hud.categories.class",
              "systems/daggerheart/assets/icons/documents/items/laurel-crown.svg"
            ),
            subclass: makeCategory(
              "enhancedcombathud-daggerheart.hud.categories.subclass",
              "systems/daggerheart/assets/icons/documents/items/laurels.svg"
            ),
            heritage: makeCategory(
              "enhancedcombathud-daggerheart.hud.categories.heritage",
              "systems/daggerheart/assets/icons/documents/items/family-tree.svg"
            ),
            feature: makeCategory(
              "enhancedcombathud-daggerheart.hud.categories.feature",
              "systems/daggerheart/assets/icons/documents/items/stars-stack.svg"
            ),
            weapon: makeCategory(
              "enhancedcombathud-daggerheart.items.weapon.name",
              "icons/svg/sword.svg"
            ),
            armor: makeCategory(
              "enhancedcombathud-daggerheart.items.armor.name",
              "icons/svg/shield.svg"
            ),
            consumable: makeCategory(
              "enhancedcombathud-daggerheart.items.consumable.name",
              "icons/svg/potion.svg"
            ),
            loot: makeCategory(
              "enhancedcombathud-daggerheart.items.loot.name",
              "icons/svg/coins.svg"
            ),
          };

          for (const item of actor.items) {
            let categoryKey = "feature";
            switch (item.type) {
              case "weapon":
              case "consumable":
              case "armor":
              case "loot":
                categoryKey = "equipment";
                break;
              case "domainCard":
                categoryKey = "domain";
                break;
              case "ancestry":
              case "community":
                categoryKey = "heritage";
                break;
              case "feature":
                const origin = item.system.originItemType;
                if (origin === "ancestry" || origin === "community")
                  categoryKey = "heritage";
                else categoryKey = origin && categories[origin] ? origin : "feature";
                break;
            }

            // Only include domain cards in loadout (not in vault)
            if (categoryKey === "domain" && item.system.inVault) continue;

            if (categories[categoryKey]) {
              let itemActions = [];

              // Domain cards: single button, use vs passive decided by presence of actions
              if (item.type === "domainCard") {
                const action = {
                  name: item.name,
                  img: item.img,
                  actionType: hasActions(item.system.actions) ? "use" : "passive",
                  execute: () => {}, // actual fan-out happens in item.use()
                };
                itemActions.push(action);
              } else {
                if (item.system.attack) itemActions.push(item.system.attack);
                if (item.system.actions instanceof Map && item.system.actions.size > 0) {
                  itemActions.push(...item.system.actions.values());
                } else if (item.system.actions && typeof item.system.actions === "object") {
                  itemActions.push(...Object.values(item.system.actions));
                }
              }

              addButtonsToCategory(categories, categoryKey, item, itemActions);
            }
          }

          for (const key of categoryOrder) {
            if (
              categories[key].buttons.length > 0 ||
              categories[key].passiveButtons.length > 0
            ) {
              categoryButtons.push(new DaggerheartCategoryButton(categories[key]));
            }
          }
          return categoryButtons;
        }

        // --- LOGIC FOR ADVERSARY ACTORS ---
        else if (actor.type === "adversary") {
          const categories = {
            actions: makeCategory(
              "enhancedcombathud-daggerheart.hud.categories.actions",
              "icons/svg/sword.svg"
            ),
            feature: makeCategory(
              "enhancedcombathud-daggerheart.hud.categories.feature",
              "systems/daggerheart/assets/icons/documents/items/stars-stack.svg"
            ),
          };

          // Actor-level attack (top-level system.attack)
          if (actor.system.attack) {
            const attackData = actor.system.attack;
            if (!attackData.actionType) attackData.actionType = "passive";
            const itemData = {
              name: attackData.name,
              img: attackData.img,
              type: "feature",
              system: { actions: { [attackData._id]: attackData } },
            };
            const tempItem = new Item.implementation(itemData, { parent: actor });
            tempItem.isProxy = true;
            addButtonsToCategory(categories, "actions", tempItem, [attackData]);
          }

          // Feature items
          for (const item of actor.items) {
            if (item.type !== "feature") continue;

            let itemActions = [];
            if (item.system.actions instanceof Map)
              itemActions = [...item.system.actions.values()];
            else if (item.system.actions && typeof item.system.actions === "object")
              itemActions = Object.values(item.system.actions);

            if (itemActions.length > 0) {
              addButtonsToCategory(categories, "feature", item, itemActions);
            } else {
              const passiveAction = {
                name: item.name,
                img: item.img,
                actionType: "passive",
                execute: () => {},
              };
              const passiveButton = new DaggerheartActionButton({ item, action: passiveAction });
              passiveButton.cssClasses = ["daggerheart-action", "daggerheart-passive"];
              const cleanDescription = item.system.description || "";
              passiveButton.element?.setAttribute("data-tooltip", cleanDescription);
              passiveButton.element?.setAttribute("data-tooltip-direction", "UP");
              categories.feature.passiveButtons.push(passiveButton);
            }
          }

          for (const key in categories) {
            if (
              categories[key].buttons.length > 0 ||
              categories[key].passiveButtons.length > 0
            ) {
              categoryButtons.push(new DaggerheartCategoryButton(categories[key]));
            }
          }
          return categoryButtons;
        }

        // --- LOGIC FOR COMPANION ACTORS (extend later if needed) ---
        return categoryButtons;
      }
    }

    // =============================================================
    // Register panels with Argon
    // =============================================================
    const enableMacroPanel = game.settings.get(MODULE_ID, "macroPanel");
    const mainPanels = [DaggerheartActionPanel];
    if (enableMacroPanel) mainPanels.push(ARGON.PREFAB.MacroPanel);
    mainPanels.push(ARGON.PREFAB.PassTurnPanel);

    CoreHUD.defineSupportedActorTypes(["character", "adversary", "companion"]);
    CoreHUD.definePortraitPanel(DaggerheartPortraitPanel);
    CoreHUD.defineDrawerPanel(DaggerheartTraitsPanel);
    CoreHUD.defineMainPanels(mainPanels);
    CoreHUD.defineWeaponSets(DummyComponent);
    CoreHUD.defineMovementHud(null);
    CoreHUD.defineButtonHud(DaggerheartButtonHud);
  });
}
