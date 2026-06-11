# 정식 규약 준수 검토 결과

검토 대상: `spec/2-navigation/` (구현 완료 후 검토, diff-base=origin/main)
검토 일자: 2026-06-11

---

## 발견사항

### [WARNING] `14-execution-history.md` — 문서 구조 비표준 (Overview 섹션 중복·혼용)

- **target 위치**: `spec/2-navigation/14-execution-history.md` 라인 1242–1316 (`## Overview (제품 정의)` 블록) 및 라인 1316 이하의 `## 1. 개요` 섹션
- **위반 규약**: CLAUDE.md "정보 저장 위치" — 제품 정의·요구사항은 `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview` 섹션에 담는다. spec 문서 3섹션 권장 구성은 "Overview / 본문 / Rationale" 이다.
- **상세**: `14-execution-history.md` 는 동일 파일 내에 `## Overview (제품 정의)` (내부에 `### 1. 개요`, `### 2. 페이지 구조`, `### 3. 요구사항`) 와, 그 바로 아래에 다시 `## 1. 개요`·`## 2. 실행 내역 목록 페이지` 등의 본문 섹션을 병렬로 배치하고 있다. 이는 하나의 파일에 Overview 레이어(PRD 성격)와 기술 명세 레이어(spec 본문)가 혼재하는 구조로, 다른 spec 파일들이 Overview 절을 별도 `_product-overview.md` 로 분리하거나 존재하지 않는 것과 비일관적이다. 또한 `## Overview (제품 정의)` 라는 제목에서 `(제품 정의)` 부가어는 다른 파일에 없는 비표준 표현이다.
- **제안**: `## Overview (제품 정의)` 블록의 내용(`### 1. 개요` 배경·목표, `### 2. 페이지 구조` 경로, `### 3. 요구사항`)은 `_product-overview.md` 에 통합하거나, 파일 상단의 `## Overview` 단일 절로 정리하고 `(제품 정의)` 부가어를 제거하는 것이 일관적이다. 단, 이 파일이 해당 요구사항을 처음 정의한 origin이고 PRD 분리 의도가 없었다면, 규약 갱신(execution-history 는 화면 spec + PRD 통합 허용)이 적절할 수 있다.

---

### [WARNING] `14-execution-history.md` — `spec-impl-evidence` frontmatter `code:` 글로브 범위 미흡 가능성

- **target 위치**: `spec/2-navigation/14-execution-history.md` frontmatter `code:` 필드
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로" 를 글로브로 나열한다. `status: implemented` 이면 ≥1 매치 의무.
- **상세**: frontmatter 의 `code:` 에는 `executions.service.ts`, `execution-response.dto.ts`, `query-execution.dto.ts`, `utils/*.ts` 와 frontend `executions/**` 가 선언되어 있다. 그러나 §3.7 Re-run 액션, §EH-DETAIL-10/EH-DETAIL-11 에서 참조하는 `POST /api/executions/:executionId/re-run` 및 `GET /api/executions/:executionId/chain` 의 구현 경로(예: `executions.controller.ts`)가 `code:` 에 없다. spec 이 약속한 surface 와 `code:` 등재 경로 간에 갭이 있을 가능성이 있다.
- **제안**: `codebase/backend/src/modules/executions/executions.controller.ts` 를 `code:` 에 추가하는 것을 고려하라.

---

### [WARNING] `14-execution-history.md` — 에러 코드 대소문자 일관성

- **target 위치**: `spec/2-navigation/14-execution-history.md` §5 목록 API 쿼리 파라미터 표 (라인 ~1645)
- **위반 규약**: `spec/conventions/error-codes.md §1` — 에러 코드 표기는 `UPPER_SNAKE_CASE` (SoT `node-output.md §3.2` · `3-error-handling.md §3.2`). 단, 초대 흐름 `lower_snake_case` 는 등록된 historical-artifact 예외.
- **상세**: `14-execution-history.md` 본문에 에러 코드 직접 언급은 없지만, §3.5 에서 "Failed to load execution. Please try again." / "Execution not found." 를 에러 표시값으로 서술하면서 error.code 명을 누락했다. 이는 에러 코드 규약 위반이라기보다는 spec 불완전(에러 code 미정의)이라 INFO 급에 가깝다. 단, 다른 spec 파일들(예: `1-workflow-list.md §3 폴더 API`)은 에러 상황에서 `RESOURCE_CONFLICT`, `VALIDATION_ERROR` 등 `code:` 명을 명시하는 반면 이 파일은 그렇지 않아 일관성 차이가 있다.
- **제안**: §3.5 에러 상태 표에서 API 응답의 `error.code` 값을 명시하거나, 범용 에러 코드(`NOT_FOUND`, `INTERNAL_SERVER_ERROR` 등)를 `UPPER_SNAKE_CASE` 로 병기하라.

---

### [INFO] `14-execution-history.md` — Overview 내 `## Overview (제품 정의)` 하위에 구분선(`---`) 삽입 위치 이상

- **target 위치**: `spec/2-navigation/14-execution-history.md` 라인 1243–1244 (`## Overview (제품 정의)` 바로 아래 `---`)
- **위반 규약**: 명시적 금지 항목은 아님. CLAUDE.md 3섹션 구성 권장 관행.
- **상세**: `## Overview (제품 정의)` 바로 아래에 `---` 구분선이 들어 있어 섹션 제목과 내용 사이를 분리한다. 같은 파일의 다른 섹션(`## 1. 개요` 이하)은 구분선을 섹션 *말미*에 배치한다. 형식 불일관이다.
- **제안**: Overview 섹션 내 `---` 를 제목 바로 아래가 아닌 섹션 종료 후로 이동하거나 제거하라.

---

### [INFO] `15-system-status.md` — Rationale 섹션 헤딩 레벨 혼용

- **target 위치**: `spec/2-navigation/15-system-status.md` `## Rationale` 섹션 (R-1, R-2, R-3)
- **위반 규약**: 명시적 금지 아님. 관행 일관성 참고.
- **상세**: 이 파일의 Rationale 하위 항목은 `### R-1.` `### R-2.` `### R-3.` 을 사용한다. 동일 영역의 다른 파일들은 `### 1.` / `### 2.` 또는 `### R-1.` 등 혼용한다. 규약에서 Rationale 내부 번호 형식을 강제하지는 않으므로 INFO 수준이다.
- **제안**: 영역 내 일관된 스타일(`### R-N.` 형식이 이미 여러 파일에 사용됨)을 유지하면 충분하다.

---

### [INFO] `16-agent-memory.md` — `## 3. 요구사항` 섹션이 PRD 로 위임만 하고 본문 없음

- **target 위치**: `spec/2-navigation/16-agent-memory.md` §3 (라인 ~1873–1874)
- **위반 규약**: 명시적 금지 아님. 문서 구조 권장.
- **상세**: `## 3. 요구사항` 절이 "_요구사항 ID `NAV-AM-01`~`NAV-AM-06` 은 `_product-overview.md` 가 단일 진실_" 이라는 한 문장만 포함하고 실질 내용이 없다. 요구사항을 PRD 로 위임하는 패턴은 설계상 허용되지만, 빈 섹션이 명세 추적 시 혼란을 줄 수 있다.
- **제안**: 요구사항이 PRD 에 있으면 `## 3. 요구사항` 절을 제거하거나, 최소한 `_product-overview.md` 내 특정 앵커 링크를 추가하라.

---

## 요약

`spec/2-navigation/` 대상 파일들은 전반적으로 `spec-impl-evidence.md` frontmatter 스키마(id/status/code:)를 준수하고, API 엔드포인트 표의 공통 래퍼(`{ "data": ... }`) 규약 언급도 일관적이다. 에러 코드 표기(`UPPER_SNAKE_CASE`) 역시 대부분 문서에서 준수된다. 주요 준수 이슈는 `14-execution-history.md` 에 집중되어 있다: 하나의 파일 안에 PRD 성격의 Overview 레이어(배경·목표·요구사항 ID 표)와 기술 명세 본문이 병렬 배치되어 3섹션 문서 구조 권장에서 벗어나며, `code:` frontmatter 가 spec 이 약속한 모든 controller surface 를 포괄하지 못할 가능성이 있다. 나머지 파일들은 형식 일관성 차원의 INFO 수준 항목만 발견된다.

---

## 위험도

MEDIUM
