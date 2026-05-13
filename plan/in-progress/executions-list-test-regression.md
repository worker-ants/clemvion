# execution-list-page 회귀 테스트 실패

> 발견 시점: 2026-05-13 (profile-safer-edit 작업 중 TEST WORKFLOW 단계)
> 영향 범위: `frontend/src/app/(main)/workflows/[id]/executions/__tests__/execution-list-page.test.tsx`

## 증상

`renders execution rows with status and duration` (line 106) 테스트가 안정적으로 실패한다.

```
expect(await screen.findByText("Completed"))
→ DOM 상에 "Completed" 텍스트 없음. 필터 버튼은 "Cancelled", "Waiting" 등만 렌더링됨.
```

`renders filter buttons` (line 115) 도 같은 원인으로 실패 (`findByText("Completed")` 사용).

## 원인 추정

- 필터 버튼 라벨 또는 status 표시 컴포넌트의 i18n 키가 "Completed" → 다른 텍스트로 변경되었을 가능성.
- 또는 mock 응답의 status 값과 컴포넌트가 기대하는 값이 어긋남.
- `git log -- "frontend/src/app/(main)/workflows"` 의 최근 커밋 `fcb5b6c3 refactor(workflows): ai-review 3차 조치` 이후 회귀로 추정.

## 본 plan 과의 관계

`profile-safer-edit` 브랜치(/profile 안전성 개선)와 무관. 본 작업 시작 전(`a9ad7cdf` 직후 `git stash` 상태) 에서도 동일하게 실패함을 확인 — main 에서 분기된 시점부터 깨진 상태.

## 후속 처리

- 별도 plan 으로 추적해 메인 작업(`profile-safer-edit`) 진행을 가로막지 않는다.
- workflows 영역 책임자가 컴포넌트 또는 테스트 한 쪽을 갱신해야 한다.
- 본 plan 은 작업이 시작되면 owner 와 함께 갱신, 완료 시 `complete/` 로 이동한다.
