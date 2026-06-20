---
worktree: impl-m5-node-di
started: 2026-06-20
owner: developer
spec_area: spec/4-nodes/0-overview.md
parent: plan/in-progress/refactor/02-architecture.md (M-5 §방향 확정)
---

# M-5 레이어1 — 노드 등록 정적 배열 → DI multi-provider

> 범위: **레이어1 만** (모듈 격리 + 핫스팟 제거, behavior-preserving). 레이어2(per-workspace entitlement)·레이어3(Phase D 커스텀 노드)는 별도 후속.
> 설계 SoT: [02-architecture.md M-5 §방향 확정](./refactor/02-architecture.md). 추가 지정: 격리=flowise 스타일(모노레포 카테고리 디렉토리, 현행 유지), 샌드박스=n8n 스타일(레이어3).

## 결합점·블래스트 반경 (2026-06-20 전수 확인)

| 소비처 | 현재 | 처리 |
| --- | --- | --- |
| `execution-engine/node-bootstrap.service.ts:2,41` | `import { ALL_NODE_COMPONENTS }` → `bootstrap(arr, deps)` | `@Inject(NODE_COMPONENT) components[]` 주입으로 교체 (주 변경) |
| `workflows/dto/import-workflow.dto.ts:16,19` | `ALL_NODE_TYPES` 정적 const → `@IsIn(ALLOWED_NODE_TYPES)` | **정적 소비 — DI 불가.** 정적 type 목록 유지 전략 (아래 설계 D-2) |
| `nodes/nodes.integration.spec.ts` | `ALL_NODE_COMPONENTS` 순회 metadata 불변 테스트 | 등록 컴포넌트 집합 동등성으로 갱신 |
| `execution-engine/node-bootstrap.service.spec.ts` | `componentsArg).toBe(ALL_NODE_COMPONENTS)` 참조동일성 단언 | DI 주입 집합 단언으로 갱신 |
| `nodes/index.ts` | `ALL_NODE_COMPONENTS`·`ALL_NODE_TYPES` 정의 | 정적 배열 제거/축소 (D-1/D-2) |

## 설계 결정

- **D-1 모듈 단위 = per-category** (flowise 스타일). 카테고리별 Nest 모듈(`<category>` 디렉토리)이 자기 컴포넌트를 `{ provide: NODE_COMPONENT, useValue, multi: true }` 등록. 노드 추가 = 자기 카테고리 모듈 1줄(중앙 배열 편집 0 → 핫스팟 소멸). aggregator 모듈이 카테고리 모듈을 import, `NodeBootstrapService`(execution-engine)가 `@Inject(NODE_COMPONENT)` 주입.
- **D-2 `ALL_NODE_TYPES` 정적 소비**: import-workflow DTO 의 `@IsIn` 은 class 정의(모듈 로드) 시점 평가라 DI 불가. → 정적 type 목록은 컴포넌트 객체 모음에서 파생하되, **DI 등록 집합과 단일 출처**가 되도록: 컴포넌트 export 를 유지(객체 자체는 평범한 const)하고 type 목록만 정적 파생. registry 부팅 검증이 "DI 주입 집합 == 정적 목록" 동등성을 단언해 drift 차단. (대안: import 검증을 service 런타임으로 이동 — 범위 큼, 레이어1 밖.)
- **D-3 정렬키 명시**: multi-provider 주입 순서(=import 순서) 의존 제거. `bootstrap`/`listDefinitions` 가 `core/categories.ts` 의 category `order` + 노드 `type` 로 결정적 정렬. `ALL_NODE_TYPES`·정의 스냅샷도 정렬 파생.

## 명명 (consistency-check 확정)

- aggregator 모듈 = **`NodeComponentsModule`** (파일 `nodes/node-components.module.ts`) — 기존 `modules/nodes/NodesModule`(API 표면)과 구분 (W3).
- per-category 모듈 = **`<Category>NodesModule`** (예 `LogicNodesModule`, 파일 `nodes/<category>/<category>-nodes.module.ts`) (W3).
- DI 토큰 = **`NODE_COMPONENT`** string-valued, `nodes/core/node-component.interface.ts` co-locate (`WORKFLOW_EXECUTOR` 선례 — I3).

## 체크리스트

- [x] 사전 일관성 검토 `/consistency-check --impl-prep spec/4-nodes` → **BLOCK: NO** (C1 동적 포트 ID drift 는 pre-existing·비차단·범위 밖). 산출: `review/consistency/2026/06/20/14_21_32/SUMMARY.md`
- [x] plan_coherence W-PC1 — `refactor/README.md` M-5 행 stale 갱신 (방향 확정 반영)
- [ ] 테스트 선작성 (DI 등록 집합·정렬키 결정성·정적 spread==DI 집합 동등성)
- [ ] 구현 (NODE_COMPONENT 토큰 + per-category 배열/모듈 + `NodeComponentsModule` aggregator + bootstrap 주입 교체 + 정렬키 + ALL_NODE_TYPES spread 파생)
- [ ] DOCUMENTATION 매핑 갱신 (PROJECT.md white list)
- [ ] **spec §1.0/§4 등록 메커니즘 sync (planner 위임 — 구현 *후*)**: "정적 배열 순회"→"DI 부팅 등록(`@Inject(NODE_COMPONENT)` 집합 bootstrap)". §4 "런타임 플러그인/마켓플레이스 로딩 미구현(Planned)" invariant **유지**(레이어2·3 미완), Rationale 번복 아님. + `/consistency-check --spec` BLOCK:NO
- [ ] TEST WORKFLOW (lint·unit·build·e2e)
- [ ] `/ai-review` + Critical/Warning 0
- [ ] `/consistency-check --impl-done spec/4-nodes` BLOCK:NO (spec-linked 코드 변경)

## 범위 밖 / 후속 (이 PR 에 넣지 않음)

- **C1+W1 동적 포트 ID drift (planner 위임)** — `1-logic/0-common.md §7`·`3-workflow-editor/1-node-common.md §1.5`·`6-presentation/1-carousel.md:429` 의 폐기된 "UUID v4" 잔재를 slug(`port-id.util.ts` SoT)로 정정 + Rationale 명문화. **본 DI 리팩터와 무관한 pre-existing drift** — 별도 planner 작업. ⚠ background `meta.backgroundRunId`(UUID)는 포트 ID 아니므로 제외. (consistency SUMMARY C1/W1)
- **레이어2(entitlement)·레이어3(Phase D `registerDynamic`)** — 별도 후속. marketplace Phase D seam 은 레이어1 의 `NodeComponentRegistry` 가 제공하되 `registerDynamic` 구현은 레이어3.
