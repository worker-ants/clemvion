# RESOLUTION — 12_23_45

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (Warning) | 테스트 | 본 커밋 | 지적이 옳고, **지적보다 넓었다** — 놓친 것은 4번째 클래스 하나가 아니라 하위 클래스가 **여섯**이었다. fixture 를 하나 더 넣는 대신 **축을 둘로 갈랐다**(아래) |
| INFO #1 · #4 | 후속 등재 | — | 헬퍼 JSDoc 파일 간 중복 · "형제 3곳"→4곳. 이미 plan §2 에 있는 "서술 중복" 항목과 같은 묶음 |
| INFO #2 · #3 · #5 · #6 | 무조치 | — | 리뷰가 "우선순위 낮음/조치 불요" 로 판정. #6 은 병렬 reviewer 의 뮤테이션 관측 기록(이미 원복됨) |

## Warning #1 — 세 번째로 같은 형태를 밟았다

이 PR 에서 "내 정량 주장이 실제보다 넓다" 가 세 번 나왔다:

1. 1라운드 — 주석의 C2 서술이 §6.3.1 의 한정어("민감")를 떨어뜨렸다.
2. 2라운드 — "4개 오류 종류" 는 **호출 4건 / 클래스 3개** 였고, 코드화된 단언은 **1종**뿐이었다.
3. 3라운드 — 3종으로 늘렸는데 **4번째**(`ExpressionFunctionError`)가 남아 있었다.
   리뷰어가 `FunctionError` 생성자에 속성을 주입하고 47/47 GREEN 을 실측해 증명했다.

세 번째에서야 이게 **fixture 를 하나 더 넣어 끝날 문제가 아님**이 분명해졌다. 직접 세어
보니 `ExpressionError` 하위 클래스는 넷도 아니고 **여섯**이다:

```
SyntaxError · ReferenceError · TypeError · FunctionError · TimeoutError · DepthExceededError
```

`{{ unknownFn() }}` → `ExpressionFunctionError` / `EXPR_FUNCTION_ERROR` /
`Object.keys = ['name','code','position']` 로 도달을 직접 확인했다(리뷰 주장 재현).

## 그래서 축을 둘로 갈랐다

| 축 | 어디 | 무엇을 잠그나 |
|---|---|---|
| **클래스 전수** | `packages/expression-engine/src/__tests__/error-shape.spec.ts` (신규) | 그 모듈이 export 하는 하위 클래스를 **열거해서** 전부 검사. 개수가 바뀌면 전수성 단언이 **먼저** RED |
| **경로** | `expression-resolver.service.spec.ts` 의 `it.each` | 이 catch 가 실제로 그런 `cause` 를 달아 내보내는지. 값싸게 트리거되는 **네 종**(Timeout·Depth 는 비싸서 전수 축에 맡긴다) |

핵심은 **열거**다. 소비처에서만 잠그면 "거기서 지나가는 클래스" 만 잠기고 나머지는 조용히
새로 생긴다 — 이 PR 이 두 라운드 연속 그 상태였다. 클래스 정의 옆에서 export 를 열거하면
새 하위 클래스가 **자동으로** 덮인다.

전수 캐너리는 `message`/`stack` 이 non-enumerable 이라 화이트리스트 밖이라는 것도 함께
단언한다 — 축을 `getOwnPropertyNames` 로 바꾸면 의미가 달라진다는 근거를 코드로 고정.

## 뮤테이션 (예측 / 실측)

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| M9 `FunctionError` 에 민감 속성 주입 (**리뷰가 뚫은 그 구멍**) | RED | **RED** — 1 failed / 132 |
| M10 새 하위 클래스 `QuotaError` 가 조용히 추가된다 | RED (전수성 단언) | **RED** — 1 failed / 133 |

M9 는 리뷰어가 47/47 GREEN 으로 뚫었던 바로 그 뮤턴트다. M10 은 이번 fix 가 "한 칸 더"
가 아니라 **클래스 자체를 닫았음**을 보인다 — 구멍을 메운 게 아니라 구멍이 생기는 경로를
막았다.

원복은 `cp` + 절대경로 백업본에서 했다.

## TEST 결과

- lint  : 통과
- unit  : 통과 (expression-engine 132/132 · backend expression spec 48/48)
- build : 통과
- e2e   : 통과 285/285

## 보류·후속 항목

INFO #1(헬퍼 JSDoc 파일 간 중복)·#4("형제 3곳"→4곳)는 미조치. 둘 다 plan §2 에 이미 있는
"서술 중복" 후속 항목과 같은 묶음이라 **항목을 늘리지 않고 그 항목을 갱신**했다.
developer SKILL **§수렴 예외**: (a) 동작 결함이 아니고 주석 카운트·중복 서술이다,
(b) 셋 다 spec-linked 파일이라 한 줄만 건드려도 `/ai-review` 와 `--impl-done` 이 동시에
무효가 된다, (c) 등재 사유는 비용이 아니라 수렴이다 — 이번 라운드에서 발견의 성격이
동작(커버리지 구멍) → **문서**로 확실히 이동했다, (d) 등재는 이 턴에 했다.
