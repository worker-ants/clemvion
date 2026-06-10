# 정식 규약 준수 검토 결과

**대상**: `spec/2-navigation/5-knowledge-base.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-06-11

---

## 발견사항

### [WARNING] API URL 3단계 중첩 초과 — `documents/:docId/re-embed`, `documents/:docId/re-extract`
- **target 위치**: §3 API 표 — `POST /api/knowledge-bases/:id/documents/:docId/re-embed`, `POST /api/knowledge-bases/:id/documents/:docId/re-extract`
- **위반 규약**: `spec/conventions/` → `spec/5-system/2-api-convention.md §2.2 명명 규칙` — "중첩은 2단계까지 (`/api/knowledge-bases/:id/documents`)", "3단계 이상은 최상위로 분리 (`/api/documents/:docId` 필요 시)"
- **상세**: 두 엔드포인트는 `/api/knowledge-bases/:id/documents/:docId/re-embed` 및 `/api/knowledge-bases/:id/documents/:docId/re-extract` 로 `{resource}/{id}/{sub-resource}/{subId}/{action}` 패턴, 즉 3단계 중첩을 초과한다. RPC-style sub-channel 예외(§2.2 단서 — `triggers/:id/notification/rotate-secret` 등)는 "자원 자체가 아닌 sub-channel 의 부작용 동작" 이라 규정하는데, `documents` 는 documents 리소스 자체이므로 해당 예외에 포함되지 않는다.
- **제안**: `POST /api/knowledge-bases/:id/documents/:docId/re-embed` → `POST /api/knowledge-base-documents/:docId/re-embed` 처럼 최상위 분리, 또는 `POST /api/knowledge-bases/:id/re-embed` 에 `docId` body 파라미터로 단건 지정하는 방식으로 2단계 이하로 조정. 대안으로 규약 §2.2 에 "document action" 패턴을 sub-channel 예외에 명시적으로 추가해 규약을 갱신하는 것도 가능하다 — 단, 현재 규약이 해당 패턴을 의도적으로 허용하지 않으므로 규약 갱신이 더 적절할 수 있다.

---

### [WARNING] 문서 구조 — "Overview" 섹션 없음 (3섹션 권장 불완전)
- **target 위치**: 문서 전체 구조 (##1. 화면 구조 / ##2. 기능 상세 / ##3. API / ##Rationale)
- **위반 규약**: `CLAUDE.md` — "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)". 관련: `spec/conventions/spec-impl-evidence.md §Overview (제품 정의)` 패턴
- **상세**: CLAUDE.md 에서 권장하는 3섹션은 `Overview` / 본문 / `Rationale` 이다. 본 문서는 Rationale 은 갖추고 있으나, 제품 정의 역할을 해야 하는 `## Overview` 섹션이 없다. 대신 `## 1. 화면 구조` 가 첫 섹션으로 바로 시작된다. `_product-overview.md` 로의 cross-reference 링크가 문서 상단에 있어 의도 자체는 분리돼 있지만, 본 문서 내에 "Overview" 명시 섹션이 없는 것은 3섹션 패턴에서 벗어난다.
- **제안**: 문서 상단(또는 §1 앞)에 `## Overview` 섹션을 추가해 화면 목적·범위를 1~3문장으로 요약하고, 하위 문서 링크(`_product-overview.md`, 관련 spec) 를 그 아래로 정리. 내용은 기존 상단 인용줄(`> 관련 문서: ...`)을 재구성하면 충분하다.

---

### [INFO] 에러 코드 표기 혼용 — `KB_REEMBED_IN_PROGRESS`, `KB_REEXTRACT_IN_PROGRESS`, `EMBEDDING_PROBE_FAILED` 는 `UPPER_SNAKE_CASE` 준수
- **target 위치**: §3 API 표 — line 217, 222, 208
- **위반 규약**: `spec/conventions/error-codes.md §1` — "에러 코드 이름은 의미 기반 + `UPPER_SNAKE_CASE`"
- **상세**: 세 에러 코드 모두 `UPPER_SNAKE_CASE` 를 올바르게 따르고 있으며 의미를 직접 기술하고 있다. 이 항목은 준수 확인 사항으로, 위반 없음.
- **제안**: 없음 (현행 유지).

---

### [INFO] frontmatter `status: partial` + `pending_plans` 항목 검증
- **target 위치**: frontmatter (lines 1–17)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `status: partial` 시 `pending_plans:` 의무
- **상세**: `status: partial` 로 선언되고 `pending_plans: [plan/in-progress/kb-model-change-reembed-followup.md]` 가 작성되어 있어 규약 §3 요건을 충족한다. `code:` 에도 글로브 포함 다수 파일이 등재돼 `spec-code-paths.test.ts` 요건을 만족한다. 이 항목은 준수 확인으로, 위반 없음.
- **제안**: 없음.

---

### [INFO] API URL 케밥 케이스 및 복수형 명사 준수 확인
- **target 위치**: §3 API 표 전체
- **위반 규약**: `spec/5-system/2-api-convention.md §2.2` — "리소스는 복수형 명사, 케밥 케이스"
- **상세**: `/api/knowledge-bases`, `/api/knowledge-bases/:id/documents`, `/api/knowledge-bases/:id/entities`, `/api/knowledge-bases/:id/relations` 등 모두 복수형 명사·케밥 케이스를 사용한다. `embedding-stats`, `embedding-probe`, `retry-failed`, `re-embed`, `re-extract`, `graph/stats`, `graph/visualization` 등 action-style 세그먼트도 케밥 케이스로 일관되게 적용되고 있다. 이 항목은 준수 확인으로, 위반 없음.
- **제안**: 없음.

---

## 요약

`spec/2-navigation/5-knowledge-base.md` 는 frontmatter lifecycle (`status: partial` + `pending_plans` + `code:` 경로) 과 에러 코드 명명(`UPPER_SNAKE_CASE`, 의미 기반)을 정식 규약대로 준수한다. 가장 주목할 문제는 `documents/:docId/re-embed` 와 `documents/:docId/re-extract` 두 엔드포인트가 `spec/5-system/2-api-convention.md §2.2` 의 "중첩은 2단계까지" 규칙을 초과한다는 점(WARNING)이다 — RPC-style sub-channel 예외는 해당 패턴을 명시적으로 포괄하지 않는다. 문서 구조에서 CLAUDE.md 권장 3섹션 중 `## Overview` 섹션이 빠져 있는 것도 권고 수준의 갭이다. 그 외 URL 명명·페이지네이션 규약 참조·에러 코드 등은 규약을 잘 따르고 있다.

---

## 위험도

LOW
