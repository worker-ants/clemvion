# Convention Compliance Review

**검토 모드**: --impl-done, scope=spec/5-system/, diff-base=origin/main  
**검토 대상**: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`  
**검토 일시**: 2026-06-05

---

## 발견사항

### 1. `spec/5-system/1-auth.md` — LoginHistory 이벤트 명명

- **[INFO]** LoginHistory event enum 값이 `lower_snake_case` 사용
  - target 위치: `1-auth.md §4.3` 로그인 이력 이벤트 표 (`login_success`, `login_failed`, `totp_failed`, `webauthn_failed`, `logout`, `session_revoked`, `token_reuse_detected`)
  - 위반 규약: `spec/conventions/node-output.md Principle 3.2` — `code` 는 `UPPER_SNAKE_CASE`
  - 상세: LoginHistory event 값들이 `lower_snake_case` 를 쓰고 있으나, 이는 DB enum / internal event identifier 성격으로, `output.error.code` 와는 구분된다. 또한 AuditLog 액션(`password_change`, `workflow.create` 등)도 동일하게 `lower_snake_case` 또는 `dot.notation` 을 사용한다. 이 값들은 API `error.code` 로 클라이언트에 노출되지 않으며 DB 내부 enum 혹은 audit 레코드의 카테고리 식별자로 기능하기 때문에 엄밀히 `node-output.md Principle 3.2` 의 직접 적용 대상이 아니다. 그러나 규약 문서가 "프로젝트 전체 에러 코드 문자열" (`error-codes.md Overview` 참조)에 적용한다고 명시한 것과 명시적 면제 기재가 없다는 점에서 주의가 필요하다.
  - 제안: LoginHistory event 와 AuditLog action 이 `node-output.md Principle 3.2` 의 `UPPER_SNAKE_CASE` 규약 적용 범위 밖임을 `1-auth.md §4.3` 주석에 명기하거나, `error-codes.md §3` historical-artifact 레지스트리에 `login_success` 등 LoginHistory event 카테고리 전체를 "DB enum — API code 와 별도 도메인" 으로 명시 등재한다. 또는 규약 자체(`error-codes.md Overview`)에 "DB internal enum/audit action 은 적용 범위 제외" 라는 단서를 추가한다.

---

### 2. `spec/5-system/1-auth.md` — §1.5.4 초대 에러 코드 `lower_snake_case`

- **[INFO]** `invitation_not_found` 등 초대 에러 코드가 `lower_snake_case` 이며 historical-artifact 레지스트리 자기참조
  - target 위치: `1-auth.md §1.5.4 에러 응답` 표 및 바로 아래 > 명명 블록
  - 위반 규약: `spec/conventions/error-codes.md §1` (`UPPER_SNAKE_CASE`), §3 historical-artifact 레지스트리
  - 상세: 이미 `error-codes.md §3` 에 등재되어 규약의 허용 범위 안에 있다. 문서 내 자체 설명도 완결되어 있다. 형식 위반이지만 규약이 명시적으로 허용(등재)하여 처리된 상태이므로 실질적 위반 없음. 기록 목적의 INFO.
  - 제안: 없음 (이미 처리 완료).

---

### 3. `spec/5-system/11-mcp-client.md` — `skipReason` 값의 `lower_snake_case` — 명명 규칙 분리 설명 존재

- **[INFO]** `skipReason` vocabulary 값이 `lower_snake_case` (`expired_install_timeout`, `expired_refresh_failed` 등)
  - target 위치: `11-mcp-client.md §6.2 skipReason vocabulary` 표
  - 위반 규약 후보: `spec/conventions/node-output.md Principle 3.2` (`UPPER_SNAKE_CASE`)
  - 상세: 문서 자체가 §6.2 내 별도 블록으로 "명명 규칙 분리" 를 명시적으로 설명하고 있다 — "`skipReason` 값은 모두 `lower_snake_case` 다. 본 필드는 에러 코드가 아닌 운영 진단용 enum 이라 `node-output.md Principle 3.2` 의 `code` UPPER_SNAKE_CASE 규약과 구분된다." 따라서 의도된 패턴이며 규약과의 차이점이 문서화되어 있다.
  - 제안: 이 의도적 구분이 `error-codes.md §3` 또는 `node-output.md §3.2` 에도 "운영 진단용 enum 은 `lower_snake_case` 예외" 로 한 줄 명기하면 checker 의 false-positive 가 방지된다. 현재는 규약 문서에서 이 예외를 찾을 수 없어 cross-reference 시 모호함이 있다.

---

### 4. `spec/5-system/11-mcp-client.md` — `## Rationale` 섹션 부재

- **[WARNING]** `11-mcp-client.md` 에 권장 3섹션 중 `## Rationale` 섹션이 없다
  - target 위치: `spec/5-system/11-mcp-client.md` 전체 (섹션 목록: §1~§12 + `## 확장 포인트`)
  - 위반 규약: `CLAUDE.md §정보 저장 위치 (단일 진실 원칙)` — "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`". 또한 CLAUDE.md 및 각 SKILL.md 에서 "Overview / 본문 / Rationale 3섹션 권장" 구조 언급
  - 상세: `spec/5-system/1-auth.md` 와 `spec/5-system/10-graph-rag.md` 는 모두 `## Rationale` 섹션을 보유한다. `11-mcp-client.md` 는 `## 12. 확장 포인트` 로 끝나며 Rationale 이 없다. 설계 결정의 배경(transport 선택, 도구 평탄화 모델 채택, Internal Bridge 분리 이유 등)이 본문 §1 개요, §2 transport 등 각 섹션에 산재해 있으나 통합된 Rationale 섹션은 없다.
  - 제안: `## Rationale` 섹션을 문서 말미에 추가하고, 현재 각 섹션 내에 산재한 설계 근거(stdio 미지원 이유 §2.2, Internal Bridge 채택 이유 §2.3, 도구 평탄화 이유 §5, 세션 풀링 미적용 이유 §4.3 등)를 해당 섹션으로 통합·요약한다.

---

### 5. `spec/5-system/1-auth.md` — `## Overview` 섹션 부재

- **[INFO]** `1-auth.md` 에 `## Overview` 섹션이 없다
  - target 위치: `spec/5-system/1-auth.md` 전체 (섹션 목록: §1~§5 + `## Rationale`)
  - 위반 규약: CLAUDE.md §정보 저장 위치 — "제품 정의·요구사항은 `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`". 3섹션 권장 구조 (Overview / 본문 / Rationale)
  - 상세: `10-graph-rag.md` 는 `## Overview (제품 정의)` 섹션을 명시적으로 가진다. `spec-impl-evidence.md` 도 `## Overview (제품 정의)` 패턴을 사용한다. `1-auth.md` 는 Overview 섹션 없이 바로 `## 1. 인증` 으로 시작한다. `_product-overview.md` 가 비기능 요구사항을 담고 있어 기능 정의는 `1-auth.md` 에 있는 구조이나, 문서 자체의 목적/범위 요약 블록이 없다.
  - 제안: 개선 권장 사항이나 의무는 아님 (권장 사항). 단, `_product-overview.md` 와의 분리로 이미 역할 구분이 되어 있으므로 현 구조가 수용 가능하다. 형식 일관성 목적으로 도입 가능.

---

### 6. `spec/5-system/10-graph-rag.md` — `## Overview` 와 본문 `## 1. 개요` 중복

- **[INFO]** `10-graph-rag.md` 에 `## Overview (제품 정의)` 와 `## 1. 개요` 두 개의 서두 섹션이 존재
  - target 위치: `10-graph-rag.md` 라인 29 (`## Overview (제품 정의)`) 와 라인 206 (`## 1. 개요`)
  - 위반 규약: `CLAUDE.md §정보 저장 위치` — Overview / 본문 / Rationale 3섹션 권장
  - 상세: `## Overview` 는 제품 정의·요구사항·범위를 포함하며, `## 1. 개요` 는 기술 구조 설명(파이프라인 다이어그램)으로 역할이 다르다. 사실상 Overview → 요구사항 본문 → 기술 설명 본문 → Rationale 4레이어 구조로 규약의 3섹션을 자연스럽게 확장한 형태이므로 위반이라기보다 조금 더 상세화한 구조다.
  - 제안: 허용 가능한 범위. 동일 패턴을 다른 문서에서도 채택하는 경우 3섹션 규약을 공식적으로 "Overview / [요구사항 본문] / [기술 본문] / Rationale" 4레이어로 확장하거나, `## 1. 개요` 를 `## Overview` 에 통합하는 것을 검토한다.

---

### 7. `spec/5-system/11-mcp-client.md` — `INTEGRATION_NOT_CONNECTED` 에러 코드 참조 확인 필요

- **[INFO]** `spec/5-system/11-mcp-client.md §2.1` 에서 `INTEGRATION_NOT_CONNECTED` 에러 코드를 참조하나 `error-codes.md` 레지스트리에 등재 여부 확인 불가
  - target 위치: `11-mcp-client.md §2.1 Streamable HTTP` 표 — "서버가 미지원 버전을 거부하면 `INTEGRATION_NOT_CONNECTED` 로 격하"
  - 위반 규약: `spec/conventions/error-codes.md §1` — `UPPER_SNAKE_CASE` 의미 기반 명명
  - 상세: `INTEGRATION_NOT_CONNECTED` 는 UPPER_SNAKE_CASE 로 규약 표기를 따른다. 의미도 "통합이 연결되지 않음" 으로 기술적이다. 다만 `error-codes.md §3` 레지스트리에 등재되지 않은 코드이므로 카탈로그(`3-error-handling.md`) 에서 SoT 가 명확한지 확인 필요.
  - 제안: 코드 자체의 규약 준수(UPPER_SNAKE_CASE, 의미 기반)는 양호. 추가 검증 불필요.

---

## 요약

`spec/5-system/` 영역 세 파일의 정식 규약 준수 수준은 전반적으로 양호하다. 에러 코드 명명 규약(`UPPER_SNAKE_CASE`)은 API 노출 에러 코드(`WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `MCP_CONNECT_FAILED` 등)에서 일관되게 지켜지고 있으며, 초대 API의 `lower_snake_case` 코드는 `error-codes.md §3` historical-artifact 레지스트리에 등재되어 규약 프레임 안에 처리되어 있다. `skipReason` 의 `lower_snake_case` 도 해당 문서 내에 명시적 근거가 있다. 가장 주목할 발견사항은 `11-mcp-client.md` 의 `## Rationale` 섹션 부재(WARNING)로, 설계 근거가 문서 전체에 산재해 있어 규약이 권장하는 단일 Rationale 섹션 패턴에서 벗어난다. LoginHistory 이벤트 및 AuditLog 액션의 `lower_snake_case` / `dot.notation` 은 "에러 코드" 가 아닌 DB 내부 enum·audit 식별자 성격이나, 규약 문서에서 명시적 면제 기재가 없어 INFO 수준 모호성이 있다.

## 위험도

LOW
