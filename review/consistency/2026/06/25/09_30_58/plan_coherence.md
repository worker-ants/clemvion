# Plan 정합성 검토 결과

검토 모드: `--impl-done` (구현 완료 후)
Target: `plan/in-progress/web-chat-preview-improvements.md`
검토 일자: 2026-06-25

---

## 발견사항

### [WARNING] WS §4.4 이벤트 카탈로그에 `execution.message` 미등재

- **target 위치**: `plan/in-progress/web-chat-preview-improvements.md` Phase 4 §4 — "5-system/6-websocket-protocol §4.4 이벤트 카탈로그에 execution.message 가 필요하면 동반 추가"
- **관련 plan**: 직접 연관 plan 없음(WS spec 자체 갭); 선례: `fix-webchat-sse-field-map.md` (EIA §6.2/§6.5 SSE wire note 를 WS §4.4 와 정합한 선례)
- **상세**: `spec/5-system/14-external-interaction-api.md §5.2` 는 이미 `execution.message` 를 이벤트 목록(line 387)에 등재하고 "각 이벤트의 페이로드는 [Spec WebSocket 프로토콜 §4.1·§4.4] 와 동일"이라고 명시한다. 그러나 `spec/5-system/6-websocket-protocol.md §4.4` 이벤트 카탈로그 테이블에는 `execution.message` 행이 없다. EIA spec 이 WS spec 을 payload SoT 로 가리키는데 WS spec 에 해당 행이 부재하므로 dangling cross-reference 가 발생한다. plan Phase 4 §4 의 "필요하면 동반 추가" 조건절은 EIA spec 이 이미 WS §4.4 를 SoT 로 선언한 이상 "필요함"으로 판정된다.
- **제안**: `spec/5-system/6-websocket-protocol.md §4.4` 테이블에 `execution.message` 행(`{ executionId, nodeId, nodeType, presentations:[{config,output}], seq? }`, "presentation 4종 비차단 완료 시 발행하는 표시-전용 메시지, `node.completed` firehose 와 구분") 을 추가하고 plan Phase 4 §4 를 완료로 표시한다.

---

### [INFO] `ai-agent-tool-connection-rewrite.md` 의 EIA §5.2 cross-ref — 충돌 없음, 머지 시 재확인 권장

- **target 위치**: `plan/in-progress/web-chat-preview-improvements.md` Phase 4 §1(a) — EIA §5.2 이벤트 목록에 `execution.message` 추가 (완료)
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 — "EIA §5.2 의 SSE `execution.tool_call_started/completed` payload `name` 필드 namespace 재검토 — 도구 이름 규칙(`tool_*` 접두사 부활 여부) 결정 후 SSE payload spec 동기화" (미착수, TBD)
- **상세**: `ai-agent-tool-connection-rewrite.md` 가 EIA §5.2 를 수정 예정으로 표기하나, 관심 영역은 `execution.tool_call_started/completed` payload 의 `name` 필드 namespace 이다. 본 target 의 변경(`execution.message` 신설)은 다른 이벤트를 대상으로 하므로 내용 충돌이 없다. 다만 두 plan 이 같은 EIA §5.2 구간을 편집할 예정이라 머지 순서에 따라 rebase 시 §5.2 구간 재확인이 필요하다 (`fix-webchat-sse-field-map.md W-5/6/7` 선례와 동일 패턴).
- **제안**: 현 단계 조치 불요. `ai-agent-tool-connection-rewrite.md` 착수 시 §5.2 rebase 확인을 체크리스트에 포함한다.

---

### [INFO] `spec-sync-external-interaction-api-gaps.md` 미구현 항목과 `execution.message` 간 관계

- **target 위치**: `plan/in-progress/web-chat-preview-improvements.md` — `execution.message` 신설로 EIA SSE 이벤트 표면 확장
- **관련 plan**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — outbound notification backoff 배율, 분산 fan-out, rate-limit, `GET /executions/:id` currentNode, `execution.replay_unavailable` 등 미구현 항목 추적
- **상세**: target 의 `execution.message` 신설은 gaps 문서의 미구현 항목들과 직교하므로 해소·충돌이 없다. EIA spec 의 `status: partial` 은 gaps 문서에서 이미 추적 중이며 `execution.message` 추가만으로는 `implemented` 로 승격되지 않는다.
- **제안**: 별도 조치 불요. 선택적으로 EIA spec `pending_plans` frontmatter 에 본 plan 을 추가할 수 있으나 강제 아님.

---

## 요약

target(`web-chat-preview-improvements.md`) 은 진행 중인 plan 들과 대체로 정합하다. 미해결 결정을 우회하거나 선행 plan 의 미해소 사전 조건을 전제하는 항목은 발견되지 않았다. `resetSession` 명령은 `spec/7-channel-web-chat/2-sdk.md §3` 에 이미 등재되어 있어 plan Phase 2/3 의 구현과 정합한다. 실질적 갭은 하나로, `spec/5-system/14-external-interaction-api.md §5.2` 가 `execution.message` payload 의 SoT 로 WS `spec/5-system/6-websocket-protocol.md §4.4` 를 cross-reference 하는데 WS §4.4 이벤트 카탈로그 테이블에 `execution.message` 행이 누락되어 dangling reference 가 되는 것이다(WARNING). plan Phase 4 §4 의 조건부 표현("필요하면")이 이미 충족된 상태이므로 WS §4.4 에 행 추가가 필요하다.

## 위험도

LOW
