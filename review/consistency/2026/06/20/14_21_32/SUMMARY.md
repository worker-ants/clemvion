# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 등급 발견이 1건 있으나, 모두 본 작업(M-5 노드 DI 레이어1, behavior-preserving 리팩터)의 blast-radius 밖 pre-existing spec drift 이며 차단 사유가 아니다. (plan_coherence checker 재실행 완료 — 5/5 checker 확보, 추가 BLOCK 없음.) 후속: C1+W1 동적 포트 ID drift 는 별도 planner 위임.

> 검토 대상: `spec/4-nodes` (`--impl-prep`) — plan `refactor-m5-node-di-layer1.md` (정적 배열 `ALL_NODE_COMPONENTS` → NestJS multi-provider DI 전환, 레이어1).

## 전체 위험도
**MEDIUM** — 단일 cross-spec 단층선(동적 포트 ID: UUID v4 vs stable-slug)이 target 안팎 4문서+코드에 걸쳐 있으나, DI 리팩터의 핸들러 출력 컨트랙트와 무관(behavior-preserving 불위협). 다만 plan_coherence checker 결과 누락으로 plan 정합 차원은 미검증.

## Critical 위배 (비차단 — pre-existing drift)

| # | Checker | 위배 | target 위치 | 제안 |
|---|---------|------|-------------|------|
| C1 | Cross-Spec · Rationale Continuity · Convention Compliance (3중 합치) | 동적 포트 ID 모델이 **stable-slug ↔ UUID v4** 로 정면 모순. 구현 코드(`port-id.util.ts`=slug)·overview §1.3(명시적 "UUID v4 안 씀")·switch/text-classifier·`node-output.md` Principle 6 은 전부 slug+인덱스 fallback 으로 수렴하는데, 폐기된 UUID v4 모델이 2개 문서에 잔존 | `spec/4-nodes/1-logic/0-common.md §7`(line 140), 동기: `spec/3-workflow-editor/1-node-common.md §1.5` | §7 본문을 §1.3 과 동일 slug 서술(`^[a-zA-Z0-9_-]{1,64}$`, 위반 시 `<prefix>_<index>` fallback, SoT=`port-id.util.ts`)로 교체. `3-workflow-editor §1.5` 동기 갱신 필수. UUID→slug 번복을 `## Rationale` 명문화. ⚠ background `meta.backgroundRunId`(UUID)는 포트 ID 아님 — 제외 |

> **BLOCK=NO 판정 근거**: 본 작업은 DI 배선 교체(레이어1)만 수행하며 §7·동적 포트 핸들러를 건드리지 않는다. C1 은 리팩터가 도입한 drift 가 아니라 pre-existing stale 잔재다. 호출자(developer)는 차단 없이 진행하되, 이 drift 를 spec drift 로 명시 기록하고 planner 위임한다.

## 경고 (WARNING)

| # | Checker | 위배 | 제안 |
|---|---------|------|------|
| W1 | Cross-Spec | carousel 버튼 ID "UUID v4 자동 할당"(`6-presentation/1-carousel.md:429`)이 같은 파일 본문(user-set slug)·Principle 6 와 모순 (C1 과 동일 폐기 모델 잔재) | 429줄을 "버튼 추가 시 user-set slug id, ID 불변"으로 정정. C1 과 한 묶음으로 planner 처리 |
| W2 | Convention Compliance · Naming Collision | overview §1.0(line 55 `bootstrap(ALL_NODE_COMPONENTS,…)`)/§4(line 244 "정적 배열")의 등록 기술이 DI 전환 후 코드와 어긋남 (규약 직접 위반 아님 — `spec/conventions/` 에 DI 토폴로지 규약 없음) | **이미 plan 체크리스트가 planner 위임 추적 중.** 갱신 시 (1) §4 "마켓플레이스/동적 로딩=미구현(Planned)" invariant **유지**, (2) §1.0 호출 계약을 "lifecycle 진입점이 `@Inject(NODE_COMPONENT)` 주입 집합을 bootstrap 전달"로 정밀화 |
| W3 | Naming Collision | aggregator 모듈을 `NodesModule` 로 명명 시 기존 `modules/nodes/NodesModule`(Node 영속+Controller+Service)과 의미 충돌 (TS 충돌 아님, 가독성 혼선) | aggregator 를 `NodeComponentsModule`(파일 `nodes/node-components.module.ts`)로. per-category 모듈도 `LogicNodesModule` 등 일관 접미사 |

## 참고 (INFO)

| # | Checker | 항목 | 제안 |
|---|---------|------|------|
| I1 | Cross-Spec | 데이터 모델·API 계약(definitions/background-runs)·상태 전이(parallel)·RBAC·ExecutionContext 계층 책임 모두 외부 spec·코드와 정합(충돌 0) | 조치 불요 |
| I2 | Rationale | `12-background.md §5.1` `meta.backgroundRunId`(UUID v4)는 포트 ID 아닌 run 식별자 — UUID 정상 (C1 slug 전환 시 휩쓸지 말 것) | C1 범위를 동적 포트 ID 로 한정 |
| I3 | Convention · Naming | 신규 DI 토큰 `NODE_COMPONENT` 가 기존 `WORKFLOW_EXECUTOR` string-token 컨벤션(UPPER_SNAKE·interface co-locate·`multi`)을 정확히 답습. 동명 토큰 코드베이스 부재 | `NODE_COMPONENT` 를 `nodes/core/node-component.interface.ts`(또는 `.token.ts`)에 string-valued co-locate |
| I4 | Convention | 번들 logic 출력 포맷 문서가 `node-output.md` 5필드 invariant·컨테이너 오버라이트·에러 컨트랙트·config echo·port 활성화 모두 정합. DI 리팩터는 핸들러 출력 불변 | 조치 불요 |
| I5 | Convention | 문서 구조·API 문서·금지 항목 모두 준수 | 조치 불요 |
| I6 | Naming | per-category 모듈 파일명·`ALL_NODE_TYPES` 재사용·error code/endpoint/entity 전부 기존분(비충돌) | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | 동적 포트 ID UUID v4↔slug 모순(C1) + carousel(W1). 그 외 데이터모델/API/상태/RBAC 정합 |
| Rationale Continuity | HIGH | logic §7 이 폐기된 UUID v4 재주장, overview §1.3·코드 SoT 와 충돌(C1). 그 외 연속성 우수 |
| Convention Compliance | LOW | DI 리팩터 자체 규약 위반 0. CRITICAL(C1)·WARNING(W2)은 blast-radius 밖 |
| Plan Coherence | LOW (재실행 완료) | Critical 0. WARNING 2: (W-PC1) `refactor/README.md` M-5 행이 "결정 대기" stale → 갱신 필요, (W-PC2) 체크리스트 spec-sync 순서 의존 미표기. INFO: §4 "런타임 로딩 없음" invariant 는 레이어1 후에도 사실 — sync 시 유지. plan 자체 정합 양호 |
| Naming Collision | LOW | 실질 신규 식별자 `NODE_COMPONENT` 1개, 충돌 0. aggregator 명명만 주의(W3) |

## 권장 조치사항

1. **(비차단·후속 의무) C1+W1 spec drift 를 planner 위임** — 동적 포트 ID UUID v4 잔재 정정: (a) `spec/4-nodes/1-logic/0-common.md §7`, (b) `spec/3-workflow-editor/1-node-common.md §1.5`(동기 필수), (c) `6-presentation/1-carousel.md:429` — 한 묶음. UUID→slug 번복 Rationale 명문화. ⚠ background `meta.backgroundRunId`(UUID) 제외.
2. **(검토 신뢰성) plan_coherence checker 재실행** — 결과 누락. `_prompts/plan_coherence.md` 재사용해 단일 재호출 후 SUMMARY 갱신. (현 BLOCK=NO 는 확보된 4 checker 기준.)
3. **(구현 시) DI 등록 메커니즘 spec 갱신(W2) 동기화** — 레이어1 구현 후 `0-overview.md §1.0/§4` 를 "정적 배열 순회"→"DI 부팅 등록(multi-provider)"로. "런타임 플러그인/마켓플레이스 로딩 미구현" invariant 유지.
4. **(명명) aggregator 모듈 `NodeComponentsModule`(W3)** + `NODE_COMPONENT` 토큰 `nodes/core/` string-valued co-locate(I3).
