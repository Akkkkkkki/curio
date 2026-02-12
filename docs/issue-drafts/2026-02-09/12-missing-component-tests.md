## Title

11 components and the Gemini proxy server have no test coverage

## Labels

- type:enhancement
- severity:p2

## Problem

The test suite has significant coverage gaps:

### Untested Components (11):

- `ConflictResolutionModal.tsx` - Complex merge conflict UI
- `CreateCollectionModal.tsx` - Form validation and submission
- `DeleteItemsModal.tsx` - Batch operations
- `EnhanceImageModal.tsx` - AI image enhancement UI
- `ExhibitionView.tsx` - Fullscreen slideshow mode
- `ExportModal.tsx` - Multi-format export logic
- `FilterModal.tsx` - Filter UI and state management
- `ImageEditModal.tsx` - Image crop/rotate operations
- `ItemImage.tsx` - Core image display component
- `StatusBanner.tsx` - Sync status feedback
- `StatusToast.tsx` - Toast notifications

### Untested Server Endpoints:

- `/api/gemini/analyze` - Core image analysis
- `/api/gemini/enhance` - Image enhancement
- `/api/gemini/suggest-fields` - Field suggestion
- Rate limiting enforcement
- JWT validation
- Malformed request handling

### E2E Gaps:

- Only 1 test for authenticated user flows (vs. 12 for first-time users)
- No E2E coverage for: bulk delete, filter/sort, theme persistence, export, conflict resolution

### Also Missing:

- `seedCollections.ts` has zero tests
- No tests for offline-to-online sync recovery

## Expected

All user-facing components and server endpoints have at least smoke tests.

## Actual

52% component coverage, 0% server endpoint coverage.

## Acceptance Criteria

- [ ] Test files created for all 11 untested components
- [ ] Server endpoint tests for analyze, enhance, suggest-fields
- [ ] At least 5 additional authenticated user E2E tests
- [ ] seedCollections.ts test verifying structure and version
- [ ] tests/README.md updated to reflect current coverage
