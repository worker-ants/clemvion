# 정식 규약 준수 검토 — spec/data-flow/7-llm-usage.md

## 검토 방법
- target: `spec/data-flow/7-llm-usage.md` (HEAD 워킹트리 최신 상태, 전문 통독)
- 대조: `spec/conventions/spec-impl-evidence.md`, `spec/conventions/execution-context.md`, `spec/conventions/migrations.md`, `spec/data-flow/0-overview.md` §2·§3 (도메인 spec 공통 템플릿·인덱스), sibling 도메인 spec (`1-audit.md` 등) 제목·헤딩 패턴, `spec/5-system/4-execution-engine.md` (cross-reference 정합)
- 구현 diff(코드) 는 target 문서가 서술하는 내용의 사실관계 확인용 참고자료로만 사용 — 본 검토는 구현 정합성이 아니라 target **문서 자체**의 정식 규약 준수 여부에 집중

## 발견사항

없음. 검토 관점 5개(명명/출력포맷/문서구조/API문서/금지항목) 전반에서 CRITICAL·WARNING 수준 위반을 찾지 못했다. 확인한 세부 내역은 다음과 같다.

- **문서 구조 규약**: `spec/data-flow/0-overview.md §3 공통 규약`이 요구하는 도메인 spec 5요소(System role · Source→Sink 다이어그램 · Schema 매핑 표 · 상태 전이 · 외부 의존)를 target 이 `## Overview`(System role) → `## 1. Source → Sink`(§1.1~§1.3) → `## 2. Schema 매핑`(§2.1 Postgres/§2.2 외부) → `## 3. 상태 전이` → `## 4. 외부 의존` → `## Rationale` 순서로 정확히 갖췄다. CLAUDE.md 가 요구하는 Overview/본문/Rationale 3섹션 구성과도 일치.
- **파일·제목 명명**: 파일명 `7-llm-usage.md` 는 폴더 내 번호-슬러그 명명(1-audit, 2-auth, …)과 일관. 제목 `# Data Flow: LLM 호출 및 사용량 (LLM Usage)` 도 sibling 문서의 `# Data Flow: <한글> (<English>)` 패턴과 동일.
- **frontmatter 의무**: `spec-impl-evidence.md §1` 은 `spec/data-flow/**` 를 frontmatter(`id`/`status`/`code`) 의무 대상에서 **명시적으로 제외**한다("데이터 흐름 다이어그램·엔티티↔플로우 매핑 문서로, 구현 lifecycle 을 추적할 product surface 가 아니라 frontmatter 의무 대상이 아니다"). target 에 frontmatter 가 없는 것은 위반이 아니라 규약대로다.
- **영역 인덱스 등재**: `spec/data-flow/0-overview.md §2 도메인 인덱스` 표에 "LLM Usage | `llm-usage.md` (`./7-llm-usage.md`) | LLM Config 해석·LLM 호출·usage_log 적재" 행이 정확한 링크로 존재 — `spec-area-index.test.ts` 가 요구하는 sibling 상호 링크 요건 충족.
- **필드 명명**: 본문이 서술하는 `LlmCallContext`/`ExecutionContext` 관련 camelCase 필드(`workflowId`/`executionId`/`nodeExecutionId`)는 `spec/conventions/execution-context.md §1 원칙1`("식별: `workflowId`, `executionId`, `nodeExecutionId`")이 정의한 Stable core 식별 필드 명명과 정확히 일치. DB 컬럼 표기(`workflow_id`/`execution_id`/`node_execution_id`)는 §2.1 Schema 매핑 표에서 snake_case 로 일관되게 병기되어 코드-필드(camelCase) ↔ DB-컬럼(snake_case) 구분이 명확하다.
- **cross-doc 용어 정합**: `buildRetryReentryState`·"재구성 state"·"NodeExecution row PK" 등 target 이 쓰는 용어는 `spec/5-system/4-execution-engine.md §7.2`(엔진 필드 표, line 712)의 서술 및 상호 링크(`[data-flow/7-llm-usage §1.3]`)와 정확히 대응한다 — 같은 개념을 다른 이름으로 부르는 drift 없음.
- **node-cancellation 참조**: §1.2 "호출 신뢰성 계약"의 `signal` 항목이 `spec/conventions/node-cancellation.md` 를 SoT 로 정확히 위임하며, 해당 컨벤션의 "동작 계약은 별도 SoT 문서가 소유" 원칙과 합치한다(직접 계약을 재서술하지 않고 링크만 겁).
- **API 문서 규약(OpenAPI/Swagger/DTO)**: target 은 REST endpoint(`POST /api/model-configs/...` 등)를 서술하지만 이번 diff 범위(코드)는 DTO/decorator 변경이 없고, target 문서에도 신규 API surface 서술이 없어 `spec/conventions/swagger.md` 대상 위반 소지가 없다.
- **금지 항목**: `spec/conventions/` 전반이 금지하는 패턴(예: audit-actions 의 prefix 없는 액션명, migrations 의 alphanumeric V-suffix 등)은 target 문서의 도메인과 무관해 해당 사항 없음.

INFO 수준으로 참고할 만한 점(문서 위반은 아님): 이번 diff 의 코드 주석들이 본 spec 을 가리키는 표기가 `[Spec 7-llm-usage §1.3]` / `(data-flow/7-llm-usage §1.3)` / `spec/data-flow/7-llm-usage.md §1.3` 등으로 파일마다 조금씩 다르다. 다만 이는 **코드 주석**의 표기 스타일이지 target 문서 자체의 문제가 아니고, 프로젝트에 코드 주석 → spec 참조 표기를 강제하는 정식 컨벤션도 없어 판단 보류(제안: 향후 통일 표기가 필요하면 컨벤션 신설 검토, target 문서 수정 불필요).

## 요약
`spec/data-flow/7-llm-usage.md` 는 데이터 흐름 도메인 spec 공통 템플릿(Overview/System role → Source→Sink → Schema 매핑 → 상태 전이 → 외부 의존 → Rationale), 영역 인덱스 등재, frontmatter 면제 규칙(`spec-impl-evidence.md §1`), `ExecutionContext` 필드 명명 규약, 그리고 `5-system/4-execution-engine.md` 와의 cross-doc 용어 정합을 모두 정확히 준수한다. 이번 resume-턴 attribution 보강 관련 서술도 규약을 어기지 않고 기존 패턴 안에서 자연스럽게 갱신되어 있다. CRITICAL/WARNING 수준 발견사항 없음.

## 위험도
NONE
