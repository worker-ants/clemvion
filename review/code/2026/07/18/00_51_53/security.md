# 보안(Security) 리뷰 — webchat-boot-single-flight (00_51_53, `start()` boot 스냅샷 fix 검증)

## 범위·방법

리뷰 대상은 이번 라운드(orchestrator 지정) 핵심인 커밋 `7cfbf2557`(`fix(web-chat): start() 의 지연
seed 도 boot 축으로 보호 — 세번째 되감기 경로`)와 그 정합 후속 커밋(`a2cd6ebb7`·`e62530291`·
`213561c3f`·`5eed8cf96`, 문서/테스트 정합·검증 로그 갱신뿐)이다.

- `git merge-base origin/main HEAD` = `29aa918a6` — 전체 diff 는 payload 와 일치(41파일, 코드는
  5파일: `CHANGELOG.md`/`widget-state.ts`/`widget-state.test.ts`/`use-widget.ts`/
  `use-widget-eager-start.test.ts`).
- 직전 보안 리뷰 라운드(`23_58_23`, 이 워크트리의 `review/code/2026/07/17/23_58_23/security.md`)가
  이미 검증한 부분(A-6 되돌림의 stale 토큰 4겹 경계, `apiBase` 축 이월)은 **재검토하지 않고**, 그
  라운드의 코드 기준점(`3f55ee000`, concurrency.md 가 pin 한 격리 worktree HEAD)부터 현재 HEAD 까지의
  **순수 델타**(`git diff 3f55ee000..HEAD -- codebase/ spec/`)만 별도로 대조했다. 결과: `use-widget.ts`
  (+27/-14)·`use-widget-eager-start.test.ts`(+118/0) **2파일만** 변경 — 이는 `git show 7cfbf2557`
  전문과 바이트 단위로 일치함을 직접 확인했다.

### 방법론 메모 — 리뷰 중 관측된 비-커밋 변형(발견사항 아님)

검토 도중 `git status`가 일시적으로 `use-widget.ts`/`use-widget-eager-start.test.ts` 두 파일의
**미스테이징 수정**을 보고한 적이 있다(정확히 `seedWaitingFromStatus(client, session, { boot:
bootAtStart })` → `seedWaitingFromStatus(client, session)`로 이번 fix 의 인자를 제거하는 형태 —
RESOLUTION.md 가 기술한 "mutation: 그 인자 제거 → 정확히 신규 테스트만 실패" 매트릭스와 정확히
일치). 재확인 시 워킹트리는 다시 깨끗했다(`git diff HEAD` 무변경). 이는 이 저장소가 기존에
문서화한 "공유 worktree 동시편집" 패턴(사용자 메모리 `ai-review flaky 측정 아티팩트`)과 부합한다 —
같은 라운드의 다른 sub-agent(concurrency/testing 등)가 공유 워크트리에서 mutation-kill 검증을
수행하며 파일을 일시적으로 mutate 했다가 되돌린 것으로 판단된다. **이 관측은 보안 결함이 아니며
본 리뷰의 근거로 쓰지 않았다** — 모든 판단은 `git show`/`git diff <commit>` 로 조회한 **커밋된
상태**(HEAD)를 기준으로 했다.

---

## 발견사항

- **[INFO] (핵심 확인 1) 커밋 `7cfbf2557` 는 신규 인증/토큰/네트워크 표면을 만들지 않는다 — 순수 in-memory 정수 카운터 가드**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:161-182`(`worldGenRef`/`bootGenRef`
    선언, 둘 다 `useRef(0)`), `:277-279`(`beginBootAttempt`), `:290-292`(`cannotApplyConfig` —
    `unmountedRef.current || bootGenRef.current !== attempt.boot`), `:520-581`
    (`seedWaitingFromStatus`, 신규 3번째 인자 `attempt?: { boot: number }`), `:612-666`(`start()`,
    신규 `const bootAtStart = bootGenRef.current;`), `codebase/channel-web-chat/src/lib/
    eia-client.ts:94`(`getStatus(endpoints: InteractionEndpoints, token: string)`).
  - 상세: `bootGenRef`/`worldGenRef`는 렌더 사이 유지되는 순수 `number` ref(0에서 시작, 로컬
    증가만)이고 `bootAtStart`/`attempt`는 그 값을 읽기전용으로 복사한 것뿐이다. 이 값은 (1)
    `sessionStorage`/`localStorage`에 저장되지 않는다(`session-store.ts`가 이번 라운드 diff 에
    없음 — 아래 확인 2), (2) 네트워크로 전송되지 않는다 — `seedWaitingFromStatus`가 실제로 호출하는
    `client.getStatus(session.endpoints, session.token)`의 시그니처를 직접 확인했고 `attempt`/
    `boot` 파라미터를 받지 않는다(요청 페이로드·쿼리·헤더 어디에도 실리지 않음), (3) 로그에
    남지 않는다(`console.warn`은 `err.message`만 남기고 이 값을 참조하지 않음, catch 블록은 이번
    diff 미변경). 즉 `attempt`는 클라이언트 내부 "이 seed 가 아직 최신 부팅 시도에 속하는가"를
    판별하는 **동시성 게이팅 값**일 뿐, 인증·세션 식별·재사용 가능한 자격증명과는 축이 완전히
    분리돼 있다. 타입도 `{ boot: number }`로 좁게 고정돼 있어(`any`/객체 spread 없음) 실수로 세션
    객체 전체를 실어 나를 여지도 없다.
  - 제안: 없음(확인 목적).

- **[INFO] (핵심 확인 1 연장) 종료 확정 경로는 이번 fix 로 변경되지 않아, 토큰 정리(teardown) 타이밍에 부작용이 없다**
  - 위치: `use-widget.ts:538-546`(`seedWaitingFromStatus`의 terminal 분기 — `attempt`/`boot`를
    참조하지 않고 `finalizeEnded` 호출), `:550`(WAITING 표면 갱신 분기에만 `attempt &&
    cannotApplyConfig(attempt)` 게이팅).
  - 상세: `start()`가 넘기는 `bootAtStart`는 **WAITING 표면 dispatch만** 게이팅하고, 같은 함수의
    종료 확정(`finalizeEnded` → `teardownSession()` → storage/스트림/타이머 정리) 분기는 여전히
    `attempt`를 보지 않는다(world 축 공통 게이트만). 즉 `start()`의 지연 seed 가 "이미 종료됨"을
    발견하면 — 그 seed 가 boot 축으로 보면 superseded 상태여도 — 종료 확정과 그에 따른 storage
    정리는 그대로 수행된다. 이 fix 가 토큰이 sessionStorage 에 더 오래 남는 방향으로 작용할
    가능성은 없다(오히려 종료 발견 시 정리 경로는 그대로 살아있다).
  - 제안: 없음.

- **[INFO] (핵심 확인 2) 직전 라운드(`23_58_23`)의 "A-6 되돌림 stale 토큰 4겹 경계 안전" 결론은 이번 fix 로 바뀌지 않는다**
  - 위치: `git diff 3f55ee000..HEAD -- codebase/ spec/` (변경 파일 목록), `use-widget.ts:668-697`
    (`sendCommand`, A-6 되돌림이 위치한 비-410 catch 분기 — 이번 diff 범위 밖).
  - 상세: `23_58_23/security.md`가 검증한 "비-410 명령 실패 후 sessionStorage 토큰 잔존"·"ended
    UI + 살아있는 세션 straddle"·"§3.1-3 정리 조건 정합" 세 항목은 전부 `sendCommand`의 catch
    분기(`:668-697`)와 `widget-state.ts`의 `RESTORED`/`BOOTED` 가드 부재를 근거로 한다. 이번
    커밋(`7cfbf2557`)은 `seedWaitingFromStatus`와 `start()`만 건드리고 `sendCommand`·
    `widget-state.ts`는 **한 글자도 변경하지 않았다** — `git diff 3f55ee000..HEAD --stat`로 직접
    확인했다(`widget-state.ts` 자체가 변경 파일 목록에 없음). 따라서 그 결론(TTL 자동폐기·
    per_execution scope·탭종료·idle-reaper 4겹 경계가 여전히 유효, 새 노출면 없음)은 그대로
    유지된다.
  - 제안: 없음(재확인만, 조치 불요).

- **[INFO] (핵심 확인 2 연장) `apiBase` 축 이월(선행 결함) 결론도 이번 fix 로 악화되지 않는다**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts`의 `establishConfig`(`apiBase`로
    `clientRef` 재구성하는 함수), `codebase/channel-web-chat/src/lib/session-store.ts`
    (`PersistedSession` shape), `codebase/channel-web-chat/src/widget/use-token-refresh.ts`
    (타이머 재조합) — 셋 다 `3f55ee000..HEAD` diff 에 파일명 자체가 등장하지 않음.
  - 상세: `23_58_23/security.md`가 "선행 결함(이번 diff 무관)"으로 이월 처리한 `apiBase` 축 분리는
    발급 `apiBase`를 세션이 기억하지 않는 구조적 문제이며, 관여 파일 3개가 이번 라운드에도 여전히
    diff 밖이다. `7cfbf2557`이 건드리는 것은 `bootGenRef`(부팅 세대 카운터)뿐이고 `clientRef`/
    `apiBase` 재구성 로직에는 관여하지 않는다 — 축이 서로 직교한다. 이월 판단은 유효하게 유지된다.
  - 제안: 없음(별도 트랙에서 처리 예정, 본 fix 와 무관).

- **[INFO] (핵심 확인 3) `start()`가 boot 스냅샷을 넘겨 지연 seed 를 스킵하는 것은 세션/토큰 노출을 늘리지 않는다 — 오히려 중복 스트림 표면을 줄인다**
  - 위치: `use-widget.ts:628`(`bootAtStart` 캡처), `:651`(`seedWaitingFromStatus(client, session, {
    boot: bootAtStart })` 호출), `:652-655`(`outcome !== "continue"` 조기 return 이 후속
    `openStream`/`scheduleRefresh`까지 건너뛰게 함).
  - 상세: fix 이전 결함은 "대체된 재전송이 이미 선점한 세션에 대해 `start()`의 지연 응답이 **두
    번째 `EventSource`를 여는 것**"이었다(concurrency.md 재현: `esCount` 1→2). 두 스트림 모두
    **같은 세션의 같은 토큰**을 쓰므로 이 자체가 자격증명 유출은 아니지만, 의도치 않은 중복
    연결·의도치 않은 재구독은 세션 리소스 위생 관점에서 바람직하지 않다. 이번 fix 는 그 두 번째
    `openStream` 호출 자체를 원천 차단한다(`outcome`이 `"stale"`이 되어 조기 return) — 즉 **넷 사용
    표면이 줄어드는 방향**이지 늘어나는 방향이 아니다. `bootAtStart`가 어떤 새 엔드포인트·헤더·
    쿼리 파라미터도 추가하지 않으므로 "새 네트워크 표면"에 해당하지 않는다.
  - 제안: 없음.

- **[INFO] 표준 체크리스트(인젝션·하드코딩 시크릿·암호화·에러 노출·의존성) — 이번 델타 범위에서 이상 없음**
  - 위치: `3f55ee000..HEAD`의 `codebase/`·`spec/` 전체 diff.
  - 상세: (1) 인젝션 — `dangerouslySetInnerHTML`/`innerHTML`/`eval(`/`new Function(`/`exec(`/
    `child_process` 패턴 grep 결과 0건(신규 코드는 상태기계·ref 카운터 조작뿐, DOM/SQL/커맨드
    실행 경로 없음). (2) 하드코딩 시크릿 — `password|secret|api[_-]?key|authorization|bearer|
    private[_-]?key|BEGIN (RSA|PRIVATE)` 및 `token\s*[:=]\s*"..."` 패턴 grep 결과 0건. 신규
    테스트의 `"iext_x"`는 기존 스위트와 동일한 명백한 가짜 토큰 리터럴(`webhook202`/`waitingAt`
    헬퍼 안, 실제 자격증명 패턴과 무관). (3) 암호화 — 해시/암호화 로직 변경 없음. (4) 에러 처리 —
    `seedWaitingFromStatus`의 catch 블록(`console.warn` + soft-fail)은 이번 diff 로 변경되지
    않았고, `err.message`만 로그에 남기며 UI 로는 노출되지 않는 기존 계약이 그대로 유지된다.
    (5) 의존성 — `package.json`/lockfile 변경 없음(`git diff --stat -- '**/package.json'
    '**/*.lock' pnpm-lock.yaml` 결과 공백).
  - 제안: 없음.

---

## 요약

이번 라운드 핵심인 커밋 `7cfbf2557`(`start()`의 지연 seed를 boot 세대 읽기전용 스냅샷으로 게이팅)은
**순수 클라이언트 동시성 가드**다 — `bootGenRef`/`bootAtStart`는 저장·전송·로깅되지 않는 in-memory
정수 카운터이고, 실제로 네트워크로 나가는 `client.getStatus(endpoints, token)` 호출 시그니처를 직접
대조해 이 값이 요청에 실리지 않음을 확인했다. 종료 확정(storage/토큰 정리) 분기는 이 fix 로 변경되지
않아 정리 타이밍에도 부작용이 없다. 이번 fix 가 만지는 파일은 `use-widget.ts`·
`use-widget-eager-start.test.ts` 둘뿐이며, 직전(`23_58_23`) 보안 리뷰가 격리 worktree 실측으로
확인한 두 결론 — **A-6 되돌림의 stale 토큰 4겹 경계(scope/TTL/탭종료/idle-reaper) 안전**과
**`apiBase` 축 분리는 선행 결함이며 악화되지 않음** — 은 그 근거 파일(`sendCommand`,
`widget-state.ts`, `establishConfig`, `session-store.ts`, `use-token-refresh.ts`)이 이번 델타에
전혀 포함되지 않아 그대로 유지된다. 오히려 이 fix 는 되감김 버그가 열던 "두 번째 `EventSource`"
중복 연결을 차단해 세션 리소스 노출 표면을 줄이는 방향으로 작용한다. 표준 체크리스트(인젝션·
시크릿·암호화·에러 노출·의존성)도 이번 델타에서 이상 없음을 확인했다. 검토 중 공유 워크트리에서
일시적인 비-커밋 mutation(다른 sub-agent 의 kill-test 로 추정)이 관측됐으나 재확인 시 해소됐고,
본 리뷰의 모든 판단은 `git show`/`git diff <commit>` 로 조회한 커밋된 HEAD 상태를 근거로 했다.
신규 CRITICAL·WARNING 없음.

## 위험도

LOW
