# 보안(Security) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부

## 발견사항

- **[INFO]** `masked-reject-callers-guard.ts` 의 `importsBaseFn` 은 named import(`import { resolveTriggerParameters } from ...`) 형태만 탐지한다. namespace import(`import * as base from './resolve-trigger-parameters'; base.resolveTriggerParameters(...)`), re-export(`export { resolveTriggerParameters } from ...`), 동적 `require()` 는 정규식 스캔 대상(`import\s*\{[\s\S]*?\}\s*from`)에 걸리지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:73`~`84` (`importsBaseFn` 함수)
  - 상세: 이 가드는 "세 번째 Manual 실행 경로가 base 함수(`resolveTriggerParameters`, 마커 거부를 하지 않음)를 직접 import 하면 CI 가 잡는다" 는 defense-in-depth 안전망이다. 이번 PR 이 만드는 두 실제 호출부(`executions.service.ts`, `workflows.controller.ts`)는 모두 정상적으로 named import 로 wrapper(`resolveTriggerParametersRejectingMasked`)를 쓰고 있어 **현재는 취약점이 아니다**. 다만 미래에 누군가 namespace import 나 re-export 형태로 base 함수를 우회 호출하면, 마커 재제출 거부가 조용히 우회되는데도 이 가드는 GREEN 을 낸다. 코드 주석(같은 파일 상단)이 AST 파서 대신 정규식을 쓰는 트레이드오프를 명시적으로 인지하고 있으므로 의도된 스코프 축소로 보이나, 이 가드가 지키는 대상이 정확히 "마스킹된 자격증명이 실제 실행 입력으로 들어가는 것을 막는" 보안 불변식이라는 점에서 커버리지 갭을 기록해 둔다.
  - 제안: 당장 조치 불요. 새 Manual 실행 경로가 namespace import/re-export 형태로 base 함수를 쓰는 사례가 실제로 생기면 그때 탐지 패턴을 확장(또는 AST 파서로 전환)한다.

- **[INFO]** 에러 상세 노출 형태가 안전하게 제한되어 있음을 확인 — 새로 추가된 `MASKED_VALUE_RESUBMITTED` 상세(`TriggerParameterErrorDetail`)는 `field`(스키마에 선언된 파라미터명), `code`, 고정 문자열 `message` 만 담고, 마스킹된 원본 값이나 실제 시크릿을 응답에 싣지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:26`(`TriggerParameterErrorDetail`)·`59`~`62`(`masked_value_resubmitted` 매핑)
  - 상세: `errors: err.errors` → `details: toTriggerParameterErrorDetails(err.errors)` 로 바꾼 수정(`executions.service.ts`)도 같은 변환기를 거치므로 raw reason 문자열이 그대로 노출되지 않는다. `GlobalExceptionFilter`(`http-exception.filter.ts`)가 `details` 만 forward 하는 것과 정합적이다. 정보 노출 관점에서 문제 없음 — 참고로만 기록.
  - 제안: 없음(확인용 기록).

## 요약

이 변경은 `Execution.inputData` 마스킹 마커(`'***'`, `[REDACTED]`, `[REDACTED_DEPTH]`)가 UI 렌더 경로를 우회한 직접 API 호출(curl 등)로 재제출돼 실제 실행 입력값으로 굳어지는 것을 막는 서버측 방어 계층을 추가한다 — 방향성 자체가 보안 하드닝이다. 핵심 로직(`resolveTriggerParametersRejectingMasked`/`findMaskedResubmissions`)을 직접 읽고 대조한 결과: (1) 정확 일치(substring 아님) 비교라 `a***b` 같은 정상 값을 과잉 차단하지 않고, (2) raw 우선 검사로 `Boolean('***') → true` 타입 우회를 막으며, (3) resolve 후 재검사로 object/array 를 JSON 문자열로 실어 보내는 우회 경로도 잡고, (4) 재귀 깊이가 마스커와 동일한 `MAX_REDACT_DEPTH(=10)`로 상한돼 있어 5,000단계 중첩 입력에서도 스택 오버플로 없이 종료함을 회귀 테스트로 확인했다(`reject-masked-resubmission.spec.ts` DoS 회귀 케이스 포함). 에러 응답의 `details[]`는 필드명·고정 코드·정적 메시지만 담아 값 노출이 없고, 선행 버그였던 `errors` vs `details` 키 불일치도 함께 교정돼 `GlobalExceptionFilter`가 실제로 상세를 전달하도록 고쳐졌다(정보 은폐가 아니라 오히려 사용자 안내 정확도를 높이는 방향). 하드코딩된 시크릿, 인젝션, 인증/인가 우회, 안전하지 않은 암호화 등 다른 OWASP 축에서는 이 diff 범위에서 새로 도입된 문제를 발견하지 못했다. 유일하게 기록할 사항은 새로 추가된 repo-guard(`masked-reject-callers-guard.ts`)가 정규식 기반이라 namespace-import/re-export 형태의 우회를 탐지하지 못하는 스코프 갭인데, 현재 실제 호출부 2곳 모두 정상 형태를 쓰고 있어 지금 시점의 익스플로잇 가능성은 없다.

## 위험도

NONE
