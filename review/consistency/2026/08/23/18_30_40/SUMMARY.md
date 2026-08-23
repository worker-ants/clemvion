# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건)

## 전체 위험도
**MEDIUM** — CRITICAL 없음, 착수를 막을 사유 없음. 다만 신규 fail-closed allowlist 가 `getStatus` 의 waiting `nodeOutput` 출구 한 곳에만 적용되고 (a) 같은 `getStatus` 의 terminal `result`/`error` 출구, (b) 별도의 SSE/fanout 경로(`websocket.service.ts` `toFanoutEnvelope`) 는 기존 fail-open deny-list 로 남는데, 이 범위·잔여가 아직 `plan/`·spec 어디에도 명시 기록돼 있지 않다 — 이 저장소가 §R17 에서 반복 겪은 "부분 해소를 전체로 flip" 패턴의 세 번째 재발 소지로 plan_coherence checker 가 MEDIUM 을 매겼다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | 신규 fail-closed allowlist 가 `getStatus` 세 출구(waiting `nodeOutput`/terminal `result`/terminal `error`) 중 waiting `nodeOutput` 한 곳에만 적용되는데, §R17 이 확립한 "적용 범위는 총칭이 아니라 열거" 원칙에 따른 범위·제외 근거가 아직 spec 에 기록되지 않음 | `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`getStatus`), `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (`NODE_OUTPUT_ALLOWED_KEYS`/`allowlistNodeOutputKeys`) | `spec/5-system/14-external-interaction-api.md` §Rationale R17 "3-출구 열거" 서술 | planner 턴에서 R17 flip 시 (a) 적용 대상은 waiting `nodeOutput` 1곳뿐, (b) terminal `result`/`error` 는 `NodeHandlerOutput` shape 이 아니라 의도적 제외, (c) SSE emit 은 여전히 `sanitizePayloadForWs` 부분 방어만이라는 기존 서술 유지 — 3가지를 명시적으로 적을 것 |
| 2 | plan_coherence | REST `getStatus` 만 fail-closed 로 바뀌고, 동일 `_retryState`(및 향후 미지 필드) 를 나르는 SSE/fanout 경로(`toFanoutEnvelope`, `emitExecutionEvent`/`emitNodeEvent` 공용 초크포인트)는 여전히 `stripExternalOnlyFields`(fail-open deny-list, `EXTERNAL_STRIPPED_FIELDS=['llmCalls']`) 만 적용되어 그대로 남는데, 이 비대칭이 어떤 plan 문서에도 등재돼 있지 않음. chat-channel 어댑터가 같은 fanout subject 를 구독해 외부 채널로도 전파되므로 blast radius 가 REST 열람자보다 넓음. §R17 은 REST·SSE 가 "wire 형식 동일" 이라 명시 주장 중이라 이 PR 착지 후 그 서술이 더 이상 참이 아니게 됨 | `codebase/backend/src/modules/websocket/websocket.service.ts` (`toFanoutEnvelope`) | `plan/in-progress/nodeoutput-allowlist.md` §작업 (getStatus 로만 scope 명시), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `spec/5-system/14-external-interaction-api.md` §R17 wire-parity 주장 | 둘 중 하나를 plan 에 명시: (a) `toFanoutEnvelope()` 에도 동일 allowlist 대칭 적용해 wire-parity 유지, 또는 (b) REST-only 로 범위를 명시적으로 좁히고 `nodeoutput-allowlist.md` §작업에 "SSE emit 잔여는 별도 후속" 항목 추가 + R17 flip 문구를 "`getStatus` fail-closed / SSE·fanout 은 여전히 deny-list(잔여)" 로 정확히 좁히고 + `spec-sync-external-interaction-api-gaps.md` 에 SSE 후속 항목 신규 등재 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `nodeOutput` allowlist 제외 목록 문서화(JSDoc)가 `_resumeCheckpoint` 를 명시하지 않음 — allowlist 는 fail-closed 라 실제로는 차단되므로 동작 결함 아님 | `codebase/backend/src/shared/utils/strip-external-only-fields.ts` JSDoc vs `spec/conventions/node-output.md` Principle 0 (`_resumeState`/`_resumeCheckpoint`/`_retryState` 3필드 예외) | JSDoc 예외 목록에 `_resumeCheckpoint` 추가. planner 턴 spec 화 시 node-output.md 의 3-필드 예외 집합을 그대로 인용해 별도 목록을 만들지 말 것 |
| 2 | rationale_continuity | `NODE_OUTPUT_ALLOWED_KEYS` JSDoc "발명하지 않고 파생" 표현이 실제로는 `keyof NodeHandlerOutput` 타입 파생이 아니라 손으로 맞춘 평행 리스트. 다만 allowlist(fail-closed) 방향이라 과거 마커-리스트 hand-sync drift(fail-open) 사고와 같은 보안 리스크는 아님 | `codebase/backend/src/shared/utils/strip-external-only-fields.ts` `NODE_OUTPUT_ALLOWED_KEYS` JSDoc | JSDoc 문구를 "수동으로 맞춘 리스트(파생 아님)" 로 낮추거나, `keyof NodeHandlerOutput` 기반 컴파일타임 assertion 링크. 필수 차단 사유 아님 |
| 3 | convention_compliance | `EIA-NF-05` 의 동시성 lock 절 plain-text cross-reference 가 `§5.3` 으로 돼 있으나 실제 내용은 `§5.6`(동시성/Lock)에 있음 — 하이퍼링크가 아니라 자동 가드 사각지대 | `spec/5-system/14-external-interaction-api.md` §3.5 `EIA-NF-05` 행 | `§5.3` → `§5.6` 으로 정정 (이번 작업과 무관한 기존 오류지만 실측 확인됨) |
| 4 | convention_compliance | 이번 구현이 완료되면 §R17 "`nodeOutput` 일반 키 allowlist (미구현·잔여)" 서술과 `node-output.md` Principle 0 예외 레지스트리(=위 WARNING #1과 동일 근본 이슈, positive framing) 가 동시 stale 화될 예정 | §R17 해당 불릿 | WARNING #1 의 조치와 동일 — 별도 조치 불요, 인지용 기록 |
| 5 | plan_coherence | `nodeoutput-allowlist.md` §작업 완료 후 상위 트래커(`spec-sync-external-interaction-api-gaps.md`) 체크박스를 `[x]` 로 flip 하는 마무리 단계가 작업 목록에 없어 stale `[ ]` 로 남을 위험 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — `- [ ] **getStatus 일반 nodeOutput 키-allowlist** (§R17 잔여)` 행 | `nodeoutput-allowlist.md` §작업 마지막에 "상위 트래커 체크박스 flip + 근거 기록" 단계 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 6관점 전수 대조에서 충돌 없음. `_resumeCheckpoint` 문서화 누락 INFO 1건만 |
| rationale_continuity | LOW | R17 "3-출구 열거" 원칙이 신규 방어에는 1개 출구로만 좁혀졌는데 spec 미반영 (WARNING). JSDoc 과장 표현 (INFO) |
| convention_compliance | LOW | 정식 규약 전반 정합. §5.3→§5.6 참조 오류 (INFO), R17 예정 stale화 인지 (INFO) |
| plan_coherence | MEDIUM | REST 만 fail-closed, SSE/fanout 은 fail-open 잔존 — 비대칭이 plan 에 미등재 (WARNING). 상위 트래커 체크박스 동기화 누락 (INFO) |
| naming_collision | NONE | ID/타입명/endpoint/이벤트명/env·설정키/파일경로 6축 전수 grep, 충돌 없음 |

## 권장 조치사항
1. (WARNING #1, #2 해소 우선) planner 턴에서 §R17 flip 전에 fail-closed allowlist 의 정확한 적용 범위를 확정할 것: `getStatus` waiting `nodeOutput` 1곳만 대상으로 하고 terminal `result`/`error`, SSE/fanout(`toFanoutEnvelope`) 은 의도적 제외라는 3-출구/2-채널 열거를 spec 에 명시.
2. SSE/fanout 경로(`websocket.service.ts` `toFanoutEnvelope`)에 동일 allowlist 를 대칭 적용할지, 아니면 REST-only 로 범위를 좁히고 후속 항목으로 별도 등재할지 결정해 `nodeoutput-allowlist.md`·`spec-sync-external-interaction-api-gaps.md` 양쪽에 기록.
3. `nodeoutput-allowlist.md` §작업에 "상위 트래커 체크박스 flip" 마무리 단계 추가.
4. `NODE_OUTPUT_ALLOWED_KEYS` JSDoc 예외 목록에 `_resumeCheckpoint` 추가하고, "타입에서 파생" 표현을 실제 구현(수동 리스트)에 맞게 정정하거나 컴파일타임 assertion으로 뒷받침.
5. (이번 작업과 무관, 발견된 김에) `spec/5-system/14-external-interaction-api.md` §3.5 `EIA-NF-05` 의 `§5.3` → `§5.6` 참조 오류 정정.