# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/` (impl-done, diff-base=origin/main)
검토 일시: 2026-06-28
검토자: convention-compliance sub-agent

---

## 발견사항

### 1. 문서 구조 규약

- **[INFO]** `spec/5-system/10-graph-rag.md` — Overview 섹션 이중 선언
  - target 위치: `spec/5-system/10-graph-rag.md` 의 `## Overview (제품 정의)` 와 이후 `## 1. 개요` 섹션
  - 위반 규약: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
  - 상세: 문서 상단에 `## Overview (제품 정의)` 섹션이 존재하고, 후반부에 또 다른 `## 1. 개요` 섹션이 등장해 Overview 가 사실상 두 곳에 분산된다. 3섹션 구조(Overview / 본문 / Rationale)에서 Overview 는 단일 섹션이어야 한다.
  - 제안: `## 1. 개요` 를 `## Overview` 내에 포섭하거나, `## Overview (제품 정의)` 블록을 `## 1. 개요` 로 통합해 단일화한다. 단, 이 패턴은 이미 PR #747 이후 안정화된 구조라면 규약 자체에 "구현 상태 박스를 포함하는 확장 Overview 허용" 명시를 고려한다.

- **[INFO]** `spec/5-system/_product-overview.md` — `## Overview` 섹션 부재
  - target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/spec/5-system/_product-overview.md` 전체
  - 위반 규약: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
  - 상세: `_product-overview.md` 는 PRD 비기능 요구사항 전문(섹션 1~6)으로 구성되나 문서 수준의 `## Overview` 섹션이 없다. `0-` prefix 루트 문서(`spec/0-overview.md`)에서 cross-cutting 개요를 제공하는 구조이므로 critical 은 아니나, PRD 파일 자체의 맥락 설명이 짧은 intro 없이 즉시 표 로 시작한다.
  - 제안: 최상단에 1~2줄짜리 `## Overview` 섹션을 추가해 "본 문서는 시스템 전역 비기능 요구사항을 정의한다"와 같은 맥락을 제공한다. 단순 관행 개선이라 강제 사항은 아니다.

---

### 2. 에러 코드 명명 규약

- **[INFO]** `spec/5-system/1-auth.md §1.5.4` — historical-artifact 예외 코드의 `error-codes.md §3` 등재 확인 완료
  - target 위치: `spec/5-system/1-auth.md §1.5.4` 에러 응답 표
  - 위반 규약: `spec/conventions/error-codes.md §1` (`UPPER_SNAKE_CASE` 요구)
  - 상세: `invitation_not_found`·`invitation_expired`·`invitation_already_used`·`invitation_email_mismatch`·`forbidden`·`rate_limited` 는 `lower_snake_case` 로 규약의 UPPER_SNAKE_CASE 와 다르다. 그러나 §1.5.4 본문에 "historical-artifact 예외" 명시와 함께 `error-codes.md §3` 에 정식 등재됐음을 교차 확인했다. 규약 위반이 문서화된 예외이므로 위반으로 보고하지 않는다.
  - 제안: 현 상태 유지. 추가 조치 불필요.

- **[INFO]** `spec/5-system/1-auth.md §4.1` Planned 섹션 — `auth_config.*` 현재형 verb 사용
  - target 위치: `spec/5-system/1-auth.md §4.1` "설정" 카테고리 구현된 액션 표
  - 위반 규약: `spec/conventions/audit-actions.md §2.2`
  - 상세: 구현된 `auth_config` 액션(`auth_config.create`, `auth_config.update`, `auth_config.delete`, `auth_config.regenerate`, `auth_config.reveal`)은 현재형이다. `audit-actions.md §2.2` 의 "resource 단위 현재형 예외" 에 의해 `auth_config` resource 는 현재형으로 통일하도록 규약에 명시되어 있으며, `§3` 레지스트리에도 동일하게 등재됐다. 규약 준수 확인. 위반 없음.
  - 제안: 현 상태 유지. 추가 조치 불필요.

---

### 3. API 응답 포맷 규약

- **[INFO]** `spec/5-system/1-auth.md §1.4.3` — `GET /auth/2fa/webauthn/availability` 응답 표기의 논리 payload 선언
  - target 위치: `spec/5-system/1-auth.md §1.4.3` WebAuthn 환경변수 섹션
  - 위반 규약: `spec/conventions/swagger.md §2-5` (TransformInterceptor `{ data: ... }` 래핑)
  - 상세: 문서는 `{ enabled: boolean }` 으로 논리 payload 를 표기하며, "전역 `TransformInterceptor` 가 wire 에서 `{ "data": { "enabled": … } }` 로 래핑하므로 클라이언트는 `res.data.enabled` 로 읽는다" 라는 주석을 명시적으로 달고 있다. swagger.md §2-5 와 2-api-convention.md §5 가 규정한 `{ data: ... }` 래핑 규약을 문서 수준에서 정확하게 인식하고 있다.
  - 제안: 현 상태 유지. 규약 준수.

- **[WARNING]** `spec/5-system/16-system-status-api.md §1` 구현 갭 미결 — `agent-memory-extraction` 큐 미등재
  - target 위치: `spec/5-system/16-system-status-api.md §1` 대상 큐 레지스트리 표 하단 주석 ("⚠ 구현 갭")
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` 의 spec-impl 동기 원칙 (spec 선언 vs 구현 갭은 추적되어야 함)
  - 상세: 문서 자체가 `agent-memory-extraction` 의 `MONITORED_QUEUES` 미등재를 "2026-06-10 감사 보고 V-15 추적" 으로 명시한다. 이는 규약 위반이 아니라 알려진 구현 갭의 정직한 기록이다. 단, 갭을 인지한 상태로 impl-done 검토를 통과하려면 해당 갭의 plan 추적이 명확해야 한다.
  - 제안: V-15 갭을 추적하는 plan 파일이 `plan/in-progress/` 에 존재하는지 확인하고, 없다면 plan 파일을 생성하거나 기존 plan 의 해당 항목으로 연결한다. spec 문서의 갭 인라인 주석 외에 plan 수준 추적을 병행한다.

---

### 4. 명명 규약

- **[INFO]** `spec/5-system/2-api-convention.md §2.2` — URL kebab-case 규약, `spec/5-system/` 파일명 점검
  - target 위치: `spec/5-system/` 폴더 내 파일들
  - 위반 규약: `spec/conventions/swagger.md §5-1` 응답 DTO 위치 규약 (간접 관련)
  - 상세: `spec/5-system/` 의 파일명들(`1-auth.md`, `2-api-convention.md`, ..., `16-system-status-api.md`, `_product-overview.md`)은 CLAUDE.md 의 `_product-overview.md`·숫자 prefix 명명 패턴을 일관되게 따르고 있다. 새로 추가된 `16-system-status-api.md`·`17-agent-memory.md` 도 같은 패턴을 유지한다. 위반 없음.
  - 제안: 현 상태 유지.

- **[INFO]** `spec/5-system/10-graph-rag.md §3.3 추출 LLM 응답 스키마` — `displayName` camelCase 필드명
  - target 위치: `spec/5-system/10-graph-rag.md §3.3` JSON Schema 정의
  - 위반 규약: `spec/conventions/node-output.md` 의 output 필드 명명 (암묵적 snake_case 선호)
  - 상세: Graph RAG 추출 LLM JSON Schema 의 `displayName` 필드는 camelCase 다. 동일 스키마에서 `name`, `type`, `description` 은 snake_case 경향이며, LLM 추출 schema 내부 필드라 API 응답 규약과 레이어가 다르다. node-output.md 의 규약 적용 범위는 노드 핸들러 output 이며 LLM 프롬프트 스키마는 별도 도메인이다. 따라서 규약 위반으로 단정하지 않으나, 내부 일관성 관점에서 `display_name` 으로 통일하는 것을 고려할 수 있다.
  - 제안: 명시적 위반은 아님. 향후 LLM 스키마 표준화 시 snake_case 로 통일 고려.

---

### 5. 문서 Rationale 섹션

- **[INFO]** `spec/5-system/16-system-status-api.md` — Rationale 섹션 존재 및 적절성
  - target 위치: `spec/5-system/16-system-status-api.md ## Rationale`
  - 위반 규약: CLAUDE.md "Rationale — 해당 spec 문서 끝의 `## Rationale`"
  - 상세: `16-system-status-api.md` 는 R-1 ~ R-5 까지 명확한 Rationale 섹션을 보유한다. 권장 구조 완전 준수.
  - 제안: 현 상태 유지.

- **[INFO]** `spec/5-system/10-graph-rag.md` — Rationale 섹션 부재
  - target 위치: `spec/5-system/10-graph-rag.md` 전체
  - 위반 규약: CLAUDE.md "Rationale — 해당 spec 문서 끝의 `## Rationale`"
  - 상세: `10-graph-rag.md` 에는 `§4 기술 결정 사항` 표가 Rationale 역할을 하나 CLAUDE.md 의 권장 섹션 이름인 `## Rationale` 가 명시적으로 없다. 권장 사항이므로 INFO 수준이다.
  - 제안: `§8 미결 / 후속 검토` 이후 `## Rationale` 섹션을 추가하고, `§4 기술 결정 사항` 의 "근거" 열 내용을 이식하는 방향을 고려한다.

---

### 6. API 문서 규약 (Swagger/DTO)

- **[INFO]** `spec/5-system/1-auth.md §5` API 엔드포인트 표 — `swagger.md §5-1` 응답 DTO 위치 규약과의 정합
  - target 위치: `spec/5-system/1-auth.md §5` API 엔드포인트 표
  - 위반 규약: `spec/conventions/swagger.md §5-1` 응답 DTO 위치 규약
  - 상세: spec 문서(1-auth.md) 는 엔드포인트 목록과 기능 설명만 담으며, 실제 DTO 위치 규약(`dto/responses/*-response.dto.ts`)은 코드 레벨 사항이다. spec 문서가 DTO 위치를 지정할 의무는 없으므로 위반이 없다.
  - 제안: 현 상태 유지.

---

### 7. 금지 항목 점검

- **[INFO]** `spec/5-system/1-auth.md §4.1` 인라인 audit 액션 문자열 선언 관련
  - target 위치: `spec/5-system/1-auth.md §4.1` "현재 구현된 액션" 표
  - 위반 규약: `spec/conventions/audit-actions.md §1` "새 action 은 반드시 `AUDIT_ACTIONS` union 에 추가한 뒤 사용한다 (인라인 문자열 금지)"
  - 상세: 이 금지 규약은 **코드** 내에서 인라인 문자열을 쓰지 말라는 의미이지, spec 문서의 목록 선언을 금지하는 것이 아니다. spec 문서는 카탈로그 역할이며, 코드에서는 `AUDIT_ACTIONS` union 을 통해 타입으로 강제함을 동 문서가 명시한다. 문서 레벨에서는 규약 위반이 없다.
  - 제안: 현 상태 유지.

---

## 요약

`spec/5-system/` 전체는 정식 규약(`spec/conventions/**`)을 전반적으로 잘 준수하고 있다. 주요 에러 코드 명명 예외(`lower_snake_case` 초대 흐름 코드)는 `error-codes.md §3` 에 historical-artifact 로 정식 등재되어 규약 이탈이 아닌 예외로 명문화되어 있다. 감사 액션 명명·시제도 `audit-actions.md §2` 의 3분류 taxonomy 를 준수한다. API 응답 봉투 규약(`{ data: ... }` 래핑)은 auth.md 에서 명시적으로 인식·기술되어 있다. 발견된 사항의 대부분은 INFO 수준의 문서 구조 개선 제안이며, WARNING 은 `16-system-status-api.md §1` 의 `agent-memory-extraction` 구현 갭 추적 명확화 1건이다. 이 갭은 spec 이 인지하고 인라인 주석으로 표시하나, plan 수준 추적 여부를 확인하고 보강하는 것이 권장된다. CRITICAL 은 없다.

---

## 위험도

LOW
