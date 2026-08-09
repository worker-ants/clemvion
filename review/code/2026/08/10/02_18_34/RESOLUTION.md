# RESOLUTION — 2026-08-10 02:18:34

SUMMARY: Critical 0 · **WARNING 1** · risk LOW (reviewer 7/7, forced 전원).

## W1 — `non-vacuity` 라는 이름이 증명하는 것보다 넓었다 (testing)

**지적**: 캐너리 2건이 "파일이 존재한다" 만 증명하고 "링크/필드를 실제로 추출했다" 는
증명하지 않는다. `extractLinks` 가 조용히 항상 `[]` 를 반환해도 두 단언은 통과한다.

**이 PR 에서 같은 클래스의 여섯 번째다** — 내가 붙인 이름/서술이 내 코드보다 넓은 경우.
그리고 하필 **vacuous 테스트를 막으려고 만든 캐너리 자신이 vacuous** 했다.

**조치 — 이름을 낮추지 않고 단언을 올렸다**:

| 캐너리 | 종전 | 지금 |
|---|---|---|
| `the plan link scanner actually sees links` | `collectLivePlanMarkdown(root).length > 5` (**discovery**) | 살아있는 plan 들에서 **실제로 추출된 링크 수** > 50 (`extractLinks` 합산) |
| `finds completed plans to validate` | 같은 형태 | 이름에 **`(discovery only)`** 를 붙이고, 실제 탐지 증명은 `plan-scan.test.ts` 소관임을 명시 |

앞의 것은 이름이 약속한 일을 이제 실제로 한다. 뒤의 것은 discovery 만 증명하는 것이 맞아서
**이름을 사실에 맞췄다** — 둘 다 "이름과 증명 범위를 일치시킨다" 는 같은 처방의 양 방향이다.

**뮤테이션 확인**: `extractLinks` 가 항상 `[]` 를 반환하도록 바꾸면 **RED**. 종전 캐너리는
그 뮤턴트에서 통과했다 — 지적이 정확했음을 실측으로 확인했다.

## INFO — 미조치 (사유)

| # | 내용 | 판단 |
|---|---|---|
| 1·3 | 헤더 주석에 현재 규칙과 과거 postmortem 이 섞임 / 이력 주석 비중 | 내용은 4개 참조 문서와 line-level 일치 확인됨. 다음에 이 파일을 만질 때 정리 |
| 2 | non-vacuity 하한이 discovery 만 증명 | **W1 로 해소** |
| 4·6 | 매직넘버 `5` 3곳 / rationale 주석 근접 중복 | 선택 |
| 5 | 파일명이 두 번째 describe 의 관심사를 반영 못 함 | 검사가 더 늘면 분리 — 트리거 조건부 |
| 7·8·11 | 위임 변경 무영향 / 읽기 전용 / YAML 파싱 표면 | 확인성, 조치 불요 |
| 9 | `status: Complete` 대소문자 변형 fixture 미커버 | **엄격 비교가 의도**다(`TERMINAL_PLAN_STATUSES.has`). 완화(`toLowerCase()`)가 들어오는 것을 막으려면 fixture 가 유용하나, 지금 그 완화를 시도할 이유가 없어 표면만 늘린다. 필요해지면 그때 |
| 10 | Gate C `collectCompletePlans` 잔존 | `docs-guard-walker-dedup.md` 에 등재됨 |

## 검증

- 문서 가드 **19파일 / 2845 tests PASS**
- 뮤테이션 — `extractLinks` → `[]` 로 RED 확인
- **e2e 통과** (261s, tests=264) — 마지막 코드 commit(`6101a04b2`) 다음
- harness **995 tests OK**
