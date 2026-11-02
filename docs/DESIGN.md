# GZX Loyalty — design system

Generated with the **ui-ux-pro-max** skill (`--design-system`, density 7, motion 3), then
overridden with the brand palette from the GZX loyalty-card artwork.

| Decision | Choice | Why |
|---|---|---|
| Style | Retro-futurism / synthwave, toned down: neon glow on key elements only, no glitch or scanlines | Matches the card; cashier screens stay calm and fast |
| Headings | **Russo One** (uppercase) | Skill's "Gaming Bold" pairing; close to the card's chrome lettering |
| Body | **Chakra Petch** 400–700 | Techy but very legible at 14–16 px |
| Background / sidebar / panels | `#101018` / `#171321` / `#22162B` | Brand spec |
| Accents | Orange `#FF6B00`, pink `#FF2E8B`, purple `#8B3DFF`, gold `#FFD447` | Brand spec |
| Text | `#FFFFFF` / `#B9AFC2` | ≥ 9:1 on the background |
| Primary button | Gradient `#D24A00 → #C8186A` + neon orange/pink glow | White text keeps WCAG AA (4.5:1); pure neon tones are too light behind white text |
| Reward button | Gold `#FFD447` with dark text | Distinct "reward" state, ~13:1 contrast |
| Motion | 150–300 ms transitions, one punch "pop", reward pulse — all disabled by `prefers-reduced-motion` | Feedback without slowing the cashier |
| Touch | ≥ 44 px targets, 56 px primary actions, bottom nav on phones | Mobile cashier use |
| Icons | Lucide SVG, no emoji | Skill pre-delivery checklist |
| Charts | One series per chart, 4 px rounded bar ends, 2 px gaps, hover tooltip + table view | dataviz skill rules; no colour-only identity |

## The card

* **Front** = the original artwork (`public/brand/card-front.webp`), perspective-corrected from the uploaded design.
* **Back** = the original header and palm trees (`public/brand/card-back-bg.webp`) with live HTML layers on top:
  player/code plate, three paid-hour circles (orange glow + check when punched), the gold reward circle
  (dimmed with a lock until unlocked, pulsing when available), the QR code on the far right away from the
  punch holes, and the bottom tagline banner.
* All sizes use `cqw` units, so the same component renders on screen, in the PNG export (≥ 600 dpi)
  and on the print page (85.6 × 54 mm trim + 3 mm bleed, 3 mm safe area).
* `variant="print"` renders the blank physical card (holes are punched by hand; the database stays the
  source of truth).
