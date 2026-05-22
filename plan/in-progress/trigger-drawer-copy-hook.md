---
worktree: (미정 — 신규 worktree 생성 필요)
started: 2026-05-22
owner: developer
source: ai-review W4 / review/code/2026/05/22/15_08_07/maintainability.md
---

# copyText 중복 제거 — useCopyToClipboard 훅 추출

## 배경

ai-review W4: `WebhookConfigCard`(`.then` 콜백 형태)와 `ExternalInteractionCard`(`try/catch` 형태) 양쪽에 `navigator.clipboard.writeText + toast` 패턴이 중복 정의되어 있고 구현 스타일도 불일치.

## 작업 범위

- `codebase/frontend/src/hooks/useCopyToClipboard.ts` 신규 작성
- 두 컴포넌트의 `copyText` 인라인 구현을 훅 사용으로 교체
- 기능 동작 동일 보장

## 완료 기준

- 단일 `useCopyToClipboard` 구현으로 통합
- lint + unit + e2e 통과

## 관련

- source: `review/code/2026/05/22/15_08_07/maintainability.md` [WARNING]
