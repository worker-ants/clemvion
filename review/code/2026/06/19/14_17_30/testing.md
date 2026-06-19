# 테스트 관점 코드 리뷰

**대상 브랜치**: `claude/agent-a5522a5d692774509` (`origin/main..HEAD`)
**리뷰 범위**: `codebase/` 전체 변경
**일시**: 2026-06-19

---

## 발견사항

### [WARNING] makeQueryBuilder에 Brackets/orWhere mock 부재 — SQL 분기 호출 검증 불가

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` lines 55–77 (`makeQueryBuilder`)
- **상세**: `integrations.service.ts`의 `getUsages`는 `new Brackets(qb => qb.where(...).orWhere(...))` 를 `andWhere`에 전달한다. 그런데 단위 테스트의 `makeQueryBuilder`는 `andWhere`를 `mockReturnThis()`로만 처리하며 Brackets 콜백을 실행하지 않는다. 결과적으로 실제 `orWhere`가 QueryBuilder에 등록되는지 여부를 전혀 검증하지 않는다. 서비스 코드가 `new Brackets(...)` 호출 자체를 삭제하거나 SQL을 잘못 조합해도 단위 테스트는 PASS한다. 이 갭은 e2e가 보완하지만, 단위 레벨에서 SQL 구성 의도를 전혀 어서션하지 않는 구조적 취약점이다.
- **제안**: `makeQueryBuilder`에 `Brackets` 콜백을 실행하는 stub을 추가하거나(`andWhere: jest.fn().mockImplementation((arg) => { if (typeof arg === 'function') arg(qb); return qb; })`), `getUsages` 계열 테스트에서 `nodeRepo.createQueryBuilder` 호출 후 `andWhere.mock.calls`를 검사해 Brackets 인스턴스 전달 여부를 한 케이스라도 어서션한다.

---

### [WARNING] getUsages의 NotFoundException 경로에 대한 단위 테스트 부재

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` — `describe('getUsages')` 블록 (lines 1071–1187)
- **상세**: `getUsages` 내부는 먼저 `this.findById(id, workspaceId)`를 호출해 통합이 해당 워크스페이스에 속하는지 검증하고, 없으면 `NotFoundException`을 던진다. `describe('findById')`, `describe('update')`, `describe('remove')`는 모두 `integrationRepo.findOne.mockResolvedValue(null)` + `rejects.toThrow(NotFoundException)` 패턴을 보유하나, `getUsages` 블록에는 이 케이스가 없다. 다른 워크스페이스 소유의 통합 ID로 사용처를 조회하는 cross-workspace 누출 방어 경로가 단위 수준에서 미검증이다.
- **제안**: `getUsages` describe 블록에 `integrationRepo.findOne.mockResolvedValue(null)` 후 `service.getUsages('missing', 'ws-1').rejects.toThrow(NotFoundException)` 케이스를 1건 추가한다.

---

### [WARNING] e2e에서 여러 mcpServers 항목 중 하나만 매칭되는 케이스 미커버

- **위치**: `codebase/backend/test/integration-usage-mcp.e2e-spec.ts` — 테스트 A (line 120)
- **상세**: e2e 테스트 A에서 MCP 참조 노드는 항상 `mcpServers: [{ integrationId: intId }]` 형태로 배열 항목이 단 1개다. `config -> 'mcpServers' @> :mcpProbe::jsonb`의 containment 연산자는 배열 내 임의 위치의 부분 매칭을 수행하는데, 배열의 두 번째 또는 이후 항목이 매칭되는 경우(`mcpServers: [{integrationId: 'other'}, {integrationId: intId}]`)를 커버하지 않는다. 이 패턴은 실제 다중 MCP 서버 연결 시나리오에서 발생 가능하다.
- **제안**: 테스트 A에 `mcpServers` 배열의 0번 인덱스가 무관한 통합을 가리키고 1번 인덱스가 `intId`를 가리키는 노드를 추가해 containment 연산이 순서 무관하게 작동하는지 검증한다.

---

### [INFO] "both direct and MCP" 단위 테스트는 SQL CASE 중복 제거를 검증하지 않음

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` lines 1160–1186
- **상세**: `keeps direct precedence when a node matches both direct and MCP` 테스트는 mock이 단일 `usage_kind='direct'` row를 반환하는 상황을 시뮬레이션하며, SQL CASE 식이 단일 row를 반환한다는 전제를 주석으로 명시했다. 다만 mock은 SQL을 실행하지 않으므로 "양쪽 매칭 시 row가 1건만 나오는지"(중복 제거)를 전혀 검증하지 않는다. 이는 주석에서도 인정하고 있으나, e2e 테스트 A도 "both" 케이스를 직접 다루지 않는다.
- **제안**: e2e에 직접 참조와 MCP 참조를 동시에 가진 노드를 추가하고, usages 결과에서 해당 노드가 1건(중복 없이)으로 나타나며 `usageKind='direct'`인지 검증하는 케이스를 추가한다. 이 케이스의 회귀 차단력은 spec §7.1의 핵심이다.

---

### [INFO] 프론트엔드 MCP 배지 렌더링에 대한 테스트 부재

- **위치**: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` lines 648–652
- **상세**: `usageKind === "mcp"` 조건부 MCP 배지 렌더링 코드가 추가되었으나, 프론트엔드 단위 테스트(Vitest) 및 Playwright e2e(`codebase/frontend/e2e/integrations/list.spec.ts`) 어느 쪽에도 이 배지 표시 여부를 검증하는 케이스가 없다. i18n `usageMcpBadge` 키도 기존 로케일 동기화 테스트에서 커버되지 않는다.
- **제안**: 프론트엔드 e2e에서 usages 응답에 `usageKind='mcp'` 노드를 포함시키고 MCP 배지 텍스트가 화면에 나타나는지 검증하는 케이스를 추가한다.

---

### [INFO] e2e 테스트에서 데이터 격리는 unique prefix에만 의존 — afterAll 정리 없음

- **위치**: `codebase/backend/test/integration-usage-mcp.e2e-spec.ts` lines 57–59
- **상세**: `afterAll`에서 `db.end()`만 호출하고 생성한 통합·워크플로우·노드를 삭제하지 않는다. 이는 프로젝트의 다른 e2e 파일들과 동일한 패턴이며, ephemeral DB 환경을 가정한 명시적 설계다(`helpers/db.ts` 주석 참조). 현재 컨벤션과 일치하므로 위반은 아니다.
- **제안**: 조치 불필요. 로컬 반복 실행 시나리오가 필요하다면 생성한 통합 ID를 추적해 DELETE 호출을 afterAll에 추가하는 것을 고려한다.

---

## 요약

이번 변경은 MCP 참조 추적(`usageKind` 필드) 기능에 대한 테스트를 신규 e2e와 단위 테스트 보강으로 잘 분리했다. SQL `@>` containment 및 CASE 식의 실 PG 동작을 e2e로, 매핑 로직을 단위 테스트로 커버하는 책임 분리는 적절하다. 다만 세 가지 구조적 갭이 존재한다: (1) 단위 테스트 mock이 `Brackets` 콜백을 실행하지 않아 SQL 구성 의도가 단위 수준에서 전혀 어서션되지 않으며, (2) `getUsages`의 NotFoundException(cross-workspace 누출 방어) 경로가 단위 테스트에 없고, (3) `mcpServers` 배열 다중 항목 중 부분 매칭 및 "양쪽 매칭 시 row 1건 + usageKind=direct" 케이스가 e2e에 없어 spec §7.1의 핵심 우선순위 보장이 end-to-end로 미검증이다. 프론트엔드 MCP 배지 렌더링에 대한 테스트도 전무하다.

---

## 위험도

**MEDIUM**

주요 근거: SQL 분기(Brackets/orWhere) 호출 자체가 단위 수준에서 미검증이며, spec §7.1의 "direct 우선" 중복 제거가 e2e에서도 직접 어서션되지 않는다. 기능은 실제 e2e PASS(35 suites/204 tests)로 검증되었으나, 회귀 차단력에 구조적 갭이 있다.

STATUS: DONE
