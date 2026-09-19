# Security Review — Database · HTTP 연결 테스터 (integration-testers-5c2d91)

## 발견사항

- **[WARNING]** `preview-test` 가 인증된 아무 사용자에게나 실제 외부 네트워크 호출을 시켜 주는 오라클이 됐다 — 이번 PR 로 대상이 Database · HTTP 까지 넓어짐
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:158-178` (`previewTest` — `@Throttle` 만 있고 워크스페이스·역할 검사 없음), `codebase/backend/src/modules/integrations/integrations.service.ts:1533-1556` (`dispatchTest` — 구조 검증만 통과하면 바로 실제 접속)
  - 상세: `POST /api/integrations/preview-test` 는 (JWT 인증은 요구하지만) 워크스페이스 소속 검사도 역할 검사도 없이 분당 20회 제한만 걸려 있다. 이 PR 이전에는 MCP·Email 만 실제 접속했는데, 이제 Database·HTTP 도 추가돼 로그인한 아무 사용자나(같은 서버의 다른 워크스페이스 사용자 포함) 서버를 경유해 임의의 공개 host:port 에 대해 "연결 성공/인증 거부/타임아웃/TLS 실패"를 구분해 받아볼 수 있다 — 제한적 포트 스캔·오라클로 악용 가능한 표면이다. 사설/loopback 대역은 SSRF 가드(`assertSafeOutboundHostResolved`)가 막으므로 내부망 도달은 차단되지만, 외부 인터넷 자원에 대한 정찰에는 그대로 노출된다. `:id/test`(`integrations.controller.ts:414-430`)도 같은 `dispatchTest` 를 타지만 워크스페이스 멤버십은 요구하므로 인가 경계는 더 좁다.
  - 참고: 이 이슈는 이번 diff 안의 `plan/in-progress/spec-draft-nullable-notation-followups.md` (항목 "preview-test 가 인증된 사용자의 외부 연결 오라클이다") 에 developer 가 이미 등재해 planner 결정을 기다리는 상태다 — 신규 발견이 아니라 이번 PR 로 표면이 넓어졌다는 점을 재확인하는 것이다.
  - 제안: 이미 트래커에 있는 선택지(워크스페이스 컨텍스트 요구 / 연결 실패 메시지 일반화 / 받아들인 위험으로 spec Rationale 화) 중 하나를 planner 턴에서 결정.

- **[INFO]** 연결 실패 메시지가 드라이버·네트워크 원문을 (길이만 제한해) 그대로 클라이언트에 돌려준다
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:157-162` (`message: clampMessage(err instanceof Error ? err.message : String(err))`), `codebase/backend/src/modules/integrations/http-connection-tester.ts:143-147` (`describeFailure` → `clampMessage`)
  - 상세: `DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED` 실패 메시지는 pg/mysql2 드라이버 또는 Node `fetch`/`AbortController` 가 낸 원문 오류 문자열을 `MCP_ERROR_MESSAGE_MAX_LEN` 자로만 자를 뿐 내용은 그대로 노출한다(예: TLS 협상 실패 상세, `cause` 체인의 connect 시도 주소:포트). SSRF 차단(`DB_HOST_BLOCKED`/`HTTP_BLOCKED`)은 의도적으로 일반화 문구를 쓰는 것과 대조적으로, 그 밖의 실패는 진단성을 위해 원문을 그대로 흘려보낸다는 설계 선택이다. Email 테스터(`testEmailTransport`)도 이미 같은 패턴이라 이 PR 이 새로 연 것은 아니지만, DB·HTTP 로 확장되며 노출 표면이 늘었다.
  - 참고: 이 항목도 위 `preview-test` WARNING 과 같은 트래커 항목에서 "연결 실패 메시지 일반화(진단성과 맞바꿈)"으로 이미 선택지에 올라 있다.
  - 제안: 위 WARNING 결정과 묶어서 처리 — 별도 조치 불요.

- **[INFO]** 연결 테스트 동시 상한이 걸렸으나 대기열 자체엔 길이 제한이 없다(이미 트래커에 낮음으로 등재)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:128` (`CONNECTION_TEST_MAX_CONCURRENCY = 2`), `:410` (`connectionTestLimit = pLimit(...)`), `:1550`/`:976` (`dispatchTest`/`testConnection` 이 `connectionTestLimit` 을 통과)
  - 상세: 이 PR 이 이전 라운드의 CRITICAL(`dns.lookup` 이 libuv 스레드풀을 다 채워 무관한 `fs`/`crypto`/`zlib` 작업까지 멈춤)을 동시 실행 상한 2로 완화한 것은 확인했다 — 이번 세 파일(`database-connection-tester.ts`/`http-connection-tester.ts`/`integrations.service.ts`) 모두 이 한 줄을 공유하도록 배선돼 있다. 다만 `pLimit` 대기열엔 상한이 없어, 한 사용자가 응답 없는 host 를 겨눈 연결 테스트를 반복 제출하면(같은 워크스페이스가 아니어도) 연결 테스트 기능 전체(다른 사용자 몫 포함)가 느려질 수 있다 — 프로세스 전체를 멈추던 원래 CRITICAL 보다는 훨씬 좁다.
  - 참고: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 developer 가 낮음 우선순위로 이미 등재(동시 상한 뒤 잔여 항목 (1)).
  - 제안: 추가 조치 불요 — 이미 추적 중.

## 정합성 확인 (문제 없음으로 판정)

- SSRF 가드가 Database(`assertSafeOutboundHostResolved(creds.host)`, `database-connection-tester.ts:135-146`)와 HTTP(`outboundBlockReason`, `http-redirect.ts:24-32` — 리터럴 검사 + DNS 해석 검사 이중)에 동일하게, 그리고 리다이렉트 매 홉(`followRedirectsSafely`, `http-redirect.ts:48-73`)에도 재적용되어 공개 host → 내부 host 리다이렉트로 첫 검사를 우회하는 경로가 막혀 있다.
- 차단된 host/IP 원문은 `logger.warn`(서버 로그)에만 남고 클라이언트 응답은 일반화 문구(`DB_HOST_BLOCKED_MESSAGE`/`SSRF_BLOCKED_CLIENT_MESSAGE`)만 받는다 — CWE-209(에러 메시지를 통한 정보 노출) 완화가 SSRF 경로에 일관되게 적용됨.
- Database 자격증명은 `SELECT 1` 리터럴만 실행하고 사용자 입력을 SQL 문자열에 연결하지 않는다 — SQL 인젝션 벡터 없음. host/port/username/password/database 는 드라이버 연결 옵션 객체로만 전달된다.
- `buildPgConnection`(`database-connection.ts:28-53`)이 `ssl: 'require'|'verify-full'` 에 `rejectUnauthorized: true` 를 강제 — 이 PR 은 기존 로직을 파일만 이동했을 뿐 완화하지 않았다(주석에 "MITM exposure 때문에 `rejectUnauthorized:false` 로 기본값을 두지 않기로 했다"는 근거가 그대로 남아 있음).
- 하드코딩된 시크릿(API 키·비밀번호·토큰) 없음 — spec/test 파일의 `s3cret-pw`, `clemvion-e2e` 등은 로컬/CI 전용 fixture 자격증명.
- `http-credentials.ts` 의 Basic 인증 인코딩(`Buffer.from(...).toString('base64')`), Bearer 헤더 조립 등 표준적이며 별도 취약점 없음.
- 연결 테스트가 닫힐 때(`closeWithin`, `database-connection-tester.ts:34-62`) 상한을 넘기면 소켓을 강제 파괴 — 응답하지 않는 악성/오작동 서버가 동시 상한 슬롯을 영구 점유하는 것을 막는다(자원 고갈 완화).
- `clamp-message.ts` 는 순수 문자열 길이 제한 함수로 그 자체엔 취약점 없음.

## 요약

이번 PR 은 Database·HTTP 통합의 연결 테스트에 SSRF 가드(리터럴+DNS 해석, 리다이렉트 매 홉 재검증)·TLS 인증서 검증·동시 실행 상한(이전 라운드 CRITICAL 대응)을 일관되게 적용했고, SQL 인젝션·하드코딩 시크릿·안전하지 않은 암호화 같은 전형적 취약점은 발견되지 않았다. 다만 인증된 사용자가 워크스페이스 검사 없이 `preview-test` 를 통해 실제 외부 host 에 접속을 시도하고 그 결과(연결 성공/인증 거부/타임아웃/TLS 실패, 그리고 원문에 가까운 실패 메시지)를 구분해 받아볼 수 있는 표면이 이번 PR 로 Database·HTTP 까지 넓어졌다 — 이는 이미 이 브랜치의 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 developer 가 planner 결정 대기 항목으로 등재해 둔 리스크이며, 신규 미발견 사항이 아니라 범위 확장을 재확인하는 것이다. Critical 급 결함은 없다.

## 위험도

LOW
