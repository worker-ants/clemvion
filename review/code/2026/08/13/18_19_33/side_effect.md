# 부작용(Side Effect) Review

## 대상 요약

`git diff origin/main...HEAD --stat -- codebase/` 기준 실질 코드 변경은 8개 파일이다(신규
`assert-row-array.ts`/`.spec.ts` 2건 + 기존 서비스 2건(`execution-engine.service.ts`,
`executions.service.ts`) + spec 4건). 나머지(`plan/in-progress/*.md`, `review/code/**`,
`review/consistency/**`)는 문서·이전 리뷰 세션 산출물 커밋이라 런타임 부작용 대상이 아니다.

이 diff 는 **이미 세 차례(`14_01_46`→`17_15_21`→`18_00_11`) side_effect 리뷰를 거친 코드**의
후속 리팩터다 — 4곳에 중복돼 있던 `if (!Array.isArray(x)) throw new Error(...)` 를
`assertRowArray()` 헬퍼로 추출하고, "가드 호출 자체를 빠뜨리는 것"을 잡는 구조적 회귀
테스트(`assert-row-array.spec.ts` 의 `.query()` 호출 수 == `assertRowArray` 호출 수 assert)를
추가했다. 트랜잭션 롤백 불변식 정정과 admission throw 시 routing release 배선은 이전 라운드에서
이미 완료·검증됐고, 이번 diff 는 그 판정 로직을 **바꾸지 않는다** — `git show 30112b7d4^:...` 로
리팩터 전 원본을 대조해 4개 호출부 모두 `Array.isArray` 조건·throw 여부·트랜잭션 스코프가
그대로임을 확인했다.

## 발견사항

- **[INFO]** 가드 헬퍼 추출로 예외 메시지 포맷이 이번 라운드에서 다시 한 번 바뀐다
  - 위치: `codebase/backend/src/common/utils/assert-row-array.ts` (`assertRowArray` 함수 전체,
    게이트 16~25행) — 소비부는 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    게이트 2937~2941(`admitExecutionOrDefer`), 8206~8210(`lockNonTerminalExecutionRow`),
    8523~8528(`updateExecutionStatus`), `codebase/backend/src/modules/executions/executions.service.ts`
    게이트 325~329(`computeChainDepth`)
  - 상세: 리팩터 전(부모 커밋 `30112b7d4^`) admission 가드는
    `` `admission: UPDATE ... RETURNING 이 배열이 아님 (typeof=${typeof rows}) — execution ${executionId}. 트랜잭션을 롤백한다(부분 적용 방지).` `` 를 던졌다. 이번 diff 는 헬퍼로 이동하며
    `` `raw SQL 결과가 배열이 아님 (typeof=${typeof rows}) — ${detail}` `` 형태로 재구성됐다
    (`detail` 은 호출부가 `admission UPDATE ... RETURNING, execution ${executionId}. ...` 로
    전달). 4개 지점 모두 접두 문구가 "admission:"/"lockNonTerminalExecutionRow SELECT..."
    등 개별 문자열에서 공통 "raw SQL 결과가 배열이 아님" 접두로 통일됐다. throw 여부·타입
    (`Error`)·트랜잭션 롤백 여부는 동일해 기능적 회귀는 없다. 다만 `17_15_21`/`18_00_11`
    라운드가 이미 "암묵적 `TypeError` → 명시적 `Error`" 전환을 INFO 로 기록해 뒀는데, 이번
    라운드는 그 명시적 `Error` 의 **문구 자체**를 한 번 더 바꾼다 — 문자열 매칭 기반 외부
    모니터링/알림 규칙이 있다면 매칭이 다시 끊길 수 있다(가능성만 존재, 이 저장소에는 그런
    규칙의 존재 여부를 확인할 자료 없음).
  - 제안: 조치 불요(의도된 리팩터, 판정 로직 불변). 운영 알림 규칙이 별도로 존재한다면 문구
    갱신을 함께 검토 — 이전 라운드와 동일한 유보.

- **[정보, 부작용 없음 — 재확인]** `assertRowArray` 를 통한 throw 가 4개 호출부 각각의
  트랜잭션/논트랜잭션 스코프에서 여전히 올바른 방향으로 작동함을 재확인
  - 위치: `execution-engine.service.ts:2937`(`manager.transaction` 콜백 내부 → throw 시 롤백),
    `:8206`(`dataSource.transaction`/전달받은 manager 콜백 내부 → 동일), `:8523`
    (`this.executionRepository.query` 직접 호출, 애플리케이션 트랜잭션 밖 → throw 가 UPDATE 자체를
    되돌리지 못함, 코드 주석 8517~8522행이 이를 명시), `executions.service.ts:325`
    (`computeChainDepth`, 단순 조회라 롤백 대상 자체가 없음 — RR-PL-05 우회 방지가 목적).
  - 상세: 리팩터가 호출 순서·인자·throw 위치를 바꾸지 않았으므로 `18_00_11` side_effect 리뷰가
    확인한 비대칭(3곳은 롤백 보장, 1곳은 진단 개선만)이 그대로 유지된다. 새 부작용 없음.

- **[정보, 부작용 없음]** 신규 구조적 회귀 테스트가 프로덕션 소스 파일을 `readFileSync` 로 직접
  읽는다 — 파일시스템 부작용 관점에서 읽기 전용, 쓰기·생성·삭제 없음
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts` 게이트 44~64행
    (`describe('자매 지점 전수 — 가드 누락 회귀 가드', ...)`)
  - 상세: `join(__dirname, '..', '..')` 로 `src/` 를 잡고 `execution-engine.service.ts`/
    `executions.service.ts` 두 파일을 읽어 정규식으로 `.query()`/`assertRowArray()` 호출 수를
    센다. 파일을 변경하지 않으며 테스트 프로세스 밖으로 영향이 새지 않는다. 다만 대상 파일이
    이동/개명되면 assertion 실패 대신 `ENOENT` 로 터진다는 점은 테스트 설계상 트레이드오프이지
    부작용은 아니다.

- **[INFO]** `SNAPSHOT_CACHE_MAX_ENTRIES` 가시성 확대(`const` → `export const`) — 이번 diff 에도
  그대로 존재, 공개 인터페이스가 소폭 넓어짐 (이전 두 라운드 지적의 재확인)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:64`
  - 상세: 값(256)·의미 변경 없음. `grep -rn "SNAPSHOT_CACHE_MAX_ENTRIES" codebase/backend/src`
    결과 소비처는 정의부·`writeSnapshotCache` 내부·`executions.service.spec.ts` 뿐이라 이름
    충돌·의도치 않은 외부 소비 없음. 자매 상수 `MAX_EXECUTION_PATH_ROWS` 가 이미 동일 목적으로
    export 돼 있어 패턴도 일관적이다.
  - 제안: 조치 불요.

- **[해당 없음]** `plan/in-progress/*.md`, `review/code/**`, `review/consistency/**` 신규/수정
  커밋 — 순수 문서, 코드 실행 경로에 영향 없음. 전역 변수·파일시스템 쓰기 부작용·시그니처/
  인터페이스 변경·환경 변수·네트워크 호출·이벤트/콜백 어느 관점에도 해당하지 않는다.

## 요약

이번 diff 는 이전 세 라운드(`14_01_46`/`17_15_21`/`18_00_11`)가 이미 검증을 마친 admission/
lock/update/rerun 4곳의 `Array.isArray` 가드를 `assertRowArray()` 공용 헬퍼로 추출하고, 호출
누락 자체를 잡는 구조적 회귀 테스트를 추가하는 리팩터다. 부모 커밋과 대조한 결과 throw 조건·
트랜잭션 스코프·`admitExecutionOrDefer` 실패 시 `releaseExecutionRouting` 배선 등 판정 로직은
전혀 바뀌지 않았다. 유일하게 새로 관측되는 것은 예외 메시지 문구가 헬퍼 도입으로 한 번 더
재구성된 점(기능 영향 없음, 문자열 매칭 알림 규칙이 있다면 갱신 검토 권고)과 `readFileSync`
기반 회귀 테스트가 파일시스템을 읽기 전용으로 건드리는 점뿐이다. `SNAPSHOT_CACHE_MAX_ENTRIES`
export 도 이전 라운드에서 이미 인터페이스 변경으로 지적·수용된 사항의 재확인이다. 신규
CRITICAL/WARNING 급 부작용은 발견하지 못했다.

## 위험도

NONE
