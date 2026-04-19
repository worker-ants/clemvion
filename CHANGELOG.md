# Changelog

## Unreleased — Node Output Contract Unification

Implements the CONVENTIONS rulebook in `user_memo/node-specs-improvement/CONVENTIONS.md` across all 26+ node handlers. Split over staged refactors (Stage 1–7 + follow-ups) all landing in this release.

### Breaking changes

Workflow authors referencing node output in `{{ … }}` expressions need to migrate or run the provided script. A dry-run is non-destructive:

```
npx ts-node backend/scripts/migrate-node-output-refs.ts --dry-run
npx ts-node backend/scripts/migrate-node-output-refs.ts --apply \
  --workspace-id <uuid> --user-id <uuid>
```

1. **`NodeHandlerOutput` contract** — every handler now returns `{ config, output, meta?, port?, status?, _resumeState? }`. Legacy `{ port, data }` and bare-object shapes are no longer produced by core handlers (the engine adapter still accepts bare returns for test doubles).
2. **Information Extractor** — `output.output.extracted.*` double-nesting removed. New path: `output.result.extracted.*`. `output.output.{messages, endReason, turnCount}` → `output.result.{messages, endReason, turnCount}`. `output.output.collectionRetryCount` → `meta.collectionRetryCount`. `output.output._turnDebugHistory` → `meta.turnDebug`.
3. **AI Agent** — single-turn, multi-turn terminal, and condition-triggered outputs unified under `output.result.{response, messages, turnCount, endReason, condition?}`. Tokens and tool-call counts migrated from `output.metadata.*` to top-level `meta.*`. Condition trigger no longer uses the legacy `{ port, data }` envelope.
4. **Text Classifier** — single-label: `output.category` → `output.result.category` (+ `output.result.confidence`). Multi-label: `output.categories` → `output.result.categories`. Tokens stay on `meta.*`.
5. **Presentation nodes (form / carousel / chart / table / template)** — removed the `output.type` discriminator and the literal-config echo fields (`layout`, `chartType`, `columns`, `items` (static), `format`, `title`, `fields`, `submitLabel`). Those literal values are now read via `$node["X"].config.*` (CONVENTIONS §1.1). Template renames `output.content` → `output.rendered`.
6. **Form resume** — `status: 'submitted'` removed; the engine now emits `status: 'resumed'` + `output.interaction.{type:'form_submitted', data, receivedAt}`. Legacy `output.submittedData` is migrated to `output.interaction.data`.
7. **Button-based presentation resume** — `status: 'button_click' | 'button_continue'` collapsed into `status: 'resumed'` with the original value preserved in `output.interaction.type`. Migration script auto-substitutes `status === '<old>'` comparisons but operators should verify the matching `output.interaction.type` branch exists.
8. **Container nodes (loop / foreach / map / parallel)** — the engine no longer overwrites container output with a flat array. It now emits `{ iterations | items | mapped | branches, count }` on the `done` port (CONVENTIONS §9.2). `$node["Loop"].output[0]` style access is no longer valid — use `$node["Loop"].output.iterations[0]`.
9. **Runtime error envelope** — all nodes that can fail at runtime (http_request, database_query, send_email, code, ai_agent, text_classifier, information_extractor, workflow) now route to `port: 'error'` with `output.error: { code, message, details? }`. Pre-flight errors continue to throw as before.
10. **Error code rename** — in the `output.error.code` slot:
    - `QUERY_FAILED` → `DB_QUERY_FAILED`
    - `SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` (with the original `IntegrationError` code preserved in `details.integrationCode`)
    - `CODE_RUNTIME_ERROR` / `CODE_SYNTAX_ERROR` → `CODE_EXECUTION_FAILED`
    - `EXECUTION_TIMEOUT` (code node only) → `CODE_TIMEOUT`
    - `HTTP_5XX` / `HTTP_4XX` added (non-2xx responses now carry both `output.response` and `output.error`)
    - `SUB_WORKFLOW_FAILED` added
    - New interaction-level codes reserved: `USER_CANCELLED`, `INTERACTION_TIMEOUT`
11. **`workflow` and `send_email` schemas** — added `error` port. Sub-workflow runtime failures are now routed rather than thrown; un-connected `error` ports fall back to the Stop Workflow policy documented in `spec/5-system/3-error-handling.md §3.2`.
12. **`send_email.subject`, `send_email.to`, `send_email.cc`, `send_email.bodyType`** — moved from top-level handler output to `config`.
13. **HTTP request** — `output.statusCode` / `output.duration` / `output.headers` moved from `output` to `meta`. URL-level credentials (`https://user:pass@…`) are stripped in `config.url` AND `output.error.details.url`.

### Internal / Infrastructure

- Handler-output adapter (`backend/src/modules/execution-engine/handler-output.adapter.ts`) simplified to a strict new-shape pass-through plus a narrow legacy-bare wrapper for tests. The legacy `{ port, data }` branch is removed. In `NODE_ENV==='production'` the adapter throws on any non-canonical return (production handlers are type-checked, so this catches bugs early); test/dev keeps lenient coercion via the exported `wrapBareAsNodeHandlerOutput()` helper.
- Expression resolver always reads from the structured cache; the `{ output: flat }` shim branch is retained only for pre-seeded test fixtures that skip the structured cache.
- `_multiTurnState` → `_resumeState` rename. Engine reads `_resumeState ?? _multiTurnState` to protect in-flight multi-turn sessions across deploys. The dual-read will be retired one release after all handlers emit `_resumeState` (currently: ai_agent, information_extractor).
- Migration script `backend/scripts/migrate-node-output-refs.ts` now runs the entire `--apply` phase inside a single DB transaction, requires `--workspace-id <uuid> --user-id <uuid>` for the audit row, and emits audit-only hits for legacy fields that cannot be safely rewritten (`output.error.nodeId` / `nodeType` / `timestamp` / `originalInput`, `output.type` discriminator).

### Migration steps for workflow authors

1. **Dry-run the migration** to see every change that will be applied to stored workflow expressions:
   ```
   npx ts-node backend/scripts/migrate-node-output-refs.ts --dry-run
   ```
2. **Review audit-only hits** in the dry-run output (marked "manual review needed"). These cannot be auto-rewritten — edit affected nodes in the editor.
3. **Confirm no live multi-turn AI sessions are in flight** (pending `waiting_for_input`). The `_multiTurnState`→`_resumeState` dual-read protects most sessions, but a belt-and-suspenders check before deploy is recommended.
4. **Apply** with the new CLI flags:
   ```
   npx ts-node backend/scripts/migrate-node-output-refs.ts --apply \
     --workspace-id <uuid> --user-id <uuid>
   ```
5. **Verify** by running representative workflows. The migration is idempotent — re-running is safe.
