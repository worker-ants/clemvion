# 요구사항(Requirement) 리뷰 — worldGen 단일화 (2026-07-17 08_29_33)

대상: `codebase/channel-web-chat/src/widget/use-widget.ts`,
`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`,
`plan/in-progress/spec-sync-external-interaction-api-gaps.md`

## 검증 방법

정적 리뷰 외에 직접 실행/변이(mutation) 테스트로 다음을 실증했다(모두 완료 후 원본 복원, `git status` clean 확인):

- `pnpm`/vitest 로 `use-widget-eager-start.test.ts` 단독 실행 — **36 passed**(plan 문서 claim 과 일치).
- `channel-web-chat` 전체 테스트 스위트 — **22 files / 364 tests all passed**.
- `tsc --noEmit` — 에러 없음. `eslint` 대상 두 파일 — 0 error(1 개 무관한 기존 warning, 이번 diff 범위 밖).
- **변이 테스트 1**: `seedWaitingFromStatus` 의 `if (worldGenRef.current !== gen) return "stale";` 를 舊 `if (sessionRef.current !== session) return "stale";` 로 되돌리면 신규 테스트("유령 표면 회귀") **만** 실패 — `awaiting_user_message` 로 실제 부활함을 확인(설명된 버그가 fix 전에 실재했고 fix 로 해소됨을 실증).
- **변이 테스트 2**: 동일 라인을 `if (false) return "stale";` 로 완전 제거 → **정확히 3건 실패**(plan 의 "seed 세대 검사 제거 → 3건" claim 과 일치).
- **변이 테스트 3**: `sendCommand` 의 gen 검사를 제거 → **정확히 1건 실패**(plan 의 "sendCommand 세대 검사 제거 → 1건" claim 과 일치).
- **변이 테스트 4**: 마운트 effect cleanup 의 `worldGenRef.current++;`(언마운트 무효화, W6 claim 대상)를 제거 → **전체 스위트 364건 중 0건 실패**(아래 발견사항 참조).

## 발견사항

- **[WARNING]** JSDoc "계약" 이 명시한 무효화 지점 수(2곳)와 실제 구현(3곳)이 불일치
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:140-142`(계약 JSDoc) vs `:402`(`start()` 자체 증가)
  - 상세: `worldGenRef` 최상단 JSDoc "계약" 문단이 "무효화 지점은 두 곳뿐이다 — `teardownSession()`... 과 언마운트 cleanup" 이라고 명시적으로 단언한다. 그러나 `start()` 자신도 `const gen = ++worldGenRef.current;` 로 카운터를 증가시키며, 바로 옆 인라인 주석은 그 이유를 "start 는 세계를 **교체**하므로... 진행 중인 다른 비동기도 함께 무효화해야 한다" 고 별도로 정당화한다 — 즉 실질적으로 3번째 무효화 지점이 존재하는데 "계약"은 이를 부정한다. 코드 추적 결과 현재 가드(`if (startedRef.current || sessionRef.current) return;`)때문에 `start()` 호출 시점에 실제로 무효화해야 할 "다른 in-flight 비동기"가 존재하는 구체적 시나리오는 찾지 못했다(과잉 증가라 안전하긴 하나, 인라인 주석의 "함께 무효화해야 한다"는 필연성 주장과 "계약"의 "두 곳뿐" 이라는 단언이 서로 모순된다). 이 refactor 는 "4라운드에 걸쳐 반복된 대칭 가드 누락"을 근절하기 위해 **단일 계약**을 세우는 것이 목적이므로, 그 계약 문서 자체의 정확성은 후속 유지보수 안전성에 직결된다.
  - 제안: JSDoc 을 "세 곳(`teardownSession()`, 언마운트 cleanup, `start()` 자기 교체)" 으로 정정하거나, `start()` 의 `++` 를 단순 read(`const gen = worldGenRef.current;`)로 낮추고 그 경우에도 안전한 이유를 주석에 남겨 "두 곳" 계약과 실제 구현을 일치시킨다.

- **[WARNING]** 언마운트 SSE-leak(W6) fix 에 대한 회귀 테스트 부재 — mutation 으로 실증된 커버리지 공백
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:735-750`(마운트 effect cleanup, 특히 `:746` `worldGenRef.current++;`)
  - 상세: 코드 주석(`:736-739`)은 이 한 줄이 "리뷰 W6(unmount-after-await SSE leak) 도 함께 해소" 한다고 명시적으로 주장한다. 그러나 위 "검증 방법·변이 테스트 4" 로 실증했듯, 이 줄을 제거해도 **채널-웹챗 전체 22개 테스트 파일·364개 테스트 중 단 하나도 실패하지 않는다** — 즉 "언마운트 후 in-flight `getStatus`/`interact` 가 resolve 돼도 `openStream`(새 `EventSource`) 이 호출되지 않는다"를 직접 검증하는 테스트가 어느 위젯 테스트 파일에도 없다. 실제로 plan 문서(`spec-sync-external-interaction-api-gaps.md`)가 스스로 밝힌 mutation 검증 목록("choke point 증가 제거 → 3건, seed 세대 검사 제거 → 3건, sendCommand 세대 검사 제거 → 1건")에도 언마운트 지점은 포함돼 있지 않다 — 즉 작성자 스스로도 이 지점은 mutation-검증하지 않았다. 형제 버그(SSE terminal 도중 seed 부활 — 이번 diff 의 "유령 표면 회귀" 테스트)는 신규 회귀 테스트로 고정됐지만, 동일 등급으로 강조된 W6 는 고정되지 않았다. 이 파일은 이미 4라운드 연속으로 이 계열의 staleness 버그가 재발한 이력이 있어(plan 문서 자체가 명시), 향후 `eslint-disable-next-line` 줄을 "의심스러운 코드"로 오인해 정리하다 이 줄이 삭제돼도 CI 가 잡지 못한다.
  - 제안: `renderHook()` + RTL `unmount()` 을 사용해(`use-token-refresh.test.ts` 의 "언마운트 후 타이머 미발화(cancelled 가드)" 테스트와 대칭 패턴) — in-flight `getStatus`/webhook 응답을 수동 resolve 가능하게 설정 → `unmount()` 호출 → 그 후 resolve → 새 `EventSource` 미생성(또는 dispatch 없음)을 단언하는 회귀 테스트 1개 추가.

- **[WARNING]** 리듀서 자체는 여전히 무방비 — 방어는 4개 호출부의 caller-side 가드에만 의존(defense-in-depth 부재)
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:129-137`(`WAITING` case, 이번 diff 밖) / `codebase/channel-web-chat/src/widget/use-widget.ts:217-226`(`handleEiaEvent` 의 `execution.waiting_for_input` 직접 SSE 분기)
  - 상세: plan 문서 스스로 이번 버그의 "직접 원인" 을 "`widget-state.ts` 의 `WAITING` 이 `ended` 가드 없이 무조건 전이하는 것" 이라고 명시했다. 그런데 채택된 fix 는 리듀서를 건드리지 않고, **호출부(4곳: `start`/`seedWaitingFromStatus`/`sendCommand`/`applyConfig`)에서 stale 이면 dispatch 자체를 하지 않는 방식**으로 증상을 차단한다. 그 결과 `handleEiaEvent` 의 `execution.waiting_for_input` **직접** SSE 분기(실시간 이벤트 콜백, 비동기 `await` 경계가 없어 이번 diff 의 `worldGenRef` 가드 대상이 아님)는 여전히 `dispatch(WAITING)` 을 무조건 실행하며, 오직 "`teardownSession()` 이 `closeStream()` 을 호출하면 실제 브라우저 `EventSource` 는 더 이상 이벤트를 발화하지 않는다"는 **런타임 불변식에만** 의존한다. 이 불변식 자체는 실 브라우저에서 합리적이지만(spec 대상 아님, 테스트 더블 `ControllableEventSource.close()` 는 no-op 이라 이 경로를 테스트로 실증할 수 없음), 리듀서에 `state.phase === "ended"` 가드가 없다는 근본 원인은 이번 diff 로 해소되지 않고 잠재 리스크로 남는다 — 향후 새 async 호출부가 `worldGenRef` 검사를 빠뜨리거나(4라운드째 반복된 실수 패턴), SSE 라이브러리 동작이 바뀌면 같은 계열 버그가 재발할 수 있다.
  - 제안(defense-in-depth, 이번 diff 필수 아님): `widgetReducer` 의 `WAITING`(및 필요 시 다른 진행-상태 전이) case 에 `if (state.phase === "ended") return state;` 형태의 최소 가드를 추가해, caller-side 가드를 빠뜨리는 어떤 경로가 생기더라도 리듀서 레벨에서 최종 방어선을 갖춘다.

- **[INFO]** 리네임 잔존 — 무관 테스트의 과거 주석에 옛 식별자명 잔존
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:216`
  - 상세: "복원된 세션이 이미 terminal" 테스트(이번 diff 로 손대지 않은 기존 블록)의 JSDoc 이 "`start()` 는 `startGenRef` 로 우연히 보호됐으나…" 라는 옛 식별자명을 그대로 쓴다. `use-widget.ts` 안의 동일 사건을 설명하는 병렬 주석(`applyConfig` 근처)은 이번 diff 에서 "`startGenRef`" → "세대 가드" 로 갱신됐으나(파일 2 diff 참조), 테스트 파일 쪽은 갱신되지 않아 이미 코드베이스에 존재하지 않는 이름을 가리킨다. 기능·테스트 정확성에는 영향 없음.
  - 제안: 후속 정리 시 "세대 가드"/`worldGenRef` 로 통일.

## 확인된 정합 사항 (참고)

- `startGenRef` → `worldGenRef` 리네임은 실제 production 코드(`use-widget.ts`) 전역에서 누락 없이 완료됨(잔존 참조는 의도된 역사적 설명문 1건뿐).
- 신규 회귀 테스트("유령 표면 회귀")는 실제 훅 흐름(`start` → `seedWaitingFromStatus` fire-and-forget → SSE terminal → 재-resolve)을 정확히 재현하며, 변이 테스트로 비-vacuous 함을 실증(구 코드 되돌리면 정확히 이 테스트만 실패).
- `spec/7-channel-web-chat/1-widget-app.md §3.1`(84-116행)은 `replay_unavailable` 폴백·terminal 스냅샷 확정·SSE 재오픈 억제 동작을 이미 정확히 서술하고 있으며, 이번 diff 는 순수 내부 구현(비동기 staleness 가드 통합) 리팩터라 관찰 가능한 동작 변경이 없으므로 spec 본문 갱신 불요 — line-level 불일치 없음(SPEC-DRIFT 아님).
- `SeedOutcome`("ended"/"stale"/"continue") 3-state 반환 계약과 `outcome` 게이팅이 `gen` 게이팅과 별도 축이라는 주석 설명(`start()` 내)은 코드 추적으로 실제로 비-redundant 함을 확인(endedRef dedup 조기 return 시 gen 은 안 바뀌지만 outcome="ended" 는 여전히 반환되는 경로 존재).
- TODO/FIXME/HACK/XXX 주석 없음. 모든 반환 경로(`SeedOutcome` 3종, `finalizeEnded` boolean)가 일관되게 처리됨.

## 요약

이번 diff 는 "패널 open eager 시작" 기능 자체를 바꾸지 않는 순수 내부 리팩터로, 4라운드에 걸쳐 반복된 비동기 staleness 가드 누락(startGenRef/sessionRef 동일성/cancelled 지역 플래그 3종 혼재)을 `worldGenRef` 단일 계약으로 통합하고, 그 과정에서 실제로 재현되던 "SSE terminal 종료 후 stale seed 응답에 의한 유령 부활" 버그를 고친다. 직접 실행·타입체크·린트·전체 테스트 스위트(364건) 통과를 확인했고, plan 문서가 주장한 mutation-검증 수치(3/3/1건)를 독립적으로 재현해 모두 일치함을 확인했다 — 핵심 fix 와 신규 회귀 테스트는 신뢰할 수 있다. 다만 (1) "무효화 지점은 두 곳뿐" 이라는 계약 JSDoc 이 실제 3번째 지점(`start()` 자체 증가)과 모순되고, (2) 같은 커밋이 "해소했다"고 주장하는 언마운트 SSE-leak(W6) 수정은 직접 변이 테스트로 확인한 결과 **어떤 테스트도 이를 지키지 못함**(제거해도 0건 실패)이 드러났으며, (3) 근본 원인으로 지목된 리듀서(`widget-state.ts`)의 무조건 전이는 이번에도 손대지 않아 caller-side 가드에만 전적으로 의존하는 구조가 유지된다. 세 가지 모두 현재 기능을 깨뜨리는 활성 버그는 아니지만, 이 정확한 파일·정확한 실패 유형이 이미 4번 재발한 이력을 감안하면 계약 문서 정정과 W6 회귀 테스트 추가가 후속 조치로 권장된다.

## 위험도
MEDIUM
