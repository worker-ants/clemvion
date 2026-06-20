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

## 설계 결정 (구현 반영)

flowise `NodesPool`(카테고리 디렉토리 → 단일 pool) 충실 + 경량: **카테고리 배열(디렉토리 격리) + 단일 aggregator 모듈**. NestJS multi-provider 는 본 setup 에서 주입 시 배열로 조립되지 않아(주입값이 단일 컴포넌트로 collapse) 채택하지 않고, **단일 `useValue` 배열 provider** 로 확정(WORKFLOW_EXECUTOR 의 단일 토큰과도 일관). layer-3 동적 등록은 어차피 `registry.registerDynamic`(런타임)이라 build-time multi 확장성 불요.

- **D-1 격리 = per-category 배열** (flowise 디렉토리 스타일). `nodes/<category>/index.ts` 가 `<CATEGORY>_COMPONENTS` 단일 출처. **노드 추가 = 그 배열 1줄**(중앙 `nodes/index.ts`·모듈은 카테고리 추가 시에만). Nest 모듈은 카테고리별로 쪼개지 않고 단일 `NodeComponentsModule` 이 카탈로그를 토큰 바인딩.
- **D-2 `ALL_NODE_TYPES` 정적 소비**: import-workflow DTO `@IsIn`·Swagger enum 은 모듈 로드 시점 평가라 DI 불가. → `nodes/index.ts` 가 카테고리 배열 spread 로 `ALL_NODE_COMPONENTS`(정적, 현행 순서 보존)·`ALL_NODE_TYPES` 파생. **DI 카탈로그(`NODE_COMPONENT` useValue)도 같은 `ALL_NODE_COMPONENTS` 를 주입** — 단일 출처라 drift 불가. `node-components.module.spec.ts` 가 "DI 주입 == 정적 spread" 를 테스트로 고정(런타임 가드 대신 — bootstrap 은 순수 DI·layer-3 ready 유지).
- **D-3 정렬키 명시**: 주입 순서 비의존. `NodeBootstrapService` 가 `(NODE_CATEGORIES.order, metadata.type)` 로 결정적 정렬 후 bootstrap → `listDefinitions`/팔레트 순서 결정적. (intra-category 표시 순서가 선언순→type순으로 바뀜 = 명시화; 핸들러 출력 계약·등록 집합 불변 = behavior-preserving. 스냅샷 단언 없음 확인.)

## 명명 (consistency-check 확정)

- aggregator 모듈 = **`NodeComponentsModule`** (파일 `nodes/node-components.module.ts`) — 기존 `modules/nodes/NodesModule`(API 표면)과 구분 (W3). **단일 모듈**(per-category Nest 모듈 없음).
- DI 토큰 = **`NODE_COMPONENT`** string-valued, `nodes/core/node-component.interface.ts` co-locate (`WORKFLOW_EXECUTOR` 선례 — I3). 단일 `useValue` 카탈로그 바인딩.

## 체크리스트

- [x] 사전 일관성 검토 `/consistency-check --impl-prep spec/4-nodes` → **BLOCK: NO** (C1 동적 포트 ID drift 는 pre-existing·비차단·범위 밖). 산출: `review/consistency/2026/06/20/14_21_32/SUMMARY.md`
- [x] plan_coherence W-PC1 — `refactor/README.md` M-5 행 stale 갱신 (방향 확정 반영)
- [x] 테스트 선작성 (`node-bootstrap.service.spec` DI·정렬 결정성, `node-components.module.spec` DI 배선+spread 동등)
- [x] 구현 (NODE_COMPONENT 토큰 + 7 카테고리 배열 + `NodeComponentsModule`(단일 useValue) + bootstrap DI 주입+정렬 + `nodes/index.ts` spread 파생)
- [x] DOCUMENTATION 매핑 갱신 — PROJECT.md 매트릭스 trigger **없음**(신규 노드/스키마/errorCode/label/가이드 무변, 등록 메커니즘 내부 리팩터)
- [ ] **spec §1.0/§4 등록 메커니즘 sync (planner 위임 — 구현 *후*)**: "정적 배열 순회"→"DI 부팅 등록(`@Inject(NODE_COMPONENT)` 집합 bootstrap)". §4 "런타임 플러그인/마켓플레이스 로딩 미구현(Planned)" invariant **유지**(레이어2·3 미완), Rationale 번복 아님. + `/consistency-check --spec` BLOCK:NO
- [ ] TEST WORKFLOW: lint(내 파일 check-mode 0 errors ✓ — `run-test.sh lint`(--fix)는 repo 전역 pre-existing format drift+8 err, M-5 무관) · unit(관련 56+ ✓; 3 FAIL 전부 pre-existing frontend/tooling) · build ✓(tsc 132s) · **e2e 대기**
- [ ] `/ai-review` + Critical/Warning 0
- [ ] `/consistency-check --impl-done spec/4-nodes` BLOCK:NO (spec-linked 코드 변경)

## 범위 밖 / 후속 (이 PR 에 넣지 않음)

- **C1+W1 동적 포트 ID drift (planner 위임)** — `1-logic/0-common.md §7`·`3-workflow-editor/1-node-common.md §1.5`·`6-presentation/1-carousel.md:429` 의 폐기된 "UUID v4" 잔재를 slug(`port-id.util.ts` SoT)로 정정 + Rationale 명문화. **본 DI 리팩터와 무관한 pre-existing drift** — 별도 planner 작업. ⚠ background `meta.backgroundRunId`(UUID)는 포트 ID 아니므로 제외. (consistency SUMMARY C1/W1)
- **레이어2(entitlement)·레이어3(Phase D `registerDynamic`)** — 별도 후속. marketplace Phase D seam 은 레이어1 의 `NodeComponentRegistry` 가 제공하되 `registerDynamic` 구현은 레이어3.
