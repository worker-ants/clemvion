# 정식 규약 준수 검토 — spec/2-navigation/6-config.md

검토 모드: spec draft (--spec)
검토 대상: `spec/2-navigation/6-config.md`
검토 규약: `spec/conventions/**`

---

## 발견사항

### [INFO] 본문 섹션 헤딩 혼용 — 알파벳 Part 와 숫자 번호 병존
- target 위치: `## Part A:`, `## Part B:`, `## 3. API`
- 위반 규약: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장" (spec/conventions/ 에 헤딩 포맷 강제 규칙 없음)
- 상세: 본문 섹션이 `Part A` / `Part B` 의 알파벳 파트 구조로 시작하다가 `## 3. API` 가 숫자 번호로 등장한다. conventions 파일에 번호·알파벳 혼용을 명시적으로 금지하는 규칙은 없으나, 같은 문서 안에서 최상위 본문 헤딩의 인덱스 방식이 혼용되면 독자 혼란이 발생한다.
- 제안: `## 3. API` 를 `## Part C: API` 로 통일하거나, 반대로 Part A/B 를 `## 1.`/`## 2.` 로 교체해 인덱스 방식을 단일화한다. conventions 에 헤딩 인덱스 규칙을 추가할 의도가 있다면 `spec/conventions/` 신규 문서로 정형화가 적절하다.

---

### [INFO] `RERANK_CONFIG_INVALID` — LLM Client §5.5 SoT 와 표기 상이
- target 위치: §B.6.2 리랭커 추가/수정 표 Base URL 행 (`400 'RERANK_CONFIG_INVALID'`) 및 Rationale R-4
- 위반 규약: `spec/conventions/error-codes.md §1` "에러 코드 이름은 조건의 의미를 기술한다" / §2 "에러 코드 rename 은 breaking change"
- 상세: target 이 SSRF 가드 400 응답 코드로 `RERANK_CONFIG_INVALID` 를 명시하지만, 동일 맥락의 SoT 인 `spec/5-system/7-llm-client.md §5.5` 는 동일한 SSRF 차단 응답을 `MODEL_CONFIG_INVALID` (400) 로 등록한다 (7-llm-client.md 라인: "프로바이더 설정 오류 | 400 | `MODEL_CONFIG_INVALID` — 팩토리 생성 실패 ... 또는 preview SSRF 차단"). `RERANK_CONFIG_INVALID` 는 `3-error-handling.md` 카탈로그에 미등재이며, `9-rag-search.md §3.3` 및 `rerank.service.ts` 에서 런타임 diagnostics 문자열로 사용되는 것과 별개다. 설정 API SSRF 400 응답 맥락에서 두 코드명이 혼재한다.
- 제안: §B.6.2 및 R-4 의 에러 코드 표기를 `7-llm-client.md §5.5` 의 `MODEL_CONFIG_INVALID` 로 교정하거나, `RERANK_CONFIG_INVALID` 가 설정 API 레이어에서도 별도 400 코드로 유효하다면 `3-error-handling.md §1.3` 카탈로그에 등재하고 error-codes.ts union 에 추가한다.

---

### [INFO] `audit_log` 산문 표기 — 엔티티 명칭 혼용
- target 위치: §A.4 Reveal 흐름 코드블록 5번 항목 (`audit_log 에 action='auth_config.reveal' 기록`), §3 Authentication API 표 reveal 행 (`audit_log 기록`)
- 위반 규약: `spec/conventions/audit-actions.md` (audit action 명명 SoT). conventions 에 산문 엔티티 명칭 포맷을 강제하는 조항은 없음
- 상세: `audit-actions.md` 는 엔티티를 `AuditLog` (UpperCamelCase), 서비스를 `AuditLogsService.record({ action })` 로 지칭한다. target 의 `audit_log` 는 snake_case 로 DB 테이블명 혼용처럼 보인다. action 값 자체(`auth_config.reveal`)는 conventions §3 레지스트리의 `auth_config | 현재형 (§2.2) | reveal` 과 정확히 일치하므로 액션 명명 자체는 올바르다.
- 제안: spec 본문 산문에서 감사 로그 엔티티를 지칭할 때 `AuditLog` 또는 `audit log` 로 통일한다. conventions 에 이 표기를 명시적으로 추가할 필요는 낮으므로 target 수정 권장으로 처리한다.

---

## 규약 직접 준수 확인 사항 (이상 없음)

다음 항목은 conventions 와 대조하여 위반 없음을 확인:

1. **Frontmatter 필수 필드** (`spec-impl-evidence.md §2`):
   - `id: config` — 유효 kebab-case, 파일 basename 일치
   - `status: implemented` — §3 라이프사이클 유효 값
   - `code:` — glob 경로 7개 포함, `status: implemented` 조건(`≥1 매치 의무`) 충족
   - `pending_plans` 없음 — `status: implemented` 상태에서 정상

2. **문서 3섹션 구조** (CLAUDE.md):
   - `## Overview (제품 정의)` 존재
   - 본문 (Part A / Part B / 3. API) 존재
   - `## Rationale` 존재 (R-1 ~ R-6)

3. **감사 액션 명명** (`audit-actions.md`):
   - `auth_config.reveal` — §3 레지스트리의 `auth_config | 현재형 (§2.2) | reveal` 과 일치
   - `<resource>.<verb>` 구조, 언더스코어 구분자 준수

4. **API endpoint 명명**:
   - `/api/auth-configs`, `/api/model-configs` — kebab-case 복수형
   - 서브경로 `/regenerate`, `/reveal`, `/set-default`, `/test`, `/models`, `/preview-models` — 모두 kebab-case

5. **에러 코드 표기** (`error-codes.md §1`):
   - `FORBIDDEN` — `3-error-handling.md` 에 등재된 UPPER_SNAKE_CASE 표준 코드

6. **Spec 파일 적용 범위** (`spec-impl-evidence.md §1`):
   - `spec/2-navigation/**.md` 스코프에 해당 — frontmatter 의무 대상, 모두 충족

7. **파일 명명 컨벤션** (CLAUDE.md):
   - `6-config.md` — 번호 prefix 일반 spec 패턴
   - 참조하는 `_product-overview.md`, `_layout.md` — 밑줄 prefix 레이아웃/인덱스 문서, 정상 패턴

---

## 요약

`spec/2-navigation/6-config.md` 는 정식 규약 준수 관점에서 전반적으로 양호하다. Frontmatter 스키마(`spec-impl-evidence.md`)·감사 액션 명명(`audit-actions.md`)·API endpoint 케이싱·문서 3섹션 구성이 모두 conventions 에 부합한다. 발견된 사항은 INFO 3건이다: 본문 최상위 헤딩의 알파벳-숫자 인덱스 혼용, SSRF 가드 에러 코드 표기의 내부 SoT 불일치(`7-llm-client.md` 의 `MODEL_CONFIG_INVALID` vs target 의 `RERANK_CONFIG_INVALID`), `audit_log` 산문 표기의 엔티티 명칭 혼용이다. CRITICAL 및 WARNING 등급 위반은 없다.

---

## 위험도

NONE
