# 부작용(Side Effect) 리뷰 — webchat-boot-single-flight (02_25_54, 커밋 `77805bd32` 검증 라운드)

## 조사 방법 / payload 한계 고지

`prompt_file`(2466줄)이 담은 diff 는 이번 라운드 실제 타깃 커밋 `77805bd32`(`use-widget.ts` +
`use-widget-eager-start.test.ts`)를 포함하지 않는다 — 실려 있는 건 직전 라운드(01_44_21)의 review
산출물 6건 + `review/consistency/2026/07/17/19_46_54/**` 7건 + `spec/7-channel-web-chat/2-sdk.md`
frontmatter 뿐이다(`### 파일 1~15` 전수 확인, `grep '^### 파일'` 로 목록 산정). 지난 두 라운드와
동형인 payload 대표성 이슈(scope.md 계열의 반복 지적)라 판단해 지시받은 대로 `git show 77805bd32` 로
실제 diff 를 직접 확보해 아래 분석을 수행했다.

**격리 검증**: `git worktree add --detach`(scratchpad 하위, HEAD `262ef8e5b` = 77805bd32 포함 최신)로
전용 워크트리(`isolated-side-effect-review`, 다른 리뷰어의 동시 사용 워크트리 `isolated-concurrency-review`/
`isolated-review-req`/`isolated-testing-review` 와 별도)를 만들어 실측·mutation 테스트를 수행하고,
검증 후 `git worktree remove --force` 로 제거했다(`git status --porcelain`/`git diff --stat` 로 공유
워크트리 무변경 확인 완료 — 최종 상태 `?? review/code/2026/07/18/02_25_54/` 한 줄만 존재).

---

## 검증 1 — 이중 EventSource 가 닫혔는가

`use-widget-eager-start.test.ts` 신규 회귀 테스트("두 복원 seed 가 같은 flush 에서 resolve 해도
EventSource 는 하나만 생성된다")를 격리 워크트리에서 그대로 실행 → **통과**(`esCount===1`). 전체
스위트도 **393 passed**(커밋 메시지 수치와 일치).

**Mutation A**(`use-widget.ts:673`·`:1018` 두 신규 게이트 `if (sessionEstablished()) return;` 을 각각
`// MUTATED-A: ...` 로 무력화, JSDoc 서술은 그대로 둠) 적용 후 전체 스위트 재실행:

```
Test Files  1 failed | 21 passed (22)
     Tests  1 failed | 392 passed (393)
 FAIL  ... 두 복원 seed 가 같은 flush 에서 resolve 해도 EventSource 는 하나만 생성된다
 AssertionError: expected 2 to be 1
```

**정확히 이 1건만** 실패했다(다른 392건 무영향) — 게이트를 제거하면 esCount 가 2 로 돌아가고, 게이트를
복원하면 1 로 닫힌다는 것을 양방향으로 확인했다. 커밋 메시지의 "mutation: 게이트 2곳 제거 → 정확히
double-stream 테스트만 실패" 주장과 완전히 일치. mutation 원복 후 `git diff --stat` 무출력(byte-identical)
확인.

## 검증 2 — 게이트가 scheduleRefresh 등 다른 부작용을 잘못 스킵하지 않는가

두 신규 게이트는 각각 `openStream(...); scheduleRefresh();` 두 줄 **바로 앞**에 놓여 있어, 게이트가
발동(먼저 연 continuation 이 있음 → 후행 continuation 은 여기서 `return`)하면 **후행 쪽의
`openStream` 과 `scheduleRefresh` 를 동시에 스킵**한다. "먼저 연 continuation 이 스트림+refresh 를
소유하고 뒤는 둘 다 스킵" 이라는 지시된 가설을 코드 정독 + 실측 두 단계로 검증했다.

**코드 정독**:
- `scheduleRefresh()`(`use-token-refresh.ts:73-103`)는 인자를 받지 않고 호출 시점의 `sessionRef.current`
  를 그대로 읽는다(+`clearRefreshTimer()` 선행이라 idempotent, 01_44_21 side_effect 리뷰가 이미 확인한
  성질). `start()`(`persist()`, `:617`)와 `applyConfig` 복원 분기(`:992`)는 각각 자기 continuation 의
  **레이스가 시작되기 전에** 이미 동기적으로 `sessionRef.current` 를 세팅해 둔다 — 두 `getStatus` 가
  동시 resolve 하는 구간 동안에는 `sessionRef.current` 에 대한 추가 쓰기가 없다. 따라서 두 게이트 중
  **어느 쪽이 이겨서 `scheduleRefresh()` 를 부르든 동일한 `sessionRef.current` 값**을 읽는다 — "패자의
  세션 데이터가 유실돼 잘못된 만료시각으로 예약된다" 는 걱정은 이 코드 구조상 성립하지 않는다.
- `openStream(session, lastEventId)`(`:450-472`)는 `sessionRef.current` 가 아니라 **호출자의 로컬
  `session`/`saved` 인자**(`.endpoints`/`.token`)를 쓴다. 이번 레이스 시나리오에서 `saved` 는
  `loadSession()` 이 `persist()` 가 방금 쓴 storage 를 그대로 읽은 것이라 `session` 과 내용이 동일하다
  — 승자가 어느 쪽이든 여는 스트림의 endpoint/token 은 같다.
- 게이트~`openStream` 사이에 `await` 가 없다(동기 코드 3줄: 게이트 → `openStream` → `scheduleRefresh`)
  라서, "먼저 실행되는 쪽이 `streamRef.current` 를 동기적으로 채운다 → 뒤 쪽이 그 사실을 놓칠 수 없다"
  는 불변식이 성립한다 — 두 continuation 이 **모두** 게이트를 통과(둘 다 스킵)하거나 **모두** 막히는
  경우는 구조적으로 불가능하고 항상 정확히 1승·1패다.

**실측(신규 PROBE, 격리 워크트리 전용, 검증 후 삭제)**: `probe-schedulerefresh-race.test.ts` 를 작성해
"두 복원 seed 가 같은 flush 에서 resolve 해도 EventSource 는 하나만 생성된다" 테스트와 동일한 레이스
시나리오를 재구성한 뒤 `vi.useFakeTimers({ shouldAdvanceTime: true })` 로 refresh 지연(90분 만료 − 30분
lead = 60분) 너머로 점프해 `/refresh-token` 이 실제로 발화하는지 관측했다:

```
esCount === 1                         (사전 확인 — 이중 스트림 게이트 정상)
advanceTimersByTimeAsync(61분) 후
refreshCallCount >= 1                 → 통과
```

**게이트가 "둘 다 스킵"으로 퇴화하지 않고 승자 1명이 정확히 `scheduleRefresh` 도 함께 소유함을 확인**
했다. 이 probe 가 공허하게 통과하는 게 아님을 별도로 검증하기 위해 **Mutation C**(`scheduleRefresh();`
호출 두 곳을 모두 주석 처리)를 적용해 같은 probe 를 재실행 → `expected 0 to be greater than or equal to
1` 로 **의도대로 실패**함을 확인(probe 의 판별력 확인). mutation 원복 후 `git diff --stat` 무출력 확인.

**결론**: "먼저 연 continuation 이 스트림+refresh 를 소유하고 뒤는 둘 다 스킵" 이라는 단일 소유권
설계는 정확하다 — refresh 예약이 통째로 유실되는 회귀는 없다.

## 검증 3 — 새 부작용 표면이 없는가

`git show 77805bd32`(전체 diff, 위 두 파일 104줄) 를 라인 단위로 재확인 — 신규 전역 변수·환경 변수
read/write·파일시스템 접근·네트워크 호출 대상 변경·공개 API(`useWidget()` 반환 shape) 변경 없음. 두
호출부 모두 **이미 존재하던** `sessionEstablished` 콜백(`:325`, `cffee0d28` 도입, 이번 diff 로 정의
변경 없음)을 한 번 더 부르는 것뿐이라 신규 상태·신규 ref 도입도 없다. 다만 다음 **1건의 실질적인 새
부작용 표면**을 실측으로 발견했다:

- `start()` 의 `useCallback` 의존성 배열(`:685`, `[openStream, persist, seedWaitingFromStatus,
  scheduleRefresh, isStale]`)이 이번 diff 로 새로 추가된 `sessionEstablished()` 호출(`:673`)을 반영하지
  않는다. `npx eslint src/widget/use-widget.ts` 로 실측한 결과:
  ```
  685:6  warning  React Hook useCallback has a missing dependency: 'sessionEstablished'.
                  Either include it or remove the dependency array  react-hooks/exhaustive-deps
  ```
  이 경고가 **이번 커밋이 새로 만든 것**임을 A/B 로 직접 확인했다 — 부모 커밋 `2b4f198c1`(77805bd32
  직전)의 `use-widget.ts` 를 격리 워크트리에 그대로 얹어 동일 명령을 돌리면 **경고 0건**(exit 0, 출력
  없음)이다. `applyConfig` 쪽의 두 번째 신규 호출(`:1018`)은 그 콜백을 감싼 마운트 `useEffect` 자체가
  이미 `// eslint-disable-next-line react-hooks/exhaustive-deps`(`:1084`, 이번 diff 밖 — "마운트 1회.
  핸들러는 ref 기반이라 deps 생략" 이라는 기존 주석과 함께 이전부터 존재)로 억제돼 있어 이쪽은 새
  경고를 만들지 않는다 — 비대칭이 `start()` 한 곳에만 나타난다.
  - **게이트 자체(no-op 아닌지 재확인)**: `pnpm --filter channel-web-chat lint` 가 실제로 호출하는
    `eslint`(플레인, `--max-warnings` 미지정, `.claude/test-stages.sh:46` 확인)는 경고만 있으면 exit 0
    이다 — `npx eslint .` 를 직접 실행해 `✖ 2 problems (0 errors, 2 warnings)` / **`EXIT_CODE=0`** 확인
    (나머지 1건은 `use-widget-eager-start.test.ts:657` 의 `fetchMock` 미사용 변수로, `git blame` 확인
    결과 `b9acf02c77`(2026-06-28)기존 경고 — 이번 커밋과 무관, 오귀속 방지차 병기).
  - **런타임 영향 평가**: `sessionEstablished` 자신은 `useCallback(() => streamRef.current !== null, [])`
    로 의존성 배열이 항상 빈 배열 — 즉 컴포넌트 생애주기 동안 **참조가 절대 바뀌지 않는 안정적
    콜백**이다. 따라서 `start` 의 deps 배열에서 빠졌다고 해서 `start` 가 stale 한 `sessionEstablished`
    참조를 클로저에 가두는 실제 버그로 이어지지는 **않는다**(오늘 시점 — 393/393 그린 + 위 검증 2 의
    probe 로 실제 동작이 기대대로임을 이중 확인). 다만 이건 "우연히 안전"이 아니라 "`sessionEstablished`
    구현이 현재 무의존이기 때문에 안전"이라는 **전제부 의존적** 안전성이다 — 향후 그 함수가 실제
    의존성을 얻게 되면(예: ref 대신 state 를 참조하도록 리팩터) `start` 의 stale 클로저가 조용히
    깨질 잠재 위험이 있다(단, 그 시점에도 같은 eslint 규칙이 여전히 경고를 내므로 "영구히 안 보이는"
    은폐는 아니다).
  - 같은 커밋이 `seedWaitingFromStatus` 의 deps(`:598`, `cffee0d28` 부터 이미 `[finalizeEnded, isStale,
    sessionEstablished]` 로 정확히 갱신돼 있음 — 이번 diff 밖)는 올바르게 갱신해 뒀으면서 `start()` 쪽
    신규 호출만 갱신을 놓친 것은, 이 파일 자신의 JSDoc(`:260-265`)이 스스로 반복 경고해 온 "한
    호출부는 재검증하고 다른 호출부는 빠뜨리는" 비대칭 누락 패턴과 **같은 계열의 작은 재발**이다 —
    이번엔 "가드"가 아니라 "의존성 배열" 이라는 차이만 있다.

다른 부작용 표면(신규 fetch 대상·신규 dispatch 타입·`bridgeRef.current?.sendEvent` 추가 호출·
`console.warn`/`console.error` 신규 경로·시그니처 변경 등)은 diff 에 없음을 라인 단위로 확인했다.
테스트 파일 변경은 파일 끝에 `it()` 블록 1건을 순수 추가한 것뿐이고, 그 안의 `vi.stubGlobal` 사용은
이 파일 기존 관용구와 동일하며 파일 공통 `afterEach`(`:189-195`, `vi.unstubAllGlobals()` +
`vi.restoreAllMocks()`)로 다음 테스트에 새지 않는다.

*(참고, 조치 불필요 — 이번 diff 밖)*: `applyConfig` 복원 분기에서 `openStream(saved, "0")`/
`scheduleRefresh()` 가 `if (clientRef.current) { ... checkpoint 2 ... }` 블록 **밖**(그 블록이 끝난 뒤,
`if (saved) {...}` 블록 안)에 있어, 이론상 `clientRef.current` 가 falsy 였다면 seed/checkpoint 2 를
건너뛰고도 이 두 호출까지는 도달하는 구조다. 그러나 이 중첩 구조는 diff 의 hunk 컨텍스트 라인으로
확인한 결과 **이번 커밋 이전부터 동일**했고(새 게이트는 기존 `openStream`/`scheduleRefresh` 와 같은
스코프에 슬롯되었을 뿐), `openStream` 자신도 `if (!client) return;` 내부 가드가 있어 즉시 no-op 된다 —
이번 라운드가 만들거나 악화시킨 표면이 아니라 별도 감사 대상으로 남긴다.

---

## 발견사항

- **[WARNING]** `start()` useCallback 의존성 배열에 신규 참조 `sessionEstablished` 누락 (eslint
  `react-hooks/exhaustive-deps`, 이번 커밋이 새로 만든 경고 — A/B 로 확인)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:673`(신규 호출) · `:685`(deps 배열,
    미갱신).
  - 상세: 커밋 `77805bd32` 가 `start()` 콜백 본문에 `if (sessionEstablished()) return;` 을 새로
    추가했지만 그 `useCallback` 의 의존성 배열은 갱신하지 않았다. `npx eslint`(부모 커밋에선 경고
    0건 → 이 커밋에서 1건 신규) 로 실측 확인. 오늘 시점 런타임 버그는 아니다(`sessionEstablished` 는
    빈 의존성 배열로 정의돼 참조가 항상 안정적 — 393/393 그린 + 본 리뷰의 독립 probe 로 실동작 정상
    확인) 이며 lint 게이트도 경고만으로는 실패하지 않는다(`eslint` 플레인 호출, `--max-warnings`
    미지정 — `EXIT_CODE=0` 실측). 다만 이 파일 자신이 "비대칭 가드/재검증 누락"을 반복 자평해 온
    바로 그 계열의 작은 재발이며, 형제 호출부(`seedWaitingFromStatus`, 이전 커밋에서 이미 올바르게
    `sessionEstablished` 를 deps 에 반영)와 비교하면 이번 커밋만 갱신을 놓쳤다는 비대칭이 뚜렷하다.
  - 제안: `}, [openStream, persist, seedWaitingFromStatus, scheduleRefresh, isStale]);` →
    `}, [openStream, persist, seedWaitingFromStatus, scheduleRefresh, isStale, sessionEstablished]);`
    한 줄 추가. 기능 변경 없이(참조가 항상 동일하므로 재-메모이제이션 빈도도 실질적으로 안 바뀜)
    lint 경고만 해소되는 저위험·저비용 수정.

- **[정상 확인]** 이중 EventSource 생성 회귀가 실제로 닫혔다 — esCount 2→1, mutation A 로 정확히
  double-stream 테스트 1건만 실패함을 재현
  - 위치: `use-widget.ts:673`(`start()` 게이트), `:1018`(`applyConfig` 복원 게이트),
    `use-widget-eager-start.test.ts:3402`(신규 회귀 테스트).
  - 상세: 검증 1 절 참조. 격리 워크트리 mutation 으로 게이트 제거→재현(392 passed·1 failed,
    `esCount===2`)·게이트 복원→해소(393 passed) 양방향 확인. 다른 392건은 게이트 mutation 에 전혀
    영향받지 않아 blast radius 가 진술("정확히 double-stream 테스트만 실패")과 정확히 일치.
  - 제안: 없음.

- **[정상 확인]** 게이트가 `scheduleRefresh` 를 잘못된 방식으로 스킵하지 않는다 — 단일 소유권(승자가
  `openStream`+`scheduleRefresh` 둘 다 가짐)이 안전하게 성립함을 코드 분석 + 독립 probe 로 이중 확인
  - 위치: `use-widget.ts:673-676`(`start()`), `:1018-1020`(`applyConfig`),
    `use-token-refresh.ts:73-103`(`scheduleRefresh` 구현).
  - 상세: 검증 2 절 참조. `scheduleRefresh()` 가 인자 없이 `sessionRef.current` 를 그때그때 읽는
    idempotent 구조라 "패자가 스킵한 세션 데이터가 유실된다"는 우려가 코드 구조상 성립하지 않고,
    게이트~액션 사이 `await` 가 없어 "둘 다 통과" 또는 "둘 다 막힘" 은 구조적으로 불가능(항상 정확히
    1승 1패)임을 확인했다. 격리 워크트리에서 독립 작성한 fake-timer probe 로 레이스 후에도
    refresh-token 호출이 실제로 발화함(`refreshCallCount>=1`)을 실측했고, `scheduleRefresh()` 자체를
    제거하는 대조 mutation 으로 이 probe 가 그 결함을 실제로 잡아낸다는 판별력도 확인했다.
  - 제안: 없음.

- **[정상 확인]** 새 부작용 표면(신규 전역 변수·환경 변수·파일시스템·네트워크 호출 대상·공개
  API/시그니처 변경) 없음 — 위 WARNING 1건을 제외하면 diff 가 라인 단위로 깨끗함
  - 위치: `git show 77805bd32` 전체(2 파일, 104줄).
  - 상세: 검증 3 절 참조. `sessionEstablished` 는 이미 존재하던 안정 콜백을 재사용할 뿐 새 상태/ref
    도입이 없고, `useWidget()` 의 공개 반환 shape·`seedWaitingFromStatus`/`start`/`applyConfig` 의
    시그니처 모두 이번 diff 로 변경되지 않았다(module-private 유지). 테스트 파일 변경은 파일 끝
    순수 추가 1건, 기존 전역 stub 관용구·공통 `afterEach` 정리 범위 안.
  - 제안: 없음.

## 요약

지시받은 세 검증축 모두 실측으로 확인했다. (1) 01_44_21 side_effect 리뷰가 CRITICAL 로 재현한 이중
EventSource(esCount=2)는 `77805bd32` 의 openStream-직전 짝 게이트로 실제로 닫혔다 — 신규 회귀 테스트
그린, mutation A(게이트 2곳 제거) 시 정확히 그 테스트 1건만 실패(392/393)하고 나머지는 완전 무영향임을
양방향으로 확인했다. (2) "먼저 연 continuation 이 스트림+refresh 를 소유하고 뒤는 둘 다 스킵"이라는
단일 소유권 설계는 안전하다 — `scheduleRefresh()` 가 인자 없이 항상 최신 `sessionRef.current` 를 읽는
idempotent 구조이고 게이트~액션 사이 await 가 없어 "둘 다 스킵"은 구조적으로 불가능함을 코드로 확인했고,
격리 워크트리에서 독립 작성한 fake-timer probe(레이스 후 refresh-token 실제 발화 확인 + 대조 mutation으로
판별력 검증)로 실측까지 재확인했다. (3) 새 부작용 표면은 거의 없으나, `start()` 의 `useCallback` 의존성
배열이 이번 커밋이 새로 추가한 `sessionEstablished()` 호출을 반영하지 않은 채 남아 있다는 것을
`eslint`(A/B 비교로 이번 커밋이 새로 만든 경고임을 확인)로 발견했다 — 오늘 시점 런타임 버그는 아니고
(대상 콜백이 빈 의존성 배열로 항상 안정적) lint 게이트도 경고만으로는 막지 않지만(exit 0 실측), 이 파일
스스로 반복 경계해 온 "한 곳은 갱신, 다른 곳은 누락" 비대칭 패턴의 작은 재발이라 WARNING 으로 기록한다.
제안된 수정은 한 줄 추가로 저위험이다.

## 위험도

LOW — CRITICAL/HIGH 없음. 지시받은 핵심 검증(이중 EventSource 해소, 단일 소유권의 scheduleRefresh
안전성)은 실측으로 견고함이 확인됐고, 새로 발견한 WARNING 1건(`sessionEstablished` deps 누락)은
오늘 시점 런타임 영향이 없고 lint 게이트도 비차단이나, 조치 권장 수준으로 기록한다.

STATUS=success side_effect PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/18/02_25_54/side_effect.md risk=LOW
