# RESOLUTION — 12_50_04

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (Warning) | 테스트 | 본 커밋 | **내가 만든 단언이 겉보기보다 약했다.** `Object.values(ErrorCode)).toContain(err.code)` 는 "enum 안의 값인가" 만 보는 타입 검사라 클래스↔코드 매핑이 뒤바뀌어도 통과한다. 클래스별 정확값 표(`EXPECTED_CODE`)로 전환 + 표와 하위 클래스의 1:1 단언 추가 |
| #2 (Warning) | 문서 | 본 커밋 | `it.each` 콜백 인라인 주석 "셋이" → "넷이". 3라운드에서 fixture 를 넷으로 늘리며 상위 설명만 고치고 이 한 줄을 놓쳤다 |
| INFO #1 | 테스트 | 본 커밋 | `position` 단언이 이 파일 안에서 vacuous disjunction 이었다(fixture 가 `position` 을 안 넘겨 정수 분기 미실행). `toBeUndefined()` 정확값으로 바꿨다 — 정수 분기는 base 케이스가 지나간다 |
| INFO #2 · #3 · #4 · #5 · #6 | 후속/무조치 | — | 전부 이전 라운드부터 plan §2 에 추적 중이거나 리뷰가 "조치 불요/우선순위 낮음" 으로 판정 |

## Warning #1 — GREEN 이 증거가 아니었다

3라운드에서 넣은 전수 캐너리의 `code` 단언이 실제로는 **값의 타입**만 봤다. 리뷰어가
`SyntaxError`/`ReferenceError` 의 `ErrorCode` 를 맞바꾸는 뮤테이션으로 **9/9 GREEN** 을
실측해 그것을 보였다. 지적이 정확하다.

정확값 표로 바꾸고, 표가 하위 클래스와 어긋나면(새 클래스를 표에 안 적으면) `undefined`
로 조용히 통과하는 대신 먼저 RED 가 나도록 1:1 단언을 함께 넣었다. 이로써
`TimeoutError`/`DepthExceededError` 의 클래스↔코드 매핑도 처음으로 검증된다 — backend
`it.each` 는 이 둘을 커버할 수 없다.

## 뮤테이션 (예측 / 실측)

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| M11 Syntax ↔ Reference 의 `ErrorCode` 맞바꿈 (**리뷰어가 9/9 GREEN 낸 그 뮤턴트**) | RED | **RED** — 5 failed / 133 |
| M12 `EXPECTED_CODE` 표에서 `TimeoutError` 항목 삭제 | RED | **RED** — 2 failed / 133 |

M11 이 이 라운드의 핵심 증거다: 조치 **전** 9/9 GREEN → 조치 **후** 5 failed.

원복은 `cp` + 절대경로 백업본에서 했다.

## TEST 결과

- lint  : 통과 (`_test_logs/lint-20260829-130032.log`, 47s)
- unit  : 통과 (`_test_logs/unit-20260829-130123.log`, 66s — expression-engine 133/133)
- build : 통과 (`_test_logs/build-20260829-130233.log`, 147s)
- e2e   : 통과 285/285 (`_test_logs/e2e-20260829-130505.log`, 266s)

## 보류·후속 항목

INFO #2(캡처 헬퍼 `__test-utils__` 이동)·#4(enumerable 근거 서술 3중 중복)·#5("형제 3곳"
→4곳)는 미조치 — plan §2 의 기존 "근거 서술 중복 정리 묶음" 항목이 이미 셋을 다 담고
있어 **항목을 늘리지 않고 그대로 둔다**. INFO #3(fixture 튜플 타입 안전성)·#6(non-enumerable
사각지대)은 리뷰가 각각 "우선순위 낮음"·"조치 불요(tracked)" 로 판정.

developer SKILL **§수렴 예외**: (a) 남은 지적이 전부 스타일·중복 서술이고 동작 결함이
아니다 — 이번 라운드에서 **동작에 닿는 마지막 축(클래스↔코드 매핑)을 닫았다**.
(b) 셋 다 spec-linked 파일이라 한 줄만 건드려도 `/ai-review`·`--impl-done` 이 동시에
무효가 된다. (c) 등재 사유는 비용이 아니라 수렴이다 — 4라운드에 걸쳐 발견의 성격이
커버리지 구멍 → 단언 정밀도 → **서술 중복**으로 이동했고, 이번 라운드의 두 Warning 중
하나는 한 단어 오타였다. (d) 등재는 이전 턴에 했고 이번 턴에 갱신했다.
