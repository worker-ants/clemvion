# RESOLUTION — 11_58_35

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (Warning) | 테스트 + 문서 | 본 커밋 | **커버리지를 실제로 넓혔다.** `it.each` 로 `ExpressionError` 세 하위 클래스를 각각 실행 경로로 지나가게 했다(종전엔 syntax 1종만). "4개 오류 종류" 서술도 정정 — 호출은 4건이었지만 클래스는 **3개**다 |
| #2 (Warning) | 문서 | 본 커밋 | plan 의 "뮤테이션 5/5" 가 본문에 M3 을 한 번도 안 적고 있었다. 5건 전부를 표로 실었다 |
| #3 (Warning) | 테스트 구조 | 본 커밋 | `captureThrown`(동기) · `captureRejected`(비동기) 로 캡처 보일러플레이트 추출. **vacuity 방지 단언을 헬퍼가 품는다** — 그 함정 설명이 케이스마다 복제되지 않는다 |
| INFO #1 · #2 · #5 · #6 | 무조치 | — | 리뷰가 직접 "조치 불요" 로 판정 (non-enumerable 사각지대는 plan 추적 중, 단언 형태 차이는 데이터 차이의 정확한 반영) |
| INFO #3 · #4 | 후속 등재 | — | "형제 3곳"→4곳 카운트 · enumerable 근거 서술 중복. 아래 §보류 참조 |

## Warning #1 — 지적이 옳고, 내 문장보다 더 나쁜 상태였다

리뷰가 두 겹을 짚었다.

1. **서술**: "`evaluate()` 를 4개 오류 종류로 직접 호출" — 호출은 4건이 맞지만 그중 둘이
   같은 클래스라 **클래스는 3개**다. 내가 케이스 수를 클래스 수로 적었다.
2. **더 중요한 것**: 코드화된 단언은 **syntax 한 종류만** 지나갔다. `Reference`/`Type`
   경로에 민감 속성이 붙어도 GREEN 이다. 화이트리스트를 "세 클래스 전부 실측했다" 고
   적어 놓고 그중 하나만 잠근 셈이다.

`it.each` 로 셋을 각각 지나가게 하고, 각 fixture 가 정말 그 클래스를 만들어 내는지도
함께 단언했다(`cause.name`). 그러지 않으면 세 번 도는 것이 커버리지가 아니라 착시다.

fixture 는 실측으로 골랐다 (spec 의 `baseContext` 로 직접 확인):

| 식 | 클래스 | code |
|---|---|---|
| `{{ $input. }}` | `ExpressionSyntaxError` | `EXPR_SYNTAX_ERROR` |
| `{{ $input.nonExistent.deep }}` | `ExpressionReferenceError` | `EXPR_REFERENCE_ERROR` |
| `{{ $input.count.b.c }}` | `ExpressionTypeError` | `EXPR_TYPE_ERROR` |

## 확장된 캐너리의 뮤테이션 — 예측이 한 번 빗나갔다

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| M6 Reference fixture 를 syntax 식으로 바꾼다 | RED | **RED** — 1 failed / 47 |
| M7 M6 + `cause.name` 단언 제거 | GREEN | **RED** — 1 failed / 47 |
| M8 M6 + `cause.name` 제거 + `code` 를 정규식으로 되돌림 | GREEN | **GREEN** — 47 passed |

M7 이 빗나갔다. 이유를 추측으로 두지 않고 M8 로 확인했다: fixture 판별력을 지키는 것은
`cause.name` **하나가 아니라 둘**이다 — `expect(shape.code).toBe(expectedCode)` 도
클래스에 의존하는 단언이라 같이 막고 있었다. 내가 하나만 모델링했고, 실제 가드는 예측보다
강했다. (그래서 M8 은 두 단언을 다 치워야 GREEN 이 된다 = 착시가 성립한다.)

원복은 전부 `cp` + 절대경로 백업본에서 했다.

## TEST 결과

- lint  : 통과 (`_test_logs/lint-20260829-121317.log`, 49s)
- unit  : 통과 (`_test_logs/unit-20260829-121410.log`, 73s — 대상 2개 spec 137/137)
- build : 통과 (`_test_logs/build-20260829-121528.log`, 158s)
- e2e   : 통과 285/285 (`_test_logs/e2e-20260829-121810.log`, 247s)

## 보류·후속 항목

INFO #3(`secret-resolver.service.ts` 의 "형제 3곳" → 실제 4곳) · INFO #4(enumerable 근거
서술이 두 spec 에 중복)는 미조치. developer SKILL **§수렴 예외**:

- (a) **동작 결함이 아니다.** 둘 다 주석 카운트·중복 서술이고, 리뷰 자신이 "급하지 않음"
  으로 표시했다. 발견의 성격이 이번 라운드에 이미 동작 → 구조 → **문서**로 이동했다.
- (b) **fix 가 새 라운드를 강제한다.** 둘 다 spec-linked 파일(`secret-resolver.service.ts`,
  두 spec)이라 주석 한 줄만 건드려도 방금 통과한 `/ai-review` 와 이어서 준비할
  `--impl-done` 이 freshness 비교에서 동시에 무효가 된다.
- (c) 등재 사유는 "비용" 이 아니라 "수렴" 이다 — 이 문단이 근거다.
- (d) 등재는 이 턴에 `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 에 했다.
