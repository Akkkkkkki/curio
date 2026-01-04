# Testing Progress - Curio

**Last updated:** 2026-01-03

This checklist tracks test coverage implementation progress against `docs/TESTING_ROADMAP.md`.

## Phase 1: Critical Services — Pure/Isolated (Week 1)

- [x] **1.1 `services/db.ts` — Pure Functions** (`tests/unit/services/db.pure.test.ts`)
- [x] **1.2 `services/imageProcessor.ts` — Image Processing** (`tests/unit/services/imageProcessor.test.ts`)
- [x] **1.3 `services/supabase.ts` — Auth Functions (Isolated)** (`tests/unit/services/supabase.test.ts`)

## Phase 2: Critical Services — Integration (Week 2)

- [x] **2.1 `services/db.ts` — Merge Logic** (`tests/services/db.merge.test.ts`)
- [x] **2.2 `services/db.ts` — Dual-Write Operations** (`tests/services/db.operations.test.ts`)
- [x] **2.3 `services/db.ts` — Cleanup & Utilities** (`tests/services/db.cleanup.test.ts`)

## Phase 3: AI & Hooks Integration (Week 3)

- [x] **3.1 `services/geminiService.ts` — AI Analysis** (`tests/services/geminiService.test.ts`)
- [x] **3.2 `hooks/useAuthState.ts` — Auth State Management** (`tests/hooks/useAuthState.test.ts`)
- [x] **3.3 `hooks/useCollections.ts` — Collection Management** (`tests/hooks/useCollections.test.ts`)

## Phase 4: Components (Week 4)

- [ ] **4.1 `components/AddItemModal.tsx` — Item Creation Flow** (`tests/components/AddItemModal.test.tsx`)
- [ ] **4.2 `components/AuthModal.tsx` — Authentication UI** (`tests/components/AuthModal.test.tsx`)
- [ ] **4.3 Other UI Components** (`tests/components/ui/*.test.tsx`)

## Phase 5: End-to-End Tests (Week 5)

- [ ] **5.1 Critical User Flows** (`tests/e2e/critical-flows.spec.ts`)
