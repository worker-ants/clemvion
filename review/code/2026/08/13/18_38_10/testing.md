# 테스트(Testing) 리뷰

## 검증 방법

`git log --oneline origin/main..HEAD`(10 커밋) + `git diff origin/main...HEAD --stat -- codebase`로
실제 코드 diff 범위(8파일, +543/-42)를 먼저 확정했다. 프롬프트에 diff 가 생략된 3개 파일
(`chat-channel.dispatcher.spec.ts`, `execution-engine.service.spec.ts`,
`execution-engine.service.ts`)은 `git diff`로 직접 열어 대조했다. 아래는 프롬프트에 포함된
과거 4개 라운드(`14_01_46`→`17_15_21`→`18_00_11`→`18_19_33`)의 testing 리뷰·RESOLUTION 을
그대로 신뢰하지 않고, 핵심 주장 몇 가지를 직접 재현·검증했다:

- `assert-row-array.spec.ts`의 "자매 지점 전수" 가드가 고정한 수치(`execution-engine.service.ts`
  queries=3/guards=3, `executions.service.ts` queries=1/guards=1)를 테스트와 동일한 정규식으로
  독립 재현 → **정확히 일치**.
- `executions.service.ts`의 `snapshotCache`(145~203행) Map 기반 LRU 구현(`readSnapshotCache`의
  delete+set 재삽입, `writeSnapshotCache`의 `status !== COMPLETED/FAILED/CANCELLED` 캐시 제외
  조건, size 초과 시 `keys().next().value` evict)을 직접 읽고 `executions.service.spec.ts`
  신규 LRU 테스트의 기대값(afterFill/afterFill+1/afterFill+2)을 손으로 재검산 → 일치.
- `chat-channel.dispatcher.ts:192`의 `isSubFilterNull = event.eventType ===
  'execution.node.completed'` 분기를 직접 확인 → 신규 테스트 2건의 eventType 매핑과 일치.
- `execution-engine.service.spec.ts` 최상위 `beforeEach`(255행)가 `mockExecutionRepo`(285행,
  `manager.transaction` 포함)를 매 테스트 전체 재생성함을 확인 → 개별 `it` 안에서
  `mockExecutionRepo.manager.transaction = jest.fn(...)`로 직접 덮어쓰는 신규 테스트들이
  다음 테스트로 누수되지 않음(격리 보장).
- 최근 2개 커밋(`64763c5cd`, `860a727b7`)을 `git show`로 직접 열람 — 둘 다
  `assert-row-array.spec.ts`의 **주석 문구만** 고친 것이고(세션 ID 오귀속 정정, typecheck
  ratchet 경로 구체화), 테스트 로직·프로덕션 코드 변경은 0이다. 즉 `18_19_33` 라운드가
  "리뷰 루프를 닫는다"고 판정한 이후 이번 라운드까지 테스트 표면에 실질적으로 새로 추가된
  것은 없다.

## 발견사항

CRITICAL/WARNING 급 발견 없음. 4라운드에 걸쳐 이미 다뤄진 항목(`buildDispatcherForNull()` 1줄
pass-through 래퍼 등)은 위 검증에서 재현됐지만 이미 근거를 남기고 유예된 사안이라 재상정하지
않는다.

- **[INFO]** `assertRowArray`의 `it.each` 엣지케이스가 "배열이 아닌 값"의 대표 타입
  (`undefined`/`null`/객체/숫자/문자열) 5종은 커버하지만, "array-like 인데 실제 `Array`는
  아닌 값"(예: `{ length: 0 }`, arguments 객체)은 포함하지 않는다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts` (`it.each([...])` 블록,
    `assertRowArray`).
  - 상세: `Array.isArray`는 이런 값에 대해 정확히 `false`를 반환하므로 프로덕션 로직 자체는
    맞다. 다만 pg 드라이버가 실제로 이런 shape 을 반환할 가능성은 사실상 0이라 (`EntityManager
    .query()`는 배열 또는 예외적으로 `undefined`/`null`류만 돌려준다) 테스트 가치가 낮다 —
    이 갭이 실제 회귀를 놓칠 시나리오는 상상하기 어렵다.
  - 제안: 조치 불요. 기록만 남긴다.

## 긍정적으로 확인된 것 (독립 재검증)

- **사각지대 자기고백형 회귀 가드**(`자매 지점 전수 — 가드 누락 회귀 가드`, `assert-row-array.spec.ts`)가
  주장하는 수치를 별도 스크립트로 재현해 정확히 일치함을 확인했다 — vacuous 아님.
- **LRU 방향성 테스트**(`executions.service.spec.ts`)가 고정한 순서(`e-0`을 먼저 읽어 최근사용으로
  갱신 → `e-256` 삽입 시 `e-1`이 밀려남 → `e-1` miss, `e-0` hit)를 실제 `Map` 삽입순서 기반
  구현으로 손으로 트레이스한 결과 정확히 일치 — "뭔가 하나 지운다"만 고정하는 약한 테스트가
  아니라 방향을 실제로 가른다.
- **`computeChainDepth`/`lockNonTerminalExecutionRow`/`updateExecutionStatus`/`admitExecutionOrDefer`
  네 지점**에 대해 실패 방향(fail-open vs 이미 fail-closed vs 관측 불가능한 유실)을 각각 다르게
  타겟팅한 테스트가 붙어 있고, RESOLUTION.md 들이 기록한 뮤테이션 결과(각 라운드 4/4·6/6·4/4
  사살, 각각 정확히 1건만 실패)가 실패 방향과 1:1로 대응한다 — 형태상 grep 이지만 실측이 근거를
  갖췄다.
- **admission throw → routing release 대칭 테스트**(`execution-engine.service.spec.ts` 신규
  `it('admission 이 throw → routing release 후 그대로 재전파 + runExecution 미호출')`)는
  `registerExecutionRouting`/`releaseExecutionRouting` 호출을 모두 명시적으로 단언해, "release
  호출이 있었다"가 아니라 "무엇을 release 했는지"까지 고정한다.
- **`chat-channel.dispatcher.spec.ts`의 로그 레벨 삼항 분기 테스트**는 두 방향(execution.node.completed
  → debug, 그 외 → warn)을 각각 `debugSpy`/`warnSpy` 양쪽 모두에 대해 "호출됨"과 "호출 안 됨"을
  동시에 단언해 삼항을 한쪽으로 뒤집는 회귀를 놓치지 않는다. `Logger.prototype` 전역 spy는
  `try/finally`로 복원되고, 파일 전체가 순차 실행(`it.concurrent` 미사용)이라 교차 오염 없음을
  확인했다.
- **테스트 격리**: `execution-engine.service.spec.ts`/`executions.service.spec.ts` 모두 최상위
  `beforeEach`가 mock 저장소·서비스 인스턴스를 매 테스트 재생성하므로, 개별 `it` 안에서
  `manager.transaction`/`repo.query`를 직접 덮어쓰는 신규 테스트들이 서로 간섭하지 않는다.
- 마지막 2개 커밋(`64763c5cd`, `860a727b7`)은 테스트 로직 변경이 전혀 없는 주석 정정뿐이라,
  `18_19_33` 라운드까지 이미 검증된 뮤테이션 결과(6/6, 4/4 등)가 이번 라운드에도 그대로 유효하다.

## 요약

이번 changeset 의 실질 코드는 raw SQL `.query()` 반환 shape 을 검증하는 공용 헬퍼
`assertRowArray` 도입과 그 배선 누락 자체를 막는 정적 카운트 회귀 테스트, `snapshotCache` LRU
상한/방향 테스트, `chat-channel` dispatcher 로그 레벨 삼항 분기 양방향 테스트, admission
throw 시 routing release 대칭성 테스트로 구성된다. 4라운드에 걸친 선행 리뷰가 동작(fail-open
자매 미적용, routing 미해제) → 구조(가드 누락 자체를 막는 테스트) → 문서(주석 인용 오류)
순으로 수렴했고, 이번 라운드에서 실제로 바뀐 것은 주석 문구 2건뿐임을 `git diff`로 직접
확인했다. 핵심 주장(사각지대 정규식 수치, LRU 방향, 로그 레벨 분기, 테스트 격리)을 프로덕션
소스와 대조해 독립 재검증한 결과 전부 실측과 일치했다 — 테스트 관점에서 새로 열 CRITICAL/WARNING
은 없다. 유일한 INFO(array-like 비-Array 엣지케이스 미커버)는 실질적 회귀 가능성이 없어 조치
불요로 판단한다.

## 위험도

NONE
