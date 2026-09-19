# API 계약(API Contract) 리뷰

## 개요

이번 변경은 통합 노드(HTTP Request / DB Query / Send Email)의 SSRF 가드를 `nodes/integration/http-request/http-safety.ts` 하나로 통합하고, IPv4-mapped IPv6 표기(`::ffff:a.b.c.d`)를 품은 IPv4 대역으로 판정하도록 보강한 보안 버그 수정이다. REST 컨트롤러·DTO·라우트·버전·인증/인가는 이번 diff에 포함되어 있지 않다(`integrations.controller.ts` 자체는 변경 없음, `integrations.service.ts`/`send-email.handler.ts`는 import 경로 교체 + 주석 정정만). 따라서 API 표면(엔드포인트 시그니처) 자체에 대한 계약 변경은 없고, 검토 초점은 "동일 엔드포인트가 특정 입력에 대해 이제는 다른 결과를 반환한다"는 동작 계약 변경 여부다.

## 발견사항

- **[WARNING]** 하위 호환성 — 기존에 통과하던 host 값들이 이제 동일 엔드포인트에서 차단 응답으로 바뀐다
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` (전체, 신규 파일) · `codebase/backend/src/nodes/integration/http-request/http-safety.ts` 함수 `isBlockedIPv6`/`mappedIPv4`(게이트 101~114)
  - 상세: 종전 SMTP 가드(`ssrf.util` 기반)는 CGNAT(`100.64.0.0/10`)와 `::`를 통과시켰고, 종전 HTTP/DB 가드(`http-safety.ts`)는 IPv4-mapped IPv6 표기(`::ffff:127.0.0.1` 등 여러 모양)를 통과시켰다. 이번 변경으로 `POST /api/integrations/preview-test`, `POST /api/integrations/:id/test`, 실제 `send_email` 발송 실행이 **같은 입력값에 대해 이전에는 success 또는 다른 오류였다가 이제는 `EMAIL_HOST_BLOCKED`/`HTTP_BLOCKED`/`DB_HOST_BLOCKED`로 차단**된다. 이미 저장된 `Integration` 레코드가 CGNAT 대역(예: Tailscale `100.64.0.0/10`) SMTP 릴레이나 IPv4-mapped 표기의 내부 HTTP/DB 엔드포인트를 가리키고 있었다면, 코드 배포 시점부터 별도 요청 변경 없이 연결 테스트·발송이 조용히 실패로 전환된다.
  - 참고: 이는 spec(`4-integration.md §5.5`, `3-send-email.md §4`, `1-http-request.md §4`)이 원래 요구하던 차단 범위를 코드가 놓치고 있던 것을 바로잡는 **의도된 보안 수정**이며, `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 경로도 그대로 유지된다(신규 규약 도입이 아님). 새 에러코드도 도입하지 않고 기존 `EMAIL_HOST_BLOCKED`/`HTTP_BLOCKED`/`DB_HOST_BLOCKED`를 그대로 재사용해 응답 스키마 자체는 안정적이다. 다만 "버그 수정"이라는 성격과 별개로, 이미 그 범위의 host 로 설정된 self-host 배포에는 실질적인 breaking behavior change 다.
  - 제안: 이번 PR 범위(코드만 spec 에 맞춤, `spec_impact: none`)와는 별개로, 릴리스 노트/변경 로그에 "CGNAT·IPv4-mapped 표기의 통합 host 가 이제 기본 차단되며, 필요 시 `ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out 하라"는 안내를 남기는 것을 권한다. (plan 문서 `plan/in-progress/ssrf-guard-integration-unify.md` 자체는 이 사실을 실측·인지하고 있음 — 코드 결함은 아니고 커뮤니케이션 갭 가능성만 지적)

- **[INFO]** 에러 응답 형식·상태 코드는 기존 컨벤션을 정확히 재사용 — 회귀 없음
  - 위치: `codebase/backend/test/integration-connection-test.e2e-spec.ts` 신규 `it.each` 블록(게이트 120~169), 기존 테스트 A(게이트 76 부근)·B(게이트 94 부근)와 동일 패턴
  - 상세: 신규 B2 케이스도 기존 A/B 케이스와 동일하게 HTTP 상태는 `[200, 201]` 범위를 유지하면서 `res.body.data = {success:false, code, message}` 봉투를 쓰고, `message`에 차단 대상 host/IP 문자열을 담지 않음을 정규식으로 확인한다(`/ffff|100\.64|127\.0\.0\.1/` 미포함). 신규 에러코드를 만들지 않고 기존 3종(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`)을 그대로 사용해 클라이언트 파싱 로직에 영향이 없다.

- **[INFO]** `testEmailTransport`의 SSRF 가드 호출이 try/catch 밖에 있어, 가드가 SSRF 판정이 아닌 오류를 던지면 구조화된 `{success,false,code,message}` 응답 대신 처리되지 않은 예외로 전파될 수 있음(현재는 관찰되지 않는 이론적 경로)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `testEmailTransport` 내 `if (await isSmtpHostBlocked(credentials.host as string))`(게이트 1596). 바로 아래 `transporter.verify()` 호출은 `try/catch`로 감싸 실패 시 `EMAIL_CONNECT_FAILED`로 정상 변환하지만, 가드 호출 자체는 감싸여 있지 않다.
  - 상세: 신규 `smtp-host-guard.ts`(게이트 17~30, `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts`)는 "SSRF 판정이 아닌 오류는 그대로 던진다"는 동작을 명시적으로 테스트로 고정했다(`smtp-host-guard.spec.ts` "SSRF 판정이 아닌 오류는 «막힘»으로 바꾸지 않고 그대로 던진다"). 반면 `send-email.handler.ts`에서는 같은 호출이 넓은 `try` 블록 안에 있어(게이트 158 부근) 예외가 안전하게 `IntegrationError`로 흡수되는 반면, `integrations.service.ts`의 `testEmailTransport`에서는 그렇지 않다. 현재 `assertSafeOutboundHostResolved`는 `SSRF_BLOCKED:` 접두 오류만 던지므로 실제로는 트리거되지 않으나(관찰 가능한 회귀 아님), 가드 구현이 향후 더 많은 오류 유형을 던지도록 바뀔 경우 `preview-test`/`:id/test` 엔드포인트가 표준 에러 응답 봉투를 벗어난 처리되지 않은 예외(500)를 반환할 수 있는 비대칭 지점이다.
  - 제안: 이번 PR 스코프는 아니지만, 후속으로 `testEmailTransport`의 가드 호출도 `send-email.handler.ts`처럼 넓은 try 안에 두거나 별도 catch 로 감싸 응답 봉투 일관성을 방어적으로 보장하는 것을 권한다.

- **[INFO]** 내부 모듈 경로 변경(`common/utils/smtp-host-guard` → `nodes/integration/send-email/smtp-host-guard`)은 공개 API 표면이 아님
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts`(게이트 13), `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts`(게이트 24)
  - 상세: grep 확인 결과 옛 경로(`common/utils/smtp-host-guard`)를 참조하는 잔여 코드는 없다(파일 자체가 삭제됨). REST 라우트·DTO·버전·인증에는 영향 없는 순수 내부 리팩터링.

## 점검했으나 해당 없음

- **버전 관리**: 엔드포인트 버전 표기·변경 없음.
- **요청 검증**: 요청 바디 스키마(`PreviewTestDto` 등) 변경 없음 — 검증 로직(`validateCredentials`)은 이번 diff 대상이 아님.
- **URL/경로 설계, 페이지네이션**: 신규/변경 라우트 없음, 목록 API 아님.
- **인증/인가**: 컨트롤러·가드 데코레이터 변경 없음.

## 뮤테이션 검증

이번 리뷰에서는 저장소 파일을 수정하지 않았다(`git status --short` 결과 리뷰 산출물 디렉터리 외 변경 없음). 별도 뮤테이션 테스트는 수행하지 않았다 — 정적 분석(코드 대조 + grep)만으로 판단 가능한 범위였다.

## 요약

이번 변경은 REST API 표면(라우트·DTO·버전·인증·페이지네이션)에는 손을 대지 않는 내부 SSRF 가드 통합/버그 수정으로, 에러 코드(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`)와 응답 봉투(`{success, code, message}`)를 기존 컨벤션 그대로 재사용해 신규 계약을 도입하지 않는다. 다만 CGNAT·IPv4-mapped 표기를 쓰던 기존 통합 설정에는 동일 요청이 이제 차단 응답으로 바뀌는 실질적 동작 변화(의도된 보안 수정)가 있어 커뮤니케이션 측면의 WARNING으로 기록했고, `testEmailTransport`의 가드 호출이 다른 호출부와 달리 try/catch 밖에 있는 비대칭은 현재는 무해하지만 향후 방어적으로 정리할 만한 INFO로 남긴다. CRITICAL 은 없다.

## 위험도

LOW
