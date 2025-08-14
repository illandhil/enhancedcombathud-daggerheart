# Argon - Combat HUD (Daggerheart)
Daggerheart - Argon integration

A Foundry VTT module that enhances the combat HUD for the Daggerheart system using the ARGON Combat Hud CORE.

theripper93's ARGON Core HUD is required. Shout out for the hard work ripper.  
https://github.com/theripper93/enhancedcombathud  

This is developed for the Foundryborne version of Daggerheart on FoundryVTT targeting V13.  
https://foundryborne.online/

Warning: I smashed this together with very little javascript experience and some AI help.

## Features

- Improved combat interface for Daggerheart.
- Quick access to character actions and stats.

## Folder Structure

- `lang/` - Localization files for multiple languages.
- `scripts/` - JavaScript files for HUD logic and interactivity.
- `styles/` - CSS files for custom HUD styling.
- `templates/` - Handlebars templates for HUD UI components.

## Installation

Using the install option in Foundry using the module.json  
https://github.com/illandhil/enhancedcombathud-daggerheart/releases/latest/download/module.json  

Or manually:
1. Download or clone this repository.
2. Place the folder in your Foundry VTT `modules` directory.
3. Enable "Argon - Combat HUD (Daggerheart)" in your Foundry VTT game.

## TO DO
Minimal support for Companions and Environments  
Subdivision of Ability panels based on logical grouping.  
Build actual settings menu and provide enabling and disabling some features (Current settings are placeholder)  
Build weapon bar  
Localization  
Other  

## Usage

Once enabled, the enhanced HUD will automatically appear during combat encounters in Daggerheart games.

## Contributing

Pull requests and suggestions are welcome!

## License

See `LICENSE` file for details.
