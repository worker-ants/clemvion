---
worktree: (assigned at impl-start)
started: 2026-05-30
owner: developer (TBD)
---

# 구현: Channel Web Chat — 임베드형 웹채팅 위젯 + SDK + 샘플

> Spec SoT: [`spec/7-channel-web-chat/`](../../spec/7-channel-web-chat/) (promote 완료).
> 본 plan 은 위 spec 의 `pending_plans:` 대상 — spec-only → implemented 전환을 추적한다.

## 배경

EIA(External Interaction API, `spec/5-system/14`)는 **이미 구현됨**(`codebase/backend/src/modules/external-interaction/`).
본 작업은 그 위에 얹는 **클라이언트 레이어**(위젯 SPA + SDK + 샘플)다. 백엔드 변경은 소수(아래 §백엔드).

## 진입 조건 (선행 결정 — 현재 보류)

- [ ] **npm scope 확정** (보류) — [`eia-sdk-publish.md`](./eia-sdk-publish.md) §사용자 결정 #3 (`@workflow/*` vs `@clemvion/*`). spec 은 "잠정 `@clemvion/web-chat`" 표기. 확정 후 spec·코드 동기화.
- [ ] **운영 CDN/도메인 확정** (보류) — `<widget-cdn-base>`·`<api-base>` 는 **플레이스홀더 + 배포 환경 설정**으로 둔다(환경별 상이, SaaS/셀프호스팅). `apiBase` 는 SDK boot 런타임 주입, `<widget-cdn-base>` 는 loader 빌드/배포 env 주입. 불변 버전 path `/web-chat/v1/`. spec [0-architecture §4](../../spec/7-channel-web-chat/0-architecture.md).
- [ ] **샘플 경로 확정** — `codebase/packages/web-chat-sdk/examples/` (잠정).

## 작업 범위

### 프론트 (주력)
- [ ] `codebase/channel-web-chat/` — Next.js CSR-only 위젯 SPA (`output:'export'`, 전 컴포넌트 client). spec `1-widget-app`.
- [ ] `codebase/packages/web-chat-sdk/` — loader 스니펫 + `@clemvion/web-chat`(잠정) npm. host↔iframe bridge, 공개 JS API. EIA 호출은 기존 `@workflow/sdk` 재사용. spec `2-sdk`.
- [ ] 샘플 프로젝트 — 스니펫·npm 두 경로 시연.
- [ ] conversation 렌더 규약 준수 — `conversationThread.turns` snapshot 1차 소스, `ai_message.messages[]` raw 노출 금지, `[user-input]` strip (conversation-thread §9.4·§9.5).
- [ ] 인터랙션 전체 렌더 — text/buttons/추천질문/AI multi-turn/Form/presentations(carousel·table·chart·template), `ai_form_render` 포함.

### 백엔드 (소수)
- [ ] `/api/external/*` 워크스페이스 단위 동적 CORS — `interactionAllowedOrigins` 기반, path 로 워크스페이스 역인덱스, 전역 `enableCors`(frontend 전용)와 경로-스코프 분리. (`/api/hooks/*` 는 무제한 유지.)
- [ ] 워크스페이스 `interactionAllowedOrigins` 설정 노출 + 임베드 soft 검증용 캐시 가능 config 엔드포인트.
- [ ] 공개 webhook 남용 방어(spec `4-security` §남용) — IP/세션 rate-limit·대화수 상한·페이로드 크기, 워크플로우 측 비용 가드.

## 비목표 (spec 비목표)
파일 첨부/이모지, 상담원 핸드오프, 다중 세션 목록(N5), 호스트 제공 사용자 식별키(추후), 풀 CSS 테마.

## 참고
- 결정 이력·Rationale: spec `7-channel-web-chat/*` 각 `## Rationale`.
- 일관성 검토: `review/consistency/2026/05/30/17_36_59/SUMMARY.md` (BLOCK:NO).
