---
worktree: eia-client-context-types-33e771
started: 2026-07-10
owner: developer
---

> **진행(2026-07-11)**: 아래 항목 중 **클라이언트 `context` 타입 정밀화**(위젯 + SDK)와 **spec 링크 가드 backend 확장**을 이번 PR(worktree `eia-client-context-types-33e771`)에서 처리한다. 나머지 2건(DTO 디렉토리 정규화 · swagger §1-4 본문 보강)은 범위 밖으로 남긴다.

# EIA context 스키마화 — 후속 항목

> 출처: `plan/complete/spec-draft-eia-context-schema-absence-convention.md` (PR: EIA `getStatus.context` 닫힌 oneOf 스키마화 + 부재 표현 §5.4 명문화).
> 본 plan 은 그 PR 의 리뷰 게이트(`/ai-review` 23_20_33, `/consistency-check --impl-prep` 22_50_15 / `--impl-done` 23_46_04)에서 **비차단 INFO/Warning 으로 분리 합의된** 잔여 항목만 추적한다. 전부 배포 실동작 무영향.

## 항목

- [ ] **`external-interaction` 모듈 응답 DTO 위치 정규화** — [swagger.md §5-1](../../spec/conventions/swagger.md) 은 `dto/responses/*-response.dto.ts` 를 규정하고 25개 모듈이 이를 따르나, `external-interaction` 만 flat `dto/responses.dto.ts` 다. 신규 variant DTO 4종이 이 flat 파일에 추가되며 편차가 커졌다. `dto/responses/` 서브디렉토리로 이관 + import 표면 갱신.
  - 근거: `--impl-prep` W1 (`convention_compliance`). 본 PR 범위(스키마 안전성) 대비 import 표면이 넓어 분리.

- [x] **EIA client 타입의 `context` 정밀화 (2곳)** — 위젯 `eia-types.ts`·SDK `client.ts` 둘 다 `ButtonsContext | NodeOutputContext` variant union 으로 좁힘. 판별=키 존재(`'buttonConfig' in context`), discriminator 아님. conversationThread 키 생략(`|null` 금지). 위젯 `as WaitingForInputEvent` 캐스트 제거, negative `@ts-expect-error` 테스트로 union 닫힘 고정, SDK 를 harness(cmd_unit/cmd_build)에 배선. lint·unit·build·e2e(250) 통과. (PR: `eia-client-context-types-33e771`)

- [ ] **swagger.md §1-4 본문에 "형태 고정이지만 SoT 이중화 회피로 여는" 예외 명시** (planner 트랙) — §1-4 본문은 열린 map 을 "키 집합이 런타임 결정" 으로 정의하는데, `conversationThread` 는 형태가 고정([conversation-thread §1.3](../../spec/conventions/conversation-thread.md))인데도 SoT 이중화를 피하려고 열어 둔다. 근거가 §Rationale 에만 있어 본문만 읽으면 §1-4 위반으로 오독될 수 있다. 본문에 한 절 추가.
  - 근거: `--impl-done` I2 (`convention_compliance`). 원 PR 에서 고치지 않은 이유 = spec 편집이라 planner 트랙이고, 그 시점에 고치면 방금 통과한 `--impl-done` 산출물이 stale 해진다.

- [x] **spec 링크 가드 codebase 확장 + 깨진 링크 전수 수정** (terminal-revoke off-by-one 포함) — `spec-link-integrity.test.ts` 가드를 `codebase/{backend,frontend,channel-web-chat,packages}` 소스로 확장(`collectCodebaseSources`/`findBrokenSpecLinksInSources`), spec 향하는 링크만 DEAD+ANCHOR 검증. 드러난 깨진 링크 16곳 전수 정정(chat-channel/types.ts DEAD 8·ANCHOR 4, chat-channel-config.dto.ts 1, terminal-revoke 1, frontend widgets.tsx·multi-select-test 2). `spec-impl-evidence.md §4.2` SoT 표 + test 주석 동기화. lint·unit·build·e2e(250) 통과.
  - 근거: fresh ai-review(`review/code/2026/07/10/23_59_09/`) `documentation` INFO 로 시작, 본 PR 에서 자동화. frontend/src 포함은 ai-review 11_44_59 지적 반영.
  - **함께 검토**: backend/`channel-web-chat` 소스의 spec 상대링크를 스캔하는 가드를 `spec-link-integrity.test.ts` 에 추가할지. 이 버그 클래스가 두 번 나온 시점에서 자동화 가치가 있다.

## 리뷰 후속 (ai-review 11_44_59 에서 분리 — 본 PR 밖)

- [ ] **channel-web-chat 타입체크를 harness 에 배선** (C2) — `test`=`vitest run`(esbuild 타입 strip)이라 타입 테스트(`WaitingContext` 캐스트-free 컴파일, `@ts-expect-error` negative)가 실제로 타입체크되지 않는다. `typecheck`(`tsc --noEmit`)를 harness `unit`/`build` 에 넣어야 하나, 현재 **pre-existing red**(`use-widget-eager-start.test.ts`·`presentation.test.ts` 등 mock 타입 에러 ~10건, 본 PR 무관 — 실측)라 먼저 그 정리가 필요. 정리 후 `tsc --noEmit` 을 stage 에 추가.
- [ ] **spec-link 가드의 CI trigger 확대** (W-spec-link-ci) — 가드는 `codebase/frontend` vitest 에 있는데 `frontend-checks.yml` trigger paths 가 backend/channel-web-chat 를 제외한다 → PR 이 backend 링크만 바꾸면 CI 에서 이 가드가 안 돈다(harness `unit` 은 무조건 돌리므로 로컬/harness 는 커버, CI PR-trigger 만 갭). `.github/workflows/frontend-checks.yml` 의 paths 확대 또는 별도 workflow.
- [ ] **`spec-links.ts` 중복 정리** — `collectCodebaseSources`/`findBrokenSpecLinksInSources` 가 기존 `collectSpecMarkdown`/`findBrokenLinks` 와 ~40줄 골격 중복. 파일-목록 파라미터화한 코어로 추출 여지(동작은 정확, 저우선).
- [ ] **다른 내부 packages harness 배선** — `.claude/test-stages.sh` 가 `@workflow/sdk`(본 PR 에서 추가)·`@workflow/web-chat`·`channel-web-chat` 만 배선. `expression-engine`·`graph-warning-rules`·`node-summary`·`chat-channel-validation`·`web-chat-sdk` 는 미배선(기존 갭). 별도 검토.
- [ ] **EventSource stub 공용 헬퍼 추출** — `use-widget-eager-start.test.ts` 4곳이 EventSource stub(`class {...} as unknown as typeof EventSource`)을 손복사한다. 기존 `installControllableSse()` 팩토리로 통합해 타입-우회 캐스트를 한 곳에 모을 것. (가드 실효성 PR ai-review 13_35_47 maintainability.)
- [ ] **`packages/sdk` eslint 커버리지** — `@workflow/sdk` 에 `eslint.config.*` 가 없어 production 코드 lint 가 harness/CI 어디서도 안 돈다(web-chat-checks sdk-client job 도 lint 생략). eslint config 추가 + 배선. (가드 실효성 PR ai-review 13_58_56 INFO.)
- [ ] **`spec-impl-evidence.md §4.2` 편집 절차 사후 확인** (planner/사용자) — 본 PR 에서 developer 가 가드 확장에 수반해 §4.2 SoT 표를 직접 편집했다(CLAUDE.md 상 `spec/` 는 planner 트랙). 정합화 성격이라 impl-done 이 사후 검증했으나, convention checker 가 "subagent write isolation 논리 혼동" 을 지적 — 절차상 planner 가 사후 리뷰하거나, 향후 유사 정합화의 경계를 명확히 할 것.

## 비고

- 원 PR 에서 **의도적으로 미조치**한 항목(재검토 불요):
  - variant 에 `additionalProperties: false` 미부여 — `oneOf` 상호배타를 스키마로 강제하지 않는다. 조립부가 두 키를 동시에 싣는 분기가 없고(진리표 검증), `false` 를 걸면 향후 봉투 필드 추가가 기존 클라이언트를 깬다.
  - `getStatus` 의 `buildWaitingContext()` 헬퍼 추출 — 원 PR 은 "런타임 무변경" 이 계약이라 범위 밖. 다음 관련 변경 시 후보.
