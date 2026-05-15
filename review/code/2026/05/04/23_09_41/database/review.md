### 발견사항

- **[INFO]** 스키마 변경 없음 — 마이그레이션 불필요
  - 위치: `execution-response.dto.ts` — `triggerSource`, `triggerLabel` 필드 추가
  - 상세: 두 필드 모두 DB에 저장되는 컬럼이 아니라 기존 `trigger.type`, `executor.name/email`, `parentExecutionId`에서 런타임에 파생되는 값이다. 스키마 변경이 전혀 없으므로 무중단 배포 위험이 없다.
  - 제안: 해당 없음 (양호)

---

- **[WARNING]** `getCount()` 쿼리에 불필요한 LEFT JOIN 포함 가능성
  - 위치: `executions.service.ts` — `findByWorkflow()` 내 `qb.getCount()`
  - 상세: `qb`에 `.leftJoin('e.trigger', ...).addSelect(...)`, `.leftJoin('e.executor', ...).addSelect(...)`가 추가된 상태로 `getCount()`를 호출한다. TypeORM의 `getCount()`는 SELECT 절을 `COUNT(*)`로 교체하지만, WHERE 조건에 참조되지 않는 LEFT JOIN을 반드시 제거한다는 보장이 TypeORM 버전에 따라 다르다. 실제로 발행되는 SQL이 `FROM executions e LEFT JOIN triggers trigger ON ... LEFT JOIN users executor ON ... WHERE e.workflow_id = ?` 형태라면, 대형 테이블에서 COUNT 성능이 불필요하게 저하된다.
  - 제안: COUNT 전용 QueryBuilder를 분리하거나, 실제 발행 SQL을 TypeORM `logging: true`로 확인해 JOIN이 포함되는지 검증한다. 포함된다면 아래처럼 분리한다:
    ```ts
    const countQb = this.executionRepository
      .createQueryBuilder('e')
      .where('e.workflow_id = :workflowId', { workflowId });
    if (status) countQb.andWhere('e.status = :status', { status });
    const totalItems = await countQb.getCount();
    ```

---

- **[INFO]** N+1 쿼리 방지 — `loadParentWorkflowNames` 배치 조회 적절
  - 위치: `executions.service.ts:125–153`
  - 상세: 서브워크플로우 실행이 있을 때 `parentExecutionId`를 Set으로 중복 제거한 뒤 `IN(...)` 단일 쿼리로 부모 실행의 `workflow.name`을 일괄 로드한다. 서브워크플로우 행이 없으면 쿼리 자체를 건너뛴다. 테스트(`executions.service.spec.ts`)에서도 `find` 호출 횟수를 명시적으로 1회로 검증한다.
  - 제안: 해당 없음 (양호)

---

- **[INFO]** 페이지당 최대 3회 쿼리 (기존 2회 → 최대 3회)
  - 위치: `executions.service.ts` — `findByWorkflow()`
  - 상세: ① `getCount()`, ② `getMany()`, ③ `loadParentWorkflowNames()`(조건부). 서브워크플로우 행이 있을 때만 ③이 실행된다. 추가 쿼리는 배치 단일 쿼리이므로 허용 가능한 수준이다.
  - 제안: 해당 없음

---

- **[INFO]** SELECT 컬럼 최소화로 민감 데이터 노출 방지
  - 위치: `executions.service.ts:58–65`
  - 상세: `addSelect(['trigger.id', 'trigger.type', 'trigger.name'])`, `addSelect(['executor.id', 'executor.name', 'executor.email'])`로 필요한 컬럼만 선택해 `User.passwordHash` 등 민감 필드가 응답에 포함되지 않는다.
  - 제안: 해당 없음 (양호)

---

### 요약

이번 변경은 DB 스키마를 전혀 수정하지 않고, 기존 테이블의 관계(trigger, executor, workflow)를 활용해 파생 필드를 런타임에 계산하는 방식을 채택했다. N+1 문제를 `IN(...)` 배치 쿼리로 선제 차단했고, SELECT 컬럼을 명시적으로 제한해 민감 정보 노출 위험도 낮췄다. 유일한 주의사항은 `getCount()`에 LEFT JOIN이 포함될 가능성으로, TypeORM 버전 및 실제 쿼리 플랜에 따라 대형 테이블에서 카운트 쿼리 성능이 저하될 수 있다. 현 트래픽 규모에서 즉각적인 문제는 없으나, 로그로 실제 발행 SQL을 한 번 확인하는 것을 권장한다.

### 위험도

**LOW**