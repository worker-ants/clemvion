# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/` (diff-base: `origin/main`)
변경 파일: `spec/5-system/12-webhook.md`, `spec/5-system/3-error-handling.md`

---

## 발견사항

### [INFO] `PublicWebhookThrottleGuard` DB 조회 실패 시 fail-open — Rationale 부재
- **target 위치**: `spec/5-system/12-webhook.md` §6 보안 항목 (Rate Limiting 공개 webhook 전용 추가 라인)
- **과거 결정 출처**: `spec/5-system/12-webhook.md` Rationale 없음 (이 결정에 대응하는 Rationale 항목이 신설되지 않음)
- **상세**: 신규 추가 문장 "Guard 의 trigger 조회 실패 시에도 fail-open(통과)하되, 이는 공개 webhook 보호를 일시 무력화하므로 `error` 레벨로 로깅해 장기 DB 장애로 인한 보호 우회 지속을 모니터링이 조기 탐지하게 한다"는 실제 행동 변경(fail-open vs fail-closed)을 명문화한다. 기존 "Redis 미가용 시 fail-open" 문구는 이미 존재했으나, DB 조회 실패에 대한 별도 fail-open 결정이 추가됐다. 이 결정이 기각된 대안을 재도입하거나 기존 Rationale과 충돌하지는 않는다. 단, WH-SC-09 에서 `ip_whitelist` 불일치 시 IP 미확인 → "fail-closed(거부)" 정책이 명시돼 있어, 동일 Guard 경로에서 DB 조회 실패 시 fail-open 을 택한 결정의 근거(가용성 우선 이유, fail-closed 대안 기각 이유)가 Rationale 에 없는 것이 잠재적 불일치 소지다. 합의된 invariant를 직접 위반하지는 않으며, 다만 설명 부재 상태다.
- **제안**: `spec/5-system/12-webhook.md` Rationale 에 "PublicWebhookThrottleGuard DB 조회 실패 시 fail-open 이유" 항목 추가 — Redis fail-open(이미 정책)과 일관한 이유(Guard가 rate-limit 역할이며 운영 가용성 우선, 보호 무력화 감지는 모니터링으로 보완)를 명시하고, fail-closed 대안 기각 이유를 기록하는 것이 권장된다.

---

### [INFO] `PAYLOAD_TOO_LARGE` message 고정 문구 정책 — Rationale 부재
- **target 위치**: `spec/5-system/3-error-handling.md` §1.3 `PAYLOAD_TOO_LARGE` 행
- **과거 결정 출처**: `spec/5-system/3-error-handling.md` Rationale 내 기존 413 관련 항목("413 `PAYLOAD_TOO_LARGE`(전역) 와 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(도메인) 공존")은 발행 레이어·임계 구분만 다루며, 에러 message 내용 정책(내부 원문 echo 여부)을 다루지 않는다.
- **상세**: 신규 추가 `**message** 는 내부 원문(`"request entity too large"` 등)을 echo 하지 않고 고정 문구 `"Request payload too large."` 만 반환한다(CWE-209 — 비-413 4xx http-error 는 `"The request could not be processed."`, 원문은 서버 로그에만)` 는 새로운 보안 정책(CWE-209 정보 노출 차단)을 규정한다. 기존 Rationale에서 이 정책이 명시적으로 거부되거나 다른 방향으로 결정된 선례가 없으므로, 기각된 대안의 재도입이나 합의된 invariant 위반에 해당하지 않는다. 다만 이 결정은 다른 에러 코드들의 message 정책(예: `VALIDATION_ERROR`의 고정 문자열 정책, `EXECUTION_INTERNAL_ERROR`의 generic fallback 등 CWE-209 방어 패턴들)과 일관한 추가 적용이다. Rationale에 "body-parser 413 내부 원문 미노출 이유" 항목이 없어 향후 검토자가 의도를 알기 어렵다.
- **제안**: `spec/5-system/3-error-handling.md` Rationale 에 "PAYLOAD_TOO_LARGE message 고정 문구 정책(CWE-209)" 항목 추가 — body-parser 원문 echo 를 차단하는 이유(내부 구현 정보 노출 차단)와 비-413 4xx http-error 에 대한 동일 정책 적용 범위를 명시하는 것이 권장된다. 이는 WebSocket `EXECUTION_INTERNAL_ERROR` 의 "고정 generic 문자열" 결정(`§1.5` + 실행엔진 Rationale)과 정합하는 서술이 된다.

---

## 요약

이번 변경(`spec/5-system/12-webhook.md` 에 `PublicWebhookThrottleGuard` DB 조회 실패 시 fail-open 명시, `spec/5-system/3-error-handling.md` 에 `PAYLOAD_TOO_LARGE` message 고정 문구 정책 추가)은 기존 Rationale에서 명시적으로 기각된 대안을 재도입하거나 합의된 설계 원칙을 직접 위반하지 않는다. 두 변경 모두 기존 방향과 일관한 방어적 설계 확장(Redis fail-open 패턴 확장, CWE-209 정보 누출 차단 패턴 일관 적용)이다. 다만 두 결정 모두 해당 spec의 Rationale 섹션에 근거 항목이 없어, 의도된 결정임을 문서화하는 보완이 권장된다.

## 위험도

LOW
