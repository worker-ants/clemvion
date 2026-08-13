# 데이터베이스(Database) 코드 리뷰

## 검증 방법

`git diff origin/main...HEAD --stat -- codebase/` 로 실제 코드 diff(8 파일, +561/-52) 를
직접 확인했다. 이번 프롬프트의 상당수(파일 9~94)는 `plan/**`·`review/code/**`·
`review/consistency/**` 하위의 이전 리뷰/일관성 검토 산출물(마크다운·JSON)이라 DB 관점
분석 대상이 아니다. 실질 코드 변경은 `assertRowArray` 런타임 가드 도입(신규 헬퍼 +
`execution-engine.service.ts`/`executions.service.ts` 적용) 과 그에 대응하는 스펙 파일
보강뿐이며, 이는 동일 changeset 을 대상으로 한 직전 라운드(`review/code/2026/08/13/18_38_10/database.md`)
가 이미 위험도 NONE 으로 리뷰했다. 이번 라운드에서 `codebase/**` 에 추가된 것은
(a) `assertRowArray` 를 파일별 인라인 가드에서 공용 헬퍼(`assert-row-array.ts`)로 추출,
(b) 그 헬퍼의 sibling-count 회귀 가드(`assert-row-array.spec.ts`), (c) admission 가 throw 할 때
routing context 를 release 하는 `try/catch` 배선(`runExecutionFromQueue`) 이다. 아래는 이
증분에 초점을 맞춘 재확인이다.

## 발견사항

- **[INFO]** 신규 `assertRowArray` 헬퍼로의 추출이 4개 raw SQL 소비 지점(engine 3 + executions 1)의 트랜잭션 경계·throw 시맨틱을 그대로 보존하는지 재확인
  - 위치: `codebase/backend/src/common/utils/assert-row-array.ts` (`assertRowArray`), 호출부 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(admission UPDATE, `lockNonTerminalExecutionRow` SELECT FOR UPDATE, `updateExecutionStatus` guarded UPDATE), `codebase/backend/src/modules/executions/executions.service.ts`(`computeChainDepth` 재귀 CTE)
  - 상세: 헬퍼는 `if (!Array.isArray(rows)) throw new Error(...)` 한 줄뿐이고 메시지는 호출부가 준다 — 인라인 가드를 그대로 함수로 옮긴 것이라 트랜잭션 배치(`manager.transaction()` 콜백 내부 2곳은 throw → 롤백, `updateExecutionStatus` 는 트랜잭션 밖 단일 statement라 throw 가 이미 커밋된 UPDATE 를 되돌리지 못함 — 코드 주석에 명시)와 파라미터 바인딩(`$1`, `$2`, ...)에 변화가 없다. 직전 라운드(`18_38_10`)의 분석이 그대로 유효함을 확인.
  - 제안: 조치 불요.
- **[INFO]** `runExecutionFromQueue` 의 admission `try/catch` 배선은 DB 상태와 in-memory routing map 의 정합성을 유지하는 방향
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`admitExecutionOrDefer` 호출부, `runExecutionFromQueue` 내부 — diff 상 `let admission: 'admitted' | 'cancelled' | 'deferred';` 블록)
  - 상세: `admitExecutionOrDefer` 가 (가드로 인해) throw 하면 트랜잭션이 롤백돼 execution row 는 DB 상에서 `pending` 그대로 남는다. 이 배선은 애플리케이션 레벨의 `registerExecutionRouting` in-memory map 엔트리를 release 한 뒤 재전파해, DB 상태(pending, 워커 미배정)와 애플리케이션 라우팅 상태가 어긋나지 않게 한다. 신규 쿼리·인덱스·트랜잭션 범위 변경은 없다.
  - 제안: 조치 불요.
- **[INFO]** `SNAPSHOT_CACHE_MAX_ENTRIES` export 전환 및 신규 LRU 경계값 테스트는 인스턴스 로컬 in-memory 캐시 대상 — DB 쿼리·인덱스·트랜잭션과 무관
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts`(`export const SNAPSHOT_CACHE_MAX_ENTRIES = 256;`), `executions.service.spec.ts`(신규 상한/방향 테스트)
  - 상세: 캐시는 `findById` 조회 결과를 execution UUID 로 키잉하는 프로세스 로컬 LRU 이고, 이번 diff 는 캐시 크기 상수의 가시성만 넓혔을 뿐 캐시 적재/무효화 로직·키 구조·DB 쿼리(`createQueryBuilder` 경로)는 변경하지 않는다. 신규 테스트는 순수 mock 기반이라 실제 DB 부하와 무관.
  - 제안: 조치 불요.

## 요약

이번 diff 의 DB 관련 실질 변경은 raw SQL(`EntityManager.query()`, 선언 타입 `Promise<any>`) 반환값이 실제 배열인지 런타임에 검증하는 `assertRowArray` 가드를 공용 헬퍼로 추출한 것과, 그 헬퍼가 이미 검증된 4개 소비 지점(admission 원자 UPDATE, `lockNonTerminalExecutionRow` SELECT FOR UPDATE, `updateExecutionStatus` guarded UPDATE, `computeChainDepth` 재귀 CTE)에 그대로 재배선된 것이다. 트랜잭션 경계(콜백 내부 throw=롤백 vs 콜백 밖 throw=진단 전용)와 파라미터 바인딩은 변경 없이 유지되며, 신규 SQL·스키마·마이그레이션·인덱스 요구사항은 없다. `runExecutionFromQueue` 의 admission throw 시 routing release 배선도 DB 트랜잭션 롤백과 애플리케이션 in-memory 상태 간 정합성을 지키는 방향이다. 나머지 변경(`SNAPSHOT_CACHE_MAX_ENTRIES` export, 다수 spec 파일 보강, `plan/**`·`review/**` 문서)은 DB 관점에서 관찰할 사항이 없다. 동일 changeset 을 이미 검토한 직전 라운드(`18_38_10`)의 NONE 판정을 재확인한다.

## 위험도

NONE
