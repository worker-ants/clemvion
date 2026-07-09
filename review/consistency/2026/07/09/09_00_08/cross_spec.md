# Cross-Spec 일관성 검토 — `spec/3-workflow-editor/` (impl-done)

## 검토 개요

- diff-base: `origin/main` (56879279c) → HEAD (607bba715)
- 실제 코드/문서 diff: `codebase/frontend/src/components/editor/canvas/canvas-minimap.tsx`(+테스트), `codebase/frontend/src/content/docs/03-workflow-editor/canvas-basics.{mdx,en.mdx}` 4개 파일. **`spec/**` 는 이번 diff 에 포함되지 않음** (`git diff --stat origin/main..HEAD -- spec/` 결과 없음).
- 변경 내용: 미니맵 토글 버튼을 우하단 코너에 고정하고 미니맵을 그 위로 띄워 서로 겹치지 않게 하는 순수 CSS/레이아웃 수정(맵이 토글 버튼을 가리던 문제 수정). 데이터 모델·API 계약·요구사항 ID·상태 머신·RBAC·계층 책임 어느 것도 건드리지 않는다.
- 위 diff 가 `spec/` 를 건드리지 않으므로, "target 문서" 로 전달된 `spec/3-workflow-editor/{0-canvas,1-node-common,2-edge,3-execution}.md` 전체 내용을 스캔하고, 최근 변경분(§8 저장 모델, §11.4 컨테이너 중첩, §12 Tool Area 등 Rationale 상 2026-06~07 최신 결정)이 다른 spec 영역(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/data-flow/11-workflow.md`, `spec/conventions/cross-node-warning-rules.md`, `spec/4-nodes/3-ai/1-ai-agent.md`)과 정합한지 교차 검증했다.

## 발견사항

- **[INFO]** 미니맵 위치 변경은 spec 문서 상 검증 대상 텍스트가 없어 충돌 없음
  - target 위치: `codebase/frontend/src/components/editor/canvas/canvas-minimap.tsx` (diff), 대응 spec `spec/3-workflow-editor/0-canvas.md §7 미니맵`
  - 충돌 대상: 없음
  - 상세: §7 은 "캔버스 우하단에 작은 오버레이" · "토글 버튼으로 표시/숨김" 만 규정하고 토글 버튼과 미니맵의 상대 위치(위/아래)는 명시하지 않는다. `spec/3-workflow-editor/_product-overview.md` ED-CV-05("미니맵을 통한 전체 워크플로우 조감")도 동일하게 위치 비규정. 따라서 버튼을 미니맵 아래→코너 고정, 미니맵을 그 위로 띄우는 이번 변경은 spec 문서 어떤 조항과도 모순되지 않는다. 함께 갱신된 `canvas-basics.mdx`/`canvas-basics.en.mdx`(유저 가이드, "미니맵 위" → "미니맵 아래")도 코드 변경과 일치.
  - 제안: 없음 (spec 갱신 불필요).

- **[INFO]** `spec/1-data-model.md` Node.tool_owner_id 설명이 Tool Area 비활성 상태를 반영하지 않음 (기존 drift, 이번 diff 와 무관)
  - target 위치: `spec/3-workflow-editor/0-canvas.md §12`("⚠ 재작성 예정 (현재 제거됨)")
  - 충돌 대상: `spec/1-data-model.md §2.6 Node` (`tool_owner_id` 필드, `container_id`/`tool_owner_id` 동시 불가 CHECK 제약)
  - 상세: 캔버스 spec §12 와 `spec/4-nodes/3-ai/1-ai-agent.md §1/§4` 는 Tool Area UI·`toolNodeIds`/`toolOverrides` 필드가 현재 비활성(재작성 대기)임을 명확히 박스로 표기하는 반면, `spec/1-data-model.md` 의 `tool_owner_id` 컬럼 설명("AI Agent의 Tool Area에 등록된 경우")과 관련 CHECK 제약·인덱스 설명은 이 비활성 상태를 언급하지 않는다. 데이터베이스 컬럼 자체는 여전히 존재하므로 기술적으로 틀린 서술은 아니지만(레거시 데이터 호환을 위해 스키마는 남아 있음), 문서만 보는 독자는 Tool Area 가 현재도 정상 동작하는 기능이라 오해할 수 있다. 이번 diff 로 새로 발생한 문제는 아니며 사전에도 존재했던 문서 간 불일치다.
  - 제안: `spec/1-data-model.md` §2.6 `tool_owner_id` 행 또는 §12 참조 각주에 "Tool Area UI 는 현재 비활성 — [Spec 캔버스 §12](./3-workflow-editor/0-canvas.md#12-ai-agent-tool-area) 참조" 한 줄 추가 권장(별도 plan/PR 로 처리, 이번 작업 범위 아님).

## 요약

이번 PR 의 실제 diff 는 캔버스 미니맵/토글 버튼의 CSS 위치 조정과 그에 맞춘 유저 가이드 문구 수정뿐이며 `spec/**` 는 전혀 변경되지 않았다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 항목에도 영향이 없어 Cross-Spec 충돌 위험은 없다. `spec/3-workflow-editor/` 전체 내용을 다른 영역(overview, data-model, cross-node-warning-rules, 4-nodes/3-ai)과 교차 검증한 결과 최근 결정(§8 저장 모델 정정, §11.4 컨테이너 중첩 깊이제한 파기, §12 Tool Area 비활성)은 모두 관련 spec 파일에 일관되게 반영되어 있었다. 유일하게 발견한 사안은 `spec/1-data-model.md` 의 `tool_owner_id` 설명이 Tool Area 비활성 상태를 언급하지 않는 사전 존재 경미한 문서 drift로, INFO 등급이며 이번 작업의 결과물과는 무관하다.

## 위험도
NONE
