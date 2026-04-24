### 발견사항

- **[INFO]** 실행 중(`running`) 상태 조회 시 비원자적 다중 읽기
  - 위치: `explore-tools.service.ts` — `getExecutionDetails` 내부
  - 상세: execution `findOne` → `loadTimeline` → `executionRepo.find(children)` 순서로 3개의 독립 쿼리가 순차 실행된다. running 실행의 경우, 첫 번째 쿼리가 `status:'running'`을 읽은 직후 execution이 `completed`로 전환되면 `execution.status='running'`이지만 `timeline`은 완결 상태인 불일치 스냅샷이 반환될 수 있다.
  - 제안: 이미 스펙과 memory 문서에서 "스냅샷" 동작으로 인정·문서화되어 있다. 현재 시스템 프롬프트(§8)가 LLM에게 이를 스냅샷으로 인식하도록 안내하지 않으므로, 추후 혼선 보고 시 §8에 "running 실행 응답은 조회 시점의 스냅샷이며, 이후 상태와 다를 수 있다" 한 줄 추가를 검토할 것 (memory 열린 주제로도 기록되어 있음).

- **[INFO]** `Promise.all`로 자식 타임라인 병렬 로드 시 DB 커넥션 일시 급증 가능
  - 위치: `explore-tools.service.ts:314-320` (`subExecutions` 블록)
  - 상세: `directChildren.map(async (child) => ({ timeline: await this.loadTimeline(child.id) }))` 가 `Promise.all`로 병렬 실행된다. 자식 실행 수만큼 동시 DB 쿼리가 발생하며, TypeORM 커넥션 풀이 작으면 대기가 생길 수 있다.
  - 제안: 실제로 직계 자식 실행(sub-workflow)은 대부분 수 개 이하여서 현 상태도 무방하다. 향후 고부하 시 `p-limit` 등으로 동시성 상한을 두는 방안을 검토할 것.

- **[INFO]** `isExecutionInScope` TOCTOU — execution 조회 후 scope 검증 사이의 상태 변화
  - 위치: `explore-tools.service.ts` — `isExecutionInScope`
  - 상세: `execution.parentExecutionId` 는 생성 이후 변경되지 않는 불변 필드이므로 실질적 위험은 없다. 그러나 `findOne(execution)` → `findOne(parent)` 사이에 parent가 삭제될 경우 `false`를 반환하여 `EXECUTION_NOT_IN_SCOPE`로 거부된다 — 보안상 안전한 방향이다.
  - 제안: 현 구현 유지.

---

### 요약

변경된 코드는 읽기 전용(read-only) 서비스 메서드 추가가 핵심으로, 서비스 레벨에 변경 가능한 공유 상태가 없고 NestJS 싱글턴 패턴 내에서 각 요청이 독립 DB 쿼리를 통해 처리된다. `Promise.all`을 이용한 병렬 타임라인 로드는 적절하며, 데드락·경쟁 조건·동기화 누락 등의 실질적 동시성 문제는 발견되지 않는다. 유일하게 주목할 지점은 running 실행 조회 시의 비원자적 스냅샷 특성인데, 이는 스펙에서 의도적으로 허용한 동작이며 이미 메모리 문서의 열린 주제로 등록되어 있다.

### 위험도

**LOW**