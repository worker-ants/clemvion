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

### P0. spec 갱신 (project-planner — 완료, commit db61ad78)
- [x] `spec/5-system/12-webhook.md` WH-EP-02 에 프론트 base 결정 규약 명문화 (NEXT_PUBLIC_WEBHOOK_BASE_URL → NEXT_PUBLIC_API_URL `/api` 제거 → window.location.origin). 적용 명세: `plan/complete/spec-draft-webhook-consistency.md`.
- [x] (consistency cross_spec 10건) `spec/5-system/2-api-convention.md §11`(전면 위임+정정) / `spec/data-flow/{10-triggers,0-overview}.md` 의 webhook URL·응답 shape·rate-limit·메서드·HMAC·workspaceSlug drift 를 12-webhook SoT 기준 정합화.
- [x] (consistency naming) `spec/2-navigation/2-trigger-list.md §2.4` `{base_url}/hooks/` → `{base_url}/api/hooks/` 정정.
- [x] webhook rate limit 결정 — 사용자 확인: 코드 현행값 **100 req/min**(글로벌 throttler default) 유지. spec 이미 100 으로 통일됨 (추가 변경 없음).

> consistency-check --spec 결과(review/consistency/2026/05/29/09_24_14): cross_spec 클린. summary 의 BLOCK:YES 는 적용 전 draft·미머지 코드 기준 stale read (C-1~4 이미 반영·C-6 잔존 0건·C-7 코드에 실재) — 수동 재검증으로 BLOCK 사유 없음 확인. 단 rate-limit(C-5) 만 실 사용자 결정 잔여.

### P1. 구현
- [x] `codebase/frontend/src/lib/utils/webhook-url.ts` 신설 — `getWebhookBaseUrl()` / `getWebhookUrl()`. base 우선순위 위 P0 와 동일.
- [x] `triggers/page.tsx` 의 로컬 `getWebhookUrl`(포트 하드코딩) 제거 + 유틸 import.
- [x] `trigger-detail-drawer.tsx` 의 로컬 `getWebhookUrl`(포트 하드코딩) 제거 + 유틸 import.
- [x] `codebase/frontend/.env.example` 에 `NEXT_PUBLIC_WEBHOOK_BASE_URL` 문서화.

### P2. 테스트
- [x] `webhook-url.test.ts` 작성 (override / API_URL 유도 / origin fallback / WH-EP-02 형식 / 포트 미주입 회귀).
- [x] lint · unit · build 통과 (`npm ci` 후 — full unit 2833 pass, lint 0 error, build OK).
- [ ] e2e — 자동 흐름 환경 차단 (순수 프론트 표시 로직, unit 으로 보호).

### P3. 리뷰
- [x] REVIEW WORKFLOW (`/ai-review` 4 reviewer 전부 LOW) + 이슈 조치 + `review/code/2026/05/29/08_30_00/RESOLUTION.md`.

## 완료 기준

- [x] 포트 `3011` 인라인 하드코딩 제거 (`page.tsx` / `drawer.tsx` 양쪽).
- [x] 환경변수 미설정 시 안전한 fallback 동작 명시 (유틸 주석 + `.env.example`).
- [x] lint + unit + build 통과 (e2e 는 환경 차단 — 후속).

## 미해결 — 사용자 결정 필요 (consistency plan-coherence [CRITICAL])

`trigger-detail-drawer.tsx` / `triggers/page.tsx` 를 미머지 worktree 2곳이 동시 수정 중:
- `trigger-drawer-829934` (PR 없음) — `trigger-detail-drawer.tsx` import 블록 + WebhookConfigCard
- `chat-channel-form-native-modal-c021b9` (PR 없음) — `triggers/page.tsx` + `trigger-detail-drawer.tsx`

→ 본 변경(import 추가 + 로컬 함수 제거)과 import 블록에서 머지 충돌 예상. 통합 순서(선행 머지 vs 직렬화 vs 충돌 감수) 결정 필요.

## 관련

- source: `review/code/2026/05/22/15_08_07/maintainability.md` [WARNING]
- source: `review/code/2026/05/22/15_08_07/security.md` [INFO]
- consistency: `review/consistency/2026/05/29/08_12_53/` (cross_spec / plan_coherence / convention / naming)
