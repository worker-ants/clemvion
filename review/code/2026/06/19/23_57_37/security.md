# Security Review

## 발견사항

### [INFO] warn 로그에 triggerId 포함 — 구조 로그 설계 의도 확인
- 위치: `execution-failure-classifier.ts` 내 unknown 코드 fallback 분기 (`logger.warn(JSON.stringify({...}))`)
- 상세: `triggerId` 가 structured warn 로그에 포함된다. 이는 CCH-ERR-04 스펙 의도(운영 추적용)로 명시되어 있으며, `error.message` · `nodeId` · `executionId` · `details.*` 등 더 민감한 필드는 포함하지 않는다. `triggerId` 는 내부 식별자로 외부에 노출되는 표면이 아니므로 현재 수준은 수용 가능하다.
- 제안: 현재 설계 수용. 단, 로그 집계 시스템(예: ELK, Datadog)에서 `triggerId` 가 외부 서비스로 전달되지 않도록 로그 pipeline 레벨 필터링 정책을 별도 확인할 것.

### [INFO] statusCode 0 / 음수 정수 placeholder 노출 — 명시적 문서화 완비
- 위치: `execution-failure-classifier.spec.ts` W#4 경계값 케이스 (`statusCode: 0`, `statusCode: -200`)
- 상세: `extractStatusCode`의 type-guard가 `Number.isInteger` 만 검사하므로 0이나 음수 정수도 `statusCode` placeholder로 사용자에게 노출된다. 테스트는 이 동작을 설계 의도로 문서화하고 있으며 "음수 필터링은 DTO 레이어 책임"이라고 명시한다. 실제 취약점은 아니나 i18n 메시지에 의미 없는 값(0, -200)이 노출될 수 있음.
- 제안: DTO 레이어에서 HTTP 상태 코드 범위(100-599)만 허용하도록 검증 로직 추가를 고려할 것. 현재 변경 범위 밖이므로 별도 작업으로 처리.

### [INFO] CCH-ERR-02 입력 화이트리스트 테스트 — 양호
- 위치: `execution-failure-classifier.spec.ts` `Input whitelist (CCH-ERR-02)` describe 블록
- 상세: `error.message`, `nodeId`, `executionId`, `workflowId`, `details.url`, API 키 형태 문자열(`AKIA...`) 등이 반환값에 포함되지 않음을 검증하는 테스트가 이미 존재한다. 신규 `WORKFLOW_FORBIDDEN_WORKSPACE` 코드도 동일한 `executionFailedInternal` 분기를 타므로 동일 화이트리스트 제약 적용.
- 제안: 해당 없음 (양호).

## 요약

이번 변경은 `WORKFLOW_FORBIDDEN_WORKSPACE` 에러 코드를 `INTERNAL_CODES` Set에 명시 등재하고 테스트에 추가하는 단순 확장이다. 변경의 보안 영향은 매우 제한적이다. 기존 `classifyExecutionFailure` 구현은 CCH-ERR-02(입력 화이트리스트), CCH-ERR-03(반환값 정보 누출 방지), CCH-ERR-04(structured warn 로그) 정책을 올바르게 준수하고 있으며, 신규 코드도 이 구조를 그대로 따른다. 인젝션 취약점, 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화 등 주요 보안 위협은 검출되지 않았다. statusCode 경계값(0, 음수)이 사용자 메시지에 노출될 수 있으나 이는 기존 설계 결정이며 DTO 레이어에서 처리해야 할 별도 사항이다.

## 위험도

NONE
