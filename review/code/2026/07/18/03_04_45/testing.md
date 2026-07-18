# 테스트(Testing) 리뷰 — webchat-boot-single-flight (03_04_45)

## 조사 방법 / payload 한계 고지

`prompt_file`(2617줄)에 실제 코드 diff 청크가 일부 포함돼 있었으나, 오케스트레이터가 지목한 "이번 라운드
핵심" 커밋은 `94b66b212`(테스트 커버리지 갭 fix)다. payload 를 신뢰하지 않고 `git show 94b66b212`,
`git log --oneline -15` 로 라운드 경계와 실제 diff 전문을 직접 확보했다.

**격리 mutation 검증**: 공유 워크트리(`webchat-boot-single-flight-8c92b4`, 다른 리뷰어 동시 사용 중)는
읽기 전용으로만 썼다. 실제 mutation testing 은 `git worktree add --detach`(scratchpad 하위,
`testing-review-wt`)로 만든 격리 워크트리에서 커밋 `94b66b212`(HEAD)를 체크아웃해 수행하고, 검증 후
`git worktree remove --force` 로 제거했다(`git status --porcelain` 로 공유 워크트리 무변경 확인 완료).
node_modules 는 공유 워크트리 루트를 심링크, `codebase/channel-web-chat/node_modules` 는 `rsync -a`
실카피로 부트스트랩(pnpm isolated 구조, 개별 항목 심링크는 문제 없음 — 과거 라운드에서 검증된 패턴 재사용).

---

## 발견사항

- **[INFO] 커버리지 갭 fix 검증 완료 — mutation 3-way 결과가 커밋 주장과 정확히 일치, 5회 반복 무-flaky**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3412-3489`
    (`raceStartVsResendSingleStream(resendResolvesFirst)` 헬퍼 + 두 개 `it` 블록),
    `codebase/channel-web-chat/src/widget/use-widget.ts:673`(`start()` 게이트),
    `:1018`(`applyConfig` 복원 분기 게이트).
  - 상세: 격리 워크트리에서 baseline(무변경) 394/394 통과를 먼저 확인한 뒤, 세 가지 mutation 을 각각
    적용하고 대상 파일(60건)을 재실행했다(각 상태 3~5회 반복 — flaky 여부 확인):
    1. **`start()` 게이트(673행)만 삭제** → "재전송 먼저 열려도 하나만 생성된다 (start() 게이트)"
       (companion, 신규) **만** 3/3 회 실패(`59 passed`). "start 먼저 — applyConfig 게이트"(기존)는
       3/3 회 통과. 커밋 메시지의 "start 게이트만 제거 → companion 만 실패" 주장과 정확히 일치.
    2. **`applyConfig` 게이트(1018행)만 삭제** → "start 먼저 — applyConfig 게이트"(기존) **만** 3/3 회
       실패, companion 은 3/3 회 통과. "applyConfig 게이트만 제거 → 기존만 실패" 주장과 정확히 일치.
    3. **두 게이트 모두 삭제** → 두 테스트 모두 3/3 회 실패(`58 passed`).
    4. baseline 복원 후 5회 반복 재실행 — 5/5 회 `60 passed`(0 실패), flaky 관측 없음.

    각 mutation 후 실패 테스트명까지 정확히 대조했으며(`grep`으로 실패 케이스명 직접 확인), 우연한 다른
    테스트 오염 없이 딱 해당 게이트의 테스트만 반응했다. 두 신규 테스트가 각자 정확히 하나의 게이트를
    개별로 고정한다는 커밋 메시지의 핵심 주장을 실측으로 반증 없이 확인했다.
  - 제안: 없음(검증 목적, 조치 불요).

- **[INFO] resolve 순서 파라미터화 리팩토링이 기존 테스트의 시나리오·단언을 그대로 보존 — 회귀 없음**
  - 위치: `use-widget-eager-start.test.ts:3412-3477`(헬퍼 본문 — mock 셋업·`boot()`/`open()`/webhook/
    getStatus 시퀀스), `git show 94b66b212 -- ...test.ts` diff 전문.
  - 상세: 리팩토링 전 단일 테스트가 갖고 있던 mock 셋업(EventSource stub, fetch 3-패턴 stub,
    `webhook202()`/`waitingAt()` 응답 빌더), 시나리오 순서(신규 방문→open→webhook→C→재전송→D→동시
    resolve), 최종 단언(`esCount===1`, `nodeId==="n1"`)이 헬퍼 추출 후에도 문자 그대로 보존됐다 — 바뀐
    것은 오직 "어느 인덱스가 먼저 resolve 하는가"를 결정하는 `const [first, second] = resendResolvesFirst
    ? [1, 0] : [0, 1]` 한 줄뿐이다. 제거된 지역변수 `latestEs`(구 버전에서 EventSource stub 생성자가
    할당했으나 실제로 어떤 단언에도 쓰이지 않던 dead capture)는 `tsc --noEmit` 클린으로 dangling
    reference 없음을 재확인했다 — 순수 정리이며 동작 변경 없음.
  - 제안: 없음.

- **[INFO] 신규 두 테스트의 격리 확인 — 순서 독립 실행 가능, 전역 cleanup 정상 작동**
  - 위치: `use-widget-eager-start.test.ts:185-202`(전역 `beforeEach`/`afterEach` — `vi.unstubAllGlobals()`,
    `vi.restoreAllMocks()`, `vi.useRealTimers()`, `document.referrer` 리셋), 두 신규 `it` 블록.
  - 상세: `npx vitest run ... -t "재전송 먼저 열려도 하나만 생성된다"`와 `-t "start 먼저 — applyConfig
    게이트"`로 각 테스트를 다른 59건과 완전히 분리해 단독 실행했을 때도 둘 다 통과했다 — 파일 내 선행
    테스트가 남긴 상태에 기대는 숨은 의존성이 없다. 전역 `afterEach`가 assert 실패 시에도 실행되는 위치에
    있어(try/finally 아닌 훅 레벨) `vi.stubGlobal("EventSource"/"fetch", ...)` 오염이 다음 테스트로 새지
    않는다 — 신규 두 테스트도 이 기존 컨벤션에 올라탈 뿐 별도 격리 부담을 추가하지 않았다.
  - 제안: 없음.

- **[INFO] "동일 flush" resolve 패턴이 이 특정 게이트에 대해 구조적으로 완전한 커버리지 — 코드로 확인**
  - 위치: `use-widget.ts:450-472`(`openStream` 정의 — `closeStream()` 후
    `streamRef.current = client.openStream(...)` 까지 완전히 동기, 내부에 `await` 없음), `:673-674`,
    `:1018-1019`(게이트 직후 `openStream` 호출 — 사이에 microtask 경계 없음).
  - 상세: `openStream`이 순수 동기 콜백이라(내부에 `await`·Promise 없음), 한 continuation 이 게이트
    체크(`if (sessionEstablished()) return;`)를 통과하면 JS 단일 스레드 실행 모델상 다른 continuation 이
    끼어들 틈 없이 `streamRef.current` 대입까지 **한 호흡에** 끝난다 — "체크"와 "행동"이 이 지점에서는
    원자적이다. 따라서 두 competitor 의 상대적 도착 순서는 오직 "누가 먼저 이 동기 블록에 진입하는가"
    하나로 완전히 결정되고, 가능한 결과는 두 가지(C 먼저/D 먼저)뿐이다. 이번에 추가된 대칭 테스트 쌍이
    바로 이 두 가지 경우를 모두 다루므로, "더 촘촘한 interleaving 변형"을 추가로 테스트할 필요가 없다 —
    실제로 `openStream(` 호출부를 전수 검색한 결과 `start()`(674행)·`applyConfig`(1019행) 정확히 2곳뿐이라
    "2-party race, 2 orderings" 모델이 코드와 정확히 일치한다.
  - 제안: 없음(확인 목적). 참고로 `applyConfig`-vs-`applyConfig`(재전송 2회 연속) 이중 오픈은 이 게이트가
    아니라 별도의 boot-축 checkpoint 2(`isAttemptStale`, 1012행)가 담당한다고 코드 주석이 명시하며
    이번 커밋의 diff 범위 밖이라 재검증 대상이 아니다.

- **[INFO] 회귀 스위트 · 정적 검사 재확인 — 커밋 메시지 수치와 일치**
  - 위치: 전체 스위트(`vitest run`), `tsc --noEmit`, `eslint src/widget/use-widget.ts
    src/widget/use-widget-eager-start.test.ts`.
  - 상세: 격리 워크트리에서 `394 passed (394)`(커밋 메시지 "394 passed (companion +1)"과 일치),
    `tsc --noEmit` 무오류, 대상 두 파일 `eslint` 결과 0 error(`use-widget-eager-start.test.ts:657` 의
    `fetchMock` 미사용 경고 1건은 이번 diff 범위 밖의 기존 코드로, `git show 94b66b212` 변경 라인과
    무관함을 확인했다). `start()` 의 `useCallback` deps 배열에 `sessionEstablished` 추가는
    `useCallback(() => streamRef.current !== null, [])`(325행)로 이미 안정 참조라 런타임 동작 변화 없이
    lint 경고만 해소한다 — 위 회귀 수치가 이를 뒷받침한다.
  - 제안: 없음.

---

## 요약

`94b66b212`(직전 02_25_54 라운드가 지적한 "double-stream 테스트가 한 resolve 순서만 재현해 `start()`
게이트만 제거해도 전원 통과" 커버리지 갭의 fix)를 격리 워크트리에서 3방향 mutation testing 으로 직접
검증했다. (1) `start()` 게이트만 제거 시 신규 companion 테스트만 3/3 회 실패, (2) `applyConfig` 게이트만
제거 시 기존 테스트만 3/3 회 실패, (3) 두 게이트 모두 제거 시 둘 다 3/3 회 실패 — 커밋 메시지의 주장과
완전히 일치했고 각 상태를 반복 실행해도 flaky 없음을 확인했다(baseline 5회 포함 전 상태 100% 결정적).
`-t` 필터로 두 신규 테스트를 각각 단독 실행해도 통과해 순서 독립성도 확인했다. resolve 순서를 파라미터로
받는 헬퍼 추출은 기존 테스트의 mock 셋업·시나리오·최종 단언을 문자 그대로 보존해 리팩토링에 의한 의미
변질이 없었다(`tsc` 클린으로 dead-variable 제거도 안전 확인). 나아가 `openStream` 자체가 완전히 동기
콜백이라 게이트 체크와 스트림 오픈 사이에 microtask 경계가 없음을 코드로 확인했는데, 이는 "동일 flush
resolve" 패턴이 이 특정 경합(정확히 2개 호출부, 2가지 순서)에 대해 이미 최대로 촘촘한 시험이며 추가
interleaving 변형이 불필요함을 구조적으로 뒷받침한다. 전체 회귀 스위트(394/394), `tsc`, `eslint` 모두
커밋 메시지 수치와 일치해 재확인했다. 이번 라운드 범위에서 테스트 관점의 신규 CRITICAL·WARNING 은 없다.

## 위험도

NONE
