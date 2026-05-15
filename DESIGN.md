# Design System

This project follows the Rautaki brand system: editorial authority, refined restraint, and strategy-consultancy clarity. The interface should feel like a calm advisory workspace: precise, spacious, deliberate, and easy to work inside for long planning sessions.

The product reads as a **dossier**, not a dashboard. Sections are numbered like a printed memorandum. The gold rule, used sparingly, is the only ornament.

---

## Stack

- **Framework:** Next.js App Router + React + TypeScript
- **Styling:** Tailwind CSS v4 via `@theme inline` in `app/globals.css`
- **Components:** shadcn-style primitives in `components/ui`
- **Icons:** Lucide React
- **Fonts:** DM Sans for UI/body, Georgia for display headings, italic numerals, and the Rautaki wordmark
- **Theme:** Light-first Rautaki workspace with Obsidian used for the primary strategy panel
- **Utilities:** `cn()` from `@/lib/utils`

---

## Brand Positioning

Rautaki means strategy. The brand position is:

**Strategy · Advisory · Growth**

Design decisions must reinforce clarity, decisiveness, and weight. The product should not feel like a busy dashboard. It should feel like a premium consultant's desk: quiet paper, sharp rules, confident typography, and one clear action at a time.

---

## Design Direction

The application uses a **quiet editorial workspace** aesthetic.

- Cream is the page canvas. No background grid — a single full-width gold hairline threads the top of the page.
- One large Obsidian panel hosts the primary idea input and generation action.
- White cards host generated/editable work surfaces. Cards rest on the page; they do not levitate.
- Warm Grey is used for nested editable rows and grouped form areas.
- Generous spacing separates the masthead, the hero, the work area, and each section.
- Gold is rare: the top rule, the primary CTA, two letters of the wordmark, the P1 priority chip, the pull-quote left-rule, and relationship edges in the graph. One gold accent per visual unit.
- Avoid decorative glow, heavy gradients, noisy backgrounds, dense panels, and high-contrast clutter.

---

## Editorial Section Threading

Every primary section in the editable work area is anchored by **three signals** that thread continuously down the page:

1. A Georgia italic Roman numeral (`I.`, `II.`, `III.`, ...) in Mid Grey — the dossier signature.
2. A 28px Gold hairline followed by a single uppercase anchor word (`Brief`, `Stories`, `Surface`, `Model`, `Cadence`, `Watchouts`, `Hand-off`).
3. A Georgia regular section title at `text-2xl`.

The numerals continue uninterrupted through the page — the entity map card on the left uses `IV.` to match the right-column Data Model section it visualises. Numerals are intentionally subtle; they create rhythm without shouting.

---

## Language

All product UI copy must be English. This app is a tutorial/product tool, not a Swiss-market document template.

Allowed brand terms:

- Rautaki
- Strategy · Advisory · Growth
- AI SDK
- React Flow
- Coding Agent

Do not introduce German labels, placeholders, descriptions, alerts, or empty states.

---

## Palette

Only these colours are approved:

| Name       | Hex       | Role                                                                                                |
| ---------- | --------- | --------------------------------------------------------------------------------------------------- |
| Gold       | `#F5A623` | Rare brand accent: primary CTA, top rule, logo accent, pull-quote rule, P1 chip, relationship edges |
| Gold Light | `#FFD07A` | Hover/tint only                                                                                     |
| Obsidian   | `#0A0A0A` | Hero/input strategy panel, P2 chip background                                                       |
| Ink        | `#1C1C1C` | Primary text on light surfaces                                                                      |
| Cream      | `#F4F2EE` | Page canvas, memo graph surface, ID-chip background                                                 |
| White      | `#FAFAFA` | Cards and form surfaces                                                                             |
| Warm Grey  | `#E8E5DF` | Nested rows, secondary surfaces, P3+ chip background                                                |
| Mid Grey   | `#9A9590` | Captions, metadata, labels, numerals                                                                |

Approved pairings:

| Background | Text                           | Accent |
| ---------- | ------------------------------ | ------ |
| Obsidian   | White                          | Gold   |
| White      | Ink                            | Gold   |
| Cream      | Ink                            | Gold   |
| Warm Grey  | Ink                            | Gold   |
| Gold       | Obsidian at `rgba(0,0,0,0.72)` | None   |

Gold is rare. Use one gold element per visual unit. For the hero panel, Gold is reserved for the primary CTA; therefore the hero heading stays White rather than using gold italic emphasis.

---

## Typography

| Token                   | Font         | Usage                                            |
| ----------------------- | ------------ | ------------------------------------------------ |
| `--font-body`           | DM Sans      | Body text, labels, controls, captions            |
| `--font-display-family` | Georgia      | Headings, logo, italic numerals, display moments |
| `--font-mono`           | ui-monospace | Functional requirement and success criterion IDs |

Rules:

- Georgia is regular weight only. Never use bold Georgia.
- DM Sans uses weights `300`, `400`, and `500` only.
- Hero headings use Georgia at `text-5xl` to `text-7xl`, `letter-spacing: -0.04em`, and line-height near `1.0`.
- Section titles use Georgia regular, `text-2xl`, and `letter-spacing: -0.02em`.
- Numerals (`I.`, `II.`, ...) use Georgia italic at `0.875rem` in Mid Grey.
- Labels use DM Sans 500, uppercase, `0.20em` to `0.22em` letter-spacing, Mid Grey.
- Pull-quotes use Georgia italic at `0.9375rem`, leading `1.7`, sitting against a 2px Gold left rule.
- IDs (`FR-001`, `SC-001`) use a monospace pill with `0.6875rem` text on a Cream background.
- Body copy uses relaxed leading (`leading-7` or `leading-8`) for comfort.

---

## Logo

Use the Rautaki wordmark in Georgia Regular. Only the fifth letter `a` and seventh letter `i` are Gold.

```tsx
Raut<span className="accent-letter">a</span>k<span className="accent-letter">i</span>
```

The app masthead uses the logo at `36px` with the tagline nearby. Do not alter which letters are gold.

---

## Tokens

All semantic tokens live in `app/globals.css` and are bridged to Tailwind with `@theme inline`.

| Token              | Value                      | Usage                              |
| ------------------ | -------------------------- | ---------------------------------- |
| `background`       | `#F4F2EE`                  | Page canvas                        |
| `foreground`       | `#1C1C1C`                  | Page text                          |
| `card`             | `#FAFAFA`                  | Cards and editable surfaces        |
| `card-foreground`  | `#1C1C1C`                  | Card text                          |
| `primary`          | `#F5A623`                  | Primary CTA only                   |
| `secondary`        | `#E8E5DF`                  | Nested rows and secondary surfaces |
| `muted-foreground` | `#9A9590`                  | Captions and support text          |
| `border`           | `rgba(28,28,28,0.08-0.10)` | Hair rules and cards               |
| `ring`             | `#F5A623`                  | Focus state                        |

---

## Core Utilities

Defined in `app/globals.css`:

| Class                          | Purpose                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `.planner-bg`                  | Cream page shell with a single Gold hairline at the top. No background grid.                                            |
| `.masthead`                    | Quiet Rautaki header with a hairline separator.                                                                         |
| `.hero-panel`                  | Obsidian strategy panel for input and generation. Deep contact-shadow.                                                  |
| `.paper-card`                  | White advisory card surface. Hairline border + near-invisible drop. Cards rest, they do not levitate.                   |
| `.section-card`                | Spacious generated/editable section card (used together with `.paper-card`).                                            |
| `.form-surface`                | White form surface inside the Obsidian hero panel.                                                                      |
| `.memo-surface`                | Cream graph and empty-state surface, 32px subdivision grid.                                                             |
| `.command-strip`               | Gold primary CTA treatment. Hover lightens to Gold Light.                                                               |
| `.micro-label`                 | Rautaki uppercase label style (no rule).                                                                                |
| `.section-anchor`              | Uppercase anchor word preceded by a 28px Gold hairline. Used at the top of every numbered section.                      |
| `.numeral-eyebrow`             | Georgia italic Roman numeral (`I.`, `II.`, ...) in Mid Grey.                                                            |
| `.priority-chip`               | Pill carrying P1–P5 meaning via colour. P1 = Gold, P2 = Ink/Obsidian, P3+ = Warm Grey. Drive with `data-priority="P1"`. |
| `.id-chip`                     | Monospace pill for `FR-###`, `SC-###`, route paths, entity ids.                                                         |
| `.pull-quote`                  | Georgia italic with a 2px Gold left rule. Used for editorial moments like "Why this priority".                          |
| `.hairline` / `.hairline-gold` | 1px dividers in Ink-at-8% or Gold-fade-to-transparent.                                                                  |
| `.dossier-empty`               | The closed-dossier empty state surface.                                                                                 |
| `.rautaki-logo`                | Georgia wordmark with correct Gold letters.                                                                             |

---

## Components

### Cards

Cards are sharp, editorial, and memo-like. Structural elements must have zero radius.

```tsx
<Card className="paper-card section-card">
```

Generated/editable cards have generous internal padding (`px-8`, `pb-8`) and `gap-10` between major sections in the work column. Nested rows use `bg-muted`, a hairline border, and `p-4`.

### Section Headers

Every section card uses the `numeral` + `anchor` pattern via `BriefSectionCard`:

```tsx
<BriefSectionCard
  numeral="II"
  anchor="Stories"
  title="Feature Specifications"
  description="..."
>
```

This produces, top-to-bottom: italic numeral · gold-ruled anchor · Georgia title · DM Sans description.

### Feature Specifications

The Feature Specifications section is a stacked dossier. Each feature is one `<article>` containing:

1. **Header row** — numeral (`I.`), priority chip (`P1` Gold / `P2` Ink / `P3+` Warm Grey), `User Story` micro-label, and an editable feature name as a Georgia 2xl title sitting on a hairline.
2. **Two-column body** — User Journey (DM Sans on Warm Grey) on the left, **Why This Priority** as a Gold-rule pull-quote on the right.
3. **Independent Test** — single textarea anchored only by its micro-label.
4. **Acceptance Scenarios** — numbered I-II-III in Georgia italic; each row is `Given … When … Then …`.
5. **Edge Cases** — one-per-line textarea.
6. **Functional Requirements** — list of monospace `FR-###` ID chips paired with MUST-language statements.
7. **Success Criteria** — list of monospace `SC-###` ID chips paired with measurable, technology-agnostic outcomes.
8. **Assumptions** — one-per-line textarea.

The priority chip carries semantic colour; everything else stays inside the standard palette.

### Buttons

Primary generation and copy buttons use `.command-strip`, no radius, DM Sans 500, no decorative lift. Hover transitions to Gold Light. Secondary actions use outline or ghost variants.

### Inputs

Inputs and textareas are rectangular. Use White or Warm Grey backgrounds, Ink text, and Gold focus rings. Textareas should be tall enough to avoid cramped editing.

### Badges & Chips

Three distinct chip families, each with a single job:

- **Metadata badges** — outline + `micro-label`. For the top of the masthead and the model identifier in the hero.
- **Priority chips** (`.priority-chip[data-priority="..."]`) — only on user stories. P1 Gold, P2 Ink, P3+ Warm Grey.
- **ID chips** (`.id-chip`) — monospace. For `FR-###`, `SC-###`, route paths, entity ids.

Do not mix these treatments.

### Graphs

Graph containers use `.memo-surface`. React Flow nodes are sharp White mini-cards with Ink text. Relationship edges use Gold as the single graph accent. Avoid minimaps and decorative graph chrome. Always include a text representation of relationships below the graph.

### Empty State

The pre-generation empty state is a `.dossier-empty` panel — a closed-paper surface with a `Brief pending` anchor, a `№ 001` numeral, a two-line Georgia headline, a short instruction in body copy, and a short Gold hairline at the bottom-left. Quiet, not loud.

---

## Layout

Use a wide but calm advisory workspace:

```tsx
<main className="planner-bg min-h-screen flex-1 overflow-hidden">
  <div className="container mx-auto max-w-[1420px] px-5 py-12 lg:px-10 lg:py-16">
```

Page rhythm:

1. Masthead with Rautaki logo and restrained metadata badges.
2. Full-width Obsidian hero/input panel.
3. Spacious two-column work area after generation: data model graph on the left, numbered dossier sections on the right.
4. Single-column mobile flow with generous spacing and no sticky behaviour.

Desktop work grid:

```tsx
grid gap-10 lg:grid-cols-[minmax(320px,0.72fr)_minmax(0,1.28fr)]
```

Vertical gap between numbered sections is `gap-10` to give each memorandum room to breathe.

---

## Accessibility

- Preserve visible Gold focus rings on all interactive controls.
- Keep Obsidian/White and White/Ink contrast high.
- Provide text representations for graphs and generated relationships.
- Priority chips also carry their text label (`P1`, `P2`, ...) so colour alone is never the signal.
- Controls must remain usable on mobile, especially add/remove/edit actions.
