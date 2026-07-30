# 동시성(Concurrency) 코드 리뷰 — workflow duplicate (nodes/edges 캔버스 복제)

대상: `codebase/backend/src/modules/workflows/workflows.service.ts` `duplicate()` (신규 구현) +
`workflows.controller.ts`(Swagger 설명 변경) + `workflows.service.spec.ts`/`workflow-crud.e2e-spec.ts`(테스트).
그 외 파일(`plan/**`, `review/consistency/**`, `spec/**`)은 코드가 아니므로 동시성 관점 대상에서 제외.

## 발견사항

- **[WARNING]** `duplicate()` 의 원본 노드/엣지 읽기가 두 개의 독립된 SELECT 로 쪼개져 있고 트랜잭션
  isolation level 이 기본값(Postgres `READ COMMITTED`)이라, 동시에 커밋되는 `saveCanvas()` 와 겹치면
  사본이 "원본이 한 번도 존재한 적 없는 상태"를 복사할 수 있다 (read skew).
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:236`(트랜잭션 오픈, isolation
    미지정) 및 `:254-259`(`originalNodes`/`originalEdges` 를 별도 `manager.find` 두 번으로 읽음)
  - 상세: `this.dataSource.transaction(async (manager) => {...})` 는 isolation level 을 지정하지 않아
    Postgres 기본값인 `READ COMMITTED` 로 실행된다. `READ COMMITTED` 에서는 트랜잭션 내 **각 SELECT
    문마다** 그 시점의 최신 커밋 스냅샷을 새로 본다 — 트랜잭션 시작 시점의 단일 스냅샷을 보장하지
    않는다. 따라서 `originalNodes` 를 읽은 직후 ~ `originalEdges` 를 읽기 전 사이에 같은 워크플로우에
    대한 `saveCanvas()`(사용자 편집 저장, 오토세이브 포함 — 팀 워크스페이스라면 Owner/Admin/Editor
    누구나 동시 편집 가능)가 커밋되면:
    - 새 노드가 추가된 경우: `originalEdges` 에는 그 노드를 참조하는 새 엣지가 잡히지만
      `idMap`(`:265-267`, `originalNodes` 로부터만 구성됨)에는 해당 노드 ID 가 없어
      `idMap.get(...)` 이 `undefined` 를 반환하고, `:292-294` 의 `if (!sourceNodeId ||
      !targetNodeId) return [];` 방어 코드가 그 엣지를 **조용히 누락**시킨다(크래시·FK 위반은
      없지만 사본의 그래프가 원본의 어느 한 시점과도 일치하지 않게 됨).
    - 노드가 삭제된 경우(예: Manual Trigger 노드 자체가 그 시점에 지워짐): `originalNodes` 스냅샷에는
      옛 상태(옛 트리거 포함/제외)가 남아, `duplicate()` 는 `saveCanvas` 의 "Manual Trigger 정확히
      1개" 게이트(`validateManualTrigger`)를 전혀 거치지 않으므로(§Rationale 상 의도적) 트리거 0개
      /2개짜리 사본이 만들어질 잠재 가능성도 배제되지 않는다.
    - 이 클래스의 버그는 이 저장소에 **이미 실제로 발견·수정된 선례**가 있다 —
      `codebase/backend/src/modules/executions/executions.service.ts:523-539` 의 `findById` 는
      정확히 같은 구조(연관된 두 테이블을 별도 SELECT 로 읽는 조회)에서 동일한 read-skew 로
      "Carousel 버튼이 콜백 없이 disabled 로 stuck" 프로덕션 버그를 냈고, 수정은
      `this.executionRepository.manager.transaction('REPEATABLE READ', async (manager) => {...})`
      로 두 SELECT 를 하나의 일관된 스냅샷 안에 묶는 것이었다(주석: "단순 read 라 deadlock 위험
      없음"). `duplicate()` 의 주석(`:252-253` "노드/엣지는 사본을 쓰는 것과 같은 트랜잭션에서
      읽는다 — 실패 시 부분 사본이 남지 않는다")은 **쓰기 원자성**(rollback 안전성)만 서술할 뿐,
      두 SELECT 사이의 **읽기 일관성**은 다루지 않는다 — `executions.service.ts` 가 이미 구분해
      명시한 바로 그 gap 이 여기서 재현된 형태다.
  - 제안: `this.dataSource.transaction('REPEATABLE READ', async (manager) => {...})` 로 isolation
    level 을 명시해, `manager.find(Node, ...)`/`manager.find(Edge, ...)` 가 트랜잭션 첫 쿼리 시점의
    단일 스냅샷을 공유하게 한다(`executions.service.ts:538-539` 와 동일 패턴 재사용). Postgres
    MVCC 특성상 reader 가 writer 를 막지 않으므로 `saveCanvas` 를 블로킹하지 않고, 락 기반 해법보다
    저비용이다.

- **[INFO]** 원본 워크플로우 메타데이터(`name`/`description`/`tags`/`folderId`/`settings`) 읽기가
  트랜잭션 시작 **전**에 이루어져, 트랜잭션 내부에서 읽는 노드/엣지 스냅샷과 시점이 어긋날 수 있음.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:234`(`findById`, 트랜잭션 밖)
    vs `:236`(트랜잭션 오픈)
  - 상세: 주석(`:233` "권한·존재 확인은 트랜잭션 밖에서 (없으면 트랜잭션 자체를 열지 않는다)")이
    명시하듯 의도된 트레이드오프이며, 존재하지 않는 워크플로우에 불필요하게 트랜잭션을 여는 비용을
    피하려는 것이다. 다만 그 대가로, `findById` 읽기와 트랜잭션의 노드/엣지 읽기 사이에 동시
    `update()`(PATCH, 이름/태그/폴더/설정 변경)가 끼어들면 사본이 "이름/태그는 옛 값, 캔버스는 그
    이후 값" 처럼 시점이 섞인 메타-그래프 조합이 될 수 있다. 위 WARNING 항목과 근본 원인이 같다
    (duplicate() 의 읽기 구간 전체가 하나의 일관된 스냅샷으로 보호되지 않음). 메타데이터 필드는
    참조 무결성에 관여하지 않아(FK 위반·크래시 없음) 실질 피해가 노드/엣지 스킵보다 작다고 판단해
    별도 등급을 WARNING 이 아닌 INFO 로 뒀다.
  - 제안: 필수는 아니나, 위 WARNING 을 `REPEATABLE READ` 로 고칠 때 `findById` 도 같은 트랜잭션
    안에서(첫 쿼리로) 다시 읽도록 이동하면 이 gap 도 함께 닫힌다. 404 fast-path 이점을 유지하려면
    현행대로 두고 이 트레이드오프를 코드 주석에 명시하는 것으로도 충분하다.

- **[INFO]** 동시 편집 중 복제(레이스) 시나리오에 대한 회귀 테스트 부재
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts` `describe('duplicate', ...)`
    (신규 11개 테스트, 라인 381 이후) / `codebase/backend/test/workflow-crud.e2e-spec.ts` `it('C. ...')`
  - 상세: 이번에 추가된 unit/e2e 테스트는 전부 "복제 도중 원본이 정적"이라는 전제로 작성되어 있다
    (unit 은 mock 이 순차 호출을 가정, e2e 도 저장 → 복제를 순차 실행). 위 WARNING 이 실제로 발생하는
    "노드 읽기와 엣지 읽기 사이에 동시 saveCanvas 커밋" 케이스를 재현하는 테스트는 없다 — mock 기반
    unit 으로는 이 클래스의 버그를 구조적으로 포착하기 어렵다(memory: 동시성·상태전이엔 e2e 필요).
  - 제안: WARNING 항목을 고칠 때, e2e 레벨에서 "노드 조회 트랜잭션 진행 중 별도 요청으로
    saveCanvas 커밋"을 흉내 낼 수 있는 회귀 테스트(예: DB 트리거/딜레이 훅, 또는 최소한 수정 전
    코드로 되돌렸을 때 실패하는 통합 테스트)를 고려할 것. 필수는 아님 — 코드 수정 자체가 우선.

## 요약

이번 diff 의 핵심 코드 변경은 `WorkflowsService.duplicate()` 를 "메타 row 만 INSERT" 에서
"노드/엣지를 포함한 캔버스 전체를 UUID 재매핑하며 복제"로 재구현한 것이다. 쓰기 측 원자성(전부
성공 또는 전부 롤백)은 단일 `dataSource.transaction()` 으로 올바르게 보장되고, 두 개의 배치
`manager.insert()` 는 빈 배열 가드까지 갖춰 정상이다. 다만 **읽기 측**은 원자적 스냅샷이 아니다 —
`manager.find(Node, ...)` 와 `manager.find(Edge, ...)` 가 기본 `READ COMMITTED` 트랜잭션 안에서 별도
SELECT 로 실행되어, 그 사이에 동시 `saveCanvas()` 커밋이 끼면 그래프 일관성이 깨진 사본(엣지 누락,
드물게는 Manual Trigger 불변식 위반)이 조용히 만들어질 수 있다. 이 정확한 문제 형태(연관 테이블
2개를 별도 SELECT 로 읽는 조회의 read skew)는 이 저장소의 `executions.service.ts` 에 이미 발견·수정
이력이 있고 그 해법(`REPEATABLE READ` 트랜잭션)이 `duplicate()` 에도 동일하게 적용 가능하다 — 락이
필요 없어 동시 편집자를 블로킹하지 않는 저비용 수정이다. 원본 소유의 데이터를 손상시키거나
크래시/데드락을 유발하지는 않고 영향 범위가 새로 생성되는 사본 한 건으로 국한되므로 CRITICAL 이
아닌 WARNING 으로 판단했다. 그 외 파일(controller 의 Swagger 설명 텍스트, plan/consistency 산출물,
spec 문서)은 동시성 관점에서 해당 사항 없음.

## 위험도

MEDIUM
