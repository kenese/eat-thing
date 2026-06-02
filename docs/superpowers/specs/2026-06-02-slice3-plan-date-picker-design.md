# Slice 3 Plan Date Picker Design

**Date:** 2026-06-02

## Goal

Replace the disabled Plan `load date` stub with a compact modal mini-calendar. Selecting
a date recenters the rolling 17-day meal-plan rail around that date and scrolls the
selected day into view.

Keep the Recipes hero action fast: it immediately adds the featured recipe to the next
empty day. It does not open the date picker.

## Scope

### Included

- A reusable `DatePickerModal` component under `apps/web/src/components/`.
- Plan page state changes so its rolling 17-day rail can be anchored around a selected
  date instead of only the initial page-load date.
- Recipes hero pending, success, and retry feedback for its existing next-empty-day
  mutation.
- Vitest component and page-level coverage.
- Playwright coverage for Plan distant-date loading and Recipes hero next-empty-day
  auto-add.

### Excluded

- Server, database, and API changes.
- A Recipes hero date picker.
- Changes to bulk recipe selection. Its existing add-to-next-empty-days behavior stays
  intact.
- A general application-wide calendar system.

## Chosen Approach

Use a compact mini-calendar modal for Plan `load date`.

Alternatives considered:

1. A native date input would be smaller to implement, but its interaction and visual
   treatment vary by browser.
2. An inline expanding calendar would preserve page context, but it would crowd the
   Plan title controls and be awkward on mobile.

The modal matches the current interface, stays touch-friendly, and keeps the calendar
logic isolated.

## Component Design

Add `DatePickerModal` as a controlled modal component. It receives:

- `initialDate`: an ISO `YYYY-MM-DD` date.
- `onConfirm(date)`: called with an ISO date after explicit confirmation.
- `onClose()`: called when the user closes or cancels without applying changes.

The modal owns temporary selection and displayed-month state. It shows:

- A title such as `Choose a date`.
- Previous and next month controls.
- Monday-first weekday headings.
- One month of selectable days.
- Selected-day styling.
- Close and cancel actions.
- A confirm button naming the chosen day.

The initial date is selected when the modal opens. Month navigation does not apply a
date until the user confirms. Cancel and close leave the Plan rail unchanged.

## Plan Page Flow

The Plan page stores an anchor date. On initial load the anchor is today. The existing
17-day rail is derived around the anchor using the same two-days-before and
fourteen-days-after shape.

When the calendar button is clicked:

1. Open `DatePickerModal` with the currently focused rail date.
2. Let the user navigate months and choose a date.
3. On confirm, set that date as the new anchor.
4. Recalculate the rail and query range around the anchor.
5. After the new range renders, scroll the selected date into view.

The `today` control restores today's anchor and scrolls today into view. Horizontal
arrow controls and horizon-pill scrolling continue to operate within the currently
loaded rail.

The calendar button becomes enabled and exposes an accessible `Load date` label.

## Recipes Hero Flow

The Recipes hero remains an immediate next-empty-day action. Clicking
`add to next open day`:

1. Calls the existing `useAddToNextEmptyDays` mutation for the featured recipe.
2. Disables the button and shows `adding...` while pending.
3. Briefly shows `added to <date>` after success.
4. Shows `retry add to plan` after failure. Clicking it retries the same action.

The selected date comes from the mutation result already returned by
`useAddToNextEmptyDays`. Bulk selection and recipe-form add-to-plan actions keep their
existing next-empty-days behavior.

## Error Handling

- Closing or cancelling the Plan modal is a no-op.
- Plan query loading continues to use existing page behavior while a recentered range
  is fetched.
- Recipes hero mutation failure remains local to its CTA and offers an explicit retry.
- Existing server enforcement of the maximum recipes per day remains authoritative.

## Testing

### Vitest

- `DatePickerModal` defaults to `initialDate`.
- Selecting a date and confirming returns its ISO date.
- Previous and next controls change the displayed month.
- Cancel and close do not confirm a date.
- Plan page confirmation recenters the requested meal-plan query range and scrolls the
  selected day into view.
- Recipes hero CTA shows pending, success, and retry states around the existing
  next-empty-day mutation.

### Playwright

- On Plan, opening `Load date`, selecting a distant date, and confirming reloads the
  rail around that date and scrolls the selected day into view.
- On Recipes, clicking the hero CTA immediately posts the featured recipe to the next
  empty date and reports that date without opening a modal.

## Acceptance Criteria

- The disabled Plan calendar stub is removed.
- Plan `Load date` opens the compact modal mini-calendar.
- Confirming any selected date recenters the rolling 17-day rail and scrolls to that
  date.
- Cancelling the modal leaves the rail unchanged.
- Recipes hero auto-adds to the next empty day and reports pending, success, and retry
  states.
- Existing bulk add-to-next-empty-days behavior remains available.
- `pnpm test` and `pnpm test:e2e` pass.
