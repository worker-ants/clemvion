---
worktree: spec-frontmatter-status-rest-84fe70
started: 2026-05-29
owner: project-planner
---

# Plan — spec frontmatter `status` 전반 마이그레이션 (spec-only → 실상태)

> spec-impl-evidence 규약(2026-05-23 도입)의 `status` 라이프사이클을 프로젝트 전반에
> 적용한다. 현재 대부분 spec 이 전환기 기본값 `spec-only` 로 남아 있다.

## 동기 / 배경

- 트리거: PR #355 변경 7 조사 (project-planner, 2026-05-29). 단일 spec(`4-execution-engine`)
  frontmatter 전이를 검토하다 **프로젝트 전반 현상**임을 확인.
- **TTL 가드는 spec 별 생성일이 아니라 규약 도입일(2026-05-23) + 90일 = `2026-08-21` 공통 deadline**
  (`codebase/frontend/src/lib/docs/__tests__/spec-status-lifecycle.test.ts:19-22`).
  현재(5/29) 모든 `spec-only` 가 TTL 내라 빌드 통과 — 하지만 **8/21 이후 `spec-only`
  잔존 시 build fail**. 그 전에 실상태로 전이해야 한다.
- 현황 (2026-05-29, `spec/**.md` frontmatter status 보유 104개):
  - `spec-only` **96** · `implemented` 6 · `partial` 2

## 전이 규칙 (spec-impl-evidence §3 요약)

| 목표 status | 조건 | `code:` | `pending_plans:` |
| --- | --- | --- | --- |
| `implemented` | 약속 surface 전부 구현 | ≥1 glob 매치 의무 | 없음 |
| `partial` | 일부 구현 | ≥1 매치 의무 | **≥1 (in-progress 실존) 의무** |
| `backlog` | 장기 로드맵 — 구현 의도 미결정 (spec-impl-evidence §3) | 비어도 OK | — (`0-overview §6.3` 로드맵 매칭 **의무 — 가드**) |
| `archived` | 폐기 | — | — |

> 가드 4종: `spec-frontmatter` / `spec-code-paths` / `spec-status-lifecycle` / `spec-pending-plan-existence` (frontend vitest).

## 분류 방법론 (per-spec)

각 spec 에 대해:
1. 본문이 약속한 surface 식별 (UI / API / 동작).
2. `code:` glob 후보 도출 (구현 모듈/컴포넌트/마이그레이션 경로).
3. 갭 판정 — 전부 구현되면 `implemented`, 미구현 잔존 시 `partial` (+ owning plan 확인/신설) 또는 `backlog`.
4. `/spec-coverage` 산출물을 1차 입력으로 활용 가능 (NLP 휴리스틱 — 최종 판정은 수동).
5. spec 본문의 stale "예정/미구현" 문구도 함께 정정.

## 배치 (도메인별)

| 배치 | 영역 | spec-only 수 | 상태 |
| --- | --- | --- | --- |
| B0 | `5-system/4-execution-engine` (anchor) | 1 | ✅ 본 PR 에서 worked example 로 전이 (아래) |
| B1 | `5-system/` 나머지 | 10 | ✅ (이 PR — §B1–B4 결과) |
| B2 | `4-nodes/` (logic·flow·ai·integration·data·presentation·trigger) | 35 | ✅ (이 PR) |
| B3 | `3-workflow-editor/` | 5 | ✅ (이 PR) |
| B4 | `2-navigation/` | 14 | ✅ (이 PR) |
| B5 | `conventions/` (cafe24-api-catalog 18 + 기타 13) | ~31 | ✅ (이 PR — 아래 §B5 결과) |
| B6 | `7-channel-web-chat/` (architecture·widget-app·sdk·auth-session·security) | 0 | N/A — 이미 전이됨. 5개 모두 `status: partial` + `pending_plans: [channel-web-chat-impl, channel-web-chat-followups]`. 양 plan 완료 시 `implemented` 전이 (가드 scope 내) |

> 각 배치는 별 PR 권장 (리뷰 단위 관리 + consistency-check 부담 분산). cafe24-api-catalog 는
> 외부 API 카탈로그(레퍼런스 성격)라 `implemented` 또는 `archived`/`backlog` 일괄 판정 가능성 높음 — 우선 검토.

## B0 — execution-engine anchor (본 PR 실행분)

- [x] 본문 stale 정정: `_multiTurnState` legacy fallback "제거 예정"(§1.x) → 이미 제거됨 / presentation status "`resumed` 통일 예정"(§1.x) → 이미 통일됨.
- [x] frontmatter: `status: partial` + `code: codebase/backend/src/modules/execution-engine/**` + `pending_plans: [plan/in-progress/execution-engine-residual-gaps.md]`.
- [x] 미구현 surface(G1 WS start gate / G2 errorPolicy continue / G3 seq TTL)는 `execution-engine-residual-gaps.md` 가 인수.

## B5 — conventions 결과 (이 PR, 2026-05-31)

29개 `spec/conventions/**` frontmatter 를 `spec-only` → 실상태로 전이.

**검증 (실측, 2026-05-31)**: 4 가드 vitest (`spec-{frontmatter,code-paths,status-lifecycle,pending-plan-existence}`). B5 가 건드린 29개 파일은 처음부터 전부 통과. 초기 실행 시 잔여 2 fail 은 **B5 무관·origin/main 기존 결함** — `spec/conventions/chat-channel-adapter.md`·`spec/5-system/15-chat-channel.md` 가 `status: partial` 인데 `pending_plans: []` (`git diff origin/main` 무차이로 확인). **사용자 결정에 따라 이 PR 에서 함께 해소** — 두 파일에 `pending_plans: [chat-channel-discord-gateway, chat-channel-slack-socket-mode, chat-channel-visual-ssr-png]` 추가. 최종 결과: **Tests 631 passed, 0 failed**. `/consistency-check --spec` 5-checker workflow 결과 **BLOCK: NO** (Critical 0; Warning 은 모두 본 plan 문서 stale 기재 — 같은 PR 에서 정정). 결과: `review/consistency/2026/05/31/17_12_00/SUMMARY.md`.

- **18 cafe24-api-catalog/<domain>.md → `implemented`**: code `codebase/backend/src/nodes/integration/cafe24/metadata/<domain>.ts` (도메인별 메타데이터 파일. `registry/` 하위가 아니라 `metadata/` 직속 — 인계 메모의 `registry/` 추정은 오류였음). 18 도메인 전부 `supported` row 보유 → 카탈로그가 약속한 surface(메타데이터) 구현 완료. `planned` row 는 카탈로그 내부 로드맵 표기라 frontmatter 와 별 도메인(`_overview.md §3`).
- **`cafe24-api-metadata` → implemented** (`metadata/**`).
- **`cafe24-restricted-scopes` → partial** (`metadata/restricted-approval.ts`, pending `cafe24-restricted-scopes-followups.md`).
- **`conversation-thread`·`data-hydration-surfaces`·`i18n-userguide`·`interaction-type-registry`·`migrations`·`secret-store`·`swagger`·`user-guide-evidence` → implemented**.
- **`node-output` → partial** (`nodes/core/node-handler.interface.ts` + `execution-engine/handler-output.adapter.ts`, pending `node-output-redesign/README.md`).
- 본문 stale 정정 1건: `user-guide-evidence.md §1.1` 컴포넌트 경로 `components/docs/impl-anchor.tsx` → `components/docs/mdx/impl-anchor.tsx`.
- 주의 (인계 메모 정정): 여러 spec 본문이 stale 경로를 갖고 있었으나 frontmatter `code:` 는 실경로로 검증해 채웠다 — migrations 는 `codebase/backend/migrations/`(src 아님), conversation-thread 는 `src/shared/conversation-thread/`, swagger 는 `src/common/swagger/`(+nest-cli plugin, backlog 아님). `_overview.md` 는 `_` basename 이라 가드 대상 외 — `spec-only` 유지(무변경).

> B1–B4 결과는 아래 §B1–B4 결과 참조 (이 PR 에서 전수 전이 완료). B6 `7-channel-web-chat` 는 이미 partial 전이됨.

## 권고 후속 흐름

1. **B0·B5·B1·B2·B3·B4 전 배치 전이 완료** (이 PR 로 64개 잔여 처리). 남은 것은 §사용자 결정 대기 항목 3건뿐 — 8/21 deadline 전 사용자 결정 필요.
2. 분류 절차(참고): project-planner 가 본문 surface 확정 → frontmatter(`status`+`code:` glob, partial 시 `pending_plans:` 실존 plan) 적용 → `/consistency-check --spec` → 4 가드 vitest.
3. `backlog` 격하는 `0-overview §6.3` 로드맵 매칭이 실제 가능한 spec 에만 적용 (가드 (d) — 임의 보류 금지, spec-impl-evidence R-2·R-3). 그 외 미완 spec 은 `spec-only` 유지 또는 `partial`(+pending_plan).

## 영향받지 않는 영역

- 코드 변경 없음 (frontmatter + spec 본문 문구 정정만). build-guard 는 frontend vitest.
- `implemented`(6)·`partial`(2) 기존 spec 은 대상 외.

## B1–B4 결과 (이 PR, 2026-05-31)

잔여 64개 `spec-only` (B1 `5-system` 10 · B2 `4-nodes` 35 · B3 `3-workflow-editor` 5 · B4 `2-navigation` 14) 를 영역별 분류 sub-agent fan-out (7 batch) 으로 전수 분류 후 전이. 노드 spec 은 backend handler/schema/spec + (프레젠테이션) frontend 렌더러 + (트리거) config UI 까지 실파일 매치 검증. `node-output-redesign/<node>.md` plan 은 **이미 구현된 노드의 output polish** 라 pending_plans 에서 제외 (미구현 surface 아님).

**전이 결과 (64개)**:
- **implemented 55**: 5-system 8 (2-api-convention·3-error-handling·5-expression-language·7-llm-client·8-embedding-pipeline·9-rag-search·11-mcp-client·12-webhook) · 4-nodes logic 13 + flow 2 + ai 3 (0-common·2-text-classifier·3-information-extractor) + data 3 + integration 4 (0-common·http-request·database-query·send-email) + presentation 5 + trigger 3 = 33 · 3-workflow-editor 2 (1-node-common·4-ai-assistant) · 2-navigation 12 (0~7 + 9-user-profile·10-auth-flow·12-version-history·14-execution-history).
- **partial 5** (+pending_plans): `5-system/1-auth` → `auth-config-webhook-followups` (§4.1 AuthConfig 감사로그 5종 중 4종 미기록) · `4-nodes/3-ai/1-ai-agent` → `ai-agent-tool-connection-rewrite` (일반 도구연결 `tool_*` 제거·재작성 예정) · `4-nodes/4-integration/4-cafe24` → `cafe24-restricted-scopes-followups` (§8.3/§9.11 operation-grouping 승인 UI + §2 invalid_scope 분기 미구현) · `3-workflow-editor/0-canvas`·`2-edge` → `ai-agent-tool-connection-rewrite` (§12/§7 Tool Area 제거·재작성 예정).
- **backlog 1**: `2-navigation/8-marketplace` (구현 0건, `0-overview §6.3 로드맵 마켓플레이스(❌)` 매칭, backlog 가드 충족).
- **stale 본문 정정 1건**: `2-navigation/14-execution-history.md` EH-DETAIL-10/11 + §5 API 표 "🚧 구현 PR2" → ✅/제거 (Re-run/chain 프론트·백엔드 구현 완료 확인).
- **검증**: 4 가드 vitest (`spec-{frontmatter,code-paths,status-lifecycle,pending-plan-existence}`) **767 passed**.

### 사용자 결정 대기 항목 (3개 — `spec-only` 유지)

> 미구현 surface 가 실재하나 이를 책임지는 in-progress plan 이 없어 implemented/partial 자동 분류 불가. 각 항목은 (a) 신규 plan 신설 → partial, (b) backlog/spec 본문 개정으로 축소·연기, (c) 이미 충분하다고 보고 spec 개정 → implemented 중 제품 결정 필요.
> **⏰ 셋 다 `spec-only` 라 TTL 2026-08-21 적용 — 그 전에 결정하지 않으면 build fail.**

- [ ] **`spec/5-system/6-websocket-protocol.md`** — §6.2/§4.6 의 native WS `subscribe.lastSeq` 5분 버퍼-replay + `replay.unavailable` 이벤트가 WS 경로엔 미배선(snapshot 기반 복구). 버퍼-replay 는 SSE 전송(`external-interaction/sse-adapter`)에만 존재. → WS spec 을 SSE 전용으로 정정(implemented)할지, 미구현 surface 로 보고 plan 신설(partial)할지. (cross-spec W2: `spec/5-system/14-external-interaction-api.md` §738 "5분 버퍼 공유" 문구도 함께 정정 필요. `spec-drift-ws-button-config.md` 와 동일 파일 변경 가능성 — 함께 처리 가능.)
- [ ] **`spec/3-workflow-editor/3-execution.md`** — §6 Breakpoints/Step Over/Continue (WS `execution.continue`·`execution.step`) 프론트·백엔드 전무. docs MDX 는 기능 안내 중. 그 외 surface 전부 구현. → plan 신설(partial) / backlog 격하 / §6 제거 중 결정. (cross-spec W1: implemented 인 `14-execution-history`·partial 인 `5-system/4-execution-engine` 가 본 spec 을 참조.)
- [ ] **`spec/2-navigation/11-error-empty-states.md`** — §2 빈 상태는 광범위 구현됨(`components/ui/empty-state.tsx`). 그러나 §1 전체화면 에러 페이지 5종(401/403/404/500/네트워크)은 미구현(`app/` 에 `not-found.tsx`/`error.tsx`/`global-error.tsx` 부재). → 에러 페이지 plan 신설(partial) / 축소·연기 / interceptor 방식으로 충분하다 보고 §1 개정(implemented) 중 결정.
