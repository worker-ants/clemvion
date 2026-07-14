# 정식 규약 준수 검토 — convention_compliance

- 검토 모드: --impl-done (scope=spec/5-system/4-execution-engine.md, diff-base=origin/main)
- Target: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 외 chat-channel/hooks/external-interaction 관련 diff (plan `eia-command-waiting-surface-guard` F-1/F-2)
- 대조 규약: `spec/conventions/error-codes.md`, `spec/conventions/i18n-userguide.md`, `spec/conventions/chat-channel-adapter.md`, `spec/conventions/swagger.md`, `spec/conventions/execution-context.md`, `PROJECT.md §변경 유형 → 갱신 위치 매핑` (i18n-userguide.md §적용범위가 지시하는 SoT)

## 발견사항

- **[WARNING]** `@ApiConflictResponse` 설명이 신규로 강제되는 nodeId 불일치 STATE_MISMATCH 사유를 반영하지 않음
  - target 위치: `codebase/backend/src/modules/external-interaction/interaction.controller.ts:81-84` (`InteractionController.interact` 의 `@ApiConflictResponse`) — 본 파일은 이번 diff 에서 **변경되지 않음**
  - 위반 규약: `spec/conventions/swagger.md` §2-4 (상태 코드 응답 데코레이터 규칙, `@ApiConflictResponse` 로 409 원인 서술) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 "백엔드 API 추가·변경 → controller·DTO 의 swagger jsdoc" 항목 (`spec/conventions/i18n-userguide.md` 상단 "위치 매핑·검증 명령" 절이 PROJECT.md 해당 표를 SoT 로 명시 지정)
  - 상세: 이번 diff 는 `ExecutionEngineService.resolveWaitingNodeExecutionId` 에 `expectedNodeId` 검사를 신설해, 외부 EIA `/interact` 진입점이 명령의 `nodeId` 와 실제 대기 노드가 불일치할 때 이제 실제로 `409 STATE_MISMATCH` 를 거부 발생시킨다 (`interaction.service.ts` 의 `expectedNodeId = isInternalCtx(ctx) ? undefined : dto.nodeId` 전달 경로). `spec/5-system/14-external-interaction-api.md` 의 §5.1 에러 표와 §"STATE_MISMATCH 강제 정합 (2026-07)" 주석은 이 조건을 이미 계약의 일부로 문서화하고 있으나, 실제 사용자 대면 Swagger 문서(`interaction.controller.ts` 의 `@ApiConflictResponse({ description: 'STATE_MISMATCH (waiting_for_input 아님, 또는 명령이 현재 대기 노드의 인터랙션 표면과 불일치 — 예: Form 대기 중 end_conversation) 또는 IDEMPOTENCY_KEY_CONFLICT.' })`)는 "표면 불일치" 사유만 예시로 들고 "nodeId 불일치" 사유는 언급하지 않는다. 종전에는 이 조건이 구현되지 않아 202 로 통과됐으므로 (spec 원문 "구현이 한동안 이 조합을 거부하지 않고 202 로 수용하던 결함") 외부 client 가 실제로 이 409 를 받아본 적이 없었지만, 본 PR 부터는 이 사유의 409 가 실제로 발생하기 시작한다. Swagger UI/OpenAPI 산출물을 참조하는 API 소비자에게는 이 원인이 설명 텍스트에 없어 원인 불명 409 로 보일 수 있다.
  - 제안: `@ApiConflictResponse` 의 `description` 에 "또는 명령의 nodeId 가 실제 대기 노드와 불일치" 같은 문구를 추가해 `spec/5-system/14-external-interaction-api.md §5.1` 및 `spec/5-system/4-execution-engine.md §7.5.1` 이 이미 문서화한 사유와 Swagger 표면을 동기화한다. (동작 자체는 문서화된 계약을 코드에 정합시킨 것뿐이라 CRITICAL 은 아니며, 다음 PR 에서 갱신해도 다른 시스템의 invariant 를 깨지 않음.)

## 준수가 확인된 항목 (참고)

- `SURFACE_MISMATCH_DEFAULTS` / `resolveSurfaceMismatchMessage` 의 명명·시그니처 순서(`languageHints`→`languageLocale`)·3-level lookup 순서(override → locale default → ko fallback)가 기존 `SESSION_EXPIRED_DEFAULTS`/`resolveSessionExpiredMessage`, `FORM_OPEN_LABEL_DEFAULTS`/`resolveFormOpenLabel` 패턴과 완전히 일치 (`language-hint-defaults.ts`).
- `STATE_MISMATCH` 재사용은 `spec/conventions/error-codes.md` §1 의 "의미가 실제로 갈라질 때만 새 코드" 원칙에 부합 — nodeId 불일치는 `spec/5-system/14-external-interaction-api.md §5.1` 이 처음부터 `STATE_MISMATCH` 의 정의 범위 안에 포함해온 사유(신규 의미 분화 아님)이므로 새 에러 코드 신설 없이 기존 코드를 쓴 것이 정확한 선택.
- `telegram.mdx` / `telegram.en.mdx` 의 신규 §7.4 절이 기존 §7.1~§7.3 (`executionFailed*`, `sessionExpired`)과 동일한 heading 넘버링·표 컬럼(`Key`/`Sent when`/`{statusCode} allowed`) 구조를 그대로 따름. 문체(해요체)·금지어·내부 SoT 미노출(`spec/conventions/i18n-userguide.md` Principle 6/6-B)도 위반 없음.
- `dict/ko/triggers.ts` · `dict/en/triggers.ts` 의 `languageHintsHelp` 갱신이 ko/en 양쪽 동시 반영되어 Principle 2 (leaf key parity — 본 건은 help 문자열이므로 parity 가드 직접 대상은 아니나 취지상 동시 갱신) 를 충족.
- `expectedNodeId` optional 파라미터 추가는 `spec/conventions/execution-context.md` 원칙 3 ("No runtime optional sprawl")의 적용 대상이 아님 — 해당 원칙은 노드 핸들러에 주입되는 `ExecutionContext` 객체 필드 분류에 한정되며, 이번 변경은 `ExecutionEngineService` 의 일반 서비스 메서드 파라미터라 스코프 밖.
- `hooks.service.ts` 에서 기존 `nodeId: 'chat-channel'` placeholder 를 제거한 것은 오히려 과거 안티패턴(존재 검사만 만족시키는 가짜 nodeId)을 정리한 개선이며 금지 패턴 재도입이 아님.

## 요약

diff 는 `plan/eia-command-waiting-surface-guard` F-1(nodeId 일치 강제)·F-2(표면 불일치 안내) 구현으로, 신규 식별자 명명(`SURFACE_MISMATCH_DEFAULTS`/`resolveSurfaceMismatchMessage`/`expectedNodeId`)·에러 코드 재사용(`STATE_MISMATCH`)·문서 구조(telegram.mdx §7.4)·i18n dict 갱신이 기존 `spec/conventions/**` 패턴과 거의 완벽히 정합한다. 유일한 갭은 `interaction.controller.ts` 의 Swagger `@ApiConflictResponse` 설명이 이번에 실제로 발동하기 시작하는 "nodeId 불일치" 409 사유를 텍스트에 반영하지 않은 문서 완결성 문제이며, 코드 동작이나 다른 시스템의 invariant 를 깨는 CRITICAL 위반은 아니다.

## 위험도

LOW
