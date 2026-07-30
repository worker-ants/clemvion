# Cross-Spec 일관성 검토 — spec/data-flow/ (impl-done, 워크플로우 복제 계약)

검토 모드: `--impl-done`, scope=`spec/data-flow/`, diff-base=`origin/main`. 대상 작업:
`plan/in-progress/workflow-duplicate-nodes-edges.md` (`WorkflowsService.duplicate()` 가 nodes/edges 를
복사하지 않던 결함 수정 + spec 계약 정정).

## 검토 방법

- `git diff origin/main..HEAD --stat -- spec/` 로 실제 변경 파일 확정: `spec/data-flow/11-workflow.md`
  (§1.5 duplicate 행 + §2.1 표 3행 + `## Rationale` 3개 절) · `spec/2-navigation/1-workflow-list.md`
  (§2.6 · §3 API 표). 프롬프트 번들에 실린 `spec/data-flow/` 나머지 8개 파일·`spec/0-overview.md`·
  `spec/1-data-model.md` 는 이번 커밋에서 미변경 — 대조 대상(context)으로만 사용.
- `codebase/backend/src/modules/workflows/workflows.service.ts`/`.controller.ts` 의 `duplicate()` 실제
  구현(HEAD 워킹트리, 절대경로)을 읽어 spec 서술과 대조 (impl-done 이므로 spec 이 코드에 없는 것을 약속하고
  있지 않은지가 아니라, 코드가 spec 서술과 일치하는지를 확인).
- `spec/1-data-model.md` §2.4(Workflow)/§2.6(Node)/§2.7(Edge)/§2.15(WorkflowVersion), `spec/2-navigation/
  _product-overview.md`(`NAV-WF-04`), `spec/3-workflow-editor/3-execution.md`(R-2.2 인용 원문),
  `spec/4-nodes/_product-overview.md`(`ND-MT-05`), `spec/4-nodes/7-trigger/1-manual-trigger.md` 대조.
- `db496a3c2`·`8ff4e8564` 커밋 실존·내용을 `git log`/`git show` 로 재확인 (Rationale 인용 사실관계).
- 이전 라운드 산출물 대조: `review/consistency/2026/07/30/16_45_59/cross_spec.md`(--spec) ·
  `review/consistency/2026/07/30/17_03_26/cross_spec.md`(--impl-prep) — 두 라운드가 이미 데이터모델·
  API계약·요구사항ID·상태전이·RBAC·계층책임 전 축을 저장소 원본 대조로 검증해 NONE 판정을 남겼다. 본
  라운드는 그 결론을 독립적으로 재검증하고, 두 라운드가 다루지 않은 각도(§2.15 `snapshot` 필드 구성)를
  추가로 열었다.

## 발견사항

- **[WARNING]** `workflow_version.snapshot` 필드 구성 — `spec/1-data-model.md` §2.15 와 `spec/data-flow/
  11-workflow.md` 가 서로 다른 내용을 기술
  - target 위치: `spec/data-flow/11-workflow.md:61` ("스냅샷에 `workflow.settings` 는 포함되지 않는다
    (캔버스 + name/description 만 버저닝)") 및 `spec/data-flow/11-workflow.md` §Rationale "버전 스냅샷 =
    JSONB"(232행 부근): "`workflow_version.snapshot` 은 name + description + nodes + edges 의 스냅샷을
    단일 JSONB 로 저장한다 (`workflow.settings` 는 포함하지 않는다)"
  - 충돌 대상: `spec/1-data-model.md:572` §2.15 WorkflowVersion — `| snapshot | JSONB | 워크플로우 전체
    스냅샷 (nodes, edges, settings) |`
  - 상세: 두 문서가 같은 컬럼(`workflow_version.snapshot`)의 구성 요소를 반대로 진술한다 — data-model.md
    는 `settings` 포함을 명시하고 `name`/`description` 은 언급하지 않는 반면, data-flow 문서는 `settings`
    **제외**·`name`+`description` **포함**을 명시한다. 실제 코드(`workflows.service.ts` `buildSnapshot()`,
    HEAD 워킹트리에서 확인)는 `{ name, description, nodes, edges }` 만 구성하고 `settings` 는 넣지
    않는다 — data-flow 문서 쪽이 코드와 일치하고, data-model.md §2.15 쪽이 stale 하다. 이 불일치는 이번
    PR 이 만든 것이 아니라 `origin/main` 시점부터 이미 존재했다(`git show origin/main:spec/data-flow/
    11-workflow.md` 로 확인 — §1.1 note·Rationale 모두 diff 밖). 이번 작업의 diff(§1.5 duplicate 계약
    정정)와는 무관하지만, target 으로 선언된 `spec/data-flow/` 스코프 안에서 `spec/1-data-model.md`(엔티티
    정의 SoT) 와 직접 모순되는 살아있는 서술이라 cross-spec 데이터 모델 충돌 기준에 해당해 보고한다.
  - 제안: `spec/1-data-model.md` §2.15 의 `snapshot` 설명을 `워크플로우 캔버스 스냅샷 (name, description,
    nodes, edges — workflow.settings 는 제외)` 정도로 정정. 이번 PR 의 스코프(§1.5 duplicate 계약)와는
    독립적이므로 이번 PR 을 막을 사유는 아니며, 별도의 가벼운 spec-only 후속 정정으로 처리 가능.

## 확인했으나 충돌 없음

이번 diff(§1.5 duplicate 계약 정정)의 핵심 표면은 두 이전 라운드(`--spec`, `--impl-prep`)가 이미 데이터
모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 전 축에서 저장소 원본과 대조해 NONE 으로 판정했다.
본 라운드에서 실제 구현(HEAD 워킹트리) 을 근거로 독립 재확인한 결과도 동일하다:

- **구현 = spec 서술 일치**: `WorkflowsService.duplicate()` 가 `dataSource.transaction('REPEATABLE READ', …)`
  안에서 workflow row 를 INSERT 하고, 원본 `node`/`edge` 를 조회해 새 UUID(`idMap`)로 재매핑한 뒤
  `manager.insert(Node/Edge, …)` 로 일괄 삽입한다 — spec 표(§1.5, §2.1 세 행)가 기술한 "메타+전체
  nodes/edges 한 트랜잭션 복제, 새 UUID 재발급·재매핑, `config`/`llmConfigId` 원본 값 유지(defaults·기본
  LLM 주입 없음), `current_version=1`·`created_by`=요청자 고정" 과 정확히 일치.
  `workflows.controller.ts` 의 `@ApiOperation` description 도 동일 내용으로 갱신되어 있어 코드-스웨거-spec
  3자 정합.
- **Node/Edge 참조 무결성**: 재매핑된 `container_id`/`tool_owner_id`/edge endpoint 는 bijective 치환이라
  `spec/1-data-model.md` §2.6/§2.7 의 제약(`chk_node_placement`, edge UNIQUE, self-loop 금지, 동일
  `workflow_id` 소속)을 그대로 보존한다.
  - **Manual Trigger "정확히 1개" 불변식**(`spec/4-nodes/_product-overview.md` `ND-MT-05`,
    `spec/4-nodes/7-trigger/1-manual-trigger.md:16`): duplicate 는 원본의 전체 노드를 그대로 복사하므로
    원본이 이미 만족하는 이 불변식이 재검증 없이도 사본에 자동 승계된다 — data-flow Rationale 의 "기각한
    대안(Manual Trigger 자동 생성)" 설명과 정확히 부합.
- **요구사항 ID**: `NAV-WF-04`(`spec/2-navigation/_product-overview.md:51`)는 저장소 전체에서 이 한 곳에만
  정의되고 target 은 인용만 한다 — ID 재정의·충돌 없음.
- **R-2.2 인용 범위**: `spec/3-workflow-editor/3-execution.md:753` ("workflows 의 duplicate 선례")를 새
  Rationale 이 "복제 후 자기 소유 **소유권 패턴**의 선례" 로 한정 인용 — 원문(§R-2.2)도 정확히 그 의미로만
  쓰여 있어 과잉 해석이 없다.
- **Rationale 인용 사실관계**: `db496a3c2`(spec↔code 전수 상호 감사, 2026-06-10) · `8ff4e8564`(초기 골격)
  두 커밋 모두 `git log`/`git show` 로 실존·설명 일치를 재확인 — 허구 이력 아님.
- **RBAC/계층 책임**: `@Roles('editor')` 그대로 유지, `WorkflowsService` 가 `NodesService`/`EdgesService`
  를 거치지 않고 직접 manager 로 node/edge 를 쓰는 것은 기존 `saveCanvas`/`importWorkflow` 와 동일한 기존
  계층 경계의 연장이며 새 위반이 아니다.
- **잔여 stale 서술 없음**: 저장소 전체에서 "메타 row만 복제"/구 문구 재검색 결과, 철회 대상으로 인용된
  `11-workflow.md` Rationale 내부를 제외하면 잔존처가 없다.

## 요약

이번 target(`spec/data-flow/11-workflow.md` §1.5/§2.1/Rationale + `spec/2-navigation/1-workflow-list.md`
§2.6/§3)이 다루는 워크플로우 duplicate 계약 정정은, 실제 구현(HEAD 워킹트리)·데이터 모델·요구사항 ID·상태
전이·RBAC·계층 책임 전 축에서 다른 spec 영역과 충돌하지 않는다 — 이전 두 라운드(`--spec`, `--impl-prep`)의
NONE 판정을 구현 완료 후 독립적으로 재확인했다. 다만 조사 과정에서 이번 diff 와 무관하게 이미 존재하던
별개의 데이터 모델 불일치를 하나 발견했다: `spec/1-data-model.md` §2.15 WorkflowVersion.snapshot 설명이
`settings` 포함을 명시하는 반면, `spec/data-flow/11-workflow.md`(및 실제 코드)는 `settings` 를 제외하고
`name`/`description` 을 포함한다고 명시한다 — 이는 이번 PR 을 막을 사유는 아니지만 별도로 정정이 필요한
WARNING 이다.

## 위험도
LOW
