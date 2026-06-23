# 정식 규약 준수 검토 결과

검토 범위: `spec/2-navigation` (전체 파일) + `spec/conventions/audit-actions.md` + `spec/conventions/cafe24-api-catalog/` 관련 파일  
검토 기준: `spec/conventions/` 하위 정식 규약 (error-codes, swagger, spec-impl-evidence, audit-actions, cafe24-api-catalog/_overview)

---

## 발견사항

### [INFO] `spec/2-navigation/14-execution-history.md` — 문서 구조 섹션명 비표준
- **target 위치**: `14-execution-history.md` 본문 상단, `## Overview (제품 정의)` 섹션
- **위반 규약**: CLAUDE.md 문서 구조 규약 — "Overview / 본문 / Rationale 3섹션 권장". `_product-overview.md` 외 개별 spec 의 진입 섹션 헤더는 관행상 섹션 번호형(`## 1. 개요`)이거나 헤더 없이 본문으로 시작하며, `## Overview (제품 정의)` 형식은 타 파일(`0-dashboard.md` §1·`10-auth-flow.md` §1 등)과 일치하지 않는다.
- **상세**: `14-execution-history.md` 만 섹션 제목이 `## Overview (제품 정의)` 이고, 이하 `## 1. 개요` 가 따로 존재해 두 개의 "개요 성격" 섹션이 공존한다. 다른 `spec/2-navigation` 파일들은 Overview 없이 `## 1.` 번호 섹션으로 시작하거나 첫 섹션에 짧은 개요를 담는다. 이 문서만 PRD-레벨 요구사항 표(`EH-LIST-*`, `EH-DETAIL-*`, `EH-NAV-*`)를 Overview 블록에 포함하는 구조다.
- **제안**: Overview 섹션을 `_product-overview.md` 로 분리하거나, 요구사항 표를 `## 1. 개요` 본문에 통합해 타 파일과 구조를 일치시킨다. 기능 spec 파일에서 PRD 요구사항 표를 직접 포함하는 것은 단일 진실 원칙(CLAUDE.md) 위반 소지가 있다(PRD 위치: `spec/<영역>/_product-overview.md`).

---

### [INFO] `spec/2-navigation/15-system-status.md` — `## 1.` 이전 Overview 섹션 없음 (단락 바로 시작)
- **target 위치**: `15-system-status.md` frontmatter 직후 본문
- **위반 규약**: CLAUDE.md 문서 구조 — "Overview / 본문 / Rationale 3섹션 권장"
- **상세**: 타 파일은 `## 1.` 이전에 짧은 개요 단락이 있으나, `15-system-status.md` 는 frontmatter 직후 단락 서술 없이 `## 1. 화면 구조` 로 시작한다 (2줄짜리 설명 문단이 헤딩 없이 삽입됨). 규약이 강제하는 것은 아니나 일관성 측면 지적.
- **제안**: 다른 파일 패턴처럼 `## 1.` 전에 `## 개요` 또는 한 줄 설명 단락을 추가한다. 현재 두 줄짜리 헤딩없는 문단이 사실상 그 역할을 하나 명시적이지 않다.

---

### [INFO] `spec/2-navigation/16-agent-memory.md` — `id` 가 basename 과 불일치하나 기존 규약 예외 적용
- **target 위치**: `16-agent-memory.md` frontmatter `id: nav-agent-memory`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "파일 basename 기반 권장. 같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다"
- **상세**: `spec/5-system/17-agent-memory.md` 가 `agent-memory` id 를 점유하므로 `spec/2-navigation/16-agent-memory.md` 가 `nav-agent-memory` 를 사용하는 것은 spec-impl-evidence §2.1 의 명시적 예외 패턴(`basename 불일치처럼 보여도 의도된 패턴`)에 해당한다. 위반이 아님.
- **제안**: 현 상태 유지. 규약에 명시된 의도적 패턴.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application/apps.md` — `## 응답 (Response)` 헤딩 레벨 비일치
- **target 위치**: `application/apps.md` `#### 응답 (Response)` 섹션
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.2` — "응답 파라미터 표" + "응답 예시(JSON)" 구성 정의. 헤딩 레벨 자체는 규약에 명시되지 않으나 operation 헤딩이 `###` 인데 응답이 `####` 인 구조는 규약 §7.2 의 "Operations" 아래 응답 소절 위치를 따른다.
- **상세**: `apps.md` 의 `#### 응답 (Response)` 섹션에 JSON 샘플이 truncated(`... (truncated due to size limit)`)된 채 포함되었다. 이는 프롬프트 payload 의 용량 제한 아티팩트이므로 실제 파일 내용이 규약을 어기는 것으로 단정할 수 없다.
- **제안**: 실제 파일에서 JSON 응답 예시 존재 여부만 확인. 생성기 산출물이므로 `_generator.py` 재실행으로 보정 가능.

---

### [WARNING] `spec/2-navigation/10-auth-flow.md` §5.4 — `error=` redirect query param 코드 표기가 `lower_snake_case` 이고 `historical-artifact` 레지스트리 참조만 있음
- **target 위치**: `10-auth-flow.md §5.4 OAuth 에러 처리` — `invalid_state`, `token_exchange_failed`, `email_required`, `server_error`
- **위반 규약**: `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리` — 이들 코드는 이미 레지스트리에 등재되어 있어 "위반" 이 아니라 명시적 예외다.
- **상세**: `10-auth-flow.md §5.4` 의 인라인 주석(`lower_snake_case` + historical-artifact 레지스트리 등재 언급)이 `error-codes.md §3` 과 상호 참조가 정확히 맞는다. 규약 위반 없음.
- **제안**: 현 상태 유지. 레지스트리 등재 근거(`10-auth-flow.md §5.4` 참조)도 `error-codes.md §3` 표 `근거` 컬럼에 명시되어 있다.

---

### [WARNING] `spec/conventions/cafe24-api-catalog/_overview.md` §5 — Coverage Matrix 숫자 수동 갱신 규약 검증 불가
- **target 위치**: `_overview.md §5 Coverage Matrix` 표
- **위반 규약**: `_overview.md §6` — "row 추가/삭제 시 본 표도 손으로 갱신한다"
- **상세**: Coverage Matrix 의 `application` resource 는 `Supported: 19` 로 표기되어 있고, `application.md` 의 표 row 를 직접 세면 19개(`applications_list`, `scripttags_list`, `webhooks_list`, `apps_update`, `appstore_orders_get`, `appstore_orders_create`, `appstore_payments_list`, `appstore_payments_count`, `databridge_logs_list`, `recipes_list`, `recipes_create`, `recipes_delete`, `scripttags_count`, `scripttags_get`, `scripttags_create`, `scripttags_update`, `scripttags_delete`, `webhooks_logs_list`, `webhooks_update`)로 일치한다. 본 검토 범위에서 application 카탈로그는 정합.
- **제안**: 다른 resource(prompt payload 에 포함되지 않은 파일)에 대한 카운트 정합성은 본 검토 범위 밖. 구현 변경 시 `catalog-sync.spec.ts` 가 row ↔ 메타데이터를 검증하지만 Coverage Matrix 카운트 자체는 테스트 대상이 아니므로 수동 갱신 의무 위반 가능성이 상시 존재한다.

---

### [CRITICAL] `spec/conventions/cafe24-api-catalog/application.md` — `applications_list`·`webhooks_list` docs 부재 seed row 처리 규약 준수 여부
- **target 위치**: `application.md` 표 내 `applications_list`·`webhooks_list` row, 하단 ⚠ 주석
- **위반 규약**: `_overview.md §3 status enum` — `supported` 는 "노드에서 호출 가능 = 메타데이터 row 존재"를 의미. `§2 표 컬럼 정의 docs` — "✓ 필수" 이나 planned 시 `?` 허용.
- **상세**: 두 row 는 `status: supported` 임에도 Cafe24 공식 docs(Latest 2026-03-01)에 해당 endpoint 가 없다고 명시되어 있다. `_overview.md §2` 의 `docs` 컬럼은 "supported 시 ✓(필수)"인데, 두 row 의 docs 링크가 잠정적임이 ⚠ 주석으로 명시되어 있다. 이는 `status: supported` + docs 미검증 조합이 규약상 허용되지 않는 상태다. 다만 파일 자체에 ⚠ 주석으로 명시·추적 플랜(`cafe24-backlog-residual.md §G-2`)이 연결되어 있어, 인지된 예외이지 숨겨진 위반은 아니다. 그러나 `_overview.md` 어디에도 "docs 미검증 supported" 를 허용하는 escape hatch 가 없으므로 규약 직접 위반이다.
- **제안**: 두 row 의 `status` 를 `planned` 로 강등하거나, `_overview.md §3` 에 "backwards-compat seed" 예외를 명시하는 항목을 추가한다. 또는 `G-2` 플랜 완료 시 검증 후 다시 `supported` 로 승격한다.

---

### [INFO] `spec/conventions/audit-actions.md` — `model_config.reveal` 부재 설명이 각주에만 있고 본문 레지스트리 표에 미반영
- **target 위치**: `audit-actions.md §3 도메인별 분류 레지스트리` 표 — `model_config` row
- **위반 규약**: `audit-actions.md §3` 자체 — 표 가독성 규약.
- **상세**: `model_config` row 아래 각주(>)에 "`model_config` 에 `reveal` 이 없는 것은 …" 설명이 있으나, `auth_config` 는 같은 표에 `reveal` 이 있어 비교 시 `model_config.reveal` 이 의도적으로 제외됐음이 표 자체로는 명확하지 않다. 규약에서 명시 금지한 사항은 아니나 가독성 감점 요인.
- **제안**: 현 각주 설명은 충분한 문서화다. 현 상태 유지.

---

### [INFO] `spec/2-navigation/1-workflow-list.md` — `status: partial` 인데 `pending_plans` 의 플랜 파일 유효성은 본 검토 범위 밖
- **target 위치**: `1-workflow-list.md` frontmatter `status: partial`, `pending_plans: [plan/in-progress/spec-sync-workflow-list-gaps.md]`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `partial` 은 `pending_plans` 의무. `§4 spec-pending-plan-existence.test.ts` 가 실존을 강제.
- **상세**: frontmatter 구조는 규약을 따른다. 플랜 파일의 실존 여부는 빌드 가드(`spec-pending-plan-existence.test.ts`)가 검증하므로 본 검토에서는 구조적 준수만 확인.
- **제안**: 현 상태 유지 — 빌드 가드 통과 여부가 최종 판정.

---

## 요약

`spec/2-navigation` 의 파일들은 전반적으로 frontmatter 스키마(`id`/`status`/`code`/`pending_plans`) · Rationale 섹션 · 문서 간 참조 · 에러 코드 표기(historical-artifact 등재 포함) 측면에서 정식 규약을 준수하고 있다. 주목할 위반은 `spec/conventions/cafe24-api-catalog/application.md` 에서 Cafe24 공식 docs 에 없는 두 endpoint(`applications_list`·`webhooks_list`)를 `status: supported` 로 유지하는 것인데, 이는 `_overview.md §2`의 "supported 시 docs 필수" 규약과 직접 충돌한다. `14-execution-history.md` 의 이중 개요 구조(Overview 섹션 + §1. 개요)는 다른 파일과의 구조 일관성 측면에서 경미한 개선 여지가 있다. 나머지 발견사항은 의도된 예외(nav-agent-memory id, historical-artifact 코드 등)이거나 사소한 형식 제안이다.

## 위험도

LOW
