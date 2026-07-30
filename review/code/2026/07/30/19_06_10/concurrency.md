# 동시성(Concurrency) 코드 리뷰 — workflow duplicate (nodes/edges 캔버스 복제) 재검토

대상: `codebase/backend/src/modules/workflows/workflows.service.ts` `duplicate()`(이전 라운드
`review/code/2026/07/30/17_54_27` WARNING #1 조치 커밋 `a7ab2750a` 포함) + `workflows.controller.ts`
(Swagger 설명 텍스트만, 동시성 무관) + `workflows.service.spec.ts`/`workflow-crud.e2e-spec.ts`(테스트).
그 외 파일(`CHANGELOG.md`, `plan/**`, `ui-tour*.mdx`, `review/**` 산출물)은 실행 코드가 아니므로
동시성 관점 대상에서 제외.

## 이전 라운드 대비 변경 확인

이전 세션(`17_54_27/concurrency.md`)이 WARNING 으로 지적한 read skew — `duplicate()` 의 원본
node/edge 조회가 기본 `READ COMMITTED` 트랜잭션에서 두 개의 독립 SELECT 로 실행되어, 그 사이
동시 `saveCanvas()` 커밋이 끼어들면 그래프 일관성이 깨진 사본이 조용히 생성될 수 있던 문제 —
는 커밋 `a7ab2750a` 로 수정되었다. `workflows.service.ts:245` 의
`this.dataSource.transaction('REPEATABLE READ', async (manager) => {...})` 로 isolation level 을
명시해, `manager.find(Node, ...)`(`:263`)와 `manager.find(Edge, ...)`(`:266`)가 트랜잭션 첫 statement
시점의 단일 스냅샷을 공유하도록 고쳤다. `executions.service.ts:538-539` 의 기존 선례
(`findById` 의 `manager.transaction('REPEATABLE READ', ...)`)와 정확히 같은 형태로 재사용했고,
테스트 mock(`workflows.service.spec.ts:94`)도 그 선례의 어댑터 패턴(`args.find(a => typeof a ===
'function')`)을 동일하게 재사용해 isolation-level 인자 유무와 무관하게 콜백을 찾아 실행하도록
조정했다 — `executions.service.spec.ts:111-114` 의 `transactionImpl` 과 실제로 동일한 구현임을
직접 대조 확인했다.

재시도(40001) 로직 부재에 대한 판단도 재검증했다: `duplicate()` 는 원본 `node`/`edge` row 를
UPDATE/DELETE 하지 않고 새 UUID 의 사본 row 만 INSERT 하므로(`:289-329`), Postgres 가
`REPEATABLE READ` 에서 serialization failure(40001)를 내는 조건(같은 행에 대한 동시 write-write
충돌)이 발생할 여지가 없다 — 선례(`executions.service.ts`, 순수 read 트랜잭션)와 동일하게
재시도 로직 없이 isolation 만 명시한 것은 타당하다. 또한 `saveCanvas()`(`:531`, 기본
`READ COMMITTED` + `createVersion` 내부 pessimistic lock, `:562-563` 주석)와 `duplicate()`(신규
`REPEATABLE READ`) 두 트랜잭션이 서로 동일 리소스에 대해 `FOR UPDATE` 류의 명시적 락을 걸지
않고, `duplicate()` 는 원본 `workflow` row 자체를 다시 잠그거나 갱신하지 않으므로 두 트랜잭션
사이의 신규 데드락 경로도 발견되지 않았다.

## 발견사항

- **[INFO]** 원본 메타데이터(`name`/`description`/`tags`/`folderId`/`settings`) 읽기가 여전히
  `REPEATABLE READ` 트랜잭션 시작 **전**에 이루어져, 트랜잭션 내부에서 읽는 node/edge 스냅샷과
  시점이 어긋날 수 있음 (기존 지적, 미해결 — 의도적 보류)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:234`(`const original =
    await this.findById(id, workspaceId);`, 트랜잭션 밖) vs `:245`(`this.dataSource.transaction(
    'REPEATABLE READ', ...)` 오픈)
  - 상세: 이번 fix(`a7ab2750a`)는 node/edge 두 SELECT 사이의 read skew 만 닫았다. `findById` 는
    여전히 트랜잭션 밖에서 실행되므로, 그 호출과 트랜잭션 오픈 사이에 동시 `update()`(PATCH,
    이름/태그/폴더/설정 변경)가 커밋되면 사본이 "이름·태그는 옛 값, 캔버스는 그 이후 값" 처럼
    시점이 섞인 메타-그래프 조합이 될 수 있다. `RESOLUTION.md`(`review/code/2026/07/30/17_54_27/
    RESOLUTION.md:95-97`)가 "요청받은 조치 범위는 node/edge 조회 2건에 한정, 404 fast-path
    이점과의 트레이드오프이므로 별도 판단 필요 시 후속 검토 권장" 이라고 명시적으로 보류한
    항목과 동일하며, 이번 라운드에도 코드가 바뀌지 않아 그대로 유효하다. 참조 무결성(FK)에
    관여하지 않는 필드들이라 크래시·데이터 손상은 없다.
  - 제안: 필수는 아님. 완전히 닫으려면 `findById` 도 같은 트랜잭션 안(첫 쿼리)에서 다시 읽도록
    이동하면 되나, 그러면 404 fast-path(트랜잭션을 아예 안 여는) 이점을 잃는다 — 트레이드오프
    문서화 정도로 충분.

- **[INFO]** `REPEATABLE READ` 수정 자체를 지키는 회귀 테스트가 없어, 향후 실수로 isolation
  level 이 제거/변경돼도 유닛 테스트가 이를 잡지 못함
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts:94`
    (`mockDataSource.transaction` 어댑터), `codebase/backend/test/workflow-crud.e2e-spec.ts:226`
    (`it('C. duplicate → …, 캔버스 전체 복사', …)`)
  - 상세: `mockDataSource.transaction` 은 `args.find(a => typeof a === 'function')` 로 콜백만
    찾아 실행하고 인자 값 자체(`'REPEATABLE READ'`)는 검사하지 않는다 — `duplicate` describe
    (`:387` 이하) 어떤 테스트도 `expect(mockDataSource.transaction).toHaveBeenCalledWith(
    'REPEATABLE READ', expect.any(Function))` 류의 단언을 하지 않는다(현재는 `toHaveBeenCalled()`
    만 확인하는 다른 describe 의 테스트뿐). TypeORM 의 `transaction<T>(isolationLevel:
    IsolationLevel, ...)` 오버로드가 리터럴 타입을 강제해 오탈자는 컴파일 타임에 잡히지만,
    "isolation level 인자를 통째로 제거하고 1-arg 형태로 되돌리는" 회귀는 타입 체크도 unit
    mock 도 잡지 못한다. e2e 케이스 C(`:226-325`)도 "저장 → 복제" 순차 실행만 검증하고, 실제
    "node 조회와 edge 조회 사이에 동시 saveCanvas 커밋" 레이스를 재현하지 않는다 — 이는 이전
    라운드 `concurrency.md` 의 INFO 항목("동시 편집 중 복제 시나리오 회귀 테스트 부재")과 같은
    근본 원인이며 `RESOLUTION.md` 가 "요청 범위 밖" 으로 명시해 둔 항목이다.
  - 제안: 최소 비용 보강으로 `expect(mockDataSource.transaction).toHaveBeenCalledWith(
    'REPEATABLE READ', expect.any(Function))` 단언을 `duplicate` describe 에 추가하면, 향후 이
    literal 인자가 실수로 제거되는 회귀를 유닛 테스트 레벨에서 저비용으로 잡을 수 있다. 실제
    동시성 시나리오(두 SELECT 사이 동시 커밋)를 재현하는 통합/e2e 테스트는 비용이 더 크므로
    선택 사항으로 남겨도 무방.

- **[INFO]** `originalNodes`/`originalEdges` 두 독립 조회가 순차 `await` — 같은 저장소가 인용하는
  선례의 `Promise.all` 병렬화 패턴과 다름 (정확성 문제 아님, 참고용)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:263`(`const originalNodes =
    await manager.find(Node, ...)`), `:266`(`const originalEdges = await manager.find(Edge, ...)`)
  - 상세: 두 조회는 서로 독립적이고 `REPEATABLE READ` 트랜잭션 안에서는 실행 순서와 무관하게
    이미 고정된 동일 스냅샷을 본다 — 순차 실행이 정확성에 영향을 주지 않는다. 다만 이번 fix가
    직접 선례로 인용하는 `executions.service.ts:561`(`const [nodeExecutions, pathRows] = await
    Promise.all([...])`, 주석: "서로 독립적이므로 RTT 단축을 위해 병렬로 실행")은 정확히 이런
    형태의 독립된 두 조회를 `Promise.all` 로 묶는 컨벤션을 채택하고 있다. `duplicate()` 는 같은
    선례를 isolation level 명시에는 재사용했지만 이 병렬화 관례는 따르지 않았다.
  - 제안: 필수 아님(round-trip 1회 차이 수준의 미미한 이득). 일관성을 원하면
    `const [originalNodes, originalEdges] = await Promise.all([manager.find(Node, {...}),
    manager.find(Edge, {...})])` 로 통일 가능.

## 요약

이전 라운드에서 WARNING 으로 지적된 핵심 동시성 결함 — `duplicate()` 의 원본 node/edge 조회가
기본 `READ COMMITTED` 하 두 개의 독립 SELECT 로 쪼개져 동시 `saveCanvas()` 커밋과 겹치면 read
skew 로 그래프가 깨진 사본이 조용히 생성될 수 있던 문제 — 는 `a7ab2750a` 커밋의 `REPEATABLE
READ` isolation 명시로 올바르게 수정되었다. 이 저장소의 기존 선례(`executions.service.ts`
`findById`)와 정확히 동일한 패턴(트랜잭션 시그니처·재시도 불필요 판단·테스트 mock 어댑터)을
재사용했고, 원본 row 를 다시 write 하지 않는 이 트랜잭션의 성질상 write-write 충돌(40001)
재시도 로직이 불필요하다는 판단도 재검증 결과 타당했다. `saveCanvas()` 의 pessimistic lock과
사이의 신규 데드락 경로도 발견되지 않았다. 남은 세 관찰은 모두 INFO 등급이다 — (1) 메타데이터
읽기가 여전히 트랜잭션 밖에서 이루어져 시점이 어긋날 수 있는 트레이드오프(기존 지적, 의도적
보류), (2) `REPEATABLE READ` 인자 자체를 지키는 저비용 유닛 단언이 없어 향후 silent regression
가능성, (3) 두 독립 조회가 선례의 `Promise.all` 병렬화 관례를 따르지 않은 스타일 차이. 셋 다
병합을 막을 사유가 아니며 크래시·데이터 손상·데드락으로 이어지지 않는다.

## 위험도

LOW
