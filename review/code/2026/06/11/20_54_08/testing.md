# Testing Review

## 발견사항

### **[WARNING]** 기존 테스트가 AUDIT_ACTIONS 상수 대신 하드코딩 문자열을 사용 — 상수 도입의 이점 미반영
- 위치: `/codebase/backend/src/modules/integrations/integrations.service.spec.ts` L920, L1054, L1236, L1282, L1437
- 위치: `/codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` L719
- 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` L472
- 상세: 서비스 코드는 `AUDIT_ACTIONS.INTEGRATION_DELETED`, `AUDIT_ACTIONS.WORKSPACE_TRANSFER_OWNERSHIP`, `AUDIT_ACTIONS.AUTH_CONFIG_REVEAL` 등 상수를 사용하도록 이번 커밋에서 수정되었지만, 대응 테스트들은 여전히 `'integration.deleted'`, `'workspace.transfer_ownership'`, `'auth_config.reveal'` 등 raw 문자열 리터럴로 검증하고 있다. 이는 두 가지 문제를 야기한다: (1) 상수 값이 추후 변경될 경우 테스트가 실패하지 않아 드리프트를 감지하지 못한다. (2) 상수 도입의 핵심 목적(인라인 문자열 금지·SoT 단일화)이 테스트 계층에서 관철되지 않아 규약이 테스트 경계에서 깨진다.
- 제안: 각 테스트에서 `import { AUDIT_ACTIONS } from '../audit-logs/audit-action.const'`를 추가하고 `action: AUDIT_ACTIONS.INTEGRATION_DELETED` 형식으로 교체. 특히 `integration.updated`와 `integration.reauthorized` 액션에 대한 audit 검증 테스트 자체가 아래에서 별도로 누락 확인됨.

### **[WARNING]** `integration.updated` 및 `integration.reauthorized` audit action 테스트 누락
- 위치: `/codebase/backend/src/modules/integrations/integrations.service.spec.ts`
- 상세: 서비스 코드(`integrations.service.ts`)에서 `AUDIT_ACTIONS.INTEGRATION_UPDATED`와 `AUDIT_ACTIONS.INTEGRATION_REAUTHORIZED`를 사용하는 두 경로가 있으나, 기존 spec 파일에서 이 두 action이 실제로 기록되는지를 검증하는 테스트가 존재하지 않는다. `integration.deleted`, `integration.rotated`, `integration.scope_changed`, `integration.created`는 검증하지만 `updated`와 `reauthorized`는 커버되지 않는다.
- 제안: `update()` 메서드 호출 후 `audit.record`가 `action: AUDIT_ACTIONS.INTEGRATION_UPDATED`로 호출됨을 검증하는 테스트 케이스 추가. `reauthorized`도 동일.

### **[INFO]** `executions-rerun.service.spec.ts` — `action` 문자열 업데이트 반영됨, 그러나 AUDIT_ACTIONS 상수 미참조
- 위치: `/codebase/backend/src/modules/executions/executions-rerun.service.spec.ts` L827 (`'execution.re_run'`)
- 상세: 이번 변경으로 `'re_run_initiated'` → `'execution.re_run'`으로 올바르게 갱신되었다. 그러나 이 파일 역시 `AUDIT_ACTIONS.EXECUTION_RE_RUN`을 직접 import해 사용하지 않고 raw 문자열을 사용한다. 테스트 자체는 현재 시점에서 정확하지만, 장기적으로 상수와 테스트가 드리프트될 수 있다.
- 제안: `import { AUDIT_ACTIONS } from '../audit-logs/audit-action.const'` 추가 후 `action: AUDIT_ACTIONS.EXECUTION_RE_RUN` 사용 권장 (상수 일관성 유지).

### **[INFO]** `audit-action.const.ts` 자체에 대한 단위 테스트 없음 — 현재 수준에서는 허용 가능
- 위치: `/codebase/backend/src/modules/audit-logs/audit-action.const.ts`
- 상세: `AUDIT_ACTIONS` 상수 파일 자체는 TypeScript `as const` 객체이므로 컴파일 타임에 타입 정합성이 보장된다. `AuditAction` union 타입도 파생 타입이므로 별도의 런타임 테스트는 필요하지 않다. 그러나 "상수 개수 또는 기대 키 집합"을 검증하는 테스트가 없어, 누군가 AUDIT_ACTIONS에서 키를 제거해도 테스트가 통과한다.
- 제안: 필수 요구는 아니나, 상수 값 무결성 스모크 테스트(예: `Object.keys(AUDIT_ACTIONS).length >= 9`, 또는 각 값이 `<resource>.<verb>` 패턴을 준수하는지)를 추가하면 명명 규약 회귀를 조기 감지할 수 있다.

### **[INFO]** `audit-logs.service.spec.ts` — `record()` 메서드의 `AuditAction` 타입 강제에 대한 테스트 없음
- 위치: `/codebase/backend/src/modules/audit-logs/audit-logs.spec.ts`
- 상세: 기존 spec은 `findAll()` 필터 경로만 테스트하며, 이번에 `action: string` → `action: AuditAction`으로 강화된 `record()` 메서드 시그니처에 대한 동작 테스트가 없다. `record()`의 swallow 계약(DB 실패 시 warn 후 resolve)은 `executions-rerun.service.spec.ts`에서 통합 형태로 테스트되고 있어 중복 구현은 불필요하지만, `record()` 자체의 happy path(로그 저장 성공)와 ipAddress 선택 적용 경로는 직접 검증이 없다.
- 제안: `record()` happy path 및 `ipAddress` 있을 때/없을 때 분기를 커버하는 단위 테스트 추가 고려.

## 요약

이번 변경의 핵심은 감사 로그 action 인라인 문자열을 `AUDIT_ACTIONS` 상수로 일원화하는 리팩터링이다. `executions-rerun.service.spec.ts`는 `execution.re_run` 변경을 반영해 업데이트되었고, 이 테스트가 중요한 재귀 커버리지를 유지하고 있는 점은 긍정적이다. 그러나 핵심 문제는 **기존 테스트 코드 전체가 여전히 raw 문자열 리터럴로 action 값을 검증**하고 있다는 점이다. 서비스 코드는 상수를 쓰고 테스트는 하드코딩된 문자열을 쓰는 이중 구조는, 이번 도입의 목적(SoT 단일화, 인라인 금지)을 테스트 계층에서 무력화한다. 특히 `integration.updated`와 `integration.reauthorized` audit 경로는 테스트 자체가 부재하여 커버리지 갭이 존재한다. 이 두 WARNING을 해소하기 전까지는 상수 리팩터링의 안전망이 불완전하다.

## 위험도

MEDIUM

STATUS: SUCCESS
