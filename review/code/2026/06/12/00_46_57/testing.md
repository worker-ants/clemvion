# Testing Review

## 발견사항

### [INFO] AuditLogsService.record — swallow 테스트의 ipAddress 미검증
- 위치: `/codebase/backend/src/modules/audit-logs/audit-logs.spec.ts` 66-90행 (신규 describe 블록)
- 상세: `record()` 정상 경로 테스트에서 `create`에 전달된 인자를 검증하지만, `ipAddress`는 `objectContaining`에 포함되지 않는다. `AuditLogsService.record` 구현을 보면 `if (entry.ipAddress) log.ipAddress = entry.ipAddress;`로 조건부 할당하는 분기가 있는데, ipAddress가 있을 때와 없을 때(undefined)의 두 경로 모두 swallow 테스트에서 검증되지 않는다. 이 분기는 `auth-configs.service.spec.ts`에서 간접 커버되지만, record() 자체 단위 테스트로서는 커버리지 갭이다.
- 제안: 정상 경로 테스트에 `ipAddress`를 포함한 케이스와 `ipAddress` 없는 케이스를 분리하거나, 기존 `entry`에 `ipAddress: '1.2.3.4'`를 추가해 `repo.create` 호출 검증 시 ipAddress 조건부 할당도 커버한다.

### [INFO] AuditLogsService.record — create 호출 인자에 `details` 기본값({}) 미검증
- 위치: `/codebase/backend/src/modules/audit-logs/audit-logs.spec.ts` 83-90행
- 상세: 서비스 구현에서 `details: entry.details ?? {}`로 기본값 처리를 하는데, swallow 테스트의 `entry`에는 `details`가 없다. `objectContaining`에 `details: {}`가 포함되지 않아 해당 기본값 로직이 테스트에서 명시적으로 검증되지 않는다. 기능상 문제는 없으나 암묵적 동작이다.
- 제안: `expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ details: {} }))` 추가.

### [INFO] AuthConfigsController 전파 테스트 — `req.ip`가 `undefined`인 경우 타입 캐스팅
- 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.controller.spec.ts` 403-413행
- 상세: `{ ip: undefined } as Request`로 캐스팅하는데, Express의 `Request.ip`는 `string` 타입이라 `undefined` 할당이 실제로는 타입 오류다. `as Request` 강제 캐스팅으로 컴파일은 통과하지만, 신뢰 프록시 미설정 시 실제 `req.ip`가 `undefined`가 되는지는 런타임 동작에 의존한다. 테스트 의도는 명확하나, `as unknown as Request` 캐스팅이 더 정직한 표현이다.
- 제안: `{ ip: undefined } as unknown as Request`로 변경해 강제 캐스팅임을 명시적으로 표현.

### [INFO] integrations.service.spec.ts — `update` describe 블록이 기존 `reauthorize` describe 안에 중첩되지 않도록 확인 필요
- 위치: `/codebase/backend/src/modules/integrations/integrations.service.spec.ts` diff +2099행 (`});` 뒤 `describe('update',`)
- 상세: diff 패치에서 `reauthorize` describe의 닫는 `});`와 신규 `describe('update',` 사이의 구조가 정확한지 확인이 필요하다. 전체 파일 컨텍스트를 보면 `describe('update', ...)` 블록은 독립 describe로 올바르게 분리되어 있으므로 실제 문제는 없다. 다만 diff에서 `});` 두 개가 연속으로 나오는 패턴이 주의를 요한다.
- 제안: 기존 구조 유지 — 현재 코드에서 문제없음.

### [WARNING] integrations.service.spec.ts — `update` 테스트에서 `auditLogsService.record` mock 초기화 없이 검증
- 위치: `/codebase/backend/src/modules/integrations/integrations.service.spec.ts` 신규 `describe('update', ...)` 블록 내
- 상세: `beforeEach`에서 `auditLogsService = { record: jest.fn().mockResolvedValue(undefined) }`로 매 테스트마다 새 mock이 생성된다. 이는 테스트 격리 측면에서 올바르다. 그러나 `records integration.updated with name diff` 테스트 내에서 `integrationRepo.findOne`과 `integrationRepo.save` 모두 `beforeEach`의 기본값을 사용하므로, `integrationRepo.save`가 `Promise.resolve(entity)`를 반환하는데 `entity`는 `{ ...integration, name: 'Renamed' }`인지 확인이 필요하다. `integrationRepo.save`는 `(entity) => Promise.resolve(entity as Integration)`로 구현돼 있어 실제로는 `name: 'Renamed'`가 반영되지 않을 수 있다. `integrationRepo.create`가 `{ ...integration, ...data }`를 반환하므로 `create` → `save` 경로가 아닌 `findOne` → mutate → `save` 경로라면 save가 원본을 그대로 돌려줄 수 있다.
- 제안: `service.update` 내부 흐름이 `findOne`으로 가져온 객체를 변경 후 `save`하는 구조이므로, `save` mock을 `jest.fn().mockImplementation((entity) => Promise.resolve(entity))`로 명시해 `name: 'Renamed'`가 결과에 반영되는지 보장한다. 현재 `beforeEach` 설정이 이를 만족하므로 실제 동작에는 문제없으나 코드 가독성을 위해 테스트 내부에서 명시적으로 확인하는 게 낫다.

### [INFO] AuthConfigsService.recordAudit 래퍼 — 단위 테스트 없음
- 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` 신규 `private recordAudit()` 메서드
- 상세: `recordAudit`는 private 헬퍼로 `AuditLogsService.record`를 `resourceType`을 고정해 래핑한다. 이 래퍼 자체는 기존 CRUD audit 테스트들이 간접 커버하므로 기능상 미검증 경로는 없다. 다만 `resourceType: AUTH_CONFIG_RESOURCE_TYPE`이 모든 호출에서 `'auth_config'`로 고정되는지는 기존 테스트의 `objectContaining` 검사에서 이미 검증된다. 별도 단위 테스트 불필요.
- 제안: 현재 커버리지로 충분. 추가 조치 불필요.

### [INFO] workspaces.service.spec.ts — audit 검증이 한 케이스(transferOwnership 성공)에만 집중
- 위치: `/codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 1811-1836행
- 상세: `AUDIT_ACTIONS.WORKSPACE_TRANSFER_OWNERSHIP` 상수 교체 외에 실질 변화 없음. 실패 케이스(권한 없음, 타겟 미존재 등)에서 audit가 기록되지 않는지 검증하는 테스트는 없다. 성공 경로만 커버한다.
- 제안: 실패 케이스(예: `refuses when requester is not owner`)에 `expect(audit.record).not.toHaveBeenCalled()` 어서션 추가를 고려한다.

### [INFO] AuditLogDto — action 필드 변경에 대한 DTO 단위 테스트 없음
- 위치: `/codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts`
- 상세: API 문서 메타데이터(description/example) 변경이므로 런타임 동작에 영향 없다. Swagger 스펙 자체는 e2e나 별도 스펙 테스트로 검증하지 않는 한 자동화 커버리지가 없다. 이는 이번 PR에 국한된 문제가 아니라 프로젝트 전반의 DTO 테스트 부재 패턴이다.
- 제안: 이번 변경 범위에서는 추가 조치 불필요. 향후 OpenAPI 스펙 스냅샷 테스트 도입 시 커버 가능.

## 요약

이번 변경의 핵심은 인라인 문자열 리터럴(`'auth_config.create'` 등)을 `AUDIT_ACTIONS` 상수로 교체하고, `AuthConfigsController`에 userId/req.ip 전파 테스트와 `AuditLogsService.record`의 best-effort(swallow) 계약 테스트를 신규 추가한 것이다. 테스트 설계 측면에서 우수한 부분이 많다: 신규 `AuditLogsService.record` swallow 테스트는 계약의 단일 회귀 방지 지점으로 설계 의도가 명확하고, AuthConfigsController 전파 테스트는 req.ip=undefined 엣지 케이스까지 커버하며, IntegrationsService의 update/reauthorize 케이스에도 audit 기록 여부 검증이 추가됐다. 테스트 격리(beforeEach 단위 mock 재생성)와 가독성도 양호하다. 주요 미비 사항은 swallow 테스트에서 ipAddress 분기 검증 누락, transferOwnership 실패 시 audit 미기록 확인 부재, DTO 변경에 대한 자동화 검증 부재 정도이며, 모두 WARNING/INFO 수준으로 기능 정확성에 직접적인 영향은 없다.

## 위험도

LOW
