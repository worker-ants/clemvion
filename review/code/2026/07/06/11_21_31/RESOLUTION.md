# RESOLUTION — 워크플로우 목록 단일 태그 필터

리뷰: `review/code/2026/07/06/11_21_31/` (requirement / maintainability / testing / scope 4인 fan-out). spec 측은 별도 `review/consistency/2026/07/06/11_09_44/` 4인.

전체 위험도 LOW. Critical 0. Warning 2 (둘 다 testing, 테스트 신뢰도) — 해소.

## Warning (해소)

### W1 — page="1" 단언 오해 유발 주석 (testing)
"sends ?tag=... on the first page" 테스트의 `page="1"` 단언은 folder-filter 테스트와 동일하게 static
next/navigation mock 하에서 vacuous(page-reset 제거해도 그린). folder 테스트엔 한계 주석이 있으나 tag
테스트엔 debounce 관련 무관 주석만 있어 오해 소지.

**Fix**: page="1" 단언 위에 folder 테스트와 동일한 정직한 한계 주석 추가(emitted param 검증이며 live 2→1
전환은 검증 안 함). tag 값 단언(`tag=sales`)·hasActiveFilters 반영은 리뷰어 mutation testing 으로 실검증됨.

### W2 — 공백-only 입력 트리밍 부재 + 커버리지 갭 (testing)
`debouncedTag` 미트리밍이라 `"   "` 입력 시 `?tag=%20%20` 송신 + 활성 필터 처리. 경계값 테스트 부재.

**Fix**: 검색 필터도 trim 하지 않는 기존 패턴과의 일관성을 위해 **no-trim 을 의도된 동작으로 확정** — page.tsx
송신부에 근거 주석(공백-only 는 서버 `= ANY(tags)` 에서 0건 수렴, 두 텍스트 필터 동작 일관) 추가 + 현재
동작을 고정하는 테스트(`whitespace-only tag as-is`) 신설. 향후 trim 도입 시 이 테스트가 회귀를 잡는다.

## INFO (미조치 — 근거)
- requirement/maintainability 의 대소문자 미정규화·reset 이중세팅 비대칭 등은 기존 서버/검색 동작 그대로거나
  UX 이점이라 버그 아님.
- spec-only 단계 consistency CRITICAL("코드 없음")은 최종 커밋에 FE 코드 동반 → 해소(requirement 리뷰어 diff 로 재확인).

## 검증
- vitest workflows-page.test.tsx: **24 passed** (W2 테스트 +1)
- frontend tsc/eslint clean · spec-link-integrity·spec-plan-completion 등 spec 가드 통과
