# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건 발견 (§6.2 webhook 봉투 구조가 같은 문서의 normative 규칙·실제 구현과 불일치). 근본 원인은 `spec/` 문서 자체의 결함이라 developer 권한 밖 — 아래 §planner 인계 참고.

## 전체 위험도
**HIGH** — Critical 은 이번 impl-prep 착수 대상(§6 종결 이벤트 `error`/`durationMs`/`result.outputs`)과 직접 겹치지는 않지만 같은 §6 절 내부의 문서-구현 불일치이며, 이 예시를 그대로 참고하는 외부 webhook 통합자가 실패한다. WARNING 다수(4건)는 impl-prep 단계에서 명시적으로 결정하고 넘어가면 되는 수준.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | §6.2 `execution.waiting_for_input` webhook payload 예시가 `node`/`interaction`/`context` 를 `payload` 로 감싸지 않고 최상위에 flat 나열 — 같은 §6 이 스스로 선언한 "채널별 봉투(normative)" 규칙(webhook 은 `{type,...,payload:{...}}`)을 §6.3/§6.4 는 따르는데 §6.2 만 위반. 실제 구현(`notification-fanout.service.ts` `enqueue({eventBody:{...,payload:event.payload,...}})`)도 모든 이벤트를 `payload` 로 감싼다 — 이 예시를 그대로 구현/파싱하는 외부 통합자는 실패 | `spec/5-system/14-external-interaction-api.md` §6.2 "페이로드 — `execution.waiting_for_input`" jsonc 예시 | 같은 문서 §6 도입부 "채널별 봉투 — 셋이 서로 다르다 (normative)" + §6.3/§6.4 예시 + `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts` 실제 wire | §6.2 JSON 블록을 §6.3/§6.4 와 동일 구조(`{type,executionId,triggerId,workflowId,seq,timestamp,payload:{node,interaction,context}}`)로 재작성 + "webhook 봉투 기준. SSE 는 payload 래퍼 없이…" 주석 부착 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 근본 원인이 `spec/5-system/14-external-interaction-api.md` 본문 텍스트 자체의 결함이며, `spec/` 쓰기는 planner 권한이다(developer 는 read-only). **등급은 CRITICAL 그대로이고 `BLOCK: YES` 도 그대로입니다** — 이 표는 차단을 푸는 장치가 아니라 다음 행동을 지정하는 장치입니다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/` 본문 수정은 developer 권한 밖(read-only). §6.2 예시가 같은 문서 §6 도입부 normative 규칙 및 실제 구현과 불일치하는 순수 spec 문서 결함 | project-planner | `spec/5-system/14-external-interaction-api.md` §6.2 jsonc 예시를 §6.3/§6.4 와 동일한 `payload` 래퍼 구조로 재작성 (3~4줄 패치 예상) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 또는 신규 planner 턴에 항목 추가 권고 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `Execution.error.nodeId` nullable 계약이 `spec/1-data-model.md` 에는 미반영 — 이번 작업이 정확히 이 컬럼에 쓰기 시작하는 지점(노드 없는 엔진 인프라 실패 경로 포함) | `spec/5-system/14-external-interaction-api.md` §6, §6.4 (`nodeId: "uuid" \| null`) | `spec/1-data-model.md` §2.14 "구조" 행(null 변형 없음) | data-model.md §2.14 를 `{nodeId: "uuid"\|null, code, message, details?}` 로 갱신 + "노드 없는 경우 null" 문구 추가. planner 위임 필요(spec 변경) |
| 2 | rationale_continuity | `error.code` 정규 스키마가 "항상 존재"를 전제하지만, 재사용 대상 DB 객체 4곳 중 2곳(`failFirstSegmentSetup`/`failRetryExecution`)은 `code` 를 만든 적이 없고 1곳(`finalizeFailedExecution` 일반 Error 경로)도 조건부로만 존재 | `spec/5-system/14-external-interaction-api.md` §6.4 payload 예시 + "필드 집합(normative)" 표 `error` 행 | `execution-engine.service.ts`(`failFirstSegmentSetup`, `finalizeFailedExecution`), `retry-turn.service.ts`(`failRetryExecution`) 실제 코드 | impl-prep 단계에서 명시적으로 결정: (a) 일반 Error catch 경로에 fallback `code`(예: `EXECUTION_FAILED`) 도입 또는 (b) §6 스키마에서 `code` 를 옵셔널로 정정 + Rationale 근거 문단 추가 |
| 3 | convention_compliance | §6.2 `interaction.{submitUrl,streamUrl,statusUrl,cancelUrl}` 예시가 `/v1/` 버전 세그먼트 + 존재하지 않는 가상 도메인(`api.clemvion.ai`) 사용 — `spec/**` 전체에서 이 4줄에만 등장하는 stale 초안 잔재로 보임 | `spec/5-system/14-external-interaction-api.md` §6.2 URL 4줄 | `spec/5-system/2-api-convention.md` §1 "버전은 URL 경로에 포함하지 않음" + 같은 문서 §4.1 `endpoints` 객체(`/api/external/executions/{id}/interact`, 상대경로) | §4.1 과 동일한 상대경로로 정정, 또는 별도 게이트웨이 도메인이 실재하면 §1/§Rationale 에 명시 + api-convention.md 예외 조항 추가. planner 위임 필요(spec 변경) |
| 4 | plan_coherence | 신규 plan `eia-terminal-payload.md` 가 동일 작업(§6 종결 payload 정리)을 이미 추적 중인 3개 plan(`spec-sync-external-interaction-api-gaps.md`[정본], `spec-draft-eia-notification-payload-contract.md`, `backend-lint-gate-broken-on-main.md`)과 교차 참조 없이 독립 등재 — 구현 후 3개 plan 의 체크박스가 stale 로 남을 위험 | `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표 (`result.outputs`/`durationMs`/`error` 행) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `spec-draft-eia-notification-payload-contract.md`, `backend-lint-gate-broken-on-main.md` (774~791행) | `eia-terminal-payload.md` 에 3개 plan 역참조 추가 + 구현 완료 시 3개 plan 체크박스 동시 완료 절차 포함 |
| 5 | plan_coherence | `eia-terminal-payload.md` 범위가 정본 plan 이 명시한 "동반 필수" 정리(dispatcher back-compat wrap, 유령 타입 필드)를 누락 — `chat-channel.dispatcher.ts:535~568` string/object back-compat wrap 이 존재한 적 없는 plan-name 주석을 가리키고, `types.ts:386~390` `EiaCompletedEvent.result` 가 target §6 이 "설계된 적 없다"고 명시한 `finalNodeId`/`finalPort` 를 여전히 선언 | `spec/5-system/14-external-interaction-api.md` §6 도입부 "삭제된 약속" 콜아웃 | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:535~568`, `codebase/backend/src/modules/chat-channel/types.ts:386~390` | `eia-terminal-payload.md` 범위에 두 파일 추가 (developer 권한 내, planner 위임 불요) |
| 6 | plan_coherence | 동일 코드 블록(`retry-turn.service.ts` `failRetryExecution` :956~965)을 겨냥하는 두 plan(`retry-turn-terminal-guard.md` #2 의 `cancelledBy` 추가, `eia-terminal-payload.md` 의 `error` 객체화)이 서로를 참조하지 않아 구현 순서/충돌 조율 부재 | `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표 (`result.cancelledBy`, `error` 행) | `plan/in-progress/retry-turn-terminal-guard.md` 307~311행 | 같은 턴에 두 항목 함께 처리하거나 최소 plan 간 상호 참조 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `durationMs`/`duration` 표기차·§6 SoT 포인터 원칙·`result.outputs` 소스·Idempotency-Key 캐시 키 스코프 전부 대조 확인 완료, 충돌 없음 | `spec/data-flow/15-external-interaction.md`, `spec/conventions/redis-keys.md`, `spec/5-system/6-websocket-protocol.md:205`, `spec/3-workflow-editor/3-execution.md:283-287` | 없음(현행 유지) |
| 2 | rationale_continuity | `result.outputs` 신규 노출이 §R17 outputData 보안 invariant 와 구조적으로는 정합(단일 sink 경유 조건부)하나 이 사실이 spec 텍스트에 문서화되어 있지 않음 | `spec/5-system/14-external-interaction-api.md` §6.3 `result.outputs` | 기존 `emitExecutionEvent`/`fanoutEnvelope` 경로만 사용 + §6.3 또는 Rationale 에 "sanitizePayloadForWs 수준, REST 의 deepRedactSecrets 보다 약함" 한 줄 추가 |
| 3 | convention_compliance | "Conversation Thread §4.4.6" 인용(라인 472, 673)이 실제로는 `spec/5-system/6-websocket-protocol.md` 소속 헤딩을 가리키는 오귀속 인용 — `conversation-thread.md` 에는 대응 앵커 없음 | `spec/5-system/14-external-interaction-api.md` 라인 472, 673 | `[WS §4.4.6](../5-system/6-websocket-protocol.md#446-...) / [Conversation Thread §5.1](../conventions/conversation-thread.md#51-...)` 로 SoT 분리 표기 |
| 4 | plan_coherence | `eia-terminal-payload.md` 의 "nodeId 필수 여부(planner 위임 필요)" 미해결 표시는 target 이 이미 `nodeId: "uuid" \| null` 로 답변한 상태 — 재확인 불요 | `spec/5-system/14-external-interaction-api.md` §6.4 (커밋 `9a4d3e32b`) | `--impl-prep` 재확인 시 planner 에스컬레이션 없이 (b) 경로(확보 가능한 경로에만 채움)로 바로 진행 |
| 5 | naming_collision | `spec/5-system/14-external-interaction-api.md` origin/main 대비 diff 0줄 — 이번 라운드는 코드 전용 착수(spec 은 PR #1166 에서 이미 확정), `error`/`durationMs`/`result.outputs` 3개 필드 모두 기존 컨벤션·코퍼스와 신규 명명 충돌 없음 확인 | `plan/in-progress/eia-terminal-payload.md` 범위 3필드 | 없음(현행 유지) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `Execution.error.nodeId` nullable 이 EIA/adapter 는 정합, `spec/1-data-model.md` 만 미반영(WARNING). 그 외 SoT 포인터·캐시 키 등은 전부 정합 확인 |
| rationale_continuity | LOW | `error.code` "항상 존재" 전제가 실제 4개 emit 지점 중 2곳(+조건부 1곳)에서 어긋남(WARNING). `result.outputs` 보안 수준은 R17 과 구조적 정합이나 문서화 공백(INFO) |
| convention_compliance | MEDIUM (Critical 1건 포함) | §6.2 webhook 봉투 구조가 같은 문서의 normative 규칙·실제 구현과 불일치(CRITICAL). §6.2 URL `/v1/`+가상도메인 정합 위반(WARNING). 그 외 frontmatter·Redis 키·secret-store·audit action·swagger·명명 규약은 전부 정합 |
| plan_coherence | MEDIUM | 신규 plan 이 3개 기존 plan 과 교차참조 없이 중복 등재, 정본 plan 의 "동반 필수" 정리 누락, 동일 코드 블록을 겨냥한 별도 plan 과 조율 부재 — 전부 WARNING, spec-plan 직접 충돌은 없음 |
| naming_collision | NONE | spec diff 0줄, 3개 target 필드 모두 기존 컨벤션과 정합·코퍼스 신규 충돌 없음 |

## 권장 조치사항
1. **(BLOCK 해소)** planner 턴에서 `spec/5-system/14-external-interaction-api.md` §6.2 jsonc 예시를 §6.3/§6.4 와 동일한 `payload` 래퍼 구조로 재작성(§planner 인계 #1). 3~4줄 패치로 예상되며 이번 impl-prep 착수 대상과는 별개 커밋으로 처리 가능.
2. impl-prep 진행 전 `error.code` 결측 4개 emit 지점 중 실측된 2~3곳에 대해 (a) fallback code 도입 또는 (b) 스키마 옵셔널화 중 하나를 명시적으로 결정 (WARNING #2).
3. `eia-terminal-payload.md` 에 관련 3개 plan(`spec-sync-external-interaction-api-gaps.md` 등) 역참조 추가 + `retry-turn-terminal-guard.md` #2 와 조율, dispatcher back-compat wrap·`types.ts` 유령 필드 정리를 범위에 포함 (WARNING #4~#6).
4. 여유가 되면 §6.2 URL `/v1/`+가상도메인 정정(WARNING #3)과 `spec/1-data-model.md` §2.14 nodeId nullable 갱신(WARNING #1)도 같은 planner 턴에 함께 처리 — 둘 다 근접 위치(§6 절/nodeId 필드)라 별도 턴 비용이 낮음.
5. INFO 항목(Conversation Thread 인용 오귀속 등)은 우선순위 낮음 — 다음 spec 정리 라운드에 포함.