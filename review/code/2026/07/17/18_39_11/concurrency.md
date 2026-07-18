# 동시성(Concurrency) 리뷰 — webchat-boot-single-flight (§106 마지막 wc:boot 적용)

> 리뷰 시각 기준 이 워크트리는 활성 편집 중이었다(리뷰 도중 `aba381ac8`, `a4eac304b` 두 커밋이 추가로 landed).
> 프롬프트 페이로드(고정 merge-base `14bc86a53`, 커밋 `8c79b68ea` 까지)뿐 아니라 **HEAD(`a4eac304b`)의 실제 파일**을
> 함께 대조해 분석했다 — 그 사이 이미 고쳐진 결함을 미해결로 오보하지 않기 위해서다. 라인 번호는 HEAD 기준.

## 발견사항

- **[CRITICAL]** `seedWaitingFromStatus` 는 신설된 boot 축(`bootGenRef`)을 전혀 모른다 — 대체된(superseded) 시도의 지연된 `getStatus` 응답이, 살아있는 시도가 SSE 로 이미 진행시킨 대화 표면을 **옛 `WAITING` 인터랙션으로 되돌릴 수 있다**.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts`
    - `seedWaitingFromStatus` 정의: L477-531 — 유일한 staleness 검사는 L482 `const gen = worldGenRef.current` + L493/L525 `isStale(gen)`(world 축뿐). `bootGenRef`/`beginBootAttempt`/`cannotApplyConfig`/`isAttemptStale` 4개 심볼은 파일 전체에서 `applyConfig` 안(L888, L891, L928)에서만 쓰인다 — `grep` 으로 확인, `seedWaitingFromStatus` 본문엔 전무.
    - `WAITING` 무조건 dispatch: L507-515.
    - 겹친 두 부팅이 모두 이 함수에 도달하는 경로: `applyConfig` 복원 분기 L908 `sessionEstablished() ? null : loadSession(...)` — `sessionEstablished()`(L302, `streamRef.current !== null`)는 "이미 연결됐나" 만 보고 "형제 시도가 복원 진행 중" 은 못 본다. 앞선 시도가 아직 스트림을 열기 **전**(= 자신의 `getStatus` 왕복 중, L919)이면 뒤이은 재전송도 `loadSession` 에 성공해 **같은 세션에 대해 두 번째 `getStatus` 호출을 스스로 낸다**(L919, 두 번째 시도 자신의 in-flight).
  - 상세: 재현 시퀀스(코드 추적, 두 번째 실행 환경에서 실측하진 않았으나 아래 각 단계는 소스에서 직접 확인됨) —
    1. 세션 `e1` 이 `waiting_for_input`(노드 `n1`) 상태로 저장돼 있다. 부팅#1(`attempt1={world:W,boot:1}`)이 복원 분기 진입: `RESTORED` dispatch, `seedWaitingFromStatus` 가 GET `.../executions/e1` 을 낸다(호출 A, in-flight).
    2. 호출 A 가 아직 안 끝난 상태에서 `wc:boot` 재전송(부팅#2, `attempt2={world:W,boot:2}`) 도착 — `cannotApplyConfig` 는 boot 축만 보므로(L891) 통과, `sessionEstablished()` 는 아직 `false`(부팅#1이 스트림을 못 열었으므로)라 부팅#2 **도** `loadSession` 성공 → **자신의** GET(호출 B)을 또 낸다.
    3. 호출 B 가 먼저 응답: `n1` 의 `WAITING` dispatch → 스트림 오픈(`isAttemptStale(attempt2)` 통과, L928) → 이제 `streamRef` 는 부팅#2 소유.
    4. 부팅#2 의 SSE 로 대화가 실제로 전진한다(사용자가 `n1` 표면에 응답했거나, 무버튼 자동진행 프레젠테이션 노드가 지나감) → SSE 가 `execution.waiting_for_input`(노드 `n2`) 를 전달 → `handleEiaEvent` 가 `WAITING(n2)` dispatch. 화면은 올바르게 `n2`.
    5. 호출 A(1단계에서 이미 떠 있던, 부팅#1 소유의 GET)가 **뒤늦게** 응답한다 — 별개 HTTP 왕복이라 도착 순서는 발신 순서와 무관하며, 서버가 그 요청을 실제로 처리한 시점이 `n2` 진입 **이전**이었다면 payload 는 여전히 `n1` 을 담을 수 있다. `world` 는 이 시나리오 내내 한 번도 바뀌지 않았다(대화가 살아있고, 종료·새 대화·언마운트 없음) → L493 `isStale(gen)` 이 `false` → **`dispatch({type:"WAITING", interaction:{...n1...}})` 가 그대로 실행돼 화면을 `n2` 에서 `n1` 으로 되돌린다.**
    6. 이 시점을 벗어날 다음 신호는 "사용자가 (지금은 잘못된) `n1` 표면에 응답해야" 오므로, 사용자가 그 되돌아간 프롬프트에 응답하면 `sendCommand` 가 이미 지나간 `nodeId`(`n1`) 로 명령을 보내 백엔드가 거부/무시할 수 있다 — 단순 flicker 가 아니라 **고착**될 수 있다.
    - `isAttemptStale`(체크포인트 2, L928)은 이 경로를 막지 못한다 — 그 체크포인트는 `seedWaitingFromStatus` **가 반환한 뒤** 호출부(`applyConfig`)의 후속 행동(`openStream`/`scheduleRefresh`)만 게이팅하며, 함수 **내부**의 `WAITING` dispatch(L507-515)는 그 이전에 이미 실행되고 끝난다. 즉 이 파일의 "모든 await 뒤 재검증" 계약이 `seedWaitingFromStatus` 라는 **함수 경계 안쪽**까지는 적용되지 않는다.
  - `side_effect` 리뷰어가 같은 관측 지점(겹친 부팅이 스트림 확립 전 구간에서 `getStatus` 를 중복 발사)을 이미 잡아 "최종 상태는 올바르게 수렴하고(EventSource 1개, §106 유지) 멱등 GET 이라 심각도 낮음" 으로 이월 처리했다(`plan/in-progress/webchat-boot-single-flight.md` "이월 추가 (18_39_11 side_effect·maintainability)"). 그 "수렴" 판단은 **두 GET 응답의 내용이 같다**는 전제에 기대는데, 그 전제는 두 호출 사이에 실행 상태가 실제로 전진하지 **않는** 경우(신규 테스트가 검증한 `"running"`/`"completed"` 스냅샷 — 둘 다 논리 노드 없음)에서만 성립한다. `waiting_for_input` 스냅샷이 **다른 노드**로 두 번 온다면 수렴하지 않는다 — side_effect 가 관측한 "호출 횟수/스트림 개수" 축은 수렴해도, **콘텐츠(어느 노드가 마지막으로 그려지는가)** 축은 도착 순서에 좌우된다. 따라서 이 항목은 side_effect 의 "낮음·이월" 재분류를 그대로 따르지 말 것을 권한다 — 이번 라운드에서 처리 대상으로 격상 제안.
  - 제안: `seedWaitingFromStatus` 도 boot 토큰(`attempt`)을 인자로 받아, **`WAITING` dispatch 분기(L507-515)만** `cannotApplyConfig(attempt)` 로 한 번 더 게이팅한다. **종료 확정(`finalizeEnded`, L499-502) 분기는 그대로 boot-비인지 상태로 둬야 한다** — 그게 이번 라운드에 고친 C1 의 핵심(대체된 시도가 발견한 진짜 종료는 살아있는 시도를 위해서도 확정돼야 §106 이 깨지지 않는다). 즉 "종료 확정" 과 "WAITING 표면 갱신" 은 **다른 staleness 정책**(전자=world 만, 후자=world+boot 모두)이 필요하다 — 이 함수 하나에 두 가지 다른 정책이 공존해야 한다는 점을 JSDoc 에도 남길 것.

- **[WARNING]** `sessionEstablished()`(구 `streamRef` 인라인 체크) 판정이 "재전송 간 `triggerEndpointPath` 불변" 을 암묵 전제 — `pendingResetRef` 가 이미 문서화한 동일 전제를 이 호출부는 재인용하지 않는다.
  - 위치: `sessionEstablished` 정의 L294-302, 사용처 L908, 대조군 `pendingResetRef` JSDoc L182-216(특히 "불변식 의존 주의" 문단).
  - 상세: `pendingResetRef` JSDoc 은 "재전송 호출부가 마운트를 유지한 채 endpoint 를 바꾸지 않기 때문에 안전하다"는 전제를 명시하고, 전제가 깨지면(리마운트 없는 endpoint 전환을 지원하게 되면) 재검토하라고 명시적으로 경고한다. `sessionEstablished()` 기반 복원-스킵도 **동일한 전제**에 기댄다 — 살아있는 `streamRef` 가 있다고 해서 그 스트림이 **이번** `wc:boot` 이 지정한 `triggerEndpointPath` 의 것이라는 보장은 코드 어디에도 없다(단지 오늘은 재전송이 endpoint 를 바꾸지 않는다는 실사용 패턴에 기댄다). 만약 이 전제가 깨지면: 새 endpoint 의 저장 세션이 있어도 `sessionEstablished()===true`(옛 endpoint 스트림이 살아있음)라 `saved` 가 강제로 `null` 이 되어 **새 endpoint 의 정당한 세션 복원이 조용히 스킵**된다. 오늘은 도달 불가지만, 이 호출부의 주석은 `pendingResetRef` 의 경고를 참조하지 않아 향후 한쪽만 재검토되고 다른 쪽은 잊힐 위험이 있다.
  - 제안: `sessionEstablished()` JSDoc 에 `pendingResetRef` 의 "불변식 의존 주의" 문단을 상호 참조로 명시(또는 두 곳을 하나의 공유 주석 블록으로 통합).

- **[INFO]** (독립 재현·재확인, 이미 해결됨) `unmountedRef` 부울 래치가 마운트 시 리셋되지 않아 `reactStrictMode`(dev) 이중 마운트에서 위젯이 영구히 멈추는 결함 — 적용된 fix 는 타당함.
  - 위치: `unmountedRef` 선언 L179, 현재 리셋 코드 L864-881(`unmountedRef.current = false` at L881), cleanup L988(`unmountedRef.current = true`), `codebase/channel-web-chat/next.config.ts`(`reactStrictMode: true`).
  - 상세: 이 결함은 내가 코드를 읽는 동안(동시 편집 중인 워크트리) 독립적으로 도출했다 — `worldGenRef`/`bootGenRef` 는 **단조 증가 카운터**라 캡처값 비교가 항상 "현재 값" 기준이므로 StrictMode 의 mount→unmount→mount 이중 호출에도 자연히 안전하지만(두 번째 마운트가 캡처하는 값도 이미 최신), **부울 플래그(`unmountedRef`)는 명시적으로 리셋하지 않으면 이중 호출에 취약**하다 — 첫 호출의 cleanup 이 세운 `true` 를 되돌릴 코드가 없으면 두 번째(실제로 유지되는) 마운트가 영구히 "unmounted" 로 오판돼 `cannotApplyConfig`(L284)가 항상 `true` 를 반환, 어떤 `wc:boot` 도 적용되지 않는다. 이 파일이 과거 `cancelled` 지역 플래그 → `worldGenRef` 단조 카운터로 전환하며 이미 한 번 벗어났던 바로 그 클래스(비-단조 무효화 플래그)의 재발이라는 점에서, "카운터는 안전·플래그는 리셋 필수" 라는 교훈이 재확인된다. 확인 결과 적용된 fix(L881 `unmountedRef.current = false` 를 effect 최상단, `applyConfig` 정의보다 먼저 배치 + `renderHook(..., { wrapper: StrictMode })` 회귀 테스트)는 위치·검증 방식 모두 타당 — 별도 조치 불필요.

- **[INFO]** checkpoint 1(`cannotApplyConfig`, L283-286)의 world 축 제거 — §106 의 **config** 보장은 N-way 겹침·임의 resolve 순서에서도 성립함을 확인.
  - 위치: `cannotApplyConfig` L283-286, `beginBootAttempt` L270-273, `applyConfig` L888-891.
  - 상세: `bootGenRef` 는 단조 증가하고 checkpoint 1 은 "현재 `bootGenRef.current` 가 내 캡처값과 같은가" 만 본다 — 한 번 더 최신 시도가 `beginBootAttempt()` 되면 그 이전 값들은 **영원히** 재통과 불가능하다(카운터가 되돌아가지 않으므로). 이 성질은 resolve 순서·겹침 개수(3개 이상 포함)와 무관하게 "지금 checkpoint 1 을 통과할 수 있는 시도는 최대 1개(가장 최근에 등록된 것)" 라는 불변식을 보장한다 — 3-way 이상 겹침·모든 resolve 순열을 손으로 추적했고 반례를 찾지 못했다. 다만 이 보장은 **`configRef`/`config` state 자체**에 한정된다 — 그 이후의 세션/대화 표면 갱신(WAITING)까지 boot 축이 미치지 않는다는 것이 위 CRITICAL 발견이다.
  - world 축 제거 자체의 안전성도 별도로 검증: checkpoint-1~`establishConfig` 사이엔 세션에 쓰는 코드가 없고, world 를 바꾸는 유일한 방법(`teardownSession()`)은 항상 `closeStream()`+`clearSession()` 을 동반하므로, 설사 그 사이 world 가 바뀌어도 뒤따르는 `sessionEstablished() ? null : loadSession(...)` 호출은 정확히 그 정리된 상태를 반영해 복원할 게 없으면 `null` 이 된다(연쇄적으로 안전). 부수 관찰: 이 제거는 "부팅 겹침이 전혀 없는" 단일 부팅에서도 checkpoint 1 을 예전보다 느슨하게 만든다(임베드 검증 대기 중 세션이 자연 종료돼도 이제는 그 위에 `BLOCKED` 가 무조건 dispatch될 수 있음) — 그러나 이 서브케이스는 이번 diff 이전에도 같은 지점(당시 `isStale(gen)` 단일 검사, 이 구간에서 종료가 나면 세계가 바뀌어 전체가 stale 처리됐음)이 존재했던 자리이므로 새로 열린 위험은 아니며, "차단이 최종적으로 이겨야 한다"는 보안 우선순위와도 부합한다고 판단한다.

- **[INFO]** `unmountedRef` 를 `worldGenRef` 와 분리한 설계는 타당 — 겹치거나 모순되지 않는다.
  - 위치: `unmountedRef`/`worldGenRef` cleanup L983-990, `cannotApplyConfig`/`isAttemptStale` L283-291.
  - 상세: 언마운트는 항상 world 도 함께 bump 하므로(L989 `worldGenRef.current++`) checkpoint 2(`isAttemptStale`)는 언마운트를 world 경로로도 이중으로 잡는다(무해한 중복 방어). `unmountedRef` 가 그럼에도 필요한 이유는 checkpoint 1 이 world 를 보지 않기 때문이다 — `unmountedRef` 가 없다면 언마운트 후에도 in-flight `applyConfig` 가 checkpoint 1 을 통과해 `establishConfig`(React state 업데이트 + `pendingResetRef` 소비 시 `newChat()` → 실제 webhook POST)를 실행할 수 있어, **사라진 컴포넌트가 새 execution 을 시작하는 리소스 누수**가 됐을 것이다. "언마운트=되돌아오지 않는 종점" vs "world=재사용 가능한 무효화" 라는 서로 다른 성질을 각 predicate 가 정확히 인코딩하며, 서로 모순되는 지점을 찾지 못했다.

- **[INFO]** `start()`(eager 부팅) 진행 중과 `wc:boot` 재전송이 겹치는 경로도 CRITICAL 발견과 동일한 근본 원인에 노출 — 별도 결함이 아니라 같은 구멍의 추가 도달 경로.
  - 위치: `start()` L565-609(특히 L597 자신의 `seedWaitingFromStatus` 호출), `applyConfig` L908.
  - 상세: `start()` 자체는 boot 축 대상이 아니다(설계 의도적 — `beginBootAttempt` JSDoc 이 "`start()`/`sendCommand`/`seedWaitingFromStatus` 는 world 축만 필요" 라고 명시). 그런데 `start()` 의 `persist()`(L?, BOOTED dispatch 직후)가 세션을 storage 에 쓴 **직후**, 아직 자신의 `seedWaitingFromStatus`(L597) 호출 전에 `wc:boot` 재전송이 도착하면, 그 재전송의 `applyConfig` 는 (아직 `streamRef.current` 가 null 인 좁은 창에서) 같은 세션을 `loadSession` 해 **자신도** `seedWaitingFromStatus` 를 호출한다 — CRITICAL 발견과 동일한 "같은 세션에 대한 이중 `getStatus`" 경로다. 겹친 두 호출이 "서로 다른 `wc:boot` 2건" 이 아니라 "eager start 대 재전송" 조합이라는 점만 다르다. 위 CRITICAL 의 수정(`seedWaitingFromStatus` 의 WAITING 분기에 boot 토큰 재검증 추가)이 이 경로도 함께 닫는다 — 별도 수정 불필요.

## 요약

이번 diff 는 §106("마지막 `wc:boot` 의 config 를 적용")을 **config 필드 레벨**에서는 견고하게 구현했다 — `bootGenRef` 단조 카운터 기반 checkpoint 1 은 3-way 이상 겹침·임의 resolve 순서에서도 반례를 찾지 못했고, world 축을 checkpoint 1 에서 뺀 결정도 재검토 결과 근거가 유효하다(`teardownSession` 이 world 변화와 스트림/저장소 정리를 항상 묶어 처리하므로). 리뷰 도중 실시간으로 발견된 StrictMode 이중 마운트 회귀(`unmountedRef` 미리셋)도 독립적으로 재현·검증했고 적용된 fix 가 정확함을 확인했다. 그러나 핵심 미해결 사항으로, `seedWaitingFromStatus` 가 신설된 boot 축을 전혀 인지하지 못한 채 남아 있다 — 겹친 두 부팅 시도가 모두 복원 분기에 진입하면(스트림 확립 **전** 구간, `sessionEstablished()` 판정의 사각지대) 각자 별도의 `getStatus` 호출을 내고, 그중 **대체된** 시도의 응답이 늦게 도착하면서 그 사이 대화가 실제로 전진했다면(사용자 응답 또는 자동진행 노드), world 축은 전혀 바뀌지 않았으므로(대화가 살아있음) 그 stale 응답이 살아있는 시도의 SSE 로 이미 갱신된 화면을 옛 인터랙션으로 되돌릴 수 있다 — 이 파일의 "모든 await 뒤 재검증" 계약이 `seedWaitingFromStatus` 함수 경계 **안쪽**(WAITING dispatch)까지는 미치지 않기 때문이다. `side_effect` 리뷰어가 같은 관측 지점(중복 `getStatus`)을 "최종 수렴·멱등이라 낮음" 으로 이월했으나, 그 수렴 전제는 두 응답 사이 실행 상태가 전진하지 않는 경우에만 성립해 일반적으로는 유지되지 않는다 — 이월보다 이번 라운드 처리를 권한다. 이 파일이 반복해 겪어 온 "비대칭/불완전 staleness 가드" 클래스(개발자 표현으로 이미 7회)의 정확히 같은 형태이며, 종료-확정 분기(boot 비인지 유지가 옳음)와 표면-갱신 분기(boot 인지가 필요함)를 하나의 함수 안에서 다른 정책으로 분리해야 한다는 점이 이번 회차의 교훈이다.

## 위험도

CRITICAL
