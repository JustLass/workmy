---
name: Organic Professionalism
colors:
  surface: '#fbfbe2'
  surface-dim: '#dbdcc3'
  surface-bright: '#fbfbe2'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f5dc'
  surface-container: '#efefd7'
  surface-container-high: '#eaead1'
  surface-container-highest: '#e4e4cc'
  on-surface: '#1b1d0e'
  on-surface-variant: '#424844'
  inverse-surface: '#303221'
  inverse-on-surface: '#f2f2d9'
  outline: '#727973'
  outline-variant: '#c2c8c2'
  surface-tint: '#496455'
  primary: '#173124'
  on-primary: '#ffffff'
  primary-container: '#2d4739'
  on-primary-container: '#98b5a3'
  inverse-primary: '#b0cdbb'
  secondary: '#4e6353'
  on-secondary: '#ffffff'
  secondary-container: '#d1e9d4'
  on-secondary-container: '#546959'
  tertiary: '#262e0f'
  on-tertiary: '#ffffff'
  tertiary-container: '#3c4523'
  on-tertiary-container: '#a8b287'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ccead6'
  primary-fixed-dim: '#b0cdbb'
  on-primary-fixed: '#062014'
  on-primary-fixed-variant: '#324c3e'
  secondary-fixed: '#d1e9d4'
  secondary-fixed-dim: '#b5ccb8'
  on-secondary-fixed: '#0c1f13'
  on-secondary-fixed-variant: '#374b3c'
  tertiary-fixed: '#dde7b9'
  tertiary-fixed-dim: '#c1cb9f'
  on-tertiary-fixed: '#171e03'
  on-tertiary-fixed-variant: '#424a28'
  background: '#fbfbe2'
  on-background: '#1b1d0e'
  surface-variant: '#e4e4cc'
typography:
  display-lg:
    fontFamily: Outfit
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  body-lg:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Outfit
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2.5rem
  container-margin: 2rem
  gutter: 1rem
---

## Brand & Style

The brand personality of this design system is grounded, sophisticated, and serene. It is designed for high-focus work environments that value clarity and a connection to organic aesthetics. The target audience includes professionals in sustainable industries, high-end consultancy, and creative management who seek a digital workspace that feels calm yet highly efficient.

The visual style is **Warm Minimalism**. It moves away from the sterile "tech-blue" palettes toward a more human-centric, earth-toned interface. It utilizes generous white space (or "cream space"), high-quality typography, and a "soft-layering" approach where depth is communicated through subtle tonal shifts rather than aggressive shadows. The emotional response should be one of quiet confidence and focused tranquility.

## Colors

The palette is centered on a hierarchy of "Professional Greens" paired with an "Organic Neutral" base. 

- **Primary (Forest):** Used for primary actions, branding, and high-emphasis text.
- **Secondary (Sage):** Used for supporting elements, secondary buttons, and active states.
- **Tertiary (Moss):** Used for subtle accents, success states, and decorative elements.
- **Neutral (Beige/Cream):** The foundation of the Light Mode interface, providing a warm, low-strain background.

**Light Mode:**
The background uses `#FAF9F6` (Alabaster) for the base and `#F5F5DC` (Beige) for container surfaces to create a subtle layered effect. Text remains high-contrast using the Forest Green.

**Dark Mode:**
The background shifts to a deep earthy charcoal with a hint of olive (`#1A1C19`). Surfaces use a slightly lighter `#232621`. Green accents are shifted toward the Sage and Moss range to maintain AAA accessibility against dark backgrounds.

## Typography

This design system utilizes **Outfit** across all levels to maintain a modern, geometric, yet approachable feel. The typography follows a strict hierarchy to ensure readability in data-heavy professional contexts.

- **Headlines:** Use Medium to SemiBold weights with slightly tightened letter spacing for a premium "editorial" look.
- **Body:** Uses Regular weight with generous line heights (1.5x - 1.6x) to ensure long-form text remains legible against the warm backgrounds.
- **Labels:** Set in Medium weight with slight tracking (0.02em) to distinguish interactive elements from static content.
- **Responsive Scaling:** On mobile devices, display sizes are reduced by approximately 30% to prevent excessive wrapping while maintaining visual impact.

## Layout & Spacing

The design system employs a **Fluid Grid** system based on an 8px spatial scale. This ensures all components align to a predictable rhythm.

- **Desktop:** 12-column grid with 24px (1.5rem) gutters and 64px margins. Content is typically contained within a 1280px max-width container for better focus.
- **Tablet:** 8-column grid with 16px (1rem) gutters and 32px margins.
- **Mobile:** 4-column grid with 16px (1rem) gutters and 16px margins.

Spacing tokens are used to define the relationship between elements. Use `xl` (2.5rem) for section spacing and `md` (1rem) for component internals.

## Elevation & Depth

Depth in this design system is primarily conveyed through **Tonal Layering** supplemented by **Ambient Shadows**. 

1. **Base Level:** The main background color (Alabaster in light, Charcoal in dark).
2. **Surface Level:** Cards and navigation panels use the secondary neutral (Beige in light) with a 1px stroke of a slightly darker neutral tint.
3. **Elevated Level:** Modals and floating menus use a very soft, diffused shadow: `0 4px 20px rgba(45, 71, 57, 0.08)`. The shadow color is tinted with the Primary Forest Green to maintain a cohesive organic feel.

Avoid harsh drop shadows. The goal is to make elements appear as if they are resting softly on the surface, not hovering high above it.

## Shapes

The shape language is **Rounded**, reflecting the organic theme of the brand.

- **Standard Elements:** Buttons, inputs, and small cards use a 0.5rem (8px) radius.
- **Large Containers:** Content sections and main cards use a 1rem (16px) radius (`rounded-lg`).
- **Accent Elements:** User avatars and specific tags may use a full pill shape to create visual variety and a "friendly" touch.

The consistent use of rounded corners softens the professional grid, making the application feel more inviting and less institutional.

## Components

- **Buttons:** Primary buttons use Forest Green with white text. Secondary buttons use a Sage Green outline or a tonal beige background with Forest Green text. No sharp corners.
- **Input Fields:** Use the Surface color with a subtle 1px Forest Green border on focus. Labels sit clearly above the input in `label-sm`.
- **Cards:** Cards should have no border, instead using the Tonal Layering (Beige on Alabaster) and the defined ambient shadow for separation.
- **Chips/Badges:** Use the Tertiary Moss color at 15% opacity with 100% opacity text for a "soft highlight" effect.
- **Lists:** Use subtle horizontal dividers in a light sage tint (`#E0E5E0`) to separate items without creating visual clutter.
- **Additional Components:** Navigation sidebars should use the Secondary Neutral color to create a clear structural anchor for the application.