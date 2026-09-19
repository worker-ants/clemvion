# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `SMTP_BLOCK_PRIVATE_HOSTS` 라는 존재하지 않는 환경변수를 가리키는 주석이 두 곳에 복제돼 있고, 이번 PR 이 문서화한 실제 계약(`ALLOW_PRIVATE_HOST_TARGETS` 공유)과 모순된다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1594` (`testEmailTransport` 안, `isSmtpHostBlocked` 호출 직전 주석), `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts:176`
  - 상세: 두 호출부의 주석은 "SSRF 완화 (opt-in) — `SMTP_BLOCK_PRIVATE_HOSTS` 정책이 켜진 경우 사설/loopback host 를 차단" 이라고 적는다. 그런데 실제 구현(`codebase/backend/src/common/utils/smtp-host-guard.ts:17-18`)은 `SMTP_BLOCK_PRIVATE_HOSTS` 를 전혀 참조하지 않고 `process.env.ALLOW_PRIVATE_HOST_TARGETS === 'true'` 로 **opt-out**(기본 차단, true 로 끄는 방식) 을 구현하며, 그 파일 자신의 JSDoc 도 "http_request/database_query 와 동일 정책 — `ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out" 이라고 정확히 적는다. 이번 PR 은 정확히 이 3-way(HTTP·DB·Email) SSRF 가드 공유 서사를 CHANGELOG·MDX 가이드·`http-safety.ts`·`database-connection.ts` 여러 곳에 새로 명문화했는데(모두 "노드와 같은 SSRF 가드", "`ALLOW_PRIVATE_HOST_TARGETS=true` 예외" 라고 정확히 서술), 정작 email 쪽 호출부 주석 2곳만 다른(그리고 존재하지 않는) 플래그 이름·반대 방향(opt-in vs opt-out) 의미로 남아 있다. `git log -S`로 확인한 결과 이 주석은 PR #350(커밋 `f5a90993d`)에서 만들어진 것으로 이번 diff 가 직접 건드린 줄은 아니지만(같은 파일의 import 문 한 줄만 이번 PR 로 바뀜), 이번 PR 이 같은 파일·같은 테마(SSRF 플래그 통일)를 광범위하게 문서화하면서 인접한 이 모순을 놓쳤다.
  - 제안: 두 주석을 "SSRF 완화 (opt-out) — `ALLOW_PRIVATE_HOST_TARGETS=true` 가 아니면 사설/loopback host 를 차단" 으로 정정한다. 이번 PR 스코프 밖이라 판단되면 최소한 트래커에 등재해 다음 developer 턴에서 정정한다.

- **[INFO]** `PreviewTestDto.credentials` 필드의 JSDoc 짧은 주석이 바로 아래 갱신된 Swagger `description` 과 어휘가 어긋난다
  - 위치: `codebase/backend/src/modules/integrations/dto/integration.dto.ts` — 게이트 `172`(`/** 검증 대상 자격 증명 */`, 미변경 문맥 줄)와 그 아래 `175`(`@ApiProperty` 의 `description`, 이번 PR 로 변경됨)
  - 상세: 이번 PR 은 `description` 을 "테스트할 자격 증명(저장하지 않음). 필드 구조를 먼저 검증하고, MCP · Email · Database · HTTP 는 이 값으로 실제로 접속합니다." 로 갱신해 "이제 실제로 접속한다" 는 새 계약을 정확히 알렸다. 그런데 바로 위 필드 JSDoc(`/** 검증 대상 자격 증명 */`, Swagger 에는 노출되지 않고 IDE/코드 리더만 보는 주석)는 옛 "검증(validation)" 표현 그대로다. 소스만 훑는 개발자는 두 문구가 같은 필드를 가리키면서 하나는 "검증", 하나는 "테스트+실접속" 이라고 말하는 걸 보게 된다.
  - 제안: JSDoc 도 `/** 테스트할 자격 증명(저장 안 함) */` 정도로 맞춰 어휘를 통일한다.

- **[INFO]** `TestConnectionResultDto`(`:id/test`)의 `@ApiOkWrappedResponse` 설명이 형제 엔드포인트 `preview-test` 만큼 `code` 필드를 언급하지 않는다
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` — `testConnection()` 메서드의 `@ApiOkWrappedResponse(TestConnectionResultDto, { description: '연결 테스트 결과 (성공 여부, 메타 정보)' })` (게이트 `422`, 미변경)
  - 상세: 같은 PR 에서 `preview-test` 의 대응 설명은 "연결 테스트 결과 — 실패 시 `code` 로 원인을 구분합니다" 로 갱신됐다(게이트 `491`). 두 엔드포인트는 같은 `dispatchTest` 결과·같은 `code` 값 집합(`DB_*`·`HTTP_*` 등, 이번 PR 로 다섯 개 신설)을 돌려주므로 Swagger 문서만 보는 API 소비자 입장에서는 `:id/test` 쪽 설명이 상대적으로 덜 구체적이다. DTO 필드 자체의 JSDoc(`code?: string`)은 이미 갱신돼 있어 실질적 피해는 작지만, 대칭을 맞추면 Swagger UI 만 보는 소비자에게 더 유용하다.
  - 제안: `testConnection()` 의 `description` 에도 "실패 시 `code` 로 원인을 구분합니다" 를 추가해 preview-test 와 표현을 맞춘다.

## 우수 사례 (참고)

이번 PR 은 문서화 관점에서 전반적으로 매우 높은 완성도를 보인다 — 특히 아래는 그대로 유지할 가치가 있다:

- `CHANGELOG.md` 에 사용자 영향(«배포 뒤 보일 수 있는 것»), 관련 spec 절 번호(§5.3·§5.4·§9.2), 동시성 상한의 근거까지 명확히 기록.
- `codebase/backend/src/modules/integrations/database-connection-tester.ts` · `http-connection-tester.ts` · `nodes/integration/http-request/http-credentials.ts` · `nodes/integration/http-request/http-redirect.ts` · `nodes/integration/database-query/database-connection.ts` 모두 "왜 이 모듈이 의존성 없이 분리됐는지"(순환 import 회피), "실패 분류 기준", "던지지 않는다" 계약을 함수 상단 JSDoc 에 정확히 명시.
- `integrations.service.ts` 의 `CONNECTION_TEST_MAX_CONCURRENCY` 주석은 근거(libuv 스레드풀·실측 5.0초 `EAI_AGAIN`)까지 인용해 "왜 2인가" 를 반증 가능하게 남겼다.
- `integration-management.mdx` / `.en.mdx` 두 언어 가이드 모두 이번 기능(어떤 서비스가 실제 접속하는지, 대기 시간, SSRF 차단 시 동작)을 `<Callout>` 으로 동기화해서 반영 — 백엔드만 바뀌고 사용자 가이드가 낡는 흔한 실수를 피했다.
- 새 순수 함수(`clampMessage`, `resolveHttpCredentials`, `appendQueryParams`, `followRedirectsSafely`)마다 대응하는 `.spec.ts` 가 예제 겸 회귀 테스트 역할을 하고, `database-driver-sockets.spec.ts` 는 "왜 이 테스트가 필요한지"(비공개 드라이버 구조에 기대는 가정을 고정)까지 헤더 주석으로 설명.
- spec draft(`plan/in-progress/spec-draft-integration-db-test-waits.md`)는 정정 대상 문장·근거·비대상까지 깔끔하게 분리해 자기-반증형 소정정 절차를 충실히 따름.

## 요약

전체적으로 독스트링·CHANGELOG·다국어 사용자 가이드·API 문서(Swagger)가 이번 변경(Database·HTTP 연결 테스트 실접속화)을 매우 촘촘하게 동기화했다. 실질적 결함은 이번 diff 범위 밖(pre-existing)인 email 경로의 `SMTP_BLOCK_PRIVATE_HOSTS` 오기 주석 1건(2곳 복제, WARNING) 뿐이며, 나머지 두 건은 같은 필드/엔드포인트 쌍 사이의 표현 비대칭을 다듬으면 좋을 정도의 INFO 다. 문서화 관점에서 이 PR 을 막을 이유는 없다.

## 위험도

LOW
