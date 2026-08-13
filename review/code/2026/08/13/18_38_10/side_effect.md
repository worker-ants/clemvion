# 부작용(Side Effect) Review

## 대상 요약

`git diff origin/main...HEAD` 기준 실질 코드 변경은 `assert-row-array.ts`(신규) + 이를 소비하는
`execution-engine.service.ts`(3곳) / `executions.service.ts`(1곳) 및 대응 spec 4건이다. 이 diff 는
이미 4차례(`14_01_46`→`17_15_21`→`18_00_11`→`18_19_33`) side_effect 리뷰를 거쳐 판정 로직(throw
조건·트랜잭션 스코프·`releaseExecutionRouting` 배선)이 고정된 코드의 마지막 두 커밋
(`64763c5cd`, `860a727b7`)까지 포함한다 — 이 두 커밋은 `assert-row-array.spec.ts` 내 JSDoc 주석
문구만 고친 것으로, `git show`로 직접 대조해 실행 코드 변화가 0줄임을 확인했다. 나머지
(`plan/in-progress/*.md`, `review/code/**`, `review/consistency/**`)는 문서·이전 리뷰 산출물이라
런타임 부작용 대상이 아니다.

## 발견사항

- **[INFO]** `admitExecutionOrDefer` 호출을 `try/catch` 로 감싸 예외 발생 시
  `releaseExecutionRouting` 을 호출하고 재전파 — 기존에 없던 새 부작용 경로
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3681-3684`
    (`runExecutionFromQueue` 내부)
  - 상세: 이전에는 `admitExecutionOrDefer` 가 throw 하면 그 직전(3663행 부근) 등록한
    routing context 가 해제되지 않고 남았다. 이번 변경은 catch 에서 무조건
    `releaseExecutionRouting(executionId)` 를 호출한 뒤 `throw err` 로 재전파한다.
    `admitExecutionOrDefer` 호출부가 이 함수 하나뿐임을 `grep -n "admitExecutionOrDefer"` 로
    확인했고, `admission === 'deferred'` 분기(3688행)도 이미 동일하게 무조건 release 하는
    기존 패턴과 대칭이라 새 결함은 아니다. 다만 `execution.triggerId` 가 없어 애초에
    routing 이 등록되지 않은 경로에서도 release 가 호출되는데(기존 `deferred` 분기와 동일
    패턴이므로 `releaseExecutionRouting` 이 idempotent no-op 이라는 전제가 유지된다는 가정
    하에 안전), 이 전제는 이번 diff 가 새로 만든 것이 아니라 기존 코드베이스 관례를
    그대로 따른 것이다.
  - 제안: 조치 불요 — 의도된 수정(ai-review `17_15_21` WARNING 2 대응)이고 호출부 단일성·
    기존 release 패턴과의 대칭성을 확인했다.

- **[INFO]** `computeChainDepth` 가 non-array 응답에 대해 "조용한 fail-open 값 반환"에서
  "throw" 로 인터페이스 동작이 바뀜 — `reRun()` 호출자에게 새로운 예외 표면 노출
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:325-329`
    (`computeChainDepth` 내부 `assertRowArray(rows, ...)`), 호출부는 `:395`(`reRun`)
  - 상세: 변경 전에는 `rows` 가 배열이 아니면 `rows[0]?.depth ?? 1` 로 조용히 depth 1 을
    반환해(`RR-PL-05` 체인 깊이 제한 우회) `reRun` 이 정상 성공했다. 이번 변경은 그 지점에서
    일반 `Error` 를 throw 한다. `reRun` 본문을 확인한 결과 `computeChainDepth` 호출
    이전에는 DB 쓰기가 전혀 없어(조회·권한체크·dry-run pre-flight만) throw 로 인한 부분
    상태 변경 위험은 없다. 다만 이 `Error` 는 `NotFoundException`/`ConflictException` 같은
    Nest `HttpException` 이 아니라 평범한 `Error` 이므로, 전역 예외 필터를 거쳐 API 응답이
    500 으로 떨어진다 — 이는 "재실행이 조용히 성립"에서 "재실행 API 가 500 을 반환"으로
    바뀌는 실질적 인터페이스(응답 코드) 변화다. 의도된 정확성 수정(RR-PL-05 우회 차단)이며
    도달 조건이 드라이버 계약 위반이라는 매우 희박한 경로이지만, 클라이언트가 이 500 을
    받을 수 있다는 점은 명시적으로 남겨 둔다.
  - 제안: 조치 불요(의도된 방향 전환, 신규 회귀 없음). 다만 이 예외가 API 소비자에게
    일반 500 대신 좀 더 진단 가능한 응답으로 노출돼야 한다면 별도 백로그로 검토 가치 있음.

- **[INFO]** 4개 호출부의 예외 메시지 문구가 헬퍼 추출로 재구성됨 — 문자열 매칭 기반 외부
  모니터링이 있다면 매칭이 끊길 수 있음 (이전 라운드 지적 재확인)
  - 위치: `codebase/backend/src/common/utils/assert-row-array.ts:20-24`(`assertRowArray`
    throw 지점), 소비부 `execution-engine.service.ts:2937`(`admitExecutionOrDefer`),
    `:8206`(`lockNonTerminalExecutionRow`), `:8523`(`updateExecutionStatus`),
    `executions.service.ts:325`(`computeChainDepth`)
  - 상세: throw 여부·타입(`Error`)·트랜잭션 롤백 방향은 리팩터 전후 동일함을 이전 라운드가
    `git show <parent>:...` 로 대조 확인했다. 이번 세션에서도 4개 호출부 모두
    `assertRowArray(value, detail)` 패턴으로 통일돼 있고 개별 `detail` 문자열만 다름을
    직접 확인했다 — 기능적 회귀 없음. 재확인 차원에서 INFO 유지.
  - 제안: 조치 불요.

- **[정보, 부작용 없음]** `SNAPSHOT_CACHE_MAX_ENTRIES` 가시성 확대(`const` → `export const`)
  — 공개 인터페이스가 소폭 넓어짐, 이전 라운드에서 이미 검토·수용
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:64`
  - 상세: 값(256) 불변. `grep -rn "SNAPSHOT_CACHE_MAX_ENTRIES" codebase/backend/src` 결과
    소비처는 정의부·`writeSnapshotCache` 내부·`executions.service.spec.ts` 뿐이라 이름
    충돌·의도치 않은 외부 소비 없음. 자매 상수 `MAX_EXECUTION_PATH_ROWS` 와 동일 패턴.
  - 제안: 조치 불요.

- **[정보, 부작용 없음]** `jest.spyOn(Logger.prototype, 'debug'/'warn')` 전역(prototype) 패치
  — 테스트 프로세스 내부에 한정, `try/finally` 로 복원 보장
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` 신규
    `describe('ChatChannelDispatcher.handle — toChatChannelEvent null 의 로그 레벨 분기', ...)`
    두 `it` 블록 (각각 `debugSpy`/`warnSpy` 생성 후 `try { ... } finally { mockRestore() }`)
  - 상세: `@nestjs/common` `Logger` 클래스 prototype 을 패치하지만 두 테스트 모두 assertion
    실패 시에도 복원되도록 `finally` 로 감쌌다. Jest 는 파일별 모듈 격리이므로 타 spec 파일로
    전파되지 않는다.
  - 제안: 조치 불요.

- **[정보, 부작용 없음]** 신규 구조적 회귀 테스트가 프로덕션 소스 파일을 `readFileSync` 로
  읽음 — 읽기 전용, 파일 생성·수정·삭제 없음
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts` (`describe('자매 지점
    전수 — 가드 누락 회귀 가드', ...)` 블록, `FILES`/`CONSUMING_QUERY` 정의부 및
    `it('반환값을 쓰는 .query() 호출 수 == assertRowArray 호출 수', ...)`)
  - 상세: `join(__dirname, '..', '..')` 로 `src/` 를 잡고 `execution-engine.service.ts`/
    `executions.service.ts` 두 파일을 텍스트로 읽어 정규식 카운트만 한다. 파일을 변경하지
    않으며 테스트 프로세스 밖으로 영향이 새지 않는다.
  - 제안: 조치 불요.

- **[해당 없음]** `plan/in-progress/*.md`, `review/code/**`, `review/consistency/**` 신규/수정
  커밋 — 순수 문서, 코드 실행 경로에 영향 없음.

## 요약

이번 diff 의 프로덕션 코드 변경은 4곳의 raw SQL 결과 shape 가드를 `assertRowArray()` 헬퍼로
통일하고, 그중 한 곳(`admitExecutionOrDefer` throw 시 routing release)의 예외 경로를 정정한
것으로, 이전 4차례 side_effect 리뷰가 이미 트랜잭션 스코프·throw 방향·단일 호출부를 검증해 둔
안전한 리팩터다. 이번 세션에서 직접 재확인한 결과 새로 추가된 부작용은 (1) `admitExecutionOrDefer`
예외 시 `releaseExecutionRouting` 무조건 호출(호출부 단일, 기존 패턴과 대칭 확인) 과
(2) `computeChainDepth` 가 non-array 응답에 조용히 성공하던 것을 throw 로 바꿔 `reRun` API 가
그 조건에서 500 을 반환하게 된 것(호출 전 DB 쓰기 없어 부분 상태 위험 없음, 의도된 정확성 수정)
뿐이다. 마지막 두 커밋(`64763c5cd`, `860a727b7`)은 테스트 파일의 JSDoc 문구만 수정해 실행 코드
변화가 없음을 `git show` 로 확인했다. 전역 변수 신설, 예상치 못한 파일시스템 쓰기, 환경 변수
읽기/쓰기, 의도치 않은 네트워크 호출은 발견되지 않았다.

## 위험도

NONE
