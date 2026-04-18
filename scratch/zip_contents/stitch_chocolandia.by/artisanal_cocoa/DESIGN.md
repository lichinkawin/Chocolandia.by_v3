# Artisanal Excellence: Design System Documentation

## 1. Overview & Creative North Star

This design system is built to transform a digital storefront into a premium, sensory experience. We are moving away from the cold, default layouts of standard e-commerce to embrace a **Creative North Star** we call **"The Master Chocolatier’s Atelier."**

Just as a master chocolatier layers textures, temperatures, and flavors, our UI layers depth, editorial typography, and intentional asymmetry. This system breaks the "template" look by utilizing large typographic scales, generous negative space (white space), and a tactile sense of layering. We treat every screen not as a grid of data, but as a curated editorial spread in a high-end culinary magazine.

---

## 2. Colors

The palette is rooted in the rich, organic tones of the cacao bean, refined by the warmth of cream and the luster of gold.

### The Palette
- **Primary (`#271310`) & Primary-Container (`#3e2723`):** These are our Deep Cocoa tones. Use them for high-impact brand moments and foundational grounding.
- **Secondary (`#735c00`) & Secondary-Fixed (`#ffe088`):** Our Gold accents. These are reserved for moments of "prestige" (CTAs, luxury badges, and highlights).
- **Surface (`#fff8ef`):** A warm, inviting Cream that prevents the interface from feeling clinical or stark.

### The "No-Line" Rule
To maintain an artisanal feel, **1px solid borders are prohibited** for sectioning. Structural boundaries must be defined solely through:
1. **Background Color Shifts:** A `surface-container-low` section sitting against a `surface` background.
2. **Vertical Rhythm:** Using the Spacing Scale (e.g., `spacing-16` or `spacing-20`) to create a clear mental model of separation without physical lines.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the `surface-container` tiers to create depth:
- **`surface-container-lowest` (#ffffff):** Used for "floating" cards that need to pop off the page.
- **`surface-container` (#f5edde):** The standard background for content groupings.
- **`surface-dim` (#e1d9cb):** Used for footer areas or "recessed" utility sections.

### The "Glass & Gradient" Rule
For hero sections and primary CTAs, avoid flat color. Use a subtle linear gradient from `primary` to `primary-container` to add "soul." For floating navigation bars or overlays, use **Glassmorphism**: a semi-transparent `surface` color with a `backdrop-blur` of 12px–20px to soften the transition between layers.

---

## 3. Typography

The typography strategy is a dialogue between tradition (the Serif) and modern clarity (the Sans-Serif).

- **Display & Headlines (Noto Serif):** These are our "Artisanal" voice. Use `display-lg` (3.5rem) with intentional letter-spacing to command attention. They should often be placed with slight asymmetric offsets to break the vertical "wall" of text.
- **Body & Labels (Manrope):** Our "Professional" voice. Manrope provides a clean, geometric contrast to the serif. It ensures that product descriptions and ingredients remain highly legible even at `body-sm`.
- **Title Tiers:** Use `title-lg` for product names in Manrope to provide a modern, high-end boutique feel that contrasts against the editorial Noto Serif headers.

---

## 4. Elevation & Depth

We reject the "drop shadow" of 2010. Elevation in this system is achieved through **Tonal Layering**.

- **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a soft, natural "lift" based on color theory rather than artificial shadows.
- **Ambient Shadows:** If a floating element (like a modal or hover-state card) requires a shadow, it must be an **Ambient Shadow**. Use the `on-surface` color at 5% opacity with a blur of 40px and a Y-offset of 10px. This mimics soft, diffused gallery lighting.
- **The "Ghost Border" Fallback:** If a container requires definition for accessibility, use a **Ghost Border**: the `outline-variant` token at 15% opacity. Never use 100% opaque borders.
- **Glassmorphism:** Apply a 60% opacity to `surface-container-lowest` for floating menus to allow the rich cocoa and cream tones of the background to bleed through, making the interface feel integrated.

---

## 5. Components

### Buttons
- **Primary:** Gradient fill (`primary` to `primary-container`), Manrope Semi-bold, `rounded-md` (0.375rem). The slight rounding feels "hand-cut" rather than industrial.
- **Secondary:** `ghost-border` with `on-surface` text. On hover, transition to a subtle `surface-container-high` fill.

### Cards & Product Grids
**Strict Rule:** No dividers. Separate product information from the image using `spacing-3` of white space. The card itself should have no border; it sits as a `surface-container-lowest` block on a `surface` background.

### Input Fields
Use a "Minimalist Tray" approach. No four-sided boxes. Use a background fill of `surface-container-high` with a `rounded-sm` bottom-only highlight in `secondary` (Gold) when focused.

### Specialized Component: The "Artisan Badge"
A floating `secondary-container` chip with `on-secondary-container` text using `label-sm`. Used for "Limited Edition" or "Single Origin" callouts.

---

## 6. Do’s and Don'ts

### Do:
- **Embrace Asymmetry:** Offset images and text blocks to create a high-end editorial rhythm.
- **Use "Signature" Spacing:** Use `spacing-20` (7rem) between major sections to let the design breathe.
- **Tone-on-Tone:** Use `on-surface-variant` for secondary text to maintain a soft, low-contrast luxury feel.

### Don’t:
- **Don’t use 1px black borders:** It shatters the "Artisanal" illusion and looks like a generic wireframe.
- **Don’t use pure black (#000000):** Use `primary` (#271310) for your darkest tones to keep the palette warm and "edible."
- **Don’t crowd the canvas:** If you think you need a divider line, you actually need more white space.
- **Don't use Courier New:** While the legacy site used it, this system upgrades the experience to Noto Serif for a more "luxurious" and "inviting" professional standard.