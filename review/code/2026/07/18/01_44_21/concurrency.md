# 동시성(Concurrency) Review

대상 커밋: `cffee0d28`("되감기 방어를 boot 축 → sessionEstablished 로") 및 그 후속(`206d27cee`, `2b4f198c1`).
파일: `codebase/channel-web-chat/src/widget/use-widget.ts`, `widget-state.ts`(+테스트).

payload(`_prompts/concurrency.md`)에는 이 코드 diff가 담기지 않고(크기 제한으로 잘림 — 다른 리뷰 산출물·spec
frontmatter만 포함) review 산출물 3건만 있었다. 실제 동시성 로직은 저장소에서 직접 `git diff
$(git merge-base origin/main HEAD)..HEAD -- codebase/`로 확인했다(`use-widget.ts` 276줄 변경,
`widget-state.ts` 31줄, 테스트 2파일). 격리 detached worktree(`/private/tmp/.../concurrency-review-wt`,
node_modules 실사본 복사)에서 mutation·probe 테스트를 실행하고 검증 후 제거했다(공유 worktree 무변경 —
`git status`/`git diff` 로 원본 파일 재확인 완료).

## 이번 라운드 6대 검증 항목 — 결과 요약

| # | 항목 | 결과 |
|---|---|---|
| 1 | no-op 재전송 고착 해소 | **확인** — 역-mutation(재설계 이전 코드에 신규 테스트 적용)으로 버그 재현 + 현재 코드로 해소 확인 |
| 2 | 되감기 2건(applyConfig-vs-applyConfig, start-vs-재전송) 방어 | **확인** — mutation A(게이트 제거) 시 정확히 2건만 실패, 다른 390건 무관 |
| 3 | 이중 스트림(동시 resolve) | **반증됨 — 새 CRITICAL급 후보 발견, WARNING으로 하향 보고(근거는 아래)** |
| 4 | replay_unavailable opt-in | **확인** — mutation B(opt-in 제거) 시 정확히 1건만 실패 |
| 5 | start()가 checkpoint 2 없이 sessionEstablished만으로 충분한가 | **부분 확인** — 되감기는 완전 차단, 이중 스트림은 narrow gap 존재(#3과 동일 근본원인) |
| 6 | 종료 확정이 게이트를 안 타는 것이 맞는가 | **확인** — mutation C(종료 확정에 게이트 오적용) 시 정확히 1건만 실패 |

## 발견사항

- **[WARNING]** "이중 스트림도 원천 차단" 주장이 근접-동시(same-microtask-batch) resolve 에서 실제로 깨진다 —
  `openStream()` 이 정확히 2회 호출됨(esCount=2), 결정론적 재현(5/5)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:507-516`(JSDoc 주장) ·
    `:656-661`(`start()` — seed 반환 후 `openStream` 직전, world 축만 재검사) ·
    `:986-1000`(`applyConfig` 복원 분기 — seed 반환 후 `isAttemptStale`(boot+world) 재검사 후 `openStream`)
  - 상세: JSDoc은 "openStream 은 seed 반환 **직후 동기 실행**이라... 이중 스트림도 원천 차단"이라 명시하지만,
    실제로는 `seedWaitingFromStatus` 내부의 `sessionEstablished()` 체크(라인 559)와 **호출부가 `openStream()`을
    실제로 호출하는 시점 사이에 최소 1 마이크로태스크 hop(비동기 함수 반환 → awaiter 재개 경계)**이 존재한다.
    두 경합 시도(예: `start()` 자신의 seed(C, attempt 토큰 없음) vs 재전송 복원 seed(D, boot 토큰 있음))의
    `getStatus` 리졸버를 **같은 동기 구간에서 연달아 호출**(마이크로태스크 간격 0)하면, **둘 다** 자기 `seedBody`
    안에서 `sessionEstablished() === false`(둘 다 아직 아무도 스트림을 안 연 상태)를 관찰하고 각자 `"continue"`를
    반환한 뒤, **각자의 호출부가 순차적으로(같은 배치 안에서) `openStream()`을 호출**한다 — `EventSource`
    생성자가 정확히 2회 불림(`esCount === 2`). 재현은 호출 순서에 대해 **대칭**이다(C→D, D→C 순서 둘 다 재현).
    다만 리졸버 사이에 **마이크로태스크 1틱만 벌려도**(`await Promise.resolve()`) 사라진다 — `flushAsync()`
    (매크로태스크 경계)를 쓰는 기존 순차 테스트들이 이 좁은 창을 커버하지 못했던 이유다.
    - **근본 원인**: `applyConfig`-vs-`applyConfig` 경합은 `sessionEstablished()` 외에 **`isAttemptStale`
      (boot 토큰) 이라는 2차 방어선을 여전히 갖고 있어**(재설계가 seed 내부 WAITING 게이트만 boot 축에서
      떼어냈을 뿐, 호출부 checkpoint 2는 "소유권 정합용"으로 의도적으로 유지 — JSDoc 라인 993-997) 실제로
      보호된다(별도 probe로 확인, 아래 "검증 방법" 참조: 정확히 1개만 열림, boot 세대가 다른 쪽이 checkpoint
      2에서 걸러짐). 그러나 **`start()`는 애초에 boot 시도가 아니므로 이 2차 방어선이 구조적으로 없다**
      (JSDoc: "`start()`/`sendCommand`/`seedWaitingFromStatus` 는 이 축을 쓰지 않는다", 라인 276-277). 즉
      `start()`-vs-재전송 경합은 **오직 `sessionEstablished()` 단일 가드**에 의존하는데, 그 가드가 정확히
      이 좁은 창에서 뚫린다.
    - **영향 범위 판단(WARNING인 이유, CRITICAL이 아닌 이유)**: (a) `openStream()`은 내부에서 `closeStream()`을
      먼저 호출하므로 **최종 상태는 항상 스트림 1개로 수렴**한다(먼저 연 스트림이 나중 호출로 닫힘) — 이전
      3연속 CRITICAL(영구 고착·영구 되감김·영구 대화 소실)과 달리 **자가 치유**된다. (b) `scheduleRefresh()`도
      `clearRefreshTimer()`를 먼저 호출하는 동일 패턴이라 타이머 이중 예약은 없다(`use-token-refresh.ts:74`).
      (c) 두 번째 `openStream()`이 첫 번째를 닫기까지의 실제 간격은 같은 JS 틱 내이므로, 첫 스트림이 실제
      네트워크 왕복(서버 처리 지연)을 거쳐 이벤트를 배달할 시간이 사실상 없다 — `AI_MESSAGE`가 중복 dispatch
      되면 리듀서가 무조건 append(dedup 없음, `widget-state.ts:174-180`)라 화면에 중복 메시지가 뜰 **수는
      있지만**, 실제로 트리거되려면 "완전 동시 resolve" + "첫 스트림이 close 전에 실제 이벤트까지 수신"이라는
      **이중으로 좁은 창**이 필요해 현실적 발생 가능성은 낮다. (d) 반대로 CRITICAL로 볼 근거: 트리거 조건
      자체(webhook POST 처리 중 `wc:boot` 재전송 도착)는 spec(§3 재전송, 운영 콘솔 라이브 미리보기)이 명시
      지원하는 **정상 사용 패턴**이고, "같은 리소스에 대한 두 HTTP 응답이 같은 마이크로태스크 배치에서
      처리"되는 상황은 순수 이론적 불가능이 아니다(동일 접속의 HTTP 응답 배치 처리 등). 그리고 이 파일은
      정확히 이 클래스의 문제로 이미 3라운드 CRITICAL을 냈다.
  - 제안: `start()`(라인 660 `openStream(session, "0");` 직전)와 `applyConfig` 복원 분기(라인 1000
    `openStream(saved, "0");` 직전) **양쪽에 `if (sessionEstablished()) return;` 재확인을 한 줄씩 추가**할 것.
    격리 worktree에서 이 2줄 추가를 실측 검증했다 — 기존 392건 전부 통과 + 신규 작성한 2개 이중 스트림
    probe(아래)까지 394건 전원 통과, 회귀 없음. 곁들여 JSDoc의 "이중 스트림도 원천 차단" 문구를 "단,
    `applyConfig`↔`applyConfig` 경합은 boot 토큰(checkpoint 2)이 막고, `start()`↔재전송 경합은 이 재확인이
    막는다"로 정정할 것(현재 문구는 근거 없이 일반화됨).

- **[INFO]** 테스트 커버리지 공백 — 근접-동시(zero-microtask-gap) resolve 시나리오가 기존 스위트에 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(기존 되감기/이중스트림 관련
    테스트 전부 — 예: 3042행 근방 "대체된 시도의 지연 getStatus...", 3212행 근방 "start() 의 지연 seed...")
  - 상세: 기존 테스트들은 두 경쟁 응답을 해결할 때 항상 별도 `act()`/`flushAsync()`(매크로태스크 경계, 그 사이
    SSE 이벤트까지 주입)로 **순차**(넓은 간격)로 처리한다. "같은 동기 구간에서 두 리졸버를 연달아 호출"하는
    패턴은 스위트에 없어, 위 WARNING이 지적하는 좁은 창은 지금까지 어떤 mutation testing에도 걸리지 않았다
    (커밋 메시지의 "mutation A/B 로 양방향 load-bearing 확인"은 이 축을 다루지 않음 — 실측: 세션established
    게이트를 통째로 지워도 정확히 2건만 실패했고, 그 2건 다 넓은-간격 시나리오였다).
  - 제안: 위 WARNING의 재현 스니펫(아래 "검증 방법" 참조)을 회귀 테스트로 정식 추가할 것. `start()`-vs-재전송
    쌍은 별도로(대칭적인 호출 순서 양쪽 확인 권장 — 실측상 순서와 무관하게 재현됨).

- **[INFO]** point 1·2·4·6 — 기존 설계 결정이 정확히 의도한 범위에서만 load-bearing함을 mutation으로 재확인
  - 위치: `use-widget.ts:551-559`(`seedWaitingFromStatus` 종료 확정/WAITING 게이트), `:437`
    (`replay_unavailable` opt-in 호출부)
  - 상세: (1) 재설계 이전 코드(`git show 5eed8cf96:.../use-widget.ts`)를 격리 worktree에 이식해 신규 테스트
    "webhook in-flight 중 아무것도 복원 못 하는 재전송이 start() 를 스피너에 고착시키지 않는다"를 실행 →
    `phase` 가 `"streaming"` 에 고착되어 실패(구설계 버그 실측 재현, 5/5 결정론적) — 현재 코드로는 통과.
    (2) `sessionEstablished()` WAITING 게이트를 `if (false) return "stale"`로 제거 → 정확히 2건만 실패
    (양쪽 되감기 테스트, 그 외 390건 무관 — over-narrow도 over-broad도 아님). (3) `replay_unavailable`의
    `{ allowWhileStreaming: true }` opt-in을 제거 → 정확히 1건(재동기화 테스트)만 실패. (4) 종료 확정 분기에
    "혹시 대칭이 예뻐 보인다"는 이유로 `sessionEstablished()` 게이트를 잘못 추가하는 mutation → 정확히 1건
    (`"대체된 시도가 발견한 종료는 그대로 확정된다"`)만 실패, 증상은 `phase`가 `"ended"`로 못 가고
    `"awaiting_user_message"`에 고착 — 대체된 시도가 발견한 진짜 종료가 영구 미확정되는 실제 사용자 영향.
    네 mutation 모두 회귀 테스트가 **정확히 대상 범위만** 잡고 과다·과소 커버리지가 없음을 확인했다 — 설계
    문서(JSDoc)의 주장과 실제 방어 범위가 (위 WARNING 항목 제외하고는) 정합한다.
  - 제안: 조치 불필요(검증 완료). 참고 기록.

## 검증 방법 (재현 가능한 최소 스니펫)

이중 스트림 probe(요지 — 전체 테스트 코드는 세션 로그에 있으며 공유 worktree에는 반영하지 않았다):
```ts
// start() 자신의 seed(C, attempt 없음) vs 재전송 복원 seed(D, attempt 있음)
boot(); /* config 확립 */ open(); /* start() → webhook in-flight */
await act(async () => { webhookResolvers[0](webhook202()); await flushAsync(); }); // persist → C 발사
boot(); // 재전송 → 스트림 미확립 창 → 복원 분기 → D 발사
await act(async () => {
  statusResolvers[0](waitingAt("n1")); // C
  statusResolvers[1](waitingAt("n2")); // D — 사이에 await 없음(같은 동기 구간)
  await flushAsync();
});
expect(esCount).toBe(1); // 실측: 2 (FAIL). 리졸버 사이 `await Promise.resolve()` 1틱만 넣으면 1로 통과.
```
mutation A/B/C 는 각각 `use-widget.ts` 라인 559(WAITING 게이트)·437(opt-in)·551-554(종료 분기)에 국소
변경을 가하고 `npx vitest run`(격리 worktree, 392 baseline) 전체 스위트 diff로 실패 집합을 확정했다.
모든 mutation·probe 파일은 검증 후 `git diff`로 무변경 확인 후 worktree 자체를 `git worktree remove`로
제거했다.

## 카테고리별 비고 (해당 없음 확인)

이 코드베이스는 브라우저 단일 스레드 이벤트 루프(React CSR)이므로 데드락·mutex/semaphore·스레드 풀 크기 같은
전통적 멀티스레드 카테고리는 구조적으로 해당 없음. "리소스 풀링"은 EventSource(단일 연결)·refresh 타이머
(단일 타이머, `clearRefreshTimer` 선행 idempotent 패턴)로 좁혀 검토했고 위 WARNING 외 문제 없음. async/await
사용은 전 경로에서 `isStale`/`isAttemptStale`/`sessionEstablished` 재검증 관용구가 일관되며 누락 지점을
찾지 못했다(단, 위 WARNING이 지적하는 "재검증 시점과 부작용 발생 시점 사이의 잔여 gap"은 이 관용구 자체의
한계라기보다 그 gap을 한 번 더 좁혀야 하는 지점을 못 찾은 것).

## 요약

이번 라운드(`cffee0d28`)가 되감기 방어축을 boot 세대 비교에서 `sessionEstablished()`(스트림이 이미
열렸는가)로 재설계한 것은 핵심 목표(no-op 재전송으로 인한 스피너 영구 고착 해소)를 정확히 달성했다 — 재설계
이전 코드에 신규 회귀 테스트를 이식해 버그를 실측 재현했고, 현재 코드에서는 해소됨을 확인했다. 기존에
알려진 두 되감기 경로(applyConfig-vs-applyConfig, start-vs-재전송)와 replay_unavailable 재동기화, 그리고
"종료 확정은 게이트를 타지 않는다"는 설계 결정 모두 mutation testing으로 정확한 load-bearing 범위를
재확인했다(과다·과소 방어 없음). 다만 이번 리뷰가 새로 발견한 것은, JSDoc이 명시적으로 보장한다고 주장하는
"이중 스트림도 원천 차단"이 **`start()`-vs-재전송 쌍에서, 두 `getStatus` 응답이 같은 마이크로태스크 배치에서
resolve 하는 좁은 창**에서 실제로 깨진다는 점이다(`openStream()` 2회 호출, 결정론적 재현 5/5, 호출 순서
대칭). `applyConfig`-vs-`applyConfig` 쌍은 별개로 유지된 boot 토큰 checkpoint(2차 방어선) 덕에 우연히
보호되지만, `start()`는 애초에 boot 시도가 아니라는 설계상 이유로 그 2차 방어선이 없다. 다행히 `openStream`/
`scheduleRefresh` 둘 다 "먼저 정리 후 설정"하는 idempotent 패턴이라 최종 상태는 항상 단일 스트림/단일
타이머로 수렴하고, 실측상 리졸버 사이 마이크로태스크 1틱만 있어도 사라지는 매우 좁은 창이라 이전 3연속
CRITICAL(영구 고착·영구 되감김·영구 대화 소실)과 같은 등급의 사용자 영향은 없다고 판단해 WARNING으로
분류했다. 재현·근본원인·최소 수정(2줄, 394/394 무회귀 실측 확인)까지 전부 검증됐으므로 다음 라운드에서
바로 반영 가능하다.

## 위험도

MEDIUM
