import { MODULE_ID } from "./main.js";
import { rollCharacterTrait } from "./utils.js";
import { rollAdversaryReaction } from "./utils.js";
import { rollCompanionAttack } from "./utils.js";

export function initConfig() {
  Hooks.on("argonInit", (CoreHUD) => {
    const ARGON = CoreHUD.ARGON;

    // Declare dice from daggerheart
    const DHRoll = game.system.api.dice.DHRoll;
    const D20Roll = game.system.api.dice.D20Roll;

    // --- Get Argon's Component Classes ---
    if (!ARGON) {
      return ui.notifications.error(
        "Argon - Daggerheart | Could not find CONFIG.ARGON."
      );
    }
    const ItemButton = ARGON.MAIN.BUTTONS.ItemButton;
    const ButtonPanelButton = ARGON.MAIN.BUTTONS.ButtonPanelButton;
    const AccordionPanel = ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanel;
    const AccordionPanelCategory = ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanelCategory;

    // --- Define All Custom Components for Daggerheart ---

    class DummyComponent extends ARGON.CORE.ArgonComponent {
      async render() {
        this.element.classList.add("hidden");
        return this.element;
      }
    }

    class DaggerheartDrawerButton {
      constructor(buttonData, id) {
        this.buttonData = buttonData; // array of label objects { label, onClick? }
        this.id = id;
        this.element = document.createElement("button");
        this.element.classList.add("dh-drawer-button");
      }

      async render() {
        // Clear old content
        this.element.innerHTML = "";

        // Create spans for each label in grid columns
        for (const data of this.buttonData) {
          const span = document.createElement("span");
          span.textContent = data.label || "";
          if (data.style) span.style = data.style;
          this.element.appendChild(span);

          // If there's an onClick handler, add listener
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

    class DaggerheartTraitsPanel extends ARGON.DRAWER.DrawerPanel {
      constructor(...args) {
        super(...args);
      }

      get title() {
        if (this.actor && (this.actor.type === "adversary")) {
          return game.i18n.localize("enhancedcombathud-daggerheart.hud.traits.adversary");
        } else if (this.actor && this.actor.type === "companion") {
          return game.i18n.localize("enhancedcombathud-daggerheart.hud.traits.companion");
        }
        return game.i18n.localize("enhancedcombathud-daggerheart.hud.traits.character");
      }

      get categories() {
        // If the actor is an adversary or companion, return empty to hide the traits panel
        if (!this.actor || this.actor.type === "adversary" || this.actor.type === "companion") return [];

        if (!this.actor?.system?.traits) return [];
        if (!this.actor?.system?.experiences) return [];

        const traits = this.actor.system.traits;

        // Map traits to buttons
        const buttons = Object.entries(traits).map(([key, val]) => {
          return new DaggerheartDrawerButton(
            [
              {
                label: key.charAt(0).toUpperCase() + key.slice(1),
                onClick: (event) => {
                  rollCharacterTrait(this.actor, key);
                },
              },
              { label: val.value.toString() },
            ],
            key
          );
        });

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
          template:
            "modules/enhancedcombathud-daggerheart/templates/traits-drawer.hbs",
          id: "daggerheart-traits-drawer",
          title: game.i18n.localize("enhancedcombathud-daggerheart.hud.traits.character"),
          classes: ["daggerheart", "drawer", "traits"],
          width: 300,
          height: "auto",
          resizable: true,
        });
      }
    }

   class DaggerheartButtonHud extends ARGON.ButtonHud {
      constructor(actor) {
        super(actor);
      }

      // Provide buttons to be rendered by the HUD
      async _getButtons() {
        if (!this.actor) return [];

        if (this.actor.type === "adversary") {
          // Buttons for adversaries
          return [
            {
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.buttonhud.reactionRoll"),
              onClick: (event) => this._onReactionRoll(event),
              icon: "fas fa-dice",
            },
            /* Holding this code block in case I need it in the future
            {
              label: "Special Ability",
              onClick: (event) => this._onSpecialAbility(event),
              icon: "fas fa-bolt",
            },*/
          ];
        } else if (this.actor.type === "companion") {
          // Buttons for adversaries
          return [
            {
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.buttonhud.attackRoll"),
              onClick: (event) => this._onCompanionAttackRoll(event),
              icon: "fas fa-dice",
            },
            /* Holding this code block in case I need it in the future
            {
              label: "Special Ability",
              onClick: (event) => this._onSpecialAbility(event),
              icon: "fas fa-bolt",
            },*/
          ];
        } else {
          // Buttons for characters
          return [
            {
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.buttonhud.longRest"),
              onClick: (event) => this._onLongRest(event),
              icon: "fas fa-bed",
            },
            {
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.buttonhud.shortRest"),
              onClick: (event) => this._onShortRest(event),
              icon: "fas fa-coffee",
            },
          ];
        }
      }

      _onReactionRoll(event) {
        if (event) event.preventDefault();
        // Reaction roll logic
        rollAdversaryReaction(this.actor);
      }

      _onCompanionAttackRoll(event) {
        if (event) event.preventDefault();
        // CompanionAttackRoll roll logic
        rollCompanionAttack(this.actor);
      }

      /*_Holding this code block in case I need it in the future
      onSpecialAbility(event) {
        if (event) event.preventDefault();
        // Special ability logic
        ui.notifications.info(`Not Implimented yet - ${this.actor.name} uses a special ability!`);
      }*/

      _onLongRest(event) {
        if (event) event.preventDefault();
        new game.system.api.applications.dialogs.Downtime(
          this.actor,
          false
        ).render({ force: true });
      }

      _onShortRest(event) {
        if (event) event.preventDefault();
        new game.system.api.applications.dialogs.Downtime(
          this.actor,
          true
        ).render({ force: true });
      }
    }

    class DaggerheartActionButton extends ItemButton {
      constructor({ item, action }) {
        super({ item });
        this.action = action;
      }
      get label() {
        const itemName = this.item.name;
        const actionName = this.action.name;
        if (actionName === itemName || actionName === "Attack") return itemName;
        // For the adversary's main attack, just show the action name (e.g., "Claws")
        if (this.item.isProxy) return actionName;
        if (actionName === undefined) {
          return `${itemName}`;
        } else {
          return `${itemName}: ${actionName}`;
        }
      }
      get icon() {
        return this.action.img || this.item.img;
      }
      async _onLeftClick(event) {
        if (this.item && typeof this.item.use === "function") {
          this.item.use(event);
        } else {
          ui.notifications.warn(`Action for '${this.label}' is not usable.`);
        }
      }
    }

    class DaggerheartPortraitPanel extends ARGON.PORTRAIT.PortraitPanel {
      async getStatBlocks() {
        const actor = this.actor;
        if (
          !actor ||          
          actor.type === "environment"
        )
          return [];

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

          if (hp)
            statBlocks.push([
              { text: game.i18n.localize("enhancedcombathud-daggerheart.hud.portrait.hp"), id: "hp" },
              { text: `${hp.value ?? 0} / ${hp.max ?? 0}`, id: "hp-value" },
            ]);
          if (hope)
            statBlocks.push([
              { text: game.i18n.localize("enhancedcombathud-daggerheart.hud.portrait.hope"), id: "hope" },
              { text: `${hope.value ?? 0} / ${hope.max ?? 0}`, id: "hope-value" },
            ]);
          if (stress)
            statBlocks.push([
              { text: game.i18n.localize("enhancedcombathud-daggerheart.hud.portrait.stress"), id: "stress" },
              { text: `${stress.value ?? 0} / ${stress.max ?? 0}`, id: "stress-value" },
            ]);
          if (armor?.max > 0)
            statBlocks.push([
              { text: game.i18n.localize("enhancedcombathud-daggerheart.hud.portrait.armor"), id: "armor" },
              { text: `${armor.value} / ${armor.max}`, id: "armor-value" },
            ]);
          if (evasion)
            statBlocks.push([
              { text: game.i18n.localize("enhancedcombathud-daggerheart.hud.portrait.evasion"), id: "evasion" }, 
              { text: `${evasion ?? 0}`, id: "evasion-value" },
            ]);
        } else if (actor.type === "adversary") {
          const hp = system.resources?.hitPoints;
          const stress = system.resources?.stress;
          const difficulty = system.difficulty ?? 0;
          if (hp)
            statBlocks.push([
              { text: game.i18n.localize("enhancedcombathud-daggerheart.hud.portrait.hp"), id: "hp" },
              { text: `${hp.value ?? 0} / ${hp.max ?? 0}`, id: "hp-value" },
            ]);
          if (stress)
            statBlocks.push([
              { text: game.i18n.localize("enhancedcombathud-daggerheart.hud.portrait.stress"), id: "stress" },
              { text: `${stress.value ?? 0} / ${stress.max ?? 0}`, id: "stress-value" },
            ]);
          if (difficulty)
            statBlocks.push([
            { text: game.i18n.localize("enhancedcombathud-daggerheart.hud.portrait.difficulty"), id: "difficulty" }, 
            { text: `${difficulty ?? 0}`, id: "difficulty-value" },
            ]);
        } else if (actor.type === "companion") {
          const stress = system.resources?.stress;
          const evasion = system.evasion ?? 0;
          if (stress)
            statBlocks.push([
              { text: game.i18n.localize("enhancedcombathud-daggerheart.hud.portrait.stress"), id: "stress" },
              { text: `${stress.value ?? 0} / ${stress.max ?? 0}`, id: "stress-value" },
            ]);
          if (evasion)
            statBlocks.push([
              { text: game.i18n.localize("enhancedcombathud-daggerheart.hud.portrait.evasion"), id: "evasion" }, 
              { text: `${evasion ?? 0}`, id: "evasion-value" },
            ]);
        }

        return statBlocks;
      }
    }

    class DaggerheartCategoryPanel extends AccordionPanel {
      constructor({ buttons, passiveButtons, id, label, icon, description }) {
        const panelCategories = [];

        if (buttons && buttons.length > 0) {
          panelCategories.push(new AccordionPanelCategory({
            label: game.i18n.localize("enhancedcombathud-daggerheart.hud.categories.use"),
            buttons: buttons
          }));
        }

        if (passiveButtons && passiveButtons.length > 0) {
          panelCategories.push(new AccordionPanelCategory({
            label: game.i18n.localize("enhancedcombathud-daggerheart.hud.categories.passive"),
            buttons: passiveButtons
          }));
        }
        
        super({ id, accordionPanelCategories: panelCategories });
      }
    }

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

    class DaggerheartActionPanel extends ARGON.MAIN.ActionPanel {

       get label() {
        return game.i18n.localize("enhancedcombathud-daggerheart.hud.categories.moves");
            }

      async _getButtons() {
        const actor = this.actor;
        if (
          !actor ||          
          actor.type === "environment"
        )
          return [];

        let categoryButtons = [];

        // Helper to add category buttons
        const addButtons = (categoryKey, item, actions) => {
          if (actions.length === 0) {
            // If no actions, create a passive "dummy" action button
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

            btn.cssClasses = [
              "daggerheart-action",
              `daggerheart-${action.actionType}`,
            ];

            // Tooltip on every button
            const cleanDescription =
              item.system.description?.replace(/<[^>]*>?/gm, "") || item.name;
            btn.element?.setAttribute("data-tooltip", cleanDescription);
            btn.element?.setAttribute("data-tooltip-direction", "UP");

            if (action.actionType === "passive") {
              btn.cssClasses.push("daggerheart-passive");
              categories[categoryKey].passiveButtons.push(btn);
            } else {
              categories[categoryKey].buttons.push(btn);
            }
          }
        };

        // --- LOGIC FOR CHARACTER ACTORS ---
        if (actor.type === "character") {
          // 1. Define categories and order
          const categoryOrder = [
            "equipment",
            "domain",
            "class",
            "subclass",
            "heritage",
            "feature",
          ];

          const categories = {
            equipment: {
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.categories.equipment"),
              icon: "icons/svg/item-bag.svg",
              buttons: [],
              passiveButtons: [],
            },
            domain: {
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.categories.domain"),
              icon: "systems/daggerheart/assets/icons/documents/items/card-play.svg",
              buttons: [],
              passiveButtons: [],
            },
            class: {
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.categories.class"),
              icon: "systems/daggerheart/assets/icons/documents/items/laurel-crown.svg",
              buttons: [],
              passiveButtons: [],
            },
            subclass: {
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.categories.subclass"),
              icon: "systems/daggerheart/assets/icons/documents/items/laurels.svg",
              buttons: [],
              passiveButtons: [],
            },
            heritage: {
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.categories.heritage"),
              icon: "systems/daggerheart/assets/icons/documents/items/family-tree.svg",
              buttons: [],
              passiveButtons: [],
            },
            feature: {
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.categories.feature"),
              icon: "systems/daggerheart/assets/icons/documents/items/stars-stack.svg",
              buttons: [],
              passiveButtons: [],
            },
            weapon: {
              label: game.i18n.localize("enhancedcombathud-daggerheart.items.weapon.name"),
              icon: "icons/svg/sword.svg",
              buttons: [],
              passiveButtons: [],
            },
            armor: {
              label: game.i18n.localize("enhancedcombathud-daggerheart.items.armor.name"),
              icon: "icons/svg/shield.svg",
              buttons: [],
              passiveButtons: [],
            },
            consumable: {
              label: game.i18n.localize("enhancedcombathud-daggerheart.items.consumable.name"),
              icon: "icons/svg/potion.svg",
              buttons: [],
              passiveButtons: [],
            },
            loot: {
              label: game.i18n.localize("enhancedcombathud-daggerheart.items.loot.name"),
              icon: "icons/svg/coins.svg",
              buttons: [],
              passiveButtons: [],
            }
          };

          // 2. Helper to add buttons with tooltip for all buttons
          const addButtons = (categoryKey, item, actions) => {
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

              btn.cssClasses = [
                "daggerheart-action",
                `daggerheart-${action.actionType}`,
              ];

              // Add tooltip on every button
              const cleanDescription =
                item.system.description?.replace(/<[^>]*>?/gm, "") || item.name;
              btn.element?.setAttribute("data-tooltip", cleanDescription);
              btn.element?.setAttribute("data-tooltip-direction", "UP");

              if (action.actionType === "passive") {
                btn.cssClasses.push("daggerheart-passive");
                categories[categoryKey].passiveButtons.push(btn);
              } else {
                categories[categoryKey].buttons.push(btn);
              }
            }
          };

          // 3. Assign items to categories and add buttons
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
                if (origin === "ancestry" || origin === "community") {
                  categoryKey = "heritage";
                } else {
                  categoryKey = origin && categories[origin] ? origin : "feature";
                }
                break;
            }

            // Only include domain cards in loadout (not in vault)
            if (categoryKey === "domain") {
              if (item.system.inVault) continue;
            }

            if (categories[categoryKey]) {
              let itemActions = [];

              // Handle domain cards: take the first action if available, default to 'use'
              if (item.type === "domainCard") {
                const actions = item.system.actions;

                const hasActions =
                  actions instanceof Map
                    ? actions.size > 0
                    : Array.isArray(actions)
                      ? actions.length > 0
                      : actions && typeof actions === "object"
                        ? Object.keys(actions).length > 0
                        : false;

                // We only need a single button; .use() will fan out options
                const action = {
                  name: item.name,
                  img: item.img,
                  actionType: hasActions ? "use" : "passive",
                  execute: () => {}, // click is handled by item.use() in DaggerheartActionButton
                };

                itemActions.push(action);
              } else {
                // Original logic for other item types
                if (item.system.attack) {
                  itemActions.push(item.system.attack);
                }
                if (
                  item.system.actions instanceof Map &&
                  item.system.actions.size > 0
                ) {
                  itemActions.push(...item.system.actions.values());
                } else if (
                  item.system.actions &&
                  typeof item.system.actions === "object"
                ) {
                  itemActions.push(...Object.values(item.system.actions));
                }
              }

              addButtons(categoryKey, item, itemActions);
            }
          }

          // 4. Create category buttons in fixed order
          const categoryButtons = [];
          for (const key of categoryOrder) {
            if (categories[key].buttons.length > 0 || (categories[key].passiveButtons && categories[key].passiveButtons.length > 0)) {
              categoryButtons.push(
                new DaggerheartCategoryButton(categories[key])
              );
            }
          }

          return categoryButtons;
        }

        // --- LOGIC FOR ADVERSARY ACTORS ---
        else if (actor.type === "adversary") {
          var categories = {
            actions: {
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.categories.actions"),
              icon: "icons/svg/sword.svg",
              buttons: [],
              passiveButtons: [],
            },
            feature: {
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.categories.feature"),
              icon: "systems/daggerheart/assets/icons/documents/items/stars-stack.svg",
              buttons: [],
              passiveButtons: [],
            },
          };

          // Main adversary attack
          if (actor.system.attack) {
            const attackData = actor.system.attack;
            if (!attackData.actionType) attackData.actionType = "passive";
            const itemData = {
              name: attackData.name,
              img: attackData.img,
              type: "feature",
              system: { actions: { [attackData._id]: attackData } },
            };
            const tempItem = new Item.implementation(itemData, {
              parent: actor,
            });
            tempItem.isProxy = true;
            addButtons("actions", tempItem, [attackData]);
          }

          // Features
          for (const item of actor.items) {
            if (item.type !== "feature") continue;

            let itemactions = [];
            if (item.system.actions instanceof Map) {
              itemactions = [...item.system.actions.values()];
            } else if (
              item.system.actions &&
              typeof item.system.actions === "object"
            ) {
              itemactions = Object.values(item.system.actions);
            }

            if (itemactions.length > 0) {
              addButtons("feature", item, itemactions);
            } else {
              // Passive (no actions) — create hover tooltip
              const passiveAction = {
                name: item.name,
                img: item.img,
                actionType: "passive",
                execute: () => {}, // No click behavior
              };

              const passiveButton = new DaggerheartActionButton({
                item,
                action: passiveAction,
              });

              // Add style classes
              passiveButton.cssClasses = [
                "daggerheart-action",
                "daggerheart-passive",
              ];

              // Tooltip with HTML-safe description
              const cleanDescription = item.system.description || "";
              passiveButton.element?.setAttribute(
                "data-tooltip",
                cleanDescription
              );
              passiveButton.element?.setAttribute(
                "data-tooltip-direction",
                "UP"
              ); // Argon tooltip position

              categories.feature.passiveButtons.push(passiveButton);
            }
          }
        }

        // --- Final pass: create category buttons ---
        for (const key in categories) {
          if (categories[key].buttons.length > 0 || categories[key].passiveButtons.length > 0) {
            categoryButtons.push(
              new DaggerheartCategoryButton(categories[key])
            );
          }
        }

        return categoryButtons;
      }
    }

    const enableMacroPanel = game.settings.get(MODULE_ID, "macroPanel");

    const mainPanels = [DaggerheartActionPanel];
    if (enableMacroPanel) mainPanels.push(ARGON.PREFAB.MacroPanel);
    mainPanels.push(ARGON.PREFAB.PassTurnPanel);

    // Set supported types and register all components
    CoreHUD.defineSupportedActorTypes([
      "character",
      "adversary",
      "companion",
    ]);
    CoreHUD.definePortraitPanel(DaggerheartPortraitPanel);
    CoreHUD.defineDrawerPanel(DaggerheartTraitsPanel);
    //CoreHUD.defineDrawerPanel(DaggerheartAdversaryReactionPanel);
    CoreHUD.defineMainPanels(mainPanels);
    CoreHUD.defineWeaponSets(DummyComponent);
    CoreHUD.defineMovementHud(null);
    CoreHUD.defineButtonHud(DaggerheartButtonHud);
  });
}