# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 프론트엔드 UI 컴포넌트(EmbedOrigins, EmptyState CTA) 및 `$thread` 자동완성에 대한 테스트 갭이 존재하며, `llmCalls` strip 백엔드 구현 완료 여부 확인이 필요하다. 코드 변경 자체는 최소(expression-constants.ts 1행)하며 나머지는 spec/plan 문서 정비 작업이다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `llmCalls` 외부 수신자 strip — spec 정책 확정됐으나 백엔드 fanout seam strip 구현이 이번 diff 에 없음. spec 에는 strip 명시, 실제 구현은 미완 상태가 일시 병존 가능 | `plan/complete/spec-draft-eia-strip-llmcalls.md` | fanout strip 구현 커밋이 선행 PR 에 완료됐는지 확인; 미완이면 fanout 경로 `llmCalls` 키 부재 assertion 통합 테스트 추가 후 배포 |
| 2 | 요구사항 | `spec-draft-node-execution-cancelled.md` — IE multi-turn `runTurnWithCollectionRetries` abortSignal 전파 TODO 가 `plan/complete/` 에 있음에도 완료 여부 미명시 | `plan/complete/spec-draft-node-execution-cancelled.md` L299, `information-extractor.handler.ts:634` | 실제 TODO 잔존 여부 확인 후 별도 developer plan 분리 또는 미완료 명시 |
| 3 | 테스팅 | `$thread` ROOT_VARIABLES 추가에 대한 프론트엔드 단위 테스트 부재 — `BUILT_IN_PICKER_VARIABLES` 자동 포함·`filterRootVariablesByScope` 상호작용 모두 무테스트 | `codebase/frontend/src/components/editor/expression/expression-constants.ts` | `ROOT_VARIABLES.find(v => v.label === '$thread')` 단언 + `BUILT_IN_PICKER_VARIABLES` 포함 여부 테스트 추가 |
| 4 | 테스팅 | `EmbedOriginsCard`/`EmbedOriginsEditor` UI 컴포넌트 테스트 전무 — owner/admin 저장, viewer read-only, 잘못된 형식 검증 경로 모두 미커버 | `plan/complete/spec-draft-workspace-settings-api.md` (구현 항목 기술) | 성공 경로·권한 게이트·클라이언트 검증 오류 3가지 케이스 컴포넌트 테스트 추가 |
| 5 | 테스팅 | Triggers/Schedules 빈 상태 EmptyState CTA 테스트 부재 — 검색 reset CTA 동작도 미검증 | `spec/2-navigation/11-error-empty-states.md`, `triggers-page.test.tsx`, `schedules-page.test.tsx` | 빈 상태 진입 시 EmptyState + CTA 렌더 단언 테스트 추가; Workflows 필터 reset 케이스 포함 |
| 6 | 유지보수성 | `spec/4-nodes/0-overview.md §1.4.1` filter 표의 `\|` 이스케이프 — 일부 렌더러에서 백슬래시가 그대로 출력될 수 있음 | `spec/4-nodes/0-overview.md` diff 라인 2027~2032 | 표 셀 내 `\|` 를 인라인 코드(`` ` ``)로 감싸거나 표 전체를 코드 블록으로 교체 |
| 7 | 유저가이드 동기화 | `$thread` 변수 추가 — `04-expression-language/variables-and-context.mdx`, `cheatsheet.mdx` (한·영) 미갱신 | `codebase/frontend/src/content/docs/04-expression-language/` | `variables-and-context.mdx` 및 `.en.mdx` 루트 변수 목록에 `$thread` 항목 추가; `cheatsheet.mdx` 예시 행 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `{ ignored: true }` → `{ executionId: 'ignored' }` 응답 body — 코드가 먼저 구현됐고 spec 이 코드 현실을 추격한 변경. `hooks.service.ts` 가 올바름 | `spec/5-system/12-webhook.md` WH-EP-07, `spec/5-system/15-chat-channel.md` §5.5, `spec/4-nodes/7-trigger/providers/telegram.md` | 코드 유지. chat-channel 소비자가 `executionId === 'ignored'` 패턴으로 처리하는지 확인 |
| 2 | 보안 | `$env` 자동완성 조기 노출 — allowlist 설계 없이 에디터에서 제안되며, 향후 성급한 주입 시 환경변수 전체 노출 위험 | `plan/in-progress/spec-sync-expression-language-gaps.md`, `expression-constants.ts` | `$env` 런타임 주입 구현 시 allowlist 검증·주입 가능 키 범위 제한 구현을 plan 에 명시 |
| 3 | 보안 | `$trigger`/`$env` 런타임 미주입 상태에서 ROOT_VARIABLES 등재 — 사용자가 입력하면 `undefined` 평가 | `expression-constants.ts`, `plan/in-progress/spec-sync-expression-language-gaps.md` | 런타임 주입 설계 확정 전 "미주입" 표시 메커니즘 검토 또는 자동완성 일시 제외 |
| 4 | 보안 | `interactionAllowedOrigins` CORS 빈 배열 의미 — `[]` = "모든 외부 origin 차단" invariant 가 서비스 레이어 부분 머지 로직에도 보장되는지 확인 필요 | `plan/complete/spec-draft-workspace-settings-api.md` | `updateWorkspaceSettings` 에서 빈 배열 업데이트 시 CDN origin 만 허용됨을 단위 테스트로 검증 |
| 5 | 보안 | webhook 비활성 chatChannel 트리거 — 서명 검증이 `!trigger.isActive` 검사보다 선행하는지 코드 경로 재확인 필요 | `spec/5-system/12-webhook.md` WH-EP-07, `spec/5-system/15-chat-channel.md` §5.5, `hooks.service.ts` (커밋 d12932ab) | chatChannel 분기 → 서명 검증 → isActive 검사 순서 코드 재확인 |
| 6 | 보안 | `emailVerifyToken` SHA-256 해시 저장 구현 완료 — `passwordResetToken` 도 동일 패턴 확인 및 timing-safe comparison 사용 여부 확인 | `spec/5-system/1-auth.md §1.1`, 커밋 7fc682c3 | `crypto.timingSafeEqual` 등 사용 여부 교차 확인 |
| 7 | 요구사항 | `spec-sync-execution-history-gaps.md` 가 `complete/` 에 있음에도 체크박스 미완료 상태(`- [ ]`) | `plan/complete/spec-sync-execution-history-gaps.md` L13 | `- [ ]` → `- [x]` flip (plan-lifecycle 정합) |
| 8 | 요구사항 | workspace `(owner_id,type)` UNIQUE DB 마이그레이션 갭 — `plan/in-progress/` 추적 티켓 존재 여부 미확인 | `plan/complete/spec-update-c-sync-promotions.md` L1314–1318 | 별도 developer plan 티켓 신설 확인 |
| 9 | 요구사항 | `llmCalls` strip backend 구현 plan 이 `in-progress` 에 없는 경우 별도 plan 티켓 추적 필요 | `plan/complete/spec-draft-eia-strip-llmcalls.md` | 별도 plan 티켓으로 추적 |
| 10 | 테스팅 | `notification-webhook.processor.spec.ts` — llmCalls strip 단언 없음 (이중 방어 성격) | `codebase/backend/src/modules/external-interaction/notification-webhook.processor.spec.ts` | ai_message 이벤트 처리 시 webhook payload 에 llmCalls 부재 단언 추가 |
| 11 | 테스팅 | `impl-anchor-existence.test.ts` — api-endpoint 앵커 없어 in-loop 단언 미실행(dead-letter) | `codebase/frontend/src/lib/docs/__tests__/impl-anchor-existence.test.ts` | api-endpoint 앵커 MDX 추가 시 가드 실행·통과 여부 반드시 검증 |
| 12 | 유지보수성 | `spec-update-c-sync-promotions.md` Rationale 단락 중복 서술 | `plan/complete/spec-update-c-sync-promotions.md` §Rationale | 두 번째 중복 단락 통합 또는 삭제 |
| 13 | 유지보수성 | `spec/5-system/12-webhook.md` 처리 흐름 step 5 — 인라인 설계 근거 과다(R-CC-12 (d) cross-link 존재) | `spec/5-system/12-webhook.md` diff 라인 2284 | step 5 에서 괄호 내 근거 텍스트 제거 후 `[Spec Chat Channel §5.5]` cross-link 로 대체 |
| 14 | 문서화 | `$thread` 항목 `detail` 문자열에 하위 접근자 힌트 없음 | `expression-constants.ts` 라인 35 | `detail` 을 `"Conversation thread (length, text, indexed access)"` 수준으로 보강 |
| 15 | 문서화 | `spec/4-nodes/0-overview.md §1.4.1` filter 표에 `length` 필터 미기재 | `spec/4-nodes/0-overview.md` §1.4.1 | `length` 행(문자 수 반환) 추가 + "줄 세기 불가" 각주 기술 |
| 16 | 문서화 | `information-extractor` 별건 이슈(`pushExtractorTurn no-op`) 별도 plan 티켓 신설 여부 미확인 — `$thread` 자동완성 노출과 연계되어 기능 불완전성 유발 가능 | `plan/complete/spec-sync-information-extractor-gaps.md` 비고, `information-extractor.component.ts` | 별도 plan 티켓 신설 확인; `$thread` 노출 시점에 `pushExtractorTurn no-op` 혼란 방지 문서화 주석 추가 |
| 17 | 문서화 | `spec/4-nodes/2-flow/1-workflow.md §7` `warnWhen` DSL cross-ref 없음 | `spec/4-nodes/2-flow/1-workflow.md §7` | `warnWhen` 평가 규약 정의 spec 문서로 cross-ref 추가 |
| 18 | 문서화 | `spec-update-c-sync-promotions.md` 언급 후속 plan 파일(`switch-regex-noop-fix.md`) 실제 생성 여부 미확인 | `plan/complete/spec-update-c-sync-promotions.md §3` | `plan/in-progress/switch-regex-noop-fix.md` 존재 여부 확인 |
| 19 | 유저가이드 동기화 | workspace settings API/UI user-guide 동반 갱신 — plan 에서 `[x]` 체크됐으나 MDX 변경이 changeset 에 없음 | `plan/complete/spec-draft-workspace-settings-api.md` | 동일 PR 또는 별도 PR 에 MDX 변경이 포함됐는지 확인; 별도 PR 이면 링크 명시 |
| 20 | 부작용 | `$thread` scope-gate 없음(전역) — 백엔드가 AI Agent 노드에서만 `$thread` 를 주입하는 경우 다른 노드에서 undefined UX 노이즈 발생 가능 | `expression-constants.ts` 라인 74, `filterRootVariablesByScope` | AI Agent 컨텍스트 한정이 필요하면 `ContainerScopeFlags.hasThread` 추가 검토 (현재는 spec 에서 전역 접근 허용으로 우선순위 낮음) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `llmCalls` strip 구현 미확인(WARNING), `$env` 조기 노출, chatChannel 서명 검증 순서 확인 필요 |
| requirement | LOW | SPEC-DRIFT(`executionId: 'ignored'`), IE abortSignal TODO 완료 여부 미확인(WARNING), execution-history 체크박스 미flip |
| scope | NONE | 전 변경 의도 범위 내, 코드 변경 1건(`$thread` 1행) + plan/spec 문서 정비 |
| side_effect | LOW | `BUILT_IN_PICKER_VARIABLES` 자동 파생(의도된 연쇄), spec frontmatter status 변경의 gate 영향 낮음 |
| maintainability | LOW | filter 표 `\|` 이스케이프 노이즈(WARNING), step 5 인라인 서사 과다, Rationale 단락 중복 |
| testing | MEDIUM | 프론트엔드 신규 UI 테스트 갭 3건(WARNING) — `$thread`, EmbedOrigins, EmptyState CTA |
| documentation | LOW | `$thread` detail 힌트 부재, filter 표 `length` 누락, `pushExtractorTurn no-op` 추적 plan 부재 |
| user_guide_sync | LOW | `$thread` 관련 `04-expression-language/` MDX 미갱신(WARNING 1건), workspace settings MDX 확인 필요 |

---

## 발견 없는 에이전트

- **scope**: 전체 변경이 선언된 작업 범위(spec-inprogress-groom) 내에서 이루어졌으며 범위 초과 수정 없음.

---

## 권장 조치사항

1. **[보안·우선]** `llmCalls` fanout strip 백엔드 구현 완료 여부 확인 — 미완이면 `notification-webhook.processor` 등 fanout 경로에 `llmCalls` 키 부재 assertion 통합 테스트 추가 후 배포.
2. **[테스팅]** `EmbedOriginsCard`/`EmbedOriginsEditor` 컴포넌트 테스트 신설 (성공 경로·viewer read-only·클라이언트 검증 3케이스).
3. **[테스팅]** `$thread` ROOT_VARIABLES / `BUILT_IN_PICKER_VARIABLES` 포함 단위 테스트 추가.
4. **[테스팅]** Triggers/Schedules EmptyState CTA 및 Workflows 필터 reset 테스트 추가.
5. **[유저가이드]** `04-expression-language/variables-and-context.mdx` 및 `cheatsheet.mdx` (한·영) 에 `$thread` 항목 추가.
6. **[요구사항]** `information-extractor.handler.ts:634` IE abortSignal 전파 TODO 잔존 여부 확인; 잔존 시 별도 developer plan 신설.
7. **[유지보수성]** `spec/4-nodes/0-overview.md §1.4.1` filter 표의 `\|` 이스케이프를 인라인 코드로 교체; `length` 필터 행 추가.
8. **[문서화]** `information-extractor` `pushExtractorTurn no-op` 별건 이슈 plan 티켓 신설 확인.
9. **[마이너]** `spec-sync-execution-history-gaps.md` 체크박스 `- [ ]` → `- [x]` flip.
10. **[마이너]** workspace `(owner_id,type)` UNIQUE DB 마이그레이션 갭 추적 plan 티켓 존재 여부 확인 및 신설.

---

## 라우터 결정

라우터 선별 실행 (`routing_status=done`).

- **실행 (forced by router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`, `user_guide_sync` (8명)
- **제외**: 아래 표 참조 (6명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 선별 제외 |
| architecture | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |