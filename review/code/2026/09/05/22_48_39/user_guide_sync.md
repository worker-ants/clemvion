# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

- **[INFO]** 변경 파일 다수가 `.claude/config/doc-sync-matrix.json` 의 `backend-api-change` 행 glob(`codebase/backend/src/**/dto/**`, `codebase/backend/src/**/*.controller.ts`) 에 매칭되지만, 실제로는 동반 갱신이 필요한 "API 노출 변경" 이 아니라고 판단했다 — 조치 불요.
  - 변경 파일: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`, `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`, `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts`, `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts`, `codebase/backend/src/modules/schedules/schedules.controller.ts`, `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`
  - 매트릭스 항목: `backend-api-change` — "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" (PROJECT.md §142행)
  - 판단 근거:
    1. **target (a) 는 같은 커밋 안에서 이미 충족됐다** — 새로 선언된 필드 전부에 `@ApiProperty`/`@ApiPropertyOptional` 데코레이터와 필드 JSDoc(예: `/** 생성한 사용자 ID (없으면 null) */`)이 동반됐다. `introspectComments` 가 이를 OpenAPI description 으로 끌어올린다(swagger.md §3, `response-contract.ts:328` 주석 인용).
    2. **target (b) 는 "노출 변경" 자체가 없다.** CHANGELOG.md("Unreleased — 트리거 회전 secret 이 두 엔드포인트로 나갔다") 와 각 DTO 파일의 인접 주석이 명시하듯, 새로 선언된 24개 필드는 "**이미 응답에 실려 나가고 있었다** — 컨트롤러가 엔티티를 그대로 반환하기 때문" 이고 "**프런트엔드가 실제로 소비**" 하고 있었다 (`ScheduleTriggerRefDto`/`TriggerWorkflowRefDto` 주석은 소비처를 `schedules/page.tsx`·`triggers/page.tsx` 로 구체적으로 지목). 즉 이번 변경은 **wire 변경이 아니라 Swagger 선언을 실제 동작에 맞춘 문서 정정** + 회전 secret 유출 차단(노출 **축소**) 이다. 사용자가 UI 에서 보는 화면은 변경 전후 동일하다.
  - 결론: 사용자 안내 페이지(`06-integrations-and-config/`, 스케줄/트리거 관련 페이지 등)가 이미 기존 UI 동작을 설명하고 있다면 그 서술은 이번 변경으로 stale 해지지 않는다. 다만 이는 리뷰어 판단(semantic match)이므로, 만약 별도로 `06-integrations-and-config/` 페이지가 `appUrl`/`mallId`/`rerankMode` 등을 필드 단위로 나열하는 표를 갖고 있다면 그 표만 대조 확인할 가치는 있다 — grep 결과 해당 필드명이 `codebase/frontend/src/content/docs/06-integrations-and-config/**` 에 나타나지 않아 실질 갱신 대상은 없는 것으로 확인했다.
  - 제안: 조치 불요. 후속 PR 에서 `IntegrationDto.consecutiveNetworkFailures` 노출을 실제로 제거하는 wire 변경이 나가면(CHANGELOG 에 이미 별도 항목으로 예고됨) 그때는 진짜 "API 노출 변경" 이므로 이 매트릭스 행이 다시 매칭돼야 한다.

## 확인한 비매칭 trigger (참고)

- **새 노드 추가 / 노드 schema 변경** — `codebase/backend/src/nodes/**` 변경 없음. 비매칭.
- **신규 UI 문자열(TSX)** — `codebase/frontend/src/**/*.tsx` 변경 없음(이번 changeset 은 frontend 파일을 전혀 건드리지 않음). 비매칭.
- **통합 신규/제공자 변경** — 신규 provider 추가나 provider 동작 변경 없음(기존 cafe24/makeshop integration 의 이미 존재하던 응답 필드를 DTO 에 선언했을 뿐). 비매칭.
- **유저 가이드 신규 섹션 디렉토리** — `codebase/frontend/src/content/docs/*/` 신규 디렉토리 없음. 비매칭.
- **인증·권한·세션 흐름 변경** — `codebase/backend/src/modules/auth/**` 경로 파일이 이번 changeset 에 하나도 없다(`session-revocation.e2e-spec.ts`·`workspace-rbac.e2e-spec.ts`·`webhook-trigger.e2e-spec.ts` 는 기존 auth/auth-config DTO 를 **import** 해 계약 검증 호출만 추가했을 뿐, `src/modules/auth/**` 자체는 미변경). 비매칭.
- **표현식 언어 변경** — `codebase/packages/expression-engine/**` 변경 없음. 비매칭.
- **실행·디버깅 흐름 변경** — 실행 엔진·디버그 로깅 로직 변경 없음(`execution-park-resume.e2e-spec.ts` 는 계약 검증 호출 1줄 추가일 뿐, 실행 흐름 자체는 불변). 비매칭.
- **신규 warningCode/errorCode 발행** — `warningRules` 또는 `error-codes.ts` 변경 없음. 비매칭.
- **신규 backend zod ui.label/hint 값** — 변경 없음. 비매칭.

변경 set 파일 32개 중 나머지(`review/code/**`, `review/consistency/**` 하위 42개 파일)는 이전 라운드 리뷰 산출물 아카이브로, 코드/문서 동반 갱신 매트릭스의 대상이 아니다.

## 요약

매트릭스 20개 trigger 행 중 glob 상으로 유일하게 매칭된 것은 `backend-api-change`(DTO/controller 파일 변경) 1건이며, semantic 판단 결과 이 변경은 "이미 실려 나가던 필드를 선언에 반영한 문서 정정 + secret 유출 차단"이라 사용자 가시 동작 변화가 없어 동반 갱신이 실질적으로 불필요하다고 판단했다(swagger jsdoc target 은 같은 커밋에서 이미 충족). 나머지 8개 semantic/glob trigger(노드·UI 문자열·통합·신규 섹션·인증·표현식·실행/디버깅·warning/error code)는 전부 비매칭 — 이번 changeset 은 `codebase/frontend/**` 를 전혀 건드리지 않는 순수 backend 응답-계약 스윕이다. 동반 갱신 누락(CRITICAL/WARNING)은 발견되지 않았다.

## 위험도

NONE
