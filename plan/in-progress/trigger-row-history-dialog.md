---
worktree: trigger-history-dialog-ad1eb0
started: 2026-05-22
owner: developer
---

# Trigger Row Actions — 호출 이력 전용 Dialog 분리

> 관련 spec: [`spec/2-navigation/2-trigger-list.md`](../../spec/2-navigation/2-trigger-list.md) §2.1 + Rationale R-6
> 발생 배경: PR #265 (Plan A) 의 ⋮ 메뉴 "상세 보기" 와 "호출 이력" 이 둘 다 같은 detail drawer 를 열어 사용자에게 동일 동작으로 보였음. 사용자가 분리 요청.

## 작업 단위

### 1. Frontend

- [ ] 신규 `codebase/frontend/src/components/triggers/trigger-history-dialog.tsx`
  - props: `triggerId: string | null`, `triggerName?: string`, `open: boolean`, `onClose: () => void`, `onOpenFullDetail?: () => void`
  - `useQuery` 로 `GET /api/triggers/:id/history?limit=10` 호출 (drawer 의 history 조회와 동일 endpoint, 별도 queryKey `["trigger-history-dialog", triggerId]` 로 캐시 분리)
  - 본문: Recent Calls 목록만 표시 (시각·상태 Badge). drawer 의 Recent Calls 카드와 동일 시각 패턴 재사용
  - 푸터: "Close" + "전체 상세 보기" 버튼 (`onOpenFullDetail` 이 있으면 노출 — 클릭 시 dialog 닫고 drawer 오픈)
- [ ] `codebase/frontend/src/app/(main)/triggers/page.tsx`
  - 신규 state: `historyTrigger: { id: string; name: string } | null`
  - viewHistory 항목의 `onSelect` 를 `setSelectedTriggerId` 에서 `setHistoryTrigger({id, name})` 으로 분리
  - "전체 상세 보기" 콜백: `setHistoryTrigger(null); setSelectedTriggerId(trigger.id);` (dialog → drawer 이행)
  - `<TriggerHistoryDialog>` 마운트

### 2. i18n (KO/EN parity 의무)

- `triggers.history.title` — "호출 이력 — {{name}}" / "Recent calls — {{name}}"
- `triggers.history.empty` — "최근 호출 이력이 없어요" / "No recent calls."
- `triggers.history.loadFailed` — "호출 이력을 불러올 수 없어요" / "Failed to load history."
- `triggers.history.viewFullDetail` — "전체 상세 보기" / "View full detail"
- `triggers.history.close` — "닫기" / "Close" (또는 `common.close` 재사용 — codebase 확인)

### 3. 테스트

- 신규 `codebase/frontend/src/components/triggers/__tests__/trigger-history-dialog.test.tsx`
  - 로딩·빈 상태·정상 노출 3 케이스
  - "전체 상세 보기" 클릭 시 `onOpenFullDetail` 호출 검증
  - GET endpoint URL/queryKey 검증

### 4. 검증

- frontend lint + unit
- backend 무변경이지만 cross-stack 빌드 (PROJECT.md `cross-stack 의무`)
- e2e — 기존 `GET /api/triggers/:id/history` 의 회귀 점검

## 수용 기준

- ⋮ 메뉴의 "상세 보기" 와 "호출 이력" 이 서로 다른 UI (drawer vs dialog) 로 노출된다
- "호출 이력" dialog 에는 메타·인증·EIA·Schedule 카드가 표시되지 않는다 — Recent Calls 만
- dialog 안의 "전체 상세 보기" 버튼이 dialog 를 닫고 drawer 를 연다 (목록 다시 거치지 않음)
- 모든 역할 (viewer 포함) 이 호출 이력 dialog 진입 가능
- KO/EN parity 통과

## 관련 PR

- 선행: #265 (Plan A — ⋮ 메뉴 + 삭제 모달). 본 PR 은 그 follow-up.
