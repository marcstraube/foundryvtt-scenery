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

A FoundryVTT module for managing background image variations per scene — switch
between Day/Night, Seasonal, or GM/Player maps with a single click. Scene
elements like lights, walls, and tiles are saved and restored automatically with
each variation.

## Requirements

- **Foundry VTT:** Version 13 or higher
- **Node.js:** Version 20 or higher (if running via Node.js)

## Features

- **Variations** — assign multiple background images to a scene and switch
  between them instantly
- **Separate GM/Player backgrounds** — each variation can show a different image
  to GM and Players (e.g. a map with hidden rooms for the GM)
- **Scene element management** — lights, walls, tiles, sounds, drawings,
  templates, regions, and notes are captured and restored per variation
- **Smart scan** — automatically discover, classify, and pair map files from a
  directory with a single click
- **Copy elements** — copy scene elements (lights, walls, etc.) from one
  variation to another with granular selection
- **Global element settings** — mark element types as global so they persist
  across all variations instead of being switched
- **Variation labels** — scene directory shows a badge with the number of
  variations per scene (can be disabled in settings)

## Opening Scenery

There are two ways to open the Scenery configuration:

![Scenery Button](docs/scenery-button.png 'The Scenery button in the Scene Directory header')

1. **Header Button** (highlighted above): Click the Scenery button in the Scene
   Directory header. This opens the configuration for the currently active
   scene. The button visibility can be disabled in the module settings.

2. **Context Menu**: Right-click any scene in the Scene Directory sidebar or the
   scene navigation bar at the top, then select "Scenery". This allows you to
   configure any scene, not just the active one.

## Variations

![Scenery Dialog](docs/scenery-dialog.jpg 'The Scenery Dialog')

Each scene can have multiple variations. The first variation is always the
**Default** — its Player background is locked to the scene's background image
(set in Foundry's core scene configuration). The GM background on the Default
can be set independently, allowing the GM to see hidden information while
players see the normal map.

Additional variations each have their own GM and Player background fields. When
switching to a variation, each user sees the background assigned to their role.

### Scene Elements

When the GM switches between variations on the active scene, Scenery
automatically **saves** the current scene elements (lights, walls, tiles, etc.)
and **restores** the elements stored for the target variation. This means each
variation can have its own lighting setup, wall layout, and tile configuration.

Non-default variations without any previously captured data start empty — add
elements to the canvas and they will be saved when switching away.

### Copying Elements Between Variations

Click the copy button on a variation card to open the **Copy Dialog**. This lets
you select a source variation and choose which element types to copy (lights,
sounds, tiles, walls, drawings, templates, regions, notes). Optionally enable
**Reset unselected elements** to clear all element types that are not being
copied.

![Copy Dialog](docs/scenery-copy-dialog.jpg 'The Copy Dialog')

### Global Element Settings

By default, Scenery manages all scene element types per variation. In the module
settings, you can mark specific element types as **global** — these will stay on
the scene and not be affected when switching variations.

Defaults:

| Element type | Default       |
| ------------ | ------------- |
| Lights       | per variation |
| Sounds       | per variation |
| Tiles        | per variation |
| Walls        | per variation |
| Drawings     | **global**    |
| Templates    | **global**    |
| Regions      | per variation |
| Notes        | **global**    |

A **Reset to Defaults** button in the settings restores these values.

![Module Settings](docs/scenery-settings.jpg 'Module Settings')

Scenes with variations show a badge in the Scene Directory with the variation
count. This can be toggled via the **Show Variations Label** setting.

![Variation Labels](docs/scenery-scenes-badge.png 'Variation count badges in the Scene Directory')

## Scanning for Variations

Click **Scan for Variations** in the Scenery dialog to automatically discover
map files in the same directory as the scene's default background.

### File discovery

Scenery uses fuzzy matching to decide which files in the directory belong to the
same scene. A file is considered a variation if any of these conditions are met:

- Its name **contains** the default's base name (e.g. `Forest_Camp_Night`
  contains `Forest_Camp`)
- The default's base name **contains** the file's name (minimum 4 characters)
- Both names share a **common prefix** of at least 60% of the shorter name
  (minimum 4 characters)

This works with a wide variety of naming conventions:

- `MyCoolMap_Autumn.webp` finds `MyCoolMap_Summer.webp`, `MyCoolMap_Winter.webp`
- `Blacksmith1.jpg` finds `Blacksmith2.jpg`, `Blacksmith3.jpg`

Files that will **not** match:

- Files in a different directory
- Files with no significant name overlap (e.g. `night.jpg` for a scene named
  `Forest_Camp`)

### GM/Player map detection

After discovering files, Scenery automatically detects and pairs GM-specific and
Player-specific versions of a map. This is controlled by two settings:

- **GM Map Identifiers** — default: `gm, dm`
- **Player Map Identifiers** — default: `player, pl`

Tokens are matched as **whole words** between filename separators (`-`, `_`,
`.`, space). A file called `Enigma_Chamber.webp` will **not** match the `gm`
identifier — `enigma` is a single token, not `gm` inside a larger word.

Each discovered file is classified and grouped:

| Category    | Meaning                                              |
| ----------- | ---------------------------------------------------- |
| **GM**      | Filename contains a GM identifier token (e.g. `_GM`) |
| **Player**  | Filename contains a Player identifier token          |
| **Neutral** | No identifier token found                            |

Files are grouped by a **clean key** — the normalized filename with the
identifier token stripped. Files sharing the same clean key are paired into a
single variation.

### Example

Given a scene with default background `Forest_Clearing/Forest_Clearing.webp` and
the following files:

```
Forest_Clearing/
  Forest_Clearing.webp              ← scene default
  Forest_Clearing_GM.webp           ← GM
  Forest_Clearing_Player.webp       ← Player
  Forest_Clearing_Night.webp        ← Neutral
  Forest_Clearing_Night_GM.webp     ← GM
  Forest_Clearing_Night_Player.webp ← Player
  Forest_Clearing_Rain.webp         ← Neutral
  Forest_Clearing_Snow_DM.webp      ← GM (token: dm)
  Forest_Clearing_Fog_PL.webp       ← Player (token: pl)
```

Scenery produces:

| Clean key               | Files in group                           | Result                                                                            |
| ----------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| `forest_clearing`       | `_GM` + `_Player`                        | **Default enhanced** — the default variation's GM background is set to `_GM.webp` |
| `forest_clearing_night` | `_Night` + `_Night_GM` + `_Night_Player` | **Variation "Night"** — GM sees `_Night_GM`, Player sees `_Night_Player`          |
| `forest_clearing_rain`  | `_Rain`                                  | **Variation "Rain"** — both see the same file                                     |
| `forest_clearing_snow`  | `_Snow_DM`                               | **Variation "Snow"** — GM sees `_Snow_DM`, Player sees the scene background       |
| `forest_clearing_fog`   | `_Fog_PL`                                | **Variation "Fog"** — both see `_Fog_PL`                                          |

### Pairing rules

When a group contains multiple file categories, Scenery assigns backgrounds as
follows:

| Group composition | GM background | Player background |
| ----------------- | ------------- | ----------------- |
| GM + Player       | GM file       | Player file       |
| GM + Neutral      | GM file       | Neutral file      |
| Neutral + Player  | Neutral file  | Player file       |
| GM only           | GM file       | Scene background  |
| Player only       | Player file   | Player file       |
| Neutral only      | Neutral file  | Neutral file      |

When a group's clean key matches the scene default, no new variation is created.
Instead, the default variation's GM background is updated — this lets GMs see a
version with hidden information while players see the regular scene background.

### Disabling detection

Clear both identifier settings (leave them empty) to disable GM/Player
detection. All files will be treated as Neutral and each will become its own
variation with identical GM and Player backgrounds.

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
