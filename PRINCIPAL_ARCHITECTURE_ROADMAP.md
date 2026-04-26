# Principal-Level Architecture Roadmap

This document captures the follow-up work needed to evolve this codebase from a cleaner production MVP into a major-company style staff/principal-engineered architecture.

The current refactor improved file organization, but it intentionally avoided business logic, API behavior, UI appearance, auth, database queries, config, and deployment changes. The items below should be implemented later in small, reviewed steps.

## Current State

- Backend source folders are organized under `backend/src`.
- Storefront static files are organized under `src/css`, `src/js`, `src/js/pages`, `src/pages`, and `src/assets/images`.
- Inline page scripts were extracted from HTML.
- Express static serving was updated to support the new frontend structure.

## Target Architecture

The long-term goal is a codebase with clear ownership boundaries:

- Routes only handle HTTP concerns.
- Controllers coordinate request/response flow.
- Services own business workflows.
- Repositories/data access own database queries.
- Serializers/DTOs own API response shapes.
- Frontend shared modules own reusable behavior.
- Page modules own page-specific behavior.
- CSS is split into global, component, page, and utility layers.
- Tests and CI guard behavior before refactors continue.

## Backend Work

1. Thin backend routes.
   - Move request orchestration out of `backend/src/routes`.
   - Keep route files limited to route registration, middleware, validators, and controller binding.
   - Preserve all current API paths and response shapes.

2. Add controller layer.
   - Create `backend/src/controllers`.
   - Add one controller per API domain: auth, products, cart, orders, payments, wishlist, admin.
   - Controllers should call services and return responses.

3. Add repository/data-access layer.
   - Create `backend/src/repositories`.
   - Move direct Mongoose calls out of routes and services where appropriate.
   - Keep query behavior unchanged during extraction.

4. Strengthen service boundaries.
   - Keep business workflows in services.
   - Avoid services knowing about Express `req` or `res`.
   - Make service inputs plain objects and outputs domain/API-ready objects.

5. Separate validators.
   - Create `backend/src/validators`.
   - Move `express-validator` rules out of route files.
   - Keep validation messages and status behavior unchanged.

6. Improve error handling contracts.
   - Standardize error codes and payload shape.
   - Keep existing public API behavior stable until clients are migrated.

7. Add API documentation.
   - Document endpoints, request bodies, response bodies, auth requirements, and error cases.
   - Consider OpenAPI after routes/controllers are stable.

## Frontend Work

1. Split `src/js/script.js`.
   - Extract by domain: API client, cart, wishlist, auth, checkout, search, product modal, UI effects.
   - Preserve global function names that HTML or existing scripts depend on.
   - Keep extraction mechanical first, then improve internals later.

2. Organize page scripts.
   - Continue using `src/js/pages`.
   - Page scripts should initialize only page-specific behavior.
   - Shared behavior should move into reusable modules.

3. Extract page CSS safely.
   - Move `<style>` blocks from HTML into page CSS files.
   - Create a CSS structure such as:
     - `src/css/base/`
     - `src/css/components/`
     - `src/css/pages/`
     - `src/css/utilities/`
   - Verify visual parity after each page.

4. Remove inline `style=""` attributes gradually.
   - Convert repeated inline styles into classes.
   - Do this only with screenshot comparison or manual QA.
   - Do not change visual appearance during extraction.

5. Fix broken local link.
   - `src/pages/index_v2.html` links to `decor.html`, but no `decor.html` exists.
   - Decide whether to create `decor.html` or update the link to `newdecor.html`.

## Admin App Work

1. Split `admin/src/App.jsx`.
   - Extract API client, layout, product management, order management, coupon management, and shared UI components.

2. Add admin-specific service modules.
   - Keep fetch logic outside UI components.
   - Make loading, error, and empty states consistent.

3. Add admin tests.
   - Add component tests for critical admin workflows.
   - Add API interaction tests with mocked responses.

## Testing And Quality Gates

1. Fix test runner.
   - `npm test` currently fails because `cross-env` is not resolving in the workspace.
   - Restore dependency installation or adjust the local test setup without changing production behavior.

2. Add linting and formatting.
   - Add ESLint for backend/frontend JS.
   - Add Prettier or an agreed formatter.
   - Enforce with CI before broad refactors.

3. Add CI.
   - Run install, lint, syntax checks, tests, and admin build.
   - Block merges when checks fail.

4. Expand backend tests.
   - Cover auth, cart, checkout, payment verification, wishlist, products, and admin flows.
   - Add regression tests before moving route logic.

5. Add frontend smoke tests.
   - Verify key storefront pages load.
   - Verify CSS/JS assets return 200.
   - Verify cart, wishlist, search, checkout modal, and contact/FAQ interactions.

## Operational Readiness

1. Add structured logging.
   - Include request IDs, route, status, latency, and error metadata.
   - Avoid logging secrets or payment-sensitive data.

2. Add observability hooks.
   - Health checks should distinguish API, database, and external provider readiness.
   - Add basic metrics for request rate, error rate, and latency.

3. Document environment variables.
   - Keep `.env` untouched.
   - Ensure `.env.example` and deployment docs explain every required variable.

4. Add deployment verification.
   - Document smoke checks after deployment.
   - Include storefront, admin, API health, and payment-webhook checks.

## Suggested Implementation Order

1. Fix test runner and add CI baseline.
2. Add lint/format tooling.
3. Fix the `decor.html` link decision.
4. Split backend validators and controllers without changing behavior.
5. Move backend DB queries into repositories behind tests.
6. Split `src/js/script.js` into shared frontend modules.
7. Extract page CSS and inline styles with visual QA.
8. Split the admin app into components and API modules.
9. Add API documentation and architecture boundary docs.
10. Add observability and deployment smoke-check documentation.

## Refactor Rules For Future Work

- Keep behavior stable unless a task explicitly says otherwise.
- Move one domain at a time.
- Add tests before risky extractions.
- Preserve public API contracts.
- Preserve existing HTML IDs, class hooks, and global function names until replacements are proven.
- Prefer small mechanical moves before semantic rewrites.
- Flag uncertain references instead of guessing.
