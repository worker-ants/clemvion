# RESOLUTION — review/code/2026/06/20/15_43_17

3 regression 테스트 추가(text-classifier signal·IE single-turn signal·parallel 런타임 depth 가드)에 대한 리뷰. RISK=LOW, CRITICAL=0, WARNING=3. W1·W3 조치, W2 disposition, SPEC-DRIFT 는 planner follow-up.

## 조치 항목

| SUMMARY # | 발견 | 조치 |
|---|---|---|
| WARNING #3 (Maintainability) | text-classifier signal 검증이 `mock.calls[length-1]` 인덱스 접근 — IE 패턴과 불일치 | `toHaveBeenCalledWith(expect.anything()×3, expect.objectContaining({ signal }))` 로 교체 — call-count 비의존, IE 와 일관 |
| WARNING #1 (Requirement) | depth=1 `not.toThrow` 가 edge 위상 우연인지 불확실 | 반환 capture 후 `allBodyNodeIds.has('p3')` 단언 추가 — inner Parallel 이 body 에 포함됨을 확정해, depth=2 throw 가 'body 내 Parallel + depth>2' 조건 발화임을 증명(throw 미발생도 capture 가 동시 검증) |

## TEST 결과
- lint: 통과 (PASS)
- unit: 통과 (PASS — backend 7140 + 전 패키지)
- build: 통과 (PASS — docker 이미지 포함)
- e2e: 통과 (PASS — 205 tests)

## 보류·후속 항목
- **WARNING #2 (private 메서드 캐스팅)**: `planParallelBody` 는 private — `as unknown as {sig}` 직접 접근은 **private 메서드 단위 테스트의 표준 패턴**. `protected` 승격은 테스트 전용으로 프로덕션 가시성을 바꾸는 별도 변경(자체 리뷰 필요)이라 본 PR 미적용. 시그니처 변경 시 캐스트는 컴파일오류 없이 통과하나, 호출 동작이 바뀌면 테스트가 **기능적으로 실패**해 회귀는 잡힌다. → 현행 유지.
- **SPEC-DRIFT ×2 (`node-cancellation.md §6` 구현 현황 표)**: IE/text-classifier signal 단위테스트 커버리지를 §6 표에 반영하는 것은 `spec/conventions/` 편집 = project-planner 영역(developer 는 spec read-only). 코드 revert 불필요(코드 옳음). → planner 위임 follow-up.
- INFO (concurrency clamp 경계 케이스·waitAll=false 경로·already-abort 핸들러 동작·register 격리 주석 등): 비차단, 별도 이슈로 추적 가능.
