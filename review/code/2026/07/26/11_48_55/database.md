# Database Review — node-cancellation §5.1 (선형 경로 외부 cancel 전파)

## 발견사항

- **[WARNING]** `assertExecutionNotCancelled` 가 노드 경계마다 `Execution` 엔티티 전체를 SELECT — 코드 주석의 "status 단일 컬럼" 주장과 실제 동작 불일치, 컬럼 투영 필요
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7799` (신규 메서드 선언), 호출부 3곳 `:1638`(`runNodeDispatchLoop`), `:3729`(`executeInline`), `:4261`(`runExecution`)
  - 상세:
    - 신규 메서드는 `this.executionRepository.findOneBy({ id: executionId })` 로 조회한다. TypeORM `Repository#findOneBy` 는 `select` 옵션을 지정하지 않으면 매핑된 **모든 컬럼**을 `SELECT` 한다(`node_modules/typeorm/repository/Repository.js` 확인 — `select: false` 마킹된 컬럼도 없음). 즉 `status` 하나만 필요함에도 `Execution` 엔티티의 나머지 컬럼 전부를 함께 읽는다.
    - `Execution` 엔티티(`codebase/backend/src/modules/executions/entities/execution.entity.ts`)는 `input_data`/`output_data`/`error`/`conversation_thread`/`user_variables`/`resume_call_stack` 6개의 `jsonb` 컬럼을 갖는다. 특히 `conversation_thread`(AI 멀티턴 대화 스냅샷)·`user_variables`·`resume_call_stack` 은 §7.5 durable resume 스냅샷 목적상 park→resume 을 거친 실행에서 큰 값을 가질 수 있다 — 즉 이 신규 폴링이 가장 자주 반복되는 시나리오(여러 노드를 가진 실행이 resume 후 dispatch loop 를 도는 경우)가 공교롭게도 JSONB 페이로드가 가장 클 수 있는 시나리오와 겹친다.
    - 메서드 JSDoc(gate 7787-7788, "노드 경계마다 PK 인덱스 SELECT 1건(status 단일 컬럼)")은 **실제 구현과 다르다** — 컬럼 투영을 하지 않으므로 "단일 컬럼"이 아니다. 이 주석은 향후 유지보수자에게 실제보다 낮은 비용으로 오인시킬 수 있다.
    - PK(`uuid`) 조회이므로 인덱스 자체는 정상이며 개별 쿼리는 저지연이다. 다만 이 체크는 `runNodeDispatchLoop`/`executeInline`/`runExecution` 세 dispatch 루프 각각에서 **노드 경계마다** 실행되므로(단발성이 아니라 워크플로우 노드 수 × 실행 건수만큼 반복), 특히 cyclic 워크플로(back-edge, `MAX_NODE_ITERATIONS` 기본 100)에서는 동일 실행에 대해 같은 row 를 최대 수십~백 회 반복 조회할 수 있다. 순수 in-memory 체크인 인접 가드 `assertActiveTimeWithinLimit(savedExecution)` (gate 1636/4259, `savedExecution` 스냅샷만 사용, DB 호출 없음)과 대비된다.
  - 제안: `select` 로 컬럼을 투영해 `status` 만 읽도록 바꾼다(TypeORM 0.3.x `FindOptionsSelect` 사용 가능한 버전 확인됨 — `package.json` `typeorm: ^0.3.28`):
    ```ts
    const row = await this.executionRepository.findOne({
      where: { id: executionId },
      select: { status: true },
    });
    ```
    또는 `createQueryBuilder('e').select('e.status').where('e.id = :id', { id: executionId }).getRawOne()`. 이렇게 하면 JSDoc 의 "status 단일 컬럼" 서술과 구현이 일치하고, resume 이후 큰 JSONB 스냅샷을 매 노드 경계마다 왕복시키는 낭비를 없앤다.

- **[INFO]** `executeContainerBody`(ForEach/Loop/Parallel 컨테이너 본문 순회)는 `assertExecutionNotCancelled`/`assertActiveTimeWithinLimit` 어느 쪽도 호출하지 않는다 — 즉 신규 폴링은 대량 아이템을 도는 컨테이너 본문 반복에는 곱해지지 않는다(비용 관점에선 안전한 방향). 단, 이는 대용량 foreach/loop 실행 중 외부 cancel 이 여전히 관측되지 않을 수 있다는 별도의 **기능적** 커버리지 갭을 시사한다 — DB 성능 관점 밖이라 정보성으로만 남긴다(구현/동시성 리뷰어 영역).
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `executeContainerBody` (gate 6429 부근)

- **[INFO]** 신규 코드는 트랜잭션·SQL 파라미터화 관점에서 문제없음. `findOneBy`/`findOne` 은 ORM 파라미터 바인딩을 사용하고, e2e 스펙(`node-cancellation-propagation.e2e-spec.ts`)의 raw `pg.Client` 쿼리(`nodeStatus` 헬퍼, gate 231-232)도 `$1`/`$2` 파라미터 플레이스홀더를 사용해 SQL 인젝션 위험이 없다. 마이그레이션 파일·스키마 변경은 이번 diff 에 없음(무중단 배포 영향 없음).

## 요약

이번 변경(§2.3/§5.1 외부 cancel 이 dispatch loop 부수효과를 멈추게 하는 가드)은 스키마 변경·트랜잭션·SQL 인젝션 관점에서는 안전하다. 다만 신규로 추가된 `assertExecutionNotCancelled` 가 세 개의 노드 dispatch 루프(top-level `runExecution`, sub-workflow `executeInline`, 공용 `runNodeDispatchLoop`)에서 노드 경계마다 `executionRepository.findOneBy({id})` 로 `Execution` row **전체**(6개의 jsonb 컬럼 포함)를 반복 조회한다. PK 인덱스 조회라 개별 쿼리 자체의 지연은 낮지만, 필요한 것은 `status` 한 컬럼뿐이므로 이는 회피 가능한 낭비이며, 특히 §7.5 durable resume 이후(대화 스냅샷·resume 콜스택이 이미 채워진 실행)의 다중 노드 dispatch 구간에서는 반복마다 큰 JSONB 페이로드를 왕복시킬 수 있다. 코드 자체의 JSDoc 이 "status 단일 컬럼 SELECT"라고 서술하고 있어 실제 구현과의 괴리도 있다. 컬럼 투영(`select: { status: true }`)으로 간단히 해소 가능하며, correctness 를 해치지 않는 low-risk 수정이므로 머지 전 반영을 권장한다.

## 위험도

MEDIUM
