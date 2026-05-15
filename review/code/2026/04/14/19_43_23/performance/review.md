## 성능 코드 리뷰

### 발견사항

---

**[WARNING] `createVersion` 에서 버전 번호 산출 시 Race Condition 가능**
- 위치: `workflow-versions.service.ts` — `createVersion` 메서드
- 상세: `createQueryBuilder`로 최신 버전을 SELECT한 뒤 `nextVersion = latest + 1`로 계산하고 INSERT하는 패턴은 두 요청이 동시에 들어올 때 동일한 버전 번호를 생성할 수 있음. 엔티티에 `@Unique(['workflowId', 'version'])`가 선언되어 있어 DB 레벨에서 중복은 차단되지만, 에러로 이어져 `saveCanvas` 호출 전체가 실패함.
- 제안: `INSERT ... SELECT MAX(version)+1` 패턴을 사용하거나, PostgreSQL의 `nextval` 시퀀스 또는 Serializable 트랜잭션으로 단일 원자적 연산으로 처리. 또는 `createVersion`을 `saveCanvas`의 트랜잭션 내부로 이동.

---

**[WARNING] 버전 생성이 트랜잭션 외부에서 실행됨**
- 위치: `workflows.service.ts:304–311`
- 상세: `dataSource.transaction()` 커밋 이후에 `workflowVersionsService.createVersion()`이 호출됨. 캔버스 저장은 성공했는데 버전 생성이 실패하면 데이터 불일치 발생. 또한 두 DB 왕복이 순차적으로 발생해 레이턴시가 2배가 됨.
- 제안: `createVersion` 호출을 `dataSource.transaction()` 콜백 내부 마지막에 포함시켜 원자성 보장 + 왕복 횟수 감소. `WorkflowVersionsService`에 EntityManager를 받는 오버로드 추가 필요.

---

**[WARNING] `findByWorkflow`가 `snapshot` 컬럼(대용량 jsonb)을 항상 포함하여 반환**
- 위치: `workflow-versions.service.ts:14–19`
- 상세: 버전 목록 API(`GET /workflows/:wfId/versions`)는 버전 목록을 표시하는 용도인데, 각 버전의 `snapshot` 전체(노드/엣지 전체 상태 jsonb)를 함께 로드함. 워크플로우 규모가 커지거나 버전이 수십 개 쌓이면 단일 목록 조회에서 MB 단위 데이터를 전송하게 됨.
- 제안: 목록 조회에서는 `snapshot`을 `select`에서 제외하고 상세 조회(`findOne`)에서만 포함:
  ```ts
  this.workflowVersionRepository.find({
    select: ['id', 'workflowId', 'version', 'changeSummary', 'createdBy', 'createdAt'],
    where: { workflowId },
    order: { version: 'DESC' },
    relations: ['creator'],
  });
  ```

---

**[WARNING] `diffSnapshots`에서 `config` 비교 시 매번 `JSON.stringify` 호출**
- 위치: `diff-utils.ts:40–42`, `fieldEqual` 함수
- 상세: 노드 수가 N일 때 `NODE_COMPARE_FIELDS`(10개) × N번의 `fieldEqual` 호출이 발생하고, `config`가 복잡한 객체일 경우 매번 직렬화함. `JSON.stringify`는 객체 순서에 따라 동일 객체라도 다른 결과가 나올 수 있어 정확성 문제도 있음.
- 제안: `config`처럼 중첩 객체 필드는 별도 딥이퀄 로직을 사용하거나, 위치/레이블 등 스칼라 필드와 분리하여 처리. 현실적인 워크플로우 규모(~수십 노드)에서는 허용 가능한 수준이므로 Medium 우선순위.

---

**[INFO] `VersionDiffDialog`가 두 버전을 독립적으로 fetch하나 queryKey 캐시 재활용은 적절함**
- 위치: `version-diff-dialog.tsx:17–27`
- 상세: `useQuery`를 두 번 병렬로 호출하는 방식은 정상. `queryKey: ["workflow-version", workflowId, id]`를 사용하므로 이전에 상세 다이얼로그에서 동일 버전을 조회했다면 캐시에서 즉시 반환됨. 현재 구현이 적절함.
- 제안: 해당 없음.

---

**[INFO] `buildSnapshot`에서 노드/엣지 전체를 객체 복사**
- 위치: `workflows.service.ts` — `buildSnapshot` 메서드
- 상세: 저장 직후의 `Node[]`, `Edge[]` 배열을 순회하며 새 객체를 생성함. 노드/엣지가 수백 개 이하라면 허용 가능하지만, 대형 워크플로우에서는 불필요한 GC 압박이 발생할 수 있음.
- 제안: 스냅샷 구조가 DB Entity 구조와 동일하다면 `pick` 유틸로 필드 선택을 추상화하여 코드 중복 방지. 현재 규모에서는 실질적 성능 문제 없음.

---

**[INFO] `findByWorkflow`에서 `creator` relation을 항상 JOIN**
- 위치: `workflow-versions.service.ts:14–19`
- 상세: 버전 목록에서 `creator` 정보는 UI에서 표시(`creatorLabel`)하지만, 워크플로우 버전이 수백 개일 때 JOIN 비용이 누적됨. `creator`가 `user` 테이블 조회이므로 인덱스가 있다면 큰 문제는 아님.
- 제안: `user` 테이블의 `created_by` 컬럼에 인덱스 확인. 현재 구조에서 개선 필요 수준은 아님.

---

### 요약

전체적으로 구현은 적절하나 두 가지 성능/정확성 위험이 주목할 만하다. 첫째, `createVersion`이 캔버스 저장 트랜잭션 외부에서 실행되어 원자성이 없고 DB 왕복이 2회 발생한다. 둘째, `findByWorkflow`(버전 목록 API)가 대용량 `snapshot` jsonb를 불필요하게 로드하여 워크플로우가 성장할수록 응답 크기와 DB I/O가 비례하여 증가한다. 나머지 항목(diff 비교의 JSON.stringify, snapshot 객체 복사)은 현실적인 워크플로우 규모에서는 문제가 되지 않으나 장기적으로 개선 여지가 있다.

### 위험도

**MEDIUM**