# Maintainability Review — PR #633 후속 ⑤⑦

**대상 파일**
- `codebase/backend/migrations/V099__node_config_gin_index.sql`
- `codebase/backend/migrations/V099__node_config_gin_index.conf`
- `codebase/backend/src/modules/integrations/integrations.service.ts` (getUsages 분리 + queryUsageNodes 추출)
- `codebase/backend/src/modules/integrations/integrations.service.spec.ts` (+1 회귀 테스트)
- `plan/in-progress/integration-mcp-usage-followups.md` (상태 갱신)

---

## 발견사항

### [INFO] `queryUsageNodes` 네이밍 — "Nodes" 가 반환 타입을 과소표현

- **위치**: `integrations.service.ts` line 759 — `private async queryUsageNodes(...): Promise<IntegrationUsageWorkflow[]>`
- **상세**: 메서드명은 "nodes" 를 질의한다고 읽히지만, 실제 반환값은 `IntegrationUsageWorkflow[]` — 노드를 workflow 단위로 묶은 그룹이다. 내부적으로 rows 를 `workflow_id` 로 group by 하는 로직이 있음에도 이름에서는 그 계층 구조가 드러나지 않는다. `queryUsagesByWorkflow` 또는 기존 공개 메서드와 대칭되게 `queryUsageWorkflows` 처럼 반환 형태를 암시하는 이름이 더 명확하다. 단, private 헬퍼이고 두 호출 지점(getUsages, remove) 만 있으므로 혼동 위험이 낮아 INFO로 분류한다.
- **제안**: `private async queryUsageWorkflows(...)` 로 변경 고려. 공개 `getUsages` 와 대칭 구도가 되어 의도가 자명해진다.

### [INFO] `getUsages` 인라인 주석이 doc-comment 역할을 중복 수행

- **위치**: `integrations.service.ts` lines 739–743 (getUsages 본문 첫 블록 주석)
- **상세**: `getUsages` 에는 JSDoc 이 없고 본문 내 인라인 주석이 설계 의도를 설명한다. 반면 바로 아래 private `queryUsageNodes` 에는 올바른 JSDoc (`/** ... */`) 이 있다. 코드베이스 내 다른 private 헬퍼(예: `requireEntity`)도 JSDoc 없이 직관적 이름에 의존하지만, 공개 메서드인 `getUsages` 는 컨트롤러 계약("NotFound throw")을 문서화하기 좋은 위치다. 현행 인라인 주석 방식이 작동하지 않는 건 아니지만, 공개 메서드에는 JSDoc, 본문 주석에는 구현 메모를 두는 것이 주변 코드(예: `getActivity` — doc-comment 없음이지만 본문도 설명 없음)와 비교해 일관성이 낮다.
- **제안**: `getUsages` 에 JSDoc 을 달고 인라인 주석을 제거하거나, 현행 인라인 주석 스타일을 유지하면서 내용을 더 간결하게 압축. 두 접근 모두 현 코드보다 낫다. 낮은 우선순위.

### [INFO] V099 `.conf` 파일 주석 — V095 스타일 대비 과잉 설명

- **위치**: `codebase/backend/migrations/V099__node_config_gin_index.conf` lines 1–3
- **상세**: V086 `.conf` 는 `executeInTransaction=false` 한 줄만 담는다. V095 `.conf` 도 동일하다. V099 `.conf` 는 이 단 줄 설정에 두 줄짜리 설명 주석(`-- CREATE INDEX CONCURRENTLY...`, `-- Flyway 가...`)을 추가했다. `.conf` 파일은 Flyway 설정 스니펫이고 대응 `.sql` 헤더에 이미 동일 설명이 존재하므로("동봉된 V099__node_config_gin_index.conf (executeInTransaction=false) 와 함께"), 이 주석은 중복 정보이자 스타일 불일치다.
- **제안**: `.conf` 파일을 V086/V095 와 동일하게 `executeInTransaction=false` 한 줄로 축소. 설명은 `.sql` 헤더에만 두는 기존 패턴이 단일 진실 원칙에 부합한다.

### [INFO] 테스트 설명문에 내부 구현 세부사항 노출

- **위치**: `integrations.service.spec.ts` line 1001 — `it('reads the integration row only once (no duplicate findById — PR #633 후속 ⑦)', ...)`
- **상세**: 테스트 이름이 "PR #633 후속 ⑦" 과 같이 PR 추적 번호를 포함한다. PR 번호는 테스트가 무엇을 검증하는지보다 왜 추가됐는지를 설명하는 히스토리 정보다. 시간이 지나면 PR 번호만으로는 컨텍스트를 추적하기 어렵다. 주변 테스트(예: `'broadcasts cache invalidation with the integration id (04 m-4)'`)도 같은 패턴을 사용하므로 기존 코드베이스 관습 내에서 일관성은 있다. 따라서 이번 변경이 새로운 문제를 도입한 것은 아니지만, 관습 자체는 장기 유지보수성 측면에서 이상적이지 않다.
- **제안**: 필요 시 PR 참조를 주석(`// regression guard for PR #633 후속 ⑦`)으로 분리하고 테스트 설명은 행동("remove() does not re-read integration row for usage check") 만 서술. 이번 PR 의 수정 범위는 아니므로 강제하지 않는다.

### [INFO] `remove()` 내 인라인 주석 — 한국어·영어 혼용 일관성

- **위치**: `integrations.service.ts` lines 702–704
- **상세**: 해당 블록 주석은 한국어로 작성됐다. 바로 아래 `getUsages` 의 인라인 주석(lines 739–743)은 영어다. 같은 메서드 분리 이유를 설명하면서 언어가 달라 읽는 맥락이 끊긴다. 코드베이스 전반에는 한국어·영어 주석이 혼재하는 패턴이 있으므로 규칙 위반은 아니지만, 같은 설계 결정을 설명하는 인접 주석 쌍이 언어를 달리하면 비교 독해가 불편하다.
- **제안**: `remove()` 의 한국어 주석과 `getUsages` 의 영어 주석 중 하나를 통일. `getUsages` JSDoc 이 이미 양쪽 설명을 포함하므로 `remove()` 의 인라인 주석은 더 짧게 영어 한 줄("already validated; skip extra findById")로도 충분하다.

---

## 요약

이번 변경은 `getUsages` 를 공개 게이트웨이와 private 쿼리 헬퍼로 명확하게 분리한 구조적으로 올바른 리팩터다. 책임 분리가 명확하고, `queryUsageNodes` doc-comment 가 "no existence check" 주의사항과 두 호출 지점의 관계를 잘 설명하며, 회귀 테스트가 계약을 핀으로 고정하고 있다. 발견된 네 건은 모두 INFO 수준이며 — private 헬퍼의 이름이 반환 형태를 완전히 반영하지 않는 점, 공개 메서드 `getUsages` 에 JSDoc 이 없는 점, V099 `.conf` 파일이 기존 `.conf` 패턴(한 줄)과 달리 중복 주석을 추가한 점, 테스트 이름에 PR 추적 번호가 혼재하는 관습 — 어느 것도 차단 사유가 아니다. V099 SQL 헤더 주석은 V095 참조 스타일(목적·핫경로·설계 근거·CONCURRENTLY 주의·DOWN) 을 충실히 따르고 있어 migration 문서 품질은 양호하다.

---

## 위험도

**LOW**
