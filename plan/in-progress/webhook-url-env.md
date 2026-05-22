---
worktree: (미정 — 신규 worktree 생성 필요)
started: 2026-05-22
owner: developer
source: ai-review W5 / review/code/2026/05/22/15_08_07/maintainability.md
---

# getWebhookUrl 포트 하드코딩 — 환경변수 도입

## 배경

ai-review W5: `getWebhookUrl` 함수의 `window.location.origin.replace(/:\d+$/, ":3011")` 가 개발 포트를 인라인 하드코딩하고 있어 스테이징·프로덕션 환경에서 잘못된 URL 이 생성될 수 있다. spec §2.4 는 "SaaS의 경우 서비스 도메인, 셀프 호스팅의 경우 설정된 도메인" 을 명시.

## 작업 범위

- `NEXT_PUBLIC_WEBHOOK_BASE_URL` 또는 `NEXT_PUBLIC_API_BASE_URL` 환경변수 도입
- `getWebhookUrl` 로직을 `lib/utils/` 레이어로 이동 (테스트 가능하게)
- `.env.example` 갱신

## 완료 기준

- 포트 `3011` 인라인 하드코딩 제거
- 환경변수 미설정 시 안전한 fallback 동작 명시
- lint + unit + e2e 통과

## 관련

- source: `review/code/2026/05/22/15_08_07/maintainability.md` [WARNING]
- source: `review/code/2026/05/22/15_08_07/security.md` [INFO]
