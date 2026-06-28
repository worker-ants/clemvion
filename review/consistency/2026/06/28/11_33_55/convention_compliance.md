# 정식 규약 준수 검토 결과

**Target**: `spec/5-system/12-webhook.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-06-28

---

## 발견사항

### 1. [WARNING] `AUTH_FAILED` 에러 코드가 `3-error-handling.md §1.7` 카탈로그에 미등재

- **target 위치**: `spec/5-system/12-webhook.md` — WH-SC-04, WH-SC-09, §4 (`인증 실패는 type 무관 단일 401 AUTH_FAILED`), §7 처리 흐름 step 6c·6g
- **위반 규약**: `spec/conventions/error-codes.md §1`(의미 기반 명명), 그리고 `spec/5-system/3-error-handling.md §1.7`(Webhook 수신 에러 코드 공용 카탈로그 가시성)
- **상세**: `3-error-handling.md §1.7`은 Webhook 수신 엔드포인트 전용 에러 코드를 공용 카탈로그 가시성 목적으로 등재하는 절이다. 현재 `§1.7` 표에는 `INVALID_WEBHOOK_PAYLOAD` / `PUBLIC_WEBHOOK_RATE_LIMIT` / `PUBLIC_WEBHOOK_HOURLY_LIMIT` / `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 4개만 있고, `AUTH_FAILED`(401)는 없다. `AUTH_FAILED` 는 webhook spec 에서 인증 실패의 단일 코드로 반복 언급되고 `spec/1-data-model.md` 에서도 참조되는 active 코드임에도 카탈로그 진입점이 없어 트리거 조건이나 `UPPER_SNAKE_CASE` 준수 여부가 한눈에 확인되지 않는다. 그러나 `AUTH_FAILED` 자체의 표기는 `UPPER_SNAKE_CASE` 를 준수하고 있다.
- **제안**: `3-error-handling.md §1.7` 에 `AUTH_FAILED | 401 | 인증 실패(type 무관 단일 응답 — enumeration 방지, WH-SC-04) | 구현` 행을 추가해 카탈로그 가시성을 완성할 것. 또는 webhook spec `§3.1 에러 응답` 표에 `AUTH_FAILED` 코드 열을 명시하고 §1.7 cross-link 를 추가하는 방법도 가능.

---

### 2. [WARNING] 내부 throw `reason` 값(`missing_required` / `coerce_failed`)이 `error-codes.md §4` 내부 전용 코드 등재 패턴을 따르지 않음

- **target 위치**: `spec/5-system/12-webhook.md §5.2` (§5.2 아래 현행 블록 내 note) — `` `reason ∈ missing_required / coerce_failed` ``
- **위반 규약**: `spec/conventions/error-codes.md §4`(내부 전용 분류 코드 — 클라이언트 미노출 구현 내부 명칭) / `spec/conventions/error-codes.md §1`(에러 코드 적용 범위: "프로젝트 전체의 에러 코드 문자열")
- **상세**: `error-codes.md §1`은 적용 범위를 "프로젝트 전체의 에러 코드 문자열"로 명시하며, `UPPER_SNAKE_CASE` 위반 코드는 §3(historical-artifact) 또는 §4(내부 전용 분류)에 명시적으로 등재해야 한다. `missing_required` / `coerce_failed` 는 `GlobalExceptionFilter` 가 폐기하는 내부 throw 레이어 값으로 `§4` 패턴(`LEGACY_TO_NORMALIZED` 정규화, `output.error.details.legacyCode` 보존 등)과 유사하지만, 해당 코드들은 `error-codes.md §4` 에 등재되지 않았다. 현행 §5.2 note 가 "클라이언트로 surface 되지 않는다"고 명시하므로 내부 전용 성격은 독자에게 전달되지만, `error-codes.md §4` 구조에 따른 공식 등재가 없어 컨벤션과의 정합이 명시적으로 입증되지 않는다.
- **제안**: `error-codes.md §4` 에 `missing_required` / `coerce_failed` 를 내부 분류 코드 행으로 추가하고 `→ (Planned) MISSING_REQUIRED_FIELD / TYPE_COERCION_FAILED` 로 정규화될 대상임을 표기. 또는 현행 §5.2 note 에 "이 값들은 `error-codes.md §4` 의 내부 전용 분류 코드이며 클라이언트로 surface 되지 않는다"는 명시적 안내를 추가하는 형태도 규약과의 거리를 줄인다.

---

### 3. [INFO] `§5.2` 목표 JSON 예시의 `error.details[].code` 명명이 `UPPER_SNAKE_CASE` 규약을 준수함을 재확인 (양호)

- **target 위치**: `spec/5-system/12-webhook.md §5.2` 목표 (Planned) JSON 블록
- **위반 규약**: 없음 — `MISSING_REQUIRED_FIELD` / `TYPE_COERCION_FAILED` 는 `error-codes.md §1`의 `UPPER_SNAKE_CASE` 및 의미 기반 명명을 올바르게 따른다.
- **상세**: Planned 단계 코드이므로 아직 `error-codes.md §4(historical-artifact)` 나 `3-error-handling.md §1.7` note 에 반영이 필요하지만(→ 발견사항 2), 명명 자체는 규약 준수.
- **제안**: 별도 조치 불필요. 구현 PR 시 `3-error-handling.md §1.7` note 를 `(Planned)` → `구현` 으로 업그레이드하면 충분.

---

### 4. [INFO] 문서 구조 — Overview 내 하위 절 번호와 본문 절 번호가 충돌할 수 있음

- **target 위치**: `spec/5-system/12-webhook.md` — `## Overview` 아래 `### 1. 개요` / `### 2. 사용 시나리오` / `### 3. 요구사항` / `### 4. 비기능 요구사항`, 본문 `## 1. 아키텍처 개요` / `## 2. 데이터 모델` 등
- **위반 규약**: `CLAUDE.md` / `.claude/skills/project-planner/SKILL.md §Spec 문서 구조` — "Overview / 본문 / Rationale 3섹션 권장"
- **상세**: 3섹션 구조는 준수되어 있다. 단 `## Overview` 내부에 `### 1~4` 번호를 두고 본문에 `## 1~10` 번호를 두어 `## 1.`이 두 번 나타난다(Overview 의 `### 1. 개요` vs 본문 `## 1. 아키텍처 개요`). Anchor URL 충돌(`#1-개요` vs `#1-아키텍처-개요`)은 문자열이 달라 실제 충돌은 없으나, 독자가 목차를 보면 "1번이 두 개"로 혼란스러울 수 있다. 컨벤션 직접 위반은 아니나 가독성 제안.
- **제안**: Overview 내 하위 절을 번호 없이 `### 개요` / `### 사용 시나리오` 등으로 표기하거나, 본문 절 번호를 Overview 개수만큼 오프셋하는 방법(예: `## 5. 아키텍처 개요`~) 중 하나를 선택하면 일관성이 높아진다. 단 이는 규약 직접 위반이 아닌 형식 제안이다.

---

### 5. [INFO] `§5.2` 내 `error-handling §1.6` 참조가 `§1.7`을 의도했는가 확인 필요

- **target 위치**: `spec/5-system/12-webhook.md §5.2` 목표 블록 — `도메인 특화 400 override 는 [error-handling §1.6](./3-error-handling.md#16-eia-rest-외부-표면-에러-코드-도메인-spec-참조) 선례`
- **위반 규약**: 없음 (기술 정확성 확인 제안)
- **상세**: §1.6 은 EIA REST 외부 표면 에러 코드 절로 "API 규약 기본값을 의도적으로 override" 하는 선례를 담고 있어 논리적으로 맞다. Webhook 도메인 특화 override 의 **가장 직접적인 선례**는 §1.7 자체(`INVALID_WEBHOOK_PAYLOAD` 가 이미 `VALIDATION_ERROR` override 로 등재)이므로 §1.6 → §1.7 로 바꿔도 무방하나, §1.6 참조도 틀리지 않는다.
- **제안**: 큰 문제 없음. 명확성을 위해 `§1.6 (EIA 선례) 및 §1.7 (webhook 자체 선례)` 로 두 곳을 같이 참조하는 것도 가능하나 선택사항.

---

## 요약

`spec/5-system/12-webhook.md` 는 frontmatter 스키마(`id`/`status: partial`/`code:`/`pending_plans:`)를 `spec-impl-evidence.md` 요건에 맞게 작성했고, 문서 3섹션(Overview / 본문 / Rationale) 구조를 갖추었다. 공용 에러 코드 명명은 대체로 `UPPER_SNAKE_CASE`를 따른다. 주요 지적 사항은 두 가지다: (1) `AUTH_FAILED`(401)가 `spec/5-system/3-error-handling.md §1.7` 공용 카탈로그에 미등재되어 있어 카탈로그 가시성 규약과의 거리가 있고, (2) 내부 throw의 `reason` 값(`missing_required`/`coerce_failed`)이 `spec/conventions/error-codes.md §4` 내부 전용 코드 등재 패턴에 따라 공식적으로 등재되지 않아 컨벤션 정합이 명시적으로 입증되지 않는다. 두 항 모두 규약 직접 위반이라기보다 카탈로그 동기화 누락에 해당하며, 기존 plan(`spec-sync-webhook-gaps.md`)에서 관련 내용을 추적 중인 것과 연계해 처리할 수 있다.

---

## 위험도

**LOW**
