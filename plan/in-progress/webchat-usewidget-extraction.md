---
worktree: spec-small-followups
started: 2026-07-18
owner: developer
status: in-progress
---

> _(2026-08-10)_ `worktree:` 를 `webchat-session-generations-ca88ae` → `spec-small-followups`
> 로 갱신했다. 앞 값은 **1차 slice 시절의 워크트리**라 stale 이었고, 그 탓에 plan 게이트가
> 이 브랜치를 엉뚱한 plan(`typescript-toolchain-followups`, 같은 워크트리를 선언 중)에
> 연결했다. 이 필드는 "이 작업이 **어느 워크트리에서** 진행되는가" 이므로 현재 값이 사실이다.
> (게이트는 한 워크트리의 여러 plan 중 **하나만 처리돼도** 통과하도록 설계돼 있다.)

> **1차 slice 완료 (2026-07-24)** — 사용자 결정으로 **staleness 축만 먼저** 분리했다
> (`useSessionGenerations`). 전체 추출은 열려 있다. §1차 slice 참고.

# 웹채팅 위젯: `useWidget()` 세션 로직 `useEiaSession` 분리

**상태**: 1차 slice(staleness 축) 완료 — §1차 slice 참고. 나머지 슬라이스는 미착수.
리팩토링 백로그. 기능 변경 없음.

이 항목은 [`webchat-boot-single-flight.md`](../complete/webchat-boot-single-flight.md)(이동 완료)의 산문 이월에서 분리했다 — 그쪽에
산문으로만 두면 plan 완료 이동 시 함께 묻힌다(형제 항목 `webchat-command-failure-is-not-termination.md`
와 같은 처분. `--impl-done` 23_58_23 maintainability WARNING 이 이 항목만 노출돼 있음을 지적).

## 배경

`codebase/channel-web-chat/src/widget/use-widget.ts` 의 `useWidget()` 훅이 계속 커진다 —
merge-base 877줄 → 이 PR 후 ~1070줄(세 라운드 fix 로 누적 증가). `useCallback` 26개·`useRef` 13개,
eslint 에 `max-lines`/`complexity` 가드 없음.

이 파일은 **거울상 결함이 반복된 자리**다 — boot/world/unmount staleness 축 관련으로 이 클래스에서
9번(23_58_23 기준) 서로 반대편 구멍을 냈다. 즉 규모 자체보다 **세션 라이프사이클 로직의 응집도 부족**이
반복 결함의 온상이라는 게 분리의 진짜 근거다(단순 줄 수가 아니라).

## 무엇을 분리하나

세션 확립·복원·staleness 판정 묶음을 `useEiaSession`(가칭) 커스텀 훅으로 추출:
- `worldGenRef`/`bootGenRef`/`unmountedRef` + predicate(`isStale`/`beginBootAttempt`/`cannotApplyConfig`/
  `isAttemptStale`/`sessionEstablished`)
- `establishConfig`/`applyConfig`/`start`/`seedWaitingFromStatus`/`sendCommand`/`teardownSession`
- `openStream`/`closeStream`/토큰 갱신 배선

`useWidget()` 은 reducer 배선 + host bridge + 프레젠테이션 상태만 남긴다.

## 선행 판단 (착수 전 확인)

- **축이 몇 개인가**: `webchat-boot-single-flight.md:129` 의 "가드가 하나로 정리된 지금이 적기" 전제는
  `bootGenRef` 신설로 되돌려졌다(축 2개). A-0 토큰 캡슐화를 채택하면 호출부가 보는 축은 다시 1개가 되나,
  현재는 `applyConfig`/`start` 가 `{world, boot}` 토큰을 직접 다룬다. 분리 시 이 토큰 타입을 훅 경계의
  공개 계약으로 삼을지 결정 필요.
- **JSDoc 인접성 취약성**(23_58_23 documentation): 이 파일에서 ref 선언 사이에 다른 선언이 끼면 JSDoc 이
  유실되는 버그가 2회 재발했다. 현재 방어가 "경고 주석"뿐이라, 분리하면서 `ts.getJSDocCommentsAndTags()`
  기반 lint/test 가드로 승격하는 것을 함께 검토.

## 체크리스트

- [~] `useEiaSession` 훅 추출 — **1차 slice 만 완료**. staleness 축(`worldGenRef`·`bootGenRef`·
      `unmountedRef` + `isStale`·`beginBootAttempt`·`cannotApplyConfig`·`isAttemptStale`)을
      `useSessionGenerations` 로 분리. **나머지**(`establishConfig`/`applyConfig`/`start`/
      `seedWaitingFromStatus`/`sendCommand`/`teardownSession`/스트림·토큰 배선)는 미착수.
- [x] 기존 테스트 전원 통과 유지 + 훅 단위 테스트 신설 — 착수 시점 400 → **409**
      (신규 훅 단위 8 + 구성 지점 참조 안정성 1), e2e 259 PASS. 기능 무변경.
- [x] JSDoc 인접성 구조적 가드 검토(경고 주석 → lint/test) — **가드 불필요로 결론**.
      1차 slice 의 전용 파일 분리가 위험 자체를 없앴다(§1차 slice §부수 효과 참고).
- [x] **seed 게이트 + openStream 게이트 짝의 구조적 강제 — 완료 (2026-08-10)**
      (ai-review 02_25_54 maintainability). 종전엔 `sessionEstablished()` 스트림 게이트가
      `start()`·`applyConfig` 두 호출부의 **손으로 복제한 3줄**이었다. 3번째 seed→openStream
      경로가 생기면 이 파일이 반복한 "비대칭 가드 누락" 이 재발할 자리였다.

      **훅 추출을 기다리지 않고 지금 닫았다** — 게이트를 `openStream` **안**으로 옮기면
      되고, 그건 나머지 slice(§토큰 타입을 공개 계약으로 삼을지)의 미결 결정과 무관하다.

      **반환은 명명 union `StreamClaim`**(`"opened"`/`"already_owned"`/`"no_client"`)이고
      호출부는 `if (claim !== "opened" && claim !== "no_client") return;` **부정 비교**로
      게이팅한다 — 향후 "중단이어야 하는" 결과가 늘어도 기본값이 중단이다(fail-closed).
      > 이 자리에 처음엔 긍정 비교(`=== "already_owned"`)를 적었고, 리뷰가 그것이
      > **fail-open** 임을 지적했다(`12_48_08` maintainability). 형제 `SeedOutcome` 이
      > `!== "continue"` 부정 비교인데 선례를 인용해 놓고 관용구는 반대로 쓴 것이다.
      > 코드는 `bf8d71802` 에서 고쳤으나 **이 문서는 그 커밋에서 빠졌다**(`13_29_35`
      > documentation WARNING).
      처음엔 `boolean` 으로 썼다가 리뷰가 **이 파일이 `SeedOutcome` 으로 이미 배운 교훈**을
      되돌린 것이라고 지적했다 — boolean 이면 "실제로 열었다" 와 "열 게 없어 통과시켰다
      (client 미확립)" 가 같은 `true` 로 뭉개진다. `SeedOutcome` 도입 근거가 정확히 그
      문장이다("정상 시드"와 "stale 폐기"가 같은 `false` 로 뭉개져 호출부가 구분 불가).
      선례를 따라 union 으로 승격했고, 그 덕에 `"no_client"` 가 중단이 아닌 것이 **문서가
      아니라 타입으로** 드러난다.

      `"no_client"` 가 진행인 것은 **동작 보존**이다 — 종전 호출부는 client 가 없어도
      `scheduleRefresh()` 를 그대로 실행했다. 첫 판(`boolean`)에서 그 경로를 `false` 로
      썼다가 뮤테이션이 조용한 동작 변경을 드러내 고쳤다.

      뮤테이션 — **소유권 게이트 제거는 RED**(이중 EventSource 회귀 2건이 양방향으로 잡는다).
      나머지 2종(`"no_client"`→`"already_owned"`, 호출부가 결과를 무시)은 **생존하나 동등
      뮤턴트**다: `scheduleRefresh` 가 `clearRefreshTimer()` 로 시작하는 **멱등** 함수라 두 번
      불러도 관측 차이가 없고, no-client 상태로 openStream 에 도달하는 경로는 실 사용에서
      나오지 않는다(실측). **관측 불가한 것에 테스트를 만들면 vacuous 해지므로 만들지 않았다** —
      대신 union 타입이 그 구분을 컴파일 시점에 드러낸다.

      기능 무변경 — 위젯 23파일 409건 통과, `tsc --noEmit` 0 errors.
      회귀 테스트 주석도 함께 갱신했다(옛 "호출부 양쪽 게이트" 서술 → "openStream 내부 단일
      게이트"). 이 저장소가 주석 drift 로 반복 결함을 낸 이력이 있어 미루지 않았다.
- [ ] `/consistency-check --impl-done spec/7-channel-web-chat/` 통과
</content>


## 1차 slice — staleness 축 분리 (2026-07-24)

### 왜 이 묶음인가

티켓의 분리 근거는 규모가 아니라 **"세션 라이프사이클 응집도 부족이 반복 결함의 온상"** 이다.
그렇다면 가치는 줄 수가 아니라 **그 축의 응집도**에 있다. staleness 축은 이 파일이 9번 서로
반대편 구멍을 낸 바로 그 자리이면서, 세 ref 와 네 판정자가 서로만 참조하는 **닫힌 묶음**이라
경계가 명확하다(blast radius 최소). 1116 → **1009줄**.

> **정정(리뷰 후)**: 최초 커밋의 "1117 → 1012줄" 은 **틀렸다**. 그때 파일에 `prettier --write`
> 를 함께 돌려 재포맷 분이 감소분을 상쇄해 실제로는 1116 → **1118줄**(증가)이었고, 내가 적은
> 수치는 어느 시점의 실측도 아니었다. documentation reviewer 가 실측으로 잡았다.
> 재포맷을 되돌린 지금이 진짜 구조 변경분이다 — 1116 → **1009줄**, diff 328줄 → **133줄**
> (`wc -l` · `git diff --numstat` 실측).
>
> **2차 정정**: 위 정정에 처음 적은 "1002줄 / diff 125줄" 도 틀렸다. 재구성 스크립트에서
> `len(out)`(리스트 **원소** 수)을 셌는데 구조분해 블록이 8줄짜리 원소 **1개**여서 7줄이
> 미계상됐고, diff 는 그 뒤 deps 편집 전에 잰 값이었다. 즉 두 번 다 "실측했다" 면서 **실제
> 수량이 아닌 프록시를, 최종 상태가 아닌 중간 상태에서** 쟀다. 교훈은 "다시 재라" 가 아니라
> **문서에 쓰는 그 시점에, 프록시가 아닌 `wc -l`/`numstat` 으로 잰다** 는 것.

### 경계 판정 — `sessionEstablished()` 는 **제외**했다

티켓은 이것도 추출 대상으로 열거했으나 제외한다. 그것은 `streamRef.current !== null` 이라
**세대 축이 아니고**, `beginBootAttempt` JSDoc 이 *"boot 세대는 그 proxy 였고 **두 번 구멍이
났다**"* 고 못박은 바로 그 혼동이다(18_39_11 함수 경계 / 00_51_53 no-op 재전송 고착).
같이 묶으면 파일 이력이 분리하라고 말하는 두 축을 다시 합치게 된다.

### 부수 효과 — JSDoc 인접성 위험이 구조적으로 해소됐다

체크리스트의 "JSDoc 인접성 구조적 가드 검토" 는 **가드를 만들 필요 없이** 해소됐다: 원본에서
선언 사이에 다른 ref 를 끼워 넣어 주석이 유실된 사고가 두 번 있었고(`pendingResetRef`→
`bootGenRef`, `bootGenRef`→`unmountedRef`) 방어가 경고 주석뿐이었는데, 전용 파일로 옮기면
**끼어들 것이 구조적으로 없다**. lint 가드보다 나은 해법이라 별도 가드는 만들지 않는다.

### mutation 검증

`cannotApplyConfig` 가 world 도 보게 만드는 뮤턴트(= 17_36_57 concurrency CRITICAL 재주입) →
축 분리 테스트 **2건 RED**. 두 판정자가 같은 입력에서 갈리는 것을 직접 겨눈 테스트라, 통합
테스트가 다른 이유로 통과하는 경우를 배제한다.

### spec 증거 포인터 drift — planner 위임

§3(재전송) 정본이 `use-widget.ts` → `use-session-generations.ts` 로 옮겨졌는데 `2-sdk.md` 의
`code:` 는 여전히 옛 파일만 가리킨다. `spec-code-paths` 는 "1개 이상 매치" 만 보므로 **CI 가
통과시킨다** — consistency checker 가 유일한 그물이었다. `developer` 는 `spec/` 쓰기 권한이
없어 제안만 남긴다: [`spec-update-webchat-evidence-pointers.md`](spec-update-webchat-evidence-pointers.md).

### 리뷰 후속 — 쓰기 측 캡슐화는 다음 slice 로

읽기(판정자 4개)는 함수로 캡슐화됐지만 **쓰기**(world 무효화·unmount 플래그)는 raw ref 로
노출돼 `use-widget.ts` 3곳이 `.current` 를 직접 mutate 한다. "무효화 지점은 셋뿐" 이라는
불변식이 JSDoc 규율에만 기대고 모듈 인터페이스가 강제하지 못한다(architecture W2 ·
security/maintainability 가 같은 지점을 INFO 로 확인).

이번 slice 에서 닫지 않는다 — `invalidateWorld()`/`markUnmounted()` 를 도입하려면 세 호출부의
호출 맥락(특히 `teardownSession` 이 config 확립 전엔 세대를 **올리면 안 되는** 조건)을 같이
옮겨야 하는데, 그건 다음 slice 가 가져갈 `teardownSession`/`start` 본체와 붙어 있다. 지금
쪼개면 인터페이스를 두 번 바꾸게 된다.

- [ ] **(다음 slice)** `invalidateWorld()`/`markUnmounted()` 로 쓰기 측 대칭 캡슐화, raw ref 내부화

### 남은 slice (미착수)

`establishConfig`/`applyConfig`/`start`/`seedWaitingFromStatus`/`sendCommand`/`teardownSession` +
스트림·토큰 배선. 착수 전 §선행 판단의 "토큰 타입을 훅 경계의 공개 계약으로 삼을지" 를
다시 판정할 것 — 1차 slice 가 `BootAttempt` 를 export 했으므로 그 결정의 일부는 이미 내려졌다.

> **순서 주의 — [`webchat-reload-rest-error-branches.md`](../complete/webchat-reload-rest-error-branches.md)
> 와 같은 함수를 건드린다.** 그쪽은 `seedWaitingFromStatus` 의 `catch` 에 `404`·`401` 분기를
> 넣는 작업이고(현재는 상태코드 구분 없는 soft-fail), 이 slice 는 그 함수를 훅으로 **추출**한다.
> 추출이 먼저면 분기는 새 훅 안에 들어간다. 어느 쪽을 먼저 하든 나중 것이 앞선 것의 결과 위에서
> 재판정돼야 한다.
