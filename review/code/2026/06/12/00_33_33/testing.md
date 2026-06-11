# Testing Review — audit-sot-hygiene

## 발견사항

### [INFO] 파일 1: audit-log-response.dto.ts — DTO 자체에 단위 테스트 없음, 실용적으로 무해
- 위치: `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts`
- 상세: 이번 변경은 `@ApiProperty` description 을 보강하는 문서 전용 변경이다. DTO 자체에 로직이 없으므로 전용 단위 테스트 부재는 허용 수준이다. Swagger/OpenAPI 스키마가 실제 응답과 일치하는지는 e2e 레벨에서만 검증 가능하며, 현재 변경 범위에 그 회귀 위험은 없다.
- 제안: 해당 없음.

---

### [INFO] 파일 2: auth-configs.controller.spec.ts — 신규 테스트 블록 전반적으로 양호
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.controller.spec.ts` 전체
- 상세: `userId/req.ip 전파` describe 블록이 추가됐다. 5개 CRUD 핸들러 전부(create/update/regenerate/remove/reveal)를 커버하고, `req.ip=undefined` 엣지 케이스(trust-proxy 미설정 상황)까지 포함한 점은 긍정적이다. `service` 는 `jest.Mocked<Pick<...>>` 로 타입 안전하게 구성되고, `beforeEach` 로 각 케이스가 독립 실행된다.
- 제안: 해당 없음.

---

### [WARNING] 파일 2: controller spec — `findAll/findOne` 핸들러의 userId/req.ip 전파 미검증
- 위치: `auth-configs.controller.spec.ts` — `userId/req.ip 전파` describe
- 상세: 추가된 블록은 쓰기 경로(create/update/regenerate/remove/reveal)만 검증한다. 읽기 경로(`findAll`, `findOne`, `getUsage`)는 userId/req.ip 를 전달하지 않아도 되는 계약이라면 명시적 테스트(또는 코멘트)가 없어 의도가 명확하지 않다. 특히 `getUsage` 의 경우 향후 감사 기록이 추가될 가능성이 있어 현재 "전달하지 않는다"는 계약을 문서화하면 회귀 방지에 유리하다.
- 제안: `it('findAll/findOne/getUsage → req.ip 불전달 — 읽기 경로는 감사 로그 없음', ...)` 형태로 명시적으로 호출 후 `service.record` 미호출을 단언하거나, 기존 `@Roles 미적용` 테스트 코멘트에 "audit 없음" 근거를 추가한다.

---

### [INFO] 파일 3: auth-configs.service.spec.ts — AUDIT_ACTIONS 상수 참조로 변경, 일관성 향상
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` 전체
- 상세: 하드코딩된 문자열 리터럴(`'auth_config.create'` 등)을 `AUDIT_ACTIONS.*` 상수로 교체했다. 이로써 상수 값이 변경되면 테스트도 자동 추적된다. `reveal` 테스트에서 로컬 `userId` 변수를 제거하고 모듈 수준 `USER` 상수로 통일한 것도 가독성과 일관성을 높인다.
- 제안: 해당 없음.

---

### [WARNING] 파일 3: auth-configs.service.spec.ts — `recordAudit` 래퍼 자체의 직접 단위 테스트 부재
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` `private recordAudit()`
- 상세: `recordAudit` 는 private 헬퍼라 직접 테스트하기 어렵지만, 현재 테스트는 간접적으로 `auditLogsService.record` 호출을 검증하므로 실질 커버리지는 충분하다. 단, `recordAudit` 가 `resourceType` 을 항상 `AUTH_CONFIG_RESOURCE_TYPE` 으로 고정한다는 계약이 별도 주석이나 테스트로 명시되지 않았다. 향후 `resourceType` 을 다른 값으로 실수 변경해도 현 테스트(`expect.objectContaining`)가 잡아낼 수 있으므로 실질 위험은 낮다.
- 제안: 현재 `expect.objectContaining({ resourceType: 'auth_config', ... })` 단언이 모든 CRUD 케이스에 있는지 확인. 실제로 `update` 와 일부 케이스에는 `resourceType` 이 포함되어 있어 적절하다. 추가 변경 불필요.

---

### [WARNING] 파일 3: auth-configs.service.spec.ts — `regenerate` + `reveal` 의 `workspaceId` 누락 단언 보완(신규 추가 반영)
- 위치: `auth-configs.service.spec.ts` L 703–712 `regenerate → auth_config.regenerate 기록` 케이스
- 상세: diff 에서 `remove` 케이스에 `workspaceId: WS` 단언이 신규 추가됐다. 그러나 `regenerate` 케이스의 `expect.objectContaining` 에도 `workspaceId: WS` 가 포함되어 있음이 전체 파일 컨텍스트에서 확인된다. `reveal` 케이스도 포함됐다. 일관성은 유지됨.
- 제안: 해당 없음.

---

### [INFO] 파일 4: auth-configs.service.ts — `USAGE_RECENT_CALLS_LIMIT` 상수화
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L 1295 (`.limit(USAGE_RECENT_CALLS_LIMIT)`)
- 상세: 매직 넘버 `20` 을 상수로 교체했다. 테스트에서 이 한도가 실제로 지켜지는지를 검증하는 케이스는 service spec 에 없다(`getUsage` 의 `USAGE_RECENT_CALLS_LIMIT` 값이 `20` 임을 검증하지 않음). 상수 값이 바뀌면 현재 테스트는 조용히 통과한다.
- 제안: 선택적 개선 — `getUsage` describe 에 `it('recentCalls 는 최대 20건만 반환', ...)` 형태로 `triggerIds` 가 다수 존재할 때 `executionRepository.createQueryBuilder().limit` 이 `20` 으로 호출됨을 단언한다.

---

### [INFO] 파일 5: integrations.service.spec.ts — AUDIT_ACTIONS 상수 일관화 + 신규 테스트 추가
- 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts`
- 상세: `integration.deleted`, `integration.rotated`, `integration.scope_changed`, `integration.created` 등 4개 하드코딩 문자열이 `AUDIT_ACTIONS.*` 상수로 교체됐다. 신규로 추가된 `reauthorize → integration.reauthorized` 테스트와 `update` describe(3 케이스: 이름 변경 + 무변경 + 없는 리소스) 는 기존 커버리지 갭을 보완한다.
- 제안: 해당 없음.

---

### [WARNING] 파일 5: integrations.service.spec.ts — `update` 테스트에서 `save` 호출 여부 미검증
- 위치: `integrations.service.spec.ts` `update → records integration.updated with name diff` 케이스
- 상세: 이름 변경 케이스에서 `result.name === 'Renamed'` 와 `auditLogsService.record` 호출을 검증하지만, `integrationRepo.save` 가 실제로 호출됐는지는 단언하지 않는다. mock `save` 가 entity 를 그대로 반환하는 구현이므로 현재는 우연히 통과하지만, 향후 구현이 `save` 를 생략하거나 다른 경로를 사용해도 테스트가 통과한다.
- 제안: `expect(integrationRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Renamed' }))` 단언을 추가한다.

---

### [WARNING] 파일 5: integrations.service.spec.ts — `reauthorize` 의 OAuth 경로에서 audit 기록 여부 미검증
- 위치: `integrations.service.spec.ts` `reauthorize → delegates to OAuth service for OAuth integrations` 케이스
- 상세: OAuth 경로의 `reauthorize` 가 audit 를 기록하지 않는(또는 다른 action 으로 기록하는) 계약인지가 불명확하다. non-OAuth reset 경로에만 `integration.reauthorized` 가 기록된다면, OAuth 경로에서 `auditLogsService.record` 가 호출되지 않음을 명시적으로 검증해야 회귀를 방지할 수 있다.
- 제안: OAuth reauthorize 케이스에 `expect(auditLogsService.record).not.toHaveBeenCalled()` 또는 `toHaveBeenCalledWith(expect.objectContaining({ action: AUDIT_ACTIONS.INTEGRATION_REAUTHORIZED }))` 의 부재 단언을 추가한다.

---

### [INFO] 파일 6: workspaces.service.spec.ts — AUDIT_ACTIONS 상수 일관화
- 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` L 130 (diff)
- 상세: `'workspace.transfer_ownership'` 문자열을 `AUDIT_ACTIONS.WORKSPACE_TRANSFER_OWNERSHIP` 으로 교체했다. 변경은 단순하고 기존 `transferOwnership` 테스트 커버리지(낙관적 성공·비관적 행위자·개인 워크스페이스·자기 이전·이미 owner·리소스 없음)는 그대로 유효하다.
- 제안: 해당 없음.

---

### [INFO] audit-logs.service.ts — `record` 의 best-effort(swallow) 계약 테스트 부재
- 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` `record()` catch 블록
- 상세: `record()` 가 DB 오류 발생 시 경고 로그만 남기고 예외를 삼키는(best-effort) 계약이 핵심 보안 요건이지만, `audit-logs.spec.ts` 에 해당 분기를 검증하는 테스트가 없다. `auth-configs.service.ts` 주석(`"audit DB 장애가 CRUD 를 실패시키지 않는다"`)에서 참조되지만 실제 테스트는 존재하지 않는다.
- 제안: `audit-logs.spec.ts` 또는 별도 `audit-logs.service.spec.ts` 에 다음 케이스를 추가한다:
  ```
  it('record() — DB 오류 시 예외를 던지지 않는다 (best-effort)', async () => {
    repo.save.mockRejectedValue(new Error('DB fail'));
    await expect(service.record({ ... })).resolves.toBeUndefined();
  });
  ```

---

## 요약

이번 변경의 테스트 관점 핵심은 세 가지다. (1) `auth-configs.controller.spec.ts` 에 userId/req.ip 전파 전용 describe 블록이 신규 추가되어 감사 로그 주체·IP 누락·스왑 회귀를 적절히 방어한다. (2) 여러 spec 파일에서 하드코딩 문자열을 `AUDIT_ACTIONS` 상수로 교체하여 action 값 오탈자를 컴파일 타임에 차단한다. (3) `integrations.service.spec.ts` 에 `reauthorize` audit 와 `update` 케이스가 보완됐다. 주요 개선 여지는 (a) `AuditLogsService.record` 의 best-effort(swallow) 계약 테스트 부재, (b) OAuth reauthorize 경로에서 audit 미기록 계약의 명시적 단언 부재, (c) `integrations.service.spec.ts` update 케이스에서 `save` 호출 단언 부재다. 전반적인 커버리지는 충분하고 테스트 격리·가독성도 양호하다.

## 위험도

LOW
