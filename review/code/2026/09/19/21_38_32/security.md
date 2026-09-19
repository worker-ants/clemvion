# 보안(Security) 리뷰 — SSRF 가드 통합 (SMTP · HTTP · DB)

## 개요

이 변경은 통합 노드(HTTP Request · DB Query · Send Email)의 SSRF 가드를 하나(`http-safety.ts`)로
합치고, 두 가지 실측된 우회를 막는다:

1. **IPv4-mapped IPv6 우회** (`http-safety.ts`) — `http://[::ffff:127.0.0.1]/` 형태(정규화된 hex 형·괄호 없는
   점 형·전체 형·대문자)가 실제로 127.0.0.1 전용 바인드 서버에 도달함을 실측(macOS · `node:24-alpine`)하고,
   `canonicalIPv6()` + `mappedIPv4()` 로 IPv4-mapped 주소를 품은 IPv4 대역으로 판정하도록 고쳤다. HTTP Request ·
   DB Query 노드 및 두 서비스의 연결 테스트가 이 함수를 공유한다.
2. **SMTP 가드의 CGNAT/`::` 우회** — 기존 `common/utils/ssrf.util.ts` 기반 SMTP 가드는 CGNAT(`100.64.0.0/10`)와
   IPv6 unspecified(`::`)를 차단하지 못했다. 새 `nodes/integration/send-email/smtp-host-guard.ts` 는 HTTP/DB 와
   동일한 `http-safety.ts` 판정 로직(`assertSafeOutboundHostResolved`)을 재사용해 대역을 통일한다.

코드·테스트를 `Read` 로 직접 확인했다(`http-safety.ts`, `smtp-host-guard.ts` 신/구 양쪽, `integrations.service.ts`
`testEmailTransport`/`dispatchTest` 주변, `send-email.handler.ts`, 각 `.spec.ts`, e2e `integration-connection-test.e2e-spec.ts`).
저장소 트리에 뮤테이션은 가하지 않았다(`git status --short` 로 확인, 세션 시작 시 존재하던 `review/code/2026/09/19/21_38_32/`
untracked 항목 외 변경 없음).

## 발견사항

- **[INFO]** DNS rebinding 2차 공격(체크와 실제 connect 사이의 TOCTOU) 잔존 — 신규 결함 아님, 문서화·수용된 한계
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` — `assertSafeOutboundHostResolved` 함수 상단 JSDoc(`**Race window**: a sufficiently fast attacker can flip DNS...`)
  - 상세: `assertSafeOutboundHostResolved` 는 가드 시점에 1회 DNS 조회 후 IP 를 검사하지만, 실제 `nodemailer`/`fetch` 연결은 별도로 DNS 를 재조회한다. 공격자가 자신이 통제하는 DNS 응답을 가드 조회 시점과 연결 시점 사이에 바꾸면(rebinding) 우회할 수 있다. 이번 diff 가 SMTP 경로에도 같은 로직을 적용하면서 이 알려진 한계를 공유하는 소비자가 하나 늘었다. 다만 함수 JSDoc·`plan/in-progress/ssrf-guard-integration-unify.md` §비대상에 명시적으로 문서화되어 있고 egress 방화벽으로 보완하도록 안내한다 — 은닉된 갭이 아니라 정직하게 공개된 잔여 위험이다.
  - 제안: 현재 문서화 수준으로 충분. 실제 운영에서 egress 방화벽(사설 대역 아웃바운드 차단)이 이 가드의 필수 보완책임을 재확인.

- **[INFO]** `ssrf.util.ts`(LLM 프로바이더 · S3) 는 이번 통합 대상에서 제외되어 CGNAT·`::` 를 여전히 통과시킴
  - 위치: `codebase/backend/src/common/config/s3.config.ts`, `codebase/backend/src/modules/llm/llm-preview.service.ts`, `codebase/backend/src/modules/model-config/model-config.service.ts` (모두 `ssrf.util` 사용, 이번 diff 미포함)
  - 상세: `plan/in-progress/ssrf-guard-integration-unify.md` §비대상에서 의도적으로 명시한 제외다 — LLM 쪽엔 `ALLOW_PRIVATE_HOST_TARGETS` 같은 opt-out 이 없어 CGNAT 를 더하면 Tailscale 등 정상 사용 사례가 막힐 수 있다는 제품 판단이 필요하다는 이유. 신규 결함이 아니라 기존 결함이며 트래커 등재가 계획돼 있다(체크리스트 미완료 항목). 보안 관점에서는 LLM 프로바이더 URL/S3 엔드포인트에 CGNAT·`::` 를 가리키는 값을 넣으면 여전히 SSRF 가 통한다는 사실은 남아 있으므로, 트래커 등재가 실제로 이뤄지는지 후속 확인이 필요하다.
  - 제안: 이번 PR 범위 밖이므로 이 PR 자체를 막을 사유는 아니다. plan 체크리스트 마지막 항목("트래커 두 항목 해소 + `ssrf.util` 항목 등재")이 실제로 완료되는지 후속 세션에서 확인 권장.

- **[INFO]** 차단 사유 메시지의 정찰 정보 축소 — 올바르게 구현됨(결함 아님, 확인용 기록)
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` `SSRF_BLOCKED_CLIENT_MESSAGE` JSDoc, `integrations.service.ts` `testEmailTransport`(`EMAIL_HOST_BLOCKED`), `send-email.handler.ts` (`EMAIL_HOST_BLOCKED`)
  - 상세: 내부 `Error('SSRF_BLOCKED: hostname "..." resolves to restricted IP "...")` 는 차단된 IP/호스트를 담지만, `isSmtpHostBlocked()` 가 이를 boolean 으로 흡수해 상세 메시지를 폐기하고, 클라이언트/usage-log(Activity API 로 노출)에는 IP 를 포함하지 않는 일반화 문구만 전달한다. `integration-connection-test.e2e-spec.ts` 의 신규 B2 케이스가 `expect(data.message).not.toMatch(/ffff|100\.64|127\.0\.0\.1/)` 로 이를 회귀 테스트한다. CWE-209(정보 노출을 통한 정찰) 관점에서 올바른 설계다.
  - 제안: 없음(정상 동작 확인).

- **[INFO]** `smtp-host-guard.ts` 가 "SSRF_BLOCKED 아닌 오류는 그대로 재던짐" — fail-open/fail-closed 모두 아닌 propagate, 의도적 설계
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` — `isSmtpHostBlocked` 의 `catch (err)` 블록
  - 상세: `assertSafeOutboundHostResolved` 내부에서 DNS 조회 실패는 이미 fail-open 으로 흡수되므로(즉시 `return`), 이 재던짐 경로는 실제로는 도달하기 어렵다(spec 도 `jest.doMock` 으로만 인위 재현). 다만 재던진 오류가 `testEmailTransport`/`SendEmailHandler` 호출부의 try/catch 밖에 있어(SSRF 체크가 `try` 진입 전) 예기치 못한 예외가 상위(NestJS 전역 예외 필터 등)로 전파된다. 실질 도달 가능성은 낮지만, 상위 예외 필터가 `err.message` 를 그대로 클라이언트에 노출하지 않는지 재확인할 가치는 있다(이번 diff 범위 밖의 기존 전역 설정에 의존).
  - 제안: 별도 조치 불요 — 다만 전역 예외 필터가 프로덕션에서 스택트레이스/내부 메시지를 감추는지(NestJS 기본 `HttpExceptionFilter` 관례) 별도 확인은 이 리뷰 범위 밖이므로 언급만.

## 요약

이번 diff 는 실제로 존재했던 두 개의 SSRF 우회(HTTP/DB 의 IPv4-mapped IPv6 표기 우회, SMTP 의 CGNAT/`::` 우회)를
실측(다른 OS 두 곳에서 소켓 레벨 도달 여부 확인)에 기반해 닫는 순net 보안 개선이다. 판정 로직(`canonicalIPv6`,
`mappedIPv4`, 확장된 `PRIVATE_V4_RANGES`)은 정규식이 유계(bounded)이고 ReDoS 소지가 없으며, IPv4/IPv6 양쪽에서
경계값(대역 시작/끝 바로 안팎)까지 단위 테스트로 커버한다. 차단 사유는 서버 로그에만 상세 IP 를 남기고 클라이언트·
usage-log 노출 경로에는 일반화된 문구만 전달해 정보 노출(CWE-209)을 방지하며, 이를 e2e 로도 회귀 방지한다.
`ALLOW_PRIVATE_HOST_TARGETS` opt-out 은 세 경로(HTTP/DB/SMTP) 모두 동일 플래그를 공유해 posture 일관성이 유지된다.
새로 도입되거나 강화된 코드에서 인젝션·하드코딩 시크릿·인증 우회·안전하지 않은 암호화 관련 결함은 발견하지
못했다. 남은 잔여 위험(DNS rebinding TOCTOU, `ssrf.util` 미통합 LLM/S3 경로)은 모두 이번 diff 이전부터 존재했고
문서·플랜에 정직하게 기록되어 있어 은닉된 갭이 아니다.

## 위험도

NONE
