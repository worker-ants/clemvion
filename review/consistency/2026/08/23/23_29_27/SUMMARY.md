# Consistency Check 통합 보고서

**BLOCK: YES** — cross_spec checker 가 CRITICAL 1건을 보고했다. 5개 checker 전원의 전문을 인라인으로 확보했으므로(전문 누락 checker 없음), 아래 판정은 완전한 근거에 기반한다.

## 전체 위험도
**CRITICAL** — target(`spec/5-system/14-external-interaction-api.md` §R17, `6-websocket-protocol.md` §4.4)이 반복 단언하는 "REST 와 SSE 는 같은 강도다"가, 같은 영역의 기존(비수정) spec 내용(§4.1 표·§5.2 SSE 카탈로그) 및 실제 코드(`allowlistFanoutNodeOutput`)와 직접 모순된다 — `execution.node.completed` 가 나르는 `envelope.output`(AI Agent multi-turn 종결 시 `_retryState` 포함 가능)이 이번 allowlist 확장에서 빠져 SSE/chat-channel fanout 으로 무필터 유출된다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `allowlistFanoutNodeOutput`(`websocket.service.ts`)이 `envelope.nodeOutput`(waiting) 과 `envelope.buttonConfig.nodeOutput`(buttons waiting) 두 자리만 검사하고, `execution.node.completed` 가 나르는 `envelope.output`(`NodeHandlerOutput` 전체, `_retryState` 포함 가능)은 검사하지 않음. 새 캐너리 테스트(`websocket.service.spec.ts`, `node-output-allowlist.spec.ts`)도 이 표면을 실행하지 않아 갭이 미검출로 통과함 | `spec/5-system/14-external-interaction-api.md` §R17 SSE/fanout 행("**REST 와 SSE 는 같은 강도다**"), `spec/5-system/6-websocket-protocol.md` §4.4 blockquote("외부로 나가는 clone 에만... 엔진 내부 필드가 제거된다") | 같은 영역 기존 spec: `spec/5-system/6-websocket-protocol.md` §4.1 표(`execution.node.completed` payload 에 `output` 필드, AI Agent multi-turn `port:'error'` 종결 포함 명시) · `spec/5-system/14-external-interaction-api.md` §5.2(SSE 이벤트 카탈로그가 `execution.node.completed` 를 "모든 비차단 노드에 대한 디버깅 firehose"로 명시, chat-channel adapter 가 이를 픽업한다고 서술) | (코드, 최우선) `allowlistFanoutNodeOutput` 에 `envelope.output`(`NODE_COMPLETED` 등이 나르는 `NodeHandlerOutput`) 검사 경로 추가 — REST `getStatus` 와 동일하게 `allowlistNodeOutputKeys` 적용. (spec) 코드 수정 전까지 §R17 "같은 강도" 서술과 WS §4.4 "내부 필드 제거됨" 서술을 취소선으로 보류하고 잔여 갭으로 재등재. (plan) `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 해당 `[x]` 를 되돌리거나 새 후속 항목으로 재오픈 |

## planner 인계 (권한 밖 Critical)

> 해당 없음 — 위 CRITICAL 의 1차 조치는 `codebase/backend/src/modules/websocket/websocket.service.ts` 의 `allowlistFanoutNodeOutput` 확장으로, developer 자신의 쓰기 권한(`codebase/**`) 범위 안에서 완결 가능하다. spec 서술("REST 와 SSE 는 같은 강도다")은 코드가 고쳐지면 그대로 참이 되므로 정책·요구사항 자체를 바꿀 필요가 없다. 단, developer 가 이번 턴에 코드를 고치지 않고 spec 의 "같은 강도" 주장만 되돌리기로 택한다면 그 문장은 API 계약 성격이라 §자기-반증형 소정정 예외(조건 2, "API 계약은 해당 없음")에 해당하지 않으므로 그 경로는 planner 턴이 필요하다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `toFanoutEnvelope` 파이프라인이 이번 diff 로 4단계(`strip → nodeOutput allowlist → routing`)가 됐는데, "구현 좌표계 SoT"를 자처하는 `spec/conventions/egress-masking.md` §2 는 여전히 3단계(`maskWireEnvelope → stripExternalOnlyFields → attachRoutingContext`)로만 서술 | `spec/5-system/14-external-interaction-api.md` §R17 새 절, `spec/5-system/6-websocket-protocol.md` §4.4 새 caveat | `spec/conventions/egress-masking.md` §2 순서 서술, §3 "표를 갱신한 실례" 목록(이번 건 미등재) | `egress-masking.md` §2 순서에 `allowlistFanoutNodeOutput` 단계 삽입 또는 §3 실례 목록에 이번 건 추가 |
| 2 | plan_coherence | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` L183-187 가 "SSE·fanout 은 잔여" + "정본 트래커에 별도 항목이 서 있다"고 단정 서술하는데, 본 PR 이 바로 그 SSE/fanout 잔여를 닫아 지금은 거짓 | (참조원) `spec/5-system/14-external-interaction-api.md` §R17 SSE 행 flip, `spec/5-system/6-websocket-protocol.md` §4.4 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` L183-187 (구문 자체가 stale) | 해당 plan 문장에 "SSE/fanout 도 2026-08-23(`sse-nodeoutput-allowlist` PR)에 닫혔다" 후속 각주 추가(원문은 보존, 각주만 삽입 — 저장소 관례) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 "SSE/fanout `nodeOutput` 은 fail-open deny-list" 항목이 `[x]` 로 체크됐으나 위 CRITICAL 이 사실이면 시기상조 | 해당 plan 파일 diff | Critical #1 처리 후 체크박스 재조정(코드 수정 완료 시 그대로 유지, 미수정 시 되돌림) |
| 2 | convention_compliance | `NODE_OUTPUT_ALLOWED_KEYS` 키 목록이 배열·JSDoc 표·spec 표 세 곳에 중복(이번 diff 로 spec 표까지 추가돼 3중화). drift 위험은 기존 패턴의 연장이라 신규 위험은 아님 | `spec/5-system/14-external-interaction-api.md` §R17 새 표 | (강제 아님) 새 키 추가 시 "배열 → JSDoc 표 → spec 표" 동시 갱신 필요를 spec 표 옆에 한 줄 명시 |
| 3 | rationale_continuity | `node-output.md` Principle 0(닫힌 5필드+3예외 레지스트리) vs wire-only 카브아웃 키가 이번 diff 로 4→8키로 확대되어 거리감이 넓어짐. 이미 `spec-sync-external-interaction-api-gaps.md` 에 owner=planner 로 추적 중인 기존 gap 의 연장 | `codebase/backend/src/shared/utils/node-output-allowlist.ts` L47-48(JSDoc 표), L73-89(배열) | 다음 planner 턴에서 `node-output.md` Principle 0 에 "wire 조립 레이어의 wire-only 필드는 `NodeHandlerOutput` 계약 밖" 각주 추가 |
| 4 | naming_collision | 신규 wire 전용 키 `nodeOutput.title`(카드 제목) 이 `spec/5-system/6-websocket-protocol.md` §4.4 `notification.new.title`(알림 제목)과 동명이나, 선언 위치·값 도메인이 갈려 W1/W2 급 오독 위험은 없음 | `node-output-allowlist.ts` `NODE_OUTPUT_ALLOWED_KEYS`, WS §4.4 알림 이벤트 표 | 조치 불요(참고 기록). `notification.new` 가 향후 `nodeOutput` 을 payload 로 실어야 하면 그때 재검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | `execution.node.completed` 의 `envelope.output`(`_retryState` 포함 가능)이 신규 allowlist 미적용 — "REST=SSE 강도" 주장이 §4.1/§5.2 기존 spec 과 모순 |
| rationale_continuity | NONE | §R17/WS §4.4 정정이 과거 Rationale·`llmCalls` strip-only 결정을 훼손하지 않음. 직전 라운드 WARNING 2건 해소 확인. Principle 0 거리감은 이미 추적 중인 INFO |
| convention_compliance | LOW | `egress-masking.md` §2 파이프라인 순서 서술이 이번 4단계 배선을 반영 못해 stale (WARNING). 그 외 `node-output.md`·`15-chat-channel.md`·코드 대조는 전부 정합 |
| plan_coherence | LOW | 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)는 diff 와 정합. 인접 plan(`spec-draft-eia-62-waiting-payload.md`)의 "SSE·fanout 잔여" 서술만 stale (WARNING) |
| naming_collision | NONE | 직전 W1(`nodeType`)·W2(`payload`) 동명 충돌은 disambiguation blockquote 로 실측 해소. 신규 `title` 동명은 오독 위험 낮아 INFO |

## 권장 조치사항
1. **(BLOCK 해소 최우선)** `codebase/backend/src/modules/websocket/websocket.service.ts` 의 `allowlistFanoutNodeOutput` 을 확장해 `envelope.output`(`NODE_COMPLETED` 등이 나르는 `NodeHandlerOutput`)에도 `allowlistNodeOutputKeys` 를 적용한다. 캐너리 테스트에 `NodeEventType.NODE_COMPLETED` + `_retryState` 포함 shape 를 추가해 실측 검증한다.
2. 위 코드 수정이 완료되면 §R17/WS §4.4 의 "같은 강도다" 서술은 그대로 두어도 되고, 만약 이번 턴에 수정하지 못한다면 해당 서술을 취소선으로 보류하고 잔여 갭으로 재등재한다(§자기-반증형 소정정 예외는 API 계약 문장이라 적용 불가 — planner 턴 필요).
3. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 관련 체크박스를 Critical #1 처리 결과에 맞춰 재조정한다.
4. WARNING #1: `spec/conventions/egress-masking.md` §2 파이프라인 순서에 `nodeOutput allowlist` 단계를 추가하거나 §3 실례 목록에 이번 건을 등재한다.
5. WARNING #2: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` L183-187 에 SSE/fanout 이 2026-08-23 에 닫혔다는 후속 각주를 추가한다.