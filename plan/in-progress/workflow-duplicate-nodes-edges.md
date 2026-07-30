---
title: 워크플로우 복제가 빈 워크플로우를 만든다 — duplicate 가 nodes/edges 를 복사하도록 계약 정정 + 구현
worktree: resumable-handler-generic-typing-3918dd
started: 2026-07-30
owner: planner → developer
status: in-progress
priority: P1
spec_impact:
  - spec/data-flow/11-workflow.md
  - spec/2-navigation/1-workflow-list.md
---

## Overview

워크플로우 목록의 더보기 메뉴 → **복제** 를 실행하면 **완전히 빈 워크플로우**가 만들어진다.
사용자 기대(원본 캔버스가 그대로 복사된 사본)와 실제 동작이 다르다.

### 원인 (실측)

`WorkflowsService.duplicate()` (`codebase/backend/src/modules/workflows/workflows.service.ts:216`)
가 `workflow` 메타 row 하나만 INSERT 하고 `node` / `edge` 테이블을 아예 건드리지 않는다.

```ts
async duplicate(id, workspaceId, userId): Promise<Workflow> {
  const original = await this.findById(id, workspaceId);
  const copy = this.workflowRepository.create({
    name: `${original.name} (Copy)`,
    description, isActive: false, tags, folderId, settings,
    workspaceId, createdBy: userId,
  });
  return this.workflowRepository.save(copy);   // ← node / edge 복사 없음
}
```

**신규 생성보다도 더 빈 상태다.** `create()` (같은 파일 `:177`) 는 Manual Trigger 시작 노드를
자동 INSERT 하는데 `duplicate()` 는 그 경로를 타지 않는다. 따라서 복제본은 트리거 노드 0개로
열리고, 2차 증상으로 — 사용자가 복제본에 노드를 새로 그려 저장해도 `saveCanvas` 의
"Manual Trigger 정확히 1개" 사전 검증(§1.1)에 걸려 400 이 난다.

### 왜 지금까지 남아 있었나

- **구현**: `git log -L 216,233:...workflows.service.ts` 결과 `8ff4e8564 feat(backend): phase 1·stage 3
  — NestJS 모듈/엔티티/마이그레이션 초기 골격` 이후 **한 번도 수정된 적이 없다**. 초기 스캐폴딩의
  미완성 구현이 그대로 잔존.
- **spec 이 결함을 문서로 굳혔다**: `spec/data-flow/11-workflow.md:137` 의
  "**nodes/edges 는 복제하지 않는다**" 는 `db496a3c2 docs(spec): spec↔code 전수 상호 감사 — 역방향
  커버리지 + drift 동기화` 에서 들어온 문장이다. 제품 결정이 아니라 감사 시점에 "현 코드가 이렇더라"를
  사후 기술한 drift 동기화다.
- **spec 내부 불일치**: 사용자 관점 SoT 인 `spec/2-navigation/1-workflow-list.md:104` 는 여전히
  `복제 | 워크플로우 복사본 생성 (이름에 "(Copy)" 추가)` — nodes 제외 언급이 없다. 두 spec 이 서로
  다른 계약을 말하고 있고, 사용자 기대는 후자 쪽이다.

### 왜 테스트가 못 잡았나

| 테스트 | 단언 내용 | 갭 |
| --- | --- | --- |
| `codebase/backend/test/workflow-crud.e2e-spec.ts:142` (C 케이스) | 새 ID · `(Copy)` 접미 · `isActive=false` · 원본 불변 | **노드·엣지 개수 단언 없음**. 게다가 원본을 `POST /workflows` 로 갓 만든 것(노드 1개)만 쓰고 캔버스를 저장하지 않아, 복제 대상 그래프 자체가 없다 |
| `codebase/backend/src/modules/workflows/workflows.service.spec.ts:381` | name 접미만 | 동일 |

---

## 1. Spec 변경안

### 1.1 `spec/data-flow/11-workflow.md` §1.5 표 — duplicate 행 정정

**AS-IS**

> | `POST /api/workflows/:id/duplicate` | workflow **메타 row 만** 복제 — name `"(Copy)"` 접미, `is_active=false`, description/tags/folder_id/settings 승계. **nodes/edges 는 복제하지 않는다.** |

**TO-BE**

> | `POST /api/workflows/:id/duplicate` | 메타 + **전체 nodes/edges** 를 한 트랜잭션으로 복제 — name `"(Copy)"` 접미, `is_active=false`, description/tags/folder_id/settings 승계. 노드는 새 UUID 로 재발급되고 노드 간 참조(`container_id`/`tool_owner_id`/엣지 endpoint)는 새 UUID 로 재매핑된다. **버전 이력(`workflow_version`)은 승계하지 않는다** — 사본은 `current_version=1` 로 새로 시작한다. AI 노드 `llmConfigId` 는 같은 워크스페이스 내 복사이므로 원본 값을 그대로 유지한다(import 와 달리 기본 LLM 주입 없음). |

### 1.2 `spec/2-navigation/1-workflow-list.md` §2.6 더보기 메뉴 — 복제 행 보강

**AS-IS**

> | 복제 | 워크플로우 복사본 생성 (이름에 "(Copy)" 추가) |

**TO-BE**

> | 복제 | 워크플로우 복사본 생성 — 노드·엣지를 포함한 캔버스 전체가 복사되고, 이름에 "(Copy)" 접미, 상태는 비활성으로 시작한다. 데이터 흐름은 [data-flow §1.5](../data-flow/11-workflow.md#15-복제--내보내기--가져오기) |

### 1.3 `spec/data-flow/11-workflow.md` §2.1 Postgres 표 — 복제 흐름 행 추가

`workflow` / `node` / `edge` 세 테이블 각각에 "복제 (§1.5)" 행을 추가한다 (consistency INFO #6 —
`node`/`edge` 만 넣으면 `workflow` 만 "생성" 행뿐이라 표기가 비대칭). INSERT 컬럼 집합은 각 테이블의
"생성"/"추가" 행과 동일하되, 고정값(`(Copy)` 접미·`is_active=false`·`current_version=1`·`created_by`
= 요청자)과 참조 재매핑을 비고에 명시.

### 1.4 Rationale 추가 (`spec/data-flow/11-workflow.md`)

본 문서 `## Rationale` **전체**를 spec 으로 이관한다 — 메타-only 서술의 철회 근거, export/import 를
재사용하지 않는 근거, 버전 이력·트리거·데이터셋 비승계 근거, 그리고 `기각한 대안` 2건(Manual Trigger
자동생성 / spec 하향 확정)까지. `3-execution.md:753` 인용은 "소유권 패턴 선례" 로 역할을 한정 표기해
주 근거(NAV-WF-04 + workflow-list §2.6)와 구분한다 (consistency INFO #3·#4).

---

## 2. 구현 계획 (developer)

- 대상: `codebase/backend/src/modules/workflows/workflows.service.ts` `duplicate()`
- `importWorkflow()` (`:279`) 가 이미 **노드 UUID 사전 생성 → 참조 재매핑 → 배치 insert 2회** 패턴을
  갖고 있다. 같은 트랜잭션 패턴을 쓰되, import 전용 관심사(label 중복 409 검증, reserved-name 게이트,
  기본 LLM 주입, config defaults 적용)는 **적용하지 않는다** — 원본은 이미 그 게이트들을 통과해 저장된
  데이터이므로 재검증은 불필요하고, 오히려 원본과 사본이 달라지는 원인이 된다.

### 체크리스트

- [x] `/consistency-check --spec` (planner) — **BLOCK: NO**, Critical/Warning 0건 · INFO 6건
      (`review/consistency/2026/07/30/16_45_59/SUMMARY.md`). INFO 6건은 전부 아래에 반영했다.
- [x] spec 3곳 반영 (§1.1 / §1.2 / §1.3) + Rationale (§1.4)
- [ ] `/consistency-check --impl-prep` (developer 착수 직전)
- [ ] `duplicate()` 를 트랜잭션 + nodes/edges 복사로 재구현 (참조 재매핑 포함)
- [ ] `@ApiOperation` description 갱신 — 부수효과(캔버스 전체 복제 + UUID 재매핑)를 명시
      (`spec/conventions/swagger.md §3`, consistency INFO #5)
- [ ] unit: 노드·엣지 개수 / `container_id`·`tool_owner_id` 재매핑 / 엣지 endpoint 재매핑 / 원본 불변 단언
- [ ] unit: **복제 범위 밖 단언** — `workflow_version`·`trigger`·`workflow_test_dataset` row 를 만들지
      않는다 (consistency INFO #1)
- [ ] e2e `workflow-crud.e2e-spec.ts` C 케이스 보강 — **원본에 캔버스를 저장한 뒤** 복제하고 노드·엣지
      개수와 참조 무결성을 단언 (현재는 빈 캔버스를 복제해 결함을 관측할 수 없다)
- [ ] TEST WORKFLOW (unit → integration → e2e)
- [ ] `/ai-review` + Critical/Warning fix

---

## Rationale

**결정 근거의 SoT 는 `spec/data-flow/11-workflow.md` 의 `## Rationale` 로 이관 완료** (§1.4 수행).
이관한 4개 절:

- **duplicate 는 캔버스 전체를 복제한다 (메타-only 서술의 철회)** — 뒤집는 문장이 합의 결정이 아니라
  `db496a3c2` 의 drift-sync 산출물이라는 실측, 그리고 `NAV-WF-04` + workflow-list §2.6 이라는 주 근거.
  `3-execution.md` 인용은 "소유권 패턴 선례" 로 역할을 한정 표기했다.
- **export/import 를 재사용하지 않는 이유** — import 전용 게이트(기본 LLM 주입 등)가 사본을 변조한다.
- **버전 이력·트리거·데이터셋을 승계하지 않는 이유** — `restoreVersion` 의미 붕괴 / 중복 발화 / 소유권 축.
- **기각한 대안** — 복제본에 Manual Trigger 자동 생성(불변식 위반), spec 하향 확정(정합성 악화).

여기(plan)에 근거를 중복 보관하지 않는다 — drift 표면이 생기므로 spec 을 읽는다.
