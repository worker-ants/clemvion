# Code Review 통합 보고서 — follow-up B (W9·W11·INFO 10/12/13)

리뷰 세션: `review/code/2026/05/16/18_12_12`
worktree: `cafe24-mall-dup-followup-b-4d8e2a`
리뷰어: 13 / 13 success / pending 0

## 전체 위험도

**LOW** — Critical 0. WARNING 4건 + INFO 20건. 이전 PR (#112) 의 deferred 5건 처리가 정확하고, 추가로 INFO 10 작성 중 실제 결함 (audit fail → user 500) 까지 발견·수정한 점이 강점.

## Critical 발견사항

없음.

## Warning (4건) — 모두 처리

- **W1** `let saved: Integration;` definite assignment 누락 → ✅ `let saved!: Integration;` 변경
- **W2** mallId 변경 시 stale conflict 배너 잔존 → ✅ effect 진입부에서 `setConflict(null)` 즉시 호출
- **W3** `create()` 내 12줄 인라인 주석 → ✅ 1단락 + spec Rationale 링크로 압축
- **W4** 빈 문자열 mall_id 엣지 케이스 미검증 → ✅ 회귀 보호 테스트 추가

## INFO (20건) — 일부 처리

- **I3** `CAFE24_MALL_ID_PATTERN` 정규식 단일 진실 → ✅ hook 에서 export, page.tsx validate() 가 import
- **I8** `DEBOUNCE_ADVANCE_MS` 상수가 hook 테스트에는 미적용 → ✅ 적용
- **I14** hook `@param` JSDoc 누락 → ✅ 추가
- **I15** error-codes 의 spec 경로 누락 → ✅ 추가
- **I16** `PRECHECK_DEBOUNCE_MS` 역참조 안내 → ✅ 추가
- 나머지 INFO 15건 (운영 가시성, 다른 mutating 메서드 audit 패턴 적용, queryKey 정합 등) — 별도 PR / 장기

## 검증

- backend: lint 0 errors / 3734 unit / build / e2e 79
- frontend: lint clean / 1432 unit / build (W4 빈 문자열 추가)
