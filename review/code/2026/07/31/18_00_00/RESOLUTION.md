# RESOLUTION — review/code/2026/07/31/18_00_00

대상: `#1033` 리뷰의 보류 INFO 10건 처분 PR. 결과 **Critical 0 · Warning 0 · INFO 6**, 위험도 LOW.
INFO 중 **실질 2건을 조치**하고 4건은 근거와 함께 비조치로 종결했다.

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|-----------|------|------|------|
| INFO #3 | 문서(사실 정확성) | 본 커밋 | plan 의 mutation 실측표 "3 failed" 가 **틀렸다**. 재현 결과 단독 M2 는 **2 failed** — 정정 + 원인 기록 |
| INFO #2 | 테스트(mutation 갭) | 본 커밋 | `condition` 삼항의 **null 분기** mutation 이 생존함을 재현 확인 후 단언 추가로 닫음 |
| INFO #1·#4·#5·#6 | — | 비조치 | 근거는 plan §3 |

---

### INFO #3 — 내 수치가 틀렸다 (재현 확인)

리뷰어가 "plan 은 `edgeRows.length > 0` 가드 제거를 3 failed 로 적었으나 독립 재현은 2 failed" 라고
지적했다. **재현했고, 리뷰어가 맞다.**

```
M2 단독 적용 → duplicate 스코프: 2 failed / 19 passed
              → 전체 스펙:      2 failed / 78 passed
```

**원인 — 내 실행 오류**: 직전 mutation(M1) 을 원복하는 명령이
`cd <이미 들어와 있는 경로> && cp <백업> <소스>` 형태였는데, `cd` 가
`no such file or directory` 로 실패해 **`&&` 뒤의 `cp` 가 실행되지 않았다**. 그 결과 M1 이 남은 채
M2 가 얹혀 **두 mutation 이 겹친 수치**(3 failed)를 실측값으로 기록했다.

교훈은 수치 자체가 아니라 절차다 — mutation 은 **단독 적용 후 원복**이 전제이고, 원복이 실제로 됐는지
확인하지 않으면 다음 측정이 오염된다. plan §1 에 "각 mutation 은 단독 적용 후 원복" 을 명시하고
M1/M2/M3 를 개별 행으로 분리했다.

### INFO #2 — mutation 생존 재현 후 닫음

최초 테스트는 `condition` 이 **있는** 엣지(ERROR, `{foo:1}`)만 단언해, 삼항의 false 분기를
`undefined` 로 바꾸는 mutation 이 생존했다.

```
M3 (`... : edge.condition` → `... : undefined`) 적용 → 생존 (전부 통과)
`condition: null` 엣지에 toBeNull() 단언 추가 후    → 1 failed / 79 passed  (닫힘)
```

`insertedRows(Edge)` 에서 DATA 타입 엣지를 찾아 `toBeNull()` 을 단언한다. 이제 삼항의 **양쪽 분기**가
모두 고정된다.

## TEST 결과

- lint  : 통과 — 54s (`_test_logs/lint-20260731-181509.log`)
- unit  : 통과 — backend **412 suites**. `workflows.service.spec.ts` 단독 **80/80**
  (duplicate describe 16건). 80s (`_test_logs/unit-20260731-181604.log`)
- build : 통과 — 714s, docker 이미지 + 프로덕션 위생 스모크 포함
  (`_test_logs/build-20260731-181738.log`)
- e2e   : 통과 — backend Jest e2e **260/260**, 406s
  (`_test_logs/e2e-20260731-182935.log`)

> 리뷰 조치 2건은 (a) plan 문서 텍스트, (b) 스펙 단언 1개 추가로 **프로덕션 소스 무변경**이다.
> `workflows.service.ts` 는 mutation 왕복 후 `git diff` 무변화를 확인했다.

## 보류·후속 항목

리뷰 INFO 4건 비조치 — 근거는 plan §3:

- **#1** Swagger 포맷 일관성 — 컨벤션 확정은 파일 전체 적용이 필요해 이 PR 범위(보류 INFO 처분) 밖.
- **#4** mock override 보일러플레이트 4곳 — 헬퍼 추출은 기존 3곳까지 건드리는 테스트 리팩터.
- **#5** `duplicate` 컨트롤러 wiring 테스트 — 기존 갭이고 이번 diff 는 동작 무변경(Swagger 출력
  byte-identical 확인).
- **#6** 네이밍 통일의 형제 함수 확장 — **의도한 것**이며 plan §1.3 에 사전 선언. 리뷰어도
  "조치 불필요, 투명성 차원 기록" 판정.

원 대상이던 `#1033` 보류 INFO 10건은 이 PR 로 **전부 종결**됐다(4건 조치 + 6건 근거 종결).

민감 변경·spec 변경·SPEC-DRIFT 0건.
