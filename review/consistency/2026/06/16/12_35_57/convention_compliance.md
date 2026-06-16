# Convention Compliance Review — `spec/2-navigation/6-config.md`

검토 모드: spec draft (--spec)
검토 일시: 2026-06-16

---

## 발견사항

### [INFO] audit_log action 표기가 audit-actions 규약과 형식 불일치
- target 위치: `§A.4 Reveal 흐름` 5번 항목 — `action='auth_config.reveal'`
- 위반 규약: `spec/conventions/audit-actions.md §3 도메인별 분류 레지스트리`
- 상세: 규약 레지스트리는 `auth_config | 현재형 (§2.2) | create, update, delete, regenerate, reveal` 으로 등재돼 있으며 resource 토큰은 `auth_config`(언더스코어)다. spec 본문의 `action='auth_config.reveal'` 은 토큰 자체는 맞으나, 큰따옴표 없이 등호 표기(`=`)를 쓰고 있어 다른 spec 파일들의 인라인 code-span 표기(`'auth_config.reveal'`, \`auth_config.reveal\`) 와 미미하게 스타일이 다르다. 기능적 위반은 아니나 형식 일관성 개선 여지가 있다.
- 제안: `action='auth_config.reveal'` → `` `auth_config.reveal` `` (backtick code-span) 로 통일. 규약 갱신 불필요.

---

### [INFO] `## 3. API` 섹션 제목 번호 접두어가 문서 구조와 혼재
- target 위치: `## 3. API` (line 252)
- 위반 규약: `CLAUDE.md §정보 저장 위치` — spec 문서 3섹션 권장 구성은 Overview / 본문 / Rationale. 본문 내 절 번호 규약은 별도 명시 없으나, 동 파일 내 Part A/B 절은 `###`/`####` 알파벳 체계를 쓰는 반면 API 절만 `## 3. API` 와 같이 숫자 prefix 를 쓰고 있어 스타일이 혼재된다.
- 제안: `## API` 또는 `## Part C: API` 로 통일하거나, Part A/B 와 동급 구성임을 명시. 규약에서 절 번호 형식을 강제하지는 않으므로 INFO 등급.

---

### [INFO] `spec/conventions/spec-impl-evidence.md` — `id` 값이 파일 basename 과 일치하나 충돌 위험 검토 불필요 확인
- target 위치: frontmatter `id: config`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — id 는 파일 basename 기반 권장, 같은 basename 이 영역을 달리해 중복될 때 후발 문서가 prefix 로 충돌 회피
- 상세: `id: config` 는 파일명 `6-config.md` (basename `6-config`) 와 완전 일치하지 않는다 (`6-` prefix 없음). 이는 스펙-구현 증거 규약의 "파일 basename(확장자 제외) 기반 권장"의 정확한 해석에 따라 `config` (숫자 prefix 제거)도 관례로 수용 가능하나, 다른 영역에 `config` id 를 쓰는 spec 파일이 생길 경우 충돌 회피가 필요하다. 현재 충돌은 없어 실제 위반은 아님.
- 제안: 현 상태 유지 가능. 향후 다른 영역에 동명 spec 이 생기면 `nav-config` 등으로 구분. 규약 갱신 불필요.

---

### [WARNING] `§A.4 Reveal 흐름` — `FORBIDDEN` 에러 코드 표기가 대문자이나 본문에서는 소문자 혼용
- target 위치: `§A.4 권한` — `API 직접 호출 시 403 \`FORBIDDEN\``
- 위반 규약: `spec/conventions/error-codes.md §1` — 에러 코드는 `UPPER_SNAKE_CASE` 표기. `spec/conventions/error-codes.md §3` Historical-artifact 예외 레지스트리에 `forbidden` (lowercase) 이 초대 흐름 전용으로 등재돼 있음.
- 상세: 본 context 는 초대 흐름이 아니라 Auth Config API 권한 거부다. `FORBIDDEN` (대문자) 은 에러 코드 명명 규약(`UPPER_SNAKE_CASE`)을 따르므로 올바른 표기다. 그러나 `spec/conventions/error-codes.md §3` 의 historical-artifact 항목에서 초대 흐름 전용 `forbidden` (소문자) 이 존재하므로, 두 코드의 도메인 구분이 spec 독자에게 명확하지 않을 수 있다. 실제 구현에서 Auth Config 403 응답이 `FORBIDDEN` (대문자)로 발행되는지 `spec/5-system/3-error-handling.md` 와의 정합성 확인이 권장된다.
- 제안: 본문 표기(`403 \`FORBIDDEN\``) 는 규약상 올바르다. 단, `spec/5-system/3-error-handling.md §1.2` 에 Auth Config `FORBIDDEN` 항목이 없다면 추가 등재 검토. spec 문서 자체는 수정 불필요.

---

### [INFO] `swagger.md §5-1` 응답 DTO 위치 규약 — spec 본문의 API 응답 shape 인라인 기술
- target 위치: `§3. API — GET /api/auth-configs/:id/usage` 행의 `응답 \`data\`: { totalCalls, lastUsedAt, ... }` 인라인 기술
- 위반 규약: `spec/conventions/swagger.md §5-1` — 응답 DTO 는 `dto/responses/*-response.dto.ts` 에 두고, 엔티티를 그대로 노출하지 말 것
- 상세: 이는 spec 문서이지 백엔드 코드가 아니므로 `swagger.md` 의 DTO 위치 규약은 구현 코드 대상이다. spec 본문이 응답 shape 을 prose/inline 으로 기술하는 것은 spec 관행이며 직접 위반이 아니다. 단, 인라인 기술이 실제 응답 DTO 와 diverge 할 위험이 있으므로 주석으로 참조 경로를 명시하거나 데이터 모델 SoT 에 위임하는 것이 더 견고하다.
- 제안: 응답 `data` shape 를 인라인으로 기술하는 대신 구현 DTO(`usage-response.dto.ts` 등)를 SoT 로 명시하거나 데이터 모델 섹션으로 위임. 현재 수준은 INFO.

---

### [INFO] 문서 구조 — 3섹션(Overview / 본문 / Rationale) 권장 구조 일부 편차
- target 위치: 문서 전체 구조
- 위반 규약: `CLAUDE.md §정보 저장 위치` — spec 문서 3섹션 구성 권장 (Overview / 본문 / Rationale)
- 상세: 대상 문서는 `## Overview (제품 정의)` → `## Part A` / `## Part B` (본문) → `## 3. API` → `## Rationale` 의 4-block 구조다. API 절이 본문과 Rationale 사이에 삽입돼 있어 본문과 Rationale 이 API 절에 의해 분리된다. 권장 구조는 Overview / 본문 / Rationale 3섹션이므로, API 절은 본문 내 하위 섹션으로 포함하거나 Rationale 앞에 묶는 것이 더 정형적이다. 이미 수용 가능한 관행이므로 CRITICAL/WARNING 은 아님.
- 제안: `## 3. API` 를 `## Part A` / `## Part B` 의 형제가 아닌 `## Part C: API` 또는 `## API 명세` 등 본문 연속 섹션으로 리네임해 Rationale 바로 앞에 배치. 또는 현행 구조를 명시적으로 승인해 규약 주석을 달아 유지.

---

## 요약

`spec/2-navigation/6-config.md` 는 전반적으로 정식 규약(`spec/conventions/`)을 잘 준수하고 있다. frontmatter 는 `spec-impl-evidence.md` 스키마(id / status: implemented / code 글로브)를 완전히 따르며, audit action 표기(`auth_config.reveal`)는 `audit-actions.md §3` 레지스트리와 일치하고, API endpoint 명명과 마스킹 정책 기술도 관련 규약과 정합적이다. 발견된 항목은 모두 INFO 1건(audit action 표기 스타일), WARNING 1건(에러 코드 도메인 명확성 — 실제 위반이 아닌 독자 혼란 우려), INFO 3건(절 번호 스타일 혼재, id 충돌 잠재 가능성, 응답 shape 인라인 기술 견고성) 수준이다. CRITICAL 위반은 발견되지 않았다.

## 위험도

LOW
