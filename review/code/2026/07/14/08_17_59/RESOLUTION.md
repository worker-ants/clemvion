# RESOLUTION — F-1 review-fix 델타 (08_17_59)

리뷰: `review/code/2026/07/14/08_17_59/SUMMARY.md` (BLOCK: NO, Critical 0 / Warning 2). 조치 완료.

## 조치 항목

| # | reviewer | 발견 (Warning) | 조치 | commit |
|---|---|---|---|---|
| 1 | maintainability | hooks.spec 회귀 가드 `mock.calls[]` 직접 인덱싱 → 관용구 불일치 | fix — `expect.not.objectContaining({ nodeId })` | `92ae3f1a1` |
| 2 | documentation | §7.5.1 커버리지 표 in_process_trusted "이유" 과일반화(form 제출 nodeId 인지) | fix — scope-단위 면제 재서술 + CHANGELOG 조정 | `92ae3f1a1` |

## TEST 결과

- lint: 통과
- unit: 통과 (hooks.service.spec 46 tests 포함)
- build: 통과
- e2e: 직전 F-1 라운드 통과(254 tests) 유효 — 본 델타는 unit-test assertion 관용구화 + 문서 2줄로
  **product 런타임·e2e 경로 무변경**이라 재실행 갈음(면제: 런타임 코드 미변경).

## 보류·후속 항목
없음 — 델타의 2 WARNING 모두 fix. 상위 트랙 백로그(F-4/F-5/F-6)는 plan 참조.
