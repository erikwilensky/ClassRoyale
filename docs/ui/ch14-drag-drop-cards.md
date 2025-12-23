## Chapter 14 – Clash-Style Drag & Drop Card Casting (Student UI) – Interaction Spec

This document defines the **client-side interaction layer** for Clash Royale–style drag-and-drop card casting in the **Student** gameplay UI.

- **Scope**: Student UI only (card casting interaction).
- **Non-goals**: No changes to scoring, XP, match lifecycle, server validation rules, or persistence. No new card effects.
- **Architecture alignment**: Built on top of Chapter 12.5:
  - Student page uses `useQuizRoomState` for state.
  - Capabilities/can-cast logic derived via existing view models (e.g. `deriveStudentCapabilities`).
  - Drag logic lives in small, reusable UI helpers/hooks, **not** inside `Student.jsx` directly.

---

## 1. Drag Start Conditions

A card is **eligible to start a drag** only if **all** of the following are true; otherwise, drag does not start, and any feedback remains as in current UI (disabled styles/tooltips):

1. **Player capabilities**
   - `capabilities.canCastCards === true`
   - The round is in an active/castable state (from view model / capabilities, not raw enums).
   - The player is not blocked by moderation:
     - Not muted.
     - Their team is not frozen.
     - Round is not frozen.
   - These conditions are surfaced via existing **student capabilities** view model (no direct state peeks inside drag hook).

2. **Card ownership + availability**
   - Card is **owned/unlocked** for this player:
     - Student has this card in their `unlockedCards` list (or equivalent ownership structure).
   - Card is **not disabled** by match card rules:
     - Card ID is **not** in `disabledCards`.
   - Card is not in any temporary “cooldown”/blocked state (if such UI state exists; otherwise ignored).

3. **Gold + cost rules**
   - For **standard** cards:
     - Compute **effective gold cost** using `getEffectiveGoldCost` (see Section 3.3), which wraps `applyGoldCostModifier` and enforces minimum cost 1.
     - Student’s team gold (`teamGold[myTeamId]`) is **>= effective cost**.
   - For **cosmetic** cards:
     - Effective cost is always 0; no gold requirement.
   - Gold checks are **purely client-side pre-checks** to avoid “obviously invalid” casts; the server still re-validates.

4. **Match + round state**
   - Match is **not over** (no active match-over overlay requiring reset).
   - Round is in a state where casting is allowed as defined by capabilities (e.g., typically `ROUND_ACTIVE`).
   - If the round transitions to a non-castable state (e.g., `ROUND_REVIEW`) during a drag, the drag is cancelled (see edge cases).

5. **Technical constraints**
   - Drag is initiated via **pointer events**, not the HTML5 drag-and-drop API.
   - Supported inputs:
     - Mouse: `pointerdown`, `pointermove`, `pointerup`.
     - Touch: `pointerdown` (finger), `pointermove` (finger move), `pointerup` (finger lift).
   - No drag start is allowed if the card is currently visually disabled or the component is not mounted.

If any of these conditions fail at **drag start**, `beginDrag` is **not** called and the card behaves as a normal non-draggable/disabled UI element.

---

## 2. Target Rules

The drag system treats team panels as **drop targets**. Valid targets depend on the **card’s targeting rules** defined by its config (`card.target`):

### 2.1 Target Types

- `target: "self"`
  - **Valid target(s)**: Only the **student’s own team** (`myTeamId`).
  - Valid drop targets = `[myTeamId]`.
  - No other teams are considered valid, even if visible.

- `target: "opponent"`
  - **Valid target(s)**: All **other** teams except `myTeamId`.
  - Valid drop targets = `allTeamIds.filter(id => id !== myTeamId)`.
  - If there are no opponents (single team only), this card effectively has no valid targets and:
    - Drag **can still start** if other conditions are satisfied.
    - But there will be **no valid drop zone highlights**, and all drops are treated as invalid (snapback, no cast).

### 2.2 Valid & Invalid Targets During Drag

- **Valid target**:
  - The team’s `teamId` is in `validTargetTeamIds` computed by `getValidDropTargets`.
  - Team panel shows a **subtle but clear highlight**, e.g.:
    - Slight glow/border around the card area.
    - Slight background tint.

- **Invalid target**:
  - Any team panel not in `validTargetTeamIds`.
  - Background targets (e.g., empty space, UI chrome) are **never** valid.

The drag hook will maintain:

- `validTargetTeamIds: string[]`
- `hoveredTargetTeamId: string | null`

Student UI will use these to drive visual highlighting.

---

## 3. Visual Feedback & Highlights

### 3.1 Valid Target Highlight

When **dragging**:

- Any team panel whose `teamId` is in `validTargetTeamIds`:
  - Shows a **subtle but clear highlight** indicating “you can drop a card here”.

### 3.2 Hovered Target Highlight

When **dragging and pointer is over a valid target**:

- The `hoveredTargetTeamId` is set to that team’s ID.
- That team’s panel shows a **stronger highlight**, e.g.:
  - Thicker or brighter border.
  - Slight scale-up / stronger background highlight.
- The drag ghost can also reflect “valid drop here” (e.g., neutral/green border).

### 3.3 Invalid Target Indication

When dragging over an invalid area:

- Non-valid teams show **no highlight** or a subtle “inactive” styling.
- The drag ghost:
  - May show a **“nope” state**, e.g.,:
    - Slight red tint.
    - “Not allowed” badge icon.

No modal or error message is shown on invalid areas; invalidity is communicated via highlights and ghost styling only.

---

## 4. Drop Behavior

### 4.1 Successful Drop (Valid Target)

On pointer up when:

- `hoveredTargetTeamId` is non-null AND
- `hoveredTargetTeamId` is in `validTargetTeamIds` AND
- The drag is still considered valid (no mid-drag capability change; see Edge Cases):

**Then:**

1. `endDrag` returns:

   ```ts
   {
     didDrop: true,
     targetTeamId: hoveredTargetTeamId,
     cardId: dragCardId
   }
   ```

2. `Student.jsx`:
   - Receives the drop info.
   - Re-checks **gating** via drag rules / capabilities:
     - If still valid, calls `handleCastCard(cardId, targetTeamId)`.
     - If invalid (e.g., round ended mid-drag), silently aborts (no cast).
   - Ends drag and clears selection state.

3. UI feedback:
   - Drag ghost disappears.
   - Card hand visually “snaps back” to its normal layout.
   - Optional quick feedback (within current visual language), for example:
     - Brief outline pulse on the successfully targeted team.

The actual effect (gold deduction, server-side validation, card effect) remains **unchanged** and is controlled entirely by the server.

### 4.2 Invalid Drop

A drop is **invalid** when:

- Pointer releases over:
  - Non-team area, OR
  - A team not in `validTargetTeamIds`, OR
- Capabilities changed mid-drag and now block casting (muted/frozen/roundFrozen, match over, etc.).

**Behavior:**

1. `endDrag` returns:

   ```ts
   { didDrop: false, targetTeamId: null, cardId: dragCardId }
   ```

2. No call to `handleCastCard`.
3. Drag ghost disappears.
4. Card visually “snaps back” to its original home in CardBar.
5. No error/toast; invalid drop is a **silent fail** from a casting perspective.

---

## 5. Fallback Tap-to-Select Flow

The fallback flow supports accessibility and touch users who may find dragging difficult.

### 5.1 Selecting a Card

- Tap/click on a card (without dragging far enough to count as a drag gesture):
  - If **eligible** (same rules as drag start):
    - `selectedCardId` is set.
    - The card shows a **“selected” state**, e.g.:
      - Slight border glow.
      - Slight scale.
  - If **not eligible**:
    - No selection is set.
    - Existing disabled styles/tooltips continue to indicate why.

- Only one card can be selected at a time:
  - Tapping a different eligible card switches selection.
  - Tapping the same selected card again clears selection (toggle).

### 5.2 Casting via Tap-to-Select

With a `selectedCardId`:

1. Student taps/clicks a **team panel**:
   - If team is a **valid target** (same rules as `getValidDropTargets`):
     - Re-check gating at click time:
       - If still valid, call `handleCastCard(selectedCardId, teamId)`.
       - If now invalid (e.g., muted mid-selection), silently ignore.
     - Clear `selectedCardId`.
   - If invalid target:
     - No cast.
     - `selectedCardId` remains so the player can tap another team or re-tap the card to cancel.

2. If the round/match state changes such that casting is no longer allowed:
   - Selection is **cleared** as part of the same invalidation logic used for drags.

### 5.3 Coexistence With Dragging

- **Drag has priority**:
  - If pointer movement passes a small threshold after pointer down, treat as a drag start, not a tap.
- **Selection persists independently**:
  - A selected card can also be dragged later.
  - Completing a successful drag cast should clear `selectedCardId`.

---

## 6. Edge Cases & State Changes

### 6.1 Round Transitions

- When the round state changes (e.g., ACTIVE → REVIEW, ENDED, or WAITING):
  - Any **active drag** is immediately **cancelled**:
    - Drag ghost is removed.
    - Card returns to its original position.
  - Any **selectedCardId** is cleared if the new state disallows casting.

### 6.2 Timer Enabled/Disabled

- Timer state does **not** affect target validity directly:
  - As long as the capabilities view model says casting is allowed, drag is allowed.
  - The countdown is purely informational for this interaction.

### 6.3 Reconnects

- On reconnect:
  - `useQuizRoomState` restores state; drag state is **not persisted**.
  - Any in-progress drag or selection is naturally lost on reload or reconnect.

### 6.4 No Opponent Teams

- For `target: "opponent"` cards:
  - If there are zero opponent teams:
    - `getValidDropTargets` returns an empty array.
    - No team panel will highlight during drag.
    - Any drop is invalid (snapback; no cast).
  - Tap-to-select follows the same rules: panel taps will not trigger casts for such cards.

### 6.5 Match Over (Overlay)

- When match is over:
  - Capabilities should report **no casting allowed**.
  - Drag start and selection are both blocked by `canStartDrag`.
  - Any existing drag or selection is cleared when match-over state is entered.

### 6.6 Moderation Changes Mid-Drag

- If during a drag:
  - Player becomes muted, OR
  - Their team becomes frozen, OR
  - Round is frozen,
- Then:
  - The next state update processed by the UI will:
    - Cause the drag hook to treat the drag as invalid.
    - Automatically cancel the drag:
      - No cast.
      - Snapback, ghost cleared.
  - Any active `selectedCardId` is also cleared when capabilities say casting is no longer allowed.

### 6.7 Gold Changes Mid-Drag

- If gold changes while dragging:
  - On pointer up:
    - The Student page re-evaluates eligibility (using effective cost and current gold).
    - If no longer affordable, cast is **not attempted** and drag is treated as invalid (snapback).

---

## 7. Responsibilities & Boundaries

### 7.1 `useCardDrag` Hook

- Tracks drag state only:
  - `isDragging`, `dragCardId`, card metadata, pointer position, `validTargetTeamIds`, `hoveredTargetTeamId`, `selectedCardId`.
- Provides imperative API:
  - `beginDrag(card, pointerEvent, validTargetTeamIds)`
  - `updatePointer(pointerEvent)`
  - `endDrag(pointerEvent) → { didDrop, targetTeamId, cardId }`
  - `cancelDrag()`
  - `selectCard(cardId)`, `clearSelection()`
  - `setHoveredTargetTeamId(teamId)`
  - `isTeamValidDropTarget(teamId)`
- **Does not**:
  - Contact the server.
  - Decide whether a cast should happen.
  - Know about capabilities or card rules beyond metadata passed in.

### 7.2 `dragRules.js`

- Pure functions, no React, no side effects:
  - `canStartDrag({ card, capabilities, isOwned, isDisabled, effectiveGoldCost, teamGold, roundState, matchOver })`
  - `getValidDropTargets({ card, myTeamId, teamIds })`
  - `getEffectiveGoldCost({ card, goldCostModifiers })` (wraps `applyGoldCostModifier`)

### 7.3 `Student.jsx`

- Coordinates drag + cast:
  - Uses `useQuizRoomState` + view models to derive:
    - `capabilities`
    - `myTeamId`
    - `teamGold`
    - Card rules (`disabledCards`, `goldCostModifiers`)
    - Card ownership (`unlockedCards`)
  - On drag start or tap selection:
    - Calls `canStartDrag` with current data.
  - On drop success:
    - Verifies drop via `canStartDrag`-like checks.
    - Calls `room.send("castCard", { cardId, targetTeamId })` if allowed.

---

## 8. Non-Goals

- No redesign of the Student, Teacher, or Display layouts.
- No new card effects, card types, or balance changes.
- No new persistence tables, loadout systems, or replay features.
- No changes to scoring, XP, or match lifecycle logic on server.
- No drag behavior on Teacher or Display UIs.


