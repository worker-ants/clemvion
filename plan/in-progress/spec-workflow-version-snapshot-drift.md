---
title: WorkflowVersion.snapshot 필드 구성 서술이 두 spec 문서에서 상충 — data-model 쪽 정정
worktree: spec-snapshot-drift
started: 2026-07-31
owner: planner
status: in-progress
priority: P2
spec_impact:
  - spec/1-data-model.md
---

## Overview

`workflow_version.snapshot` 의 구성이 **`spec/1-data-model.md` 한 곳만** 다르게 서술돼 있다.

> **정정 (consistency INFO #1)**: 최초 초안은 이를 "두 spec 문서 상충" 으로 적었으나 과소 집계였다.
> 실제로는 **코드 · data-flow · version-history 세 곳이 합의**하고 data-model 한 곳만 outlier 다 —
> 결론은 오히려 더 강해진다.

| 위치 | 서술 | 코드와 일치? |
| --- | --- | --- |
| `spec/1-data-model.md:572` §2.15 | "워크플로우 전체 스냅샷 (nodes, edges, **settings**)" | ❌ **outlier** |
| `spec/data-flow/11-workflow.md:52,234` | "name + description + nodes + edges" (Rationale 에 "`workflow.settings` 는 포함하지 않는다" 명시) | ✅ |
| `spec/3-workflow-editor/5-version-history.md:112` §7.2 | `interface VersionSnapshot { name; description; nodes; edges }` — settings 없음 | ✅ |

### 코드 정본 (실측)

`WorkflowsService.buildSnapshot()` (`codebase/backend/src/modules/workflows/workflows.service.ts:622-653`)
가 반환하는 객체는 **`name` · `description` · `nodes` · `edges` 네 키뿐**이다. `settings` 는 없다.

```ts
private buildSnapshot(workflow, nodes, edges): Record<string, unknown> {
  return {
    name: workflow.name,
    description: workflow.description,
    nodes: nodes.map(...),
    edges: edges.map(...),
  };            // ← settings 없음
}
```

즉 **data-model 쪽이 stale** 이다. 데이터 모델 문서가 SoT 로 참조되는 위치라 방치하면
"버전 복원하면 settings 도 돌아온다" 는 오해를 낳는다 — 실제로는 캔버스와 name/description 만 복원된다.

### 발견 경위

`#1033`(워크플로우 복제 결함 수정)의 `/consistency-check --impl-done` 라운드에서 cross_spec checker 가
WARNING 으로 검출했고, 이어진 `/ai-review` documentation reviewer 가 독립적으로 같은 결론에 도달했다.
`origin/main` 시점부터 존재하던 drift 로 duplicate 와는 무관해 그 PR 범위 밖으로 분리했다
(`plan/complete/` 이동 전 `workflow-duplicate-nodes-edges.md` §3 참조).

## 1. Spec 변경안

### 1.1 `spec/1-data-model.md` §2.15 — `snapshot` 행 정정

**AS-IS**

> | snapshot | JSONB | 워크플로우 전체 스냅샷 (nodes, edges, settings) |

**TO-BE**

> | snapshot | JSONB | 워크플로우 캔버스 스냅샷 — `name`, `description`, `nodes`, `edges`. **`workflow.settings` 는 포함하지 않는다** (버저닝·복원 대상은 캔버스 + 이름/설명). 구성·근거의 SoT 는 [data-flow §1.1 / Rationale "버전 스냅샷 = JSONB"](./data-flow/11-workflow.md) |

## 2. 왜 data-flow 가 아니라 data-model 을 고치는가

넷 중 셋(코드·data-flow·version-history)이 일치하고 data-model 만 어긋난다. 게다가 data-flow 의
Rationale 은 "`workflow.settings` 는 포함하지 않는다 — 버저닝·복원 대상은 캔버스와 이름/설명이다" 로
**결정 근거까지 기록**하고 있다. 즉 settings 제외는 의도된 설계이지 누락이 아니다. 따라서 data-model 의
서술만 바로잡고, 상세 SoT 는 data-flow 를 가리키게 한다(중복 서술을 늘리지 않는다).

### drift 의 출처 (consistency rationale_continuity 실측)

`git log -S` 추적 결과: data-model §2.15 는 **2026-03-26 최초 초안 이후 한 번도 갱신되지 않았고**,
data-flow 는 2026-06-10 spec↔code 전수 감사 커밋에서 코드 관찰 근거로 정정됐으나 **그 커밋이 §2.15 를
누락**했다. 즉 결정 번복이 아니라 **후속 정정의 완결**이다.

## 체크리스트

- [x] `/consistency-check --spec` (planner 의무) — **BLOCK: NO**, Critical 0 · Warning 1 · INFO 4
      (`review/consistency/2026/07/31/14_04_52/SUMMARY.md`). 전부 반영: 3-소스 구도 정정(I1),
      SoT 링크 `#rationale` 앵커(I2), data-model `## Rationale` 스텁 추가(I3),
      JSONB 중괄호 표기 통일(I4), 원본 plan 체크박스 동기화 스텝 추가(W1 — 아래).
- [x] `spec/1-data-model.md` §2.15 반영 + `## Rationale` 스텁
- [ ] **원본 plan 동기화 (consistency WARNING #1)** — `plan/complete/workflow-duplicate-nodes-edges.md`
      §3 의 "`spec/1-data-model.md:572` §2.15 snapshot 서술 정정" 항목을 `[x]` 로 갱신. 갱신하지 않으면
      이미 끝난 항목이 계속 미해결 follow-up 으로 남아 다음 grooming 에서 중복 조사된다.
- [ ] push + PR

## Rationale

**왜 별도 PR 인가**: `#1033` 은 `WorkflowsService.duplicate()` 결함 수정이고 이 drift 는 그 코드와
무관하다(`buildSnapshot` 은 `saveCanvas`/`restoreVersion` 경로). 같은 PR 에 넣으면 리뷰 scope 가
흐려지므로 spec-only 경량 PR 로 분리했다.

**코드 변경 없음**: 코드가 이미 옳다. 문서만 코드에 맞춘다 — 반대 방향(코드에 settings 를 추가)은
data-flow Rationale 이 기록한 설계 결정을 뒤집는 것이라 대상이 아니다.
