# 정식 규약 준수 검토 결과

**Target**: `spec/2-navigation/14-execution-history.md`
**검토 모드**: spec draft (--spec)
**검토일**: 2026-06-11

---

## 발견사항

### [WARNING] `## Overview` 섹션 안에 중첩된 번호 섹션이 본문 섹션과 구조적으로 충돌

- **target 위치**: 파일 라인 18–111 (`## Overview (제품 정의)` 섹션 내 `### 1. 개요`, `### 2. 페이지 구조`, `### 3. 요구사항`)과 라인 114 이후 (`## 1. 개요`, `## 2. 실행 내역 목록 페이지`, ...)
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"; 또한 `spec/conventions/spec-impl-evidence.md §1` 의 적용 대상 패턴 (`spec/2-navigation/**.md`) 에서 spec 문서 표준 구성을 전제
- **상세**: 문서가 `## Overview (제품 정의)` 섹션 안에 `### 1. 개요`, `### 2. 페이지 구조`, `### 3. 요구사항`, `### 3.1`, `### 3.2`, `### 3.3` 의 중첩 섹션을 두고, 다시 라인 114부터 `## 1. 개요`, `## 2. ...`, `## 3. ...` 으로 같은 번호 체계를 본문 레벨 H2 에서 반복한다. 이 구조는 CLAUDE.md 권장 3섹션(Overview / 본문 / Rationale) 구분이 두 번 나뉘어 배치되면서 번호 중복 혼란(Overview 내 §1 과 본문 §1 이 다른 내용)을 일으킨다. 독자와 도구 모두 어느 섹션이 규범적 본문인지 식별하기 어렵다.
- **제안**: Overview 섹션은 제품 정의·목표·요구사항 테이블만 담고, 세부 화면 명세(레이아웃·필터·페이지네이션 등)는 본문 H2 섹션에만 두도록 분리한다. 번호 체계(`1. 개요`, `2. ...`)가 Overview 와 본문 두 곳에 독립적으로 사용되지 않게 한다.

---

### [WARNING] 목록 API 응답 형식이 `swagger.md §5-2` 의 `ApiOkPaginatedResponse` 래퍼와 불일치

- **target 위치**: 라인 452–485 (`## 5. API 엔드포인트` > 목록 API 응답 형식 JSON 블록)
- **위반 규약**: `spec/conventions/swagger.md §5-2` — `ApiOkPaginatedResponse` 래퍼의 반환 스키마는 `{ data: { data: <Dto>[], pagination: { page, limit, totalItems, totalPages } } }` 이며, 응답 봉투(envelope)는 `TransformInterceptor` 에 의해 **전체 payload 가 `data:` 키 아래로 한 번 더 감싸진다**
- **상세**: spec 의 응답 예시는 최상위에 `"data": [...]` 와 `"pagination": {...}` 을 병렬로 노출한다. 그러나 `swagger.md §5-2` 의 `ApiOkPaginatedResponse` 래퍼 정의와 `swagger.md §2-5`(TransformInterceptor wrap) 를 합산하면 실제 wire 포맷은 `{ "data": { "data": [...], "pagination": {...} } }` 이어야 한다. spec 예시는 외부 `data` 봉투를 생략한 내부 레이어만 표기하고 있어, 클라이언트가 실제 API 응답을 직접 파싱할 때 혼동을 줄 수 있다.
- **제안**: 응답 예시를 `{ "data": { "data": [...], "pagination": {...} } }` 로 정정하거나, "TransformInterceptor 에 의해 최상위 `data` 봉투가 추가된다" 는 주석을 명시해 단계를 구분한다.

---

### [INFO] `PUT` 메서드 사용 — API 규약 §3 에서 `PUT` 사용 금지

- **target 위치**: 라인 438 (`POST /api/executions/:executionId/re-run`) — 이 항목 자체는 POST 이므로 문제없으나, 라인 395–397의 `[⟳ Re-run]` 버튼 행 설명이 `POST` 를 가리키므로 직접 문제는 없음. 그러나 외부 링크인 Re-run spec(`../5-system/13-replay-rerun.md`) 내 PUT 사용 가능성을 이 문서가 내재적으로 전제할 경우를 대비한 INFO.
- **위반 규약**: `spec/5-system/2-api-convention.md §3` — "PUT: 사용하지 않음 (PATCH 선호)"
- **상세**: 본 문서의 API 테이블(라인 434–439)에 기술된 엔드포인트는 GET/POST 만 사용하므로 현재는 직접 위반이 없다. 다만 참조 문서(`Spec Re-run`)로 위임된 `re-run` API 정의에서 PUT 이 사용될 경우 이 spec 이 암묵적으로 그 위반을 수용하는 구조이므로, 참조 일관성을 위해 확인을 권장한다.
- **제안**: 현재 문서 내 직접 수정은 불필요. Re-run spec 검토 시 해당 규약 준수 여부를 별도 확인한다.

---

### [INFO] `## Overview` 섹션 내부에 `---` 구분선이 과도하게 삽입됨

- **target 위치**: 라인 20, 37, 48, 58 (Overview 섹션 내 각 소섹션 사이)
- **위반 규약**: 특정 금지 규약은 없으나 CLAUDE.md 의 "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장" 맥락에서 일관된 서식 유지 권장
- **상세**: Overview 내부의 서브섹션 `### 1. 개요`, `### 2. 페이지 구조`, `### 3. 요구사항` 사이마다 `---` 수평 구분선이 삽입되어 있어 시각적으로 독립 섹션처럼 보이나, 이들은 모두 `## Overview` 아래 종속 내용이다. 본문 H2 섹션 사이의 `---` (라인 239, 402, 403, 510, 520, 531) 와 동일 패턴이어서 계층 구분이 희석된다.
- **제안**: Overview 내 소섹션 간 구분선 제거 또는 목차 스타일(줄바꿈만)로 완화해 H2 경계 구분선과 시각적 위계를 명확히 한다.

---

### [INFO] 요구사항 테이블 `상태` 컬럼에 이모지 사용

- **target 위치**: 라인 78–110 (`### 3.1`, `### 3.2`, `### 3.3` 요구사항 테이블의 `상태` 컬럼 `✅`)
- **위반 규약**: 명시적 금지 규약 없음; 단 본 검토 지침("이모지를 사용하지 말 것") 및 CLAUDE.md spec 문서 서술 톤과의 일관성
- **상세**: 요구사항 테이블에 `✅` 체크마크 이모지가 구현 상태를 표시하는 용도로 사용된다. spec-impl-evidence 프레임워크는 frontmatter `status` 필드로 구현 상태를 기계적으로 추적하므로, 본문 테이블 내 이모지 상태 표시는 중복이며 텍스트 파싱 도구와 diff 에서 노이즈가 된다.
- **제안**: 이모지 대신 텍스트 값(`implemented` / `pending` 등)으로 대체하거나, 구현 완료 spec 에서 상태 컬럼 자체를 제거해 frontmatter 단일 진실 원칙을 강화한다.

---

## 요약

`spec/2-navigation/14-execution-history.md` 는 frontmatter(`id`, `status`, `code:`) 를 정상적으로 구비하고 있으며 `spec/conventions/spec-impl-evidence.md §2` 의 스키마 의무 사항(id/status/code glob ≥1 매치)을 충족한다. 그러나 문서 구조 면에서 `## Overview` 내부에 번호형 소섹션이 중첩되고 본문 H2 에서 같은 번호 체계가 재사용되어 CLAUDE.md 권장 3섹션(Overview / 본문 / Rationale) 분리가 모호해진다(WARNING). 또한 목록 API 응답 예시가 `swagger.md §5-2` 의 `ApiOkPaginatedResponse` 이중 봉투 구조(`{ data: { data: [], pagination: {} } }`)를 생략해 wire 포맷과 불일치한다(WARNING). 나머지 발견사항은 형식 일관성 수준의 INFO 이다. CRITICAL 위반은 없다.

---

## 위험도

**LOW**
