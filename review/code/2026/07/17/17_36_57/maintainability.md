# 유지보수성(Maintainability) 리뷰 — webchat-boot-single-flight

대상: `codebase/channel-web-chat/src/lib/widget-state.ts`(+test), `codebase/channel-web-chat/src/widget/use-widget.ts`(+`use-widget-eager-start.test.ts`), `plan/in-progress/webchat-boot-single-flight.md`, `spec/7-channel-web-chat/2-sdk.md`.

오케스트레이터가 요청한 4개 검증 항목(구조적 강제의 실효성 / `isStale` vs `isAttemptStale` 네이밍 혼동 / 주석 밀도 / `guardedAwait` 미채택 근거)을 중심으로, 표준 유지보수성 체크리스트를 함께 적용했다. 실제 소스(`use-widget.ts` 957줄, `widget-state.ts` 222줄)를 직접 읽고 `git diff origin/main...HEAD` 로 변경 범위를 재검증했다.

## 발견사항

- **[WARNING]** "타입 검사가 축 누락 가드를 막는다"는 주장은 실제로는 특정 변수명 재사용만 막고, 동등한 손수-작성 우회는 컴파일된다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `beginBootAttempt` JSDoc L254-256("`isStale(gen)` 은 **컴파일되지 않는다**"), `isStale`(L241)·`isAttemptStale`(L265-270) 정의, `applyConfig`(L829-873) 사용부.
  - 상세: JSDoc은 `applyConfig` 가 `gen`(world 단독)을 스코프에 두지 않으므로 `isStale(gen)` 이 컴파일 에러가 되어 "축을 빠뜨린 가드를 쓰는 것이 타입 검사로 막힌다"고 서술한다. 직접 확인한 결과 이는 사실이다 — `gen` 은 `seedWaitingFromStatus`(L447)·`start`(L539)·`sendCommand`(L584) 각각의 독립된 `useCallback` 클로저 안에서만 선언되고, `applyConfig` 의 렉시컬 스코프 체인 어디에도 없다. 그러나 이 보장은 **철자 하나에만 걸려 있다**. `beginBootAttempt()` 가 반환하는 토큰은 `{ world: number; boot: number }` 평범한 객체이고, `isStale: (gen: number) => boolean` 은 인자로 순수 `number` 를 받는다. 따라서 누군가 `applyConfig` 안에서 `isStale(attempt.world)` 를 쓰면 — 타입은 완전히 맞으므로 — **에러 없이 컴파일되고 boot 축 재검증이 조용히 빠진다.** `isStale` 과 `isAttemptStale` 이라는 극히 유사한 이름의 두 predicate 가 나란히 있는 상황에서, "await 뒤 재검증"을 작성하던 손이 다른 세 호출부(`start`/`sendCommand`/`seedWaitingFromStatus`)에서 익힌 `isStale(gen)` 관용구를 그대로 가져오며 `gen` 자리에 `attempt.world` 를 채워 넣는 것은 매우 자연스러운 실수다. 더 나아가 `worldGenRef`/`bootGenRef` 자체가 캡슐화 없이 훅 전체에서 `.current` 로 직접 읽고 쓸 수 있으므로, `isAttemptStale` 을 아예 우회하고 손으로 새 단일축 비교를 작성해도 막을 방법이 없다. 이 파일이 정확히 "한 호출부는 재검증하고 다른 호출부는 빠뜨리는" 비대칭 가드 누락으로 3회 CRITICAL 을 냈다는 점(`02_04_13` C1·`08_29_33` W2·`09_36_01` W5)을 감안하면, 이번 방어가 막는 범위는 그 실패 클래스 전체가 아니라 "그 실수를 정확히 이 철자로 재현하는 경우"로 좁다. 같은 diff 의 B(`establishConfig` 비-async 추출, `await` 삽입 시 `TS1308` 로 실제 차단)와 비교하면 강제력의 종류가 다르다는 점이 뚜렷하다 — B 는 "이 형태의 코드 자체가 안 써진다", A 의 이 부분은 "특정 변수명을 재사용하면 에러가 난다" 수준이다.
  - 제안: (a) 최소 조치로 JSDoc 에 "이 보장은 로컬 `gen` 재사용 철자에만 해당하며 `attempt.world` 부분 추출이나 `worldGenRef.current` 직접 비교로는 여전히 우회된다"는 한계를 명시해 과신을 방지. (b) 더 견고하게는 `world`/`boot` 필드를 raw `number` 대신 opaque/branded 타입으로 감싸 `isStale` 시그니처와 구조적으로 호환되지 않게 하거나, 토큰 자체를 필드 접근이 안 되는 형태로 바꾸는 것. (c) 가장 근본적으로는 plan Rationale 이 이미 언급한 `useEiaSession` 류 분리로 `worldGenRef`/`bootGenRef`/`isStale`/`isAttemptStale`/`beginBootAttempt` 를 별도 모듈에 캡슐화해 `.current` 를 아예 훅 스코프 밖으로 내보내지 않는 것 — 아래 파일 크기 관찰과도 시너지가 있다.

- **[WARNING]** A-6("ERROR 종료 후 wc:boot 재전송 시 부활") 실패 서사가 소스 3곳 + plan 1곳에 거의 동일 문장으로 반복
  - 위치: `widget-state.ts` L125-136(`RESTORED` 케이스 주석, 신규) · `widget-state.test.ts` L145-149(신규 `it.each` 상단 주석) · `use-widget-eager-start.test.ts` L2608-2613(신규 통합 테스트 상단 주석) · `plan/in-progress/webchat-boot-single-flight.md` "진행 기록 — A-6 완료" 절.
  - 상세: "`ERROR` 는 `teardownSession` 을 거치지 않는 유일한 종료 경로 → 저장 세션 잔존 → host 가 `wc:boot` 재전송 → 복원 분기가 `RESTORED` 로 `ended→streaming` 부활 → `08_29_33` W4 가 보류했던 확대의 트리거 충족"이라는 동일한 인과 서사가 문장 단위로 거의 그대로 4곳에 반복된다. 각 위치가 서로 다른 1차 독자(리듀서만 보는 사람/단위테스트만 보는 사람/통합테스트만 보는 사람/plan 만 보는 사람)를 갖는다는 점에서 전부 불필요하다고 보긴 어렵지만, 이 인과관계의 SoT 가 불명확하다. 향후 `ERROR` 처리 방식이 바뀌면(예: `teardownSession` 을 거치도록 수정) 네 곳을 모두 찾아 갱신해야 하는데 이를 강제하는 장치가 없다 — drift 위험. `widget-state.test.ts` 는 이미 `(재현 확인 → use-widget-eager-start.test.ts 의 통합 회귀 테스트)`로 부분적 상호 참조를 하고 있어, 완전 중복은 아니지만 확장 여지가 있음을 보여준다.
  - 제안: 가장 상세한 서술(현재 `widget-state.ts` `RESTORED` 케이스 주석)을 SoT 로 지정하고, 나머지는 "왜 이 지점에도 가드/테스트가 필요한가"(그 파일 고유 관점)만 남긴 채 전체 인과 서사는 "자세한 배경은 `widget-state.ts` `RESTORED` 케이스 참조" 식으로 축약. `BOOTED` 케이스가 이미 이 패턴을 잘 보여준다(전체를 반복하지 않고 "`RESTORED` 와 대칭으로 막는다"로 축약) — 그 방식을 나머지 세 곳에도 적용 가능.

- **[INFO]** `establishConfig` 이름이 실제 이중 책임(config 확립 + 대기 중 리셋 소비/이행)을 온전히 드러내지 않음
  - 위치: `use-widget.ts` L791-825.
  - 상세: 함수는 `configRef`/`setConfig`/`clientRef` 설정뿐 아니라 `pendingResetRef` 를 소비하고 조건부로 `apiRef.current.newChat()` 을 직접 호출하는 부수효과까지 수행한다. 반환 타입 `"reset" | "continue"` 자체가 이 이중성을 암시하지만, 함수 이름만으로는 "config 를 세팅하는 단순 동작"으로 오인하기 쉽다. plan §B 가 제안했던 후보명은 `establishConfigAndConsumeReset` 이었으나 실제 구현은 더 짧은 `establishConfig` 로 귀결됐다. 바로 위 JSDoc 제목("config 확립 + 대기 중 리셋 소비")이 이를 보완하므로 실질 위험은 낮다.
  - 제안: 현행 유지 가능. 리네이밍한다면 plan 후보명 방향 고려. 시급하지 않음.

- **[INFO]** `useWidget()` 단일 함수가 이미 800줄 이상이며 이번 변경으로 더 성장(다만 이번 diff 자체는 개선 방향)
  - 위치: `use-widget.ts` `export function useWidget()` 전체(약 L121–L943), 파일 전체 957줄(신규 코드 라인 대비 주석 라인 비율 약 74%, `git diff origin/main...HEAD` 기준 추가 103라인 중 76라인이 주석).
  - 상세: 이 커스텀 훅 하나가 파일 대부분을 차지하는 구조는 이번 diff 이전부터 있던 상태다. 이번 변경 자체는 오히려 긍정적 방향이다 — `establishConfig` 를 별도 콜백으로 뽑아 `applyConfig` 자체의 분기 수를 줄였고, 신규 `beginBootAttempt`/`isAttemptStale` 은 각각 1줄 바디의 단순 predicate 라 로컬 복잡도 기여가 작다. 다만 파일 전체가 이미 크고, 이번처럼 세대 가드류 로직을 훅 최상위에 계속 얹는 패턴이 반복되면 장기적으로 탐색성이 나빠진다. 주석 밀도(파일 전체 약 45% 라인이 주석, 이번 diff 는 추가분의 74%가 주석) 는 이 파일이 3~4회 실측 재현된 회귀를 낸 이력에 비춰 "무엇을 하는지"가 아니라 "왜 이 형태이고 유혹적인 대안이 왜 틀렸는지"를 기록하는 방어적 문서화로, 대체로 정당화된다(예: `bootGenRef`/`beginBootAttempt` JSDoc 각각은 서로 다른 각도 — "왜 별도 축인가" vs "왜 호출부에서 손으로 AND 하지 않는가" — 를 다뤄 순수 중복은 아니다).
  - 제안: 지금 구조를 바꾸는 것은 plan 이 명시적으로 경계한 대로("이 김에 구조를 고치는 선택이 정확히 직전 회귀를 낳았다") 오히려 위험하므로 현시점 조치 불요. plan Rationale 이 언급한 `useEiaSession` 분리가 실행될 때 world/boot 세대 가드 일체를 그 경계로 옮기면 파일 크기와 위 첫 번째 finding(캡슐화)을 동시에 개선할 수 있다는 점을 후속 참고로 남긴다.

- **[INFO]** `guardedAwait` 미채택 근거(plan §A-0)는 타당함 — 확인 결과 오히려 더 강한 근거가 추가로 있음
  - 위치: `plan/in-progress/webchat-boot-single-flight.md` "진행 기록 — A 완료" §A-0 / `use-widget.ts` `beginBootAttempt` JSDoc 의 "(`guardedAwait` 구조화 대신 이걸 택한 근거: plan `webchat-boot-single-flight.md` §A-0)" 인용부.
  - 상세: plan 이 제시한 근거("재검증 실패 시 return 을 표현하려면 sentinel/throw 가 필요해 제어 흐름이 복잡해진다")는 타당하다. 추가로 확인한 점: `applyConfig` 의 두 번째 await 지점(`seedWaitingFromStatus`)은 이미 자체 3중 판정(`SeedOutcome = "ended" | "stale" | "continue"`)을 반환하며 그 내부에서 world 축을 독립적으로 재검증한다(L458, L490). 여기에 `guardedAwait` 로 boot(+world) 축까지 감싸면, "이 await 가 유효한가"를 신호하는 채널이 (i) 콜백 내부 `SeedOutcome`, (ii) 래퍼의 stale sentinel/예외, (iii) 바깥 `isAttemptStale` 재확인까지 세 겹으로 겹쳐, 기존 주석이 이미 "아래 `gen` 검사와 중복이 아니다"(L558) 라고 애써 설명해야 했던 부담을 더 키웠을 것이다. 토큰 캡슐화 쪽이 기존 `SeedOutcome` 패턴과 더 잘 어울리고, 파일 전체에서 "`await` 뒤 `if (check) return`" 이라는 단일 관용구를 유지시켜 준다 — `guardedAwait` 는 이 파일에서 유일하게 다른 형태의 async-guard 관용구가 됐을 것이다. 제어흐름을 복잡하게 만드는 리팩터가 반복적으로 사고를 냈다는 이 파일의 이력을 고려하면 보수적 선택이 합리적이다.
  - 제안: 결정을 지지한다. 다만 위 `SeedOutcome` 충돌 논거를 plan 이나 JSDoc 에 한 줄 추가하면, 향후 "`guardedAwait` 를 재검토하자"는 제안이 나올 때 재논의 비용을 줄일 수 있다.

- **[INFO]** 리뷰 payload 의 "파일 5"(`plan/in-progress/harness-session-anchor-guards.md` 전체 삭제)는 이 브랜치의 실제 변경사항이 아님
  - 위치: 리뷰 payload("파일 5" 섹션) — 실제 코드베이스 아님.
  - 상세: `git diff origin/main...HEAD --stat` 로 확인한 결과 이 브랜치가 실제로 건드리는 파일은 6개(파일 1·2·3·4·6·7)뿐이며, `harness-session-anchor-guards.md` 는 `origin/main` 과 `HEAD` 에서 완전히 동일하다(diff 없음, 삭제되지 않음). payload 생성 시점의 base 계산이 stale 했던 것으로 보인다(브랜치가 이후 rebase 되며 merge-base 가 갱신됐을 가능성). 코드 자체의 유지보수성 문제는 아니지만, 이 리뷰 결과를 소비하는 쪽(오케스트레이터/merge-coordinator)이 "파일 5 삭제"를 실제 변경으로 오인하지 않도록 남긴다.
  - 제안: 없음(정보성). 이 세션에서 코드나 payload 를 수정하지 않았다.

## 요약

이번 변경은 이 파일이 반복적으로 겪은 "비대칭 가드 누락" 실패 클래스를 줄이려는 의도가 뚜렷하고, 실제로도 상당 부분 성공했다. `beginBootAttempt`/`isAttemptStale` 토큰화는 호출부의 재검증 관용구(`await` → `if (check) return`)를 그대로 유지하면서 축을 하나로 묶어 "호출부가 손으로 AND 하다 하나를 빠뜨리는" 실패 모드를 줄였고, `establishConfig` 를 비-async 로 추출한 것은 "이 구간엔 `await` 이 없다"는, 테스트로는 고정할 수 없던 불변식을 `TS1308` 컴파일 오류로 실제 강제하는 좋은 예다. 테스트 쪽도 `it.each` 로 중복 없이 케이스를 확장하고 mutation 매트릭스로 비대칭 누락을 실측 검증하는 등 이 파일의 과거 실패에서 얻은 규율을 잘 반영한다. 다만 핵심 방어(`isStale(gen)` 이 `applyConfig` 에서 컴파일되지 않는다는 주장)는 "로컬 변수명 재사용"이라는 좁은 오용 경로만 막을 뿐, `isStale(attempt.world)` 처럼 이름이 비슷한 두 predicate 를 혼동해 필드만 잘못 넘기는 — 이 파일이 실제로 3번 겪은 것과 같은 계열의 — 실수는 여전히 타입 오류 없이 컴파일된다. 이는 JSDoc 의 확신에 찬 서술("컴파일되지 않는다")이 실제 보장 범위보다 강하게 읽힐 소지가 있어, 문서 정확성과 향후 재발 방지 관점에서 보완이 필요하다. 그 외에는 A-6 관련 서사가 소스 3곳과 plan 에 거의 그대로 반복되는 점(SoT 불명확, drift 위험) 정도가 눈에 띄고, 나머지(네이밍·함수 길이·`guardedAwait` 결정)는 대체로 합리적이거나 시급하지 않은 수준이다.

## 위험도

LOW
