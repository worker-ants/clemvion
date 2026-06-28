# 신규 식별자 충돌 검토 결과

검토 대상: `spec/5-system/` (impl-done, diff-base=origin/main)
실제 코드 변경 파일: `hooks.service.ts`, `public-webhook-throttle.guard.ts`, `http-exception.filter.ts`, 관련 spec 파일들

---

## 발견사항

신규 식별자 충돌 없음. 아래는 상태 확인 결과다.

### [INFO] `PublicWebhookReqShape` — 신규 exported interface (충돌 없음)

- target 신규 식별자: `PublicWebhookReqShape` (`public-webhook-throttle.guard.ts` L160)
- 기존 사용처: `PublicWebhookReqExtension` 이 동일 파일에 이미 존재하며 `hooks.controller.ts` 가 import
- 상세: `PublicWebhookReqShape extends PublicWebhookReqExtension` 형태로 신규 interface 가 기존 interface 를 상속한다. 두 이름이 비슷하나 역할이 명확히 구분된다 — `PublicWebhookReqExtension` 은 guard 가 주입하는 필드(`__publicWebhookTrigger`), `PublicWebhookReqShape` 는 guard 내부에서 `getRequest<>` 로 읽는 최소 req 형태(params, headers, body, rawBody + Extension). `hooks.controller.ts` 는 `PublicWebhookReqExtension` 을 계속 import 하고 있어 표면 충돌 없음.
- 제안: 없음. 명명이 역할을 잘 구분한다.

### [INFO] `UNKNOWN_ERROR_MESSAGE` / `UNHANDLED_ERROR_MESSAGE` — private static 상수 (충돌 없음)

- target 신규 식별자: `GlobalExceptionFilter.UNKNOWN_ERROR_MESSAGE`, `GlobalExceptionFilter.UNHANDLED_ERROR_MESSAGE`
- 기존 사용처: 동일 파일의 인라인 문자열 리터럴을 대체하는 것이며, `private static readonly` 라 외부 노출 없음. 코드베이스 전체 grep 결과 다른 파일에서 동일 이름의 상수·키 없음.
- 상세: 두 상수는 의미가 명확히 다름 — `UNKNOWN_ERROR_MESSAGE` 는 비-`Error` throw fallback, `UNHANDLED_ERROR_MESSAGE` 는 내부 `Error` 마스킹. 클래스 스코프 private 이라 외부 식별자 공간에 노출되지 않음.
- 제안: 없음.

### [INFO] 로컬 `extractClientIp` 래퍼 제거 — 기존 전역 `extractClientIp` 와 이름 충돌 해소

- target 변경: `hooks.service.ts` 하단의 로컬 private 함수 `extractClientIp` 삭제
- 기존 사용처: `auth/utils/client-ip.ts` 에 공용 `extractClientIp(req: Request)` 가 존재하며 `auth.controller.ts`, `sessions.controller.ts`, `webauthn.controller.ts`, `auth-context.ts` 가 import 해 사용 중
- 상세: 삭제 전에는 `hooks.service.ts` 파일 내에 동일 이름의 로컬 wrapper 함수(`extractClientIp(headers)`)가 있었고, 이것이 모듈 외부 공용 `extractClientIp(req)` 와 시그니처가 달라 혼동 여지가 있었다. 이번 변경으로 로컬 래퍼를 제거하고 `extractClientIpFromHeaders` 를 직접 호출하므로 이름 충돌이 해소됨.
- 제안: 없음. 개선 방향.

### [INFO] 신규 plan 파일 경로 충돌 없음

- target 신규 파일: `plan/in-progress/webhook-hardening-cleanup.md`, `plan/in-progress/webhook-public-ip-failopen-hardening.md`
- 기존 사용처: 동일 이름의 파일 없음. 기존 `plan/in-progress/` 에 유사 prefix(`webhook-`) 파일 없음.
- 상세: 파일명 컨벤션(kebab-case, 도메인-동사-대상 패턴)과 일치. 교차 참조 충돌 없음.
- 제안: 없음.

---

## 요약

이번 변경(hooks.service 로컬 `extractClientIp` 래퍼 제거, `PublicWebhookReqShape` 신규 interface, `UNKNOWN/UNHANDLED_ERROR_MESSAGE` 상수화, plan 파일 2건 신설)에서 도입된 신규 식별자는 기존 코드베이스·spec·plan 의 어떤 식별자와도 의미적 충돌을 일으키지 않는다. `PublicWebhookReqExtension` 과 `PublicWebhookReqShape` 는 상속 관계로 역할이 명확히 분리되며, 로컬 래퍼 제거는 오히려 기존 동명 함수와의 혼동을 해소한다.

---

## 위험도

NONE
