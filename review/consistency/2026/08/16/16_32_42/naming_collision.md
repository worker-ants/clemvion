# 신규 식별자 충돌 검토 — `plan/in-progress/eia-internal-rest-error-masking.md`

## 발견사항

- **[CRITICAL]** spec 초안(§R17 교체 불릿)이 이미 폐기된 함수명 `redactExecutionErrorValue` 를 그대로 담고 있다 — 실제 구현·본문 다른 곳의 이름 정정과 어긋난다
  - target 신규 식별자: `redactExecutionErrorValue` (target 문서 `## spec 초안` → `### ① 14-external-interaction-api.md §R17 — :1484 불릿 교체` 의 "교체안" 본문, `plan/in-progress/eia-internal-rest-error-masking.md:163`)
  - 기존 사용처(충돌 대상): `codebase/backend/src/modules/execution-engine/workflow-errors.ts:33` 의 `export abstract class ExecutionError extends Error` — `redactExecutionErrorValue` 는 이 클래스명을 **온전한 부분 문자열로 포함**한다
  - 상세: target 문서 자신이 `## 설계` 절(`eia-internal-rest-error-masking.md:86-92`)에서 *"이름을 바꿨다(`16_03_57` naming W1). 초안의 `redactExecutionErrorValue` 는 기존 예외 계층 클래스 `ExecutionError`(`workflow-errors.ts:33`)를 온전한 부분 문자열로 포함한다"* 고 명시하며, 실제 구현도 `redactStoredErrorForResponse` 로 정정되어 있다(`codebase/backend/src/shared/utils/redact-stored-error.ts:57`, `executions.service.ts:40,875,913` 전부 새 이름 사용, `조치` 체크리스트도 `redactStoredErrorForResponse` 로 정확히 기재). 그런데 정작 **spec 파일(`spec/5-system/14-external-interaction-api.md`)에 그대로 적용될 "교체안" 원문**(`plan/in-progress/eia-internal-rest-error-masking.md:162-166`)에는 옛 이름 `redactExecutionErrorValue` 가 그대로 남아 있다. planner 턴에서 이 spec 초안을 그대로 복사해 §R17 불릿을 교체하면:
    1. 영구 spec(SoT)에 실제 코드에 존재하지 않는 함수명이 박제되어 spec-code drift 가 즉시 발생하고,
    2. 직전 라운드(`16_03_57` naming W1)가 지적해 "고쳤다"고 서술한 바로 그 `ExecutionError` 부분 문자열 충돌이 spec 본문에 재유입된다. 즉 코드는 고쳤는데 spec 초안은 고치기 전 상태로 남아 있는 반쪽 수정이다.
  - 제안: spec 초안 ①의 "교체안" 본문(`:163`) 중 `redactExecutionErrorValue` 를 실제 구현명 `redactStoredErrorForResponse` 로 치환한다. `## 설계` 절(`:86-92`)의 서술(이름을 바꾼 이유를 설명하는 부분)은 과거형 narration 이라 그대로 둬도 무방하지만, spec 에 실제로 적용되는 교체안 텍스트는 반드시 최신 함수명과 일치시켜야 한다.

## 요약

target 문서가 신규로 도입하는 함수명·파일 경로(`redactStoredErrorForResponse`, `shared/utils/redact-stored-error.ts`) 자체는 기존 식별자와 충돌하지 않으며, 문서는 이전 라운드에서 지적된 `ExecutionError` 부분 문자열 충돌을 인지하고 실제 구현에서 올바르게 정정했다. 그러나 그 정정이 spec 에 실제로 적용될 "spec 초안" 텍스트(§R17 교체안, `:163`)에는 반영되지 않아, 옛 이름이 그대로 spec SoT 로 넘어갈 위험이 있다 — 이는 스스로 고쳤다고 선언한 충돌을 spec 문서 레벨에서 재도입하는 결과다. 그 외 `interaction.triggerToken`/`itk_*`(기존 식별자, 신규 아님), `secret-store.md §1` 신설 "비대상" 블록(기존 `AuthConfig.config` 블록과 이름·위치 모두 구분됨), API endpoint·이벤트명·ENV 변수·spec 파일 경로 신설 없음(기존 파일의 기존 R17/§1/:910 위치 수정) 등은 충돌 없음을 확인했다.

## 위험도
CRITICAL
