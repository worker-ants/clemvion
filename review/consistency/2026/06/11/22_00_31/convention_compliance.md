# 정식 규약 준수 검토 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done, scope=spec/5-system, diff-base=origin/main)
**검토 대상**: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`

---

## 발견사항

### [WARNING] Planned 감사 액션 `password_change`, `2fa_enable/disable` 이 resource.verb 규약에 불일치

- **target 위치**: `spec/5-system/1-auth.md` §4.1 Planned 액션 표, line 364
  ```
  | 인증 (워크스페이스 컨텍스트) | password_change, 2fa_enable/disable |
  ```
- **위반 규약**: `spec/5-system/1-auth.md §4.1` 자체가 선언한 Action naming 규약 — `<resource>.<verb>` (resource dot-prefix 필수). 동일 문서 §4.1 첫 단락에 "resource dot-prefix 가 필수다"라고 명시되어 있다.
- **상세**: `password_change`, `2fa_enable`, `2fa_disable` 은 resource prefix 없이 flat verb 형식으로 기재되어 있다. 동일 표 안의 구현된 액션(`integration.created`, `auth_config.create`, `execution.re_run`, `workspace.transfer_ownership`)은 모두 `<resource>.<verb>` 형식을 따른다. Planned 항목만 규약을 벗어난 표기를 사용해 실제 구현 시점에 AUDIT_ACTIONS 에 어떤 이름으로 추가해야 하는지 모호하다.
- **제안**: `auth.password_change`, `auth.2fa_enable`, `auth.2fa_disable` (또는 `user.password_change`, `user.2fa_enable` 등 도메인에 맞는 resource prefix) 로 명시. `2fa_enable/disable` 슬래시 병기도 두 개의 독립 액션임을 명확히 하려면 별행으로 분리하는 것이 좋다.

---

### [WARNING] `spec/5-system/11-mcp-client.md` 가 `## Rationale` 최상위 섹션을 갖지 않음

- **target 위치**: `spec/5-system/11-mcp-client.md` 전체 구조 — `## 1. 개요` ... `## 12. 확장 포인트` 로 종결되며 `## Rationale` 섹션이 없다.
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장. 관련 SKILL.md 에서 "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 로 둔다고 명시되어 있다.
- **상세**: 설계 근거가 본문 섹션 내 인라인 blockquote(`> 사유:`)나 `> Internal Bridge 예외…` 형태로 산재해 있다. 다른 spec 파일(`spec/5-system/1-auth.md`의 `## Rationale`, `spec/5-system/10-graph-rag.md`의 `## Rationale`)은 최상위 섹션으로 분리한다. 동일 영역 내 문서 간 구조 불일치가 발생한다.
- **제안**: `## 12. 확장 포인트` 다음에 `## Rationale` 섹션을 신설하고, 본문에 인라인으로 흩어진 설계 근거(stdio 미지원, 평탄화 모델 채택, Internal Bridge 도입 이유 등)를 이관. 본문에 남은 짧은 근거 언급은 `(Rationale §<소절명> 참고)` 형태의 역참조로 대체.

---

### [INFO] `spec/5-system/10-graph-rag.md` — `## Overview (제품 정의)` 뒤에 `---` 구분자로 분리된 `### 1. 목표` 가 있어 Overview 영역의 경계가 불명확

- **target 위치**: `spec/5-system/10-graph-rag.md` lines 649–665 (Overview 섹션 내부에 `### 1. 목표`, `### 2. 범위` 등 본문 절이 중첩)
- **위반 규약**: CLAUDE.md 명명 규약 — "제품 정의·요구사항" 은 `_product-overview.md` 또는 진입 문서의 `## Overview` 에, 기술 명세는 본문에 두는 구분. Overview 절이 기술 상세(요구사항 표·비기능 요구사항·Phase Plan·의존성·미결 항목)를 통째로 품고 있어 Overview / 본문 분리 원칙이 흐릿하다.
- **상세**: 본 문서의 `## Overview (제품 정의)` 는 실질적으로 요구사항 명세(`KB-GR-*` ID 표), Phase Plan, 의존성, 미결 항목까지 포함한다. 이어지는 `## 1. 개요`(기술 개요)부터가 진짜 본문 섹션이다. 두 레이어가 역할 없이 중첩되어 있다.
- **제안**: Overview 섹션을 제품 관점 목표/범위 요약으로 압축하고, 기술 요구사항(`KB-GR-*` 표)·Phase Plan·의존성·미결은 본문 섹션(번호 매긴 `##`)으로 이동하거나 현재 `## 1. 개요`와 병합. 또는 현재 구조가 이 문서의 의도라면 `_product-overview.md` 대신 단일 파일로 통합하는 현 패턴을 Rationale에 명시해 의도를 선언.

---

### [INFO] `spec/5-system/1-auth.md` — `## Overview` 최상위 섹션 없음

- **target 위치**: `spec/5-system/1-auth.md` 최상위 구조 — `## 1. 인증`으로 바로 시작
- **위반 규약**: CLAUDE.md 권장 3섹션 (Overview / 본문 / Rationale). `spec/5-system/10-graph-rag.md`는 `## Overview (제품 정의)` 섹션을 보유한다.
- **상세**: `## Rationale`은 있으나 `## Overview` 가 없어 3섹션 권장 패턴 중 한 섹션이 누락되어 있다. 제품 정의·시스템 전체 개요가 본문 내 도입부로 암묵적으로 처리되고 있다.
- **제안**: `## Overview` 또는 `## 개요` 섹션을 추가하거나, 이 문서는 기술 명세 위주라 Overview 생략이 의도적이면 SKILL.md 혹은 spec 문서 자체에 그 선택을 주석으로 명시. 규약 갱신이 적절하다면 "기술 명세 중심 문서는 Overview 생략 가능" 을 SKILL.md에 추가한다.

---

### [INFO] `skipReason` `lower_snake_case` 사용 — 규약과 구분된다는 선언이 spec에 있으나 외부 관찰자에게 혼동 가능

- **target 위치**: `spec/5-system/11-mcp-client.md` §6.2 (mcpDiagnostics skipReason vocabulary) 관련 명명 규칙 설명
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 — `output.error.code` 는 `UPPER_SNAKE_CASE`. `spec/conventions/error-codes.md §1` 동일.
- **상세**: spec 본문이 이미 "skipReason 은 에러 코드가 아닌 운영 진단 enum 이라 `lower_snake_case`"라고 명시적으로 구분을 선언하고 있다. 이는 규약 위반이 아니라 의도적 구분이다. 다만 `error-codes.md §3 historical-artifact 레지스트리`에 등재되어 있지 않아 외부 일관성 검토자가 위반으로 혼동할 가능성이 있다.
- **제안**: `skipReason` vocabulary 가 error code 체계와 별개임을 `error-codes.md §3` 주석에 한 줄 추가해 두거나, `spec/5-system/11-mcp-client.md` 의 현재 설명("규약 분리" 근거)을 `## Rationale` 섹션에 이관하면 구조적으로 명확해진다. 현재 상태 자체가 규약 위반은 아니므로 INFO 등급.

---

## 요약

`spec/5-system` 세 문서는 frontmatter(`id`/`status`/`code`/`pending_plans`)가 `spec/conventions/spec-impl-evidence.md` 의 스키마를 준수하고, 에러 코드는 `UPPER_SNAKE_CASE` 를 따르며 historical-artifact 는 `error-codes.md §3` 에 정식 등재되어 있다. MCP 에러 코드(`MCP_*`) 명명도 `node-output.md Principle 3.2` 를 따른다. 주요 문제는 (1) `spec/5-system/1-auth.md §4.1` 의 Planned 감사 액션 `password_change`·`2fa_enable/disable`이 동일 문서가 선언한 `<resource>.<verb>` 규약을 따르지 않아 구현 시 모호성을 유발한다는 점(WARNING), (2) `spec/5-system/11-mcp-client.md` 에 `## Rationale` 최상위 섹션이 없어 동일 영역 내 문서 구조 불일치가 발생한다는 점(WARNING)이다. `spec/5-system/10-graph-rag.md` 의 Overview/본문 경계 불명확(INFO)과 `spec/5-system/1-auth.md` 의 `## Overview` 누락(INFO)은 사소한 형식 일관성 문제다.

## 위험도

LOW
