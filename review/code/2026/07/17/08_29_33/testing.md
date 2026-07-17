# 테스트(Testing) 리뷰

대상: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(+89줄, 신규 테스트 1건),
`codebase/channel-web-chat/src/widget/use-widget.ts`(staleness 가드 4종 → `worldGenRef` 단일화 리팩터),
`plan/in-progress/spec-sync-external-interaction-api-gaps.md`(문서 갱신).

## 발견사항

- **[CRITICAL]** 전체 스위트 동시 실행 시 `use-widget-eager-start.test.ts` 가 간헐적으로(비결정적) 실패 — 신규 회귀 테스트 포함
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1487-1562`(신규 "유령 표면 회귀" 테스트), `:1645-1720`(기존 "세션 교체 후 도착한 옛 명령의 410" 테스트)
  - 상세: 리뷰 중 `codebase/channel-web-chat` 에서 `npx vitest run`(전체 스위트, 파일 인자 없음)을 반복 실행해 재현성을 직접 검증했다.
    - **격리 실행은 항상 안정**: 해당 파일 단독(`npx vitest run src/widget/use-widget-eager-start.test.ts`, 36 passed), `src/widget/` 전체(133 passed), 인위적 CPU 부하(`yes > /dev/null` 12개 병렬)를 건 상태의 파일 단독 실행(8회 반복) 모두 100% 통과.
    - **전체 스위트 동시 실행은 비결정적**: 동일 커밋에서 `npx vitest run`(전체, 22개 파일 동시)을 총 46회 반복해 6회 실패(≈13%) 관찰. 실패 테스트는 매번 다르다 — (a) 신규 테스트("seed in-flight 중 SSE terminal → stale 응답이 ended 위젯을 부활시키지 않는다")가 `expect(result.current.state.phase).toBe("ended")` 에서 **`Received: "awaiting_user_message"`** 로 실패(=이 테스트가 막으려는 바로 그 "유령 표면" 버그 상태가 재현됨), (b) 기존 테스트("세션 교체 후 도착한 옛 명령의 410…")가 `expect(...).not.toBe("ended")` 에서 **`Received: "ended"`** 로 실패, (c) 한 회차는 3건 동시 실패.
    - **A/B 비교로 "신규 도입" 확인**: 동일 방법론을 부모 커밋(`7a9b4ce88`, 본 diff 직전)에 별도 git worktree 로 체크아웃해 적용 — 전체 스위트 25회 반복 중 **실패 0건**. 같은 환경·같은 반복 횟수 규모에서 현재 커밋만 실패가 관측되므로, 이번 `worldGenRef` 단일화 리팩터가 새 비결정성을 도입했다는 정황이 강하다(참고: 이 실행 환경은 다른 세션도 공유하는 샌드박스라 절대 수치의 노이즈는 있을 수 있으나, parent/current A/B 비교 자체는 동일 조건에서 이뤄졌다).
    - 코드 정독으로는 `worldGenRef` 게이팅이 논리적으로 결정적이어야 한다(gen 캡처/증가가 모두 동기 코드이고, 신규 테스트는 `await waitFor(() => phase==="ended")` 로 `finalizeEnded`→`teardownSession`(gen 증가)이 **이미 끝났음을 명시적으로 확인한 뒤** stale promise 를 resolve 한다 — 그 시점 이후 gen 불일치가 안 걸릴 논리적 경로가 안 보인다). 이는 두 가지 가능성을 열어둔다: ① 테스트 하네스의 `await Promise.resolve(); await Promise.resolve();`(고정 횟수 microtask flush) 패턴이 실제로는 하네스 환경마다 필요한 tick 수가 달라 불충분할 수 있는 취약한 관용구이거나, ② `worldGenRef` 도입으로 실제 프로덕션 코드에도 특정 스케줄링 하에서만 드러나는 잔존 race 가 있을 가능성 — 정적 분석만으로는 완전히 배제되지 않는다.
  - 제안: (1) 병합 전 재현 확인 — `cd codebase/channel-web-chat && for i in $(seq 1 20); do npx vitest run > /tmp/r_$i.log 2>&1; grep -q 'failed' /tmp/r_$i.log && echo "FAIL $i"; done` 을 실 CI 환경에서 반복 실행해 재현율 확인. (2) 재현되면 `--reporter=verbose` + 실패 시 중간 상태 로깅(또는 `DEBUG_PRINT_LIMIT`)으로 정확한 인터리빙 확정. (3) 근본 원인이 하네스측이면, 위 두 테스트가 쓰는 "resolve 후 고정 횟수 `await Promise.resolve()`" 로 "정상 처리 후 아무 일도 안 일어남" 을 단언하는 패턴을 더 견고한 flush(예: `await new Promise((r) => setTimeout(r, 0))` 를 추가하거나, 여러 tick 을 draining 하는 공용 `flushMicrotasks()` 헬퍼)로 교체 검토. (4) 근본 원인이 프로덕션 코드측이면 CRITICAL 정정 필요 — `worldGenRef` 캡처/증가 지점 사이에 실제로 재진입 가능한 경로가 있는지 재검토.

- **[WARNING]** 언마운트 중 in-flight 비동기 무효화(W6, "SSE leak" 해소 주장) 를 직접 검증하는 테스트 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:735-748`(마운트 effect cleanup, 신규 `worldGenRef.current++`), 테스트 파일 전역(`use-widget-eager-start.test.ts` 전체에 `unmount` 사용 0건 — `grep -rn "unmount" src/widget/` 결과 `use-token-refresh.test.ts`/`presentations.test.tsx` 에만 존재)
  - 상세: diff 의 커밋 메시지·plan 문서(`spec-sync-external-interaction-api-gaps.md` §"구조 개선 — worldGen 단일화")는 "언마운트 세대 증가로 리뷰 W6(unmount-after-await SSE leak)도 함께 해소" 라고 명시적으로 주장한다. 그러나 `use-widget-eager-start.test.ts` 의 모든 테스트는 `const { result } = renderHook(...)` 로만 구조분해하고 `unmount` 를 한 번도 호출하지 않는다. `@testing-library/react` 의 전역 `afterEach(cleanup)`(자동 활성, `RTL_SKIP_AUTO_CLEANUP` 미설정 확인됨)이 매 테스트 종료 시 암묵적으로 unmount 하긴 하지만, 이는 항상 모든 `waitFor` 가 settle 된 **이후** 시점이라 "비동기가 in-flight 인 동안 unmount" 라는, 이 fix 가 정확히 겨냥하는 시나리오는 어떤 테스트에서도 실제로 발생하지 않는다. plan 문서가 언급하는 mutation 검증 3종(choke-point 증가 제거·seed gen 검사 제거·sendCommand gen 검사 제거) 목록에도 "unmount 증가 제거" 는 포함되어 있지 않다 — 즉 이 특정 코드 경로는 회귀 검출력이 전혀 검증되지 않았다.
  - 제안: `getStatus`(또는 webhook POST) 를 수동 resolve 가능한 pending promise 로 잡아둔 채 `unmount()` 호출 → 이후 resolve → `EventSource` 생성 카운터(예: 기존 테스트들이 쓰는 `esCreated++` 패턴)가 증가하지 않음을 단언하는 테스트 1건 추가 권장.

- **[WARNING]** `widget-state.ts` 의 `WAITING` 리듀서 케이스에 `ended` 가드가 없고, 이를 고정하는 순수 리듀서 단위테스트도 없음
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:129-137`(`case "WAITING": return { ...state, phase: "awaiting_user_message", ... }` — 현재 `state.phase` 값과 무관하게 무조건 전이), `codebase/channel-web-chat/src/lib/widget-state.test.ts`(`ENDED` 다음 `WAITING` 액션을 디스패치하는 케이스 없음 — 기존 케이스들은 모두 `WAITING` → `ENDED` 순서만 검증, 역순 없음)
  - 상세: plan 문서는 이 리듀서 분기를 재현된 버그의 **"직접 원인"**("`widget-state.ts` 의 `WAITING` 이 `ended` 가드 없이 무조건 전이하는 것이 직접 원인")으로 명시한다. 그런데 이번 fix 는 이 리듀서를 건드리지 않고 전적으로 호출부(`use-widget.ts`)의 `worldGenRef` 게이팅에 의존해 "`ENDED` 이후 `WAITING` 을 절대 디스패치하지 않는다" 는 불변식을 유지한다 — 즉 방어가 단일 지점(caller)에만 있고 reducer 자체엔 defense-in-depth 가 전혀 없다. 이 프로젝트 히스토리 자체가 "보호되는 줄 알았는데 실제로는 무방비였다" 는 동일 유형의 CRITICAL 을 4라운드 반복해서 겪었던 만큼(diff 의 JSDoc 이 스스로 인정), reducer 층에도 같은 유형의 재발을 조기에 잡을 수 있는 저비용 테스트가 없다는 점은 아쉽다. 이 테스트는 async mock/fetch 오케스트레이션이 전혀 필요 없는 순수 함수 테스트라 작성·유지 비용이 매우 낮다.
  - 제안: `widget-state.test.ts` 에 `reduce([{type:"WAITING",...}, {type:"ENDED"}, {type:"WAITING", interaction:{type:"ai_conversation"}}])` 형태로 "이미 ended 인 상태에서 WAITING 수신 시 어떻게 되는가" 를 명시적으로 고정하는 테스트 추가. 현재 동작(무조건 전이)을 의도적으로 유지한다면 최소한 "이 불변식은 caller 책임" 이라는 주석과 함께 현재 동작을 pin 하는 회귀 테스트라도 추가해, 향후 리듀서 변경 시 이 암묵적 계약이 깨지는 것을 감지할 수 있게 할 것을 권장.

- **[INFO]** 신규 테스트의 최종 단언이 `phase` 하나뿐 — 테스트명이 말하는 "표면(surface)" 부활 여부는 직접 검증하지 않음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1561`(`expect(result.current.state.phase).toBe("ended");`)
  - 상세: stale 페이로드는 `waitingNodeId: "ghost"` 라는 식별 가능한 마커를 담고 있는데(:1553), 최종 단언은 `phase` 만 확인한다. 현재 프로덕션 코드 구조상(`if (worldGenRef.current !== gen) return "stale";` 가 `dispatch` 이전에 위치) `phase` 단언만으로도 이 버그 클래스는 충분히 잡히지만, `pending` 이 여전히 `null`(또는 `pending?.nodeId !== "ghost"`)임을 추가로 단언하면 실패 시 진단 메시지가 "유령 표면" 이라는 테스트 의도와 더 직접적으로 일치하고, 향후 dispatch 순서가 바뀌는 리팩터에도 더 강건해진다.
  - 제안: `expect(result.current.state.pending).toBeNull();` (또는 `?.nodeId`) 단언 1줄 추가.

- **[INFO]** (기존 패턴, 본 diff 신규 이슈 아님) fetch mock 응답 JSON 리터럴의 파일 전역 반복
  - 위치: `use-widget-eager-start.test.ts` 전체 — `{ data: { executionId, status: "pending", interaction: { token, expiresAt, endpoints: ENDPOINTS } } }` 형태가 30여 개 테스트에 거의 동일하게 복붙되어 있고, 신규 테스트도 동일 패턴을 따른다.
  - 상세: 이번 diff 가 만든 문제는 아니며(파일 전체의 기존 컨벤션), 우선순위 낮음. 다만 공용 팩토리(`pendingHookResponse(overrides?)`) 로 추출하면 30여 곳의 유지보수 비용이 줄어든다.
  - 제안: 별도 리팩터 후속 항목으로만 고려(본 diff 블로커 아님).

## 긍정적으로 확인된 점

- `npx vitest run`(격리 실행) 기준 신규 테스트 포함 `use-widget-eager-start.test.ts` 36/36, `src/widget/` 133/133, `channel-web-chat` 전체 364/364 통과 — 회귀 없음(단, 위 CRITICAL 항목의 비결정성은 "격리 실행" 이 아닌 "전체 스위트 동시 실행" 에서만 관측됨에 유의).
- 신규 테스트는 기존 "W7(a) — 세션 교체 후 stale 응답" 테스트와 겹치지 않는 **새로운** 코드 경로를 정확히 겨냥한다: 코드 확인 결과 `newChat()`/`endConversation()` 은 `resetSessionRefs()` 를 거쳐 `sessionRef.current = null` 을 하지만, SSE terminal 이벤트가 타는 `finalizeEnded()`→`teardownSession()` 은 `sessionRef` 를 null 하지 않는다 — 따라서 구 코드의 `sessionRef.current !== session` 검사는 정확히 SSE-terminal 경로에서만 뚫렸고, 신규 테스트가 바로 그 경로를 재현한다. 테스트의 필요성·비중복성이 코드로 뒷받침된다.
- plan 문서에 기록된 mutation 검증(가드 3종 개별 제거 → 해당 테스트만 실패 확인) 관행은 회귀 테스트의 실효성을 입증하는 좋은 사례다(다만 위 WARNING 처럼 unmount 경로는 이 mutation 목록에서 빠져 있다).
- `worldGenRef` 는 단조 증가 카운터 + 정확 일치(`!==`) 비교라 ABA 문제 구조적으로 없음 — 불리언 플래그 대비 견고한 설계 선택.

## 요약

`use-widget.ts` 의 staleness 가드 4종(`startGenRef`/`sessionRef` 동일성/`cancelled` 플래그/무가드) 을 `worldGenRef` 하나로 통합한 리팩터이며, 이를 고정하는 신규 회귀 테스트 1건이 정확한 코드 경로(구 `sessionRef` 동일성 검사가 놓친 SSE-terminal 이후 seed staleness)를 겨냥해 잘 설계되어 있고 격리 실행 시 결정적으로 통과한다. 그러나 리뷰 과정에서 전체 테스트 스위트를 반복 실행(46회, 부모 커밋 대비 A/B 25회)한 결과 이 파일이 **전체 스위트 동시 실행 시에만** 간헐적으로 실패하며, 그중 한 실패는 신규 테스트 자신이 막으려던 정확한 버그 증상("ended" 대신 "awaiting_user_message")을 재현했다 — 이는 부모 커밋에서는 전혀 관측되지 않아 이번 diff 가 새로 도입한 비결정성일 가능성이 높다. 추가로 이번 fix 가 명시적으로 "해소했다" 고 주장하는 언마운트-중-in-flight 시나리오(W6)와, 버그의 "직접 원인" 으로 지목된 `widget-state.ts` 의 무가드 `WAITING` 전이는 둘 다 전용 회귀 테스트가 없어 caller 측 가드 하나에만 전적으로 의존하는 단일 방어선 구조다. 병합 전 CRITICAL 항목의 재현/근본원인 확인이 필요하다.

## 위험도

HIGH
