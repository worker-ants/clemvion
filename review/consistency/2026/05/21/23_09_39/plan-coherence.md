STATUS: WARN

## Critical

없음.

---

## Warning

### W-1: `ai-agent-tool-connection-rewrite.md` — 도구 식별자 미결정 상태에서 `execution.tool_call_*` SSE 페이로드 고정

- **충돌 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §"결정 기록" — 도구 등록 모델 / 도구 시그니처 위치 / 도구 이름 규칙(`tool_*` 접두사 부활 여부) 이 모두 TBD.
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §5.2 SSE 이벤트 종류 목록 ("execution.tool_call_started / execution.tool_call_completed") + §11 매핑 표 (`execution.tool_call_*`) + `spec/5-system/6-websocket-protocol.md §4.6` 매핑 표.
- **충돌점**: `execution.tool_call_started` 의 payload 에 `name` (도구 이름) 과 `arguments` 가 포함된다 (6-websocket-protocol.md L407-418). `ai-agent-tool-connection-rewrite` plan 에서 도구 이름 규칙(`tool_*` 접두사 부활·변경·폐기)이 아직 결정되지 않았다. 일반 노드 도구가 추가될 경우 `name` 필드의 namespace 가 지금 SSE 페이로드 정의와 충돌할 수 있다.
- **단, 현재 `execution.tool_call_*` 는 KB/MCP/조건 도구(기존 provider) 에 한정** — plan 이 새 일반 도구를 추가하면 동일 이벤트 타입을 재사용하거나 `tool_*` 접두사 변경이 SSE payload spec 을 뒤흔들 가능성 있음.
- **제안**: `ai-agent-tool-connection-rewrite` plan §1 결정 전까지 SSE의 `execution.tool_call_*` payload `name` 필드 형식(접두사 규약)은 "현행 KB/MCP/cond 전용" 임을 spec 각주에 명시. 일반 도구 도입 결정 후 EIA spec §5.2·§11 및 WS spec §4 의 `name` 예시를 재검토하는 후속 작업을 `ai-agent-tool-connection-rewrite.md` 의 §3 Spec 작성 단계에 체크박스로 추가 권장.

---

### W-2: `replay-rerun.md` — Re-run 의 외부 webhook 트리거 진입점 정책 미정의

- **충돌 plan**: `plan/in-progress/replay-rerun.md` — RR-PL-07 (AI Assistant 비트리거), RR-PL-01 (외부 부수효과 안전장치 A5). PR2 (구현) 대기 중.
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §9.1 처리 흐름 ("1. 외부 시스템: POST /api/hooks/:endpointPath"), §3.1 EIA-NX-01, §5.1 명령 목록.
- **충돌점**: EIA spec 은 "외부 webhook 트리거 → 실행 시작" 만 정의하고 Re-run 진입점(POST /api/v1/executions/:id/re-run)은 다루지 않는다. 그러나 외부 시스템이 `interaction.enabled=true` 트리거로 실행된 워크플로우를 Re-run 하려면 interaction token + re-run endpoint 조합이 필요한데, EIA spec 에는 이 경로가 없다. RR-PL-07 (AI Assistant 비트리거) 이 외부 인터랙션 API 에도 적용되는지도 불명확.
- **중요도**: Re-run PR2 구현 착수 전에 EIA spec 과 교차 확인이 필요. 현재 EIA spec 은 외부 Re-run 를 명시적으로 "미지원" 으로 기재하지 않아 모호함.
- **제안**: EIA spec §3.2 (Inbound) 또는 §12 호환성 절에 "Re-run 진입은 EIA 인터랙션 토큰으로 호출 불가 — `POST /api/v1/executions/:id/re-run` 는 별도 워크스페이스 인증 필요" 한 줄을 추가. `replay-rerun.md` §3 백엔드 구현 단계에 "외부 interaction token 으로 Re-run 가능 여부 확인 (EIA spec §12 cross-ref)" 체크박스 추가 권장.

---

### W-3: `node-output-redesign/` — `result.outputs` 페이로드 정의와 진행 중인 output 재설계 미정합 가능성

- **충돌 plan**: `plan/in-progress/node-output-redesign/README.md` Phase E — P0/P1/P2/P3 항목 대기 중 (ai-agent error builder, information-extractor ConversationThread v2 등). D1~D6 완료됐지만 Phase E 노드별 구현 갭은 미처리.
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §6.3 `execution.completed` payload `result.outputs` 정의 ("workflow 의 노출 outputs (exit/end 노드 매핑). v1 은 '마지막 노드의 output' 단순 노출").
- **충돌점**: `node-output-redesign` Phase E 에서 ai-agent / information-extractor 의 `output.result.*` 경로(D6 이후 정립)와 error builder(P0) 개선이 진행되면 "마지막 노드의 output" 이 담기는 `result.outputs` 의 실제 shape 가 달라질 수 있다. EIA spec §6.3 의 `result.outputs` 는 "v1 단순 노출" 로 모호하게 처리되어 있어, Phase E P0 구현 후 `output.result.*` 경로 변경이 외부 클라이언트에게 breaking 변경으로 드러날 위험이 있다.
- **제안**: EIA spec §6.3 `result.outputs` 에 "출력 shape 는 마지막 노드의 `output` 객체 그대로 — 구체 shape 는 각 노드 spec 참조" 한 줄의 cross-link 추가. `node-output-redesign` Phase E P0 (ai-agent error builder) 착수 전 EIA spec §6.3 과의 호환성 영향 간단 확인을 Phase E 단계에 메모 추가.

---

## Info

### I-1: `parallel-p2.md` / `merge-p2-async-fanin.md` — `seq` 단조 증가 보장 영향 없음 (확인 필요만)

- **관련 plan**: `plan/in-progress/parallel-p2.md` (병렬 실행), `plan/in-progress/merge-p2-async-fanin.md` (async fan-in barrier — 엔진 비동기 모델 선결 조건).
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §R7 (`seq` 동일 공유), EIA-NX-08, EIA-IN-07.
- **상황**: EIA spec 은 `seq` 를 "execution 내 monotonic counter, WebSocket §2.2 와 동일" 로 정의. 현재 sequential 엔진 모델에서는 `seq` 가 단일 thread 에서 단조 증가하므로 문제 없음. `merge-p2-async-fanin.md` 의 엔진 비동기 dispatch 모델 도입 PoC 가 통과된다면 복수 branch 의 이벤트가 병렬 emit 되어 `seq` 단조 증가가 race condition 없이 유지되는지 검증 필요.
- **현재 위험**: merge-p2 는 "엔진 비동기 dispatch 모델이 선결" 임을 스스로 명시하고 있어 단기 위험은 낮음. INFO 수준으로 추적.
- **제안**: `merge-p2-async-fanin.md` §1 PoC 단계에 "seq 단조 증가 + EIA spec §R7 과의 정합성 검토" 체크박스 추가.

### I-2: `self-hosting-deployment.md` — SSRF allowlist 설정 위치 불명확

- **관련 plan**: `plan/in-progress/self-hosting-deployment.md` §1 디자인 결정, §5 보안 가이드.
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §8.1 SSRF 방지 (`workspace_settings.notification_url_allow_pattern`).
- **상황**: EIA spec 은 워크스페이스 단위 allowlist 를 `workspace_settings` JSONB 필드로 정의. `self-hosting-deployment.md` 의 보안 가이드 (§5)는 아직 작성되지 않았다. 셀프 호스팅 환경에서 outbound notification URL 가 사설 IP 를 향할 수 있는 경우 (on-premise integration) allowlist 설정 방법이 가이드에 포함되어야 한다.
- **제안**: `self-hosting-deployment.md` §5 security.md 작성 시 "notification SSRF allowlist 설정 (`workspace_settings.notification_url_allow_pattern`)" 을 항목으로 추가.

### I-3: `marketplace-and-plugin-sdk.md` — trigger CRUD 페이로드 변경 영향 없음 확인

- **관련 plan**: `plan/in-progress/marketplace-and-plugin-sdk.md` Phase C (Integration 플러그인), Phase D (커스텀 노드 SDK).
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §4 Trigger 등록 페이로드 확장.
- **상황**: EIA spec 은 기존 Trigger CRUD 페이로드에 `notification` / `interaction` 두 옵셔널 그룹을 추가. marketplace plan 의 Integration 플러그인(Phase C)이 trigger 관련 CRUD 를 변경하더라도, `notification` / `interaction` 필드는 webhook trigger 전용이므로 직접 충돌 가능성은 낮음. Phase D 커스텀 노드가 독자 trigger 타입을 정의하지 않는 한 안전.
- **제안**: marketplace plan Phase C 진행 시 "Integration 플러그인 manifest 가 webhook trigger CRUD endpoint 를 직접 호출하는 경우 EIA §4 신규 필드와 충돌 없는지 점검" 메모 추가. 별도 액션 없음.

### I-4: `presentation-button-render-investigation.md` — `click_button` 명령과 cap 정책 미충돌 확인

- **관련 plan**: `plan/in-progress/presentation-button-render-investigation.md` — root cause 확정(후보2 carousel cap 비대칭), fix PR `button-cap-spec-validator` 진행 중.
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §5.1 `click_button` 명령 (`nodeId`, `buttonId` 필드).
- **상황**: EIA spec 의 `click_button` 명령은 `buttonId` 만 전달하고 cap 정책(4 vs 5 개)에 직접 관여하지 않는다. button cap fix PR 은 backend handler/schema 수정이 목표이므로 EIA 의 REST 명령 payload 형식과 충돌 없음.
- **제안**: 별도 액션 없음. 완료 후 확인 권장.

---

## 요약

`plan/in-progress/**` 와 `spec/5-system/14-external-interaction-api.md` (신규) + 3개 변경 파일의 교차 분석 결과, CRITICAL 등급 충돌(미해결 결정 우회·worktree 경합)은 발견되지 않았다. 동일 spec 파일을 수정하는 다른 활성 worktree 도 없었다. 주요 위험은 두 가지 WARNING: (1) `ai-agent-tool-connection-rewrite.md` 의 도구 이름 규칙이 확정되지 않은 상태에서 SSE `execution.tool_call_*` payload 의 `name` 필드 namespace 가 암묵적으로 고정되는 것, (2) `replay-rerun.md` PR2 착수 시 외부 interaction token 에서 Re-run 가능 여부에 대한 EIA spec 상 명시가 누락된 것. 두 WARNING 모두 간단한 spec 각주 추가 또는 plan 체크박스 추가로 해소 가능하며, 현재 작업을 차단할 필요는 없다.

---

## 위험도

LOW
