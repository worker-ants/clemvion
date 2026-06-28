# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후)
대상: `spec/5-system/` (diff-base: origin/main)

변경 파일:
- `codebase/backend/src/common/filters/http-exception.filter.ts`
- `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`
- `codebase/backend/src/modules/auth/utils/client-ip.spec.ts`

---

## 발견사항

- **[INFO]** `http-exception.filter.ts` 4xx 에러 메시지 정적 치환 — spec 에 미반영
  - target 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` 107~120행 (변경된 `+` 라인)
  - 충돌 대상: `spec/5-system/3-error-handling.md §1.3 PAYLOAD_TOO_LARGE` · `spec/5-system/2-api-convention.md §5.3 에러 응답`
  - 상세: 변경 전 코드는 body-parser 등 http-errors 미들웨어가 throw 한 4xx의 `exception.message` 를 그대로 응답 `message` 필드로 내보냈다. 변경 후에는 413 → `"Request payload too large."`, 그 외 4xx → `"The request could not be processed."` 로 고정한다 (CWE-209 내부 정보 누출 차단). spec `3-error-handling.md §1.3` 은 413 에 대해 에러 `code = PAYLOAD_TOO_LARGE` 를 명시하지만 `message` 문자열 값은 규정하지 않는다. `2-api-convention.md §5.3` 의 예시 `message` 값들은 HttpException 계열을 상정한 것으로, http-errors 계열(body-parser 413 등) 메시지 포맷에 대한 명시적 계약은 spec 어디에도 없다. 충돌이 아니나, 정적 문자열이 spec 문서에 등재되지 않아 향후 구현자가 "이 message 값은 spec 어디서 왔나" 추적이 어려울 수 있다.
  - 제안: `spec/5-system/3-error-handling.md §1.3` 의 `PAYLOAD_TOO_LARGE` 행 설명에 "`message` 는 고정 문자열 `"Request payload too large."` 반환 (내부 body-parser 메시지 미노출 — CWE-209)" 한 줄을 추가하면 단일 진실 원칙에 부합한다. 코드 변경 불요.

- **[INFO]** `PublicWebhookThrottleGuard` fail-open 로그 레벨(`warn` → `error`) — 로그 레벨 정책 미규정
  - target 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` 74~83행
  - 충돌 대상: `spec/5-system/12-webhook.md §6` (공개 webhook Rate Limiting 설명)
  - 상세: webhook spec §6 은 "Redis 미가용 시 fail-open" 정도만 기술하고 로그 레벨 규정은 없다. 변경은 trigger 조회 실패(DB 장애)로 보호가 우회되는 상황을 `warn` 에서 `error` 로 승격해 모니터링 알람이 감지하도록 한다. 이는 스펙과 충돌하지 않는 구현 개선이다. spec 이 로그 레벨을 prescribe 하지 않으므로 충돌 없음.
  - 제안: 충돌 없음. 별도 조치 불요.

- **[INFO]** `extractClientIp` 로컬 래퍼 제거 — spec 단일 IP 추출 구현 정책에 부합
  - target 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` 153~170행 (제거된 `-` 라인)
  - 충돌 대상: `spec/5-system/1-auth.md §2.3 클라이언트 IP` · `codebase/backend/src/modules/auth/utils/client-ip.spec.ts`
  - 상세: auth spec §2.3 은 "본 신뢰 플래그는 IP 를 읽는 세 경로(세션·감사 IP `auth/utils/client-ip`, 공개 webhook rate-limit, `ip_whitelist` 검증)에 일관 적용한다"고 명시한다. 기존 로컬 `extractClientIp` 래퍼는 이미 `extractClientIpFromHeaders` 에 위임하는 pass-through 였고 동 파일 주석도 "04 후속: `auth/utils/client-ip` 단일 구현으로 통합해 사본 drift 방지"라고 명시돼 있었다. 제거는 spec 의 "단일 구현" 원칙에 더 정합하며, 동일 모듈 외부의 함수 호출로의 인라인화이므로 spec 계약 위반 없음.
  - 제안: 충돌 없음. 별도 조치 불요.

---

## 요약

이번 diff 는 `spec/5-system/` 영역과 직접 충돌하는 변경이 없다. `http-exception.filter.ts` 의 4xx 에러 메시지 정적화는 `3-error-handling.md §1.3` 및 `2-api-convention.md §5.3` 과 코드 문자열(413 message 값)에서 명시적 교차 기술이 없어 INFO 로 분류된다 — spec 이 `message` 값을 규정하지 않아 모순이 아니나, 추적 가능성을 위해 spec 한 줄 보완을 권장한다. `public-webhook-throttle.guard.ts` 의 로그 레벨 승격과 `extractClientIp` 래퍼 제거는 각각 webhook spec §6 의 fail-open 정책 및 auth spec §2.3 의 단일 IP 추출 구현 원칙과 정합하며 CRITICAL/WARNING 사항이 없다.

---

## 위험도

NONE
