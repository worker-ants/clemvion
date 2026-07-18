# 테스트(Testing) Review — webchat-boot-single-flight (§106 single-flight)

## 검증 방법론

orchestrator 가 요청한 5개 항목은 대부분 "주장이 맞는지 재현하라"는 요구라, 정적 분석이 아니라 **실제 mutation
테스트**로 확인했다.

1. `git worktree add --detach <고유이름> HEAD`(scratchpad 하위)로 리뷰 대상 worktree(`webchat-boot-single-flight-8c92b4`,
   HEAD=`1c9708ac8`)와 격리된 사본을 만들고, `channel-web-chat/node_modules` 를 심링크(pnpm 의 상대 심링크가 원본
   worktree 의 `node_modules/.pnpm` 저장소를 그대로 재사용하므로 재설치 불필요 — vitest 실행만이 목적이라 turbopack
   심링크 금지 이슈와 무관).
2. `use-widget.ts`/`widget-state.ts` 를 실제로 한 줄씩 mutate(`sed -i`) → `vitest run`(관련 2개 파일 93건 또는
   channel-web-chat 전체 385건) 재실행 → 실패 테스트명을 그대로 기록 → 원본으로 즉시 복원, 다음 mutation.
3. 종료 후 심링크 제거 + `git worktree remove --force`로 격리 worktree 제거. 리뷰 대상 worktree는 건드리지 않았다
   (모든 `sed -i` 는 격리 worktree 경로에만 적용).
4. 인용 라인 번호는 전부 `git show HEAD:<path>` (커밋된 blob) 기준 — 아래 "부수 관찰" 참고.

**부수 관찰(범위 밖, 투명성을 위해 기록)**: mutation 도중 `git status`로 확인한 결과, 공유 리뷰 worktree 에 `use-widget.ts`·
`use-widget-eager-start.test.ts`의 **미커밋 변경**이 실시간으로 나타났다(`unmountedRef.current = false;` 마운트 리셋
추가 + 신규 StrictMode 재현 테스트, 커밋 메시지 추정상 같은 `18_39_11` 라운드의 다른 리뷰어 소관). 이는 본 리뷰의 확정
diff(merge-base `14bc86a53` 기준 7파일) 밖이므로 아래 CRITICAL/WARNING 판정에는 넣지 않았고, 라인 인용은 전부
`git show HEAD`(커밋된 상태, 이 미커밋 변경과 무관)로 고정했다. 다만 요청 5 답변에서 정황 증거로 1회 언급한다.

---

## 발견사항

### [INFO] 요청 1 — 양방향 가드 쌍, 독립 재현 성공(보고값과 완전 일치)
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:903`
  (`const saved = streamRef.current ? null : loadSession(cfg.triggerEndpointPath);`)
- 상세: 두 방향 모두 실측 재현됨.
  - **(a)** `streamRef.current` → `startedRef.current` 로 되돌리면(플랜이 "내가 처음 냈다"고 적은 6번째 거울상 그대로
    재도입): `use-widget-eager-start.test.ts` 51건 중 **"§106: 대체된 시도가 연결 전에 물러나도 살아있는 시도가
    연결을 세운다"** 단 1건만 실패(50 passed / 1 failed). 나머지 50건 영향 없음.
  - **(b)** 스킵 조건을 아예 제거(`loadSession(...)` 무조건 호출)하면: 같은 51건 중 **"§106: 활성 대화 중 재전송은
    입력창을 되감지 않는다"** 단 1건만 실패(50/1).
  - 두 mutation을 서로 바꿔 실행해도 교차 오염 없음(각 방향이 정확히 자기 짝만 잡는다) — "양방향 쌍이 실제로 서로를
    지킨다"는 주장이 정량적으로 확인됨.
- 제안: 없음(확인 완료, 조치 불필요).

### [INFO] 요청 2 — §106 신규 테스트 4건, 각각의 "대응 가드" 제거 시 전부 포착
- 위치: `use-widget.ts:881`(checkpoint 1, `cannotApplyConfig`) / `use-widget.ts:923`(checkpoint 2, `isAttemptStale`)
- 상세: 4건을 각각 정밀 대응되는 가드를 무력화해 검증(전부 `use-widget-eager-start.test.ts`, 총 51건 기준).

  | 테스트 | 무력화한 지점 | 결과 |
  |---|---|---|
  | `§106: resolve 순서가 역전돼도 마지막 wc:boot 의 config 가 적용된다` | checkpoint 1(`if(cannotApplyConfig(attempt)) return`)을 `if(false) return`으로 무력화 | 이 테스트 포함 **3건** 실패(48/3) — 나머지 2건은 기존 A-3 회귀 테스트(겹친 부팅 리셋 이월 2건)로, 같은 boot 축을 공유하는 게 당연해 정상 |
  | `§106: 복원 seed 중 재전송으로 대체된 시도는 SSE 를 열지 않는다` | checkpoint 2(`if(isAttemptStale(attempt)) return`)을 `if(false) return`으로 무력화 | **단독** 실패(50/1) |
  | `§106: 대체된 시도의 종료 확정이 마지막 부팅을 죽이지 않는다` | checkpoint 1을 `cannotApplyConfig`(boot 축만)에서 `isAttemptStale`(world 축도 봄)로 교체 | **단독** 실패(50/1) — plan 이 기록한 CRIT 재현(`최종 config.plan = A, 기대 = B`)과 정확히 동형 |
  | `§106: 대체된 시도가 연결 전에 물러나도 살아있는 시도가 연결을 세운다` | 요청 1-(a)와 동일 mutation | **단독** 실패(50/1) |

  4건 모두 "제거하면 그 테스트가 잡는다"가 성립. 특히 3번째(checkpoint 1이 world 축을 **의도적으로 안 본다**는
  설계 결정 자체)는 이번 라운드 CRITICAL(C1)의 재발을 정밀하게 막는 가드로, 손대면 정확히 1건이 반응한다.
- 제안: 없음(확인 완료).

### [INFO] 요청 3 — A-6 이중 방어선, "각각 독립적으로 잡히는" 것은 맞으나 "같은 테스트가 잡는 것"은 아님
- 위치: `use-widget.ts:634`(근본 fix, `sendCommand` catch 비-410 분기의 `teardownSession()`) /
  `widget-state.ts:136`(리듀서 가드, `RESTORED` case)
- 상세:
  - **근본 fix만 제거**(line 634 삭제) → `use-widget-eager-start.test.ts`의 **통합 테스트**
    (`"ERROR 로 종료된 대화는 wc:boot 재전송으로 부활하지 않는다"`, line 2880)만 실패(93건 중 92/1).
    단, **가장 이른 단언**(`expect(window.sessionStorage.getItem(...)).toBeNull()`)에서 즉시 실패한다 — 뒤이어
    강화된 "부작용" 단언(`statusCalls`/`getEs()`)까지는 도달하지 못한다. 즉 이번 mutation만으로는 그 뒤 단언들이
    독자적으로 무언가를 더 잡는지는 확인되지 않는다(아래 "둘 다 제거" 참고).
  - **리듀서 가드만 제거**(근본 fix는 유지) → `widget-state.test.ts`의 **단위 테스트**
    (`"RESTORED: ENDED 이후엔 무시(종료된 대화가 streaming 으로 부활하지 않는다)"`, line 136 부근 `it.each`)만
    실패(92/1). **통합 테스트는 그대로 통과**한다 — 근본 fix가 살아 있으면 재부팅 시점에 이미 storage 가 비어
    있어 `RESTORED` 액션 자체가 디스패치되지 않으므로, 통합 테스트 구조상 이 mutation 을 관측할 수 없다(리듀서
    가드는 "이 통합 시나리오"가 아니라 **다른 호출 경로**를 향한 최후 방어선이라는 설계 의도와 일치 — 결함은
    아니다). `BOOTED` case 도 동일 패턴으로 별도 확인(단독 92/1, `"BOOTED: ENDED 이후엔..."`만 실패).
  - **둘 다 제거** → **2건** 실패(91/2: 단위 1 + 통합 1). 통합 테스트는 이번에도 첫 단언(`sessionStorage` null
    체크)에서 멈춰, `statusCalls`/`getEs()` 단언이 "리듀서 가드가 없을 때"를 별도로 검증하는 장면은 이 mutation
    조합으로는 관측되지 않는다.
  - plan 진행기록(`webchat-boot-single-flight.md` "ai-review 17_36_57/17_48_20 반영" 절)의
    "근본 fix 제거 → 1건 / 리듀서 가드 제거 → 1건 / **둘 다 → 1건**" 서술과, 실측한 "둘 다 → 2건"이 다르다.
    코드/테스트 자체의 문제는 아니고 진행기록 메모의 사소한 부정확으로 보인다.
  - 결론: "근본 fix 와 리듀서 가드를 **각각** 제거했을 때 둘 다 잡히는가"라는 질문에는 **예**다. 다만 이는 "하나의
    A-6 테스트가 두 축을 모두 지킨다"가 아니라 "**서로 다른 파일의 두 테스트가 각자 자기 축만** 지킨다"는 구조다.
    통합 테스트에 추가된 `statusCalls`/`getEs()` 단언은, 근본 fix 가 정말 깨졌을 때 "부활이 화면뿐 아니라 부작용
    까지 미쳤는지"를 보여주기 위한 것이지만, 위 세 mutation 중 어느 것으로도 그 단언 자체가 **단독으로** 무언가를
    추가로 잡는 상황은 만들어지지 않았다 — 현재로선 진단 정보에 더 가깝다(방어선이 아니라는 뜻은 아니며, 근본
    fix가 "일부만" 깨지는 미래의 변형 — 예: `teardownSession()`은 호출하되 순서가 달라 `clearSession`은 건너뛰는
    경우 — 에선 이 단언들이 유일한 방어선이 될 수 있다).
- 제안: (LOW) plan 진행기록의 "둘 다 → 1건" 표현을 실측값(2건)으로 정정 권장. 코드/테스트 수정은 불필요.

### [INFO] 요청 4 — 신규 테스트의 전제 고정, 대체로 양호 · 스타일 비일관 1건
- 위치: `use-widget-eager-start.test.ts` 신규 §106 테스트 6건 + A-6 통합 테스트 1건(line 2488~2919 부근)
- 상세: 6건 모두 "대체된 시도가 실제로 관측 가능한 지점(embed-config 양쪽 in-flight / getStatus in-flight 등)까지
  도달했는가"를 `await waitFor(...)`로 먼저 고정한 뒤에야 최종 단언으로 넘어간다. 특히
  `"§106: 대체된 시도가 연결 전에 물러나도 살아있는 시도가 연결을 세운다"`(line 2698)는
  `expect(getEs()).toBeNull(); // 전제 — 이 시점에 스트림이 없어야 이 테스트가 의미를 갖는다.` 로 **명시적** 전제
  주석·단언까지 남겨, 이 파일이 이전 라운드(`14_56_27` testing)에서 세 번 지적받은 "전제 미고정 → 조용히 퇴화"
  패턴을 정확히 교정한 모범 사례다.

  다만 바로 다음 테스트인 `"§106: 복원 seed 중 재전송으로 대체된 시도는 SSE 를 열지 않는다"`(line 2769)에는
  동일한 종류의 명시적 "아직 스트림 없음" 전제 단언이 없다. 구조적으로는 위험이 낮다 — `openStream`은
  `seedWaitingFromStatus`가 resolve 되기 전에는 호출될 방법이 없고, 이 테스트는 그 seed 를 `resolveStatus`로
  일부러 붙잡아 두므로 대체된 시도가 스트림을 열 경로 자체가 존재하지 않는다(실측: mutation 2b 로 checkpoint 2를
  무력화했을 때 이 테스트가 정확히 걸림 → §근거는 실효 있음이 확인됨). 그래도 바로 옆 테스트가 세운 "전제를
  명시 주석+단언으로 남긴다"는 관례에서는 벗어난다.
- 제안: (INFO) 일관성을 위해 `expect(getEs()).toBeNull();` 류 전제 단언을 이 테스트에도 추가 권장(현재도 안전하지만,
  향후 이 테스트 주변 코드가 리팩터될 때 "왜 안전한지"를 코드가 스스로 말하게 하는 저비용 보강).

### [WARNING] 요청 5 — 블라인드 스팟 ①: `beginBootAttempt` 가 world 축까지 병합해도 385/385 전부 통과
- 위치: `use-widget.ts:270-271` (`beginBootAttempt`)
- 상세: `() => ({ world: worldGenRef.current, boot: ++bootGenRef.current })` 를
  `() => ({ world: ++worldGenRef.current, boot: ++bootGenRef.current })` 로 바꿔(부팅 시도가 world 축도 함께
  무효화하도록, 즉 "이 김에 더 안전하게 만들자"는 전형적으로 그럴듯한 오판) channel-web-chat 전체 스위트를
  실행 → **385/385 그대로 통과**. `beginBootAttempt`의 JSDoc(line 246-269 부근)은
  "**`worldGenRef` 와 축이 다르다 — 합치지 말 것.**"을 굵게 명시하는데, 그 불변식을 정면으로 어겨도 어떤 회귀
  테스트도 반응하지 않는다.

  실제 파급 경로: `sendCommand`의 catch 분기(`if (isStale(gen)) return;`, line 616 부근)·
  `seedWaitingFromStatus`의 `execution.replay_unavailable` fire-and-forget 폴백·`useTokenRefresh`에 주입되는
  `worldGenRef` 공유 staleness 체크가 전부 이 축에 의존한다. spec/plan 이 명시하듯 관리자 라이브 미리보기는
  `wc:boot`을 **디바운스 없이** 키 입력마다 재전송한다. 이 mutation 하에서는: (1) 마침 실패 중이던
  `sendCommand`(예: 명령 500)의 에러 처리가 우연히 같은 순간의 재전송과 겹치면 `isStale(gen)`이 참이 되어
  `teardownSession()`+`ERROR` dispatch 가 조용히 스킵되고 사용자가 "전송 중" 화면에 갇힐 수 있다. (2) 토큰
  자동 갱신 타이머가 매 재전송마다 stale 판정을 받아, 긴 편집 세션에서 갱신을 놓치고 90분 토큰이 실제로 만료될
  수 있다. 두 시나리오 모두 이 파일이 이미 6차례 실측 재현한 "축 병합" 실패 계열과 형태가 완전히 같다.
- 제안: (WARNING) `beginBootAttempt`가 world 축을 건드리지 않는다는 것 자체를 직접 pin하는 회귀 테스트 추가
  권장. 예: 대화가 `awaiting_user_message`로 확립된 상태에서 `sendCommand` 실패(4xx/5xx)를 in-flight 로 잡아
  두고, 그 사이 `wc:boot`을 재전송한 뒤 실패 응답을 resolve — 정상적으로 `ERROR`+`teardownSession`이 수행되는지
  (world 축이 재전송과 무관하게 유지되는지) 검증. 또는 더 저비용으로, `useTokenRefresh`의 갱신 타이머가
  `wc:boot` 재전송에도 취소되지 않는지를 직접 검증.

### [WARNING] 요청 5 — 블라인드 스팟 ②: checkpoint 1의 `unmountedRef` 체크가 어떤 테스트에서도 고유하게 요구되지 않음
- 위치: `use-widget.ts:283-286` (`cannotApplyConfig`)
- 상세: `(attempt) => unmountedRef.current || bootGenRef.current !== attempt.boot` 에서
  `unmountedRef.current ||` 부분만 제거(언마운트 시 `worldGenRef.current++`는 그대로 유지)해도 **385/385 통과**.
  원인: 유일하게 이 지점을 겨냥한 것으로 보이는 신규 테스트
  (`"embed-config 왕복 중 언마운트 → 지연 응답이 세션·SSE 를 되살리지 않는다"`, line 2832)는 사전에
  `sessionStorage`를 seed 해 두므로 복원 분기까지 진입하는데, 이때 checkpoint 2(`isAttemptStale`)의 **world 축**이
  언마운트의 `worldGenRef.current++` 부수효과로 이미 걸려버려, checkpoint 1의 `unmountedRef` 가 없어도 결과적으로
  막힌다. `unmountedRef`가 진짜 유일하게 필요한 시나리오 — JSDoc(line 178)이 말하는, **config 미확립 상태(첫
  await 도중) + `pendingResetRef` 대기 중 + 언마운트** → 그 뒤 `establishConfig`가 언마운트된 컴포넌트에서
  `apiRef.current.newChat()`을 유령 호출하는 경우 — 는 세션이 없어 checkpoint 2(복원 분기)에 아예 도달하지 않으므로
  world 축의 우연한 보호도 못 받는데, 이 경로를 직접 검증하는 테스트가 없다.

  **참고(범위 밖, 정황 증거)**: 이 mutation 검증 도중 공유 worktree에서 관찰한 미커밋 변경(위 "검증 방법론" 부수
  관찰 참고)이 `unmountedRef`의 **또 다른** 결함 — React StrictMode(dev) 의 mount→unmount→mount 이중 호출 시
  `unmountedRef.current`가 재마운트에서 리셋되지 않아 **영구 latch**되고, 두 번째(실제) 마운트가 `wc:boot`을
  영원히 적용하지 못하는 문제 — 를 실시간으로 수정하는 것을 확인했다. 이 결함은 본 리뷰의 확정 diff 밖이라
  등급 판정에는 포함하지 않지만, `unmountedRef`라는 축 전체가 이번 회귀 테스트 세트로 제대로 pin되지
  않았다는 위 결론을 강하게 뒷받침하는 정황이다(같은 축에서 내가 못 찾은 결함을 다른 리뷰어가 별도로 찾은 셈).
- 제안: (WARNING) `unmountedRef`가 `cannotApplyConfig`에서 실제로 무언가를 막는 시나리오(config 미확립 + 언마운트
  + 세션 없음, 이상적으로는 `pendingResetRef`가 set 된 채로) 를 직접 겨냥한 테스트 추가 권장.

### [INFO] 요청 5 — 참고: checkpoint 2의 world 축 재검사는 현재 호출 구조상 중복(코드 스스로 인정) — 낮은 우선순위
- 위치: `use-widget.ts:288-292` (`isAttemptStale`)
- 상세: `isAttemptStale`에서 `worldGenRef.current !== attempt.world` 부분만 제거(=checkpoint 2를 checkpoint 1과
  동일하게 boot 축만 보게)해도 385/385 통과. 다만 이 JSDoc(line 245-268 부근) 자체가 "위 `outcome` 게이팅이 이미
  world 변화를 잡지만... `seedWaitingFromStatus` 내부 구현에 대한 의존"이라며 **의도적인 방어적 중복**임을
  스스로 인정한다(미래에 `seedWaitingFromStatus` 내부에 await 이 추가돼도 조용히 무방비가 되지 않기 위한 선제
  조치). 현재 시점엔 실제로 뚫린 구멍이라기보다 "테스트로는 고정되지 않은 선제적 안전장치"에 가까워, 위 WARNING
  2건과는 성격이 다르다.
- 제안: 없음(현행 유지 권장 — 코드 주석의 자기 인식이 이미 충분한 문서화다).

---

## 표준 체크리스트 요약

- **커버리지 갭**: 위 WARNING 2건 외에는, 이 diff 가 건드린 로직(리듀서 가드 4곳, `establishConfig` 비동기 배제,
  C1/C2 CRITICAL fix, `pendingResetRef` 이월 계약)을 전수 mutation 했을 때 전부 최소 1개 테스트가 반응했다.
- **엣지 케이스**: resolve 순서 역전·복원-중-대체·언마운트-중-대체 등 "그럴듯한 타이밍"을 폭넓게 다룸. 다만
  경계값(예: 3개 이상 겹친 부팅, N>2 supersede 체인)은 다루지 않는다 — 현재 실사용 경로(관리자 미리보기 키
  입력 디바운스 없음)를 고려하면 낮은 우선순위로 보이나, plan 에 명시적으로 "다루지 않음"이라 기록되어 있진 않다.
- **Mock 적절성**: `ControllableEventSource`/fetch mock 은 매핑되지 않은 호출을 `Promise.reject`로 즉시 실패시켜
  (암묵적 허용 없음) 실사용과의 괴리를 최소화하는 좋은 패턴. 문제 없음.
- **테스트 격리**: 공용 `beforeEach`/`afterEach`(`sessionStorage.clear()`, `vi.unstubAllGlobals()`,
  `document.referrer` 리셋)가 신규 테스트에도 그대로 적용됨을 확인. 전체 스위트를 여러 차례(정상 + mutation)
  반복 실행하는 동안 순서 의존성·flakiness 징후 없음.
- **테스트 가독성**: 신규 테스트 전부 "무엇이 재현됐는지 + 왜 이 축을 보는지"를 주석으로 남겨 의도가 명확하다.
  타임라인(대체/역전 시나리오)이 주석 서술과 코드 순서가 일치해 추적이 쉽다.
  Korean 주석이 매우 길다는 점은 이 저장소의 기존 관례와 일치하므로 별도 지적하지 않는다.
- **회귀 유효성**: 리뷰 대상 diff(무변경) 기준 channel-web-chat 전체 385/385 실측 확인(재실행).
- **테스트 용이성**: `beginBootAttempt`/`cannotApplyConfig`/`isAttemptStale`이 이름 붙은 콜백으로 분리돼 있으나,
  **직접 단위 테스트는 없고 전부 `useWidget()` 통합 테스트(fetch/EventSource mock + `act`/`waitFor` 풀 세트)를
  통해서만** 간접 검증된다. `widgetReducer`처럼 순수 함수로 뽑아 직접 테스트했다면 위 WARNING 2건 같은 축-병합
  mutation을 훨씬 저비용(밀리초 단위, mock 불필요)으로 pin할 수 있었을 것 — 무거운 통합 테스트만 있는 현재 구조가
  이런 gap 이 만들어지고 발견되지 않는 근본 요인으로 보인다. (단, `beginBootAttempt` 등은 `useRef`/`useCallback`에
  묶여 있어 훅 밖으로 완전히 순수 분리하려면 별도 리팩터가 필요 — 이번 diff 범위를 넘는 제안이다.)

---

## 요약

보고된 5개 검증 요청 중 1~3(양방향 가드 쌍, §106 4개 테스트, A-6 이중 방어선)은 **모두 실측 mutation 테스트로
독립 재현되어 보고값과 정확히 일치**했다 — 특히 요청 2의 세 번째 케이스(checkpoint 1이 world 축을 의도적으로
보지 않는 설계)는 이번 라운드 CRITICAL(C1)의 재발을 정밀하게 막는 가드임이 확인됐다. 요청 3은 "둘 다 잡히는가"
자체는 참이지만 "두 개의 서로 다른 파일의 테스트가 각자의 축만 지킨다"는 구조이며, plan 진행기록의 카운트("둘 다
→ 1건")는 실측(2건)과 다르다(경미). 요청 4의 전제 고정은 대체로 우수하며 — 특히 한 테스트는 이전 라운드에서 세 번
지적된 "전제 미고정" 패턴을 명시적 주석+단언으로 정확히 교정했다 — 사소한 스타일 비일관 1건만 발견됐다. 요청 5(잔여
사각지대)에서는 mutation 테스트로 **두 건의 실질적 블라인드 스팟**을 확인했다: `beginBootAttempt`가 world 축까지
병합해도(문서로 명시 금지된 실수) 385개 테스트 전부 통과하며, `cannotApplyConfig`의 `unmountedRef` 체크도 어떤
테스트에서도 고유하게 요구되지 않는다(둘 다 385/385로 무방비 확인). 후자는 리뷰 도중 공유 worktree에서 관찰된
동일 축의 별도 실제 결함(StrictMode 이중 마운트 latch, 다른 리뷰어가 이 라운드에서 발견·수정 중 — 본 리뷰 범위
밖이라 등급에는 미포함)으로 정황상 뒷받침된다. 종합하면 이 diff의 신규 테스트 자체는 이례적으로 꼼꼼하고
자기비판적(코드 주석이 스스로 "이건 좁은 보호다"라고 인정하는 수준)이지만, `beginBootAttempt`/`cannotApplyConfig`가
순수 함수로 분리되지 않고 무거운 통합 테스트로만 간접 검증되는 구조가 이번에 찾은 두 gap이 만들어지고도 발견되지
않은 근본 원인으로 보인다.

## 위험도

MEDIUM
