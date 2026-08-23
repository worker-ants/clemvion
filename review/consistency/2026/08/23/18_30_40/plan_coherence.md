# Plan 정합성 검토 — `spec/5-system/14-external-interaction-api.md` (impl-prep)

## 발견사항

- **[WARNING]** REST `getStatus` 만 fail-closed 로 바뀌고 SSE/fanout(`_retryState` 류) 은 fail-open 으로 남는데, 이 잔여가 어디에도 등재돼 있지 않다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "**`nodeOutput` 일반 키 allowlist (미구현·잔여)**" 불릿, 그리고 R17 본문의 "SSE 와의 역할 분담" — "`getStatus.context` 는 SSE `waiting_for_input` wire 형식과 **동일하게** 만들어 위젯이 `parseWaitingForInput` 을 재사용" 서술
  - 관련 plan: `plan/in-progress/nodeoutput-allowlist.md` §설계/§작업 (`stripExternalOnlyFields` **옆에** allowlist 필터 신설 — "**`getStatus` 경로에 추가**" 로 명시 scoping), 상위 트래커 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 `- [ ] **getStatus 일반 nodeOutput 키-allowlist** (§R17 잔여)` 항목
  - 상세: 코드 실측 — `codebase/backend/src/modules/websocket/websocket.service.ts` 의 `toFanoutEnvelope()`(`emitExecutionEvent`/`emitNodeEvent` 공용, SSE `waiting_for_input` 을 포함한 모든 execution/node 이벤트가 통과하는 초크포인트) 는 `stripExternalOnlyFields`(=plan 이 "fail-open deny-list" 라 부르는 바로 그 함수, `EXTERNAL_STRIPPED_FIELDS = ['llmCalls']`) 만 적용한다. plan 이 신설하는 fail-closed allowlist 는 `interaction.service.ts`의 `getStatus()` 경로에만 추가되므로, **동일한 `_retryState`(및 향후 미지 필드) 누출이 SSE `waiting_for_input`/node 이벤트 경로로는 이 PR 이후에도 그대로 남는다.** chat-channel 어댑터(텔레그램 등)도 같은 fanout subject 를 in-process 구독하므로 blast radius 는 REST 열람자보다 넓다(외부 채널로도 전파). 그런데 R17 은 REST·SSE 가 "wire 형식 동일" 이라고 명시적으로 주장하고 있어, 이 PR 이 착지하면 그 서술이 더 이상 참이 아니게 된다(REST 는 allowlist 로 좁아지고 SSE 는 그대로 넓다). plan 의 체크리스트 어디에도 이 비대칭을 인지하거나 SSE 쪽 후속을 등재하는 항목이 없다.
  - 이 저장소는 정확히 이 패턴(부분 해소를 전체 해소처럼 spec 에 flip 해 버리는 것)을 이미 같은 파일에서 두 번 겪었다 — §5.5(`410` 분기 누락, 2026-08-11 등재)와 `durationMs`(취소선 절반만 쳐서 오독 유발, 2026-08-13 등재) 항목이 바로 그 사례로 이 트래커에 교훈까지 남아 있다. `nodeoutput-allowlist.md` 의 작업 순서상 "(planner 턴) EIA §R17 잔여 문구 flip" 이 구현보다 먼저 오는데, 이 flip 이 SSE 잔여를 별도로 남기지 않고 "구현됨" 으로 통째로 덮으면 세 번째 재발이 된다.
  - 제안: 둘 중 하나를 plan 에 명시적으로 반영. (a) `toFanoutEnvelope()` 에도 동일 allowlist 를 대칭 적용해 R17 의 wire-parity 주장을 계속 참으로 유지하거나, (b) REST-only 로 범위를 유지하려면 `nodeoutput-allowlist.md` §작업에 "SSE emit 잔여는 별도 후속" 항목을 명시하고, R17 flip 문구가 "`getStatus` 는 fail-closed, SSE/fanout 은 여전히 deny-list(잔여)" 로 정확히 좁혀지도록 planner 턴에 지시하며, `spec-sync-external-interaction-api-gaps.md` 에 SSE 쪽 후속 항목을 새로 등재한다.

- **[INFO]** 완료 시 상위 트래커 체크박스 동기화가 plan 작업 목록에 없음
  - target 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — `- [ ] **getStatus 일반 nodeOutput 키-allowlist** (§R17 잔여)` 행
  - 관련 plan: `plan/in-progress/nodeoutput-allowlist.md` §작업
  - 상세: 같은 트래커 파일의 다른 모든 완료 항목(`durationMs`, outbound rate-limit 등)은 "완료(날짜, commit)" 형태로 상위 체크박스를 `[x]` 로 flip 하고 근거를 남기는 관행을 따른다. `nodeoutput-allowlist.md` 의 작업 목록에는 이 마무리 단계가 없어, 이 세션이 끝나도 상위 트래커가 stale `[ ]` 로 남을 위험이 있다(이 저장소가 이미 "자기를 닫은 PR 이 자기 이름을 부르지 않으면 영영 미체크로 남는다" 고 기록한 바로 그 형태).
  - 제안: `nodeoutput-allowlist.md` §작업 마지막에 "상위 트래커 체크박스 flip + 근거 기록" 단계 추가.

## 요약

`nodeoutput-allowlist.md` 는 상위 트래커(`spec-sync-external-interaction-api-gaps.md`)와 EIA §R17 잔여 항목을 정확히 겨냥하고 있고, 설계(NodeHandlerOutput 5필드 invariant + wire-only 4키에서 파생)도 `spec/conventions/node-output.md` Principle 0 및 완결된 D1~D6 결정과 충돌하지 않는다 — fail-closed 설계 자체가 node-output-redesign(Phase E, 여전히 in-progress) 이 나중에 새 top-level 필드를 추가하더라도 자동으로 안전하므로 그 병행 plan 과도 구조적으로 충돌하지 않는다. `context` 스키마(`NodeOutputContextDto.nodeOutput`) 도 `additionalProperties` 열린 맵이라 이번 필터링이 DTO/OpenAPI 계약을 깨지 않는다. 유일한 실질 갭은 REST `getStatus` 만 고치고 동일 메커니즘(`stripExternalOnlyFields`)을 쓰는 SSE/fanout(`websocket.service.ts`) 경로는 그대로 두면서, 그 비대칭을 어떤 plan 문서도 명시적으로 추적하지 않는다는 점이다 — target spec 자신의 "wire 형식 동일" 주장과 충돌할 소지가 있고, 이 저장소가 반복해 겪은 "부분 해소를 전체로 flip" 실수의 세 번째 재발 위험을 안고 있다. 구현 착수를 막을 결정 충돌은 없으나, planner 턴 진입 전에 SSE 잔여 처리 방침을 plan 에 명문화할 것을 권고한다.

## 위험도

MEDIUM
