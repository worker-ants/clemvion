# RESOLUTION — review/code/2026/07/31/18_37_11 (2차 / testing 타겟)

대상: 1차 라운드(`18_00_00`) 조치 커밋이 다시 stale 판정을 받아 `testing` 1명으로 좁혀 재실행한 라운드.
결과 **Critical 0 · Warning 0 · INFO 3**. INFO 2건이 **또 내 서술 오류**였고, 재현 확인 후 정정했다.

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|-----------|------|------|------|
| INFO #2 | 문서(수치 정확성) | 본 커밋 | "duplicate describe 22건 / 전체 81건" 이 틀렸다. 실측 **16건 / 80건** |
| INFO #1 | 문서·주석(근거 서술) | 본 커밋 | 새 테스트가 잡는 것을 "가드 제거" 로 적었으나, 그건 기존 테스트도 잡는다. 실제 가치는 **가드 분리** |
| INFO #3 | — | 비조치 | `duplicate` 컨트롤러 wiring 테스트 — 1차 라운드에서 이미 근거와 함께 종결한 기존 갭 |

---

### INFO #2 — 같은 표에서 수치를 두 번 틀렸다

1차 라운드에서 "3 failed → 2 failed" 를 정정하면서, **그 정정문에 새 오류를 넣었다**.

| 내가 적은 값 | 실측 |
| --- | --- |
| duplicate describe **22건** | **16건** |
| 스펙 전체 **81건** | **80건** |

**원인**: `npx jest ... -t "duplicate"` 결과(21 passed)를 describe 건수의 **프록시로 착각**했다. 그
필터는 이름에 `duplicate` 가 든 테스트를 전부 잡으므로, 다른 describe 의
`rejects payload with duplicate node labels` 류 5건까지 포함된다. describe 안의 `it()` 을 직접 세면
**16건**이다.

교훈은 1차와 같은 계열이다 — **프록시를 실측이라 부르지 말 것.** plan 에 두 정정을 함께 남겨
"필터 결과가 아니라 대상 자체를 세라" 를 명시했다.

### INFO #1 — 새 테스트의 가치를 잘못 서술했다

주석과 plan 에 "기존 '빈 캔버스' 테스트는 두 가드 중 **한쪽을 지워도 통과**한다" 고 적었으나
**틀렸다**. 실측하면 `edgeRows` 가드를 제거했을 때 실패하는 2건에 **기존 '빈 캔버스' 테스트가
포함**된다.

```
M2 (edgeRows 가드 제거)      → 2 failed: 빈 캔버스 · 엣지 0건
M4 (가드 변수 교체 edge→node) → 3 failed: 위 2건 + importWorkflow 1건
```

정확한 가치는 **가드 분리**다. 기존 케이스는 `nodeRows`·`edgeRows` 가 둘 다 0이라 **어느 가드가
깨졌는지 특정하지 못한다**. 새 테스트는 노드 5건 + 엣지 0건이라 `edgeRows` 가드만 단독으로 지키므로
실패 시 원인이 바로 좁혀진다. 테스트 자체는 유효하며 주석·plan 서술만 정정했다.

### 부수 사고 — 원복 실패를 한 번 더 반복했다

INFO #1 을 재현하는 과정에서 `cd <이미 들어와 있는 경로> && cp <백업>` 패턴을 **또** 써서 원복이
실행되지 않았고, 소스가 M4 mutation 상태로 남았다(3 failed). `git checkout` 으로 커밋 상태에서
복원해 80/80 GREEN 을 확인했다.

1차 RESOLUTION 에서 바로 이 패턴을 원인으로 지목해놓고 같은 실수를 반복했다. plan 의 mutation 절차
메모를 "단독 적용 후 **원복 확인**" 으로 강화했다.

## TEST 결과

- lint  : 통과 — 48s (`_test_logs/lint-20260731-185603.log`)
- unit  : 통과 — backend **412 suites**, `workflows.service.spec.ts` **80/80**. 63s
  (`_test_logs/unit-20260731-185654.log`)
- build : 통과 — 140s (`_test_logs/build-20260731-185810.log`)
- e2e   : 통과 — backend Jest e2e **260/260**, 288s (`_test_logs/e2e-20260731-190031.log`)

> 이번 조치는 **테스트 주석 1개 + 문서**로, 프로덕션 소스는 무변경이다.
> `workflows.service.ts` 는 `git checkout` 복원 후 커밋 상태와 동일함을 확인했다.

## 보류·후속 항목

- **INFO #3** `duplicate` 컨트롤러 wiring 테스트 — 1차 라운드에서 "이번 diff 는 Swagger description
  만 건드렸고 동작 무변경(출력 byte-identical)" 근거로 종결한 기존 갭. plan §3 유지.
- 1차 라운드의 미조치 4건(#1 Swagger 포맷 컨벤션 · #4 mock 헬퍼 · #5 wiring · #6 형제 함수 리네임)
  은 그대로 유효 — plan §3.

민감 변경·spec 변경·SPEC-DRIFT 0건.
