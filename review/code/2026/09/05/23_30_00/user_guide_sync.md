# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 절차 요약

1. `.claude/config/doc-sync-matrix.json` (rows 22개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑을 SSOT 로 적재.
2. 변경 파일 목록 (prompt 기준, 실질 코드 변경 파일 1~31 — 이후 32~164 는 `plan/in-progress/**`, `review/**` 산출물이라 매트릭스 trigger 대상 아님):
   - `CHANGELOG.md`
   - `codebase/backend/src/modules/{alerts,integrations,knowledge-base,schedules,triggers}/dto/responses/*.dto.ts` (필드 선언 추가)
   - `codebase/backend/src/modules/schedules/{schedules.controller.ts,schedules.controller.spec.ts,schedules.service.ts}`
   - `codebase/backend/src/modules/triggers/{triggers.service.ts,triggers.service.spec.ts}`
   - `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.spec.ts`
   - `codebase/backend/src/repo-guards/__tests__/{swagger-dto-contract-guard.ts,swagger-dto-contract.spec.ts,fixtures/dto/responses/optional-nullable.fixture.ts}`
   - `codebase/backend/src/shared/testing/response-contract.{ts,spec.ts}`
   - `codebase/backend/test/*.e2e-spec.ts` (18개 — `assertMatchesContract` 배선)
   - `plan/in-progress/spec-draft-nullable-notation-followups.md`
3. 각 파일을 매트릭스 22개 행의 trigger (glob/semantic) 에 대조.

## 매칭 판정

- **`new-node` / `node-schema-change`** (`codebase/backend/src/nodes/**`) — 매칭 없음. 변경 파일 전부 `src/modules/{alerts,integrations,knowledge-base,schedules,triggers}` 아래이고 `src/nodes/**` 는 건드리지 않음.
- **`new-ui-string` / `new-widget-chrome-string`** (`*.tsx`) — 매칭 없음. `codebase/frontend/**`, `codebase/channel-web-chat/**` 변경이 changeset 에 전혀 없음.
- **`new-userguide-section-dir`** (`content/docs/*/`) — 매칭 없음. `content/docs/` 변경 없음.
- **`integration-provider-change`** (semantic) — `IntegrationDto` 에 `appUrl`/`mallId`/`tokenExpiresAt`/`lastRotatedAt`/`lastUsedAt`/`consecutiveNetworkFailures` 필드가 추가됐으나, diff 주석에 "**이미 응답에 실려 나가고 있었다** — 컨트롤러가 엔티티를 그대로 반환하기 때문" 이라고 명시 — 신규/변경 provider 가 아니라 §5.4 응답-계약 스윕이 찾아낸 **기존** wire 필드의 Swagger 선언 catch-up. provider 동작·설정 흐름 변경 없음 → 비매칭.
- **`backend-api-change`** (semantic, `dto/**` 글롭 기준으로는 형식상 매칭) — 아래 "발견사항" 참조. 실사용자 노출 변경이 아니라고 판단해 강등.
- **`auth-session-flow-change`** (`codebase/backend/src/modules/auth/**`) — 매칭 없음. `test/session-revocation.e2e-spec.ts` 가 `modules/auth/dto/responses/*` 를 **import** 하지만 `modules/auth/**` 소스 자체는 변경되지 않음(계약 대조 어서션만 추가).
- **`expression-language-change`** (`codebase/packages/expression-engine/**`) — 매칭 없음.
- **`run-debug-flow-change`** — 매칭 없음. 실행 엔진·디버그 로깅 변경 없음(오직 응답 DTO/계약 테스트).
- **`new-warning-code` / `new-error-code`** — 매칭 없음. `warningRules`/`error-codes.ts` 변경 없음.
- **`spec-major-change`** (`spec/2-*/**` 등) — 매칭 없음. `spec/` 파일 변경 없음(팔로우업은 `plan/in-progress/`에만 기록).

## 발견사항

- **[INFO]** `backend-api-change` semantic trigger 는 파일 글롭(`dto/**`) 기준으로는 형식상 걸리지만, 실사용자 가시 변경으로 보이지 않아 강등한다.
  - 변경 파일: `codebase/backend/src/modules/{alerts,integrations,knowledge-base,schedules,triggers}/dto/responses/*.dto.ts`
  - 매트릭스 항목: `backend-api-change` — targets "controller·DTO 의 swagger jsdoc" (diff 안에서 이미 충족 — 각 필드에 JSDoc 추가됨) + "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 상세: 추가된 필드 전부가 diff 자체 주석에 "이미 응답에 실려 나가고 있었다"(§5.4 응답-계약 스윕이 "선언되지 않은 키"로 검출)라고 명시돼 있다 — 즉 **wire 동작은 변경되지 않았고** Swagger 선언만 현실에 맞춘 것이다. 실측으로 확인한 결과:
    - `KnowledgeBaseDto.rerankMode/rerankCandidateK/rerankScoreThreshold/...` — frontend 는 이미 `kb-form-body.tsx`/`create-kb-form-dialog.tsx`/`lib/i18n/dict/{ko,en}/knowledgeBases.ts` 로 리랭크 설정 UI·i18n 을 갖추고 있음 (기존 기능).
    - `TriggerDto.chatChannelHealth/notificationHealth` — frontend 는 이미 `triggers/page.tsx`, `chat-channel-card.tsx`, `content/docs/02-nodes/{triggers.mdx,triggers.en.mdx}` 로 상태 표시·문서화가 돼 있음 (기존 기능).
    - `ScheduleDto.trigger`/`TriggerDto.workflow` 참조 필드의 spec 문서 갱신(§5.4 키-생략 사유 문서화)은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 `spec/2-navigation/2-trigger-list.md`·`3-schedule.md §4` 대상으로 명시 등재돼 있음 — 다만 대상은 `spec/`(기술 명세)이지 이 리뷰어가 감시하는 `codebase/frontend/src/content/docs/`(유저 가이드 MDX) 가 아니라서 본 매트릭스 범위 밖.
    - `ScheduleDto`/`schedules.controller.ts` 변경 중 실제 "노출 변경"은 `notificationSecretV2`/`chatChannelTokenV2` 를 트리거 참조에서 **제거**한 보안 수정인데, 이는 애초에 사용자에게 문서화된 적 없는 내부 secret 이라 유저 가이드 대상이 아니다.
  - 결론: 셋 다 이미 별도 채널에서 처리(기존 UI/문서 존재, 또는 spec 팔로업으로 이미 등재)돼 있어 이 changeset 이 유저 가이드 동반 갱신을 새로 빠뜨리지 않았다고 판단.
  - 제안: 조치 불필요. 향후 라운드에서 `spec-draft-nullable-notation-followups.md` 의 `ScheduleDto.trigger`/`TriggerDto.workflow` spec 문서화 항목이 처리될 때, 같은 김에 `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`(+`.en.mdx`) 의 워크플로우 참조 관련 설명이 이미 정확한지도 한 번 대조해 두면 좋다(선택 사항, 이번 PR 의무 아님).

## 요약

매트릭스 22개 trigger 전수를 대조한 결과 glob-매칭 trigger(신규 노드, 노드 schema, UI 문자열, 신규 섹션 디렉토리, 신규 BullMQ 큐, 신규 error-code, spec 대규모 변경 등)는 전혀 매칭되지 않았고(frontend/spec 변경이 changeset 에 없음), 유일하게 형식상 걸리는 semantic trigger 인 `backend-api-change`(DTO 변경)도 실측 결과 모두 "이미 존재하던 기능의 Swagger 선언 catch-up"이거나 "비공개 secret 제거"로, 실제 사용자 노출 변경이 아니며 관련 UI·i18n·문서는 이미 선행 PR 에서 갖춰져 있었다. 유일한 후속 문서화 항목(`ScheduleDto.trigger`/`TriggerDto.workflow` 의 spec 서술)은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 정식 등재돼 있고 대상도 `spec/`(기술 명세)이지 이 리뷰어의 대상인 `codebase/frontend/src/content/docs/` 유저 가이드가 아니다. 매칭 trigger 0건 / 누락 0건(강등된 형식적 매칭 1건은 INFO 로 기록).

## 위험도

NONE
