# Rationale 연속성 검토 — spec/5-system/14-external-interaction-api.md (§6 종결 이벤트 payload)

검토 대상 작업: `plan/in-progress/eia-terminal-payload.md` (§6 종결 이벤트 필드 — `error` 객체 형태 · `durationMs` · `result.outputs`) 착수 전 `--impl-prep` 검토.

## 발견사항

- **[WARNING]** `error.code` 정규 스키마가 "항상 존재"를 전제하지만, 재사용 대상 DB 객체 2/4 지점은 `code` 를 만든 적이 없다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.4 `execution.failed` payload 예시 (`"code": "EXECUTION_TIMEOUT" | ... ,`) 및 §"종결 이벤트의 필드 집합 (normative)" 표 (`error` 행 — "목표는 `{code, message, nodeId, details?}`")
  - 과거 결정 출처: 같은 문서 §R13 "WS 평면 ack 에러 코드 ↔ EIA REST 에러 코드 매핑 원칙" (에러 코드는 표면별로 닫힌 대응 관계를 가져야 한다는 원칙), 그리고 이 문서 자체의 반복된 교정 이력 — §R8 은 "구현이 이 목록을 조건으로 옮길 때 단일 비교로 축약하면 안 된다 — 열거를 그대로 조건에 옮겨야 한다"고 명시했고, 실제로 커밋 `a80599700`("§R8 이 열거한 409·410 이 멱등 캐시에서 빠져 있었다 — 첫 수정은 dead code 였다")가 바로 "정규 목록 중 일부만 실제로 채워진다"는 동일 결함 class 를 다룬 선례다.
  - 상세: plan(`eia-terminal-payload.md`)은 "4곳 중 3곳은 객체를 이미 만들어 DB 에 저장하고 있고 emit 만 그걸 버린다 — 새로 계산할 것이 없어 작업이 작고 안전하다"고 전제한다. 그러나 실제 코드를 확인하면:
    - `execution-engine.service.ts` `failFirstSegmentSetup` → `row.error = { message: errMessage }` — **`code` 없음**
    - `retry-turn.service.ts` `failRetryExecution` → `execution.error = { message: errMessage }` — **`code` 없음**
    - `execution-engine.service.ts` `finalizeFailedExecution` → `savedExecution.error = { message, ...(ErrorPortFallbackError|ExecutionTimeLimitError 인 경우만 code) }` — **일반 `Error` 로 실패하는(가장 흔한) 경로는 `code` 없음**
    - `execution-engine.service.ts` `finalizeStalledExhausted` → `{ code: 'WORKER_HEARTBEAT_TIMEOUT', message }` — 여기만 `code` 있음
    즉 "이미 있는 객체를 그대로 옮기면 끝"이라는 전제는 `message`(그리고 일부 `nodeId`)에는 맞지만 `code` 에는 맞지 않는다. §6 의 "이 표가 전부다"/정규 필드 집합 선언(commit `9a4d3e32b` 이 §6 을 단일 SoT 로 재작성하며 명시)은 `code` 를 옵셔널 표기(`?`) 없이 열거하므로, 이 gap 을 그대로 두고 emit 하면 다수 실패 경로에서 `error.code` 가 결측된 payload 가 나가 정규 계약을 어긴다.
  - 제안: `--impl-prep` 단계에서 `nodeId` 에 대해 이미 하고 있는 것과 같은 방식으로 `code` 도 명시적으로 갈라야 한다 — (a) 일반 `Error` catch 경로에 fallback 코드(예: `EXECUTION_FAILED`/`UNKNOWN_ERROR`)를 도입하거나, (b) §6 스키마에서 `code` 를 옵셔널로 정정(단 `## Rationale` 에 왜 일부 경로는 code 가 없는지 새 근거 문단 필요 — 현재 §6 에는 그런 문구가 전혀 없다). 아무 결정도 없이 `row.error`/`execution.error` 를 그대로 옮기는 것은 두 선택지 중 어느 쪽도 명시하지 않은 채 §R13/§R8 의 "닫힌 목록·표면별 코드 고정" 원칙을 조용히 좁히는 결과가 된다.

- **[INFO]** `result.outputs` 신규 노출이 §R17 의 outputData 보안 invariant 를 계승하는지 spec 텍스트가 침묵
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.3 `execution.completed` payload (`result.outputs` — Planned)
  - 과거 결정 출처: 같은 문서 `## Rationale` R17 "`getStatus` 의 ... outputData 표면 제약(보안)" — "`getStatus`·SSE fanout 모두 `NodeExecution.outputData`(→`nodeOutput`)와 `conversationThread` 를 동봉하므로 이들은 **공개 EIA 표면**으로 흘러간다... `getStatus` 는 `nodeOutput` 전체 + terminal `result`(COMPLETED)/`error`(FAILED)의 `outputData` 를 `deepRedactSecrets` 로 마스킹한다(REST 는 sanitizePayloadForWs 미적용 경로라 필수)"
  - 상세: 코드 확인 결과 `interaction.service.ts` `getStatus()` 는 실제로 `execution.outputData` 에 `deepRedactSecrets` 를 적용해 REST 로 이미 반환하고 있다(§R17 과 일치). 반면 `WebsocketService.emitExecutionEvent` 는 단일 sink 진입 시 `sanitizePayloadForWs`(credential-**키** 기반 마스킹, `deepRedactSecrets` 보다 얕음)만 적용하고, SSE·webhook(NotificationFanout)은 그 sink 의 fanout envelope 를 그대로 받는 구조다. R17 자신이 "REST 는 sanitizePayloadForWs 미적용 경로라 필수"라고 적어 WS/SSE/webhook 쪽은 `sanitizePayloadForWs` 수준으로 충분하다는 입장을 이미 취했으므로, `result.outputs` 를 기존 `emitExecutionEvent` 호출부에 필드로 추가하기만 하면 구조적으로는 R17 의 기존 결정과 정합한다(신규 sink 를 만들지만 않으면 됨 — R10 단일 sink 원칙 준수 조건부).
  - 제안: 이 정합은 "우연히 단일 sink 를 거치기 때문"이지 §6.3 문서에 명시된 것은 아니다. 구현 시 (a) 반드시 기존 `emitExecutionEvent`/`fanoutEnvelope` 경로로만 `result.outputs` 를 흘려보내고 webhook 전용 별도 조합 경로를 만들지 않을 것, (b) §6.3 에 "outputs 는 R17 과 동일하게 `sanitizePayloadForWs` 수준(키 기반)의 부분 방어만 받으며, REST `getStatus` 의 `deepRedactSecrets` 보다 약하다"는 한 줄을 §Rationale 또는 본문에 추가해 두 필드(REST `result` vs webhook/SSE `result.outputs`)의 보호 수준 차이를 명시할 것을 권장한다.

## 요약

이번 §6 종결 payload 정리 작업(`error` 객체화·`durationMs`·`result.outputs`) 자체는 기존 Rationale 이 명시적으로 기각한 대안을 되살리는 것도 아니고(`finalNodeId`/`nodeCount` 등 "삭제된 약속" 필드는 plan 범위에 없음), `nodeId` nullable 처리도 이미 spec(`"uuid" | null`)이 지원해 plan 의 우려가 해소된다. 다만 plan 이 "재계산 불필요"라고 단정한 전제는 `error.code` 에 대해서는 실측과 어긋나며(2/4 지점 `code` 부재, 나머지 1곳은 일부 조건에서만 존재), 이는 이 문서가 스스로 여러 번(§R8 idempotency 목록, §STATE_MISMATCH 강제 정합 등) 지적해 온 "정규 열거 vs 실제 부분 커버리지" 결함 class 와 같은 모양이라 impl-prep 단계에서 명시적으로 갈라야 한다. `result.outputs` 의 보안 노출 수준은 R17 의 기존 결정과 구조적으로 정합하지만 문서화가 비어 있어 향후 drift 재발의 씨앗이 될 수 있다. 두 항목 모두 착수를 막을 수준은 아니며(CRITICAL 아님), impl-prep 단계에서 결정을 명시하고 진행하면 된다.

## 위험도
LOW
