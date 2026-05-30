---
id: web-chat-widget-app
status: partial
code:
  - codebase/channel-web-chat/**
pending_plans:
  - plan/in-progress/channel-web-chat-impl.md
  - plan/in-progress/channel-web-chat-followups.md
---

# Spec: Channel Web Chat — 위젯 SPA (`codebase/channel-web-chat`, Next.js CSR 전용)

> 관련: [아키텍처](./0-architecture.md) · [SDK](./2-sdk.md) · [인증/세션](./3-auth-session.md) ·
> [Convention Conversation Thread §9.4·§9.5](../conventions/conversation-thread.md).

---

## 1. Next.js CSR-only 구성

- `next.config.js`: `output: 'export'` (정적 export — Node 서버 런타임 없음, CDN 호스팅).
- **모든 UI 컴포넌트는 Client Component**(`'use client'`). 데이터 페칭/상태는 전부 브라우저 런타임.
- Server Component 데이터 페칭·Server Actions·Route Handlers **미사용**.
- 채팅 shell 은 `next/dynamic(() => import(...), { ssr: false })` 로 로드 → prerender 단계에서도 SSR 제외.
- (권장) `export const dynamic = 'force-static'`. 런타임 외부 입력은 URL 쿼리/postMessage 로만.
- 산출: `out/` 정적 번들 → 위젯 CDN. 근거·대안은 §R4.

## 2. 화면 구조

**런처(collapsed)**: 우하단 플로팅 런처 버튼 + 추천 질문 버블 N개(`launcher.suggestions`). 버블 탭 → 패널 open +
해당 텍스트를 first message 로 제출.

**패널(expanded)**:
| UI 요소 | 데이터 출처 | 동작 |
|---|---|---|
| 헤더 (봇 이름, 뒤로/닫기) | boot `headerTitle` (아바타는 차기 phase) | 닫기 → collapsed (대화 유지) |
| 환영 메시지 | boot `welcome` (정적 config) | 패널 open 시 즉시 표시(워크플로우 시작 전 클라이언트 렌더) |
| 퀵 액션 버튼 | `waiting_for_input.buttonConfig` | 탭 → `click_button` |
| 추천 질문 | boot `welcome.suggestions`/`launcher.suggestions` (정적) | 탭 → `submit_message` |
| 메시지 리스트 | **1차 소스 = `waiting_for_input.conversationThread.turns` snapshot**(WS §4.4.5). `ai_message.messages[]` raw 직접 노출 금지 | source 마커(`live`/`injected`)별 렌더. `[user-input]…[/user-input]` strip(§4) |
| Form (다중 필드) | `waiting_for_input.formConfig` | 필드 렌더·검증 → `submit_form`. 실패 시 `fieldErrors` 표시·재제출 |
| presentation(carousel/table/chart/template) inline | `ai_message.presentations[]` / `waiting_for_input` | 전체 타입 inline 렌더(AI Agent §7.10) |
| 입력창 | — | 엔터/전송 → `submit_message` |
| 첨부·이모지 | — | v1 비활성/숨김 (Form file upload 연동 시 활성) |
| AI 면책 푸터 | boot `disclaimer` (정적) | 표시 전용 |

## 3. 상태기계 (conversation lifecycle)

```
[collapsed] ──open──▶ [패널만 표시] ──첫 입력──▶ [booting] ──webhook 202──▶ [streaming]
   ▲                                                                          │ waiting_for_input
   │ close(유지)                                                               ▼
   └────────────────────────────────────────────────────────── [awaiting_user_message]
                                                                    │ submit_message ↔ ai_message
                                                                    │ completed / end_conversation
                                                                    ▼
                                                                [ended] ──new chat──▶ [booting]
```
- 워크플로우 시작 시점: **첫 사용자 입력 시**(입력 전송 또는 추천질문 탭). 패널 open 만으로는 미시작 — 환영/추천질문은
  boot 정적 config 로 선렌더되어 빈 대화에 execution 을 낭비하지 않는다. first webhook payload 에 profile + 첫 메시지 동봉.

### 3.1 채팅 종료 / 새로 시작 / 세션 지속

| 동작 | 트리거 | EIA 처리 | 위젯 상태 |
|---|---|---|---|
| 닫기 (collapse) | 헤더 닫기 / 런처 토글 | execution `waiting_for_input` 유지, **SSE 연결도 유지** | 패널만 숨김. **닫힌 사이 도착한 in-flight 메시지(예: AI 응답)는 버퍼링 → unread 배지, 재open 시 렌더**. 재open 시 그대로 |
| 대화 종료 (end) | 명시 "대화 종료" 또는 `completed` | `end_conversation` → execution 종료, 토큰 invalidate | `[ended]` — transcript 읽기전용 + "새 대화 시작" CTA |
| 새 대화 (restart) | `[ended]` CTA 또는 명시 리셋 | 새 `POST /api/hooks/:path` → 새 executionId/token | transcript 초기화(구분선) 후 `[booting]` |
| 토큰 만료/서버 타임아웃 | per_execution 만료(refresh 실패) 또는 idle → `410 Gone` | — | `[ended]` + "대화 종료, 새로 시작" 안내 |
| 페이지 새로고침/이동 | 호스트 reload → iframe 재로드 | — | **(b) 복원**: `executionId`+단명 토큰을 iframe-origin storage 저장 → `GET /:id`+SSE(`Last-Event-Id`) 재연결. 만료/410 이면 [ended] |

- proactive(봇 선발화)는 비목표. 단 진행 중 대화의 in-flight 이벤트는 위와 같이 캡처(unread).
- 다중 세션(유저당 여러 대화) 목록은 비목표 — 식별(추후) + 유저별 execution 목록 API 신설 전제.

## Rationale

### R4. Next.js CSR 전용 (vs Vite SPA / SSR)
위젯은 iframe 안 SPA 라 SSR 이익(SEO·TTFB)이 무의미하고 정적 export 가 CDN 호스팅·iframe 임베드에 최적. CSR 강제는
static export + 전 컴포넌트 `'use client'` + 채팅 shell `dynamic(ssr:false)` + route handler/server action 미사용으로 달성.
Vite SPA 가 더 가벼우나 조직 표준(프론트가 Next.js)과 사용자 요구에 맞춰 Next.js 채택 — 정적 export 로 사실상 SPA 동등.
