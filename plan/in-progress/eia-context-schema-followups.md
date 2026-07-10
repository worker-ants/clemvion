---
worktree: (unstarted)
started: 2026-07-10
owner: developer
---

# EIA context 스키마화 — 후속 항목

> 출처: `plan/complete/spec-draft-eia-context-schema-absence-convention.md` (PR: EIA `getStatus.context` 닫힌 oneOf 스키마화 + 부재 표현 §5.4 명문화).
> 본 plan 은 그 PR 의 리뷰 게이트(`/ai-review` 23_20_33, `/consistency-check --impl-prep` 22_50_15 / `--impl-done` 23_46_04)에서 **비차단 INFO/Warning 으로 분리 합의된** 잔여 항목만 추적한다. 전부 배포 실동작 무영향.

## 항목

- [ ] **`external-interaction` 모듈 응답 DTO 위치 정규화** — [swagger.md §5-1](../../spec/conventions/swagger.md) 은 `dto/responses/*-response.dto.ts` 를 규정하고 25개 모듈이 이를 따르나, `external-interaction` 만 flat `dto/responses.dto.ts` 다. 신규 variant DTO 4종이 이 flat 파일에 추가되며 편차가 커졌다. `dto/responses/` 서브디렉토리로 이관 + import 표면 갱신.
  - 근거: `--impl-prep` W1 (`convention_compliance`). 본 PR 범위(스키마 안전성) 대비 import 표면이 넓어 분리.

- [ ] **EIA client 타입의 `context` 정밀화 (2곳)** — backend 만 닫힌 union 으로 정밀화돼 클라이언트 타입과 비대칭이다. 둘 다 `context?: Record<string, unknown> | null` 로 남아 있다.
  - `codebase/channel-web-chat/src/lib/eia-types.ts` — `ExecutionStatus.context`
  - `codebase/packages/sdk/src/client.ts` — `@workflow/sdk` 공식 EIA client SDK 의 `ExecutionStatus.context` (**`--impl-done` I1 이 추가 검출** — 최초 계획은 위젯만 지목했다)
  - 두 곳 모두 `ButtonsContext | NodeOutputContext` variant union 으로 좁힌다. 판별은 `discriminator` 가 아니라 **키 존재**(`'buttonConfig' in context`) — `interactionType` 은 unsound 판별자다.

- [ ] **swagger.md §1-4 본문에 "형태 고정이지만 SoT 이중화 회피로 여는" 예외 명시** (planner 트랙) — §1-4 본문은 열린 map 을 "키 집합이 런타임 결정" 으로 정의하는데, `conversationThread` 는 형태가 고정([conversation-thread §1.3](../../spec/conventions/conversation-thread.md))인데도 SoT 이중화를 피하려고 열어 둔다. 근거가 §Rationale 에만 있어 본문만 읽으면 §1-4 위반으로 오독될 수 있다. 본문에 한 절 추가.
  - 근거: `--impl-done` I2 (`convention_compliance`). 원 PR 에서 고치지 않은 이유 = spec 편집이라 planner 트랙이고, 그 시점에 고치면 방금 통과한 `--impl-done` 산출물이 stale 해진다.

- [ ] **`terminal-revoke-reconciler.types.ts:6` 의 spec 상대링크 off-by-one** — `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.types.ts` 의 링크가 `../`×4 인데 5단계가 필요하다. `responses.dto.ts` 에서 고친 것과 **동일 버그 클래스**(회귀 아님, 사전 존재). `spec-link-integrity.test.ts` 가드가 backend 소스를 스캔하지 않아 자동 검출되지 않는다.
  - 근거: fresh ai-review(`review/code/2026/07/10/23_59_09/`) `documentation` INFO. 원 PR 에서 미조치한 이유 = 그 커밋 범위 밖이라, 고치면 방금 통과한 fresh review 가 다시 stale 해진다.
  - **함께 검토**: backend/`channel-web-chat` 소스의 spec 상대링크를 스캔하는 가드를 `spec-link-integrity.test.ts` 에 추가할지. 이 버그 클래스가 두 번 나온 시점에서 자동화 가치가 있다.

## 비고

- 원 PR 에서 **의도적으로 미조치**한 항목(재검토 불요):
  - variant 에 `additionalProperties: false` 미부여 — `oneOf` 상호배타를 스키마로 강제하지 않는다. 조립부가 두 키를 동시에 싣는 분기가 없고(진리표 검증), `false` 를 걸면 향후 봉투 필드 추가가 기존 클라이언트를 깬다.
  - `getStatus` 의 `buildWaitingContext()` 헬퍼 추출 — 원 PR 은 "런타임 무변경" 이 계약이라 범위 밖. 다음 관련 변경 시 후보.
