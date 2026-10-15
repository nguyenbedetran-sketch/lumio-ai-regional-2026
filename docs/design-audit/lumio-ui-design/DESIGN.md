# Lumio UI DESIGN.md

> Auto-generated design system — reverse-engineered via static analysis by skillui.
> Frameworks: React 19.1.1 + Next.js 15.5.12 + CSS Modules
> Colors: 20 · Fonts: 2 · Components: 24
> Icon library: not detected · State: not detected
> Primary theme: light · Dark mode toggle: yes · Motion: expressive

---

## 1. Visual Theme & Atmosphere

This is a **light-themed** interface with a neutral, approachable feel. The light background emphasizes content clarity. Typography pairs **inherit** for display/headings with **Inter** for body text, creating clear visual hierarchy through type contrast. Spacing follows a **5px base grid** (standard density), with scale: 5, 10, 15, 20, 25, 30, 35, 40px. Motion is expressive — spring physics, layout animations, and staggered reveals are part of the visual language.

---

## 2. Color Palette & Roles

| Token | Hex | Role | Use |
|---|---|---|---|
| surface | `#f1f6f8` | surface | Card and panel backgrounds |
| lx-card | `#ffffff` | surface | Card and panel backgrounds |
| lx-card | `#122624` | surface | Card and panel backgrounds |
| text-primary | `#21322f` | text-primary | Headings and body text |
| text-muted | `#8395a2` | text-muted | Captions, placeholders, secondary info |
| border | `#373749` | border | Dividers, card borders, outlines |
| info | `#0e151b` | info | Informational highlights |
| unknown | `#f3f9e9` | unknown | Palette color |
| unknown | `#26423c` | unknown | Palette color |
| unknown | `#e8f0df` | unknown | Palette color |
| unknown | `#d3f3a9` | unknown | Palette color |
| unknown | `#a5b7c4` | unknown | Palette color |
| unknown | `#c4dfa1` | unknown | Palette color |
| unknown | `#202c41` | unknown | Palette color |
| lm-muted | `#97a9b8` | unknown | Palette color |
| unknown | `#2d3c2a` | unknown | Palette color |
| lm-muted | `#8d9e87` | unknown | Palette color |
| unknown | `#cad8df` | unknown | Palette color |
| unknown | `#3c5538` | unknown | Palette color |
| unknown | `#afc0bc` | unknown | Palette color |

### Dark Mode Token Mapping

| Variable | Light | Dark |
|---|---|---|
| `--lm-bg` | `#fff` | `#1c2826` |
| `--lm-side` | `#fff` | `#192623` |
| `--lm-soft` | `#f1f3ed` | `#26342e` |
| `--lm-text` | `#1e302f` | `#dfe8d9` |
| `--lm-muted` | `#73807b` | `#8fa28f` |
| `--lm-line` | `#e2e7de` | `#334237` |
| `--lm-accent` | `#366d61` | `#a6c489` |
| `--lm-tint` | `#ecf3e8` | `#2b3f2e` |
| `--lx-paper` | `#f5f6f0` | `#15211f` |
| `--lx-card` | `#fff` | `#1e2c27` |

### CSS Variable Tokens

```css
--lm-muted: #73807b;
--lm-accent: #366d61;
--lx-card: #fff;
```


---

## 3. Typography Rules

**Font Stack:**
- **Inter** — Heading 1, Heading 2
- **inherit** — Body, Caption

| Role | Font | Size | Weight |
|---|---|---|---|
| Heading 1 | Inter | 39px | 700 |
| Heading 2 | Inter | 25px | 700 |
| Body | inherit | clamp(20px,3vw,27px) | 400 |
| Caption | inherit | 16px | 400 |

**Typographic Rules:**
- Limit to 2 font families max per screen
- Use **Inter** for body/UI text, **inherit** for display/headings
- Maintain consistent hierarchy: no more than 3-4 font sizes per screen
- Headings use bold (600-700), body uses regular (400)
- Line height: 1.5 for body text, 1.2 for headings
- Use color and opacity for secondary hierarchy, not additional font sizes


---

## 4. Component Stylings

### Navigation (4)

**AccountConnections** — `components/lumio/account-connections.tsx`
- Variants: `google`, `facebook`
- Props: `provider`
- State: useState

**LearningView** — `components/lumio/learning-view.tsx`
- Variants: `UNAUTHENTICATED`, `read`, `chat`, `summary`, `notes`, `quiz`
- Props: `url`
- State: useState, useRef

```tsx
<section className="lm-link-workspace">
      <div className={`lm-link-hero ${video ? "is-video" : ""}`}>
        <span className="lm-link-orbit">
          {video ? <Play size={27} /> : <Globe size={27} />}
        </span>
        <div>
          <small>{video ? "YOUTUBE" : "WEB → LEARNING"}</small>
          <h3>{video ? c.youtube : c.title}</h3>
          <p>{video ? c.videoHint : c.intro}</p>
        </div>
        <div className="lm-row">
          <button
```

**PolicyShell** — `components/lumio/policy-shell.tsx`

```tsx
<div className="lm-policy-page">
      <header>
        <a className="lm-policy-brand" href="/">
          <BrandSymbol />
          <strong>
            Lumio <small>AI</small>
          </strong>
        </a>
        <a className="lm-policy-back" href="/">
          <ArrowLeft size={16} />
          Về không gian học
        </a>
```

**RichSummary** — `components/lumio/rich-summary.tsx`
- Variants: `Enter`, `overview`, `chapters`, `video`, `map`
- Props: `frames`, `shot].slice(-3)`
- State: useState, useRef

### Data Display (2)

**Billing** — `components/lumio/billing.tsx`
- Variants: `month`, `cancel`, `resume`, `downgrade`, `speech`, `year`, `BILLING_ERROR`, `Free`
- State: useState

**Progress** — `components/lumio/progress.tsx`

```tsx
<div className="lx-page">
      <div className="lx-page-title">
        <div>
          <span className="lx-kicker">LUMIO / {c.progress}</span>
          <h1>{c.achievements}</h1>
          <p>{c.evidenceHint}</p>
        </div>
        <span className="lx-title-symbol">
          <BarChart3 size={30} />
        </span>
      </div>
      <div className="lx-metric-cards">
```

### Data Input (4)

**AddContent** — `components/lumio/add-content.tsx`
- Variants: `upload`, `link`, `paste`, `record`
- Props: `title`, `kind`, `spaceId`, `fileName`, `blob`, `text`
- State: useState

```tsx
<>
      <label className="lm-field">
        {t.move}
        <select value={space} onChange={(e
```

**App** — `components/lumio/app.tsx`
- Variants: `home`, `library`, `search`, `history`, `favorites`, `settings`, `space`, `planner`, `progress`, `review`, `focus`, `personal`, `billing`, `voice`, `dark`, `saved`, `saving`, `all`, `image`, `experience`, `light`, `3000`, `error`
- Props: `name`, `account`
- State: useState, useRef

**Planner** — `components/lumio/planner.tsx`
- Variants: `new`, `all`
- Props: `tasks`, `task]`
- State: useState

```tsx
<div className="lx-page lv-planner">
      <div className="lx-page-title">
        <div>
          <span className="lx-kicker">LUMIO / {c.planner}</span>
          <h1>{c.noPlan}</h1>
          <p>{c.planHint}</p>
        </div>
        <button
          className="lm-button primary"
          disabled={state.tasks.length >= 2000}
          onClick={(
```

**StudyTools** — `components/lumio/study-tools.tsx`
- Props: `cards`
- State: useState

```tsx
<div className="lm-study">
      <div className="lm-section-head">
        <h3>
          {t.cards} <span>{item.cards.length}</span>
        </h3>
        <button className="lm-button" onClick={(
```

### Overlay (2)

**CommandMenu** — `components/lumio/command-menu.tsx`
- Props: `locale`, `items`, `spaces`, `navigation`, `onNavigate`, `view`, `spaceId`, `onOpenItem` (+3 more)
- State: useState, useRef

**Dialog** — `components/lumio/dialog.tsx`
- State: useRef

### Other (12)

**AiPanel** — `components/lumio/ai-panel.tsx`
- Variants: `chat`, `user`, `video`, `stt`, `audio`, `summary`, `assistant`, `PROVIDER_ERROR`, `tts`
- Props: `task`, `question`, `source`, `language`, `media`, `history`, `mode`, `difficulty` (+6 more)
- State: useState, useRef

**Brand** — `components/lumio/brand.tsx`

```tsx
<span className="lm-brand-symbol" aria-hidden="true">
      <img src="/brand/lumio-logo.png" alt="" draggable={false} />
    </span>
```

**Dashboard** — `components/lumio/dashboard.tsx`
- Variants: `planner`, `progress`, `review`, `focus`, `library`
- State: useState

**ExperienceV2** — `components/lumio/experience-v2.tsx`
- Variants: `accepted`, `android`, `ok`, `dismissed`, `ios`, `error`
- State: useState, useRef

**FocusTimer** — `components/lumio/focus-timer.tsx`
- Variants: `silent`
- Props: `locale`, `state`, `update`, `fn`, `old`, `alarm`
- Animation: tw-transitions: duration-selector
- State: useState, useRef

```tsx
<section className="lx-focus-page" aria-busy="true">
        <Sparkles size={24} aria-hidden="true" />
        <h1>{learningCopy[props.locale].focusTitle}</h1>
        <p role="status">{loading[props.locale]}</p>
      </section>
```

**MathText** — `components/lumio/math-text.tsx`

```tsx
<span
      key={key}
      className={`lm-math ${display ? "lm-math--display" : "lm-math--inline"}`}
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(part.slice(2, -2
```

**MobileConnect** — `components/lumio/mobile-connect.tsx`
- Variants: `ERROR`
- Props: `id`
- State: useState

**Recommendations** — `components/lumio/recommendations.tsx`
- Variants: `baseline`, `content`, `logistic`, `neural`
- Props: `enabled`

```tsx
<section className="lm-personal">
      <div className="lm-personal-hero">
        <div>
          <span className="lm-overline">LUMIO / {c.nav}</span>
          <h1>{c.title}</h1>
          <p>{c.intro}</p>
        </div>
        <span className="lm-personal-orbit">
          <BrainCircuit size={44} />
        </span>
      </div>
      <div className="lm-personal-controls">
```

*...and 4 more other components.*



---

## 5. Layout Principles

- **Base spacing unit:** 5px
- **Spacing scale:** 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60
- **Border radius:** 0 22px 22px 0, 0 10px 10px 0, 0 7px 7px 0, 0 18px 18px 0, 2px, 3px, 4px, 5px, 6px, 6px 6px 0 0, 7px, 8px, 9px, 10px, 11px, 12px, 13px, 14px, 15px, 16px, 17px, 18px, 19px, 20px, 21px, 22px, 23px, 24px, 25px, 26px, 27px, 28px, 32px, 35%, 36px, 40px, 45%, 50px
- **Max content width:** 1050px

**Spacing as Meaning:**
| Spacing | Use |
|---|---|
| 2.5-5px | Tight: related items within a group |
| 10px | Medium: between groups |
| 15-20px | Wide: between sections |
| 30px+ | Vast: major section breaks |


---

## 6. Depth & Elevation

### Flat — subtle depth hints

- `inset 0 0 0 1px #84e4c70f`
- `inset 0 0 0 1px var(--lm-accent)`
- `0 0 0 1px #b8adda`

### Raised — cards, buttons, interactive elements

- `0 0 0 4px #8af1d514`
- `0 0 0 4px #b8d68918`
- `0 0 0 4px #70997612`

### Floating — dropdowns, popovers, modals

- `0 7px 18px #11252030`
- `0 8px 18px #6e835511`
- `0 11px 0-6px var(--lx-paper),0 12px 0-6px #d9e3ce`

### Overlay — full-screen overlays, top-level dialogs

- `0 0 30px #78e0c311`
- `0 30px 100px #0009`
- `0 0 100px #85ebce0a,inset 0 0 100px #85ebce08`

### Z-Index Scale

`30, 40, 50, 60, 100, 120, 1000`



---

## 7. Animation & Motion

This project uses **expressive motion**. Animations are an integral part of the experience.

### CSS Animations

- `@keyframes ad-enter`
- `@keyframes ad-spin`
- `@keyframes lm-rotate`
- `@keyframes lx-rise`
- `@keyframes lx-arrive`
- `@keyframes lx-note-one`
- `@keyframes lx-note-two`
- `@keyframes lx-answer`

### Animated Components

- **FocusTimer**: tw-transitions: duration-selector

### Motion Guidelines

- Duration: 150-300ms for micro-interactions, 300-500ms for page transitions
- Easing: `ease-out` for enters, `ease-in` for exits
- Always respect `prefers-reduced-motion`


---

## 8. Do's and Don'ts

### Do's

- Pair **Inter** (body) with **inherit** (display) — these are the only allowed fonts
- Follow the **5px** spacing grid for all margins, padding, and gaps
- Use the defined shadow tokens for elevation — see Section 6
- Use border-radius from the scale: 0 22px 22px 0, 0 10px 10px 0, 0 7px 7px 0, 0 18px 18px 0, 2px
- Reuse existing components from Section 4 before creating new ones
- Always use CSS variables for colors — never hardcode hex
- Test both light and dark modes for contrast

### Don'ts

- Don't introduce colors outside this palette — extend the design tokens first
- Don't introduce additional font families beyond Inter and inherit
- Don't use arbitrary spacing values — stick to multiples of 5px
- Don't create custom box-shadow values outside the system tokens
- Don't use arbitrary border-radius values — pick from the defined scale
- Don't duplicate component patterns — check Section 4 first
- Don't use backdrop-blur or blur effects

### Anti-Patterns (detected from codebase)

- No blur or backdrop-blur effects
- No zebra striping on tables/lists


---

## 9. Responsive Behavior

| Name | Value | Source |
|---|---|---|
| breakpoint-701px | 701px | css |
| breakpoint-1500px | 1500px | css |
| breakpoint-1550px | 1550px | css |
| breakpoint-1600px | 1600px | css |

**Approach:** Use `@media (min-width: ...)` queries matching the breakpoints above.


---

## 10. Agent Prompt Guide

Use these as starting points when building new UI:

### Build a Card

```
Background: #f1f6f8
Border: 1px solid #373749
Radius: 16px
Padding: 20px
Font: Inter
Use shadow tokens from Section 6.
```

### Build a Button

```
Primary: bg var(--accent), text white
Ghost: bg transparent, border #373749
Padding: 10px 20px
Radius: 16px
Hover: opacity 0.9 or lighter shade
Focus: ring with var(--accent)
```

### Build a Page Layout

```
Background: var(--background)
Max-width: 1050px, centered
Grid: 5px base
Responsive: mobile-first, breakpoints from Section 9
```

### Build a Stats Card

```
Surface: #f1f6f8
Label: #8395a2 (muted, 12px, uppercase)
Value: #21322f (primary, 24-32px, bold)
Status: use success/warning/danger from Section 2
```

### Build a Form

```
Input bg: var(--background)
Input border: 1px solid #373749
Focus: border-color var(--accent)
Label: #8395a2 12px
Spacing: 20px between fields
Radius: 16px
```

### General Component

```
1. Read DESIGN.md Sections 2-6 for tokens
2. Colors: only from palette
3. Font: Inter, type scale from Section 3
4. Spacing: 5px grid
5. Components: match patterns from Section 4
6. Elevation: shadow tokens
```
