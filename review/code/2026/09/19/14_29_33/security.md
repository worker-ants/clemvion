# 보안(Security) Review — Database · HTTP 연결 테스터 (1라운드 수정 반영본)

이번 diff 는 `review/code/2026/09/19/13_58_22` 보안 리뷰 뒤 커밋 `eebf0286a`(동시 상한 · rotate 부분 저장 ·
리다이렉트 추종 공유)가 적용된 상태를 다시 검토한 것이다. 아래는 그 라운드에서 이미 지적·처분된 항목을
재검증한 결과와, 이번 스냅샷에서 새로 확인한 사항이다.

## 발견사항

- **[WARNING]** `POST /api/integrations/preview-test` 가 여전히 workspace/role 검증 없이 Database·HTTP 에 실제 outbound 연결을 만드는 오라클이다 — **1라운드에서 이미 지적됐고 의도적으로 트래커로 유예된 항목**(신규 아님, 완결 여부만 재확인)
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` `previewTest()`(159~178행, `@Post('preview-test')` — `@WorkspaceId()`/`@Roles()` 데코레이터 없음. 형제 엔드포인트 `:id/test`(427~432행)·`:id/rotate`(434행 이하, `@Roles('editor')`)는 `@WorkspaceId()`를 받는다), `codebase/backend/src/modules/integrations/integrations.service.ts` `previewTest()`(980~983행 — `dispatchTest`에 workspaceId 를 전달하지 않는다) → `dispatchTest()`(1525행) → `transportTesters.get('database'|'http')`(1540~1542행, 이번 PR 이 등록)
  - 상세: 전역 `JwtAuthGuard` 인증만 통과하면(워크스페이스 소속 무관) 임의의 사용자가 `serviceType: 'database'|'http'` 로 임의의 `host:port`를 지정해 분당 20회(사용자별 throttle) 실제 TCP 연결을 시도할 수 있다. 사설/loopback 대역은 SSRF 가드가 막지만 공인 대역은 통과하며, 응답은 `DB_HOST_BLOCKED`(차단) / `DB_AUTH_FAILED` / `DB_CONNECT_FAILED`(드라이버 원문, 길이만 clamp) 또는 `HTTP_AUTH_FAILED`/`HTTP_SERVER_ERROR`/`HTTP_CONNECT_FAILED` 로 갈려 열린 포트·닫힌 포트·타임아웃·TLS 실패를 구분할 수 있는 오라클이 된다. `review/code/2026/09/19/13_58_22/security.md` WARNING 과 동일 근거이며, 같은 세션 `RESOLUTION.md` 가 "엔드포인트의 보안 태세 결정이라 planner 결정" 으로 명시적으로 유예해 `plan/in-progress/spec-draft-nullable-notation-followups.md`(§"preview-test 가 인증된 사용자의 외부 연결 오라클이다") 에 등재돼 있다. 이번 diff 는 이 부분을 건드리지 않았으므로 **여전히 open** 이다 — 새로 발견한 결함이 아니라 미해결 상태 확인.
  - 제안: 기존 트래커 항목 그대로 진행(워크스페이스 컨텍스트 요구 · 연결 실패 메시지 일반화 · 또는 accepted risk 로 spec Rationale 명문화 중 택1). 이번 라운드에서 추가 조치 불필요 — 재작업 유발 목적이 아니라 완결 여부 확인용으로 기록.

- **[INFO]** `pLimit` 동시 상한 뒤에도 대기열 자체는 무제한이다 — **1라운드에서 이미 "잔여"로 트래커 등재된 항목**, 신규 아님
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `connectionTestLimit = pLimit(CONNECTION_TEST_MAX_CONCURRENCY)`(406~408행), `dispatchTest()`(1542행)
  - 상세: `CONNECTION_TEST_MAX_CONCURRENCY = 2`(124행)로 동시 dns.lookup 스레드 점유는 막았지만, 상한을 넘는 요청은 큐에 무제한으로 쌓인다 — 한 사용자가 응답 없는 host 를 겨냥한 연결 테스트를 반복 제출하면 연결 테스트 기능 자체(다른 사용자의 대기시간)를 느리게 만들 수 있다(프로세스 전체 스레드풀 고갈은 아님). `plan/in-progress/spec-draft-nullable-notation-followups.md` "연결 테스트의 `dns.lookup` 이 스레드풀을 쥔다 — 동시 상한 뒤에 남는 것" 에 이미 등재.
  - 제안: 트래커 항목 그대로. 이번 라운드 추가 조치 불필요.

- **[INFO]** DNS rebinding TOCTOU — SSRF 재검증과 실제 접속 사이 재해석 창구 — 기존 accepted risk, 신규 서비스 둘로 노출 대상만 확장
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` `assertSafeOutboundHostResolved()`(133~162행, 주석 자체가 129~131행에서 "Race window" 명시), 호출부 `codebase/backend/src/modules/integrations/database-connection-tester.ts` `testDatabaseConnection()`(84~96행 SSRF 검사 후 98~104행에서 별도 시점에 pg/mysql 드라이버가 재차 DNS 조회), `codebase/backend/src/modules/integrations/http-connection-tester.ts` `ssrfBlockReason()`(29~37행 검사 후 147~152행에서 `fetch` 가 재차 DNS 조회)
  - 상세: 유틸 자체가 이미 "sufficiently fast attacker can flip DNS between this check and the subsequent fetch/connect" 를 인정하고 egress 방화벽으로 defense-in-depth 하라 안내한다. 이번 PR 이 새로 만든 리스크는 아니고 노드 실행 경로와 동일한 유틸을 그대로 재사용했다 — 다만 위 preview-test WARNING(워크스페이스 무관 호출 가능)과 결합하면 이 창구를 시도할 수 있는 대상 풀이 넓어진다는 점만 참고.
  - 제안: 별도 조치 불요(기존 accepted risk).

- **[INFO]** SSRF 차단 시 host/IP 비노출 원칙 준수 확인 — 정상
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-connection.ts:25-26`(`DB_HOST_BLOCKED_MESSAGE`), `codebase/backend/src/nodes/integration/http-request/http-safety.ts:33`(`SSRF_BLOCKED_CLIENT_MESSAGE`), `database-connection-tester.ts:88-95`, `http-connection-tester.ts:19-26`(`blocked()`)
  - 상세: 차단된 host/IP 원문은 `logger.warn` 서버 로그 전용이고 클라이언트 응답은 상수 문구다. `http-connection-tester.ts` 의 `blocked()` 는 호출마다 새 객체를 반환해(19행 주석) 참조 공유로 인한 상태 오염도 없다. e2e(`integration-connection-test.e2e-spec.ts`)도 message 에 host 문자열이 없음을 단언한다.
  - 제안: 없음(정보용, 재확인).

- **[INFO]** `basic`/`bearer_token`/`api_key` 자격증명이 그대로 실제 네트워크로 전송된다 — HTTP(평문) `base_url` 이면 자격증명이 평문 전송될 수 있음(연결 테스트가 이번에 처음 "실제로" 이 경로를 태운다)
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-credentials.ts` `resolveHttpCredentials()`(26~110행 — `Authorization: Bearer ${token}`, `Basic ${base64(user:pass)}`, api_key 헤더/쿼리), `codebase/backend/src/modules/integrations/http-connection-tester.ts` `testHttpConnection()`(133~154행에서 실제 `fetch` 호출)
  - 상세: `assertSafeOutboundUrl`(`http-safety.ts:102-122`)은 프로토콜을 `http:`/`https:` 둘 다 허용한다 — `https:` 강제가 아니다. 운영자가 `base_url` 을 `http://`(TLS 없음)로 등록하면 연결 테스트가 실제 자격증명(Bearer 토큰 전문, Basic base64 — base64 는 암호화가 아니라 인코딩, API 키)을 평문으로 네트워크에 실어 보낸다. 다만 이는 HTTP Request 노드 실행 경로가 이미 갖고 있던 동일한 설계(프로토콜 제한 없음)이고 이번 PR 이 새로 연 것은 아니다 — 다만 이전에는 연결 테스트가 구조 검증만 해서 실제 전송이 없었는데, 이번 PR 로 테스트 단계에서도 real request 가 나가 평문 전송 창구가 (노드 실행 시점 외에) 테스트 시점에도 새로 열렸다.
  - 제안: 낮은 우선순위 — 플랫폼 차원의 결정(HTTP 통합에 `https:` 강제 여부)이 선행돼야 하므로 이 PR 범위 밖. 필요 시 `base_url` 이 `http:` 이고 인증 방식이 `none` 이 아닐 때 경고 배지를 등록 UI 에 노출하는 방안을 고려.

- **[INFO]** rotate 의 부분 저장(`save({ id, ...changes })`)이 `credentials` 컬럼의 `encryptedJsonTransformer` 를 여전히 태우는지 확인 — 정상
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` rotate 저장부(1117~1125행 부근), `codebase/backend/src/modules/integrations/entities/integration.entity.ts`(`credentials` 컬럼 `transformer: encryptedJsonTransformer`)
  - 상세: TypeORM `Repository<Integration>.save()`는 전달된 객체가 전체 엔티티 인스턴스가 아니어도 `Integration` 메타데이터 기준으로 컬럼 트랜스포머를 적용한다 — 부분 객체로 바꾼 것이 암호화 컬럼을 평문으로 저장하는 회귀를 만들지 않는다. e2e `integration-connection-test.e2e-spec.ts`(secret 이 저장된 `credentials` 문자열에 포함되지 않음을 단언)로도 뒷받침된다.
  - 제안: 없음(정보용, 회귀 아님을 확인).

- **[INFO]** HTTP 헤더 인젝션 방어는 런타임(undici) 검증에 의존 — 기존 지적 재확인, 변경 없음
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-credentials.ts:40-64`(`api_key` 분기, `keyName`/`value` 를 그대로 헤더에 삽입)
  - 상세: `keyName`/`value` 에 대한 명시적 sanitize 는 없다. Node `fetch`(undici)가 Fetch 표준에 따라 헤더 이름/값의 CR/LF 등 금지 문자를 만나면 `TypeError` 를 던져 요청이 실패(`HTTP_CONNECT_FAILED` 로 흡수)하므로 실질적 인젝션으로 이어지지 않는 것으로 보이나, 런타임 구현 세부에 의존하는 암묵적 방어다. 1라운드 리뷰(`13_58_22`)와 동일한 관찰이며 이번 diff 에서 변경되지 않았다.
  - 제안: 낮은 우선순위. 필요하면 `keyName`/`value` 사전 검증 추가 가능.

## 하드코딩 시크릿 · 암호화 · 기타 확인

- 신규/변경 파일(`database-connection-tester.ts`, `http-connection-tester.ts`, `http-credentials.ts`, `http-redirect.ts`, `clamp-message.ts`, 스펙 파일, `*.spec.ts`, e2e)에서 실제 자격증명·API 키·인증서로 보이는 하드코딩 문자열은 없음 — 테스트 파일의 `'s3cret-pw'`, `'tok-123'`, `'e2e-rotate-old'` 등은 명백한 fixture 값.
- SQL 인젝션: `probePostgres`/`probeMysql` 모두 정적 리터럴 `'SELECT 1'`(파라미터 바인딩 없음, 사용자 입력 미포함) — 인젝션 표면 없음.
- 해시/암호화: `buildPgConnection`/`buildMysqlSsl` 은 `ssl: 'require'|'verify-full'` 일 때 `rejectUnauthorized: true` 로 강제(MITM 방지, 주석에 "require now enforces cert verification" 로 의도 명시) — 이전보다 강화된 방향, 회귀 아님.
- 에러 처리: `clampMessage`(길이 상한 2048)로 드라이버/HTTP 원문 메시지를 클램프하지만 내용 자체는 그대로 노출 — 위 preview-test WARNING 과 결합해 원인 구분 오라클로 쓰일 수 있다는 점은 이미 반영.
- 의존성: 이번 PR 이 추가한 유일한 신규 의존성은 `p-limit@^7.3.2`(동시성 제한 유틸, 알려진 취약점 없음, 순수 로직 라이브러리) — 보안 표면 없음.

## 요약

이번 diff 는 1라운드 리뷰(`13_58_22`)에서 지적된 항목 중 rotate lost-update, 리다이렉트 로직 중복, DNS-lookup 스레드풀 고갈(Critical)을 동시 상한으로 완화하는 등 핵심 수정을 반영했고, 재검토 결과 그 수정들(부분 저장의 암호화 트랜스포머 적용, 리다이렉트 SSRF 재검증 공유, 동시 상한 배선)에서 새로운 보안 회귀는 발견되지 않았다. SQL 인젝션·하드코딩 시크릿·안전하지 않은 암호화는 없으며 SSRF 차단 메시지의 host 비노출 원칙도 신규 코드 전반에서 일관되게 지켜졌다. 남아 있는 핵심 리스크는 인젝션류가 아니라 **`preview-test` 엔드포인트의 인가 모델(workspace/role 무관)과 이번 PR 이 활성화한 실제 outbound 능력(Database·HTTP) 사이의 불일치**로, 이는 1라운드에서 이미 식별돼 planner 결정 사항으로 트래커에 명시적으로 유예된 상태이며 이번 diff 는 그 부분을 건드리지 않았다(= 신규 결함 아님, 여전히 open). 부수적으로 HTTP 통합이 `http://`(비TLS) `base_url` 을 허용해 연결 테스트 시점에도 실 자격증명이 평문 전송될 수 있다는 점을 이번에 추가로 기록했으나, 이는 노드 실행 경로가 이미 갖고 있던 플랫폼 차원 설계이며 이 PR 범위 밖의 후속 결정 사항이다.

## 위험도

MEDIUM
