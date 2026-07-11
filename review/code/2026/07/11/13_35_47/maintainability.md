# 유지보수성(Maintainability) 리뷰 — guard-effectiveness-18f8e7

대상: `git diff 74b256f46..HEAD` (2 commits: `a3317ef37` mock 타입 정리, `029abcd86` typecheck harness 배선 + CI trigger)

- `.claude/test-stages.sh`
- `.github/workflows/spec-link-checks.yml` (신규)
- `codebase/channel-web-chat/src/lib/presentation.test.ts`
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`

## 발견사항

- **[WARNING]** EventSource 이중 캐스트(`as unknown as this` / `as unknown as typeof EventSource`)가 사실상 동일한 형태로 4곳에 흩어져 있고, 공용 헬퍼로 추출되지 않음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:94-101`(`installControllableSse`), `:213-218`, `:642-647`, `:795-800`
  - 상세: 4곳 모두
    ```ts
    vi.stubGlobal("EventSource", class {
      constructor() { <var> = new ControllableEventSource(); return <var> as unknown as this; }
      addEventListener() {}
      close() {}
    } as unknown as typeof EventSource);
    ```
    형태로, 캡처 변수명(`latest`/`latestEs`)만 다르고 나머지는 문자 그대로 동일하다. `installControllableSse()`(94-101행)는 이미 팩토리 함수인데, 나머지 3곳(213, 642, 795)은 동일 로직을 인라인으로 손복사했다. `installControllableSse` 를 재사용하지 못한 이유가 각 테스트가 로컬 클로저 변수(`latestEs`/`latest`)를 자체 스코프에 두고 싶어서로 보이나, `installControllableSse` 도 동일하게 `getEs()` 접근자를 반환하므로 실제로는 재사용 가능해 보인다(최소 642·795행은 `installControllableSse()` 로 치환 가능해 보임 — 동일한 fetch mock 형태인지는 케이스별 확인 필요). 결과적으로 "타입 안전을 우회하는 이중 캐스트"라는 취약한 패턴이 1곳이 아니라 4곳에서 유지보수 대상이 되어, 향후 `ControllableEventSource` 의 시그니처가 바뀌면 4곳을 함께 고쳐야 한다.
  - 제안: (a) 최소한 `installControllableSse()` 를 213/642/795행에서 재사용 가능한지 검토, (b) 재사용이 어려운 개별 사정이 있다면 `stubControllableEventSource(onCreate: (es: ControllableEventSource) => void): void` 같은 공용 헬퍼로 캐스트 부분만 추출해 캐스트 자체는 한 곳에만 존재하게 한다. 테스트 코드이므로 CRITICAL 은 아니지만, 중복이 "타입 안전성을 의도적으로 깨는 코드"라는 점에서 일반 로직 중복보다 유지보수 리스크가 크다.

- **[INFO]** 캐스트 자체의 타입 안전성 우회 방식은 vitest 전역 mocking에서 흔히 쓰이는 관용구 범주이나, `ControllableEventSource` 가 `EventSource` 인터페이스를 직접 구현하도록 만드는 대안이 더 안전할 수 있음
  - 위치: 상동
  - 상세: `EventSource` 전체 인터페이스(readyState, onopen/onmessage/onerror, CONNECTING/OPEN/CLOSED 정적 멤버, dispatchEvent 등)를 구현하는 것은 스텁 입장에서 과도한 보일러플레이트이므로, "익명 클래스 constructor 가 다른 인스턴스를 반환" 트릭 자체를 쓴 선택은 실용적이다. 다만 이중 `as unknown as` 캐스트는 컴파일러 체크를 완전히 무력화하므로, `ControllableEventSource` 에서 실수로 `addEventListener`/`close` 시그니처가 어긋나도 캐스트가 조용히 삼킨다. 대안으로 `Pick<EventSource, "addEventListener" | "close">` 정도의 최소 구조적 타입을 팩토리 반환 타입으로 명시하면, 스텁이 실제로 필요한 멤버만 타입 체크 대상에 넣으면서 완전 무검증(`as unknown as`)보다는 좁은 범위에서 안전해진다. 강제 권고는 아님(테스트 코드, 현재도 동작함) — 다음에 이 헬퍼를 추출할 때 함께 고려할 수준.

- **[WARNING]** `as unknown as this` — constructor 반환문의 비직관적 트릭에 설명 주석이 전혀 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:97, 215, 644, 797` (동일 패턴 4곳 전부)
  - 상세: "익명 클래스의 constructor 가 `this` 가 아닌 다른 객체를 반환하면 `new` 표현식의 타입이 그 반환값 타입으로 대체된다"는 TS 동작(및 그로 인해 `return <var>;`가 원래는 캐스트 없이도 동작했으나 어딘가에서 `EventSource` 타입으로 대입되는 지점 때문에 `as unknown as this`/`as unknown as typeof EventSource` 가 필요해졌다는 배경)은 TS 에 익숙한 리뷰어도 즉시 이해하기 어렵다. 실제로 이 트릭에 대한 설명은 코드에는 없고 커밋 메시지(`a3317ef37`: "anonymous class constructor 가 ControllableEventSource 인스턴스를 return 해 instance type 과 불일치...")에만 남아 있다. 코드만 보는 향후 리더(git blame/log 를 반드시 따라가지 않는 사람)에게는 "왜 이렇게까지 이중 캐스트가 필요한가"가 미스터리로 남는다.
  - 제안: 4곳 모두에 반복해서 주석을 달 필요는 없다 — 위 항목의 공용 헬퍼로 추출하면서 그 헬퍼 정의부 한 곳에 "constructor 가 다른 인스턴스를 반환하는 트릭 + 이중 캐스트가 필요한 이유"를 1~2줄로 남기면 중복 없이 해결된다. 헬퍼 추출을 하지 않는다면 최소한 최초 등장(94-101행, `installControllableSse`)에 한 줄 주석을 추가할 것을 권장.

- **[WARNING]** `c.items[0]!.buttons!` — 이중 non-null assertion 중 앞쪽(`items[0]!`)이 불필요하며, 같은 파일의 기존 관례와도 어긋남
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts:143, 291`
  - 상세: `CarouselItem.buttons` 는 optional(`buttons?: PresentationButton[]`, `presentation.ts:23`)이라 `.buttons!` 는 타당하다. 그러나 `CarouselData.items` 는 `CarouselItem[]`(비-optional 원소 타입)이고 프로젝트 tsconfig(`codebase/channel-web-chat/tsconfig.json`)에는 `noUncheckedIndexedAccess` 가 설정돼 있지 않으므로, `c.items[0]` 자체는 `undefined` 를 포함하지 않는 타입으로 추론된다. 실제로 `tsc --strict` 로 별도 검증한 결과 `c.items[0].buttons!.map(...)` (앞쪽 `!` 없이) 도 컴파일 에러 없이 통과한다. 게다가 같은 파일 안에서 `c.items[0].title`(50, 141행), `c.items[0].image`(341, 347행)는 전혀 assertion 없이 그대로 인덱싱하고 있어, 143·291행에서만 `items[0]!` 를 추가한 것은 파일 내부적으로도 비일관적이다. 불필요한 `!` 는 "이 인덱스가 정말 undefined 일 수 있다"는 잘못된 신호를 주고, non-null assertion 이 남용될수록 실제로 의미 있는 assertion(`.buttons!`)의 신호 가치도 희석된다.
  - 제안: `c.items[0].buttons!.map(...)` 로 앞쪽 `!` 를 제거해 파일 내 다른 `items[0].xxx` 접근과 통일. (해당 커밋 메시지 자체도 `c.items[0]!.buttons.map` 형태였다고 서술하지만 실제 diff 전 코드는 `c.items[0].buttons.map` — assertion 없는 형태 — 였다는 점도 참고.)

- **[INFO]** `test-stages.sh` — `channel-web-chat typecheck` 단계가 `channel-web-chat build` 바로 뒤에 배치된 것은 같은 패키지 스텝을 묶어 읽기 좋게 하는 배치이나, "왜 channel-web-chat 만 build 와 별도로 typecheck 단계가 하나 더 있는지"를 설명하는 인라인 주석이 없음
  - 위치: `.claude/test-stages.sh:83-92` (`cmd_build`), 특히 신규 라인 89
  - 상세: `cmd_build` 의 나머지 4개 패키지(backend/frontend/@workflow/web-chat/@workflow/sdk)는 각각 `build` 한 줄뿐인데 channel-web-chat 만 `build` + `typecheck` 두 줄이다. 실제 이유(커밋 메시지 `029abcd86` 발췌: channel-web-chat 은 `test`=vitest(타입 strip)이고 `next build` 는 build 그래프에 안 걸리는 `*.test.ts` 를 검사하지 않아, PR #912 가 추가한 타입 가드가 harness 어디서도 발화하지 않던 갭이었다는 것)는 타당하고 구체적이지만, 이 근거는 커밋 메시지에만 있고 파일 본문에는 없다. `test-stages.sh` 상단에는 이미 "lint/unit/build 는 backend+frontend+web-chat 전부 실행(PR-E3 사례)"류의 근거 주석 관례가 있는 파일이라, 이 신규 라인만 예외적으로 근거 주석이 빠진 게 눈에 띈다. `git log` 없이 파일만 읽는 미래 유지보수자는 "이건 복붙 실수/중복 아닌가?" 라고 오해하고 지울 위험이 있다.
  - 배치 순서 자체(빌드 뒤에 typecheck)는 기능적으로 문제 없음 — `typecheck` 스크립트(`tsc --noEmit`)가 `next build` 산출물에 의존하지 않으므로 순서 무관하게 동작한다. 다만 "실패를 빨리 알림" 관점에서는 (일반적으로 더 가벼운) typecheck 를 build 보다 앞에 두는 편이 더 흔한 관례이나, 이 프로젝트에서는 패키지별로 스텝을 그룹핑하는 기존 스타일(같은 필터 옆에 이어붙임)을 따른 것으로 보여 배치 자체를 문제로 보지는 않음.
  - 제안: 89행 위(또는 옆)에 "channel-web-chat 은 output:'export' 정적 빌드라 next build 가 *.test.ts 타입을 검증하지 않음 — 별도 tsc 필요(PR #912 타입 가드 harness 미발화 갭)" 정도의 1줄 주석 추가.

- **[INFO]** `spec-link-checks.yml` 의 트리거 경로 목록이 sibling 워크플로(`frontend-checks.yml`)와 한 가지 항목에서 비대칭
  - 위치: `.github/workflows/spec-link-checks.yml:30-45`(pull_request/push paths) vs `.github/workflows/frontend-checks.yml:16-27`
  - 상세: `frontend-checks.yml` 은 `pull_request`/`push` 양쪽 paths 에 `codebase/frontend/**`·`codebase/packages/**` 외에 `pnpm-lock.yaml`·`pnpm-workspace.yaml` 도 포함한다(락파일 변경으로 인한 회귀를 잡기 위함으로 보임). `spec-link-checks.yml` 은 `pnpm install --frozen-lockfile --filter "frontend..."` 로 동일하게 lockfile 에 의존해 설치하면서도, paths 목록에 `pnpm-lock.yaml`/`pnpm-workspace.yaml` 이 빠져 있다. 두 워크플로가 "코드베이스 소스만 바꿔도 lightweight 하게 돈다"는 유사한 목적을 공유하는 자매 파일인데 이 부분만 스타일이 다르면, 다음에 두 파일을 같이 유지보수할 사람이 "의도적 생략인지 누락인지" 헷갈릴 수 있다.
  - 실질 영향은 낮음(spec-link-integrity 가드는 순수 fs 스캔/정규식이라 의존성 버전에 민감할 가능성이 낮음)이므로 CRITICAL/WARNING 이 아닌 INFO 로 유지. 의도적 생략이라면 짧은 주석으로 명시하는 편이 다음 리뷰어의 재확인 비용을 줄인다.
  - 제안: 의도적이면 "가드는 lockfile 버전에 민감하지 않아 pnpm-lock.yaml 은 트리거에서 제외" 같은 1줄 주석 추가, 아니면 `frontend-checks.yml` 과 맞춰 `pnpm-lock.yaml`/`pnpm-workspace.yaml` 추가.

- **[INFO]** `spec-link-checks.yml` 자체의 가독성·주석 스타일은 `frontend-checks.yml` 과 잘 정렬됨(긍정 확인)
  - 위치: `.github/workflows/spec-link-checks.yml:1-11`(헤더 comment), `:47-48`(install 단계 앞 인라인 주석)
  - 상세: 두 파일 모두 "도입 배경" 서술형 헤더 주석 → `name`/`on`/`concurrency`/`jobs` 순서 → 설치 단계 앞 근거 주석이라는 동일한 골격을 따른다. `concurrency.group` 네이밍(`spec-link-checks-${{ github.ref }}`)도 `frontend-checks-${{ github.ref }}` 패턴과 일관된다. job/step 이름도 목적이 명확(`spec-link-integrity guard`). 이 부분은 결함이 아니라 기존 스타일을 잘 따른 사례로, 별도 조치 불필요.

## 요약

이번 diff 는 대부분 테스트 코드의 타입 정리(pre-existing red 해소)와 CI 워크플로 신설로, 전반적인 가독성·네이밍·구조는 기존 관례를 잘 따르고 있고 함수 길이·중첩·복잡도 측면에서 특별한 문제는 없다. 다만 (1) EventSource 스텁의 이중 타입 캐스트가 이번 변경으로 4곳에 동일 형태로 박제되면서 공용 헬퍼 추출 기회를 놓쳤고 설명 주석도 전무해 향후 리더의 이해 비용이 크며, (2) `presentation.test.ts` 의 `items[0]!` 는 같은 파일 내 다른 5곳(assertion 없는 `items[0].xxx`)과 불일치하는, tsc 로 실증 확인된 불필요한 assertion이다. (3) `test-stages.sh`/`spec-link-checks.yml` 은 "왜 이 패키지만 예외 처리하는지"에 대한 근거가 코드가 아닌 커밋 메시지에만 남아 있어, 커밋 히스토리를 안 보는 미래 독자에게는 의도가 불투명하다. 이들 모두 기능적으로는 정상 동작하고(모두 테스트/CI 설정 코드) 즉시 차단할 결함은 아니지만, 반복되는 관용구를 추출하고 근거를 코드 옆에 남기면 다음 유지보수자의 이해·수정 비용이 눈에 띄게 줄어든다.

## 위험도

LOW
