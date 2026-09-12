# RESOLUTION — 라운드 3 (`review/code/2026/09/12/20_53_01`)

**판정**: Critical 0 · WARNING 3. Critical 0.

**해소 커밋**: `bedf376f0`

| # | 지적 | 처분 |
|---|---|---|
| 1 | 신규 `400 VALIDATION_ERROR` 가 가이드 4곳에 미반영 (**그 줄을 다른 이유로 편집했으면서** 놓쳤다) | 네 곳에 추가 |
| 2 | 두 결함 클래스 중 가이드 식별자 쪽만 가드를 못 얻었다 | 후속 가드 항목 등재 (비대상 설계까지 명시) |
| 3 | 판정 함수 AST 중첩 5단 | `collectMethodViolations` 추출 — 순회와 판정 분리, 카운트는 한 루프 유지 |

INFO 2건(인덱스드 액세스 타입 → `UuidParamAxis`, *"전부 고쳤다"* → *"둘은 고치고 하나는 구조로 면제"*)도 반영.

**부수 사고 기록**: 리팩터 뒤 뮤테이션 원복이 낡은 사본으로 되돌려 그 리팩터와 **이미 커밋된
docstring 정정까지** 지웠다. 하네스(`run.py`)가 실행 시점에 스냅샷을 뜨도록 고치고 재적용했다.

---

검증: 각 라운드마다 `.claude/tools/run-test-all.sh lint unit build e2e` ALL PASS
(backend 460 suites · 9,642 tests, e2e 305 tests).
