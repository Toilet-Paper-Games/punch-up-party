---
name: Punch Up!
description: A comedy writers' room rendered as a marked-up screenplay under deadline.
colors:
  production-ink: "#17140f"
  script-paper: "#f4e8cf"
  clean-paper: "#fff9e9"
  revision-blue: "#0057d8"
  revision-blue-deep: "#003f9e"
  cut-red: "#d73125"
  status-red: "#a9231a"
  direction-muted: "#625b4e"
  matte-tape: "#d7c29c"
  focus-blue: "#78a9ff"
typography:
  display:
    fontFamily: "Anton, sans-serif"
    fontSize: "clamp(2.7rem, 5.4vw, 5.2rem)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "-0.025em"
  script:
    fontFamily: "Courier Prime, monospace"
    fontSize: "clamp(0.95rem, 1.35vw, 1.2rem)"
    fontWeight: 700
    lineHeight: 1.5
  production-label:
    fontFamily: "Barlow Condensed, Arial, sans-serif"
    fontSize: "clamp(0.62rem, 0.85vw, 0.82rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  sharp: "0"
  page: "2px"
  soft: "14px"
  round: "999px"
spacing:
  compact: "0.5rem"
  standard: "1rem"
  section: "1.5rem"
  scene: "clamp(1rem, 2.4vw, 2.5rem)"
components:
  button-primary:
    backgroundColor: "{colors.revision-blue}"
    textColor: "#ffffff"
    typography: "{typography.production-label}"
    rounded: "{rounded.sharp}"
    padding: "0.9rem 1rem"
    height: "3.25rem"
  vote-option:
    backgroundColor: "{colors.clean-paper}"
    textColor: "{colors.production-ink}"
    typography: "{typography.script}"
    rounded: "{rounded.sharp}"
    padding: "0.9rem"
    height: "6rem"
  text-field:
    backgroundColor: "{colors.clean-paper}"
    textColor: "{colors.production-ink}"
    typography: "{typography.script}"
    rounded: "{rounded.sharp}"
    padding: "0.9rem"
    height: "7rem"
  script-page:
    backgroundColor: "{colors.script-paper}"
    textColor: "{colors.production-ink}"
    rounded: "{rounded.page}"
    padding: "{spacing.scene}"
---

# Design System: Punch Up!

## Overview

**Creative North Star: "The Screenplay Under Deadline"**

Punch Up! feels like a comedy writers' room caught at the decisive revision pass: warm screenplay stock, dense production ink, electric-blue pencil marks, dry red stamps, matte tape, and hard offset depth. Direction seed `372a3c1b` anchors this world. It is confident, tactile, slightly unruly, and unmistakably about writing; it rejects neon-club scenery, microphones, glass effects, gradients, and generic rounded-card dashboards.

The visual hierarchy follows the room. The host is an across-the-room, passive broadcast dominated by one oversized script page and its current story beat. Controllers are close-reading revision sheets with the current task, timer, and one unmistakable action. Spectators mirror the passive host composition and label themselves as an audience feed. Gameplay controls must never appear on host or spectator surfaces.

**Key Characteristics:**

- Tactile print-production materials with crisp digital legibility.
- One dominant task or reveal per viewport, supported by production-note hierarchy.
- Electric blue for revision and action; red for cuts, stamps, and exceptional status.
- Hard, ink-like offset shadows instead of soft ambient elevation.
- Deterministic layouts that remain readable from three through eight players.

## Colors

The palette is a four-ink print system: near-black structure on warm paper, with blue revision marks and sparing red editorial intervention.

### Primary

- **Revision Blue:** The sole interactive accent for primary actions, winning answer fills, annotations, and selected emphasis.
- **Deep Revision Blue:** Small labels and underlines on pale paper where the deeper tone improves reading contrast.

### Secondary

- **Cut Red:** Result stamps, slash-like emphasis, and screenplay margin marks; use as an editorial signal, not a general decoration.
- **Status Red:** Controller recovery and error banners, always paired with white text and a clear status message.

### Neutral

- **Production Ink:** The room background, text, borders, and hard shadows.
- **Script Paper:** The textured primary surface for pages and score panels.
- **Clean Paper:** Answer slips, timers, and input fields that need a quieter reading field.
- **Direction Muted:** Secondary instructions and character-count notes.
- **Matte Tape:** Translucent tape strips attached to answer slips.

**The Four-Ink Rule.** Treat paper, ink, revision blue, and cut red as physical inks. Do not introduce gradients or decorative rainbow accents.

**The Red Means Intervention Rule.** Reserve red for stamps, cuts, and actionable status; routine interaction remains blue.

## Typography

**Display Font:** Anton (bundled locally with a sans-serif fallback)  
**Script Font:** Courier Prime (bundled locally with a monospace fallback)  
**Production Label Font:** Barlow Condensed (bundled locally with Arial and sans-serif fallbacks)

**Character:** Anton delivers blunt title-card impact. Courier Prime makes prompts, answers, directions, timers, and scores read as authored script material. Barlow Condensed handles compact production metadata without competing with the joke.

### Hierarchy

- **Display:** Uppercase Anton with tight leading and slight negative tracking. Use for scene titles, score-panel headings, answer letters, versus marks, waiting marks, and result stamps. Host titles scale for distance; controller titles scale for narrow screens.
- **Script:** Bold Courier Prime at comfortable line height. Use for prompts, punchlines, parenthetical direction, timers, score rows, field labels, and status copy.
- **Production label:** Bold uppercase Barlow Condensed with wide tracking. Use for billing lines, compact metadata, player identity, and non-narrative controls.
- **Dense-content adaptation:** Reduce host display and script sizes only when the renderer identifies many answers or legally long content. Preserve the ordinary finale answer floor at 15px and keep all answer text legible inside the 16:9 stage.

**The Joke Gets the Script Face Rule.** Punchlines and prompts use Courier Prime; Anton announces the beat but never typesets the joke itself.

**The Room-Distance Rule.** Host hierarchy must survive across-the-room viewing. Small production labels may compress; the active prompt, answer, timer, and winner may not disappear into metadata.

## Layout

The host is a full-viewport two-column stage: the flexible script page owns most of the width while a narrow top-billing panel sits at the edge. The page uses a header/body/billing-line grid, a red screenplay margin rule, and responsive padding. Ordinary duels place two answer slips around a red `VS`; multi-answer finales remove `VS` and use a dense two-column answer grid.

Controllers use a three-row mobile stage with a sticky identity-and-timer header, a centered revision page no wider than 36rem, and sound settings in the final row. Safe-area insets are part of the padding. The recovery/status banner appears before the task heading so reconnect information is visible without scrolling. Writing controls remain in document flow; the second prompt and submit target may scroll while the sticky deadline stays visible.

At 760px and below, host surfaces become a single-column scroll layout, answers stack, and the score panel follows the script. At 380px and below, controller gutters and timer dimensions tighten without reducing tap-target clarity. Dense finale and long-copy modifiers compact headings, gaps, answer padding, and type together; they are content-aware states, not a blanket small-screen style.

**The Passive Stage Rule.** The host and spectator layouts contain no buttons, links, inputs, or focusable controls. All decisions and text entry belong to controllers.

**The One Beat Rule.** The active writing prompt, vote, or reveal dominates the script page. Score and production metadata support it at the edge.

## Elevation & Depth

Depth is structural and print-like. Pages, answer slips, controls, and score panels sit on hard, unblurred offset shadows in production ink or revision blue. The result is a stack of physical paper layers, not a floating glass interface. Hoverable controller controls move two pixels up-left as their hard shadow grows; pressed controls scale down slightly. Disabled controls collapse to a shorter shadow and lower opacity.

### Shadow Vocabulary

- **Primary page:** A ten-pixel ink offset anchors the main script to the dark production board.
- **Panel and slip:** Seven-pixel offsets distinguish score panels, controller pages, and ordinary answer slips.
- **Compact and control:** Four- to five-pixel offsets ground timers, dense finale slips, inputs, and buttons.

**The Hard-Shadow Rule.** Shadows have zero blur and a visible print offset. Do not substitute diffuse elevation, glow, transparency, or glassmorphism.

## Shapes

The system is predominantly square and cut by hand. Inputs and controls have sharp corners and thick ink borders. Script pages use an almost imperceptible page corner, while answer slips use an irregular clipped polygon to suggest torn revisions. Tape strips are rectangular and slightly rotated. Timers and waiting marks are the only persistent circles; stamps rotate as dry production marks rather than badges.

**The Paper-Not-Pills Rule.** Do not turn actions, statuses, or metadata into pill-shaped UI. Rounded geometry is reserved for clocks and literal marks.

## Components

### Script Page

- **Character:** The primary theatrical surface on every role: warm textured paper, red margin rule, and hard ink offset.
- **Host:** Fills the stage, exposes the current phase, and remains passive.
- **Controller:** Narrows to a close-reading sheet, contains the current task, and may carry a status banner before its title.
- **Spectator:** Mirrors host content and swaps the billing label to “Audience feed.”

### Timer

- **Style:** Circular clean-paper face, three-pixel ink border, blue hard offset, Courier Prime tabular numerals.
- **Behavior:** Counts down from authoritative phase time and includes a spoken “seconds remaining” label. It never becomes an input.

### Answer Slips

- **Style:** Torn-paper silhouette, taped top edge, Courier Prime punchline, and Anton letter marker.
- **Voting:** Anonymous on shared surfaces; two-answer duels are separated by the red `VS`, while finales use letters A–H in two columns.
- **Results:** The winner fills with revision blue and reveals author and points in a ruled footer. A red result stamp marks the scene.

### Buttons

- **Shape:** Sharp corners, three-pixel ink border, at least 3.25rem high, and a hard five-pixel shadow.
- **Primary:** Revision-blue fill with white uppercase production-label text.
- **Vote option:** Clean-paper fill with a blue Anton letter and script-face punchline; minimum height is 6rem.
- **Hover / active:** Hover shifts up-left and increases shadow; active scales to 96%.
- **Busy / disabled:** Preserve label context, use sending language where appropriate, set `aria-busy`, disable repeated input, lower opacity, and shorten the shadow. Never imply success until the canonical state confirms the action.

### Inputs

- **Style:** Clean paper, sharp corners, three-pixel ink border, Courier Prime text, and an ink hard shadow. Textareas may resize vertically and display the 120-character constraint.
- **Focus:** Every button and textarea receives a three-pixel light-blue `:focus-visible` outline with a four-pixel offset.
- **Status:** Recovery or action issues appear in a high-contrast status banner before the title and use an announced status role.

### Scoreboard

- **Style:** Ranked Courier Prime rows separated by ink rules, with tabular scores and ellipsized long names.
- **State:** The winner row becomes a slightly rotated blue revision strip; disconnected players remain present at reduced opacity.

### Motion and System Adaptation

- The result stamp lands once with a short 320ms scale-and-opacity motion. Controller state changes use 120ms direct transitions.
- Under reduced-motion preferences, stamp animation is removed and control transitions collapse to 1ms.
- Under forced colors, paper surfaces, answer slips, inputs, and interactive controls gain system-text borders and lose decorative shadows so structure remains perceivable.

## Do's and Don'ts

### Do:

- **Do** preserve the host-authoritative role hierarchy: passive host and spectator, interactive controller.
- **Do** use the bundled font files so typography is deterministic and does not depend on network fonts.
- **Do** keep prompts, legal 120-character answers, timers, scoreboard rows, and status messages inside their tested containers.
- **Do** use the generated seamless paper texture only as a subtle repeated surface behind readable content.
- **Do** use the generated catalog artwork for the game tile and favicon; keep its title silhouette readable at thumbnail scale.
- **Do** verify changed states in `surfaces/scenarios.html` at host 16:9, spectator 16:9, and controller 360×780. Include ordinary phases, reconnect, eight-answer finale voting/results, and legal long-copy stress cases.
- **Do** finish with the deterministic visual stress suite: it checks eight-answer containment, 15px minimum ordinary-finale punchlines, long-copy containment, visible reconnect status, sticky controller deadline, 44px-or-taller submit target, and zero horizontal overflow.

### Don't:

- **Don't** add gameplay interaction or focusable elements to the host or spectator surfaces.
- **Don't** replace the screenplay world with neon-club clichés, microphones, spotlights, generic rounded cards, or app-store device chrome.
- **Don't** add gradients, soft shadows, glow, glass, or decorative colors outside the four-ink logic.
- **Don't** use red as a routine button color or blue as ambient decoration; each ink has an editorial job.
- **Don't** hide reconnect, error, busy, disabled, focus, reduced-motion, or forced-colors states during implementation review.
- **Don't** sign off on a visual change from a single happy-path screenshot; use the deterministic gallery and browser containment checks.
