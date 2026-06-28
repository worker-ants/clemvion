# 신규 식별자 충돌 검토

## 발견사항

충돌이나 경고에 해당하는 신규 식별자가 없습니다.

### 분석 대상 변경사항 요약

이번 diff 에서 실제로 도입된 신규 식별자는 다음과 같습니다.

| 변경 위치 | 신규/변경 식별자 | 종류 |
|-----------|----------------|------|
| `http-exception.filter.ts` | (없음 — 기존 `mapHttpErrorLike` 내부 return 값 변경) | — |
| `public-webhook-throttle.guard.ts` | `extractClientIp` 제거 (모듈-private, 미export) | 삭제 |
| `client-ip.spec.ts` | (테스트 케이스 2개 추가 — 신규 export 없음) | — |
| `spec/5-system/3-error-handling.md` | `"Request payload too large."` / `"The request could not be processed."` — 고정 메시지 문자열(spec 기술 추가) | spec 기술 |
| `spec/5-system/12-webhook.md` | (기존 Rate Limiting 항목 설명 보강, 신규 식별자 없음) | — |

### 검토 결과

**요구사항 ID 충돌**: 신규 요구사항 ID 없음. 기존 ID(`PAYLOAD_TOO_LARGE`, `PUBLIC_WEBHOOK_RATE_LIMIT`, `PUBLIC_WEBHOOK_HOURLY_LIMIT` 등) 의 **설명 보강**이며, 새로운 코드·이름의 도입이 아님.

**엔티티/타입명 충돌**: 신규 엔티티·DTO·인터페이스 없음.

**API endpoint 충돌**: 신규 endpoint 없음.

**이벤트/메시지명 충돌**: 신규 이벤트 이름 없음.

**환경변수·설정키 충돌**: 신규 ENV var / config key 없음.

**파일 경로 충돌**: 신규 파일 없음. 기존 2개 spec 파일의 행 수정, 기존 3개 코드 파일의 수정.

**`extractClientIp` 이름 정리 (참고)**:
- 이번 변경이 `public-webhook-throttle.guard.ts` 에서 모듈-private 함수 `extractClientIp` 를 **삭제**했다. 이 함수는 `export` 키워드가 없어 외부로 노출되지 않았고, 실제로 이 파일로부터 `extractClientIp` 를 import 하는 파일은 존재하지 않는다(`hooks.controller.ts` 가 이 파일에서 import 하는 것은 `PublicWebhookThrottleGuard` 와 `PublicWebhookReqExtension` 뿐). 같은 이름의 `extractClientIp` 는 `auth/utils/client-ip.ts` 에서 별도로 export 되어 auth/sessions 영역에서 사용 중이나, 두 함수는 독립적인 모듈 스코프에 있었고, guard 의 로컬 버전 삭제로 혼동 요소가 줄었다. 충돌 이슈 아님.

## 요약

이번 변경(spec 2개 보강 + 코드 3개 수정)에서 새로 도입된 식별자는 없다. 기존 `PAYLOAD_TOO_LARGE` 에러 코드 항목의 설명 보강, webhook 보안 로깅 정책 명시, 모듈-private 함수 삭제, 고정 메시지 문자열 도입 등 모두 기존 식별자 체계 안에서의 변경이며, 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수·파일 경로 어떤 차원에서도 충돌이 발생하지 않는다.

## 위험도

NONE
