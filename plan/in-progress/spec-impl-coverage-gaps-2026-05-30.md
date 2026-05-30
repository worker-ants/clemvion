---
worktree: goal-audit-08b253
started: 2026-05-30
owner: project-planner
---

# Plan — spec↔구현 커버리지 갭 (2026-05-30)

> 출처: `/goal` 감사 Step 3 — `/spec-coverage` standing audit(80 후보) + 코드 검증 agent 로
> `status: implemented`/`partial` spec 의 약속 surface 가 실제 코드에 존재하는지 ground-truth 확정.
> 분류: REAL_GAP(미구현) / SPEC_WORDING_BUG(impl 과 다른 spec 표기) / STALE_FRONTMATTER(구현됨, frontmatter `code:` 누락).
> spec/frontmatter 변경은 `project-planner` 가 처리.

## A. REAL_GAP — 구현 누락 (구현 필요 or 추적 확인)

- [ ] **A1. Node cancellation — frontend 취소/중단 버튼 미구현**
  - spec `spec/conventions/node-cancellation.md:14` 가 "사용자 cancel 버튼 — 실행 중 워크플로우를 UI 에서 중단" 약속.
  - 검증: `codebase/frontend/src` 어디에도 backend `POST /api/executions/:id/stop` 호출·중단 UI 없음. backend abort 인프라(`node-handler.interface.ts`, http-request handler signal 전파)는 존재.
  - **신규 추적 대상** — 기존 `node-cancellation-infrastructure.md` 는 backend signal 전파만 추적, frontend stop 버튼은 미추적. 구현 plan 신설 필요.

- [ ] **A2. Replay/Re-run — `POST /api/executions/:executionId/re-run` 미구현** (이미 추적됨)
  - spec `spec/5-system/13-replay-rerun.md` §8.1 의 완전한 re-run API 계약이 코드에 부재. executions.controller 는 `GET :id`, `GET workflow/:id`, `POST :id/stop`, `POST :id/continue` 만 노출.
  - → 기존 `plan/in-progress/replay-rerun.md` (PR2 구현 미착수) 가 이미 추적. 본 항목은 cross-link 확인용. **신규 작업 아님.**

- [ ] **A3. cross-node-warning-rules — per-node 색상 배지 미렌더** (부분 추적)
  - frontend canvas 의 graph-warning 평가·저장버튼 disable 은 구현됨(아래 B1). 그러나 spec §3 의 "빨간/노란 per-node 배지" 는 미렌더(저장버튼 tooltip 만 존재).
  - → 기존 `cross-node-warning-rules.md` §4/§6 (frontend canvas/e2e) 가 추적 범위. 배지 잔여 갭임을 해당 plan 에 명시 권장.

## B. STALE_FRONTMATTER — 구현 완료됐으나 spec frontmatter `code:` 누락 (frontmatter 갱신만)

> 구현은 존재. spec frontmatter `code:` 에 아래 검증된 frontend 경로 추가하면 해소. 코드 작업 아님.

- [ ] **B1. `spec/conventions/cross-node-warning-rules.md`** — 추가: `codebase/frontend/src/components/editor/workflow-editor.tsx`, `codebase/frontend/src/lib/stores/editor-store.ts`, `codebase/frontend/src/lib/api/workflows.ts`, `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (단, per-node 배지는 A3 미구현 잔존 → `status: partial` 유지)
- [ ] **B2. `spec/4-nodes/6-presentation/0-common.md`** (status implemented) — 추가: `codebase/frontend/src/components/editor/run-results/**` (run-results-drawer + presentation-renderers + dynamic-form-ui + button-bar 등 5종 렌더)
- [ ] **B3. `spec/5-system/14-external-interaction-api.md`** (status implemented) — 추가: `codebase/channel-web-chat/src/lib/eia-client.ts`, `codebase/channel-web-chat/src/lib/eia-types.ts`
- [ ] **B4. `spec/5-system/4-execution-engine.md`** (status partial) — 추가: `codebase/frontend/src/lib/websocket/use-execution-events.ts`, `codebase/frontend/src/lib/websocket/ws-client.ts`

## C. SPEC_WORDING_BUG — 구현과 다른 spec 표기 (spec 본문 수정)

- [ ] **C1. `spec/2-navigation/2-trigger-list.md:129`** — `PATCH /api/triggers/:id/toggle` 행 제거. 실제 토글은 `PATCH /api/triggers/:id { isActive }` 로 처리(별도 `/toggle` 서브경로 없음; `update-trigger.dto.ts:34-35` `isActive?`). 기존 `PATCH /api/triggers/:id` 행(body `{ isActive }`)이 커버.
- [ ] **C2. `spec/2-navigation/10-auth-flow.md:124`** — `GET /api/auth/verify-email?token=` → `POST /api/auth/verify-email` (token in body) 로 수정. 실제 구현은 `auth.controller.ts:148 @Post('verify-email') @Body() VerifyEmailDto`. 같은 spec L432 표(POST)가 정답이고 L124 가 오기. (부수: L432 "쿼리: token" 도 실제는 body — 미세 정정 권장.) cross-ref: 본 항목은 `spec-consistency-findings-2026-05-30.md` 범위와 인접.

## D. FALSE_POSITIVE (조치 불필요, 기록만)

- `spec/conventions/chat-channel-adapter.md` — "modal/버튼" 키워드는 provider 측 메시징 UI(Slack views.open / Discord MODAL) 참조이며 backend adapter 전용. frontmatter 정상. 필요 시 Rationale 에 "backend-only, frontend code: 불해당" 한 줄로 false-positive 완화.

## 비고

- `/spec-coverage` high 72건 중 66건은 `status: spec-only` 로 `code:` 공백이 컨벤션상 허용 — 구현 착수 시 재평가 대상이지 현재 갭 아님(본 plan 제외).
- 산출 SUMMARY: `review/spec-coverage/2026/05/30/12_19_00/SUMMARY.md`.
