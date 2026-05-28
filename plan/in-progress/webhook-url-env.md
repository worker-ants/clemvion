---
worktree: webhook-url-env-5de041
started: 2026-05-22
owner: developer
status: in-progress
source: ai-review W5 / review/code/2026/05/22/15_08_07/maintainability.md
---

# getWebhookUrl 포트 하드코딩 — 환경변수 도입

## 배경

ai-review W5: `getWebhookUrl` 함수의 `window.location.origin.replace(/:\d+$/, ":3011")` 가 개발 포트를 인라인 하드코딩하고 있어 스테이징·프로덕션 환경에서 잘못된 URL 이 생성될 수 있다. spec WH-EP-02 는 webhook URL 형식을 `{base_url}/api/hooks/{endpoint_path}` 로 명시한다.

webhook 엔드포인트는 백엔드(HooksController)가 서빙하므로, 프론트가 표시·복사하는 URL 의 base 는 "프론트가 가리키는 백엔드 origin" 이어야 한다. 프론트는 이미 `NEXT_PUBLIC_API_URL` 을 백엔드 위치의 SSOT 로 사용하고 있다.

## Phase

### P0. spec 갱신 (project-planner 위임 — 본 PR 머지 전 또는 follow-up)
- [ ] `spec/5-system/12-webhook.md` WH-EP-02 `{base_url}` 항목에 프론트엔드 base 결정 규약 명시: `NEXT_PUBLIC_WEBHOOK_BASE_URL`(명시 override) → `NEXT_PUBLIC_API_URL` 에서 `/api` 제거 유도 → `window.location.origin` fallback.
- [ ] (consistency cross_spec 발견, 본 task 범위 밖) `spec/5-system/2-api-convention.md §11` / `spec/data-flow/10-triggers.md` 의 webhook URL 경로·응답 shape·rate-limit 불일치 정정 — 별도 spec-update plan 으로 분리.
- [ ] (consistency naming 발견) `spec/2-navigation/2-trigger-list.md §2.4` 의 `{base_url}/hooks/` → `{base_url}/api/hooks/` 정정.

### P1. 구현
- [x] `codebase/frontend/src/lib/utils/webhook-url.ts` 신설 — `getWebhookBaseUrl()` / `getWebhookUrl()`. base 우선순위 위 P0 와 동일.
- [x] `triggers/page.tsx` 의 로컬 `getWebhookUrl`(포트 하드코딩) 제거 + 유틸 import.
- [x] `trigger-detail-drawer.tsx` 의 로컬 `getWebhookUrl`(포트 하드코딩) 제거 + 유틸 import.
- [x] `codebase/frontend/.env.example` 에 `NEXT_PUBLIC_WEBHOOK_BASE_URL` 문서화.

### P2. 테스트
- [x] `webhook-url.test.ts` 작성 (override / API_URL 유도 / origin fallback / WH-EP-02 형식 / 포트 미주입 회귀).
- [ ] TEST WORKFLOW (lint · unit · build · e2e) 통과 — **보류: 워크트리 node_modules 미설치**.

### P3. 리뷰
- [ ] REVIEW WORKFLOW (`/ai-review`) + 이슈 조치 + RESOLUTION.md.

## 완료 기준

- [x] 포트 `3011` 인라인 하드코딩 제거 (`page.tsx` / `drawer.tsx` 양쪽).
- [x] 환경변수 미설정 시 안전한 fallback 동작 명시 (유틸 주석 + `.env.example`).
- [ ] lint + unit + e2e 통과.

## 미해결 — 사용자 결정 필요 (consistency plan-coherence [CRITICAL])

`trigger-detail-drawer.tsx` / `triggers/page.tsx` 를 미머지 worktree 2곳이 동시 수정 중:
- `trigger-drawer-829934` (PR 없음) — `trigger-detail-drawer.tsx` import 블록 + WebhookConfigCard
- `chat-channel-form-native-modal-c021b9` (PR 없음) — `triggers/page.tsx` + `trigger-detail-drawer.tsx`

→ 본 변경(import 추가 + 로컬 함수 제거)과 import 블록에서 머지 충돌 예상. 통합 순서(선행 머지 vs 직렬화 vs 충돌 감수) 결정 필요.

## 관련

- source: `review/code/2026/05/22/15_08_07/maintainability.md` [WARNING]
- source: `review/code/2026/05/22/15_08_07/security.md` [INFO]
- consistency: `review/consistency/2026/05/29/08_12_53/` (cross_spec / plan_coherence / convention / naming)
