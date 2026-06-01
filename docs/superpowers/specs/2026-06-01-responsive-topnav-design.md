# Responsive Top Navigation Design

**Date:** 2026-06-01

## Goal

Keep primary navigation in the header at every viewport width. Remove the mobile
footer navigation introduced by the current `BottomTabBar`.

## Responsive Behavior

- Desktop and tablet retain the existing `TopNav` layout with the `Eat thing`
  wordmark, text navigation links, disabled `shops` stub, date where space
  allows, and sign-out avatar.
- Phone widths at `<=480px` use a compact single-row `TopNav`.
- The phone wordmark is shortened to `Eat`.
- The five available routes remain visible as icon-only links: home,
  inventory, recipes, plan, and list.
- Phone navigation omits the unfinished `shops` stub until that route exists.
- The sign-out avatar remains visible on phones.
- The active phone icon retains a visible active state.
- Icon-only links expose accessible names through `aria-label`.

## Components

- `TopNav` owns both text and compact icon presentations.
- Existing `BottomTabBar` rendering is removed from the app shell. Its source
  files can be deleted because no route or component should render it.
- Existing phone-only bottom padding is removed because fixed footer
  navigation no longer overlays page content.
- `HeroBand` is unchanged. The linked home hero component does not own shared
  navigation.

## Testing

- Update `TopNav` unit coverage for the compact icon markup and accessible
  labels.
- Remove obsolete `BottomTabBar` unit coverage with the deleted component.
- Update Playwright coverage to assert that navigation remains in the header at
  phone and tablet viewport widths, the phone footer is absent, and compact
  phone behavior is applied only at `<=480px`.

## Scope

This is a responsive chrome change only. It does not add routes, change page
content, or alter authentication behavior.
