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

## 진행 상태

- ✅ **impl-prep consistency-check** (review/consistency/2026/05/30/18_24_13) — Critical(0-architecture §5 dead ref) 해소(commit 2c86950e), 저비용 WARNING 반영. 잔여 WARNING: npm scope 확정(보류), §6.3 parallel-* merge 경합(PR rebase 시 처리).
- ✅ **스캐폴딩 foundation** (commit 6573c38b) — 위젯 SPA(Next 16 CSR, static export build ✓ tsc ✓ eslint ✓) + SDK 패키지(@clemvion/web-chat 잠정, tsc build ✓ jest 7 ✓).
- ⏳ 후속 increment (아래 체크박스).

## 작업 범위

### 프론트 (주력)
- [x] `codebase/channel-web-chat/` 스캐폴딩 — Next.js CSR-only(`output:'export'`, dynamic ssr:false shell). **상태기계·EIA 클라이언트·화면·conversation 렌더는 미구현(stub).**
- [x] `codebase/packages/web-chat-sdk/` 스캐폴딩 — 공개 타입(BootConfig/ChatInstance) + boot/validate + wc:* 상수. **iframe bridge·명령 큐·EIA 호출(@workflow/sdk 재사용) 미구현.**
- [ ] host↔iframe `wc:*` postMessage bridge + 명령 큐(boot 전 버퍼링) + loader 스니펫(IIFE).
- [ ] EIA 클라이언트(@workflow/sdk 재사용): webhook 시작 → SSE 구독 → submit_*. per_execution 세션(spec `3-auth-session`).
- [ ] 위젯 화면(spec `1-widget-app §2`): 런처/추천질문/패널/헤더/퀵액션/메시지/Form/presentation/입력/면책.
- [ ] conversation 렌더 규약: `conversationThread.turns` 1차 소스, `[user-input]` strip, `live`/`injected` 마커(conversation-thread §9.4·§9.5).
- [ ] 상태기계·종료/재시작/새로고침 복원(storage)·in-flight unread (spec `1-widget-app §3·§3.1`).
- [ ] M2 BYO-UI headless client 노출 + 샘플(스니펫·npm).
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
