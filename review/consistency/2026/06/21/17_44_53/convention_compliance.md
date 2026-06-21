# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/` (impl-prep 모드)
검토 파일: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`
검토 기준 규약: `spec/conventions/audit-actions.md`, `spec/conventions/error-codes.md`, `spec/conventions/node-output.md`, `spec/conventions/swagger.md`, CLAUDE.md 문서 구조 규약

---

## 발견사항

### 1. **[INFO]** `audit-actions.md` 레지스트리에 `user.email_changed` 신규 추가 완료 — 정합

- target 위치: `spec/conventions/audit-actions.md` §3 레지스트리 (본 worktree 변경분)
- 위반 규약: 해당 없음 (준수)
- 상세: worktree 의 `audit-actions.md` §3 레지스트리에 `| user | 과거분사 (§2.1) | email_changed | 미구현 |` 행이 추가됐다. `audit-actions.md §1` 의 `<resource>.<verb>` 구조, `§2.1` 과거분사 분류, 토큰 구분자 언더스코어 규칙을 모두 준수한다. `1-auth.md §4.1` Planned 카탈로그와의 상호 참조도 일치한다.
- 제안: 변경 없음.

---

### 2. **[INFO]** `1-auth.md §1.1.B` 이메일 변경 흐름 — 에러 코드 규약 준수

- target 위치: `spec/5-system/1-auth.md §1.1.B` 운영 시나리오 표
- 위반 규약: `spec/conventions/error-codes.md §1` (의미 기반 명명), `spec/5-system/3-error-handling.md §3.2` (`UPPER_SNAKE_CASE`)
- 상세: 신규 §1.1.B 가 도입한 에러 코드들 — `REAUTH_NOT_AVAILABLE`(403), `VALIDATION_ERROR`(400), `RESOURCE_CONFLICT`(409) — 은 모두 `UPPER_SNAKE_CASE` 규약을 준수한다. `VALIDATION_ERROR`·`RESOURCE_CONFLICT` 는 `3-error-handling.md §1.1·§1.2` 의 공용 카탈로그에 등재된 기존 코드다. `REAUTH_NOT_AVAILABLE` 은 `3-error-handling.md` 공식 카탈로그에 별도 등재 행이 없으나, `spec/data-flow/2-auth.md §§` 에서 기존 세션 강제 종료 재인증 경로에 이미 사용 중인 코드로, `§1.1.B` 본문이 "§2.3 재인증 상류 코드 재사용" 이라고 명시해 기존 코드를 재사용한다는 의도가 있다. `error-codes.md §1` "의미 기반 명명" 원칙을 위반하지 않는다.
- 제안: `REAUTH_NOT_AVAILABLE` 이 `3-error-handling.md §1` 카탈로그에 별도 등재 행이 없다는 점은 `1-auth.md §1.1.B` 의 규약 위반이 아니라 `3-error-handling.md` 의 미완 목록 문제다. 구현 착수 전에 `3-error-handling.md §1` 에 해당 코드 행을 추가하는 것을 권장하나, 이 파일(`spec/5-system/`) 의 규약 준수 자체에 영향은 없다.

---

### 3. **[WARNING]** `1-auth.md §4.1` Planned 카탈로그 — `user.email_changed` 행의 `audit-actions.md` 레지스트리 포인터 명시 부재

- target 위치: `spec/5-system/1-auth.md §4.1` Planned 표, `user.email_changed` 행
- 위반 규약: `spec/conventions/audit-actions.md §1` — "본 문서가 유일하게 소유하는 것: 도메인별 분류 레지스트리"; `CLAUDE.md` 정보 저장 위치 "단일 진실 원칙"
- 상세: `1-auth.md §4.1` 의 `user.email_changed` Planned 행은 "구현 시 `AUDIT_ACTIONS` 에 추가" 라는 지침만 명시하고 있다. `audit-actions.md §3` 레지스트리에 분류(과거분사 §2.1) 가 추가된 시점에서, `§4.1` 행도 "분류: `audit-actions.md §3` — 과거분사(§2.1)" 식의 포인터를 갖거나 최소한 명명 규약 SoT 를 명시하면 일관성이 높아진다. 현재 `user.password_changed`·`user.2fa_enabled` 등 구현된 행도 동일하게 포인터가 없으나, 기존 행은 `1-auth.md §4.1` 서두의 "Action naming·시제 규약 … `conventions/audit-actions.md` 가 SoT" 단락으로 일괄 커버된다. 신규 Planned 행은 그 단락 아래 있으므로 사실상 커버된다.
- 제안: INFO 로 다운그레이드 가능한 수준. 현 문서가 서두에 `audit-actions.md` SoT 를 명시하고 있어 단일 진실 원칙을 사실상 충족한다. 단, 추후 Planned 행이 많아지면 행마다 분류를 명시하는 패턴을 도입할 때 이 행이 기준이 된다.

---

### 4. **[INFO]** `10-graph-rag.md §7` 에러 코드 `KB_REEXTRACT_IN_PROGRESS` — 규약 준수

- target 위치: `spec/5-system/10-graph-rag.md §7` 에러 처리 표
- 위반 규약: 해당 없음 (준수)
- 상세: `KB_REEXTRACT_IN_PROGRESS`(409) 는 `UPPER_SNAKE_CASE`, 도메인 prefix(`KB_`), 의미 기반 명명 세 조건을 모두 만족한다 (`error-codes.md §1`). `3-error-handling.md` 공식 카탈로그에 별도 등재 행은 없으나 신규 도메인 코드로서 규약 위반은 아니다.
- 제안: 구현 시 `3-error-handling.md §1` 카탈로그 등재를 권장한다.

---

### 5. **[INFO]** `10-graph-rag.md` 문서 구조 — `## Overview (제품 정의)` 헤더 변형

- target 위치: `spec/5-system/10-graph-rag.md` line 29
- 위반 규약: CLAUDE.md 문서 구조 규약 "Overview / 본문 / Rationale 3섹션 권장"
- 상세: CLAUDE.md 는 3섹션 구성을 "권장"으로 명시한다(강제 아님). `10-graph-rag.md` 는 `## Overview (제품 정의)` 로 헤더에 부제를 붙였으며, 이 파일이 PRD 역할과 기술 명세 역할을 겸해 섹션 내에 요구사항·기술 결정이 혼재한다. Rationale 은 `## Rationale` 로 말미에 존재하므로 3섹션 골격은 충족한다. `(제품 정의)` 부제는 CLAUDE.md `_product-overview.md` 패턴과 명확히 구분하기 위한 수식어로 보이며, 규약 직접 위반이 아니다.
- 제안: 변경 불필요.

---

### 6. **[INFO]** `1-auth.md §1.1.B` — 엔드포인트 SoT 분리 패턴 준수

- target 위치: `spec/5-system/1-auth.md §1.1.B` 서두 및 §5 엔드포인트 표 말미
- 위반 규약: 해당 없음 (준수)
- 상세: `§1.1.B` 는 "엔드포인트 정의는 [사용자 프로필 §6.1]" 포인터를 명시하고, `§5` 말미에 이메일 변경 엔드포인트가 `9-user-profile.md` 에 정의된다는 포인터를 추가한다. 흐름·토큰·세션·감사의 SoT 는 `1-auth.md`, 엔드포인트 정의의 SoT 는 `9-user-profile.md §6.1` 로 분리해 중복 정의를 회피한다. CLAUDE.md 단일 진실 원칙과 일치한다.
- 제안: 변경 불필요.

---

## 요약

`spec/5-system/1-auth.md` (이메일 변경 흐름 §1.1.B 신규 추가) 및 `spec/conventions/audit-actions.md` (`user.email_changed` 레지스트리 추가)는 정식 규약을 전반적으로 잘 준수한다. 에러 코드는 모두 `UPPER_SNAKE_CASE` 와 의미 기반 명명을 충족하며, 감사 액션 명명은 `<resource>.<verb>` 구조와 과거분사(§2.1) 분류를 따른다. `10-graph-rag.md` 는 이번 worktree 의 직접 변경 대상이 아니고 기존 파일이며 규약 위반이 없다. 유일한 WARNING 은 `1-auth.md §4.1` Planned 행의 분류 레지스트리 포인터 부재인데, 동 섹션 서두의 일괄 SoT 포인터로 실질적으로 커버되어 단일 진실 원칙을 깨지 않는다.

## 위험도

LOW
