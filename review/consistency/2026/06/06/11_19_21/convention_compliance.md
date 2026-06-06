# 정식 규약 준수 검토 결과

검토 범위: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md)
검토 기준: `spec/conventions/` 전체 + CLAUDE.md 명명 컨벤션

---

## 발견사항

### 1. [WARNING] 10-graph-rag.md — 관련 문서 링크가 자기 자신을 가리킴

- **target 위치**: `spec/5-system/10-graph-rag.md` 상단 관련 문서 블록 (관련 문서: `[PRD Graph RAG](./10-graph-rag.md)`)
- **위반 규약**: CLAUDE.md "제품 정의·요구사항 → `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`"; 문서 구조 규약 관련 문서 블록은 외부 참조 목적
- **상세**: 파일 자기 자신(`10-graph-rag.md`)을 `[PRD Graph RAG]` 라는 라벨로 참조하고 있다. 이 링크는 실질적으로 자기지시(self-referential)이며 PRD 탐색 경로를 제공하지 않는다. 같은 디렉터리의 `9-rag-search.md`, `8-embedding-pipeline.md` 는 `[PRD AI & 지식 저장소](../4-nodes/3-ai/_product-overview.md)` 처럼 `_product-overview.md` 를 올바르게 참조한다.
- **제안**: `[PRD Graph RAG](./10-graph-rag.md)` 를 실제 PRD 위치(예: `[PRD AI & 지식 저장소](../4-nodes/3-ai/_product-overview.md)`) 로 수정하거나, Graph RAG 의 PRD 가 별도로 존재하지 않는다면 링크를 제거하거나 `[Spec 개요](./10-graph-rag.md#overview-제품-정의)` 같은 내부 앵커로 교체한다.

---

### 2. [INFO] 11-mcp-client.md — `## Rationale` 최상위 섹션 부재

- **target 위치**: `spec/5-system/11-mcp-client.md` 전체 구조
- **위반 규약**: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"; 문서 구조 3섹션 권장(Overview / 본문 / Rationale)
- **상세**: 11-mcp-client.md 는 `## 1. 개요` 부터 `## 12. 확장 포인트` 까지 번호 기반 섹션으로만 구성되며, `## Rationale` 최상위 섹션이 없다. 같은 디렉터리의 `1-auth.md` 는 풍부한 `## Rationale` 섹션을 파일 끝에 포함하고, `10-graph-rag.md` 도 `## Rationale` 섹션이 있다. 설계 결정 근거(transport 선택, stdio 미지원, stateless JWT challenge 채택, Internal Bridge 패턴 등)가 각 섹션의 인라인 블록으로 흩어져 있다.
- **제안**: 파일 끝에 `## Rationale` 섹션을 추가하고 transport 선택 근거, stdio 미지원 이유, stateless challenge, Internal Bridge 패턴 등의 결정 근거를 이동·통합한다. 단 기존 인라인 근거가 충분히 상세하므로 실질적 정보 손실은 없으며 구조 일관성 목적의 개선이다.

---

### 3. [INFO] 1-auth.md §1.5.4 — `lower_snake_case` 에러 코드 historical-artifact 등재 확인 (규약 준수)

- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 테이블 및 하단 명명 주석 블록
- **위반 규약**: 해당 없음 — 규약 준수 상태 확인
- **상세**: `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited` 가 `lower_snake_case` 로 등장하나, 이는 `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 정식 등재된 예외다. auth.md 내 주석도 해당 레지스트리를 명시 참조하며 신규 코드에서는 이 예외를 선례로 삼지 않도록 안내하고 있다. `error-codes.md §3` 등재 코드 목록과 `1-auth.md §1.5.4` 코드 목록이 일치한다.
- **제안**: 현 상태 유지. 신규 초대 관련 에러 코드가 추가될 경우 `UPPER_SNAKE_CASE` 를 사용하고 `error-codes.md §3` 에 등재하지 않는다.

---

### 4. [INFO] 10-graph-rag.md — `## Overview (제품 정의)` 와 `## 1. 개요` 중복 구조

- **target 위치**: `spec/5-system/10-graph-rag.md` — `## Overview (제품 정의)` 섹션과 `## 1. 개요` 섹션
- **위반 규약**: 문서 구조 3섹션 권장 (Overview / 본문 / Rationale)
- **상세**: 파일 상단에 `## Overview (제품 정의)` 섹션(요구사항·범위·단계 계획 등 포함)이 있고, 본문에 다시 `## 1. 개요` 가 별도로 존재해 "Graph RAG 는 KB 의 검색 모드가 graph 일 때 활성화..." 를 재서술한다. 두 섹션의 역할이 명확히 구분되지 않아 독자가 어느 섹션이 spec 의 단일 진실인지 혼동할 수 있다.
- **제안**: `## 1. 개요` 를 기술 구현 상세(파이프라인 흐름 다이어그램 포함) 전용으로 리파인하고, `## Overview (제품 정의)` 가 제품 목표·요구사항 SoT 임을 명시하면 구조가 명확해진다. 또는 `## 1. 개요` 를 `## 1. 기술 개요` 로 rename 해 역할을 분리한다.

---

### 5. [INFO] 11-mcp-client.md §6.2 — `skipReason` `lower_snake_case` 사용 (규약 준수, 근거 명시)

- **target 위치**: `spec/5-system/11-mcp-client.md` §6.2 `skipReason vocabulary` 블록
- **위반 규약**: 해당 없음 — 규약 적용 범위 밖임을 문서가 명시
- **상세**: `skipReason` 값들(`expired_install_timeout`, `expired_refresh_failed` 등)이 `lower_snake_case` 로 정의되어 있으나, 문서 내에 "에러 코드가 아닌 운영 진단용 enum 이라 `node-output.md Principle 3.2` 의 `code` UPPER_SNAKE_CASE 규약과 구분된다" 는 명시적 근거가 있다. `error-codes.md §1` 의 의미 기반 명명 원칙은 `error.code` 필드를 대상으로 하며 `skipReason` 은 그 범위 밖이다.
- **제안**: 이 패턴이 다른 운영 진단 필드로 확산될 경우 `error-codes.md` 또는 별도 규약 파일에 "운영 진단 enum 은 `lower_snake_case` 허용, SoT 는 `Integration.status_reason` 명명 패턴" 항목을 명시적으로 추가하면 미래의 혼동을 방지할 수 있다.

---

## 요약

`spec/5-system/` 내 3개 파일(1-auth.md, 10-graph-rag.md, 11-mcp-client.md)을 `spec/conventions/` 및 CLAUDE.md 명명·구조 컨벤션 기준으로 검토한 결과, CRITICAL 위반은 없다. 가장 주목할 사항은 `10-graph-rag.md` 의 관련 문서 블록이 자기 자신을 "PRD Graph RAG" 로 참조하는 자기지시 링크(WARNING 1건)이며, 이는 독자의 PRD 탐색 경로를 방해한다. 에러 코드 규약(`UPPER_SNAKE_CASE`)의 경우 초대 흐름 `lower_snake_case` 코드들이 `error-codes.md §3` historical-artifact 레지스트리에 정식 등재되어 있고, `mcpDiagnostics.skipReason` 의 `lower_snake_case` 도 규약 적용 범위 밖임을 문서가 명시하고 있어 두 경우 모두 규약 준수 상태다. `11-mcp-client.md` 의 `## Rationale` 섹션 부재와 `10-graph-rag.md` 의 Overview/개요 중복 구조는 INFO 수준의 구조 일관성 개선 사항이다.

---

## 위험도

LOW
