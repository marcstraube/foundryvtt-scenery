# Scenery - Background Image Variation Manager

![GitHub release (latest by date)](https://img.shields.io/github/v/release/marcstraube/foundryvtt-scenery?label=Latest%20Release&prefix=v&query=$.version&colorB=red&style=for-the-badge)
![Foundry Core Minimal Compatible Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmarcstraube%2Ffoundryvtt-scenery%2Fmaster%2Fmodule.json&label=Foundry%20Minimal%20Version&query=$.compatibility.minimum&colorB=orange&style=for-the-badge)
![Foundry Core Maximal Compatible Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmarcstraube%2Ffoundryvtt-scenery%2Fmaster%2Fmodule.json&label=Foundry%20Maximal%20Version&query=$.compatibility.maximum&colorB=orange&style=for-the-badge)
![All Releases Download Count](https://img.shields.io/github/downloads/marcstraube/foundryvtt-scenery/module.zip?color=2b82fc&label=%20Downloads%20%28all%29&style=for-the-badge)
![Latest Release Download Count](https://img.shields.io/github/downloads/marcstraube/foundryvtt-scenery/latest/module.zip?label=Downloads%20%28latest%20release%29&style=for-the-badge)
[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fscenery&colorB=006400&style=for-the-badge)](https://forge-vtt.com/bazaar#package=scenery)
[![ko-fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/J3J1FVK91)
[![Patreon](https://img.shields.io/badge/Patreon-F96854?style=for-the-badge&logo=patreon&logoColor=white)](https://www.patreon.com/NerdyByNatureDev)

[![Weblate Translation Status](https://weblate.foundryvtt-hub.com/widgets/scenery/-/287x66-black.png)](https://weblate.foundryvtt-hub.com/engage/scenery/)

A FoundryVTT module that allows easy import and background image changes for
variations such as GM/Player, Night, Seasonal, etc.

## Opening Scenery

There are two ways to open the Scenery configuration:

![Scenery Button](docs/scenery-button.png 'The Scenery button in the Scene Directory header')

1. **Header Button** (highlighted above): Click the Scenery button in the Scene
   Directory header. This opens the configuration for the currently active
   scene. The button visibility can be disabled in the module settings.

2. **Context Menu**: Right-click any scene in the Scene Directory sidebar or the
   scene navigation bar at the top, then select "Scenery". This allows you to
   configure any scene, not just the active one.

![Scenery Dialog](docs/scenery-dialog.jpg 'The Scenery Dialog')

## Requirements

- **Foundry VTT:** Version 13 or higher
- **Node.js:** Version 20 or higher (if running via Node.js)

### Features

- Assign variations to be easily switched between
- Choose a different background to be shown to Players and GM
- Automatically find and import variations

### How to setup variations

When scanning for variations, scenery works as follows:

- Based on the default image of the scene (set in core scene configuration)
- Will only look for variation images in the same directory
- Variation file names must contain the base file name of the default image,
  minus the extension
- Variation names will have special characters removed and any dashes or
  underscores converted to spaces

For example, if your default map is `maps/forest-camp/Forest-Camp.jpg`, Scenery
will find the following:

- `maps/forest-camp/Forest-Camp-GM.jpg`
- `maps/forest-camp/Forest-Camp2.jpg`
- `maps/forest-camp/2.Forest-Camp.jpg`
- `maps/forest-camp/Forest-Camp-alt.png`
- `maps/forest-camp/Night-Forest-Camp.webp`

Scenery will not consider the following examples to be variations of
`maps/forest-camp/Forest-Camp.jpg`:

- `maps/some-other-dir/Forest-Camp-GM.jpg` (is not in same directory)
- `maps/forest-camp/night.jpg` (does not contain base name)
- `maps/forest-camp/forestcamp-night.jpg` (Base name has no exact match in
  variation name)

Example how to set up your directory:

![Filename Example](docs/file-naming-example.jpg 'Filename Example')

## Installation

### Method 1:

- Start Foundry and head to the Add-on Modules tab.
- Click **Install Module**.
- Search for "Scenery".
- Click the **Install** button when it comes up.

### Method 2:

- Start Foundry and head to the Add-on Modules tab.
- Click **Install Module**.
- Paste the following link into the "Manifest URL" field at the bottom:
  https://github.com/marcstraube/foundryvtt-scenery/releases/latest/download/module.json
- Click **Install**.
