# Slice 4 Shopping List Scheduling Design

**Date:** 2026-06-03

## Goal

Add an explicit scheduled shopping date to the active shopping list and use that date
to make Recipes quick-shop copy more specific.

The first version schedules a shopping day, not a delivery slot. It should stay small
and household-scoped while leaving room for later delivery-window work.

## Scope

### Included

- A nullable `shopping_lists.scheduled_for` database field.
- Shared `ShoppingList` type support for `scheduledFor: string | null`.
- Household-scoped shopping-list API support for reading and updating the scheduled
  date.
- A Shopping List header date chip that opens the existing `DatePickerModal`.
- Recipes quick-shop copy that includes the scheduled date when the active list has
  one, with the current generic wording as the fallback.
- Vitest server, hook/page, and component coverage.
- Playwright coverage for setting the list date and seeing Recipes use it.
- A new numbered `DECISIONS.md` entry.

### Excluded

- Multiple active or upcoming shopping lists per household.
- Delivery slots, timestamps, or supermarket-specific delivery-window selection.
- Shopping-list finalization behavior.
- Changes to how list items are generated from meal plans.

## Chosen Approach

Store one nullable household-local date on the active shopping list and edit it from a
header chip beside the existing Shopping List actions.

Alternatives considered:

1. A sidebar schedule card would make the date very visible, but it creates a heavier
   scheduling surface before delivery slots exist.
2. Placing the date only in the add-from-plan modal would be small, but it hides the
   scheduled date after the list already exists.

The header chip treats the date as list metadata, keeps it visible, and reuses the
date-picker interaction already introduced for the Plan page.

## Data Model

Add `scheduled_for date` to `shopping_lists`. It is nullable so existing lists remain
valid and households can clear a scheduled date.

Use a date, not a timestamp. The value is interpreted as a household-local calendar
day and serialized as an ISO `YYYY-MM-DD` string. Delivery-slot work can add a
separate timestamp or slot model later.

The app keeps the current single-active-list behavior: routes select the latest
shopping list for the household. Slice 4 does not introduce multiple upcoming lists.

## API Design

All shopping-list routes remain protected by `withHousehold`.

`GET /api/shopping-lists/current` returns `scheduledFor` with the current list payload.
If the list has no date, `scheduledFor` is `null`.

`POST /api/shopping-lists/from-plan` continues to find or create the current list and
replace derived recipe/staple items while preserving manual items. It also returns
`scheduledFor`. If it creates a new list, the date starts as `null`.

Add `PATCH /api/shopping-lists/:listId` with body:

```json
{ "scheduledFor": "2026-06-05" }
```

or:

```json
{ "scheduledFor": null }
```

The route validates the list id, validates `scheduledFor` as either `null` or an ISO
date string, scopes the update by both `listId` and `req.householdId`, and returns the
full updated list with items. A list owned by another household returns not found.

## Shopping List UI

When a current list exists, the Shopping List page header actions include a date chip:

- `Set shop date` when `scheduledFor` is `null`.
- `Shop Fri 5 Jun` when `scheduledFor` is set.

Clicking the chip opens `DatePickerModal`. Confirming a date calls the update route,
invalidates the current-list query, and updates the chip. Cancelling or closing the
modal is a no-op.

The chip is shown only when a list exists. The empty-list state keeps its current
focus on creating a list from planned recipes.

## Recipes Quick-Shop Copy

Recipes reads the current shopping list through the existing shopping-list query
path. If a scheduled date exists, quick-shop copy references it:

- Page summary: `3 quick shops for Fri 5 Jun`.
- Section hint: `1-3 items away · add to your Fri 5 Jun list`.

If no current list exists or the list has no scheduled date, Recipes keeps the current
generic wording:

- Page summary: `3 a quick shop away`.
- Section hint: `1-3 items away · auto-added to your next list`.

The Recipes page must not create a shopping list just to render the hint.

## Error Handling

- Invalid update payloads return `400`.
- Unknown or cross-household list ids return `404`.
- Update failures keep the existing date chip visible and surface a concise page-local
  status or error message.
- Recipes treats a missing current list as normal and uses fallback copy.
- Existing household scoping, manual-item preservation, and derived-item generation
  behavior remain unchanged.

## Testing

### Vitest

- Server route tests verify `scheduledFor` is returned by current-list and from-plan
  responses.
- Server route tests verify `PATCH /api/shopping-lists/:listId` sets and clears the
  date, rejects invalid dates, and cannot update another household's list.
- Shared/web tests verify the Shopping List header chip opens `DatePickerModal`,
  confirms a date, and calls the update mutation.
- Recipes page tests verify dated quick-shop copy when `scheduledFor` exists and
  generic fallback copy when it does not.

### Playwright

- On Shopping List, set a scheduled date from the header chip and confirm the chip
  updates.
- Navigate to Recipes and verify the quick-shop hint uses the same scheduled date.

## Acceptance Criteria

- The active shopping list stores and returns a household-scoped scheduled date.
- The scheduled date is a nullable household-local `YYYY-MM-DD` value.
- Shopping List exposes the scheduled date as a header chip and edits it through the
  existing date picker.
- Manual shopping-list items are preserved by from-plan generation.
- Recipes quick-shop copy renders the scheduled date when present and keeps a generic
  fallback otherwise.
- `pnpm --filter @eat/server db:migrate`, `pnpm test`, and `pnpm test:e2e` pass.
