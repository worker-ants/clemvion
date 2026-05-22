---
worktree: (미정 — 신규 worktree 생성 필요)
started: 2026-05-22
owner: developer
source: ai-review W3 / review/code/2026/05/22/15_08_07/maintainability.md
---

# ExternalInteractionCard handleSave — useMutation 통일 리팩토링

## 배경

ai-review W3: `OverviewCard`·`WebhookConfigCard`는 `useMutation`의 `isPending`으로 로딩 상태를 관리하는 반면 `ExternalInteractionCard`의 `handleSave`는 `async/await` + 수동 `setSaving(true/false)` 패턴을 사용해 동일 파일 내 비동기 패턴이 혼재한다.

## 작업 범위

- `ExternalInteractionCard.handleSave` 를 `useMutation` 으로 교체
- `saving` state 제거, `isPending` 으로 대체
- 오류 처리 분기 동일하게 유지

## 완료 기준

- `trigger-detail-drawer.tsx` 내 비동기 패턴 `useMutation` 으로 통일
- lint + unit + e2e 통과

## 관련

- source: `review/code/2026/05/22/15_08_07/maintainability.md` [WARNING]
