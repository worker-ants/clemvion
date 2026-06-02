# RESOLUTION — channel-web-chat-followups D#3~D#7 (08_13_25)

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 | 코드(XSS) | d0d595b0 | `isSafeUrl()` helper added in `presentation.ts`; applied to `asButtons()` url and `toCarousel()` image src — blocks `javascript:`/`data:`/`vbscript:` |
| W2 | 문서(accepted-risk) | d0d595b0 | client-side soft-control is by-design (spec §3 fail-open). Documented in `@ApiOperation` description on `getEmbedConfig`. No code change. |
| W3 | spec (ESCALATE) | draft only | `waiting_for_input` presentations needs spec clarification. Draft: `plan/in-progress/spec-fix-waiting-for-input-presentations.md` |
| W4 | 코드 | d0d595b0 | `authConfigId: IsNull()` added to `EmbedConfigService.resolve` trigger query. `INTERACTION_ALLOWED_ORIGINS_KEY` constant added. New test case in `embed-config.service.spec.ts`. |
| W5 | 문서(accepted-risk) | — | `EmbedConfigService→Workspace` dep acceptable at current scale. No code change. |
| W6 | 코드(테스트) | d0d595b0 | `widget-app.test.tsx` referrer restoration moved to `afterEach` — assertion failures no longer leak global state. |
| W7 | ESCALATE(user-guide) | — | User guide page `frontend/src/content/docs/06-integrations-and-config/web-chat.{mdx,en.mdx}` needed. Flagged for user-guide-writer delegation. |
| W8 | ESCALATE(user-guide) | — | Same as W7 — embed allowlist, rich presentations, BYO-UI coverage. |
| W9 | 코드(API) | d0d595b0 | `@ApiOperation` description now includes fail-open policy note. |
| W10 | 코드(API) | d0d595b0 | `@ApiResponse` with `Cache-Control` header documented in `getEmbedConfig`. |
| W11 | 코드(의존성) | d0d595b0 | `@workflow/sdk: "file:../sdk"` added to `web-chat-sdk` devDependencies; `npm install` succeeded; lock updated. |

## Info 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|-----------|------|------|------|
| I1 | 문서(정책) | d0d595b0 | cache delay documented in @ApiOperation description and EMBED_CONFIG_CACHE_SEC comment. |
| I2 | 문서(accepted-risk) | — | `detectHostOrigin` referrer fallback limitation is by-design soft control. |
| I3 | 문서(accepted-risk) | — | DB-fail allow-all degrade is intentional (spec fail-open). JSDoc already states this. |
| I4 | 코드(XSS) | d0d595b0 | `toCarousel()` image src now checked with `isSafeUrl()`. |
| I5 | 노트 | — | CI `actions/checkout@v5`/`setup-node@v6` left as-is. User should confirm/SHA-pin if desired. |
| I6 | 코드 | d0d595b0 | `PieSlices`: frac >= 0.999 now renders `<circle>` instead of degenerate arc. |
| I7 | ESCALATE(spec) | — | `max-age=300` value not in spec — project-planner should add to spec §3-①. |
| I8 | 노트(arch) | — | `classifyPresentation` shape-based heuristic — noted for future explicit `type` field. |
| I9 | 노트(perf) | — | O(n²) prefix-sum is fine with ≤10 slices. No action. |
| I10 | 노트(perf) | — | 2-hop DB query is fine at current scale; CDN cache covers it. |
| I11 | 노트(arch) | — | `EmbedAllowlist`/`EmbedConfigDto` dual definition noted; no change. |
| I12 | 노트(arch) | — | Shape-based classification noted; future `type` field would improve. |
| I13 | 테스트 | d0d595b0 | 3 new cases in `conversation.test.ts` (presentations-only, text+presentations, presentations:[]). |
| I14 | 테스트 | d0d595b0 | 2 new cases in `widget-state.test.ts` (AI_MESSAGE presentations propagation + empty array). |
| I15 | 테스트 | d0d595b0 | 3 new cases in `presentation.test.ts` (config.columns/rows fallback, label fallback). |
| I16 | 코드(유지보수) | d0d595b0 | `CHART_SVG_W/H/PAD` constants extracted in `presentations.tsx`. |
| I17 | 코드(유지보수) | d0d595b0 | `EMBED_CONFIG_CACHE_SEC = 300` extracted in `hooks.controller.ts`. |
| I18 | 코드(유지보수) | d0d595b0 | `INTERACTION_ALLOWED_ORIGINS_KEY` constant in `embed-config.service.ts`. |
| I19 | 문서 | d0d595b0 | JSDoc added to `toCarousel/toTable/toChart/toTemplate`. |
| I20 | 문서 | d0d595b0 | `HeadlessChat.end` vs `close` JSDoc clarified in `byo-ui-headless.ts`. |
| I21 | 코드(타입) | d0d595b0 | `BLOCKED` reason: `"origin_not_allowed" | string` union. |
| I22 | 데이터베이스(확인) | — | `Trigger` entity has no `@Index(['endpointPath', 'type'])`. The `endpointPath` column exists but no composite index with `type`. Adding a migration is out of scope here — recommend adding `@Index(['endpointPath', 'type'])` to Trigger entity as a follow-up task (likely low-traffic now, but beneficial when webhook volume grows). |
| I23 | 코드 | d0d595b0 | `refreshToken .catch()` now logs `console.warn` for observability. |

## TEST 결과

- lint  : 통과 (channel-web-chat + web-chat-sdk)
- typecheck : 통과 — channel-web-chat `tsc --noEmit` 0 err; backend hooks module 0 err (pre-existing unrelated errors in auth/chat-channel/execution-engine modules excluded)
- unit  : 통과 — channel-web-chat 86 passed (was 69); backend hooks 67 passed; web-chat-sdk 40 passed
- build : 통과 — channel-web-chat Next.js static export OK; web-chat-sdk dist OK
- e2e   : skipped — no e2e harness configured for this worktree; changes are unit-testable widget lib and Swagger metadata only

## 보류·후속 항목

- **W3 (ESCALATE=spec)**: `waiting_for_input` presentations spec 명확화 필요 → `plan/in-progress/spec-fix-waiting-for-input-presentations.md`. project-planner 가 spec §1-widget-app §2 갱신 후 developer 구현.
- **W7/W8 (ESCALATE=user-guide)**: `frontend/src/content/docs/06-integrations-and-config/web-chat.{mdx,en.mdx}` 신설 필요 — embed allowlist 동작, presentation 노드 사용법, BYO-UI 안내 포함.
- **I7 (ESCALATE=spec)**: `max-age=300` 수치를 spec §3-① 에 명시 (project-planner 위임).
- **I22**: `Trigger` entity `(endpointPath, type)` 복합 인덱스 미존재 확인 — 마이그레이션은 범위 외, follow-up 으로 추적.

---

## main 후속 — escalation 종결 (2026-06-02)

### W3 (spec escalate) → 종결: 이미 thread 경로로 처리됨 (spec 변경 불요)
EIA 계약 검증 결과(WS protocol §6 line 486, `spec/conventions/conversation-thread.md §44`):
`presentations` 는 **`ai_assistant` ConversationTurn 의 top-level 필드**(conversationThread 안)이며,
`waiting_for_input` 이벤트의 별도 top-level 필드가 아니다. 위젯은 `waiting_for_input.context.
conversationThread.turns[]` 를 `threadToMessages` 로 변환하며(use-widget L118), `threadToMessages` 는
turn 의 `presentations` 를 추출해 `DisplayMessage.presentations` 로 전파한다(conversation.ts L48) →
panel 이 inline 렌더. 따라서 waiting_for_input 의 presentation 은 **이미 렌더된다**. draft 가 제안한
`WaitingForInputEvent.presentations` top-level 필드 추가는 EIA 계약과 어긋나므로 **미적용** —
spec-fix draft 제거. W3 는 false-gap 으로 종결.

### W7/W8 (user-guide escalate) → user-guide-writer 위임
신규 user-facing 동작(임베드 allowlist 차단·rich presentation·BYO-UI)의 가이드 페이지
`codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.{mdx,en.mdx}` 신설을
user-guide-writer 에 위임(별도 처리).
