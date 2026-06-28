# Plan 정합성 검토 결과

## 검토 대상

- **Target**: `spec/5-system/` (diff-base `origin/main`)
- **실제 변경 파일**:
  - `spec/5-system/12-webhook.md` (1줄 변경)
  - `spec/5-system/3-error-handling.md` (1줄 변경)
- **진행 중 Plan 전수**: `plan/in-progress/` 48개 파일

## 변경 내용 요약

### 변경 1 — `spec/5-system/12-webhook.md` §6 (Rate Limiting 항)

기존 문장에 아래 내용이 추가됨:

> **Guard 의 trigger 조회 실패 시에도 fail-open(통과)하되, 이는 공개 webhook 보호를 일시 무력화하므로 `error` 레벨로 로깅해 장기 DB 장애로 인한 보호 우회 지속을 모니터링이 조기 탐지하게 한다.**

즉, `PublicWebhookThrottleGuard` 가 trigger DB lookup 에 실패할 때의 fail-open 정책과 `error` 레벨 로깅 의무를 spec 에 명문화한 것.

### 변경 2 — `spec/5-system/3-error-handling.md` §1.3 (`PAYLOAD_TOO_LARGE`)

기존 행에 아래 내용이 추가됨:

> **`message` 는 내부 원문(`"request entity too large"` 등)을 echo 하지 않고 고정 문구 `"Request payload too large."` 만 반환한다(CWE-209 — 비-413 4xx http-error 는 `"The request could not be processed."`, 원문은 서버 로그에만)**

`GlobalExceptionFilter` 가 body-parser 413 처리 시 내부 오류 문자열을 클라이언트에 노출하지 않아야 한다는 CWE-209 규칙을 spec 에 등재한 것.

---

## 발견사항

### [INFO] `http-ssrf-all-auth-followups.md` 의 열린 SSRF 메시지 일반화 항목과 주제 인접

- **target 위치**: `spec/5-system/3-error-handling.md` §1.3 `PAYLOAD_TOO_LARGE` 행 (추가된 CWE-209 문구)
- **관련 plan**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/plan/in-progress/http-ssrf-all-auth-followups.md` 14번째 줄 — `[ ] SSRF 에러 메시지 클라이언트 일반화: http-safety.ts 의 SSRF_BLOCKED: hostname "..." 메시지가 차단 host/IP 를 output.error.message 로 노출(정찰 면)`
- **상세**: 두 항목 모두 내부 구현 세부사항을 클라이언트에 노출하지 않는 원칙(CWE-209)을 다루나 서로 다른 레이어다. 금번 변경은 `GlobalExceptionFilter` 의 HTTP 413 응답 `message` 필드이고, 열린 항목은 `http-safety.ts` 의 노드 `output.error.message` surface 다. 충돌 없음.
- **제안**: 추적 메모 수준. `http-ssrf-all-auth-followups.md` 의 열린 항목 처리 시 `3-error-handling.md` 에 이미 CWE-209 근거가 등재됐음을 참고해 일관된 문구 적용 가능.

---

## 발견사항 없음 — 3개 관점 전부

### 1. 미해결 결정과의 충돌

검토한 48개 in-progress plan 중 `PublicWebhookThrottleGuard` fail-open 로깅 정책이나 `GlobalExceptionFilter` 413 message 처리 방식에 대해 "결정 필요(TBD)" 또는 "사용자 합의 보류" 로 명시된 항목 없음. 두 변경 모두 이미 구현된 동작의 spec 명문화로, 미결 결정을 일방적으로 우회하지 않음.

### 2. 선행 plan 미해소

두 target 파일(`12-webhook.md`, `3-error-handling.md`) 의 frontmatter 는 모두 `status: implemented`, `pending_plans` 없음. 선행 plan 의 완료를 가정하거나 미해소 선행 plan 위에 새 spec 을 추가하는 구조 아님.

### 3. 후속 항목 누락

- **변경 1** (fail-open `error` 로깅): 구현 측 대응이 필요하다면 `public-webhook-throttle.guard.ts` 에 로그 레벨 조정이 필요할 수 있으나, 이는 spec 이 구현 현실을 선행 기술하는 수준의 작은 변경이고 현재 어떤 in-progress plan 도 이 Guard 의 로깅 정책에 의존하거나 언급하지 않음. 별도 plan 신설을 강제할 근거 없음.
- **변경 2** (CWE-209 고정 문구): `GlobalExceptionFilter` 의 동작이 이미 구현됐다고 가정하는 명문화다. 만약 코드가 아직 내부 원문을 echo 하고 있다면 구현 갭이 생기나, 이는 consistency-check `--impl-done` 에서 코드 검증으로 검출할 사안이며 plan 정합성 범위(in-progress plan 와의 충돌)는 아님. 어떤 in-progress plan 도 이 동작에 대해 "결정 후 구현" 항목을 보유하지 않음.

---

## 요약

금번 target 변경(`spec/5-system/12-webhook.md` 1줄, `spec/5-system/3-error-handling.md` 1줄)은 `plan/in-progress/**` 의 미해결 결정이나 선행 plan 과 충돌하지 않는다. 두 변경 모두 `status: implemented` spec 의 이미 확정된 구현 동작을 명문화하는 수준의 정밀화이며, 미결 결정을 일방적으로 우회하거나 다른 in-progress plan 의 후속 항목을 무효화하는 내용을 포함하지 않는다. `http-ssrf-all-auth-followups.md` 의 열린 SSRF 메시지 항목과 CWE-209 주제가 인접하지만 레이어가 달라 충돌 없음.

## 위험도

NONE

STATUS: OK
