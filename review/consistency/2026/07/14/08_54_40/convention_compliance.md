# 정식 규약 준수 검토 — spec/5-system/14-external-interaction-api.md (impl-done, F-1/F-2 nodeId 불일치 가드)

## 검토 범위 메모

payload 의 "## 정식 규약 모음" 절에는 `audit-actions.md` · `cafe24-api-catalog/**` 만 포함되어 있었고,
본 diff(Swagger `@ApiConflictResponse`, `STATE_MISMATCH` 에러 코드, `languageHints` 신규 키)와 직접
관련된 `spec/conventions/swagger.md` · `spec/conventions/error-codes.md` · `spec/conventions/chat-channel-adapter.md`
는 누락돼 있었다. 해당 3개 파일과 대상 spec 문서·구현 코드를 워크트리에서 절대경로로 직접 Read 해 아래
검토를 완료했다.

## 발견사항

- **[WARNING] Convention 번들 payload 누락 — 리뷰 프로세스 신뢰성**
  - target 위치: (target 문서 자체 아님) `review/consistency/2026/07/14/08_54_40/_prompts/convention_compliance.md` §"정식 규약 모음"
  - 위반 규약: 해당 없음(target 문서의 위반이 아니라 payload 구성 문제)
  - 상세: 본 diff 는 (1) `interaction.controller.ts` 의 `@ApiConflictResponse` 데코레이터 수정, (2) `STATE_MISMATCH` 에러 코드 문서화, (3) `languageHints.surfaceMismatch` 신규 키 추가를 포함한다. 그런데 payload 에 번들된 conventions 는 이와 무관한 `audit-actions.md`·`cafe24-api-catalog/**` 뿐이었고, 정작 이 세 항목을 판정할 SoT 인 `swagger.md`(§2-4 상태코드 규칙, §5 응답 DTO 규약)·`error-codes.md`(§1 의미 기반 명명)·`chat-channel-adapter.md`(`languageHints` 키 lookup 규칙)는 누락됐다. 이번 검토는 checker 가 워크트리 절대경로로 직접 conventions 를 Read 해 갭을 메웠으나, 이 안전장치가 항상 보장되는 것은 아니다(사양상 checker 는 prompt_file 의 번들에 의존하도록 설계됨).
  - 제안: orchestrator 의 payload 조립 로직이 diff 파일 경로(예: `*/swagger/*`, `*.controller.ts` 의 `Api*Response` 변경, `error-codes.ts`/`error-code` 문자열 리터럴 diff, `languageHints`/`language-hint-defaults` 변경)를 스캔해 `swagger.md`/`error-codes.md`/`chat-channel-adapter.md` 를 관련도 기반으로 포함하도록 보강 검토 필요. (target 문서 자체는 무관하므로 이 항목은 target 등급 산정에서 제외.)

- **[정보성 확인 — 위반 아님] `@ApiConflictResponse` nodeId 불일치 사유 포함 여부 (사용자 질의)**
  - target 위치: `codebase/backend/src/modules/external-interaction/interaction.controller.ts` `interact()` 메서드의 `@ApiConflictResponse`
  - 확인 결과: **포함됨.** 현재(HEAD) 코드는
    `'STATE_MISMATCH (waiting_for_input 아님; 명령이 현재 대기 노드의 인터랙션 표면과 불일치 — 예: Form 대기 중 end_conversation; 또는 명령의 nodeId 가 실제 대기 노드와 불일치) 또는 IDEMPOTENCY_KEY_CONFLICT.'`
    로, diff 의 `+` 라인이 "또는 명령의 nodeId 가 실제 대기 노드와 불일치" 절을 신설했다.
  - 규약 정합: `swagger.md` §2-4(409 → `@ApiConflictResponse`)를 그대로 사용했고, 클래스 레벨 `@ApiBearerAuth('interaction-token')`(swagger.md §2-1 이 명시하는 EIA 전용 scheme)도 유지된다. `spec/5-system/14-external-interaction-api.md` §5.1 의 `STATE_MISMATCH` 표 항목도 같은 사유(nodeId 불일치)를 동반 갱신했고, `spec/5-system/4-execution-engine.md` §7.5.1 의 `resolveWaitingNodeExecutionId(expectedNodeId)` 커버리지 표와도 cross-ref 로 정합한다 — swagger 문서·API spec·엔진 spec 3자가 어긋나지 않는다.

- **[INFO] `@ApiConflictResponse` description 구두점 스타일이 형제 데코레이터와 다름**
  - target 위치: `interaction.controller.ts` `interact()` 의 `@ApiConflictResponse` (수정된 줄)
  - 위반 규약: 명시적 규칙 없음 — `swagger.md` §3 은 `@ApiOperation` 의 summary/description 글자수(10~20 / 50~150자)만 규정하고, `@ApiXxxResponse` description 의 구분자 스타일은 규정하지 않는다. 따라서 이는 CRITICAL/WARNING 이 아니라 스타일 제안이다.
  - 상세: 같은 컨트롤러의 형제 데코레이터(`@ApiBadRequestResponse`: `'VALIDATION_ERROR (...) / INVALID_COMMAND (...)'`, `@ApiUnauthorizedResponse`: `'TOKEN_* (만료 / 위조 / scope mismatch)'`)는 항목 구분자로 `/` 를 쓰는데, 갱신된 `@ApiConflictResponse` 는 괄호 안에서 `;` 두 개와 `또는` 을 섞어 쓴다(`... 아님; ... 불일치 — 예: ...; 또는 명령의 nodeId ...`). 문법적으로 문제는 없으나 동일 파일 내 표기 관례와 미세하게 어긋난다.
  - 제안: (선택) `/` 구분자로 통일하거나, 항목이 3개 이상으로 늘어난 김에 개별 사유를 세미콜론이 아닌 `/` 로 정렬 — 강제 아님, 가독성 취향 수준.

- **[정보성 확인 — 위반 아님] 명명·출력 포맷 규약 준수 항목**
  - `SURFACE_MISMATCH_DEFAULTS`(UPPER_SNAKE_CASE 상수) / `resolveSurfaceMismatchMessage`(camelCase 함수) — 기존 `SESSION_EXPIRED_DEFAULTS`/`resolveSessionExpiredMessage` 명명 패턴과 1:1 대칭. `language-hint-defaults.ts` 내 기존 명명 관례를 그대로 따름.
  - `languageHints.surfaceMismatch` 키 — camelCase, `formOpenLabel`/`sessionExpired` 등 기존 키와 동일 명명 규칙. `spec/5-system/15-chat-channel.md` §4.1.1 에 KO/EN default 표·lookup 순서(override → locale default → ko fallback)가 기존 키와 동일 패턴으로 등재됨.
  - `STATE_MISMATCH` 에러 코드는 신설이 아니라 기존 코드의 적용 범위 확장(표면 불일치 → +nodeId 불일치)이다. `error-codes.md` §2(rename 은 breaking) 관점에서도 코드명 자체는 안 바뀌었으므로 breaking 이슈 없음. 의미 기술("waiting_for_input 아님/표면 불일치/nodeId 불일치")도 §1 의미 기반 명명 원칙에 부합(전부 "실행/노드 상태와 명령의 불일치"라는 동일 의미 우산 안).
  - `spec/5-system/14-external-interaction-api.md` frontmatter(`id`/`status: partial`/`pending_plans`/`code`) 는 `spec-impl-evidence.md` 스키마를 따르고, `pending_plans` 경로(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)가 실존한다. 문서 구조도 `## Overview (제품 정의)` → 본문 → `## Rationale` 3섹션을 유지한다.

## 요약

target 인 `spec/5-system/14-external-interaction-api.md` 및 이번 diff 가 건드린 `interaction.controller.ts`/`interaction.service.ts`/`execution-engine.service.ts`/`hooks.service.ts`/`language-hint-defaults.ts` 는 정식 규약(swagger.md, error-codes.md, chat-channel-adapter.md, spec-impl-evidence.md) 관점에서 CRITICAL/WARNING 급 위반이 없다. 사용자가 특정한 질의 — `interaction.controller.ts` 의 `@ApiConflictResponse` 가 nodeId 불일치 사유를 포함하는가 — 는 **포함됨**으로 확인했으며, EIA spec §5.1 표·실행 엔진 spec §7.5.1 커버리지 표와도 정합한다. 유일한 실질적 지적은 target 문서 자체가 아니라 **이번 검토 payload 의 conventions 번들 구성**이 diff 와 무관한 문서만 포함하고 정작 관련 SoT(swagger.md/error-codes.md/chat-channel-adapter.md)를 누락했다는 프로세스 관찰(WARNING)이며, 이번 실행에서는 워크트리 직접 Read 로 갭을 메워 최종 판정에는 영향이 없었다.

## 위험도

LOW
