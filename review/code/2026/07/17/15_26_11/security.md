# 보안(Security) Review — 2026-07-17 15_26_11

**대상**: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(회귀 테스트 2건 BLOCKED 전제 고정 + 주석 정정, **프로덕션 코드 0줄**), `review/code/2026/07/17/{14_30_15,14_56_27}/*` 신규 파일 6건(이전 라운드 리뷰 산출물 커밋 — `SUMMARY.md`·`RESOLUTION.md`·`meta.json`·`_retry_state.json`·`testing.md`).

orchestrator 지시에 따라 이번 라운드 diff 자체의 통상 점검 8항목에 더해, 이 브랜치 전체가 확정한 계약("부팅 중 접수된 리셋은 다음 성공하는 부팅이 이행한다. 소비 외에는 아무도 지우지 않는다")을 **세션 위생 3축**(옛 토큰 storage 잔존·무효 토큰 스트림·세션 폐기 권한) 관점에서 프로덕션 코드를 직접 추적해 독립 재검증했다. 이 축은 2026-07-17 `09_36_01` 라운드에서 security 가 마지막으로 다뤘고 그 이후 이 파일(`use-widget.ts`)이 여러 라운드를 거쳤으므로, 과거 결론을 인용만 하지 않고 현재 HEAD 코드(`use-widget.ts` 877줄, `use-token-refresh.ts`, `host-bridge.ts`, `session-store.ts`)를 전량 재독해 재확인했다.

## 발견사항

- **[INFO]** 이번 diff 자체는 보안 관점에서 실질 변경 없음 — 오히려 회귀 탐지력 개선
  - 위치: `use-widget-eager-start.test.ts` 전체 diff, `review/code/2026/07/17/{14_30_15,14_56_27}/*` 신규 문서 6건
  - 상세: `git diff` 로 이번 라운드의 프로덕션 코드(`use-widget.ts` 등) 변경이 전혀 없음을 확인했다(직전 두 라운드가 각각 diff 대조로 "코드 0줄"임을 이미 확인했고, 이번 라운드는 그 산출물 자체를 커밋). 유일한 코드 변경은 `renderHook` 반환값 캡처(`const { result } = ...`) + `expect(result.current.state.phase).toBe("blocked")` 전제 단언 2건 추가와 주석 스코프 정정뿐이다. 이 변경은 `isEmbedAllowed()`(임베드 origin allowlist soft-control, `4-security §3-①`) 의 fail-open 회귀를 잡는 테스트 사각지대를 메운다 — 정정 전에는 `document.referrer` 를 빼서 2차 진입이 실제로는 BLOCKED 아닌 ALLOWED 로 조용히 퇴화해도 테스트가 통과했다(`RESOLUTION.md` §W2, `testing.md` 실측). 즉 이번 diff 는 보안 관련 회귀 탐지력을 낮추지 않고 오히려 높인다.
  - 신규/변경 파일 전체를 `api[_-]?key|secret|password|BEGIN ... PRIVATE KEY|Bearer ...` 계열 패턴으로 grep — 일치 없음. 테스트의 `"iext_x"` 류 문자열은 이 파일 전역 기존 목업 토큰 컨벤션(실제 시크릿 아님, `09_36_01` 라운드도 동일하게 확인).
  - 제안: 없음.

- **[INFO]** 세션 위생 축 (a) "옛 토큰 storage 잔존" — **현재 코드에서 재현되지 않음을 코드 추적으로 재확인**
  - 위치: `use-widget.ts` `teardownSession()`(L231-265, 조기 return L254-257) · `applyConfig()` 의 `pendingResetRef` 소비 분기(L764-768)와 그 직후 `loadSession` 호출(L770) · `session-store.ts` `loadSession`(L45-65)/`clearSession`(L67-75)
  - 상세: 부팅(embed-config 왕복) 중 host `resetSession` 이 도착하면 `teardownSession()` 은 `configRef.current` 가 아직 null 이라 조기 return 하며 `pendingResetRef.current = true` 만 기록한다 — 이 정확한 지점이 `09_36_01` 라운드에서 security 가 WARNING 으로 지적했던 지점이다(당시 코드는 재생 로직이 없어 `applyConfig` 가 그대로 `loadSession` 을 호출해 **탭에 남아있던 만료 전 이전 세션을 조용히 복원**했다). 현재 코드는 `configRef.current`/`clientRef.current` 확립 직후, **`loadSession` 호출보다 먼저** `pendingResetRef.current` 를 검사해 참이면 `apiRef.current.newChat()` 을 호출하고 즉시 `return` 한다(L764-768) — 이번엔 `configRef.current` 가 non-null 이므로 `teardownSession()` 이 정상 경로(`worldGenRef++` → `closeStream` → `clearRefreshTimer` → **`clearSession(triggerEndpointPath)`**)를 실제로 타 storage 항목을 지운 뒤 새 대화를 시작한다. `loadSession` 자체도 조회 시점에 만료 토큰은 자동 폐기한다. `09_36_01` 이 제안했던 "지연 플래그 + loadSession 직전 분기" 해법과 본질적으로 동일한 설계가 이후 라운드(`11_38_14`~`14_56_27`)를 거쳐 정착돼 있음을 이번에 직접 코드 추적으로 재확인했다(인용이 아니라 재독 검증).
  - 제안: 없음(이미 해소, 회귀 없음). 이번 diff 는 정확히 이 경로를 검증하는 회귀 테스트(§R9-B/§R6 BLOCKED 계열)의 전제만 강화했다.

- **[INFO]** 세션 위생 축 (b) "무효 토큰 스트림" — **현재 코드에서 재현되지 않음을 코드 추적으로 재확인**
  - 위치: `use-widget.ts` `SeedOutcome` 반환 계약(L82-88) 과 `seedWaitingFromStatus()`(L394-448) 및 3개 호출부 게이팅 — `start()`(L511-515) · `applyConfig` 복원 분기(L781-791) · `handleEiaEvent` 의 `execution.replay_unavailable` 폴백(L320-328) · `use-token-refresh.ts` `scheduleRefresh()` 의 `gen` 캡처(L86)/응답 재검증(L92)
  - 상세: `seedWaitingFromStatus` 는 스냅샷이 이미 terminal 이면 `"ended"`, await 사이 세계가 교체됐으면 `"stale"` 을 반환하고 둘 다 `"continue"` 가 아니므로 세 호출부 전부 `openStream`/`scheduleRefresh` 를 건너뛴다 — 무효화된(종료되거나 교체된) 세션의 토큰으로 SSE 를 여는 경로가 없다. `useTokenRefresh` 는 `refreshToken()` 요청 직전 `gen` 을 캡처하고, 응답 `.then()` 에서 `sessionRef`/`saveSession` 을 쓰기 **전에** `worldGenRef.current !== gen` 을 재검증한다 — `teardownSession()` 내부에 `await` 가 없어 세대 증가가 항상 동기적으로 먼저 관측되므로, 세션 폐기 이후 지연 도착한 갱신 응답이 방금 지운 storage 를 되살릴 수 없다. 이 구조는 `09_36_01` 라운드의 "검증 (b)"가 코드 추적으로 이미 확인한 것과 동일하며, 그 이후 모든 라운드가 이 파일의 프로덕션 코드를 0줄 변경했으므로(각 라운드 RESOLUTION/SUMMARY 의 diff 대조로 확인됨) 그 결론이 오늘도 그대로 유효함을 재확인했다.
  - 제안: 없음.

- **[INFO]** 세션 위생 축 (c) "세션 폐기 권한" — **origin-pinning 으로 적절히 제한. 사전-boot 구간의 기존 특성은 이번 diff 범위 밖(무변경, 09_36_01 기 triage)**
  - 위치: `host-bridge.ts` `createIframeBridge().onMessage()`(L45-62) — 최상단 `e.source !== parent` 차단(L47), 최초 `wc:boot` 수신 시 `hostOrigin` 핀(L51-57), 이후 `wc:command` 는 `e.origin !== hostOrigin` 이면 차단(L58)
  - 상세: `resetSession`/`newChat` 을 유발할 수 있는 경로는 (1) `wc:command {action:"resetSession"}` postMessage — `e.source === window.parent` (실제 부모 프레임 자신만 통과) + 최초 boot 이후엔 origin 이 핀된 host 와 일치해야 함, (2) 공개 SDK 의 직접 API 호출(`actions.newChat()`) 뿐이다. 임의의 제3자 origin 이 cross-origin postMessage 스푸핑으로 세션을 폐기시킬 수 있는 경로는 없다. 단, `wc:boot` 을 아직 한 번도 받지 않아 `hostOrigin` 이 `null` 인 좁은 구간에서는 origin 비교 자체가 스킵된다(L58 조건이 `false && ...`) — 이는 `09_36_01` 라운드가 이미 INFO 로 식별하고 "부모 프레임 자신만 이 레이스를 만들 수 있어 크로스오리진 공격 벡터가 아니다"로 out-of-scope 처리한 **기존 동작**이며, `host-bridge.ts` 는 이번 diff 대상 파일 목록에 없고 이 브랜치의 어떤 라운드도 이 파일을 변경하지 않았다(재확인).
  - 제안: 없음(범위 밖, 조치 불요). 참고 컨텍스트로만 남긴다.

- **[INFO]** `pendingResetRef` 가 `triggerEndpointPath` 를 구분하지 않는 설계 — 세션 폐기 권한 축과 직결되므로 보안 관점에서 재확인(이미 추적 중, 신규 아님)
  - 위치: `use-widget.ts` L184-191 (JSDoc "불변식 의존 주의")
  - 상세: 이 플래그는 SET 시점의 endpoint 와 CONSUME 시점의 endpoint 가 같은지 검사하지 않는다 — 원리상 "endpoint X 부팅 중 접수된 리셋이 endpoint Y 의 다음 성공 부팅에서 이행"될 수 있어, 세션 폐기 권한의 스코프가 의도(같은 endpoint)보다 넓어지는 방향의 결함 클래스다. 다만 (i) 유일한 재전송 호출부(관리자 미리보기 `live-preview.tsx`)는 endpoint 전환 시 `iframe` 을 리마운트해 이 훅의 모든 ref(이 플래그 포함)를 초기화하므로 오늘 기준 도달 불가, (ii) `side_effect`(`14_30_15` Q2)가 이미 실측하고 JSDoc 에 재검토 트리거 조건까지 명문화했다. 이번 라운드에 이를 무력화하는 새 재전송 경로나 상태 변화는 없다(코드 무변경 재확인).
  - 제안: 없음(이미 문서화된 accepted risk, 조치 불요). 향후 "리마운트 없는 endpoint 전환" 기능이 논의되면 이 항목을 먼저 재검토할 것 — 이미 JSDoc 에 조건이 명시돼 있어 별도 티켓 불요.

## 요약

이번 라운드의 실제 diff 는 프로덕션 코드 0줄(회귀 테스트 전제 단언 2건 + 주석 정정)과 이전 라운드 리뷰 산출물 문서 커밋뿐이라 그 자체로 새로운 공격 표면이 없으며, 하드코딩 시크릿·인젝션·에러 메시지 원문 노출을 전수 grep 했으나 일치 없었다. 오히려 이번 diff 는 임베드 origin allowlist soft-control 의 fail-open 회귀를 잡던 테스트 사각지대를 메워 보안 회귀 탐지력을 개선했다. orchestrator 가 요청한 세션 위생 3축은 인용이 아니라 `use-widget.ts`·`use-token-refresh.ts`·`host-bridge.ts`·`session-store.ts` 4개 파일 전량을 직접 재독해 독립 재검증했다 — (a) 옛 토큰 storage 잔존은 `pendingResetRef` 소비가 `loadSession` 호출보다 먼저 배치돼 있어 `09_36_01` 라운드가 지적했던 "부팅 중 리셋 시 storage 부활" 경로가 실제로 닫혀 있고, (b) 무효 토큰 스트림은 `SeedOutcome` 게이팅과 `useTokenRefresh` 의 세대 재검증이 지연 응답의 storage/스트림 되살리기를 이중으로 차단하며, (c) 세션 폐기 권한은 `resetSession` 이 postMessage source·origin 핀으로 사실상 부모 프레임 자신에게만 열려 있어 크로스오리진 트리거 경로가 없다. 유일하게 남는 항목(`pendingResetRef` 의 endpoint 미구분)은 이미 문서화된 accepted risk 이며 오늘 기준 도달 불가능한 조건(재전송 시 리마운트)에 의존한다 — 이번 diff 가 새로 만들거나 악화시킨 것이 아니다. CRITICAL/WARNING 0건, 신규 조치 불요.

## 위험도

NONE
