---
worktree: .claude/worktrees/channel-web-chat-spec-3b22b3
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

### 프론트 (주력) — 완료
- [x] `codebase/channel-web-chat/` Next.js CSR-only(`output:'export'`, dynamic ssr:false). 정적 export build ✓.
- [x] `codebase/packages/web-chat-sdk/` 타입 + boot + WidgetBridge(host) + loader IIFE(전역 ClemvionChat).
- [x] host↔iframe `wc:*` bridge(양방향 origin 검증·명령 큐) + iframe 측 리시버 핸드셰이크.
- [x] EIA 클라이언트(webhook 시작→SSE→submit_*) + per_execution 세션 + 새로고침 복원.
- [x] 위젯 화면: 런처/추천질문/패널/헤더/퀵액션/메시지/Form/입력/면책. (rich presentation 전용 컴포넌트 → followup #4)
- [x] conversation 렌더 규약(`conversationThread.turns` 1차·`[user-input]` strip·`live`/`injected`).
- [x] 상태기계·종료/재시작/새로고침 복원·in-flight unread.
- [x] 샘플(스니펫·npm·BYO-UI 개념). M2 정식 패키징 → followup #6.

### 백엔드 (소수)
- [x] `/api/external/*` 워크스페이스 단위 동적 CORS(`interactionAllowedOrigins`, path 역인덱스, 단일 delegate). `/api/hooks/*` 무제한.
- [ ] 임베드 soft 검증 config 엔드포인트(→ followup #3, `detectHostOrigin` helper 만 존재).
- [ ] 공개 webhook 남용 방어(→ followup #1·#2: auth-scoped throttle + 워크플로우 비용 가드).

> 잔여 surface 추적: [`channel-web-chat-followups.md`](./channel-web-chat-followups.md). 관련 spec `status: partial`.

## 비목표 (spec 비목표)
파일 첨부/이모지, 상담원 핸드오프, 다중 세션 목록(N5), 호스트 제공 사용자 식별키(추후), 풀 CSS 테마.

## 참고
- 결정 이력·Rationale: spec `7-channel-web-chat/*` 각 `## Rationale`.
- 일관성 검토: `review/consistency/2026/05/30/17_36_59/SUMMARY.md` (BLOCK:NO).
