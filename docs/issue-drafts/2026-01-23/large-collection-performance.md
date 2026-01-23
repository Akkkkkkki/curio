## Title

Plan performance strategy for large collections (pagination or virtualization)

## Labels

- type:enhancement
- area:exhibition
- severity:p2

## Problem

Rendering large collections without pagination or virtualization may degrade browsing performance and increase memory usage, impacting the production experience.

## Steps to Reproduce

1. Populate a collection with a large number of items (hundreds or more).
2. Navigate to the collection view and scroll.

## Expected

Large collections remain responsive, with predictable memory use and smooth scrolling.

## Actual

Performance characteristics are undefined; large collections may degrade the browsing experience.

## Acceptance Criteria

- Define a performance strategy (pagination, infinite scroll with windowing, or virtualization).
- Implement the chosen strategy and document the approach.
- Validate with a representative large dataset.

## Notes (optional)

This supports the production readiness checklist performance section.
