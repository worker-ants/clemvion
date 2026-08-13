# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[INFO]** 신규 JSDoc 블록이 자신이 설명하는 코드(`describe` 블록)가 아니라 무관한 헬퍼 함수 앞에 놓여 있다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:703-714`
  - 상세: 703~714행 JSDoc 은 `isSubFilterNull` 로그 레벨 분기(debug/warn)를 `handle()` 경유로 검증하는
    이유를 설명하는데, 정작 그 설명이 서술하는 대상인 `describe('ChatChannelDispatcher.handle —
    toChatChannelEvent null 의 로그 레벨 분기', ...)` 는 55줄 뒤(769행)에 있다. 바로 다음 줄(715행)에는
    또 다른 JSDoc(`makeDispatcherHarness` 용, 716-722행)이 이어지고 그다음에야 그 함수 정의(723행)가
    나온다. JSDoc 두 블록이 연달아 있는데 앞의 것은 아무 선언에도 붙지 않은 채 "붕 떠서" 다음 요소인
    fixture 헬퍼 앞을 차지한 형태라, 처음 읽는 사람은 703-714 의 설명을 `makeDispatcherHarness` 에 대한
    것으로 오인하기 쉽다.
  - 제안: 703-714 JSDoc 블록을 실제 대상인 `describe(...)` 선언(769행) 바로 위로 이동한다.

- **[INFO]** `buildDispatcherForNull()` 이 인자 없이 `makeDispatcherHarness()` 를 그대로 호출만 하는
  1줄짜리 pass-through 래퍼다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:765-767`
  - 상세: `makeDispatcherHarness` 가 옵션 인자(`renderResult?`, `lookupState?`)를 이미 모두 기본값 처리하므로,
    두 호출부(789행, 817행)에서 `buildDispatcherForNull()` 대신 `makeDispatcherHarness()` 를 직접 써도
    동일하다. 이름이 다른 함수를 하나 더 두면 "이 이름의 함수는 null 시나리오에 특화된 뭔가를 하는가?" 라는
    질문을 독자에게 던지지만 실제로는 아무 차별화도 없다.
  - 제안: `buildDispatcherForNull` 을 제거하고 두 호출부에서 `makeDispatcherHarness()` 를 직접 호출.

- **[INFO]** 같은 파일 안에서 fixture 빌더 네이밍 컨벤션이 갈린다 — `make*` 1개 vs `build*` 3개.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:723`
    (`makeDispatcherHarness`) vs `:765`(`buildDispatcherForNull`), `:770`(`buildNullEvent`),
    `:843`(`buildDispatcher`)
  - 상세: 이 파일의 기존 컨벤션은 `build*`(테스트 대상/이벤트를 조립하는 헬퍼)였다. 이번 diff 가 새로
    도입한 공용 헬퍼만 `make*` 접두를 써서, 파일 내에 두 동사 컨벤션이 공존하게 됐다. 기능상 문제는
    없지만 다음에 비슷한 헬퍼를 추가할 사람이 어느 쪽을 따라야 할지 판단 근거가 사라진다.
  - 제안: `makeDispatcherHarness` → `buildDispatcherHarness` 로 리네임해 기존 컨벤션에 맞춘다(선택).

- **[INFO]** `dispatcher as unknown as { handle: ... }` 인라인 타입 캐스트 리터럴이 이번 diff 로 2곳
  더 늘어 파일 내 총 4곳이 됐다(기존 관례가 반복 관측되어 온 지점이 이번에 더 커졌다).
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:794-798`,
    `:822-826` (신규) / `:888-892`, `:906-910` (기존)
  - 상세: `ChatChannelDispatcher.handle` 이 private 이라 접근용 캐스트가 매 `it` 마다 새로 타이핑돼 있다.
    시그니처가 바뀌면 4곳을 동시에 고쳐야 한다. 직전 라운드(`14_01_46` maintainability INFO)에서도
    지적됐고 "파일 기존 관례" 로 무조치 처리됐는데, 이번 diff 가 그 표면을 2곳에서 4곳으로 배로 늘렸다.
  - 제안: 파일 상단에 `type DispatcherWithHandle = { handle: (e: ExecutionChannelEvent) => Promise<void> }`
    로컬 타입 별칭을 두고 4곳 모두에서 재사용(선택 — 심각도는 낮음).

## 확인된 양호 사항 (참고)

- `makeDispatcherHarness({ renderResult?, lookupState? })` 공용 헬퍼 도입으로 이전 라운드
  (`14_01_46` maintainability WARNING 2)가 지적한 `buildDispatcher`/`buildDispatcherForNull` 간
  생성자 배선 중복이 실제로 해소됐다 — 생성자 인자 5개·adapter/triggerRepository fixture 가 한 곳에만
  존재한다.
- `execution-engine.service.ts` 의 `Array.isArray(rows)` 가드(2931-2936행)는 단일 `if`/`throw` 로
  분기 하나만 추가해 순환 복잡도 증가가 최소이며, `Array.isArray` 사용 패턴도 파일 내 기존 12곳과
  일관된다.
- `executions.service.ts` 의 `SNAPSHOT_CACHE_MAX_ENTRIES` export 전환은 한 줄 변경으로 범위가
  명확하고, 값(256)과 심볼을 테스트에서 함께 고정한 설계 근거가 주석에 남아 있다.
- `execution-engine.service.spec.ts` 신규 admission 가드 테스트는 `spy.mockRestore()` 를
  `finally` 로 감싸 인접 테스트들의 기존 관례(`emitSpy()`+`try/finally`)와 일치한다 — 직전 라운드에서
  지적된 spy 복원 비일관성(INFO)이 해소된 상태다.
- `executions.service.spec.ts` 의 LRU 상한/방향 테스트는 반복문 하나로만 구성돼 중첩이 없고, 각 단계
  (채우기 → 상한 내 hit → evict → LRU 방향 확인)가 주석으로 명확히 분리돼 가독성이 좋다.

## 요약

이번 diff 는 3개 spec 파일에 대한 테스트 보강(로그 레벨 분기 양방향, LRU 캐시 경계값/방향, admission
fail-closed 회귀)과 그에 대응하는 프로덕션 코드 변경 2건(`Array.isArray` 가드, `SNAPSHOT_CACHE_MAX_ENTRIES`
export)으로 구성되며, 직전 라운드(`14_01_46`)에서 지적된 WARNING(fixture 중복)·INFO(spy 복원)가 실제로
해소됐음을 확인했다. 신규 프로덕션 코드는 함수 길이·중첩·복잡도 모두 낮고 기존 코드베이스 패턴과 일관된다.
남은 것은 전부 INFO 수준의 사소한 사항이다 — 신규 JSDoc 한 블록이 설명 대상과 떨어져 배치됐고, 인자 없는
1줄 pass-through 래퍼 하나가 불필요한 간접 참조를 만들며, 신규 공용 헬퍼가 파일의 기존 `build*` 네이밍
관례 대신 `make*` 를 써 컨벤션이 갈렸고, 이미 알려진 타입 캐스트 중복 표면이 이번 diff 로 두 배로
늘었다. 기능적 위험이나 실질적 유지보수 부담을 유발하는 항목은 없다.

## 위험도

LOW
