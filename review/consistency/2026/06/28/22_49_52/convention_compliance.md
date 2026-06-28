# 정식 규약 준수 검토 — spec/5-system/

검토 모드: impl-done (diff-base=origin/main)
검토 대상: `spec/5-system/` 전체

> 주의: 이번 PR(`webhook-maint-backlog-f14768`)의 diff 에서 `spec/5-system/` 파일 변경은 0건이다 (변경은 `codebase/backend/` 전용). 따라서 본 검토는 현재 HEAD 워킹트리의 `spec/5-system/` 문서 전체를 정식 규약 기준으로 점검한다.

---

## 발견사항

### [INFO] `spec/5-system/16-system-status-api.md` — `## Overview` 섹션 부재
- **target 위치**: `spec/5-system/16-system-status-api.md` 전체 (첫 섹션이 `## 1. 대상 큐 레지스트리`)
- **위반 규약**: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- **상세**: 문서가 첫 번째 본문 섹션(`## 1.`)으로 직접 시작하며 `## Overview` 또는 제품 정의 섹션이 없다. 다른 유사 문서(`12-webhook.md`, `10-graph-rag.md`, `9-rag-search.md` 등)는 `## Overview (제품 정의)` 또는 `## Overview` 를 상단에 두어 문서의 "무엇을 정의하는가" 를 명확히 한다. 짧은 서문 산문(11행)이 제목 바로 아래 있으나 `## Overview` 헤딩이 없어 구조 탐색이 비일관하다.
- **제안**: 상단 산문을 `## Overview` 헤딩 아래로 이동. 규약은 "권장"이므로 강제 수정 의무는 없으나 일관성 향상 차원에서 추가를 고려한다.

---

### [INFO] `spec/5-system/5-expression-language.md`, `6-websocket-protocol.md`, `7-llm-client.md`, `11-mcp-client.md`, `2-api-convention.md` — `## Overview` 헤딩 대신 번호형 섹션 직접 시작
- **target 위치**: 각 파일 첫 번째 `## 1.` 섹션
- **위반 규약**: CLAUDE.md "Overview / 본문 / Rationale 3섹션 권장"
- **상세**: 해당 5개 파일은 `## 1. 개요` 또는 `## 1. 기본 원칙` 등 번호형 섹션으로 바로 시작하며 `## Overview` 레벨 헤딩이 없다. 이는 `## 1. 개요`가 사실상 Overview 역할을 하는 일반적인 패턴으로, 기능적으로 동등하다. 다만 구조 탐색 도구(헤딩 리스트)에서 `## Overview` 와 `## 1. 개요`가 혼재하면 일관성이 떨어진다.
- **제안**: 순수 INFO — 규약이 "권장"이므로 즉시 수정 의무 없음. 다음 번 해당 파일을 수정할 때 `## Overview` 섹션을 도입하는 것을 고려한다.

---

### [INFO] `spec/5-system/1-auth.md §1.5.4` — 에러 코드 `lower_snake_case` (historical-artifact 등재 확인)
- **target 위치**: `spec/5-system/1-auth.md §1.5.4 에러 응답` 표 (`invitation_not_found`, `invitation_expired` 등)
- **위반 규약**: `spec/conventions/error-codes.md §1` UPPER_SNAKE_CASE 원칙
- **상세**: 초대 API 에러 코드 6종(`invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited`)이 lowercase 다. 이는 규약 표면상 위반이다.
- **해소 근거**: `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리`에 명시적으로 등재되어 있으며, `spec/5-system/1-auth.md §1.5.4` 주석도 해당 레지스트리 참조와 함께 "초대 API 한정 예외" 를 명확히 기술한다. 규약 메커니즘 내에서 올바르게 처리된 상태이므로 추가 조치 불필요. 표준 위반이 아니라 **규약이 인정한 예외**다.
- **제안**: 현 상태 유지. 신규 코드는 이 예외를 선례로 삼지 않아야 하며, 이 점도 `1-auth.md §1.5.4` 주석에 이미 명시되어 있다.

---

### [INFO] `spec/5-system/1-auth.md §4.1` — `lower_snake_case` 에러 코드 레지스트리 2026-06-28 결정 신규 등재 완료 확인
- **target 위치**: `spec/5-system/1-auth.md §1.5.4` 주석 하단 ("`workspace_type_mismatch`·`already_a_member`·…"를 다루는 단락)
- **위반 규약**: `spec/conventions/error-codes.md §1` (UPPER_SNAKE_CASE)
- **상세**: `workspace_type_mismatch`, `already_a_member`, `invitation_already_pending`, `invitation_already_accepted`, `workspace_not_found`, `user_not_found`, `admin_required` 7종이 `1-auth.md §1.5.4` 주석에 언급된다. 이들도 `lower_snake_case` 이나 `error-codes.md §3` 에 2026-06-28 결정으로 신규 등재되어 있음을 확인하였다.
- **해소 근거**: `error-codes.md §3` 레지스트리에 명시적으로 포함됨. 규약 예외로 올바르게 처리됨. 추가 조치 불필요.
- **제안**: 현 상태 유지.

---

### [INFO] `spec/5-system/12-webhook.md §5.2` — `details[].code` 내부 분류 코드와 public 코드 구분 명확화
- **target 위치**: `spec/5-system/12-webhook.md §5.2 400 응답 형식`
- **위반 규약**: `spec/conventions/error-codes.md §4` (내부 전용 분류 코드는 클라이언트 미노출)
- **상세**: §5.2 본문이 `details[].code` 값으로 `MISSING_REQUIRED_FIELD` / `TYPE_COERCION_FAILED` / `INVALID_SCHEMA` 를 제시하며, 내부 분류 문자열(`missing_required`/`coerce_failed`/`invalid_schema`)은 `toTriggerParameterErrorDetails` 가 정규화한다고 설명한다. 정규화 후 public 코드는 `UPPER_SNAKE_CASE` 로 규약을 준수한다. 단 `error-codes.md §4`와 같이 "내부 분류 코드 → 정규화 후 public 코드" 패턴을 별도 명시 항목으로 등재하지 않은 채 §5.2 본문에만 설명한다.
- **평가**: 실질적인 규약 위반은 없다. public 코드(`MISSING_REQUIRED_FIELD` 등)는 `UPPER_SNAKE_CASE` 이고 클라이언트에 노출된다. 내부 분류 문자열은 wire 에 나오지 않는다. 단 `error-codes.md §1·§4` 카탈로그에 이 도메인 코드들이 등재되지 않았다. `error-handling.md §1.7` 이 카탈로그 SoT 임을 §5.2 가 명시하므로 역할 분리는 적절하다.
- **제안**: 현 상태 유지 (위반 없음, 역할 분리 명시). 향후 코드 추가 시 `error-handling.md §1.7` 카탈로그를 동기 갱신하는 것이 관례에 맞다.

---

### [INFO] `spec/5-system/12-webhook.md §1 아키텍처 다이어그램` — 처리 흐름 표기의 순서 코멘트
- **target 위치**: `spec/5-system/12-webhook.md §1 아키텍처 개요` 다이어그램 주석 vs `§7 처리 흐름 step 5`
- **위반 규약**: 없음 (일관성 INFO)
- **상세**: `§1` 아키텍처 다이어그램 아래 주석("chatChannel 분기가 isActive 검사보다 선행")과 `§7` step 5 의 서술이 동일 내용을 양쪽에서 설명한다. 중복 설명은 spec 단일 진실 원칙과 미세하게 어긋난다.
- **제안**: 중복이 최소화되도록 `§1` 주석에는 §7 포인터만 두는 방향을 고려. 단 양쪽이 서로 일치하고 있으므로 즉각 수정 의무 없음.

---

## 요약

`spec/5-system/` 전체 문서는 정식 규약을 실질적으로 준수하고 있다. 에러 코드 `lower_snake_case` 예외는 `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 올바르게 등재되어 있고, 각 문서는 `spec/conventions/audit-actions.md` 의 `<resource>.<verb>` 구조·시제 규약을 준수한다. 발견된 사항은 모두 INFO 등급으로, `## Overview` 헤딩 미사용(대신 `## 1. 개요` 형태 사용) 및 동일 주의사항의 이중 설명 등 형식 일관성 차원의 관찰이다. 규약을 직접 위반하거나 다른 시스템의 invariant 를 깨는 CRITICAL·WARNING 사항은 발견되지 않았다.

## 위험도

NONE
