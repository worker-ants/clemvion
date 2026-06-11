# Testing Review — audit-coverage-naming

## 발견사항

### [INFO] audit-action.const.ts 자체에 대한 단위 테스트 없음
- 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` (신규 파일)
- 상세: `AUDIT_ACTIONS` 상수와 `AuditAction` 타입은 순수 데이터(no logic)라 테스트 ROI는 낮다. 그러나 상수 값이 DB에 저장되는 문자열이므로 값 회귀 보호 차원에서 스냅샷 테스트나 열거 검증을 고려할 수 있다. 현재는 소비 사이트(service spec)에서 문자열 리터럴로 간접 검증되고 있어 실질 위험은 낮다.
- 제안: 필요 시 `Object.values(AUDIT_ACTIONS)`가 `<resource>.<verb>` 형식을 준수하는지 검증하는 단순 유닛 테스트 1개 추가(선택적).

### [WARNING] integrations.service.spec.ts: `integration.updated`·`integration.reauthorized` audit action 미검증
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/integrations/integrations.service.spec.ts`
- 상세: `integration.created` (2건)·`integration.deleted`·`integration.rotated`·`integration.scope_changed`는 spec에서 `expect.objectContaining({ action: '...' })`으로 검증되지만, `integration.updated`(AUDIT_ACTIONS.INTEGRATION_UPDATED)와 `integration.reauthorized`(AUDIT_ACTIONS.INTEGRATION_REAUTHORIZED) 호출 경로는 audit 기록 여부 자체가 테스트에서 확인되지 않는다. 이번 변경으로 문자열 리터럴이 상수로 교체되었으나, 테스트 커버리지 갭은 변경 전후 모두 존재한다.
- 제안: `update` / `reauthorize` 경로에 `audit.record`가 `AUDIT_ACTIONS.INTEGRATION_UPDATED` / `AUDIT_ACTIONS.INTEGRATION_REAUTHORIZED` 값으로 호출되는지 검증하는 케이스 추가.

### [INFO] 테스트의 action 값이 문자열 리터럴로 하드코딩 — 상수 참조로 전환 미흡
- 위치: `integrations.service.spec.ts` 라인 920, 1054, 1236, 1282, 1437; `workspaces.service.spec.ts` 라인 719; `auth-configs.service.spec.ts` 라인 472
- 상세: 서비스 코드는 이번 변경으로 `AUDIT_ACTIONS.XXX` 상수를 사용하도록 전환되었으나, spec(테스트) 파일들은 여전히 `'integration.deleted'`, `'workspace.transfer_ownership'`, `'auth_config.reveal'` 등의 문자열 리터럴을 직접 사용한다. 향후 상수 값이 변경될 경우 테스트가 자동으로 실패하지 않아 거짓 통과(false green)가 발생할 수 있다.
- 제안: 테스트에서도 `import { AUDIT_ACTIONS } from '../audit-logs/audit-action.const'`로 가져와 `action: AUDIT_ACTIONS.INTEGRATION_DELETED` 등으로 참조. 단, 현재 상수 값 자체가 변하지 않을 것이라면 낮은 우선순위.

### [INFO] `executions-rerun.service.spec.ts`: action 값 교체가 올바르게 반영됨 — 회귀 테스트 유효
- 위치: `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts` 라인 827
- 상세: `'re_run_initiated'` → `'execution.re_run'` 교체가 테스트에도 정확히 반영되어 있고, 실제 `AuditLogsService`를 주입해 `record()` swallow 계약까지 검증하는 케이스(W6/W7)도 존재한다. 회귀 보호는 충분하다.
- 제안: 없음.

### [INFO] `AuditLogsService.record()`의 `action: AuditAction` 타입 강제는 컴파일 타임 검증으로 충분
- 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` 라인 207
- 상세: `action: string` → `action: AuditAction` union 교체는 TypeScript 컴파일 타임에 잘못된 문자열 전달을 차단한다. 런타임 테스트보다 강력한 보호다. 테스트에서 별도의 유효성 검증 케이스가 없어도 컴파일이 곧 테스트다.
- 제안: 없음. 현재 설계가 적합하다.

### [INFO] `audit-logs.spec.ts`에 `record()` 메서드 직접 테스트 없음
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/audit-logs/audit-logs.spec.ts`
- 상세: 현재 audit-logs.spec.ts는 `AuditLogsController` Admin+ 가드와 `findAll` 필터를 테스트하지만, `record()` 메서드(try/catch swallow 계약)는 직접 단위 테스트하지 않는다. `executions-rerun.service.spec.ts`의 W6/W7 케이스가 우회적으로 이를 검증하지만, `AuditLogsService` 자체 spec에 독립 케이스가 없다. 이번 변경(action 타입 강화)이 record()에 닿으므로 연관성이 있다.
- 제안: `audit-logs.spec.ts`에 `record()` swallow 계약(repository.save 실패 시 resolve, warn 출력) 케이스를 추가하면 이 서비스의 핵심 계약을 중앙화할 수 있다.

## 요약

이번 변경의 핵심은 audit action 문자열 리터럴을 `AUDIT_ACTIONS` 상수로 중앙화하고 `AuditLogsService.record()`에 타입 강제를 적용한 리팩터링이다. `executions-rerun.service.spec.ts`는 action 값 교체를 정확히 반영하고 swallow 계약까지 검증하여 회귀 보호가 충분하다. 다만 `integrations.service.spec.ts`에서 `integration.updated`·`integration.reauthorized` 두 action 경로는 기존에도 누락되었고 이번 변경 후에도 검증되지 않아 커버리지 갭이 남는다. 또한 서비스 코드는 상수 참조로 전환되었으나 테스트들은 여전히 문자열 리터럴을 사용하고 있어, 미래 상수 값 변경 시 테스트가 자동으로 실패하지 않을 수 있다. 전체적으로 변경 범위(상수 도입·타입 강화·명칭 교체)에 비해 테스트 상태는 양호하며, 차단급 결함은 없다.

## 위험도

LOW
