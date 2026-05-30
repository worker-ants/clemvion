---
id: web-chat-architecture
status: spec-only
code: []
pending_plans:
  - plan/in-progress/channel-web-chat-impl.md
---

# Spec: Channel Web Chat — 아키텍처

> 영역 개요: [_product-overview](./_product-overview.md). 관련: [EIA](../5-system/14-external-interaction-api.md) ·
> [Webhook](../5-system/12-webhook.md) · [Convention Conversation Thread](../conventions/conversation-thread.md) ·
> [interaction-type-registry](../conventions/interaction-type-registry.md).

---

## 1. 레이어 분리

```
호스트 사이트 (고객 웹페이지)
  <script src="https://cdn.clemvion.ai/web-chat/v1/loader.js">
  ClemvionChat('boot', { triggerEndpointPath, profile, ... })
       │ (1) loader 가 launcher + iframe 주입 (클라이언트)
       ▼
  ┌──── iframe (origin: 위젯 CDN) ── 정적 cross-origin CDN 문서 ────┐
  │  위젯 SPA = codebase/channel-web-chat (Next.js CSR-only)        │
  │  postMessage 로 host ↔ iframe 통신 (resize/open/events)         │
  └─────────────────────────────────────────────────────────────────┘
       │ HTTP (webhook + REST + SSE)
       ▼
  Clemvion API (api.clemvion.ai) — EIA (기존 구현 재사용)
```

| 레이어 | 책임 | 격리 경계 |
|---|---|---|
| Host page | 고객 사이트. SDK boot 호출만 | 호스트 origin |
| SDK loader/API | launcher 주입, iframe lifecycle, host↔iframe bridge, 공개 JS API | 호스트 DOM 최소 발자국 |
| Widget SPA (iframe) | 채팅 UI, EIA 클라이언트(webhook/SSE/REST), conversation 상태기계 | 위젯 CDN origin — CSS/JS/storage 격리 |
| Clemvion API | EIA 표면 (기존) | api origin |

## 2. iframe 격리

- 호스트 전역 CSS/JS 와 **완전 격리**(스타일·전역변수 오염 없음). interaction token·대화 내용을 호스트 스크립트로부터 격리(보안 경계).
- `iframe sandbox` + CSP 로 권한 제한. 트레이드오프·Shadow DOM 기각은 §R1.

### 2.1 iframe 문서는 정적 CDN 자산 — 서버 per-client 렌더링 없음
- loader 가 iframe 을 만들지만 `src` 는 **정적·불변 CDN 파일**(`output:'export'` 산출). CDN 캐시 히트로 클라이언트 수가
  늘어도 서버 per-request 부담 없음(동적 렌더링 아님).
- ⚠️ `srcdoc`/`about:blank` 자가 생성은 **기각** — 그 iframe 은 호스트 origin 을 상속해 cross-origin 격리가 깨진다.
  격리를 위해 iframe 은 **반드시 다른 origin 의 실제 `src`** 여야 한다(§R8).
- 워크스페이스/트리거/외형은 문서를 워크스페이스별로 렌더링하지 않고 query param / postMessage / 캐시 가능한 per-workspace JSON 으로 주입.

## 3. EIA 매핑 (위젯이 사용하는 EIA 표면)

위젯은 **facade 계층을 추가하지 않는 순수 external HTTP consumer** 다 (EIA §R10 의 단일 sink 정책에 영향 없음).

| 위젯 동작 | EIA 표면 | 참조 |
|---|---|---|
| 대화 시작 | `POST /api/hooks/:endpointPath` → `202 { interaction: { token, endpoints } }` | EIA §4.1 |
| 실시간 이벤트 | `GET /api/external/executions/:id/stream` (SSE, `?token=`) | EIA §5.2 |
| AI 메시지 | SSE `execution.ai_message` (+ `presentations[]`) | EIA §6.5 |
| 입력 대기 진입 | SSE `execution.waiting_for_input` — `interactionType` ∈ `form`/`buttons`/`ai_conversation`/`ai_form_render` | EIA §6.2, [interaction-type-registry §1.2](../conventions/interaction-type-registry.md) |
| AI 폼 렌더(`ai_form_render`) | `conversationConfig.pendingFormToolCall.formConfig` 렌더 → `submit_form`. 위젯은 `ai_conversation` 과 동일 경로 처리 | [AI Agent §12.5](../4-nodes/3-ai/1-ai-agent.md) |
| 사용자 메시지 | `POST .../interact { command: "submit_message" }` | EIA §5.1 |
| 버튼 탭 | `... { command: "click_button" }` | EIA §5.1 |
| Form 제출 | `... { command: "submit_form" }` | EIA §5.1 |
| 대화 종료 | `... { command: "end_conversation" }` | EIA §5.1 |
| 재연결 복구 | SSE `Last-Event-Id`(5분 버퍼) / `GET .../:id` | EIA §5.2·§5.3 |
| 토큰 갱신 | `POST .../refresh-token` (per_execution) | EIA §5.5 |

- 위젯은 EIA inbound(REST+SSE)만 사용, outbound notification webhook 미사용(항상 SSE open).
- **`retry_last_turn` 미지원** — EIA 외부 표면 미노출 내부 UI 한정 명령(EIA-IN-02). 위젯 v1 AI turn 재시도 버튼은 비목표.

## Rationale

### R1. iframe 격리 채택 (vs Shadow DOM 인라인 마운트)
iframe 은 CSS·JS·전역변수·storage·쿠키를 완전 분리하고 token/대화를 호스트 스크립트로부터 격리한다. Shadow DOM 은
스타일만 격리하고 JS 전역·서드파티 스크립트 보호가 약하며, Next.js 정적 SPA 의 host DOM 직접 마운트는 스타일·polyfill·
React 버전 충돌 위험이 크다. 트레이드오프(postMessage 브리지, 초기 로드)는 좁은 프로토콜로 흡수. 주류 임베드형 위젯도 iframe 채택.

### R5. 클라이언트 consumer 로 한정 — EIA·신규 트리거 유형·facade 미신설
위젯은 외부 브라우저에서 순수 HTTP 로만 EIA 를 호출하는 client 케이스(EIA §2 표 4행). Chat Channel(server-side
어댑터, in-process 우회)과 대칭. 백엔드 변경은 [4-security §CORS](./4-security.md)·남용 방어로 억제, EIA 핵심 표면(webhook/
REST/SSE/토큰) 변경 없음. EIA §R10 의 단일 sink·facade 계층에 새 listener 를 추가하지 않는다.

### R6. 신규 spec 영역 `7-` (vs 5-system 흡수)
클라이언트 SDK·위젯은 제품 표면이 서버 기술명세와 달라 신규 top-level 영역으로 분리. 번호 7 은 기존 2~5 다음 자리.

### R7. 런처/패널 iframe 구조 — v1 단일 iframe
**(A) 단일 iframe(크기 토글)**: 문서·브리지·상태가 하나라 구현·동기화 단순, 호스트 발자국 최소. 단 SPA 가 페이지 로드 시
항상 로드(패널 내부 lazy 로 완화), collapsed 시 정확히 런처 크기로 줄여야 호스트 클릭 가로채기 회피.
**(B) 이중 iframe(런처 별도)**: 런처만 가벼워 패널 SPA 를 첫 open 때 lazy → 초기 로드 최적, pointer-event 경계 깔끔. 단
런처↔패널 상태 동기화 필요, 복잡도↑.
→ v1 은 구현 단순성 우선 **(A)**. 초기 로드 무게가 측정상 병목이면 (B)로 전환(브리지 §2-sdk 는 양쪽 호환 설계).

### R8. iframe 문서 — 정적 cross-origin CDN 자산 + soft 임베드 검증
"클라이언트가 많아지면 워크스페이스별 문서를 서버에서 제공하는 부담이 크다"는 우려는 타당 → 동적 문서 렌더링은 채택
안 함. 위젯 SPA 는 `output:'export'` 정적 산출이라 CDN 정적 파일로 제공되며 per-request 서버 렌더링이 없다. 단
`srcdoc`/`about:blank` 자가 생성은 iframe 이 호스트 origin 을 상속해 §R1 격리가 무너지므로 기각 — "loader 가 iframe
생성(클라이언트) + 문서는 정적 cross-origin CDN 자산"으로 동적 서버 회피와 격리를 동시에 만족한다. 임베드 제어는 문서
CSP 가 아니라 부팅 시 host origin soft 검증으로 이동([4-security](./4-security.md)). CORS 도 워크스페이스 동적 처리가
필요 없는 경계로 둔다([4-security §CORS](./4-security.md)): M1 은 위젯 CDN 단일 origin, M2 만 워크스페이스 allowlist.
