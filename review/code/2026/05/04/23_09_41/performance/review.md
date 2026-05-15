### 발견사항

- **[WARNING]** `loadParentWorkflowNames` — 실행·워크플로우 전체 컬럼 과잉 로드
  - 위치: `executions.service.ts` → `loadParentWorkflowNames()` (L131~L146)
  - 상세: `executionRepository.find({ relations: ['workflow'] })`는 부모 `Execution`의 모든 컬럼(inputData, outputData, error 등 JSON 컬럼 포함)과 `Workflow` 전체 컬럼을 로드한다. 실제 사용하는 값은 `execution.id`와 `workflow.name` 두 개뿐이다. 워크플로우 정의 JSON이 클 경우(노드 수십 개) 페이지당 불필요한 데이터가 수십~수백 KB 추가된다.
  - 제안: `find` 대신 QueryBuilder로 필요한 두 컬럼만 선택한다.
    ```ts
    const parents = await this.executionRepository
      .createQueryBuilder('pe')
      .innerJoin('pe.workflow', 'wf')
      .select(['pe.id', 'wf.name'])
      .where('pe.id IN (:...ids)', { ids: parentIds })
      .getMany();
    ```

- **[INFO]** `getCount()` 후 `getMany()` 순차 실행 — 병렬화 불가 구조
  - 위치: `executions.service.ts` L73~L81
  - 상세: `qb.getCount()`와 이후 `qb.skip().take().getMany()`가 순차 await이다. TypeORM QueryBuilder가 `skip/take`를 in-place 변이(mutate)하므로 현재 구조에서는 병렬화할 수 없다. 단일 데이터베이스 연결 풀에서 두 번의 왕복이 발생한다.
  - 제안: QB를 `clone()` 후 `Promise.all`로 병렬 실행하거나, `getManyAndCount()`를 한 번 호출한다(단, TypeORM은 skip/take 있을 때 내부적으로 두 쿼리로 분리하므로 실제 개선은 제한적).

- **[INFO]** LEFT JOIN 두 개가 COUNT 쿼리에도 포함될 가능성
  - 위치: `executions.service.ts` L60~L66
  - 상세: TypeORM 버전에 따라 `getCount()` 시 `addSelect` 없이 leftJoin만 있는 관계가 COUNT 쿼리에서 제거되지 않을 수 있다. `trigger`·`executor` JOIN이 WHERE 조건에 영향을 주지 않는 한, DB가 자체 최적화(LEFT JOIN 제거)를 하더라도 플래너 비용이 추가된다.
  - 제안: `getCount()` 전용 QB를 별도로 만들거나, TypeORM의 `disableEscaping` 없이 plain SQL로 카운트 쿼리를 분리해 JOIN을 제외한다.

- **[INFO]** JSX 렌더 루프 내 IIFE 사용
  - 위치: `page.tsx` L300~L330 (`{(() => { ... })()}`)
  - 상세: 테이블 행마다 익명 함수를 생성·즉시 호출한다. 행이 수십 개 수준이면 무시해도 되지만, 표현식이 복잡해질수록 불필요한 클로저 할당이 누적된다.
  - 제안: `<TriggerCell source={...} label={...} />` 같은 소형 컴포넌트로 추출하면 메모이제이션(`React.memo`)도 적용 가능하다.

---

### 요약

핵심 패턴(배치 IN 쿼리로 N+1 방지, 선택적 컬럼 JOIN)은 성능 면에서 올바른 방향이다. 단, `loadParentWorkflowNames`에서 `Execution` + `Workflow`의 전체 컬럼을 로드하는 부분이 유일한 실질적 낭비 지점이다. 서브워크플로우 실행이 한 페이지에 많이 포함되거나 워크플로우 정의 JSON이 클 경우 불필요한 I/O가 발생하므로, QueryBuilder로 필요한 두 컬럼만 select하도록 수정하는 것이 권장된다. 나머지 항목은 일반적인 서비스 트래픽에서 실측 영향이 미미하다.

### 위험도

**LOW**