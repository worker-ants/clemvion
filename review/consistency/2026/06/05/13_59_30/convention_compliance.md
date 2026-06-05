# 정식 규약 준수 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`

---

## 발견사항

### 문서: `spec/5-system/1-auth.md`

- **[INFO]** `1-auth.md` — 문서 구조: Overview 섹션 없음
  - target 위치: 파일 최상단 (`# Spec: 인증/인가 시스템` 바로 아래)
  - 위반 규약: `CLAUDE.md §정보 저장 위치` — "제품 정의·요구사항: `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`"
  - 상세: CLAUDE.md 는 spec 문서가 Overview / 본문 / Rationale 3섹션 구성을 따르도록 권장한다. `1-auth.md` 는 `## Rationale` 섹션은 존재하지만 `## Overview` 섹션이 없고 본문이 `## 1. 인증` 으로 바로 시작한다. 이 자체가 강제 규약 위반은 아니지만 (CLAUDE.md 는 "권장"으로 표현, 각 SKILL.md 에 위임), `10-graph-rag.md` 가 `## Overview (제품 정의)` 를 명시한 것과 일관성 차이가 있다.
  - 제안: `## 1. 인증` 앞에 짧은 `## Overview` 섹션을 추가하거나, 파일 상단 관련 문서 인용 블록이 overview 역할을 한다는 점을 인라인 주석으로 명시. 강제 변경은 불필요.

- **[INFO]** `1-auth.md §4.1` — AuditLog 액션 코드가 `lower_snake_case` 혼용
  - target 위치: `## 4. 감사 로그 §4.1 기록 대상 액션` 표
  - 위반 규약: `spec/conventions/error-codes.md §1` — "에러 코드 이름은 UPPER_SNAKE_CASE"
  - 상세: `error-codes.md` 의 `UPPER_SNAKE_CASE` 규약은 `error.code` 에 적용되는 명명 규약이다. 그러나 §4.1 의 `password_change`, `2fa_enable/disable`, `workspace.create`, `workflow.execute` 등 AuditLog action 코드들은 `lower_snake_case` 및 `.`-구분자 혼용이다. 이 코드들이 `output.error.code` 가 아닌 AuditLog 의 `action` 필드라면 `error-codes.md` 의 직접 적용 대상이 아니다. 그러나 프로젝트 전체 에러 코드가 `UPPER_SNAKE_CASE` 인 것과 달리, action 코드에 대한 별도 명명 규약이 `spec/conventions/` 에 없어 모호하다.
  - 제안: AuditLog action 코드가 `error.code` 와 다른 별개 도메인임을 `1-auth.md §4.1` 에 명시하거나, 프로젝트 관례(`workspace.create` 등 dot-notation)를 `spec/conventions/error-codes.md` 또는 별도 audit-log 규약 문서에 명시. 현재 구현에서 프론트엔드가 이 값으로 분기하지 않는다면 실질 위험 낮음.

- **[INFO]** `1-auth.md §2.2` — JWT Access Token Payload 필드명 `camelCase` 혼용
  - target 위치: `## 2. 세션 관리 §2.2 Access Token Payload`
  - 위반 규약: API 응답 필드명 규약 (`spec/conventions/node-output.md` 및 일반 JSON 컨벤션)
  - 상세: `workspaceId`, `role` 등 camelCase 필드가 JWT 페이로드에 사용된다. 이는 JWT 표준 claim 관행(camelCase)과 일치하므로 spec 자체의 문제는 아니다. 다만 spec 어디에도 JWT payload 필드명 규약을 명시하지 않는다. 구현 착수 시 백엔드가 `workspaceId` vs `workspace_id` 로 혼동하지 않도록 주의.
  - 제안: 명시가 이미 되어 있으므로 현상 유지. 구현 시 JSON 예시를 그대로 따른다.

---

### 문서: `spec/5-system/10-graph-rag.md`

- **[WARNING]** `10-graph-rag.md §Overview` — `## Overview` 와 `## 1. 개요` 중복 구조
  - target 위치: `### Overview (제품 정의)` 섹션과 `## 1. 개요` 섹션
  - 위반 규약: `CLAUDE.md §정보 저장 위치` — "제품 정의·요구사항: spec 진입 문서의 `## Overview`". CLAUDE.md 는 Overview / 본문 / Rationale 3섹션 구성을 권장.
  - 상세: 파일에 `### Overview (제품 정의)` 가 `###` (h3) 레벨로 존재하고, 이후 `## 1. 개요` 가 `##` (h2) 레벨로 별도 존재한다. 두 섹션이 유사한 내용을 반복 선언하고 있어 어느 쪽이 규약상 "Overview" 섹션인지 모호하다. `###` 레벨의 Overview 는 구조상 최상위 섹션이 아니라 더 상위에 있어야 할 내용이 하위로 묻혀 있다.
  - 제안: `### Overview (제품 정의)` 를 `## Overview` (h2) 로 승격하고, `## 1. 개요` 와 내용을 정리 통합하여 Overview / 본문 / Rationale 3섹션 구성을 명확히 한다.

- **[INFO]** `10-graph-rag.md §3.3 추출 LLM 응답 스키마` — JSON Schema 내 `displayName` camelCase 와 DB 컬럼 `display_name` snake_case 불일치 명시 부재
  - target 위치: `§3.3` JSON schema, `§2.3 Entity` 데이터 모델 표
  - 위반 규약: 직접적인 규약 위반 아님. 구현 착수 전 혼동 방지 관점.
  - 상세: JSON 스키마에서 LLM 응답 필드 `displayName` (camelCase), DB entity 컬럼은 `display_name` (snake_case). 이 매핑이 명시되지 않아 구현 시 혼동 가능.
  - 제안: `§3.3` 에 "LLM 응답 camelCase 필드를 snake_case DB 컬럼으로 매핑한다" 는 한 줄 노트 추가.

- **[INFO]** `10-graph-rag.md §6` — `document:graph_error` dead-declared 이벤트에 대한 처리 지침 부재
  - target 위치: `## 6. WebSocket 이벤트` 섹션 하단 주석
  - 위반 규약: `spec/conventions/node-output.md` Principle 0 ("5필드의 의미는 어떤 노드에서든 동일해야 합니다") — 간접적 유추.
  - 상세: `document:graph_error` 이벤트가 타입 union 에 선언됐으나 실제로 emit 되지 않는다는 주석이 있다. 이 dead-declared 이벤트를 삭제할지, 미래 용도를 위해 유지할지 spec 에서 결정되지 않았다.
  - 제안: `document:graph_error` 를 타입 union 에서 제거하거나, 향후 사용 예정임을 `spec: backlog` 형태로 명시. 구현 착수 시 dead code 를 코드베이스에 그대로 반영하지 않도록 정책 명확화.

---

### 문서: `spec/5-system/11-mcp-client.md`

- **[WARNING]** `11-mcp-client.md §11.1` 참조 — 본문에서 §11.1 을 참조하나 해당 섹션이 target 내에 없음
  - target 위치: `## 1. 개요` 중 "MCP 서버 헬스체크의 자체 cron (만료 스캐너 §11.1 의 token_expires_at 흐름은 사용 안 함)" 언급
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §4.2 지식저장소 무결성 가드` — `spec-link-integrity.test.ts` 가 in-repo 링크 타깃 존재를 검증.
  - 상세: `§11.1` 을 "만료 스캐너" 로 참조하는데 현재 `11-mcp-client.md` 에는 `## 11` 섹션이 존재하지 않는다. 가드(`spec-link-integrity.test.ts`)는 `#anchor` heading slug 를 검증하므로 fragment 링크로 작성되면 빌드 실패할 수 있다. 본문에서는 fragment 링크가 아닌 인라인 텍스트 언급("§11.1")이라 현재 빌드 차단은 아니지만, 섹션 번호가 존재하지 않는 곳을 가리키는 혼동이다.
  - 제안: "§11.1" 참조를 제거하거나, 참조 의도가 다른 문서(Integration spec 등)라면 올바른 링크로 교체. 구현 착수 전 혼동 방지.

- **[WARNING]** `11-mcp-client.md §6.2` — `mcpDiagnostics` 의 여러 필드가 "미구현 (Planned)" 이나 `pending_plans` 에 추적 plan 이 있는데 frontmatter 가 `status: partial` 이어야 함
  - target 위치: `frontmatter` `status: partial` 및 `pending_plans: [plan/in-progress/spec-sync-mcp-client-gaps.md]`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: partial` 은 `pending_plans` 의무이며 올바르게 설정됨. 이 점은 규약 준수.
  - 상세: frontmatter 의 `status: partial` + `pending_plans` 구성은 올바르다. 다만 §6.2 의 미구현 기술이 매우 광범위하다(외부 MCP 서버 진단 미노출, 대부분의 mcpDiagnostics 필드 미구현). 이 범위가 `pending_plans` 에 명기된 plan 파일에서 추적되고 있는지 별도 확인 권장.
  - 제안: 현재 상태는 규약 준수. `plan/in-progress/spec-sync-mcp-client-gaps.md` 가 §6.2 의 미구현 항목 전체를 커버하는지 구현 착수 전 검토.

- **[INFO]** `11-mcp-client.md §8.2` — `skipReason` vocabulary 가 `lower_snake_case` 이고 `error.code` 규약(`UPPER_SNAKE_CASE`) 과 구분하는 의도적 결정 — 명시됨
  - target 위치: `## 6.2 진단 누적 (mcpDiagnostics)` 내 "명명 규칙 분리" 주석
  - 위반 규약: `spec/conventions/error-codes.md §1` / `spec/conventions/node-output.md §3.2`
  - 상세: `skipReason` 값(`lower_snake_case`)이 에러 코드(`UPPER_SNAKE_CASE`)와 다른 규약을 쓴다는 것이 spec 본문에 명시적으로 설명되어 있다. 의도적 분리이므로 규약 위반이 아니라 규약 예외 적용 근거가 문서화된 정상 케이스다. 단, `error-codes.md §3 Historical-artifact 예외 레지스트리` 에는 등재되어 있지 않다.
  - 제안: `skipReason` 은 에러 코드가 아닌 운영 진단용 enum 이므로 `error-codes.md §3` 에 등재 의무는 없다. 현상 유지. 다만 구현 착수 시 실수로 `skipReason` 값을 `UPPER_SNAKE_CASE` 로 작성하지 않도록 코드 리뷰에서 주의.

---

### 전체 문서 공통 관찰

- **[INFO]** `spec/5-system/` 내 3개 문서 모두 — frontmatter `status` 및 `pending_plans` 필드 규약 준수 확인됨
  - `1-auth.md`: `status: partial`, `pending_plans` 2건 — `spec-impl-evidence.md §3` 준수.
  - `10-graph-rag.md`: `status: implemented`, `pending_plans` 없음 — `spec-impl-evidence.md §3` 준수.
  - `11-mcp-client.md`: `status: partial`, `pending_plans` 1건 — `spec-impl-evidence.md §3` 준수.

- **[INFO]** `spec/5-system/` 내 3개 문서 — `## Rationale` 섹션 존재 확인됨
  - 3개 문서 모두 `## Rationale` 섹션을 보유하고 근거를 기술한다. CLAUDE.md 의 "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`" 준수.

---

## 요약

검토 대상 3개 문서(`spec/5-system/1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)는 전반적으로 정식 규약을 잘 준수하고 있다. frontmatter 스키마(`id`/`status`/`code`/`pending_plans`)는 `spec-impl-evidence.md` 규약을 정확히 따른다. 에러 코드 중 `lower_snake_case` 예외(`invitation_*`)는 `error-codes.md §3` historical-artifact 레지스트리에 이미 등재되어 있다. 주요 구조적 이슈로는 `10-graph-rag.md` 의 `### Overview` (h3) 와 `## 1. 개요` (h2) 의 중복 구조(WARNING), `11-mcp-client.md` 에서 존재하지 않는 `§11.1` 참조(WARNING) 가 있다. 나머지 발견사항은 INFO 수준의 일관성 제안으로, 구현 착수를 차단할 critical 위반은 없다.

---

## 위험도

LOW
