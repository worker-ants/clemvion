# Cross-Spec 일관성 검토 결과

대상 문서: `spec/5-system/3-error-handling.md`
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

### 1. [WARNING] §1.4 Email 카테고리 행 — `details.integrationCode` 등장 조건 오기술
- **target 위치**: `spec/5-system/3-error-handling.md` §1.4 노드 수준 런타임 에러 표, Email 행 (line 82)
- **충돌 대상**: `spec/4-nodes/4-integration/3-send-email.md` §5.3 에러 표 + 비고 (lines 208, 213–223)
- **상세**:
  Target 문서는 Email 행을 다음과 같이 기술한다.
  `EMAIL_SEND_FAILED (+ details.integrationCode 로 원본 INTEGRATION_INCOMPLETE / INTEGRATION_TYPE_MISMATCH / INTEGRATION_NOT_CONNECTED 보존) · EMAIL_HOST_BLOCKED`
  이 표현은 `INTEGRATION_*` 코드가 `EMAIL_SEND_FAILED` 의 `details.integrationCode` 에 "보존"된다고 읽힌다.
  그러나 send-email spec §5.3 에 따르면 `INTEGRATION_INCOMPLETE` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `EMAIL_HOST_BLOCKED` 는 `IntegrationError` 로 throw 되어 `output.error.code` 에 **직접 surface** 된다. `details.integrationCode` 는 이 직접-surface 코드들과 **함께 동봉**되는 관찰성 중복 필드로, `output.error.code` 와 동일 값을 담는다. `EMAIL_SEND_FAILED` 발생 시에는 `IntegrationError` 경로가 아니므로 `details.integrationCode` 가 없다. 두 구조가 반대로 기술되어 있다.
- **제안**: target §1.4 Email 행을 다음 방향으로 수정.
  `EMAIL_SEND_FAILED` (nodemailer transport 실패 generic fallback, IntegrationError 가 아닌 경우)
  · `EMAIL_HOST_BLOCKED` (SSRF 차단) · `INTEGRATION_INCOMPLETE` · `INTEGRATION_TYPE_MISMATCH` · `INTEGRATION_NOT_CONNECTED`
  (세 Integration 코드는 직접 surface; 이 경우 `details.integrationCode` 에 동일 코드 동봉 — 관찰성 호환)

---

### 2. [INFO] §1.5 `EXECUTION_MESSAGE_TOO_LONG` 행 — 타입 클래스명 불일치 (target vs WS spec)
- **target 위치**: `spec/5-system/3-error-handling.md` §1.5 WS commands 에러 코드 표, `EXECUTION_MESSAGE_TOO_LONG` 행 (line 104)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.2 에러 코드 표 (line 312)
- **상세**:
  - Target 문서 (§1.5): `EXECUTION_MESSAGE_TOO_LONG` 설명에 "typed `MessageTooLongError`" 라고 기술.
  - WS spec (§4.2): 동일 코드를 "typed `ExecutionError`" 로 기술 (기반 추상 클래스 명칭 사용).
  - Execution engine spec §7.5.2 및 EIA spec (14-external-interaction-api.md §5.1·R13)은 모두 `MessageTooLongError` (구체 서브클래스)를 사용.
  - 두 표현 모두 틀리지 않으나 (`MessageTooLongError extends ExecutionError`), WS spec만 기반 클래스명을 사용해 명세 간 용어 비일관성이 생긴다. Target 문서 자체는 올바른 구체 클래스명을 사용하고 있으므로 수정 대상은 WS spec 쪽이다.
- **제안**: `spec/5-system/6-websocket-protocol.md` §4.2 line 312 의 "typed `ExecutionError`" 를 "typed `MessageTooLongError`" 로 정정해 execution engine spec·EIA spec·target 문서와 일치시킨다.

---

### 3. [INFO] §3.2 "대표 에러 코드" Email 행 — `EMAIL_HOST_BLOCKED` 및 `INTEGRATION_*` 누락
- **target 위치**: `spec/5-system/3-error-handling.md` §3.2 Route to Error Port 대표 에러 코드 표, Email 행 (line 245)
- **충돌 대상**: `spec/4-nodes/4-integration/3-send-email.md` §5.3 에러 표 (lines 218–221), `spec/5-system/3-error-handling.md` §1.4 Email 행 (line 82)
- **상세**:
  §3.2 "대표 에러 코드" 표의 Email 행은 `EMAIL_SEND_FAILED` 만 나열한다. 그러나 §1.4 에서 동일 문서가 `EMAIL_HOST_BLOCKED` 를 Email 카테고리에 포함하고 있고, send-email spec §5.3 에 따르면 `EMAIL_HOST_BLOCKED` / `INTEGRATION_INCOMPLETE` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` 도 실제 error 포트로 surface 된다. §3.2 의 "(후속 PR 에서 enum 확장)" 주석이 있어 의도적 축약일 수 있으나, 동일 문서 내 §1.4 와의 불일치가 독자에게 혼란을 줄 수 있다.
- **제안**: §3.2 Email 행을 `EMAIL_SEND_FAILED` · `EMAIL_HOST_BLOCKED` (at minimum) 로 확장하거나, §1.4 와의 관계를 명시하는 주석을 추가한다.

---

## 요약

`spec/5-system/3-error-handling.md` (target) 은 전반적으로 다른 영역 spec과 잘 정합한다. 에러 코드 3-tier 분리(REST core / WS / EIA REST), `INVALID_STATE` vs `INVALID_EXECUTION_STATE` vs `STATE_MISMATCH` 의 표면별 분리 원칙, `EXECUTION_MESSAGE_TOO_LONG` / `EXECUTION_INTERNAL_ERROR` 의 typed/plain 분기 정책, health check probe 역할 분리, `MODEL_CONFIG_*` 분리 이유, EIA 토큰 에러 401 통일 모두 타 spec과 일치한다. CRITICAL 충돌은 없으며, Email 노드 `details.integrationCode` 등장 조건 오기술이 WARNING, WS spec 의 클래스명 비일관성 및 §3.2 Email 행 축약이 INFO 수준이다. WS spec (6-websocket-protocol.md §4.2 line 312) 이 유일하게 다른 문서 수정을 필요로 한다.

---

## 위험도

LOW
