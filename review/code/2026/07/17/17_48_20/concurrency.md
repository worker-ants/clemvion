# 동시성(Concurrency) 리뷰 — webchat-boot-single-flight (2026-07-17 17_48_20)

## 검증 방법 및 중요 경위

- prompt_file 의 diff 33개 파일을 전수 확인한 결과, 이 브랜치(HEAD)가 실제로 만든 변경은 **4개뿐**임을 git 으로 실측했다 — 아래 "스코프 노트" 참조.
- 그 4개는 diff hunk 가 아니라 **현재 파일 전문**을 Read 해 문맥 전체를 파악했고, 이전 두 라운드(`13_03_59`, `14_30_15`) 의 `concurrency.md`·`RESOLUTION.md` 전문 및 `plan/in-progress/webchat-boot-single-flight.md` 를 읽어 이 파일의 4라운드 회귀 이력과 이번 PR 의 `bootGenRef` 가 과거 두 라운드 어느 쪽도 검증한 적 없는 **신규 메커니즘**(구설계는 `pendingResetRef` 소유권 폐기용으로 13_03_59 에서 결함이 발견돼 전면 폐기, 신설계는 `applyConfig` 시도 대체/§106 용으로 이번 PR 이 재도입)임을 확인하고 처음부터 독립 검증했다.
- **작업 도중 이 공유 워크트리가 다른 프로세스에 의해 실시간으로 편집되고 있음을 발견했다.** 리뷰를 마무리하던 시점 `git status` 에서 `use-widget.ts`/`widget-state.ts`/`use-widget-eager-start.test.ts`/`CHANGELOG.md` 가 변경돼 있었다. 원인을 추적한 결과, **병렬로 진행된 별도 세션 `review/code/2026/07/17/17_36_57/`(같은 diff 를 대상으로 한 별개 concurrency 리뷰)가 CRITICAL 을 발견해 격리 워크트리에서 실측 재현했고, developer/resolution-applier 가 그 fix 를 적용해 최종적으로 커밋(`b1bef8633 fix(web-chat): 리뷰가 찾은 CRITICAL 3건...`, 커밋 메시지가 `ai-review 17_36_57/17_48_20 (8인) 반영` 이라고 명시)했음**을 확인했다. 나는 코드를 전혀 수정하지 않았다(Read/Bash(읽기 전용)/Write(이 output_file) 만 사용) — 이 발견은 순수 관찰이다.
- `17_36_57/concurrency.md` 전문을 읽고, 그 CRITICAL 이 제시한 실행 경로를 **내 스스로 코드를 재추적해 독립적으로 재확인**했다(아래 CRITICAL 항목의 5단계 trace 참조 — 복붙이 아니라 직접 재구성). 그 결과 나 역시 같은 결론(CRITICAL, §106 위반, 실제로 도달 가능)에 도달했다.
- `git show --stat b1bef8633`/`git diff` 로 fix 커밋의 내용을 읽어, 그것이 이 CRITICAL 을 올바르게 겨냥하는지 정적으로 검증했다(테스트를 직접 실행해 재검증하지는 않았다 — 다른 프로세스가 같은 워크트리를 동시 편집 중이던 시점이라 vitest 실행으로 인한 간섭을 피했다. 이는 명시적 한계다).
- `host-bridge.ts` 의 `onBoot` 배선을 확인해 "진입 순서 = 도착 순서" 전제(질의 4 답변의 근거)가 `postMessage`/`message` 이벤트의 매크로태스크 직렬 처리에 근거함을 검증했다.

## 스코프 노트 — 리뷰 대상 재정의 (중요)

- **[INFO]** prompt_file 의 33개 파일 중 29개는 이 브랜치의 변경이 아니라 **미리베이스 브랜치의 diff 생성 아티팩트**
  - 위치: 파일 1~12·17~21·23~33 (`.claude/_shared/**`, `review_guard.py`, 두 orchestrator, `harness-checks.yml`, sidebar 테스트 3개, `plan/complete↔in-progress/harness-report-contract-followups.md`, `review/code/2026/07/17/15_48_02/**` 등)
  - 상세: `git log HEAD..origin/main --oneline` = `67871ffbd fix(harness): report-path 규칙을 공유 모듈로... (#966)` 단 1건(2026-07-17 17:47:29 병합). `git ls-tree -r HEAD --name-only | grep report_paths` = 0건인 반면 `git ls-tree -r origin/main` 에는 존재 — 즉 이 파일들은 **이 브랜치가 지운 게 아니라 애초에 만든 적이 없다**. 이 review 세션(17_48_20)은 PR #966 병합 51초 뒤 생성됐는데, 이 브랜치(`14bc86a53`에서 분기)가 그 위로 리베이스되지 않은 채 두 트리를 직접 비교하는 방식으로 diff 가 만들어져, origin/main 전용 커밋의 추가분이 HEAD 기준 "삭제"로 반전 표시됐다. `git log origin/main..HEAD --oneline` 으로 확인한 이 브랜치의 원래 커밋은 4개였다: `1e0de3e5b`(plan)·`68ff69ba7`(feat: single-flight)·`b8ea32b63`(refactor: establishConfig 추출)·`215cd1c3f`(fix: ERROR 부활 방지) — 이후 아래 CRITICAL fix 커밋 `b1bef8633` 이 추가됐다.
  - 해당 29개 파일은 실제 변경이었다 해도 순수 동기 단일 프로세스 Python/YAML/MD/JSON(threading·asyncio·lock 미사용, 직접 훑어 확인)이라 동시성 위험도는 어차피 NONE 이다. 아래 모든 발견사항은 실제 이 브랜치의 변경분(`widget-state.ts`/`.test.ts`, `use-widget.ts`, `use-widget-eager-start.test.ts`, plan)에만 해당한다.
  - 제안: SUMMARY 집계 시 이 스코프 재정의를 반영할 것. 가능하면 `origin/main` 리베이스 후 diff 재생성 권고(이 PR 자체를 막을 사유는 아님).

## 발견사항

- **[CRITICAL — 커밋 `b1bef8633` 으로 수정 완료된 것으로 관찰됨]** 대체된(boot-stale) 부팅이 복원 분기에서 "이미 종료됨"을 발견하면, 그 정당한 world 무효화가 **아직 살아있는 진짜 마지막 부팅까지 함께 죽여 §106 을 위반**한다 (질의 1·4 의 반증 성공)
  - 위치(리뷰 시작 시점 코드 기준): `use-widget.ts:445-499`(`seedWaitingFromStatus`, 당시 `:458`·`:464-467` terminal 분기) · `:282-316`(`teardownSession`, `:312` world bump) · `:829-873`(`applyConfig`, 복원 분기) · `:261-270`(`beginBootAttempt`/`isAttemptStale`)
  - 상세(직접 재구성한 trace, 5단계):
    1. 부팅 A(먼저 보낸 `wc:boot`)가 1차 `isAttemptStale` 재검증을 통과해 `establishConfig(cfgA)` 를 실행하고, 저장된(이전 마운트가 남긴, 실제로는 서버에서 이미 종료된) 세션을 발견해 복원 분기로 진입 — `dispatch(RESTORED)` 후 `seedWaitingFromStatus(clientA, saved)` 를 호출해 `getStatus` 로 suspend.
    2. A 의 `getStatus` 가 in-flight 인 동안 부팅 B(재전송, §106 상 이겨야 할 "마지막 wc:boot")가 도착 — `beginBootAttempt()` 가 `bootGenRef` 를 올려 A 를 **boot 축에서 정상적으로** superseded 시킨다(A 자신은 아직 모른다 — 다음 await 뒤에나 확인).
    3. A 의 `getStatus` 가 `status: "completed"`(terminal) 로 뒤늦게 resolve. **(수정 전 코드는 여기서)** `isStale(gen)`(world 축만 봄, A 자신이 진입할 때 캡처한 world 값과 비교) 은 아직 world 가 안 바뀌었으므로 통과 → `finalizeEnded` 호출 → `teardownSession` → **`worldGenRef.current++`**. 이 세션이 실제로 서버에서 끝난 게 맞으므로 이 자체는 "정당한" 이벤트다.
    4. 그런데 `isAttemptStale` 은 `worldGenRef.current !== attempt.world || bootGenRef.current !== attempt.boot` 로 **두 축을 OR 로 묶는다**. B 가 자신의 `beginBootAttempt()` 시 캡처해 둔 `attempt.world` 는 3단계의 bump **이전** 값이므로, B 가 나중에(자신의 `isEmbedAllowed` await 뒤) `isAttemptStale(attemptB)` 를 검사하면 **boot 축은 여전히 자신이 최신인데도 world 축 하나 때문에** stale 판정을 받고 bail 한다.
    5. 결과: B 는 `establishConfig`(따라서 `configRef`/`useWidget().config`)를 **한 번도 실행하지 못한 채** 조용히 사라진다. 최종 `config` 는 A(먼저 보낸, §106 상 이겨선 안 될 부팅)의 값에 영구 고착되고, 되돌릴 후속 이벤트가 없다(다음 `wc:boot` 이 오기 전까지).
  - 이 시나리오는 `plan/in-progress/webchat-boot-single-flight.md` §A-5 의 mutation 매트릭스("world 축 무력화" 등)와 **다른 종류**다 — 매트릭스는 가드를 제거했을 때 무엇이 잡히는지를 봤고, 이 버그는 **가드가 각각 의도대로 정상 작동하는 중**에 두 정당한 이벤트(boot 축 대체 B, world 무효화 A)가 상호작용해 발생한다. 도입 당시 §106 회귀 테스트("복원 seed 중 재전송")는 정확히 이 모양이지만 status 를 `"running"`(비-terminal)으로만 검증해 이 갭을 비켜갔다.
  - 질의 4 에 대한 정정: 내가 최초 분석에서 "boot 축은 단조 카운터라 N≥3 으로 자연 확장되고 새 실패 축이 없다"고 판단한 부분은 **"boot 축 자체의 승자 결정"만 놓고 보면 여전히 옳다**(진입 순서만으로 유일한 승자 후보가 정해지는 성질은 유지된다). 그러나 §106 이 실제로 지켜지는지는 별개다 — N-1개의 "패배할" 시도 중 **하나라도** 복원 분기에서 terminal 세션을 발견하면 world 축이 오염되어 진짜 승자(N 번째)까지 죽을 수 있다. 겹친 부팅 수가 늘수록 그런 후보가 늘어나므로, 이 조건부 실패는 N 이 커질수록 오히려 **더 잘** 트리거된다.
  - **수정 확인(커밋 `b1bef8633`)**: `seedWaitingFromStatus` 에 3번째 옵션 인자 `attempt?: {world, boot}` 가 추가돼, terminal 분기(`finalizeEnded` 호출) **직전**에 `if (attempt && isAttemptStale(attempt)) return "stale";` 가 삽입됐다(현재 파일 `:472-481`) — **자기 자신이 이미 boot-stale 이면 종료를 확정하지 않고 조용히 물러난다.** "종료가 유실되는가?"에는 "아니다, 저장 세션이 남아있으므로 살아있는(B) 시도가 자기 복원 분기에서 같은 스냅샷을 보고 확정한다(주체만 바뀐다)"로 답한다. `applyConfig` 의 복원 분기 호출부도 `seedWaitingFromStatus(clientRef.current, saved, attempt)` 로 자기 토큰을 넘기도록 수정됐고, `start()`/`replay_unavailable` 폴백 호출부는 boot 시도가 아니므로 그대로(3번째 인자 생략) 남아 있다 — 이 구분은 정확하다(그 두 호출부는 boot 토큰 자체가 없다). **정적으로 보는 한 이 fix 는 내가 재구성한 5단계 trace 의 4단계(B 의 오탐)가 아니라 3단계(A 의 부적절한 `finalizeEnded` 호출) 자체를 막아 근본적으로 닫는 형태**이며 타당하다. `use-widget-eager-start.test.ts` 에 이 정확한 시나리오를 고정하는 신규 테스트("§106: 대체된 시도의 종료 확정이 마지막 부팅을 죽이지 않는다")와 `CHANGELOG.md` 항목도 커밋에 포함돼 있다. 커밋 메시지 자체가 "검증: plan=B + phase=ended. 회귀 테스트 신설, mutation 으로 고정" 이라고 밝히나, **나는 이 워크트리에서 vitest 를 직접 실행해 재검증하지 않았다**(동시 편집 중이던 워크트리에서의 간섭을 피하기 위함 — 명시적 한계로 남긴다).
  - 제안: (1) 이 fix 의 실제 테스트 통과를 독립 CI/재실행으로 재확인할 것(내가 하지 않은 부분). (2) 위에서 정정한 대로 N=3 조합(예: A·B 모두 복원 분기에서 각자 다른 시점에 terminal 을 발견하고 C 가 최종 승자인 경우) 도 회귀 테스트로 고정할 것을 권고 — 이 CRITICAL 이 실제로 N 이 커질수록 더 잘 트리거되는 성질이라 방어적 제안이 아니라 직접적 회귀 방지 수단이다. (3) 이 CRITICAL 이 "가드 각각은 안전한데 **조합**이 위험한" 새로운 하위 유형임을 `bootGenRef`/`isAttemptStale` JSDoc 에 한 줄 남겨, 향후 세 번째 축이 추가될 때 이 교훈이 유실되지 않게 할 것.

- **[WARNING — 근본 원인 fix 로 해소된 것으로 관찰됨]** `applyConfig` 복원 분기의 `openStream`/`scheduleRefresh` 는 `state.phase` 를 보지 않는다 — 위젯-state 의 `ended` 리듀서 가드는 **가시적 phase 만** 보호하고 그 아래 SSE 연결·갱신 타이머 예약은 무방비했다
  - 위치: `use-widget.ts` 복원 분기(`openStream`/`scheduleRefresh` 호출부) · `widget-state.ts:125-143`(`RESTORED`/`BOOTED` `ended` 가드)
  - 상세: `widget-state.ts` 의 `ended` 가드가 막는 것은 "리듀서가 `ended` 에서 `RESTORED`/`BOOTED` 를 받아 `streaming` 으로 전이하는 것" 뿐이다. `applyConfig` 복원 분기가 `openStream`/`scheduleRefresh` 를 실행할지 결정하는 조건은 `outcome !== "continue"` 와 `isAttemptStale(attempt)` 뿐이며, `state.phase` 나 리듀서가 실제로 그 dispatch 를 받아들였는지는 보지 않는다 — 즉 리듀서가 "무시"해도 명령형 부수효과(EventSource 생성, 토큰 갱신 타이머 예약)는 멈추지 않을 수 있었다. 근본 원인은 `ERROR`(사용자에겐 `[ended]`) 가 `teardownSession` 을 거치지 않는 유일한 종료 경로라 저장 세션이 남는 것이었다.
  - **수정 확인**: `sendCommand` 의 `else`(410 아닌 에러) 분기에 `teardownSession()` 이 `dispatch({type:"ERROR"...})` **앞**에 추가됐다(현재 `:617-628`). 애초에 세션 storage 가 안 남으므로 재전송의 복원 분기 자체가 진입할 자료(`loadSession`)가 없어진다 — 국소 완화(phase 재검사)보다 근본적인 fix 다. `use-widget-eager-start.test.ts` 의 기존 "ERROR 로 종료된 대화는 wc:boot 재전송으로 부활하지 않는다" 테스트도 `sessionStorage` 가 `null` 인지, 재전송 후 `getStatus` 호출 횟수·`EventSource` 인스턴스가 불변인지(부수효과 자체가 발생하지 않는지)까지 단언하도록 강화됐다.
  - 제안: (관찰된 fix 유지 권고) `finalizeEnded` 를 안 쓰고 `teardownSession` 만 직접 호출하는 선택(에러 메시지 보존 + host 미통지 유지 목적)이 `endedRef` 를 세팅하지 않는다는 점은 인지해 둘 것 — 이 ERROR 처리 직후 **별도의** SSE terminal 이벤트가 뒤이어 도착하면 `finalizeEnded` 가 `endedRef` 가드 없이 한 번 더 실행돼(`teardownSession` 중복 호출 자체는 멱등이라 무해) `conversationEnded` 를 host 에 통지할 수 있다 — 경합·손상은 없어 동시성 결함은 아니고 side_effect/requirement 영역에 가깝지만 참고로 남긴다.

- **[INFO]** 질의 2 — `applyConfig` 만 두 축, `start`/`sendCommand`/`seedWaitingFromStatus` 는 world 축만 보는 비대칭은 정당함. `start()` 가 boot 축을 봐야 하는 시나리오는 못 찾음
  - 위치: `use-widget.ts:445-517`(`seedWaitingFromStatus`, world 만 + 옵션 attempt) · `:545-595`(`start`, world 만) · `:597-633`(`sendCommand`, world 만)
  - 상세: 이 세 함수는 전부 config·client·session 이 이미 확립된 뒤에만 실행 가능하다(`start` 는 `if (!cfg || !client) return`, `sendCommand` 는 `if (!session || !client) return`). "boot generation" 은 `applyConfig` 가 config 를 확립하기 **이전**(어느 `wc:boot` 이 이길지 미확정) 구간에만 의미가 있고, 이 세 함수는 그 구간이 끝난 뒤에만 호출되므로 boot 축을 참조할 대상 자체가 없다.
  - `start()` 가 boot 축을 봐야 하는 경우를 직접 구성해 반증 시도: 재전송 `wc:boot`(cfg2, re-config)이 embed-config 왕복 중일 때 사용자가 패널을 열어 `open()`→`start()` 가 먼저 실행되면, `start()` 는 `configRef.current` 의 그 순간 값(아직 cfg1)을 스냅샷해 webhook POST 를 보낸다 — cfg2 가 나중에 확립돼도 이미 나간 POST 의 profile 은 소급되지 않는다. 이것은 boot 축 부재 때문이 아니라 `updateProfile`(진행 중 execution 의 기전송 profile 은 소급 변경 불가) 의 기존 계약과 같은 성격이다.
  - `seedWaitingFromStatus` 도 마찬가지로 config 확립 후에만 실행되며, 위 CRITICAL 이 보여준 것은 "boot 축을 **전혀 안 봄**" 이 잘못이 아니라 "**필요한 한 곳(applyConfig 의 복원 분기 호출)에서만** boot 축을 선택적으로 받아야 했는데 원래 그 경로가 없었다"는 것이었다 — 비대칭 판단 자체를 뒤집는 게 아니라, "복원 분기의 종료-확정" 이라는 좁은 하위 경로에서 예외적으로 호출부의 boot 토큰을 알아야 했다는 것이고, 수정은 정확히 그 좁은 범위(옵션 파라미터)로 대응했다.
  - 제안: 없음(판단 확인됨, 위 CRITICAL 의 fix 로 필요한 예외가 이미 반영됨).

- **[INFO]** 질의 3 — `!cfg.apiBase` 조기 return 이 세대를 올리지 않는 판단은 정확함
  - 위치: `use-widget.ts` `applyConfig` 시작부(`!cfg.apiBase || !cfg.triggerEndpointPath` 조기 return) vs 그 직후 `beginBootAttempt()` 호출
  - 상세: 조기 return 이 `beginBootAttempt()` **이전**에 있어, 필드 누락 malformed `wc:boot` 은 `bootGenRef`/`worldGenRef` 어느 쪽과도 상호작용하지 않는다. 만약 세대를 올리는 쪽으로 바뀐다면 — 정상 attempt A 가 embed-config 왕복 중일 때 malformed 요청이 도착 시 그 즉시(동기 구간) `bootGenRef` 를 선점하고 아무 것도 안 하는 채로 return 하므로, A 가 나중에 resolve 해도 영구 boot-stale 되고, 이후 legit `wc:boot` 재전송이 없는 시나리오(직접 로드/샘플 등)에서는 **위젯이 영구적으로 config 를 확립 못 해 패널이 열리지 않는 파국**이 된다 — 이 파일이 반복 경계해 온 "죽은 소유자가 살아있는 시도를 밀어낸다"류 회귀와 정확히 같은 형태다. 현재 코드는 이를 정확히 피하고 있다.
  - 제안: 없음(판단 확인됨).

- **[INFO]** 질의 5 — `establishConfig` 비-async 추출은 런타임 동시성 동작을 바꾸지 않으며 오직 "강제 메커니즘"만 규율→구조로 전환함
  - 위치: `use-widget.ts:809-825` 부근(`establishConfig`)
  - 상세: JS 에서 일반(비-async) 함수 호출은 그 자체로 yield point 가 아니다 — `establishConfig(cfg)` 를 `applyConfig` 내부에서 호출하는 것은 인라인해 둔 것과 실행 순서·원자성 면에서 동치다. 내부에서 호출하는 `apiRef.current.newChat()` 도 완전히 동기적으로 반환함을 확인했다(`newChat`→`resetSessionRefs`→`teardownSession` 전부 비동기 없음; `void client.interact(...)`·`void start()` 는 fire-and-forget). 따라서 이 추출이 새로 여는 race window 는 없다. 진짜 가치는 컴파일러 강제다 — `establishConfig` 가 `async` 가 아니므로 내부에 `await` 을 쓰면 `error TS1308` 로 빌드가 막힌다(plan §B 진행기록에서 실측 확인: 인라인 시절엔 이 구간에 `await` 을 삽입해도 스위트 전부 통과 — "이 구간엔 await 이 없다"는 게 테스트로 전혀 고정되지 않는 성질이었다). `useCallback(establishConfig, [])` 가 참조하는 것은 전부 ref/stable setter 뿐이라 stale closure 위험도 없다.
  - 제안: 없음(추출이 안전함을 확인).

- **[INFO]** `widget-state.ts` 의 `RESTORED`/`BOOTED` `ended` 가드 확대는 async 레이스 자체를 막는 게 아니라, ERROR 가 `teardownSession` 을 거치지 않던 데이터 위생 결함의 **이펙트**를 리듀서 단에서 방어하는 것 — 위 WARNING 의 근본 원인 fix 로 이제 두 층(리듀서 + storage 정리) 모두 방어됨
  - 위치: `widget-state.ts:125-137`(`RESTORED`)·`138-143`(`BOOTED`), 기존 `144-169`(`WAITING`, 대칭 패턴)
  - 상세: 이 두 가드가 막는 근본 원인은 "두 비동기 작업의 경합"이 아니라 `ERROR` 액션이 `phase:"ended"` 로 전이하면서도 세션을 정리하지 않는 상태-정리 누락이었다. 그 잔존 세션이 **완전히 정상적인(=non-stale) 후속** `wc:boot` 재전송의 복원 분기에서 다시 발견돼 `RESTORED` 를 트리거하므로, `isAttemptStale` 류의 staleness 가드로는 막을 수 없는 종류다(그 attempt 자체가 stale 하지 않다 — 정당하게 이긴 최신 attempt이므로). 리듀서 레벨 가드는 defense-in-depth 로 올바른 계층이며, 위 WARNING 의 근본 원인 fix(ERROR 도 teardownSession 수행)와 합쳐져 "화면"과 "부수효과" 두 층 모두를 막는다.
  - 제안: 없음(concurrency 관점에서 추가 조치 불요).

## 요약

이번 PR 이 실제로 변경한 동시성 관련 코드는 `use-widget.ts`(`beginBootAttempt`/`isAttemptStale`/`establishConfig` 신설 + `applyConfig` 재배선)와 `widget-state.ts`(`RESTORED`/`BOOTED` 종료-가드 확대) 이며, prompt_file 의 나머지 29개 파일은 리베이스되지 않은 브랜치의 diff 아티팩트임을 git 실측으로 확인했다(스코프 노트). 실제 변경분에 대해 orchestrator 의 5개 질의를 모두 반증 시도한 결과, **질의 1·4 는 반증에 성공했다** — `worldGenRef`/`bootGenRef` 는 트리거 도메인이 disjoint 하다는 설계 원칙 자체는 옳지만, 유일한 교차점인 "복원 분기의 종료 확정"(`seedWaitingFromStatus` → `finalizeEnded` → `teardownSession` 의 world bump)이 **대체된(boot-stale) 시도에 의해 트리거될 때 아직 살아있는 진짜 마지막 부팅까지 world 축으로 오염시켜 §106 을 위반**하는 CRITICAL 을 발견했다. 이 발견은 병렬로 실행된 별도 세션 `17_36_57` 의 concurrency 리뷰가 격리 워크트리 재현으로 먼저 확인했고, 나는 그 trace 를 독립적으로 재구성해 동일 결론에 도달했다. 이는 "가드가 개별적으로는 각자 정상 작동하지만 그 조합이 새는" 새로운 하위 유형으로, 기존 mutation 매트릭스(단일 가드 제거 시 탐지력)로는 원천적으로 포착되지 않는 성질이다. 관련해 A-6 리듀서 가드도 "가시적 phase" 만 지킬 뿐 SSE/타이머 부수효과까지는 못 막는 WARNING 을 확인했다. **리뷰를 진행하는 도중 이 두 발견 모두를 겨냥한 fix 가 이 공유 워크트리에 커밋됨을 직접 관찰했다**(`b1bef8633`, 커밋 메시지가 이 세션(`17_48_20`)까지 명시적으로 인용) — 정적으로 검토한 한 그 fix 는 각 결함의 근본 원인(전자는 대체된 시도의 `finalizeEnded` 호출 자체를 boot 토큰으로 억제, 후자는 `ERROR` 경로에 `teardownSession` 을 추가해 애초에 잔존 세션을 없앰)을 정확히 겨냥하고 있으며 신규 회귀 테스트·CHANGELOG 항목도 함께 커밋됐으나, 나는 그 테스트를 직접 실행해 통과 여부를 재검증하지는 않았다(동시 편집 중이던 워크트리에서의 간섭을 피하기 위함 — 명시적 한계). 나머지 세 질의(2·3·5)는 반증에 실패했다 — `applyConfig` 만 두 축을 보는 비대칭, `!cfg.apiBase` 조기 return 의 세대 미가산, `establishConfig` 비-async 추출은 모두 사려 깊게 옳은 설계였다.

## 위험도

CRITICAL — 리뷰 대상 diff 자체에는 실제 도달 가능한 §106 위반이 있었다. 다만 그 근본 원인을 겨냥한 fix(`b1bef8633`)가 이미 이 워크트리에 커밋되어 있는 것으로 관찰된다 — 병합 전 그 fix 의 테스트 실행(vitest)이 실제로 통과하는지 독립적으로 재확인할 것을 권고한다(본 리뷰는 정적 검토만 수행했다).
