---
name: Obsidian Operations
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#271901'
  on-tertiary-container: '#98805d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  container-padding: 32px
  gutter: 24px
  section-gap: 64px
  max-width: 1440px
---

## Brand & Style

The design system is engineered for high-stakes operational environments, shifting from a tactical "gaming" aesthetic to a sophisticated, sober professional interface. It targets executives and operational leads who require clarity, precision, and a sense of institutional stability.

The style is **High-End Corporate / Modern**, characterized by:
- **Pragmatic Minimalism:** Every element must justify its existence. Whitespace is used as a functional tool to separate concerns rather than just an aesthetic choice.
- **Institutional Authority:** Drawing inspiration from high-end financial terminals, the UI evokes a sense of "expensive" reliability through subtle gradients, razor-sharp typography, and a restricted palette.
- **Reduced Cognitive Load:** By removing aggressive accents and high-saturation alerts, the system allows users to focus on long-term data trends and critical decision-making without visual fatigue.

## Colors

The palette is anchored in a range of refined slates and cool grays to establish a "sober" environment. 

- **Primary & Secondary:** We utilize a deep Obsidian Slate (#0F172A) for primary actions and brand presence. Secondary elements use a muted Steel Gray (#64748B) to maintain hierarchy without competing for attention.
- **Neutrals:** The background logic relies on layered whites and off-whites (#F8FAFC) to create a clean, expansive canvas.
- **Muted Status:** Status indicators are heavily desaturated. Instead of bright "traffic light" colors, we use tinted background washes with darkened text. This ensures that while a status is legible, it does not "vibrate" against the professional backdrop.

## Typography

Typography is the primary driver of the professional aesthetic. We prioritize legibility and a systematic "structured" feel.

- **Hanken Grotesk** is used for headlines to provide a sharp, contemporary edge that feels modern yet established.
- **Inter** handles all body copy, chosen for its exceptional legibility in SaaS and financial contexts.
- **JetBrains Mono** is utilized sparingly for labels, metadata, and tabular data. This introduces a "technical" precision without the aggressive "gamer" feel of previous iterations.
- **Scaling:** On mobile devices, `display-lg` scales down to 32px to ensure readability and prevent excessive wrapping.

## Layout & Spacing

This design system employs a **Fixed Grid** philosophy for desktop to maintain a sense of controlled, editorial structure, transitioning to a fluid model for mobile.

- **The 8px Rhythm:** All spacing (padding, margins, gaps) must be a multiple of 8px. This ensures a mathematical harmony across the UI.
- **Generous Whitespace:** Unlike high-density "cockpit" designs, we use significant `section-gap` units (64px) to separate different functional areas.
- **Breakpoints:**
    - **Desktop (1440px+):** 12-column grid, 24px gutters, 32px side margins.
    - **Tablet (768px - 1024px):** 8-column grid, 16px gutters, 24px side margins.
    - **Mobile (<768px):** 4-column grid, 12px gutters, 16px side margins.

## Elevation & Depth

To maintain a "sober" and professional tone, the design system avoids heavy shadows and complex textures.

- **Tonal Layering:** Depth is communicated primarily through surface color shifts. The main background is the lightest, with containers and cards using subtle 1px borders in Slate-200.
- **Ghost Borders:** Elements are defined by thin, low-contrast outlines rather than drop shadows. This creates a "flat-but-structured" appearance reminiscent of high-end architectural software.
- **Subtle Elevation:** Only when an element is interactive (e.g., a card on hover) should a very soft, high-diffusion shadow be applied (0px 4px 20px rgba(0,0,0,0.05)).

## Shapes

The shape language is "Soft" (0.25rem / 4px). This subtle rounding takes the aggressive edge off sharp corners—preventing a "brutalist" feel—while maintaining a geometric rigor that feels more professional than highly rounded or "bubbly" interfaces. 

- **Buttons & Inputs:** Use the 4px base radius.
- **Cards & Large Containers:** Scale up to 8px (`rounded-lg`) to provide a clear container hierarchy.
- **Functional Icons:** Should follow a 2px stroke width and avoid rounded terminals.

## Components

- **Buttons:** Primary buttons use solid Slate-900 with white text. Secondary buttons use a "Ghost" style: Slate-200 border with Slate-900 text. Avoid all gradients.
- **Inputs:** Use a 1px Slate-200 border. On focus, the border shifts to Slate-400 with no "glow" effect—only a subtle 1px inset shadow if necessary.
- **Status Chips:** Use the muted status palette defined in the Colors section. Text is always 2-3 shades darker than the background wash for accessibility.
- **Data Tables:** Remove all vertical borders. Use horizontal dividers in Slate-100. Row hover states should be a subtle shift to Slate-50.
- **Cards:** White backgrounds with a Slate-200 1px border. No shadows in the default state.
- **Operational Metrics:** Large numerical displays should use Hanken Grotesk Medium, paired with a small JetBrains Mono label in all-caps above the value.