# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/` (diff-base: `origin/main`)
변경 파일: `spec/5-system/12-webhook.md`, `spec/5-system/3-error-handling.md`

---

## 발견사항

### [INFO] `spec/7-channel-web-chat/4-security.md` §4 rate-limit 설명에 trigger 조회 fail-open 정책 미반영

- target 위치: `spec/5-system/12-webhook.md` §6 Rate Limiting 항목 (변경 라인)
- 충돌 대상: `spec/7-channel-web-chat/4-security.md` §4 및 Rationale R3 (L128, L141-144, L191-196)
- 상세: `12-webhook.md` 는 `PublicWebhookThrottleGuard` 가 trigger DB 조회 실패 시에도 fail-open(통과)하되 `error` 레벨 로깅으로 장기 우회를 모니터링한다는 정책을 새로 명시했다. 반면 `7-channel-web-chat/4-security.md` §4 / R3 은 해당 Guard 의 fail-open 사유를 "Redis 미가용 시" 로만 기술하며, DB 조회 실패 시 동작(fail-open + `error` 레벨 로깅)은 언급하지 않는다. 모순이 아니라 정책 범위의 차이지만, web-chat 보안 문서가 Guard 의 저하 경로(degradation path)를 일부만 기술하므로 독자가 DB 장애 시 보호가 완전히 유지된다고 오해할 수 있다.
- 제안: `spec/7-channel-web-chat/4-security.md` §4 blockquote(L141-144)와 R3 에 "Redis 미가용 외에도 trigger DB 조회 실패 시 동일하게 fail-open(통과) + `error` 레벨 로깅" 을 추가해 두 문서를 동기화하도록 권장. 우선순위 낮음(단방향 포인터 구조이므로 webhook.md 가 SoT 로 충분하나 web-chat 문서 독자 경험 개선 차원).

---

### [INFO] `PAYLOAD_TOO_LARGE` `message` 고정 문구 정책이 API 규약 `spec/5-system/2-api-convention.md` §5.3 에 미반영

- target 위치: `spec/5-system/3-error-handling.md` §1.3 `PAYLOAD_TOO_LARGE` 항목 (변경 라인)
- 충돌 대상: `spec/5-system/2-api-convention.md` §5.3 에러 응답 형식 (L141-163)
- 상세: `3-error-handling.md` 는 `PAYLOAD_TOO_LARGE` 의 `message` 필드가 body-parser 원문(`"request entity too large"` 등)을 echo 하지 않고 고정 문구 `"Request payload too large."` 만 반환하며, 비-413 4xx http-error 는 `"The request could not be processed."` 를 사용한다는 CWE-209 기반 정책을 새로 선언했다. `2-api-convention.md` §5.3 은 에러 응답 봉투 형식(`error.code`, `error.message`, `requestId`, `details`)을 정의하나 `error.message` 의 내용 정책(원문 echo 금지·고정 문구)은 기술하지 않는다. 모순은 아니나, API 규약을 참조하는 소비자가 `message` 필드를 자유 형식으로 오해할 수 있다.
- 제안: `2-api-convention.md` §5.3 에 "`error.message` 는 내부 구현 원문을 echo 하지 않는다 — CWE-209. 구현 세부는 [error-handling §1.3]" 수준의 짧은 주석을 추가해 단방향 포인터로 동기화 권장. 차단 불필요(error-handling 이 SoT).

---

## 요약

이번 변경은 두 파일에 국한된 소규모 spec 업데이트다. `spec/5-system/12-webhook.md` 는 `PublicWebhookThrottleGuard` 의 DB 조회 실패 시 fail-open + `error` 레벨 로깅 정책을 추가했고, `spec/5-system/3-error-handling.md` 는 `PAYLOAD_TOO_LARGE` `message` 필드에 CWE-209 기반 고정 문구 정책을 명시했다. 두 변경 모두 기존 spec 과 직접 모순되지 않으며, 참조 관계에 있는 `7-channel-web-chat/4-security.md` 와 `2-api-convention.md` 에 동기화가 권장되는 INFO 수준의 단방향 포인터 누락만 발견되었다. CRITICAL·WARNING 등급의 충돌은 없다.

## 위험도

LOW
