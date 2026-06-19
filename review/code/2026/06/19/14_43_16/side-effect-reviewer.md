# Side-Effect Review — PR #633 후속 ⑦ (`queryUsageNodes` 추출)

Reviewer: side-effect-reviewer  
Date: 2026-06-19  
Changeset: staged vs origin/main  
Primary file: `codebase/backend/src/modules/integrations/integrations.service.ts`

---

## 발견사항

### [INFO] `getUsages` 공개 계약 — 모든 호출자에 이상 없음

- 위치: `integrations.service.ts:735–746`, `integrations.controller.ts:334`
- 상세: `getUsages(id, workspaceId)` 의 시그니처, 반환 타입(`Promise<IntegrationUsageWorkflow[]>`), NotFound 예외(`findById` → `NotFoundException code=RESOURCE_NOT_FOUND`)가 이전과 완전히 동일하다. 코드베이스 전체에서 비-테스트 호출자는 `integrations.controller.ts:334` 단 한 곳이며, 해당 라인은 변경되지 않았다. 인터페이스 파괴 없음.

### [INFO] `remove()` — ConflictException 블록 및 캐시 무효화 방송 동작 보존 확인

- 위치: `integrations.service.ts:691–729`
- 상세:
  - `queryUsageNodes`의 반환값이 비어 있지 않으면 `ConflictException { code: 'INTEGRATION_IN_USE', usages }` 를 던진다. 이 경로는 이전 `this.getUsages(id, workspaceId)` 호출과 동일한 판단 로직을 유지한다.
  - `integrationRepository.remove(entity)` → audit log 기록 → `broadcastCredentialChange(id)` 는 `usages.length === 0` 일 때만 도달한다. 캐시 방송은 성공 경로에서만 발생한다. 변경 전후 동일.
  - ConflictException 발생 시 broadcast 가 호출되지 않는 것도 보존되어 있다.

### [INFO] SQL 쿼리 내용 — 원본과 byte 수준 동일

- 위치: `integrations.service.ts:759–818` (`queryUsageNodes`)
- 상세: `origin/main` 의 `getUsages` 내부 쿼리 블록과 `queryUsageNodes` 의 쿼리 블록을 직접 비교했다. `innerJoin`, `where`(workspace scoping), `Brackets` 내 두 조건(`config->>'integrationId'` 직접참조 ∪ `config->'mcpServers' @>` MCP), `select` 컬럼 목록, `CASE WHEN` usage_kind 산출식, `orderBy('w.name','ASC')`, `addOrderBy('n.label','ASC')`, `getRawMany()` 호출, 그리고 그루핑 로직까지 모두 이동만 되었을 뿐 내용이 동일하다. 정렬 순서·워크스페이스 스코핑·MCP 참조 검출 모두 동일하게 유지된다.

### [INFO] `queryUsageNodes` "존재 검증 없음" 계약의 안전성

- 위치: `integrations.service.ts:759`
- 상세: `queryUsageNodes` 의 직접 호출자는 현재 코드베이스에서 `remove()` 와 `getUsages()` 두 곳뿐이다. `remove()` 는 `integrationRepository.findOne({ where: { id, workspaceId } })` 로 존재·workspace 소유를 사전 검증하고 없으면 `NotFoundException` 을 던진다. `getUsages()` 는 `findById()` 로 동일 검증을 수행한다. 헬퍼가 `private` 으로 선언되어 있어 서비스 외부에서 직접 호출할 수 없다. 안전하다.

### [INFO] 마이그레이션 V099 — 트랜잭션 외부 실행 설정 확인

- 위치: `codebase/backend/migrations/V099__node_config_gin_index.sql`, `.conf`
- 상세: `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 는 트랜잭션 안에서 실행 불가하므로 동봉된 `.conf` 파일에 `executeInTransaction=false` 가 명시되어 있다. 이 파일 쌍은 이번 ⑦ 리팩터와 직접 연관된 부작용 없이 독립적으로 동작한다. 런타임 서비스 코드에 영향 없음.

---

## 요약

이번 변경은 `getUsages` 내부의 usage-node 쿼리 블록을 `private queryUsageNodes` 헬퍼로 순수하게 추출하고, `remove()` 에서 불필요한 중복 `findById` 호출을 제거한 것이다. 공개 계약(`getUsages` 시그니처·NotFound 동작·반환 형태)은 완전히 보존되었고, 유일한 비-테스트 호출자인 컨트롤러에 영향이 없다. `remove()` 의 ConflictException 블록과 성공 시 캐시 방송 순서도 변경 없이 유지된다. 추출된 SQL은 원본과 내용이 동일하며 워크스페이스 스코핑·정렬·MCP 참조 감지가 모두 보존된다. `queryUsageNodes` 의 "존재 검증 없음" 계약은 `private` 가시성과 두 호출 지점 모두의 사전 검증에 의해 안전하게 보호된다. 의도하지 않은 상태 변경·전역 변수 도입·파일시스템 부작용·네트워크 호출 변경은 없다.

---

## 위험도

NONE

---

VERDICT: PASS — Critical 0, Warning 0, Info 5 (모두 비차단 확인 사항)
