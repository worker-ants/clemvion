---
title: duplicate 리뷰의 보류 INFO 10건 처분 — 4건 조치, 6건 근거와 함께 종결
worktree: review-info-followups
started: 2026-07-31
owner: developer
status: in-progress
priority: P3
spec_impact: none
---

## Overview

`#1033`(워크플로우 복제 결함 수정) 리뷰가 "필수 아님" 으로 분류해 미처리로 남긴 INFO 10건
(`review/code/2026/07/30/17_54_27/RESOLUTION.md` §보류·후속 항목)을 전수 처분한다.

10건을 **그대로 다 하지 않는다** — 각각을 코드로 확인해 실제 가치가 있는 4건만 조치하고, 나머지 6건은
왜 하지 않는지 근거를 남겨 **종결**한다. 미처리 백로그를 계속 이월하면 다음 grooming 이 같은 조사를
반복한다.

## 1. 조치한 4건

### 1.1 INFO #10 — `edge.condition` 참조 격리 (유일한 동작성 항목)

`duplicate()` 가 `node.config` 는 `{ ...node.config }` 로 얕은 복사하면서 `edge.condition`(같은 JSONB)은
**그대로 넘기고 있었다**. 같은 파일 안에서 비대칭이다.

```ts
config: { ...node.config },        // 복사함
condition: edge.condition,          // ← 복사 안 함
```

조치: `condition: edge.condition ? { ...edge.condition } : edge.condition`. nullable 이라 값이 없으면
그대로 둔다.

### 1.2 INFO #9 — 엣지 0건 조합 단언

> **서술 정정 (2차 리뷰 INFO #1)**: 초안은 "기존 테스트는 두 가드 중 한쪽을 지워도 통과한다" 고
> 적었으나 **틀렸다**. 실측하면 기존 "빈 캔버스" 테스트가 `edgeRows` 가드 제거를 **잡는다**
> (M2 → 2 failed 에 그 테스트가 포함).

정확한 가치는 **가드를 분리해 고정**하는 데 있다. 기존 "빈 캔버스" 케이스는 `nodeRows`·`edgeRows` 가
둘 다 0이라 **어느 가드가 깨졌는지 특정하지 못한다**. 새 테스트는 노드 5건 + 엣지 0건이라
`edgeRows` 가드만 단독으로 지킨다 — 실패했을 때 원인이 바로 좁혀진다
(`importWorkflow` 에는 이미 이 대칭 단언이 있었다).

### 1.3 INFO #8 — 네이밍 드리프트

`importWorkflow()` 의 `nodeEntities`/`edgeEntities` 는 **바로 옆 주석과 어긋나 있었다** — 주석은
"plain literal — `manager.insert` 는 entity 인스턴스가 아닌 partial 을 받는다" 라고 적는데 이름은
`Entities` 다. `duplicate()` 가 쓰는 `nodeRows`/`edgeRows` 가 더 정확하므로 그쪽으로 통일했다.

### 1.4 INFO #12 — Swagger description 237자 단일 라인

배열 + `join(' ')` 로 분리해 가독성만 개선(출력 문자열 동일).

### mutation 으로 non-vacuous 증명

새 단언 3건이 실제로 무언가를 지키는지 소스를 변형해 확인했다.

스펙 전체 **80건**(`workflows.service.spec.ts`, 그중 `duplicate` describe **16건**) 기준.
각 mutation 은 **단독 적용 후 원복**하고, 다음 측정 전에 **원복이 실제로 됐는지 확인**한다.

| # | mutation | 결과 | 실패 테스트 |
| --- | --- | --- | --- |
| M1 | `condition` 얕은 복사 제거 | **1 failed** / 79 passed | condition 참조 격리 |
| M2 | `if (edgeRows.length > 0)` 가드 제거 | **2 failed** / 78 passed | 빈 캔버스 · 엣지 0건 |
| M3 | 삼항 false 분기를 `undefined` 로 | **1 failed** / 79 passed | condition 참조 격리(null 분기) |
| M4 | 가드 변수 교체 (`edgeRows` → `nodeRows`) | **3 failed** / 77 passed | 위 2건 + importWorkflow 1건 |

원복 후 전체 **80 passed**, `git diff` 로 소스가 mutation 전과 동일함을 확인.

> **수치 정정 2회 (리뷰 INFO #3 → 2차 INFO #2)**: 같은 표에서 수치를 **두 번** 틀렸다.
>
> 1. M2 를 "3 failed" 로 적음 → 실제 **2 failed**. 원인은 실행 오류 — 원복 명령이
>    `cd <이미 들어와 있는 경로> && cp <백업>` 이라 `cd` 실패로 `&&` 뒤가 실행되지 않았고, **M1 이
>    남은 채 M2 가 얹혀** 두 mutation 이 겹친 값을 기록했다.
> 2. 정정하면서 "duplicate describe 22건 / 전체 81건" 으로 적음 → 실제 **16건 / 80건**.
>    `jest -t "duplicate"` 결과(21건)를 describe 건수의 **프록시로 착각**했다. 그 필터는 다른
>    describe 의 `duplicate node labels` 류 테스트 5건까지 함께 잡는다.
>
> 3. 위 2번을 정정하면서 **틀린 문장을 지우지 않고 옆에 맞는 문장만 추가**했다. 그 결과 같은 절에
>    "22건 기준(전체 81건)" 과 "전체 80건 기준" 이 나란히 남아 자기모순 상태가 됐다 —
>    "정정 완료" 라고 보고한 수정 자체가 불완전했다.
>
> 세 번 다 리뷰어의 독립 재현이 잡았다. 교훈 셋: mutation 은 **단독 적용 후 원복 확인**이 전제이고,
> 테스트 개수는 **필터 결과가 아니라 대상 자체**를 세야 하며, 정정은 **틀린 서술을 제거**해야
> 완료다(옆에 맞는 값을 덧붙이는 것은 정정이 아니라 모순 추가다).

> **M3 는 리뷰 INFO #2 로 추가됐다**: 최초 테스트는 `condition` 이 있는 엣지만 단언해, 삼항의 null
> 분기를 `undefined` 로 바꾸는 mutation 이 **생존**했다(실측 확인: 21 passed). `condition: null` 인
> 엣지에 `toBeNull()` 단언을 더해 닫았다.

## 2. 조치하지 않은 6건 — 근거와 함께 종결

| INFO | 항목 | 종결 근거 |
| --- | --- | --- |
| #1 | `findById` TOCTOU | 확인과 트랜잭션 오픈 사이 좁은 창에서 동시 삭제 시 빈 사본 가능. **404 fast-path 를 포기하는 트레이드오프**이고 `update`/`remove` 등 기존 메서드도 동일 패턴이라 이 메서드만 바꾸면 오히려 비대칭. 발생확률 극히 낮고 인가 우회도 아니다 |
| #2 | 메타를 트랜잭션 밖에서 읽음 | #1 과 근본 원인 동일(같은 `findById`). 함께 판단해야 하는 항목이라 따로 고치지 않는다 |
| #3 | read-skew 회귀 테스트 부재 | `REPEATABLE READ` **인자 자체는** 이미 단언으로 고정돼 있다(`#1033` 2차 리뷰 조치, mutation 검증 완료). 실제 동시 커밋을 재현하는 통합 테스트는 비용이 크고, 그 클래스는 mock unit 으로는 원리적으로 못 잡는다 — 별도 판단 사안 |
| #6 | `node.config` 무검증 복사 | **의도된 동작**. 사본은 항상 동일 워크스페이스에만 생성되어 테넌트 경계를 넘지 않는다. 리뷰어도 "조치 불필요" 로 표기 |
| #11 | JSDoc `trigger` 문구 미러링 | `duplicate()` JSDoc 이 이미 "복제 범위 밖: 버전 이력, `trigger`, `workflow_test_dataset`, 실행 이력" 을 명시하고 있어 실질 갭이 없다 |
| #13 | 배치 insert chunk 미분할 | `importWorkflow()` 가 이미 채택한 패턴을 그대로 쓴 것이라 이번 diff 가 만든 리스크가 아니다. bind 파라미터 상한(Node ~5,900 / Edge ~9,300)은 사용자가 손으로 그리는 캔버스에서 도달하지 않는다. **대량 자동 생성 경로가 생기면** `duplicate`/`importWorkflow` 양쪽에 함께 검토 |

## 실측 검증

- `workflows.service.spec.ts` duplicate describe **16건**, 스펙 전체 **80/80** 통과
- mutation 4종 각각 단독 RED 확인 → 원복 후 GREEN(80/80), 소스 diff 무변화

## 체크리스트

- [x] INFO 10건 전수 코드 확인 후 조치/종결 판정
- [x] #10 `edge.condition` 얕은 복사
- [x] #9 엣지 0건 조합 단언 + #10 참조 격리 단언(값·참조·**null 분기**) 추가 — mutation 4종으로
      non-vacuous 증명
- [x] #8 네이밍 통일 · #12 Swagger 멀티라인
- [x] TEST WORKFLOW (리뷰 조치 후 재수행) — lint PASS(54s) · unit PASS(backend 412 suites,
      해당 스펙 80/80) · build PASS(714s) · e2e PASS(260/260, 406s)
- [x] `/ai-review` (maintainability·testing·scope) — **Critical 0 · Warning 0 · INFO 6**,
      위험도 LOW. 실질 2건 조치: INFO#3 mutation 수치 오기 정정, INFO#2 null 분기 단언 추가.
      나머지 4건은 비차단(§3). (`review/code/2026/07/31/18_00_00/SUMMARY.md`)
- [x] fresh `/ai-review` (testing 타겟) — **Critical 0 · Warning 0 · INFO 3**. INFO 2건이 또
      내 서술 오류라 재현 후 정정(수치 16/80, 새 테스트의 가치는 "가드 제거"가 아니라 "가드 분리").
      상세: `review/code/2026/07/31/18_37_11/RESOLUTION.md`
- [x] TEST WORKFLOW 재수행 — lint PASS(48s) · unit PASS(80/80) · build PASS(140s) ·
      e2e PASS(260/260, 288s)
- [x] 수렴 라운드 `/ai-review` (testing) — **Critical 0 · Warning 1**. plan 자기모순(틀린 문장이
      지워지지 않고 남음) 정정. 코드·테스트는 reviewer 독립 재검증 "문제 없음"(소스 재독 +
      jest 80/80). 상세: `review/code/2026/07/31/19_06_38/RESOLUTION.md`
- [x] push + PR — `#1040` 머지.

## 3. 리뷰 INFO 중 미조치 4건

| INFO | 항목 | 판단 |
| --- | --- | --- |
| #1 | Swagger 배열+`join` 포맷이 같은 파일 다른 description 과 스타일이 갈림 | 이 PR 은 가장 긴
  하나만 정리했다. 컨벤션으로 확정하려면 기준(N자)을 정하고 파일 전체에 일관 적용해야 하는데,
  그건 이 PR 의 범위(보류 INFO 처분)를 넘는다 |
| #4 | `mockTransactionManager.find` override 보일러플레이트 4곳 반복 | 이번 diff 가 1건 더한 것은
  맞으나, 헬퍼 추출은 기존 3곳까지 건드려야 해 테스트 리팩터가 된다. 별도 정리 대상 |
| #5 | `duplicate` 컨트롤러 wiring 테스트 부재 | 이번 diff 는 Swagger description 만 건드렸고
  동작 변경이 없다(출력 문자열 byte-identical 확인). 기존 갭이라 별도 판단 |
| #6 | 네이밍 통일이 형제 함수 `importWorkflow()` 까지 확장 | **의도한 것**이며 plan §1.3 에
  사전 선언했다. reviewer 도 "조치 불필요, 투명성 차원 기록" 으로 판정 |

## 4. impl-done 게이트가 드러낸 범위 밖 항목

`--impl-done` 이 `spec/data-flow/` 전수를 점검하며 **이번 PR 과 무관한 기존 결함**을 냈다.
Critical·조치 가능한 WARNING 은 이 PR 에서 닫았고(커밋 `9fa06cd4c` + 각주 보강), 나머지는 후속이다.

닫은 것:

- **Critical** — `12-workspace.md` §3.2 가 viewer 의 워크플로우 실행을 `✓ (수동 실행 only)` 로
  기재. SoT(`1-auth.md` §3.2 `Workflow 실행` 행 = `—`)·코드(`@Roles('editor')`,
  `ROLE_HIERARCHY` viewer 1 < editor 2) 셋 다 반대였다 → `✗`.
- **W1** — 같은 표의 "LLM Config / Integration" 병합 열이 editor 를 `view` 로 축소. 실제로는
  Model Config=CRUD, Integration(Org)=R 로 달라 열을 분리하고, 2차 라운드 지적을 받아
  "LLM Config = Model Config 동일 리소스" bridging 문장도 추가.
- **W3** — `spec-sync-auth-gaps.md` 가 §4.1 감사 로깅 갭을 추적하지 못하고 "Audit ... 모두 구현
  확인됨" 이라 적고 있었다(실측 `AuditLogsService` import 0건). 미구현 항목 추가 +
  `implemented` 승격 금지 조건 명시.
- **W4** — `workflow-duplicate-nodes-edges.md` §3 의 "보류 INFO 10건" 체크박스에 이 PR 로의
  상호참조 추가.

후속으로 남긴 것 (이번 PR 이 만든 것이 아니고, 고치면 scope 가 크게 번진다):

- [x] **`12-workspace.md` §3.2 위치** — `plan/in-progress/spec-data-flow-structural-followups.md`
      §1 로 분기 (planner 턴 필요).
      `0-overview.md §3.4` 템플릿(엔티티 status enum 전이 전용)에서 이탈. 15개 형제 문서 중
      유일하다. 별도 `## 권한(RBAC)` 섹션으로 승격하거나 공통 규약에 예외 조항 명문화 —
      **planner 턴 필요**.
- [x] **`3-execution.md` §3.3 SIGTERM 행 상호참조** — 같은 plan §2 로 분기.
      `spec-update-node-cancellation-shutdown-classification.md` 에서 미결인데 §3.3 이 이를
      언급하지 않아 완결된 것처럼 읽힌다. 결정을 선점하지 않는 "결정 대기 중" 각주 추가 —
      **planner 턴 필요**.
- [x] **"LLM Config" → "Model Config" 표기 통일** — 같은 plan §3 으로 분기.
      `0-overview.md:131` 등 product-facing 문서군이 아직 구 명칭. 이번엔 bridging 문장으로
      오독만 막았다.

## Rationale

`spec_impact: none` — 동작 계약 변경 없음. `edge.condition` 얕은 복사는 인메모리 참조 격리이고 DB 에
쓰이는 값은 동일하다.

**왜 10건을 다 하지 않았나**: 리뷰어가 "필수 아님" 으로 분류한 항목을 기계적으로 다 처리하면 scope 가
번지고, 정작 트레이드오프 판단이 필요한 항목(#1·#2)을 근거 없이 건드리게 된다. 코드로 확인해 실질
가치가 있는 4건만 조치하고 나머지는 **왜 안 하는지를 적어 종결**했다 — 이월된 백로그는 다음 사람이
같은 조사를 반복하게 만든다.

**왜 `#8`(네이밍)을 이번 PR 범위에 넣었나**: 단순 선호 차이가 아니라 **주석과 코드가 어긋난** 상태였다.
`importWorkflow` 는 이번 결함과 무관한 코드지만, `duplicate` 가 그 주석을 상호참조로 인용하고 있어
그대로 두면 새로 들어온 상호참조가 틀린 이름을 가리킨다.
