# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 영역: `spec/5-system/` — 주요 검토 파일: `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`

---

## 발견사항

### [INFO] `1-auth.md` — 1.5.4 에러 응답 코드 `lower_snake_case` 사용: 규약 위반이나 historical-artifact 레지스트리에 이미 등재됨

- **target 위치**: `spec/5-system/1-auth.md §1.5.4 에러 응답` 표
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 UPPER_SNAKE_CASE 원칙) + `spec/conventions/node-output.md §3.2` (`code` 는 `UPPER_SNAKE_CASE`)
- **상세**: `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited` 는 UPPER_SNAKE_CASE 규약에서 벗어난 lower_snake_case. 그러나 `1-auth.md §1.5.4` 본문 내 주석과 `error-codes.md §3 historical-artifact 예외 레지스트리`에 이미 명시적으로 등재되어 있으며, 근거도 명확히 기술됨 (v1 출하 정착 + 프론트엔드 code 값 직접 분기 → rename = breaking change §2). 규약이 이 예외를 공식 흡수하고 있으므로 CRITICAL/WARNING 이 아닌 INFO.
- **제안**: 현 상태(레지스트리 등재 + 신규 코드 예외 선례 사용 금지 문구 병기) 유지. 추가 조치 불요.

---

### [INFO] `11-mcp-client.md` — `skipReason` 값이 `lower_snake_case`: 규약 위반이나 본문에 명시적 분리 근거 존재

- **target 위치**: `spec/5-system/11-mcp-client.md §6.2` — `skipReason vocabulary` 표 (`expired_install_timeout`, `expired_refresh_failed`, `expired_no_refresh_token`, `error`, `pending_install`, `lookup_failed`, `not_capable`)
- **위반 규약**: `spec/conventions/node-output.md §3.2` (`code` 는 UPPER_SNAKE_CASE) · `spec/conventions/error-codes.md §1`
- **상세**: `skipReason` 필드 값이 lower_snake_case. 그러나 §6.2 본문에 "본 필드는 에러 코드가 아닌 운영 진단용 enum 이라 `node-output.md` Principle 3.2 의 `code` UPPER_SNAKE_CASE 규약과 구분된다" 고 명시적으로 분리 근거를 제시하며, `Integration.status_reason` 과의 의도적 표기 일치도 설명되어 있음. `skipReason` 은 `output.error.code` 필드가 아니라 진단 메타데이터 필드로 semantic이 다르므로, 규약 §3.2 의 `code` 필드 한정 규칙과 직접 충돌하지는 않는다. 단, 이 결정이 본문에만 내재되어 있고 `error-codes.md §3 historical-artifact 레지스트리`에는 등재되지 않았다.
- **제안**: `skipReason` 이 에러 코드 규약 범위 밖임을 확인. 현 수준 명시로 충분하나, 미래 혼동 방지를 위해 `error-codes.md §3` 에 "진단 메타 enum (`skipReason` 등)은 본 규약 적용 범위 외" 주석 한 줄 추가를 고려할 수 있음. 필수는 아님.

---

### [INFO] `10-graph-rag.md` — 문서 구조가 3섹션 권장 형식과 다소 다름

- **target 위치**: `spec/5-system/10-graph-rag.md` 전체 구조
- **위반 규약**: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- **상세**: `10-graph-rag.md` 는 Overview 섹션 아래 대규모 요구사항·기술 결정 사항·단계별 도입 계획·의존성·미결 항목 표를 포함하는 확장된 PRD 형식으로 Overview 섹션이 매우 방대하다 (§1~§8 본문 포함). CLAUDE.md 권장 3섹션(Overview / 본문 / Rationale)과 비교할 때, Overview 와 본문의 경계가 불분명하며 Rationale 이 별도 H2 섹션으로 존재하나 그 위의 개요 부분(도메인 용어·사용자 결정·결정 근거 요약·비-목표)이 Rationale 성격이면서도 Overview 중첩 구조 안에 있다.
- **제안**: 구현 착수 전 구조 변경은 불필요하나, 향후 문서 리팩토링 시 §1(개요)~§8(비-목표) 를 Overview 외부 본문 섹션으로 분리하고, Rationale 의 도메인 용어/결정 근거를 현재 H2 `## Rationale` 아래로 통합하는 것을 고려. 기능 구현에는 영향 없음.

---

### [INFO] `11-mcp-client.md` — §3.3 `cached_capabilities` 미구현 섹션의 `status: partial` frontmatter 상태와 `pending_plans` 인라인 주석 형태

- **target 위치**: `spec/5-system/11-mcp-client.md §3.3`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `status: partial` 시 `pending_plans:` frontmatter 의무
- **상세**: `11-mcp-client.md` frontmatter는 `status: partial` + `pending_plans: [plan/in-progress/spec-sync-mcp-client-gaps.md]` 를 올바르게 선언하고 있음. 규약 준수 확인됨. 섹션 내 미구현 주석("구현 현황 2026-06-03: 미구현(Planned)")도 pending_plans 추적을 잘 연결하고 있음. 이 항목은 문제가 없어 단순 확인용 INFO.
- **제안**: 현 상태 유지. 이상 없음.

---

### [WARNING] `1-auth.md` — API 엔드포인트 목록(§5)에 응답 포맷이 `{ data: ... }` 래퍼 없이 간혹 plain 형태로 서술됨

- **target 위치**: `spec/5-system/1-auth.md §5 API 엔드포인트` 표, 특히 WebAuthn availability 응답 `{ enabled: boolean }` 표기
- **위반 규약**: `spec/conventions/swagger.md §2-5` — 프로젝트가 `TransformInterceptor` 로 모든 성공 응답을 `{ data: ... }` 로 감쌈. spec §1.4.3 에서는 응답을 `{ data: { enabled: boolean } }` 로 명시하고 있으나, §5 엔드포인트 목록 표에는 `응답: { enabled: boolean }` 로 bare 형태로 기술.
- **상세**: `spec/5-system/1-auth.md §1.4.3` 에서 `/auth/2fa/webauthn/availability` 응답을 `{ data: { enabled: boolean } }` 로 바르게 명시. 그러나 §5 API 엔드포인트 표에서는 `응답: { enabled: boolean }` 로 래퍼 없이 기술해 일관성이 낮다. swagger.md 와 실제 인터셉터 동작 기준에서 래퍼가 있어야 함. 기능 동작에는 영향 없으나 다른 개발자가 §5 만 보면 혼동 가능.
- **제안**: `spec/5-system/1-auth.md §5` 표에서 해당 응답 기술을 `{ data: { enabled: boolean } }` 로 통일하거나, 표 전체에 "응답은 `{ data: <본문> }` 래퍼 포함" 주석을 추가. 구현 착수 전 spec 문서 수정으로 처리 가능.

---

### [INFO] `10-graph-rag.md` — frontmatter `status: implemented` + `code:` glob 확인: 규약 준수

- **target 위치**: `spec/5-system/10-graph-rag.md` frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `status: implemented` 시 `code:` ≥1 매치 의무
- **상세**: frontmatter `status: implemented`, `code:` 에 `codebase/backend/src/modules/knowledge-base/graph/**` 외 다수 glob 이 기재되어 있음. `pending_plans:` 없음(구현 완료 상태에 부합). 규약 준수 확인.
- **제안**: 이상 없음.

---

### [INFO] `1-auth.md` — frontmatter `status: partial` + `pending_plans` 규약 준수 확인

- **target 위치**: `spec/5-system/1-auth.md` frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1 / §3`
- **상세**: `status: partial`, `code:` 다수 glob, `pending_plans: [plan/in-progress/auth-config-webhook-followups.md, plan/in-progress/spec-sync-auth-gaps.md]` 가 적절히 선언됨. `partial` 상태에 `pending_plans` 필수 요건 충족. 규약 준수.
- **제안**: 이상 없음.

---

### [INFO] `11-mcp-client.md` — 문서에 Overview H2 섹션이 없고 §1 개요 형태로 시작

- **target 위치**: `spec/5-system/11-mcp-client.md` 전체 구조
- **위반 규약**: CLAUDE.md "Overview / 본문 / Rationale 3섹션 권장"
- **상세**: `11-mcp-client.md` 는 `## 1. 개요` 로 시작하며 별도 `## Overview` H2 섹션이 없다. CLAUDE.md 의 권장 구조는 `## Overview` (제품 정의/요구사항) → 본문 → `## Rationale` 이나, 본 파일은 이 권장 구조를 따르지 않고 번호 붙은 절 형식으로 구성되어 있다. `10-graph-rag.md` 에는 `## Overview (제품 정의)` 가 있으나 `11-mcp-client.md` 는 미포함. 기능 구현에는 영향 없음.
- **제안**: 필수 아님. 향후 문서 리팩토링 시 `## Overview` 섹션(범위·MVP 제외 등)을 분리하고, 본문(§2~§9)과 Rationale 섹션을 명확히 구조화하는 것을 고려.

---

## 요약

`spec/5-system/` 내 검토된 주요 3개 파일(`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)은 전반적으로 정식 규약과 높은 수준의 정합성을 유지하고 있다. frontmatter 스키마(id/status/code/pending_plans) 는 `spec-impl-evidence.md` 요건을 모두 충족하고 있으며, 에러 코드 규약 예외(invitation_* lower_snake_case)도 `error-codes.md §3 historical-artifact 레지스트리`에 공식 등재되어 있다. 발견된 가장 유의미한 사항은 `1-auth.md §5 API 엔드포인트 목록`에서 응답 포맷 기술이 `{ data: ... }` 래퍼를 누락한 부분이며, 이는 WARNING 수준이다. 문서 구조(3섹션 권장)의 미준수는 두 파일에서 확인되나 모두 INFO 수준이며 기능 구현에 영향을 주지 않는다. 구현 착수를 차단할 CRITICAL 위반은 없다.

## 위험도

LOW
