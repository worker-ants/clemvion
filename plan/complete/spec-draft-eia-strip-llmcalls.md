---
worktree: eia-strip-llmcalls
started: 2026-06-03
owner: planner
---

# Spec draft — llmCalls debug payload 외부 수신자 strip (L1 결정)

PR #429 가 §4.4 llmCalls 노출을 "open item" 으로 남겼다. 사용자 결정(채널 사용 +
L1)에 따라 정책을 확정한다: **`llmCalls` (raw request/responsePayload) 는 인증된
내부 WS(에디터) 채널에만 전달하고, 모든 외부 수신자에서는 strip 한다.**

## 변경 1 — `spec/5-system/6-websocket-protocol.md` §4.4 `llmCalls[]` 표 직후 노트(현 488행)

### Before
> **`llmCalls[].requestPayload` / `responsePayload` 는 raw 디버그 payload** 다 — LLM provider 와의 원본 요청/응답(시스템 프롬프트·대화 이력·tool 정의·사용자 입력 등 민감 데이터 포함 가능)을 마스킹(redaction) 없이 운반하며, 에디터의 디버깅 타임라인(Response/Request/LLM Usage 탭) 같은 **개발자·에디터 surface** 전용이다. v1 은 별도 마스킹(redaction)을 적용하지 않으며, 에디터 surface 는 기존 워크플로 RBAC 로 간접 제한된다. 다중 테넌트·비편집자 노출 범위에 대한 **명시적 접근제어·마스킹 정책은 open item** (제품 결정 필요) — 본 노트는 현행 동작을 명문화할 뿐 정책을 규정하지 않는다. 설계 근거는 본 문서 ## Rationale 의 "`ai_message.llmCalls[]` raw payload 운반" 항목 참조.

### After
> **`llmCalls[].requestPayload` / `responsePayload` 는 raw 디버그 payload** 다 — LLM provider 와의 원본 요청/응답(시스템 프롬프트·대화 이력·tool 정의·사용자 입력 등 민감 데이터 포함 가능)을 운반하며, 에디터의 디버깅 타임라인(Response/Request/LLM Usage 탭) 같은 **개발자·에디터 surface** 전용이다. 따라서 `llmCalls` 는 **워크스페이스 인증을 통과한 내부 WebSocket 채널(`execution:{id}`, ownership 게이트)에만 전달**되고, **모든 외부 수신자 — external-interaction SSE 스트림(`iext_*`/`itk_*` 토큰), notification webhook fanout, chat-channel 아웃바운드(텔레그램·web-chat 등) — 에서는 strip 된다.** 즉 채널 end-user 클라이언트는 최종 assistant 텍스트/`presentations` 만 받고 raw debug payload 는 받지 않는다. (값-레벨 마스킹(L2)·워크스페이스 내 viewer/editor 역할 게이트(L3)는 본 결정 범위 밖.) 설계 근거는 본 문서 ## Rationale 의 "`ai_message.llmCalls[]` 외부 수신자 strip" 항목 참조.

## 변경 2 — `spec/5-system/6-websocket-protocol.md` ## Rationale 의 해당 항목(현 961–967행) 교체

### Before
```
### `ai_message.llmCalls[]` raw payload 운반 (v1, 마스킹 없음)

디버깅 타임라인이 어시스턴트 메시지 단위로 Request/Response/Usage 를 보여주려면 LLM provider 와의 원본 payload 가 필요하다.

- **결정**: `llmCalls[].requestPayload` / `responsePayload` 를 마스킹(redaction) 없이 그대로 운반한다(§4.4 `llmCalls[]` 노트).
- **근거**: v1 은 에디터 surface 전용이라 기존 워크플로 RBAC 로 간접 제한된다. 별도 redaction 배선 비용 대비 디버깅 가치가 크다.
- **open item**: 다중 테넌트·비편집자 노출 범위에 대한 명시적 접근제어·마스킹 정책은 미결(제품 결정). 향후 보안/멀티테넌시 plan 신설 시 §4.4 `llmCalls[]` 노트를 체크리스트 항목으로 포함한다.
```

### After
```
### `ai_message.llmCalls[]` 외부 수신자 strip (L1)

디버깅 타임라인이 어시스턴트 메시지 단위로 Request/Response/Usage 를 보여주려면 LLM provider 와의 원본 payload 가 필요하다. 그러나 이 raw payload 는 시스템 프롬프트·대화 이력·tool 정의 등 민감 정보를 담는다.

`execution.ai_message` 는 (1) 워크스페이스 ownership 으로 게이트된 내부 WebSocket 채널과 (2) external-interaction SSE / notification webhook / chat-channel 아웃바운드로 분기되는 fanout 양쪽으로 전달된다. SSE 는 `iext_*`/`itk_*` interaction 토큰만으로 접근 가능하고(워크스페이스 체크 없음) 채널 end-user 클라이언트에 전달되므로, raw payload 를 그대로 흘리면 채널 사용자에게 노출된다.

- **결정 (L1)**: `llmCalls` (및 그 안의 `requestPayload`/`responsePayload`) 는 **인증된 내부 WS 채널에만** 포함하고, **fanout(외부) 경로에서는 strip** 한다. 채널 end-user 는 최종 assistant 텍스트/`presentations` 만 받는다.
- **근거**: debug raw payload 는 본질적으로 에디터 전용 관심사다. 외부/채널 수신자는 이를 필요로 하지 않으므로, 단일 fanout seam 에서 제거하면 최소 변경으로 노출을 닫으면서 에디터 디버그 패널은 그대로 유지된다.
- **대안 (채택 안 함)**: 값-레벨 마스킹(L2)은 에디터 디버깅 가치를 훼손하고 부분적이며, 워크스페이스 내 viewer/editor 역할 게이트(L3)는 별도 RBAC 확장이 필요해 본 결정 범위를 넘는다. 향후 요구가 명확해지면 재검토한다.
```

## Rationale (draft 자체)
- 본 변경은 PR #429 가 남긴 open item 을 사용자 결정(채널 사용 + L1)에 따라 **정책으로 확정**하고, 곧이어 backend 구현(fanout strip)이 따른다. spec 이 동작의 SoT 이므로 구현 전 확정한다.
- L2/L3 를 기각한 이유를 Rationale 에 남겨 향후 재도입 시 근거가 보이게 한다.
- frontend wire(에디터) 계약은 불변 — llmCalls 는 인증 WS 에 그대로 유지된다.
