# Curio Documentation

This directory keeps a small set of source-of-truth documents. If a doc is just a checklist, a
point-in-time review, or a forward plan, it should either live in GitHub Issues, `docs/archive/`,
or `docs/plan/`.

## Canonical docs

- `PRODUCT_STRATEGY.md`: product thesis, positioning, principles, business model, and deferred
  scope.
- `PRODUCT_DESIGN.md`: UX requirements, interaction design, mobile guidance, and design language.
- `TECHNICAL_DESIGN.md`: architecture, sync and storage behavior, runtime configuration, and
  technical constraints.
- `ROADMAP.md`: execution phases, exit criteria, metrics, and go-to-market sequencing.
- `GOOGLE_PLAY_SUBMISSION_GUIDE.md`: Android market-test readiness and Google Play submission
  runbook.
- `TESTING.md`: test commands, suite boundaries, and test environment expectations.
- `GITHUB_ISSUES_PROTOCOL.md`: issue format, label taxonomy, and backlog hygiene.

## Supporting docs

- `ops/AI_GATEWAY_MONITORING.md`: operational monitoring reference for the Gemini gateway and
  sync logs.
- `ops/ROLLBACK_RUNBOOK.md`: rollback procedures for AI gateway and Supabase schema changes,
  including ownership and required access.
- `ops/PRODUCT_ANALYTICS.md`: product-analytics reference for the Vercel Web Analytics event sink
  and the `src/services/analytics.ts` transport boundary.
- `ops/PUBLIC_SAMPLE_GALLERY.md`: admin guide for adding or updating the pre-login Public Sample
  Gallery seed collections.
- `PRODUCTION_AI_SECURITY.md`: how production AI security is enforced for the Vercel serverless
  handlers (`api/_aiSecurity.js`), independently of the local Express proxy.
- `plan/DESIGN_flexible_collection_creation.md`: active forward-looking spec for Phase 1 flexible
  collection work. Delete once shipped and move enduring behavior into the canonical docs above.
- `plan/DESIGN_flexible_template_builder_CUR-9.md`: active forward-looking spec — an addendum to
  `DESIGN_flexible_collection_creation.md` recording the product and technical boundaries for the
  Phase 1 flexible template builder. Delete once shipped and move enduring behavior into the
  canonical docs above.
- `plan/DESIGN_public_privacy_model.md`: active forward-looking spec for Phase 1 public profile,
  collection, item, and share-surface privacy. Delete once shipped and move enduring behavior into
  the canonical docs above.
- `plan/DESIGN_public_customization_system_CUR-7.md`: active forward-looking spec for Phase 1
  public profile and share-surface customization. Delete once shipped and move enduring behavior
  into the canonical docs above.
- `plan/DESIGN_shareable_urls_and_og_tags.md`: active forward-looking spec for Phase 1 public
  sharing URLs and Open Graph metadata. Delete once shipped and move enduring behavior into the
  canonical docs above.
- `plan/DESIGN_username_system.md`: active forward-looking spec for Phase 1 public profile
  usernames. Delete once shipped and move enduring behavior into the canonical docs above.
- `plan/DESIGN_explore_feed_pipeline.md`: active forward-looking spec for the Phase 2 Explore feed
  content pipeline and curation model. Delete once shipped and move enduring behavior into the
  canonical docs above.
- `reviews/`: point-in-time UX/design reviews kept for reference between product iterations (e.g.
  `2026-06-23-ux-review.md` and its original `.html` artefact).
- `archive/CODE_REVIEW_REPORT.md`: historical point-in-time report. Keep archived, do not update.

## Documentation rules

- Use GitHub Issues and Projects for checklists, status tracking, and short-lived implementation
  plans.
- Prefer updating an existing canonical doc over creating a new sibling doc on the same topic.
- If a document becomes historical but still worth keeping, move it to `docs/archive/` and mark it
  as archived.
- If a plan ships, fold durable behavior into `PRODUCT_DESIGN.md` or `TECHNICAL_DESIGN.md`, then
  delete the plan doc.
