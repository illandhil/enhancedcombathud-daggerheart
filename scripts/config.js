import { MODULE_ID } from "./main.js";
import { rollCharacterTrait, rollAdversaryReaction, rollCompanionAttack, dlog } from "./utils.js";

export function initConfig() {
  Hooks.on("argonInit", (CoreHUD) => {
    const ARGON = CoreHUD.ARGON;

    if (!ARGON) {
      return ui.notifications.error(
        "Argon - Daggerheart | Could not find CONFIG.ARGON."
      );
    }

  // Subclass display follows the actor's active subclass.featureState (no global override).
  // Uses shared dlog from utils.js for debug logging.

  // Argon component classes
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

  /** Convert a Daggerheart cost structure into a readable string. */
  function formatCost(rawCost, item) {
      if (!rawCost) return "";
      try {
        if (Array.isArray(rawCost)) {
          dlog('debugCost', 'formatCost array input', rawCost, item);
          return rawCost
            .map((c) => {
              const value = c?.value ?? c?.amount ?? c?.qty ?? "";
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
                  label = itemRes.type || itemRes.name || 'Resource';
                } else if (item.parent?.system?.resources) {
                  const actorRes = item.parent.system.resources;
                  const found = Object.entries(actorRes).find(([k, v]) => k === key || v?.id === key || v?.key === key);
                  if (found) label = found[0].charAt(0).toUpperCase() + found[0].slice(1);
                }

                // Final fallback: if we still don't have a friendly label, mark it as 'Special'.
                if ((!label || label === key) && item.system?.resource) {
                  label = 'Special';
                }
              }

              if (label === 'Special') {
                dlog('debugCost', 'formatCost special label for', c, '->', label);
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
  dlog('debugCost', 'formatCost exception', e, rawCost, item);
        return "";
      }
    }

  function addButtonsToCategory(categories, categoryKey, item, actions, meta) {
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
  // attach featureType metadata when provided (used for ordering subclass buttons)
  if (meta && meta.featureType) btn.featureType = meta.featureType;
  dlog('debugActions', 'addButtonsToCategory created', { item: item.name, action: action.name, type: action.actionType });
        btn.cssClasses = ["daggerheart-action", `daggerheart-${action.actionType}`];

  // Tooltips use Argon's Tooltip API; don't set data-* attributes here.

        if (action.actionType === "passive") {
          btn.cssClasses.push("daggerheart-passive");
          // Respect user setting to show/hide passive actions
          const showPassive = game.settings.get(MODULE_ID, 'showPassiveActions');
          if (showPassive) categories[categoryKey].passiveButtons.push(btn);
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

  // No-op Argon component.
    class DummyComponent extends ARGON.CORE.ArgonComponent {
      async render() {
        this.element.classList.add("hidden");
        return this.element;
      }
    }

  // Multi-span button for the traits drawer.
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

  // Traits drawer panel (two-column layout).
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

  // Button HUD for rests and quick rolls.
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

  // Category buttons
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
  // Prefer the item image for inventory types (weapon/armor/consumable/loot)
        const inventoryTypes = ["weapon", "armor", "consumable", "loot"];
        if (inventoryTypes.includes(this.item.type)) return this.item.img;
        return this.action.img || this.item.img;
      }
      async _onLeftClick(event) {
        if (this.item && typeof this.item.use === "function") this.item.use(event);
        else ui.notifications.warn(`Action for '${this.label}' is not usable.`);
      }
      get hasTooltip() {
        return true;
      }

      async getTooltipData() {
        try {
          const title = this.label;
          // Collect candidate descriptions; we'll prefer a matched/full action's description
          // after we try to resolve the canonical action object.
          let rawDescriptionCandidate = (this.action?.description || this.action?.system?.description || this.item?.system?.description || "");
          let description = "";
          // Use item.system.type for domain cards; otherwise show item.type
          const subtitle = this.item.type === 'domainCard' ? (this.item?.system?.type || this.item.type) : (this.item.type || "");
          const properties = [];

          // Read tooltip display settings
          const showCost = game.settings.get(MODULE_ID, 'showTooltipCost');
          const showRecall = game.settings.get(MODULE_ID, 'showTooltipRecallCost');
          const showRecovery = game.settings.get(MODULE_ID, 'showTooltipRecovery');
          const showResourcesSetting = game.settings.get(MODULE_ID, 'showTooltipResources');
          const showDomainMeta = game.settings.get(MODULE_ID, 'showDomainMetadata');

          // Header icon (prefer item.resource.icon when available)
          const icon = this.action?.img || this.item?.system?.resource?.icon || this.item?.img || "";

          // Debug: show tooltip candidates (icon must be computed first)
          dlog('getTooltipData candidates', { title, rawDescriptionCandidate, subtitle, showCost, showRecall, showRecovery, showResourcesSetting, showDomainMeta, icon });

          // Resolve the action or item cost (array or object)
          try {
            let rawCost = this.action?.cost ?? this.action?.system?.cost ?? this.item?.system?.cost ?? null;

            // If no cost is found, look up the full action in `item.system.actions`.
            // This finds the real action when the button holds a lightweight/synthetic one.
            if ((!rawCost || (Array.isArray(rawCost) && rawCost.length === 0)) && this.item?.system?.actions) {
              try {
                const actionsObj = this.item.system.actions;
                let matchedAction = null;

                // Try matching by _id first
                if (this.action?._id) {
                  try {
                    if (actionsObj instanceof Map) {
                      matchedAction = actionsObj.get(this.action._id) ?? Array.from(actionsObj.values()).find(v => v._id === this.action._id);
                    } else if (typeof actionsObj === 'object') {
                      matchedAction = actionsObj[this.action._id] ?? Object.values(actionsObj).find(v => v._id === this.action._id);
                    }
                  } catch (idErr) {
                    // ignore id lookup errors
                  }
                }

                // If no id match, try matching by name and image
                if (!matchedAction) {
                  try {
                    const values = actionsObj instanceof Map ? Array.from(actionsObj.values()) : Object.values(actionsObj || {});

                    // Try matching by name and image
                    matchedAction = values.find(v => v && v.name === this.action?.name && v.img === this.action?.img);
                    if (matchedAction) {
                      const dbg = (typeof window !== 'undefined' && window.__ECH_DEBUG) || (game?.settings ? game.settings.get(MODULE_ID, 'debug') : false);
                      if (dbg) console.info('ECH Tooltip Debug: matched by name+img', { actionName: this.action?.name, actionImg: this.action?.img, matched: matchedAction });
                    }

                    // If still no match, prefer first action that has a cost
                    if (!matchedAction) {
                      const withCost = values.find(v => {
                        const c = v?.cost ?? v?.system?.cost;
                        return Array.isArray(c) ? c.length > 0 : !!c;
                      });
                      if (withCost) {
                        matchedAction = withCost;
                        const dbg = (typeof window !== 'undefined' && window.__ECH_DEBUG) || (game?.settings ? game.settings.get(MODULE_ID, 'debug') : false);
                        if (dbg) console.info('ECH Tooltip Debug: matched by heuristic (first with cost)', { actionName: this.action?.name, actionImg: this.action?.img, matched: matchedAction });
                      }
                    }

                    // Fallback: use the first action entry
                    if (!matchedAction) {
                      const first = values.length ? values[0] : null;
                      if (first) {
                        matchedAction = first;
                        const dbg = (typeof window !== 'undefined' && window.__ECH_DEBUG) || (game?.settings ? game.settings.get(MODULE_ID, 'debug') : false);
                        if (dbg) console.info('ECH Tooltip Debug: matched by fallback (first action)', { actionName: this.action?.name, actionImg: this.action?.img, matched: matchedAction });
                      }
                    }
                  } catch (nmErr) {
                    // ignore name+img lookup errors
                  }
                }

                if (matchedAction) rawCost = matchedAction.cost ?? matchedAction.system?.cost ?? rawCost;

                // Debug logging (controlled by module setting or window flag)
                try {
                  const dbg = (typeof window !== 'undefined' && window.__ECH_DEBUG) || (game?.settings ? game.settings.get(MODULE_ID, 'debug') : false);
                  if (dbg) console.info('ECH Tooltip Debug: resolved action cost', { actionId: this.action?._id, rawCostBefore: this.action?.cost, rawCostResolved: rawCost, matched: matchedAction });
                } catch (e) {
                  // ignore settings lookup failure
                }
              } catch (inner) {
                // ignore
              }
            }
                // For domain cards, also surface item-level recallCost or resource.value as a separate property

            // Prefer description from the matched/full action when available
            try {
              const matched = typeof matchedAction !== 'undefined' ? matchedAction : null;
              const rawDescription = (matched && (matched.description || matched.system?.description)) || rawDescriptionCandidate;
              description = rawDescription ? await TextEditor.enrichHTML(rawDescription, { async: true, relativeTo: this.item }) : "";
              try { const dbg = (typeof window !== 'undefined' && window.__ECH_DEBUG) || (game?.settings ? game.settings.get(MODULE_ID, 'debug') : false); if (dbg) console.info('ECH Tooltip Debug: enriched description length', { len: (description||"").length }); } catch(e){}
            } catch (e) {
              // If enrichment fails, fall back to the candidate
              try {
                description = rawDescriptionCandidate ? await TextEditor.enrichHTML(rawDescriptionCandidate, { async: true, relativeTo: this.item }) : "";
              } catch (ee) {
                description = "";
              }
            }

            const costText = typeof formatCost === 'function' ? formatCost(rawCost, this.item) : "";
            try {
              const dbg = (typeof window !== 'undefined' && window.__ECH_DEBUG) || (game?.settings ? game.settings.get(MODULE_ID, 'debug') : false);
              if (dbg) console.info('ECH Tooltip Debug: costText', { actionId: this.action?._id, costText, rawCost });
            } catch (e) {
              /* ignore */
            }
            if (costText && showCost) properties.push({ label: game.i18n.localize("enhancedcombathud-daggerheart.hud.tooltip.cost") + ": " + costText, primary: true });

            // If this is a domain card, also show the recallCost (if present) as a
            // separate labeled property so users see both costs when available.
            try {
              if (this.item?.type === 'domainCard') {
                const recallDefined = this.item?.system && (this.item.system.recallCost !== undefined && this.item.system.recallCost !== null);
                if (recallDefined) {
                  const recallRaw = [{ value: this.item.system.recallCost, key: 'recall', keyIsID: false }];
                  const recallText = typeof formatCost === 'function' ? formatCost(recallRaw, this.item) : String(this.item.system.recallCost);
                  if (recallText && showRecall) properties.push({ label: game.i18n.localize("enhancedcombathud-daggerheart.hud.tooltip.recallCost") + ": " + recallText, secondary: true });
                } else if (this.item?.system?.resource && this.item.system.resource?.value !== undefined) {
                  const resRaw = [{ value: this.item.system.resource.value, key: this.item.system.resource.type ?? 'resource', keyIsID: false }];
                  const resText = typeof formatCost === 'function' ? formatCost(resRaw, this.item) : String(this.item.system.resource.value);
                  if (resText && showRecall) properties.push({ label: game.i18n.localize("enhancedcombathud-daggerheart.hud.tooltip.recallCost") + ": " + resText, secondary: true });
                }
              }
                } catch (e) {
                  // ignore recall formatting errors
                }
              // Add domain metadata (domain, level) when present
              try {
                if (this.item?.type === 'domainCard') {
                  const domain = this.item?.system?.domain;
                  const level = this.item?.system?.level;
                  if (domain) {
                    const domainLabel = (typeof domain === 'string' && domain.length)
                      ? domain
                          .split(/[-_\s]+/)
                          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                          .join(' ')
                      : domain;
                    if (showDomainMeta) properties.push({ label: `${game.i18n.localize('enhancedcombathud-daggerheart.hud.tooltip.domain')}: ${domainLabel}`, secondary: true });
                  }
                  if (level !== undefined && level !== null && showDomainMeta) properties.push({ label: `${game.i18n.localize('enhancedcombathud-daggerheart.hud.tooltip.level')}: ${level}`, secondary: true });
                }
                  } catch (e) {
                    // ignore
                  }
          } catch (e) {
            console.warn('enhancedcombathud-daggerheart: failed to compute cost for tooltip', e);
          }

          // Recovery (from action.uses.recovery or item.system.resource.recovery)
          let recovery = this.action?.uses?.recovery ?? this.action?.recovery ?? this.item?.system?.resource?.recovery ?? null;
          if (recovery !== null && recovery !== undefined) {
            // Map recovery tokens to localized labels
            try {
              if (typeof recovery === 'string') {
                const key = `enhancedcombathud-daggerheart.hud.recoveryTypes.${recovery}`;
                const localized = game.i18n.has(key) ? game.i18n.localize(key) : recovery;
                recovery = localized;
              }
            } catch (e) {
              // ignore localization lookup failures
            }
            if (showRecovery) properties.push({ label: game.i18n.localize("enhancedcombathud-daggerheart.hud.tooltip.recovery") + ": " + recovery, secondary: true });
          }

          // Resources: normalize object/array into a list of strings
          let resourcesList = [];
          // Daggerheart often stores resources under item.system.resource (singular) or action.system.resources
          const rawResources = this.action?.resources ?? this.action?.system?.resources ?? this.item?.system?.resources ?? this.item?.system?.resource ?? null;
          try {
            if (Array.isArray(rawResources)) {
              resourcesList = rawResources.map((r) => (typeof r === 'string' ? r : (r.name ?? JSON.stringify(r))));
            } else if (rawResources && typeof rawResources === 'object') {
              // If map-like, build readable entries
              resourcesList = Object.entries(rawResources).map(([k, v]) => {
                if (v && typeof v === 'object') return `${k}: ${v.value ?? v.amount ?? v.max ?? v}`;
                return `${k}: ${v}`;
              });
            }
          } catch (e) {
            console.warn('enhancedcombathud-daggerheart: failed to parse resources for tooltip', e);
          }

          // Range: prefer action-level, matched action, then item-level fields.
          try {
            const _rangeFrom = (a) => {
              try {
                if (!a) return null;
                return a?.range ?? a?.attack?.range ?? a?.system?.range ?? a?.system?.attack?.range ?? null;
              } catch (e) { return null; }
            };
            const matched = (typeof matchedAction !== 'undefined') ? matchedAction : null;
            let rangeVal = _rangeFrom(this.action) ?? _rangeFrom(matched) ?? this.item?.system?.range ?? this.item?.system?.attack?.range ?? null;
            // If still not found, scan item.system.actions for any action that defines a range
            if (!rangeVal && this.item?.system?.actions) {
              try {
                const actionsObj = this.item.system.actions;
                const values = actionsObj instanceof Map ? Array.from(actionsObj.values()) : Object.values(actionsObj || {});
                const found = values.find(v => _rangeFrom(v));
                if (found) rangeVal = _rangeFrom(found);
              } catch (e) {}
            }

            const showRange = game.settings.get(MODULE_ID, 'showTooltipRange');
            if (rangeVal && showRange) {
              let rangeLabel = rangeVal;
              try {
                const shortKey = `DAGGERHEART.CONFIG.Range.${rangeVal}.short`;
                const nameKey = `DAGGERHEART.CONFIG.Range.${rangeVal}.name`;
                if (game.i18n.has && game.i18n.has(shortKey)) rangeLabel = game.i18n.localize(shortKey);
                else if (game.i18n.has && game.i18n.has(nameKey)) rangeLabel = game.i18n.localize(nameKey);
              } catch (e) {}
              properties.push({ label: game.i18n.localize('enhancedcombathud-daggerheart.hud.tooltip.range') + ": " + rangeLabel, secondary: true });
            }
            } catch (e) {
              // ignore range errors
            }

          try {
            const dbg = (typeof window !== 'undefined' && window.__ECH_DEBUG) || (game?.settings ? game.settings.get(MODULE_ID, 'debug') : false);
            if (dbg) console.info('ECH Tooltip Debug: description sources', { rawDescriptionCandidate, matchedAction, description });
          } catch (e) {
            // ignore
          }
          return { title, description, subtitle, properties, resources: showResourcesSetting ? resourcesList : [], icon, footerText: "" };
        } catch (err) {
          console.warn("enhancedcombathud-daggerheart: tooltip build failed", err);
          return null;
        }
      }
    }

    // Accordion view for a single category (splits into Use/Passive accordions)
    class DaggerheartCategoryPanel extends AccordionPanel {
      constructor({ buttons, passiveButtons, id, label, icon, description }) {
        const inventoryOrder = ["weapon", "consumable", "armor", "loot"];

        // Sort function for buttons
        function sortButtons(buttons) {
          return buttons.sort((a, b) => {
            // If both buttons have a featureType (subclass ordering), use that order first
            const featureOrder = { foundation: 0, specialization: 1, mastery: 2 };
            const fa = a.featureType ?? null;
            const fb = b.featureType ?? null;
            if (fa && fb && fa !== fb) return (featureOrder[fa] ?? 0) - (featureOrder[fb] ?? 0);

            const aIndex = inventoryOrder.indexOf(a.item.type);
            const bIndex = inventoryOrder.indexOf(b.item.type);

            // If both are inventory, use the defined order
            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;

            // If only one is inventory, it comes first
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;

            // Otherwise, sort alphabetically by label
            return a.label.localeCompare(b.label);
          });
        }

        // Sort buttons if they exist
        const sortedButtons = buttons?.length ? sortButtons(buttons) : [];
        const sortedPassiveButtons = passiveButtons?.length ? sortButtons(passiveButtons) : [];

        const panelCategories = [];
        if (sortedButtons.length)
          panelCategories.push(
            new AccordionPanelCategory({
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.categories.use"),
              buttons: sortedButtons,
            })
          );
        if (sortedPassiveButtons.length)
          panelCategories.push(
            new AccordionPanelCategory({
              label: game.i18n.localize("enhancedcombathud-daggerheart.hud.categories.passive"),
              buttons: sortedPassiveButtons,
            })
          );

          // Pre-seed saved panel state so AccordionPanel.restoreState() (which runs
          // during the parent's _renderInner) will pick up the desired subpanel defaults.
          try {
            const panelId = id ?? label;
            const existing = ui.ARGON.getPanelState?.({ id: panelId });
            if (!existing && panelCategories.length) {
              const subPanelsState = panelCategories.map(() => true);
              const state = { visible: false, subPanels: subPanelsState };
              ui.ARGON.setPanelState?.(state, { id: panelId });
            }
          } catch (e) {
            // ignore storage errors
          }

          super({ id, accordionPanelCategories: panelCategories });
          this._defaultOpenHandled = false;
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
            "inventory",
            "domain",
            "class",
            "subclass",
            "heritage",
            "feature",
          ];
          const categories = {
            inventory: makeCategory(
              "enhancedcombathud-daggerheart.hud.categories.inventory",
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

          // temporary collection for subclass items so we can order them by featureState
          const subclassQueue = [];

          for (const item of actor.items) {
            let categoryKey = "feature";
            switch (item.type) {
              case "weapon":
              case "consumable":
              case "armor":
              case "loot":
                categoryKey = "inventory";
                break;
              case "domainCard":
                categoryKey = "domain";
                break;
              case "class":
                categoryKey = "class";
                break;
              case "subclass":
                categoryKey = "subclass";
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
              // If this is a subclass item, use the actor's active subclass.featureState and the subclass feature mapping
              let resolvedFeatureType = null;
              if (categoryKey === 'subclass') {
                try {
                  // Determine currently active subclass (class or multiclass)
                  const activeSubclass = (actor.system.class?.subclass) || (actor.system.multiclass?.subclass) || null;
                  if (!activeSubclass) continue;

                  // Normalize subclassState: boolean true => 2 (foundation + specialization)
                  const rawState = activeSubclass.system?.featureState;
                  const subclassState = rawState === true || rawState === 'true' ? 2 : Number(rawState) || 0;

                  // Build features lookup and try to resolve this item's declared feature type
                  const features = Array.isArray(activeSubclass.system?.features) ? activeSubclass.system.features : [];
                  const matches = features.find((f) => {
                    if (!f || !f.item) return false;
                    const ref = f.item;
                    // ref may be a string like 'Actor.x.Item.<id>' or an object with a uuid property
                    if (typeof ref === 'string') {
                      if (ref === item.uuid || ref === item._id) return true;
                      if (ref.endsWith(`.Item.${item._id}`)) return true;
                    } else if (typeof ref === 'object' && ref.uuid) {
                      if (ref.uuid === item.uuid) return true;
                      if (String(ref.uuid).endsWith(`.Item.${item._id}`)) return true;
                    }
                    return false;
                  });

                  const featureType = matches?.type ?? null;

                  // Allowed types are cumulative: foundation always; specialization if state>=2; mastery if state>=3
                  const allowed = new Set(['foundation']);
                  if (subclassState >= 2) allowed.add('specialization');
                  if (subclassState >= 3) allowed.add('mastery');

                  if (featureType) {
                    if (!allowed.has(featureType)) continue;
                    resolvedFeatureType = featureType;
                  } else {
                    // If we couldn't map this item in the subclass features list, be permissive for
                    // foundation+specialization when subclassState >=2 (so boolean true works), but
                    // require subclassState>=3 for suspected mastery items (heuristic).
                    const lower = (item.name || '').toLowerCase();
                    if (lower.includes('master') || lower.includes('mastery')) {
                      if (subclassState < 3) continue;
                      resolvedFeatureType = 'mastery';
                    } else if (subclassState < 2) {
                      // only foundation is allowed and we can't confirm, so include only if we assume foundation
                      // (we'll allow it by default here)
                      resolvedFeatureType = 'foundation';
                    }
                    if (!resolvedFeatureType) resolvedFeatureType = 'foundation';
                  }
                } catch (e) {
                  dlog('debug', 'subclass display filter error', e, item && item.name);
                  continue;
                }
              }
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

              if (categoryKey === 'subclass') {
                // resolvedFeatureType was set during the subclass filter; if unset, leave null
                subclassQueue.push({ item, actions: itemActions, featureType: resolvedFeatureType });
              } else {
                addButtonsToCategory(categories, categoryKey, item, itemActions);
              }
            }
          }

          // After collecting all items, add subclass items in order: foundation -> specialization -> mastery
          if (subclassQueue.length > 0) {
            const orderMap = { foundation: 0, specialization: 1, mastery: 2 };
            subclassQueue.sort((a, b) => {
              const oa = orderMap[a.featureType] ?? 0;
              const ob = orderMap[b.featureType] ?? 0;
              if (oa !== ob) return oa - ob;
              return (a.item.name || '').localeCompare(b.item.name || '');
            });
            for (const entry of subclassQueue) {
              addButtonsToCategory(categories, 'subclass', entry.item, entry.actions, { featureType: entry.featureType });
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
              if (item.type === "feature") {
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
            addButtonsToCategory(categories, "feature", item, itemActions);
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
  // Argon tooltip for Daggerheart
    class DaggerheartTooltip extends ARGON.CORE.Tooltip {
      get classes() {
        return ["daggerheart-tooltip", ...super.classes];
      }

      async getTooltipContent(data) {
        if (!data) return null;
        const title = data.title || "";
        const description = data.description || "";
        const subtitle = data.subtitle ? `<div class=\"subtitle\">${data.subtitle}</div>` : "";
        const props = data.properties || [];
        const resources = data.resources || [];
        const icon = data.icon || "";

        const propHtml = props
          .map((p) => `<div class=\"ech-tooltip-prop ${p.primary ? 'primary' : 'secondary'}\">${p.label}</div>`)
          .join("");

        const resourcesHtml = resources.length
          ? `<div class=\"ech-tooltip-resources\"><strong>${game.i18n.localize('enhancedcombathud-daggerheart.hud.tooltip.resources')}: </strong>${resources.join(', ')}</div>`
          : "";

        const iconHtml = icon ? `<img class=\"ech-tooltip-icon\" src=\"${icon}\" alt=\"icon\" />` : "";

        return `
          <section class=\"card-header description collapsible daggerheart-tooltip-card\">
            <header class=\"summary\">
              ${iconHtml}
              <div class=\"name-stacked border\">
                <div class=\"name\">${title}</div>
                ${subtitle}
              </div>
              <i class=\"fas fa-chevron-down fa-fw\"></i>
            </header>
            <section class=\"details collapsible-content card-content\">
              <div class=\"wrapper\">
                <div class=\"description\">${description}</div>
                <div class=\"properties\">${propHtml}</div>
                ${resourcesHtml}
              </div>
            </section>
          </section>
        `;
      }
    }

    const enableMacroPanel = game.settings.get(MODULE_ID, "macroPanel");
    const mainPanels = [DaggerheartActionPanel];
    if (enableMacroPanel) mainPanels.push(ARGON.PREFAB.MacroPanel);
    mainPanels.push(ARGON.PREFAB.PassTurnPanel);

  CoreHUD.defineTooltip(DaggerheartTooltip);
  CoreHUD.defineSupportedActorTypes(["character", "adversary", "companion"]);
    CoreHUD.definePortraitPanel(DaggerheartPortraitPanel);
    CoreHUD.defineDrawerPanel(DaggerheartTraitsPanel);
    CoreHUD.defineMainPanels(mainPanels);
    CoreHUD.defineWeaponSets(DummyComponent);
    CoreHUD.defineMovementHud(null);
    CoreHUD.defineButtonHud(DaggerheartButtonHud);
  });
}
