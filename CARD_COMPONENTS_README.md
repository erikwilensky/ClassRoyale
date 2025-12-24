# Card Components - React Implementation

## Overview

The card art images are generated as center art only (transparent PNGs). The full card UI is rendered dynamically in React using three components:

1. **`Card.jsx`** - Complete card component (all-in-one)
2. **`CardFrame.jsx`** - Reusable frame component (border, layout, text)
3. **`CardArt.jsx`** - Art image component (just the PNG)

## Component Structure

### Card.jsx (All-in-One)
The main component that combines everything:
- Renders card art from PNG files
- Adds frame, border, and metadata
- Handles locked/unlocked states
- Shows cost, XP unlock, category indicators

**Usage:**
```jsx
import { Card } from "./components/Card.jsx";

<Card
  card={cardData}
  isUnlocked={true}
  isDisabled={false}
  effectiveCost={2}
  goldCostModifier={1.5}
  onClick={handleClick}
  onPointerDown={handleDrag}
  isSelected={false}
/>
```

### CardFrame.jsx (Reusable Frame)
Frame-only component for custom layouts:
- Border, vignette, grain overlay
- Name header, cost chips, category indicators
- Lock overlay

**Usage:**
```jsx
import { CardFrame } from "./components/CardFrame.jsx";
import { CardArt } from "./components/CardArt.jsx";

<CardFrame
  name="Brainwave Boost"
  cost={2}
  category="time_tempo"
  target="opponent"
  isUnlocked={true}
>
  <CardArt cardId="brainwave-boost" category="time_tempo" />
</CardFrame>
```

### CardArt.jsx (Just the Image)
Displays the center art image:
- Loads PNG from `/card_art/{category}/{card_id}.png`
- Handles missing image fallback
- Applies grayscale filter when disabled

**Usage:**
```jsx
import { CardArt } from "./components/CardArt.jsx";

<CardArt
  cardId="brainwave-boost"
  category="time_tempo"
  isDisabled={false}
/>
```

## Asset Setup

### ✅ Express Static Server (Already Configured)
Card art is served from the Express server on port 3000:

```javascript
// In server/index.js (already added)
app.use("/card_art", express.static(path.join(__dirname, "../card_art")));
```

The components automatically use the correct URL:
- **Development**: `http://localhost:3000/card_art/{category}/{filename}.png`
- **Production**: `/card_art/{category}/{filename}.png` (relative, if assets are bundled)

### Alternative: Vite Public Folder
If you prefer to serve from Vite's public folder instead:

1. Create `client/public/card_art/` folder
2. Copy or symlink the `card_art/` folder:
   ```bash
   # Windows (PowerShell)
   New-Item -ItemType SymbolicLink -Path "client\public\card_art" -Target "..\card_art"
   
   # Or copy the folder
   xcopy /E /I card_art client\public\card_art
   ```

3. Update components to use relative paths:
   ```javascript
   // In Card.jsx and CardArt.jsx
   return `/card_art/${folder}/${filename}`;
   ```

## Features

### Finish Layer (Set Consistency)
All cards automatically get:
- **Inner shadow** - `inset 0 2px 4px rgba(0,0,0,0.5)`
- **Category glow** - `inset 0 0 40px {categoryColor}`
- **Vignette** - Radial gradient overlay
- **Grain texture** - SVG noise filter overlay

This makes even slightly different art styles feel like one cohesive set.

### Category Colors
- **TIME_TEMPO**: Purple border (#6a5acd) with blue-violet glow
- **SUGGESTION_CONTROL**: Cyan border (#00bcd4) with cyan-magenta glow
- **ROLES_COORDINATION**: Orange border (#ff6b35) with red-orange glow
- **DEFENSE_COUNTERPLAY**: Teal border (#20b2aa) with teal-green glow
- **GOLD_ECONOMY**: Gold border (#ffd700) with gold-amber glow
- **DISRUPTION**: Purple border (#8b008b) with deep purple glow
- **COSMETIC**: Silver border (#c0c0c0) with silver-pastel glow

### Card States
- **Unlocked**: Full color, interactive
- **Locked**: Dark overlay with lock icon, shows unlock XP cost
- **Disabled**: Grayscale filter, reduced opacity
- **Selected**: Scale up (1.05x), white border, enhanced glow

## Integration

`CardBar.jsx` has been updated to use the new `Card` component. Cards now display with:
- Generated art images
- Proper frames and borders
- Category-specific styling
- Lock/unlock states
- Cost and XP indicators

## File Structure

```
client/
  public/
    card_art/          # Static assets (if using Vite public)
      time_tempo/
      suggestion_control/
      ...
  src/
    components/
      Card.jsx         # Complete card component
      CardFrame.jsx    # Frame-only component
      CardArt.jsx      # Art-only component
      CardBar.jsx      # Updated to use Card component
```

## Next Steps

1. **Set up asset serving** - Choose Option 1 or 2 above
2. **Test card rendering** - Verify images load correctly
3. **Adjust styling** - Fine-tune colors, sizes, effects as needed
4. **Add animations** - Optional hover/click animations
5. **Rarity borders** - Add rarity-based border styles if needed

