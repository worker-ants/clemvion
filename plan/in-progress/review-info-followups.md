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

### 1.2 INFO #9 — 엣지 0건 조합 단언 (mutation 사각지대)

기존 "빈 캔버스는 노드·엣지 insert 를 호출하지 않는다" 는 **둘 다 0건**이라, `nodeRows.length > 0` /
`edgeRows.length > 0` 두 가드 중 **한쪽을 지워도 통과**한다. 노드만 있고 엣지가 0건인 조합이 별도로
필요하다(`importWorkflow` 에는 이미 대칭 단언이 있었다).

### 1.3 INFO #8 — 네이밍 드리프트

`importWorkflow()` 의 `nodeEntities`/`edgeEntities` 는 **바로 옆 주석과 어긋나 있었다** — 주석은
"plain literal — `manager.insert` 는 entity 인스턴스가 아닌 partial 을 받는다" 라고 적는데 이름은
`Entities` 다. `duplicate()` 가 쓰는 `nodeRows`/`edgeRows` 가 더 정확하므로 그쪽으로 통일했다.

### 1.4 INFO #12 — Swagger description 237자 단일 라인

배열 + `join(' ')` 로 분리해 가독성만 개선(출력 문자열 동일).

### mutation 으로 non-vacuous 증명

새 단언 2건이 실제로 무언가를 지키는지 소스를 변형해 확인했다.

| mutation | 결과 |
| --- | --- |
| `condition` 얕은 복사 제거 | **1 failed** / 20 passed — 새 단언만 RED |
| `edgeRows.length > 0` 가드 제거 | **3 failed** / 18 passed |

원복 후 21 passed, `git diff` 로 소스가 mutation 전과 동일함을 확인.

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

- `workflows.service.spec.ts` duplicate describe **21건** 통과 (기존 19 + 신규 2)
- mutation 2종 각각 RED 확인 → 원복 후 GREEN, 소스 diff 무변화

## 체크리스트

- [x] INFO 10건 전수 코드 확인 후 조치/종결 판정
- [x] #10 `edge.condition` 얕은 복사
- [x] #9 엣지 0건 조합 단언 + #10 참조 격리 단언 추가 (mutation 으로 non-vacuous 증명)
- [x] #8 네이밍 통일 · #12 Swagger 멀티라인
- [x] TEST WORKFLOW — lint PASS(53s) · unit PASS(backend 412 suites) · build PASS(294s) ·
      e2e PASS(260/260, 317s)
- [ ] `/ai-review` + Critical/Warning 조치
- [ ] push + PR

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
