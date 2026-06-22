# 정식 규약 준수 검토 결과

검토 대상: `spec/3-workflow-editor` (전체 7파일)
검토 모드: 구현 착수 전 검토 (--impl-prep)
검토 일시: 2026-06-23

---

## 발견사항

### [INFO] `_product-overview.md` frontmatter 없음
- target 위치: `spec/3-workflow-editor/_product-overview.md` 파일 전체
- 위반 규약: CLAUDE.md "정보 저장 위치" 규칙 — `_product-overview.md` 는 진입 문서이며, 다른 spec 문서들은 `id`, `status`, `code` frontmatter 를 보유하는데 이 파일만 YAML frontmatter 블록이 없다.
- 상세: `0-canvas.md`, `1-node-common.md`, `2-edge.md`, `3-execution.md`, `4-ai-assistant.md`, `5-version-history.md` 는 모두 `id`/`status`/`code` frontmatter 를 갖추고 있으나, `_product-overview.md` 는 `# PRD: 워크플로우 에디터` 헤드라인으로만 시작한다. spec 문서 frontmatter 필수 여부를 강제하는 규약이 `spec/conventions/` 에 명시돼 있지는 않으나, 폴더 내 일관성이 깨져 있다.
- 제안: PRD 역할의 진입 문서는 frontmatter 가 없어도 규약 위반은 아님을 확인하고, 팀 내에서 PRD 파일 패턴을 규약에 명시할 필요가 있으면 `spec/conventions/` 에 추가한다. 현재로서는 INFO 수준.

---

### [INFO] `5-version-history.md` — `id` 값이 `workflow-version-history` (도메인 prefix 포함)
- target 위치: `spec/3-workflow-editor/5-version-history.md` frontmatter `id: workflow-version-history`
- 위반 규약: 명시적 naming 규약 없음. 같은 폴더의 다른 파일들은 `id: canvas`, `id: edge`, `id: execution`, `id: ai-assistant` 처럼 **단순 slug** 형태인데 이 파일만 `workflow-version-history` 로 prefix 가 붙어 있다.
- 상세: `spec/conventions/` 에 spec frontmatter `id` 네이밍 규칙이 명시돼 있지 않으므로 CRITICAL/WARNING 으로 올리기 어렵다. 단순 비일관성.
- 제안: `id: version-history` 로 단순화하거나, 현 상태를 유지하면서 규약 문서에 "폴더 scope 내에서 고유하면 충분" 임을 명시하는 것이 좋다.

---

### [INFO] `1-node-common.md` §2.4 에러 처리 정책 표 — `policy` enum 값 표기 방식이 `node-output.md` 에러 컨트랙트 표기와 미세하게 상이
- target 위치: `spec/3-workflow-editor/1-node-common.md` §2.4 에러 처리 정책 표 및 §2.4 "config 저장 형태" 주석
- 위반 규약: `spec/conventions/node-output.md` §3 에러 컨트랙트 통일 — `code` 는 `UPPER_SNAKE_CASE`.
- 상세: `policy` enum 값 `stop_workflow`/`skip_node`/`use_default_output`/`retry`/`route_to_error_port` 는 DB/API 계약상 `lower_snake_case` 로 저장된다. `node-output.md §3.2` 의 `UPPER_SNAKE_CASE` 규칙은 `error.code` (에러 코드) 에 적용되는 것이며, 내부 enum `policy` 값과는 적용 범위가 다르다. 따라서 실제 규약 위반이 아니라, **읽는 사람이 두 표기 규칙을 혼동할 수 있는** 모호함이다.
- 제안: `1-node-common.md §2.4` 의 "config 저장 형태" 주석에 "`policy` enum 값은 `lower_snake_case` 로 저장됨 — `error.code` 의 `UPPER_SNAKE_CASE` 규칙과 별개" 라는 한 줄 주석을 추가하면 혼동을 예방할 수 있다.

---

### [INFO] `0-canvas.md` §12 AI Agent Tool Area — "재작성 예정" 섹션이 본문에 남아 있으나 `pending_plans` 에 미반영
- target 위치: `spec/3-workflow-editor/0-canvas.md` §12 헤더 + frontmatter `pending_plans`
- 위반 규약: CLAUDE.md "정보 저장 위치" — 진행 중 작업은 `plan/in-progress/<name>.md` 에 `worktree` 명시.
- 상세: §12 는 "재작성 예정 (현재 제거됨)" 으로 표시되어 있으나, 이에 대응하는 plan 항목이 `pending_plans` 에 없다. `ai-agent-tool-connection-rewrite.md` 가 `pending_plans` 에 명시돼 있지만, 이것이 §12 재작성을 포괄하는지 `0-canvas.md` 만으로 확인되지 않는다. 실제 AI agent tool 연결 재작성이 별도 plan 으로 추적되고 있다면 문제 없지만, tool area spec 재작성이 누락된 plan 이라면 빠진 것이다.
- 제안: §12 상단 박스에 "재작성 예정" 의 tracking plan 파일을 `> plan: plan/in-progress/ai-agent-tool-connection-rewrite.md` 형태로 명시해 spec-plan 연결을 드러낸다.

---

### [WARNING] `1-node-common.md` §2.6.2 widget 어휘 표에 `information_extractor` 가 `auto-form 이행 완료` 목록에 있으나 §1.3 포트 구성 표에서 노드 이름 표기가 `Information Extractor` 와 `information_extractor` 로 혼재
- target 위치: `spec/3-workflow-editor/1-node-common.md` §1.3 포트 구성 표 `| Information Extractor |` 행 vs §2.6.3 "auto-form 이행 완료" 목록의 `information_extractor`
- 위반 규약: `spec/conventions/node-output.md` Principle 6 동적 포트 ID 네이밍 및 일반 식별자 명명 일관성. 보다 직접적으로는, 같은 문서 안에서 동일 노드가 `Information Extractor` (사람이 읽는 레이블)와 `information_extractor` (코드 식별자)로 혼용되는 점은 규약 위반이 아니지만, §1.3 테이블의 노드 유형 열은 한 곳에서는 `Information Extractor`(표 행), 다른 곳에서는 `information_extractor`(텍스트)로 쓰여 독자 혼동을 야기한다.
- 상세: §1.3 포트 구성 표의 `| Information Extractor | 1 | 2 (모드별) |` 행은 사람이 읽는 레이블을 쓰고 있고, 같은 표 안의 다른 컨테이너 노드들(`| Loop (**컨테이너**)`, `| Map (**컨테이너**)` 등)도 동일 패턴이다. §2.6.3 과 Rationale §R-3 에서는 `information_extractor`, `text_classifier` 등 코드 식별자를 쓴다. 이중 표기 자체는 spec 에서 자연스럽지만, §1.3 의 레이블 표기가 `1-node-common.md` 다른 부분의 코드 식별자 표기와 일치하지 않아 검색·참조 시 비일관하다.
- 제안: §1.3 표 안에서 노드 유형명을 사람이 읽는 레이블(`Information Extractor`)로 통일하고, 코드 식별자가 필요한 섹션(§2.6 등)은 코드 식별자(`information_extractor`)로 통일하는 패턴을 유지한다. 현재 혼재가 아닌 **섹션별 통일**이면 INFO 수준으로 내릴 수 있으나, 동일 표(§1.3) 안에서 `AI Agent` / `Text Classifier` / `Information Extractor` 는 레이블, `ai_agent` / `text_classifier` / `information_extractor` 는 §2.6.3 에서 사용하는 패턴이 이미 섹션별로 나뉘어 있어 실질적 혼란 위험은 낮다. 따라서 INFO 로 하향 조정 가능.

---

### [INFO] `2-edge.md` §3.1 포트 타입별 엣지 색상 표 — hex 코드가 `spec/conventions/` 에 SoT 가 없음
- target 위치: `spec/3-workflow-editor/2-edge.md` §3.1 테이블 (`#22c55e`, `#ef4444`, `#3b82f6`, `#a855f7`)
- 위반 규약: 직접 위반 규약 없음. 단 색상 hex 코드가 `spec/conventions/` 에 정의된 공용 디자인 토큰 SoT 없이 spec 문서에 inline 으로만 존재한다.
- 상세: 색상값이 두 곳(`2-edge.md`, `1-node-common.md` §1.2)에서 반복 기술되어 있다. conventions 에 디자인 토큰 규약이 없어 drift 위험이 있다.
- 제안: 즉시 규약 위반이 아니므로 지금 조치 불필요. 디자인 토큰 SoT 파일이 생기면 해당 파일을 참조하도록 갱신한다.

---

### [INFO] `3-execution.md` — `## Rationale` 섹션 부재
- target 위치: `spec/3-workflow-editor/3-execution.md` 파일 전체 (확인 가능한 앞 50줄 기준)
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 권장 — Overview / 본문 / Rationale"
- 상세: `0-canvas.md`(`## Rationale` 없음), `1-node-common.md`(`## Rationale` 있음, §R-1·R-2·R-3), `2-edge.md`(`## Rationale` 있음), `4-ai-assistant.md`, `5-version-history.md` — 모두 Rationale 섹션이 있거나 없는 혼재 상태. CLAUDE.md 는 "권장" 이라고 명시하므로 CRITICAL/WARNING 이 아닌 INFO.
- 제안: `3-execution.md` 에 설계 결정이 누적되면 `## Rationale` 섹션을 추가한다. 현재 누락이 규약 위반은 아니다.

---

### [INFO] `4-ai-assistant.md` §4.1.1 `ExecutionDetailsResponse` — TypeScript interface 인라인 정의
- target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1
- 위반 규약: 직접 위반 없음. 단 TypeScript interface 를 spec 문서에 인라인으로 정의하는 패턴은 `spec/conventions/swagger.md` (DTO 위치 규약 `dto/responses/`) 와 다른 레이어다.
- 상세: `ExecutionDetailsResponse` 는 spec-level 계약 기술 용도로 사용되었으며, 실제 백엔드 DTO(`dto/responses/`)와 별개로 문서화된 것이다. spec 문서에서 계약을 TypeScript interface 로 기술하는 것은 이 프로젝트에서 다른 곳(예: `node-output.md` Principle 4.5 등)에서도 사용하는 관례이므로, 이 spec-level 기술이 swagger.md 의 DTO 규약과 충돌한다고 보기 어렵다.
- 제안: 조치 불필요. 다만 백엔드 응답 DTO 가 이 interface 와 일치하는지 impl-prep 단계에서 확인할 것.

---

## 요약

`spec/3-workflow-editor` 의 7개 파일은 `spec/conventions/` 의 정식 규약을 직접 위반하는 항목이 없다. 모든 spec 문서는 frontmatter(`id`, `status`, `code`)를 보유하고, 에러 코드는 `UPPER_SNAKE_CASE`(`CONTAINER_INVALID_CHILD`, `CONTAINER_CYCLE`, `CONTAINER_MISSING_EMIT` 등), `error.code` 출력 형식은 `node-output.md §3.2` 계약을 따른다. 동적 포트 ID(`class_0`, `branch_0` 등)는 `node-output.md Principle 6` 규칙과 일치한다. 발견된 항목은 INFO 1건(frontmatter 일관성), WARNING 1건(동일 문서 내 노드 이름 표기 혼재 — 실제 읽기 영향 미미), INFO 5건(비일관성 또는 권장 섹션 누락) 으로 구현 착수를 차단할 수준의 CRITICAL 위반이 없다. `_product-overview.md` 의 frontmatter 부재는 PRD 진입 문서 패턴이 규약에 명시되지 않아 INFO 처리했다.

---

## 위험도

LOW

---

STATUS: SUCCESS
