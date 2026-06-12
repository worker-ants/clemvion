# 정식 규약 준수 검토 결과

**대상 문서**: `spec/5-system/10-graph-rag.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-06-12

---

## 발견사항

### [INFO] 자기 자신을 PRD 링크로 지칭
- target 위치: 문서 상단 "관련 문서" 블록 첫 번째 항목 — `[PRD Graph RAG](./10-graph-rag.md)`
- 위반 규약: CLAUDE.md 단일 진실 원칙 (링크 일관성)
- 상세: 헤더의 관련 문서 링크가 `[PRD Graph RAG](./10-graph-rag.md)` 로 본 파일 자신(`spec/5-system/10-graph-rag.md`)을 가리킨다. 동일 파일을 "PRD" 로 구분한 것처럼 보이지만 실제로는 같은 파일이다. `spec-link-integrity.test.ts`(§4.2) 가 self-link 를 유효한 타깃으로 처리하므로 빌드 차단은 되지 않으나, 독자에게 혼란을 준다.
- 제안: PRD 가 별도 파일로 존재하지 않는다면 자기 참조 링크 제거. PRD 와 Spec 을 통합한 단일 문서가 의도라면 "관련 문서" 항목에서 `[PRD Graph RAG](./10-graph-rag.md)` 를 삭제한다.

---

### [WARNING] Overview 섹션이 권장 구조를 따르지 않음 — `_product-overview.md` 패턴 또는 단독 `## Overview` 권장
- target 위치: 문서 전체 구조 — `## Overview (제품 정의)` 이후 `### 1. 목표` ~ `### 8. 미결 / 후속 검토` 가 **Overview 하위 h3** 로 배치되고, `## 1. 개요` 부터 별도의 "기술 명세" 본문이 시작된다.
- 위반 규약: CLAUDE.md "정보 저장 위치" — "`spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`" / "기술 명세 `spec/<영역>/*.md` 본문" / "결정의 배경·근거 해당 spec 문서 끝의 `## Rationale`"
- 상세: 현 구조는 `## Overview (제품 정의)` 안에 요구사항 표(§3), 단계별 도입(§6), 의존성(§7), 미결 사항(§8) 까지 모두 집어넣어 Overview 섹션이 문서 전체 분량의 약 절반에 이른다. CLAUDE.md 가 권장하는 "Overview / 본문 / Rationale 3섹션" 에서 Overview 는 제품 정의·요구사항의 진입이고 기술 명세·단계별 계획 등은 본문 섹션이어야 한다. `## Rationale` 은 문서 끝에 올바르게 위치해 있어 이 부분은 준수.
- 제안: `### 3. 요구사항` ~ `### 8. 미결 / 후속 검토` 를 `## Overview` 아래에서 꺼내 최상위 `##` 섹션(본문)으로 올리거나, 현재 `## 1. 개요` ~ `## 8. 비-목표` 와 통합하여 Overview 섹션을 제품 정의·목표·범위 정도로만 제한한다. 규약 자체를 갱신하기보다 문서 구조 조정이 적합하다.

---

### [INFO] `## Overview` 표제어에 부제 "(제품 정의)" 병기
- target 위치: `## Overview (제품 정의)` (문서 line 51)
- 위반 규약: CLAUDE.md — "진입 문서의 `## Overview`" 표현에서 표제어는 단순 `## Overview` 권장
- 상세: CLAUDE.md 의 다른 spec 문서들(예: `spec/conventions/spec-impl-evidence.md`, `rag-evaluation.md`) 은 모두 `## Overview` 만 사용한다. "(제품 정의)" 부제는 일관성 측면에서 미세한 이탈이다.
- 제안: `## Overview (제품 정의)` → `## Overview` 로 단순화. 또는 규약이 이를 허용한다면 INFO 로 유지.

---

### [INFO] 에러 코드 `KB_REEXTRACT_IN_PROGRESS` 의 UPPER_SNAKE_CASE 준수 — 확인
- target 위치: §5.1 API 표, §7 에러 처리 표 (`409 KB_REEXTRACT_IN_PROGRESS`)
- 위반 규약: `spec/conventions/error-codes.md §1` — 에러 코드는 `UPPER_SNAKE_CASE`, 의미 기반 명명
- 상세: `KB_REEXTRACT_IN_PROGRESS` 는 도메인 prefix(`KB_`) + 조건(`REEXTRACT_IN_PROGRESS`) 형태로 UPPER_SNAKE_CASE 를 준수하고 의미도 명확하다. 규약 준수 확인.

---

### [INFO] WebSocket 이벤트 명명 — `document:graph_*` 패턴은 기존 규약과 일관
- target 위치: §6 WebSocket 이벤트 표
- 위반 규약: 해당 없음 (확인 사항)
- 상세: `document:graph_started` / `document:graph_progress` / `document:graph_completed` / `document:graph_retry` / `document:graph_failed` 는 기존 `document:embedding_*` 이벤트와 동일 패턴(`<resource>:<domain>_<verb>`)을 따른다. dead-declared 인 `document:graph_error` 를 문서에서 명시적으로 "미emit" 처리한 것도 일관성 있게 기술됨.

---

### [INFO] `spec/conventions/node-output.md` 와의 관련성 — Graph RAG 는 노드 핸들러 output 이 아님
- target 위치: §4.3 출력 메타데이터 JSON 예시
- 위반 규약: `spec/conventions/node-output.md` (적용 대상 아님)
- 상세: §4.3 의 JSON 예시(`ragSources`, `graphTraversal`)는 RAG 검색 응답 메타데이터로, NodeHandlerOutput 의 `output.*` 형태와는 별개다. `node-output.md` 는 노드 핸들러 출력 컨트랙트이고, 이 검색 응답 구조의 SoT 는 `spec/5-system/9-rag-search.md §4.1` 임을 문서가 명시하고 있다. 규약 충돌 없음.

---

### [INFO] API 경로 표기에 `/api/` prefix 포함 — 일관성 확인
- target 위치: §3.4 재추출, §5 API 표
- 위반 규약: `spec/conventions/swagger.md` — 직접 연관 규약 없음
- 상세: `POST /api/knowledge-bases/:id/documents/:docId/re-extract` 형태로 `/api/` prefix 를 포함하여 표기한다. `spec/conventions/cafe24-api-catalog/_overview.md` 의 path 컬럼은 base URL prefix 를 생략하는 스타일이나 이는 Cafe24 외부 API 카탈로그에 한정된 규약이다. 본 문서는 내부 REST API 이므로 `/api/` 포함 표기가 맥락에 맞다. 규약 위반 없음.

---

### [WARNING] frontmatter `id` 가 파일 basename 과 일치하나 "PRD Graph RAG" 와 혼용
- target 위치: frontmatter `id: graph-rag`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "`id` — 파일 basename(확장자 제외) 기반 권장"
- 상세: `id: graph-rag` 는 파일명 `10-graph-rag.md` 의 basename(숫자 prefix 제외) 에 기반하므로 규약 준수. `status: implemented`, `code:` 글로브 목록도 구체적 파일/glob 으로 채워져 있어 `spec-code-paths.test.ts` 를 통과할 가능성이 높다. `pending_plans:` 없고 `status: implemented` 이므로 요구사항 없음. 이 항목은 확인 INFO.

---

## 요약

`spec/5-system/10-graph-rag.md` 는 frontmatter 스키마(`spec-impl-evidence.md`)를 올바르게 사용하고, 에러 코드는 `UPPER_SNAKE_CASE` + 의미 기반 명명을 준수하며, 문서 끝 `## Rationale` 섹션도 갖추고 있다. 주요 규약 위반은 없으나, **Overview 섹션이 지나치게 비대해 요구사항·도입 계획·의존성·미결 사항까지 포함하는 구조**가 CLAUDE.md 의 "Overview / 본문 / Rationale 3섹션" 권장 구조와 거리감이 있다(WARNING). 또한 관련 문서 링크에 자기 파일을 "PRD Graph RAG" 로 참조하는 자기 순환 링크(INFO)가 존재한다.

## 위험도

LOW
