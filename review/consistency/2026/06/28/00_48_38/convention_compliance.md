# 정식 규약 준수 검토 결과

검토 범위: `spec/5-system/` (--impl-done, diff-base=37230c91f)
검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`,
`spec/conventions/audit-actions.md`, `spec/conventions/cafe24-api-catalog/_overview.md`,
`spec/conventions/cafe24-api-catalog/application.md`, `spec/conventions/cafe24-api-catalog/application/apps.md`

---

## 발견사항

### [WARNING] `spec/5-system/10-graph-rag.md` — Overview 헤딩 비표준 레이블
- **target 위치**: 파일 line 29, `## Overview (제품 정의)` 헤딩
- **위반 규약**: CLAUDE.md "Overview / 본문 / Rationale 3섹션 권장" — 표준 헤딩은 `## Overview`
- **상세**: 다른 모든 `spec/5-system/` 파일(예: `1-auth.md` 의 `## Overview`)은 순수 `## Overview` 를 사용한다. `(제품 정의)` 라벨을 부가해 포맷 일관성이 깨졌다. 시각적으로도 다른 spec 파일과 동형이 아니어서 자동화 툴·리뷰어가 Overview 섹션 경계를 다르게 해석할 수 있다.
- **제안**: 헤딩을 `## Overview` 로 통일. "제품 정의" 맥락이 필요하면 섹션 도입부 한 줄 문장으로 기술.

---

### [WARNING] `spec/5-system/10-graph-rag.md` — 비-목표/범위-밖 항목이 두 섹션에 분산
- **target 위치**: (1) `## Overview` → `### 2. 범위` → `#### 2.2 본 문서 범위 밖` (line ~60), (2) `## 8. 비-목표` (line 578)
- **위반 규약**: CLAUDE.md "단일 진실 원칙" (정보 저장 위치), 3섹션 권장 (Overview / 본문 / Rationale)
- **상세**: "무엇이 범위 밖인가"라는 동일 질문에 두 섹션이 각각 다른 항목으로 답한다. `§2.2 본 문서 범위 밖`은 아키텍처 단위 미채택 4개(community detection, Neo4j, 룰 기반 추출, KB 모드 사후 변경)를, `## 8. 비-목표`는 feature 단위 미채택 4개(entity disambiguation, Cross-KB linking, graph embedding, 자동 prompt tuning)를 담는다. 단일 진실 원칙 상 "범위 밖" 정보는 한 곳에 모여야 하며, Overview 안 `§2.2`가 그 자연스러운 위치다. `## 8. 비-목표`가 body 끝(구현 상세 뒤, Rationale 앞)에 독립 섹션으로 존재하는 것은 3섹션 구조와도 맞지 않는다.
- **제안**: `## 8. 비-목표` 의 항목들을 `#### 2.2 본 문서 범위 밖` 테이블에 통합(행 추가)하고 `## 8` 섹션을 삭제. 범위 밖 정보를 Overview 한 곳에서 단일 관리.

---

### [INFO] `spec/5-system/10-graph-rag.md` — 체계적 개요 중복 (`## Overview` 와 `## 1. 개요`)
- **target 위치**: `## Overview (제품 정의)` 섹션(대형, 8개 소섹션 포함) 직후 `## 1. 개요` (line 206)
- **위반 규약**: CLAUDE.md 3섹션 권장 — `## Overview` 가 overview 역할을 담당
- **상세**: `## Overview` 가 이미 목표·범위·요구사항·기술 결정·의존성 등 8개 소섹션을 포함한 대형 섹션이다. 이어서 `## 1. 개요`가 용어 정의와 흐름 다이어그램을 제공해 "개요" 성격이 겹친다. 1-auth.md 등 다른 파일에서는 `## Overview` (간결) → `## 1. 인증` (실제 기술 내용)으로 분리되는 반면, 이 파일은 Overview 자체가 PRD 수준 내용을 포함해 body 첫 섹션과 역할 경계가 모호하다.
- **제안**: `## 1. 개요` 의 용어 정의(glossary)는 Overview 섹션의 하위 섹션으로 이동하거나 Rationale 로 이전. 흐름 다이어그램은 추출 파이프라인 섹션(`## 3.`) 서두로 이동. `## 1. 개요` 를 삭제하여 body 가 `## 1. 데이터 모델`부터 시작하도록 재번호.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application.md` — `## Overview` · `## Rationale` 섹션 부재
- **target 위치**: `spec/conventions/cafe24-api-catalog/application.md` 전체
- **위반 규약**: CLAUDE.md "Overview / 본문 / Rationale 3섹션 권장" (`spec/conventions/**.md` 적용 대상)
- **상세**: 파일은 frontmatter(`id`, `status`, `code`) ✓ 와 `## 표` · `## Field-level 상세 카탈로그` 만 보유하며 `## Overview` 나 `## Rationale` 이 없다. `spec-impl-evidence.md §1` 이 이 파일을 lifecycle 검증 대상으로 지정했으나, 동기 정책·컬럼 정의 등 설계 근거는 `_overview.md` 에 위임하는 형태로 분산돼 있다. catalog 파일의 특수 목적을 고려하면 Rationale 생략은 이해할 수 있으나, "권장" 구조에서 벗어난 점은 기록한다.
- **제안**: 규약 갱신이 더 적절. `spec-impl-evidence.md §1` 의 제외 예외 항목에 "카탈로그 최상위 `<resource>.md` 인덱스는 `_overview.md` 를 Rationale SoT 로 위임한다" 는 예외 근거를 명시하거나, `application.md` 에 `## Rationale` 을 한 줄("본 파일의 설계 근거·동기 정책은 `_overview.md` §4 에 위임한다")로 추가.

---

## 준수 확인 항목 (위반 없음)

- **`spec/5-system/1-auth.md`**: frontmatter(`id: auth`, `status: partial`, `pending_plans:`) ✓, 3섹션 구조(`## Overview` / 본문 1–5 / `## Rationale`) ✓, 에러 코드 `UPPER_SNAKE_CASE` ✓ (초대 코드 `lower_snake_case` 는 `error-codes.md §3` historical-artifact 레지스트리에 정식 등재 ✓), 감사 액션 `<resource>.<verb>` 형식 ✓, audit-actions.md 레지스트리와 완전 일치 ✓
- **`spec/conventions/audit-actions.md`**: frontmatter ✓, 3섹션 구조 ✓, 도메인별 분류 레지스트리가 `1-auth.md §4.1` 과 쌍방향 일치 ✓
- **`spec/conventions/cafe24-api-catalog/_overview.md`**: `_` prefix 파일이므로 frontmatter 면제(spec-impl-evidence.md §1) ✓, `## Rationale` 보유 ✓
- **`spec/conventions/cafe24-api-catalog/application/apps.md`**: field-level 카탈로그 파일(spec-impl-evidence.md §1 제외 대상), frontmatter 형식(`resource`/`entity`/`cafe24_docs`/`source`) 올바름 ✓

---

## 요약

검토 대상 문서들은 명명 규약(에러 코드 UPPER_SNAKE_CASE, 감사 액션 `<resource>.<verb>`, API endpoint kebab-case), 출력 포맷 규약(응답 봉투, 에러 코드 등록), frontmatter 스키마를 전반적으로 준수하고 있다. 위반은 모두 `spec/5-system/10-graph-rag.md` 의 문서 구조에 집중돼 있다. 특히 비-목표/범위-밖 항목이 Overview와 body 두 곳에 분산된 것(WARNING)은 단일 진실 원칙을 어기며 유지보수 시 항목이 엇갈릴 위험이 있다. Overview 헤딩에 부가 레이블이 붙은 것(WARNING)도 포맷 일관성을 깨뜨린다. 두 WARNING 을 수정하면 이 파일의 구조 규약 준수 수준이 크게 개선된다. CRITICAL 위반은 없다.

---

## 위험도

LOW
