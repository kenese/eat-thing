# Shopping List: Purchase & Remove Actions

**Date:** 2026-05-15  
**Status:** Approved

## Overview

Replace the unused "in cart" checkbox on shopping list items with a multi-select + batch action bar. Tapping the checkbox area selects items; a sticky bar offers "Mark purchased" (saves to inventory, removes from list) and "Remove" (removes from list, with a confirmation for recipe-sourced items). Also removes `location` from `inventory_items` in favour of category-based grouping, and adds find-or-create canonical food logic so free-text items in both the shopping list and inventory forms can always be persisted.

---

## Schema changes

One migration:

- Drop `location` column from `inventory_items`
- Drop `inventory_location_enum` from the DB

The `checked` column on `shopping_list_items` stays (no migration) but the UI stops writing to it.

---

## Find-or-create canonical food

Shared server helper used by both shopping list add and inventory add:

1. Case-insensitive name match against `canonical_foods`
2. If found → return existing record
3. If not found → insert `{ name, category, defaultUnit: unit }` and return new record

This is the only path that creates new canonical foods outside of recipe ingestion. Entries created this way have no nutritional/conversion data (`densityGPerMl`, `countToGrams`, `aliases` all null/empty) — those fill in if the same food later appears in a recipe import.

---

## Inventory page

- Filter tabs change from fridge / pantry / freezer / other → produce / meat / dairy / pantry / frozen / drinks / other
- Category comes from the `canonical_foods` join (already present in the query) — no new DB column needed on `inventory_items`
- `GET /api/inventory` drops the `location` query param; gains an optional `category` query param

## Inventory `ItemForm`

- Remove the `location` select field entirely
- `FoodCombobox` gains an "Add '[name]' as new food" entry at the bottom of the dropdown when search returns no results
- Selecting that entry reveals a required category dropdown; form cannot submit until category is chosen
- On submit: call find-or-create with `{ name, category, defaultUnit: unit }`, then use the returned `canonicalFoodId` for the inventory insert

---

## Shopping list: add item form

The inline `AddItemForm` becomes:

- **Food search combobox** — searches existing canonical foods; selecting a result locks in the `canonicalFoodId`
- **If canonical selected** — submit enabled as soon as qty is filled (category is known from the canonical record)
- **If free text (no canonical selected)** — a required category dropdown appears; "Add +" stays disabled until category is chosen
- **Qty + unit** — unchanged
- On submit: call find-or-create server-side with the typed name + selected category + unit, then create the shopping list item linked to the resulting `canonicalFoodId`

No location picker — location has been removed.

---

## Shopping list: item rows

- **Checkbox area (left tap target)** — tap to select / deselect; selection is local React state (`Set<string>` of item IDs), nothing persisted to the DB
- **`sourceRecipeNames` chips** — display-only in this change. `shopping_list_items` stores recipe names but not recipe IDs, so navigation to a recipe detail page requires a schema addition (`source_recipe_ids text[]`). Deferred — add to IDEAS.md alongside "while shopping" mode.
- Per-row ✕ delete button removed (action moved to the batch bar)
- Existing `checked` visual state removed from row styling

---

## Sticky action bar

Appears when `selectedIds.size > 0`, fixed to the bottom of the viewport:

| Control | Behaviour |
|---|---|
| **Mark purchased (N)** | POST `/api/shopping-lists/:listId/items/purchase` → insert inventory rows + delete list items |
| **Remove (N)** | If any selected item has `source === 'recipe'`: show confirmation dialog first. Then POST batch-delete |
| **✕** | Deselect all (hides bar) |

---

## New server endpoints

### `POST /api/shopping-lists/:listId/items/purchase`

```
Body: { itemIds: string[] }
```

In a single transaction:
1. Fetch each item; verify `householdId` matches
2. For each item with a `canonicalFoodId`: insert an `inventory_items` row `{ canonicalFoodId, qty, unit, purchasedAt: now(), householdId }`
3. Delete all `itemIds` from `shopping_list_items`
4. Return updated list (same shape as `GET /current`)

Items without a `canonicalFoodId` are deleted from the list but not added to inventory. In practice this should never happen after the find-or-create change lands, but the server handles it gracefully.

### `POST /api/shopping-lists/:listId/items/batch-delete`

```
Body: { itemIds: string[] }
```

Delete all `itemIds` (verifying `householdId`). Return updated list.

---

## New / updated client hooks

| Hook | Purpose |
|---|---|
| `usePurchaseShoppingListItems(listId)` | Calls POST `/purchase`; invalidates `shopping-list` + `inventory` queries |
| `useBatchDeleteShoppingListItems(listId)` | Calls POST `/batch-delete`; invalidates `shopping-list` query |
| `useAddInventoryItem` | Updated to send no `location` field |
| `useInventory` | Updated to filter by `category` instead of `location` |

---

## Shared types

- Remove `InventoryLocation` type and all references
- Add `category` to `InventoryRow` (already available via join; just needs exposing in the type)
- `AddShoppingListItemInput`: add `category` field (required when no canonical food match); `canonicalFoodId` stays optional on the client — the server resolves it via find-or-create using the submitted name + category

---

## IDEAS.md addition

> **"While shopping" mode** — a tick-as-you-go mode for the shopping list where checking an item records it as "in cart" without saving to inventory. Useful for tracking progress through a physical shop before confirming the full purchase at the end.

---

## Out of scope

- Editing qty at purchase time (use inventory edit after)
- Expiry date at purchase time (use inventory edit after)
- Brand capture at purchase time
- Merging duplicate inventory rows for the same food
