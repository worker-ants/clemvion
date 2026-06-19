# Testing Review — PR #633 후속 ⑦ + ⑤ (getUsages split / V099 GIN index)

Reviewer: testing-reviewer
Date: 2026-06-19
Scope: staged changes in worktree agent-ab5333a68e686d2b1

---

## 발견사항

### [INFO] 새 회귀 테스트는 의미 있고 적절히 타겟팅되어 있다
- 위치: `integrations.service.spec.ts` line 1001-1008
- 상세: 테스트는 `service.remove()`를 호출한 뒤 `integrationRepo.findOne`이 정확히 1번, `nodeRepo.createQueryBuilder`가 정확히 1번 호출됨을 어서션한다. 이는 리팩터의 핵심 의도(remove → queryUsageNodes 직접 호출로 중복 findById 제거)를 정확히 검증한다. `beforeEach`가 `findOne`을 항상 유효한 엔티티로 모킹하므로 신선한 상태가 보장된다. `toHaveBeenCalledTimes(1)` 어서션은 이 맥락에서 적절하다 — 이 assertion이 깨지는 경우는 (a) getUsages를 통한 경로가 다시 도입되어 findOne이 2번 호출되거나, (b) queryUsageNodes 호출이 누락되어 createQueryBuilder가 0번이 되는 경우로, 양쪽 모두 실제 회귀다.
- 평가: "brittle" 리스크가 없다. 호출 횟수는 내부 구현 세부사항이 아니라 이 리팩터의 공개 계약(존재 검증 중복 제거)이므로, call-count assertion이 정당하다.

### [INFO] 요청된 4가지 커버리지 시나리오 전부 존재한다
- 위치: `integrations.service.spec.ts` lines 985-1085
- 상세:
  - (a) **직접 참조로 인한 remove 차단**: line 1032-1052 (`throws ConflictException when usages exist`, `usage_kind: 'direct'`) - 존재 확인.
  - (b) **MCP 참조만으로 인한 remove 차단**: line 1054-1074 (`blocks deletion when only an MCP reference exists`, `usage_kind: 'mcp'`) - 존재 확인.
  - (c) **사용처 0건 시 remove 성공**: line 986-993 (`deletes when no usages exist`) - 존재 확인. `nodeRepo.createQueryBuilder`의 기본 mock이 `raw: []`를 반환하도록 `beforeEach`에서 설정되어 있다.
  - (d) **getUsages NotFound**: line 1081-1086 (`throws NotFoundException when the integration is absent`) - 존재 확인.
- 평가: 4가지 경우 모두 커버됨.

### [WARNING] remove() 자체에 NotFoundException 테스트가 없다
- 위치: `integrations.service.spec.ts`, `describe('remove')` 블록 (lines 985-1075)
- 상세: `remove()` 내부에서 `findOne`이 `null`을 반환할 때 `NotFoundException`을 던지는 분기(service.ts line 695-699)에 대한 단위 테스트가 `describe('remove')` 블록에 없다. 이 분기는 PR #633 ⑦ 리팩터와 직접적으로 연관된다 — 리팩터 이전에는 `getUsages` 내부의 `findById`가 NotFound를 담당했지만, 이제 `remove()`의 자체 `findOne` 검사가 유일한 검증 지점이 되었다. `getUsages`에는 동등한 테스트가 있다(line 1081). 리팩터 후 `remove()`의 NotFound 경로는 수동 검사 없이는 단위 수준에서 회귀 보호를 받지 못한다.
- 제안: `describe('remove')` 블록에 다음을 추가한다:
  ```typescript
  it('throws NotFoundException when the integration is absent', async () => {
    integrationRepo.findOne.mockResolvedValue(null);
    await expect(service.remove('missing', 'ws-1', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(nodeRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
  ```
  세 번째 어서션은 NotFound 이후 queryUsageNodes가 실행되지 않음을 함께 검증하여 이중 가치를 가진다.

### [INFO] getUsages 공개 NotFound 계약은 헬퍼 분리 후에도 보존됨이 확인된다
- 위치: `integrations.service.spec.ts` line 1081-1086; `integrations.service.ts` lines 739-745
- 상세: `getUsages`는 여전히 `findById`를 선행 호출하고(line 744), 해당 경로에 대한 단위 테스트가 존재한다(line 1081). 공개 컨트롤러 경로의 NotFound 계약이 유지됨을 테스트가 명시적으로 잠근다.
- 평가: 헬퍼 경계 분리 후에도 getUsages의 NotFound 보호가 올바르게 테스트된다.

### [INFO] e2e가 GIN 인덱스 마이그레이션 적용을 간접적으로 커버한다
- 위치: `test/integration-usage-mcp.e2e-spec.ts` — 테스트 A, B, C
- 상세: e2e 스위트는 실제 PostgreSQL 인스턴스에서 마이그레이션이 적용된 상태로 실행된다. V099가 적용되지 않거나 `INVALID` 상태로 남아 `@>` containment 쿼리를 망가뜨리면 테스트 A/C가 실패한다. 이것은 "마이그레이션 자체가 오류 없이 실행되었는가"를 간접 증명한다. `idx_node_config_gin` 인덱스 존재 여부를 `pg_indexes`/`pg_class`로 직접 어서션하는 테스트는 없지만, 기능적 동작으로 충분히 커버된다.
- 평가: 마이그레이션의 기능적 효과는 검증된다. `executeInTransaction=false`(CONCURRENTLY) 설정의 올바름은 e2e 스택이 Flyway를 통해 마이그레이션을 실제로 실행할 때만 검증되며, 현재 e2e 환경이 그 경로를 사용하는 것으로 보인다.

### [INFO] e2e에 migration 자체 유효성(INVALID 인덱스 잔존)을 감지하는 어서션이 없다
- 위치: `test/integration-usage-mcp.e2e-spec.ts`
- 상세: `CREATE INDEX CONCURRENTLY`가 중간에 실패하면 PostgreSQL에 `INVALID` 상태 인덱스가 잔존한다. 이 경우 쿼리는 계속 동작하지만(seq scan fallback) 인덱스 보호 목적이 달성되지 않는다. 현재 e2e는 이 경우를 감지하지 않는다. 예를 들어 `SELECT indisvalid FROM pg_index WHERE ...` 어서션을 추가할 수 있다.
- 평가: 운영 위험은 낮다(관리성 경로, 빈도 낮음). INFO로 분류한다. 반드시 수정할 필요는 없으나 향후 인덱스 신뢰성 검증을 강화하려면 고려 가능하다.

### [INFO] 두 개의 ConflictException 테스트가 동일 시나리오를 중복 검증한다
- 위치: `integrations.service.spec.ts` lines 1010-1029 (`does not broadcast when removal is blocked by usages`) 및 lines 1032-1052 (`throws ConflictException when usages exist`)
- 상세: 두 테스트 모두 `usage_kind: 'direct'` raw 결과를 mock하고 `ConflictException`을 어서션한다. 전자는 추가로 `integrationCacheBus.publish`가 호출되지 않음을 확인하고, 후자는 `integrationRepo.remove`가 호출되지 않음을 확인한다. 기능적으로 중복은 아니지만 직접 참조 차단이 두 번 테스트되어 MCP 전용 차단 케이스(line 1054)와 명시적 대칭이 맞지 않는다(MCP에 대해서는 no-broadcast 테스트가 별도로 없다).
- 제안: 선택적 개선. `does not broadcast`와 `does not remove` 어서션을 하나의 테스트로 통합하거나, MCP 차단 테스트에도 no-broadcast 어서션을 추가하는 것이 일관성에 도움이 된다. 버그 위험은 없다.

---

## 요약

이번 변경의 핵심인 `queryUsageNodes` 분리와 `remove()` 내 중복 findById 제거는 새로 추가된 회귀 테스트(findOne===1 + createQueryBuilder===1)가 의미 있게 잠근다. call-count assertion은 이 리팩터의 공개 계약을 표현하므로 부당한 brittle 리스크가 아니다. 요청된 4가지 커버리지 시나리오(직접 참조 차단, MCP 참조 차단, 0 사용처 삭제 성공, getUsages NotFound)는 모두 기존 spec에 존재한다. 단 하나의 갭이 있다: `remove()` 자체의 NotFound 경로(findOne null → NotFoundException)에 대한 단위 테스트가 `describe('remove')` 블록에 없다. 리팩터 전에는 `getUsages → findById`가 이 역할을 겸했지만, 이제 `remove()`의 자체 검사만이 유일한 검증 지점이 되었으므로 단위 수준 회귀 보호 공백이 발생한다. e2e(V099 GIN 인덱스)는 마이그레이션의 기능적 효과를 실 PG에서 적절히 검증하며, `@>` containment CASE SQL 정확성은 테스트 A/C가 충분히 담당한다.

---

## 위험도

LOW

주 요인: `remove()` NotFound 단위 테스트 누락이 가장 큰 갭이나, 해당 분기는 단순하고 e2e 환경에서 통합 수준으로 커버될 가능성이 높다. 나머지 발견사항은 INFO 수준이다.

---

VERDICT: PASS with recommendation — WARNING 1건(remove NotFound 단위 테스트 추가 권장). 차단 수준은 아니며 현행 121개 통과 테스트 구성은 핵심 리팩터 계약을 적절히 보호한다.
