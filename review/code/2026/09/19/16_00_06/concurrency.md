# 동시성(Concurrency) 리뷰

## 발견사항

- **[WARNING]** SSRF preflight DNS lookup(`assertSafeOutboundHostResolved`)이 아무 타임아웃도 없이, `CONNECTION_TEST_MAX_CONCURRENCY=2` 로 극히 좁힌 연결-테스트 슬롯 안에서 그대로 호출된다 — 이 PR 이 막으려는 "느린 DNS 가 슬롯을 영원히 쥔다" 문제가 같은 PR 이 새로 추가한 preflight 단계에서 재발할 수 있다.
  - 위치:
    - `codebase/backend/src/modules/integrations/database-connection-tester.ts:137` (`testDatabaseConnection` 함수 — `await assertSafeOutboundHostResolved(creds.host);`, 137행. 바로 뒤 `probePostgres`/`probeMysql` 은 `connectionTimeoutMillis`/`connectTimeout` 으로 스스로를 감싸지만 이 preflight 호출 자체는 어떤 타임아웃에도 감싸여 있지 않다)
    - `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` — 게이트 24~32행 `outboundBlockReason` 함수, 특히 게이트 27행 `await assertSafeOutboundHostResolved(new URL(url).hostname);`. 이 함수는 `followRedirectsSafely`(게이트 48~73행) 안에서 홉마다(게이트 67행) 다시 호출된다.
    - `codebase/backend/src/modules/integrations/http-connection-tester.ts` — 게이트 115행 `const preflight = await outboundBlockReason(url);` 이 게이트 123행 `signal: AbortSignal.timeout(HTTP_TEST_TIMEOUT_MS)` 을 만들기 **전에** 실행된다. 즉 최초 preflight lookup 은 10초 예산 밖에 있다.
  - 상세: `integrations.service.ts` 112~131행의 새 doc 코멘트는 "`dns.lookup` 은 libuv 스레드풀을 쓰고 Node 쪽 타임아웃 옵션이 없다" 는 것을 정확히 인지하면서도, 그 근거로 "`node:24-alpine`(musl)에서 응답 없는 네임서버로 실측 5.0초 뒤 `EAI_AGAIN`" 이라는 **한 환경의 1회 실측치**만 들어 DB 26초·HTTP 20초라는 슬롯 점유 상한을 계산한다. 실제로는 (a) glibc 계열 base image·`resolv.conf` 에 nameserver 가 여럿이면 `getaddrinfo` 는 attempts×timeout×nameserver 수만큼 걸릴 수 있어 5초보다 훨씬 커질 수 있고, (b) HTTP 리다이렉트 체인은 홉마다 `outboundBlockReason` 을 다시 부르는데 그 DNS lookup 은 `AbortSignal.timeout(10_000)` 이 전혀 감시하지 못하므로, 5홉이면 "5초 lookup 하나 추가"가 아니라 최대 5번의 미측정 lookup 이 통째로 10초 예산 밖에 쌓인다 — `http-connection-tester.ts` 118행 코멘트("대기 신호 하나가 리다이렉트 체인 전체에 걸린다 — 홉이 늘어도 10초를 넘지 않는다")가 실제로는 fetch 호출에만 해당하고 hop 간 DNS 검사에는 적용되지 않는다. `closeWithin`(같은 파일 34~62행)은 정확히 이런 무기한 대기를 `Promise.race`+`setTimeout` 으로 막았는데, preflight DNS 단계에는 같은 패턴이 적용되지 않았다. `CONNECTION_TEST_MAX_CONCURRENCY=2` 라는 극도로 좁은 상한을 정할 때 "슬롯은 영구히 잡히지 않는다" 는 전제를 깔았으므로, 이 전제가 깨지면(느리거나 응답 없는 DNS 를 겨냥한 통합을 동시에 2개 이상 테스트) 정확히 이 PR 이 고치려던 것과 같은 종류의 head-of-line blocking 이 재현된다 — 다만 슬롯 자체가 2개로 제한돼 있어 libuv 풀 전체(기본 4개) 고갈까지는 아니고 "연결 테스트" 기능 자체의 가용성 저하로 그친다.
  - 제안: preflight `assertSafeOutboundHostResolved`(및 redirect 홉의 재호출)를 `closeWithin` 과 같은 `Promise.race([lookup, timeout])` 패턴이나 `AbortSignal` 지원 DNS API(`dns.promises.lookup` 은 signal 을 받지 않으므로 수동 race)로 명시적 상한을 걸거나, 최소한 HTTP 쪽은 preflight 을 `AbortSignal.timeout` 생성 **이후**로 옮기고 hop 간 검사도 같은 signal 로 취소 가능하게 만들 것을 권장한다.

- **[WARNING]** `rotate()` 의 read-test-write 구간이 동시 `rotate` 호출 사이의 lost-update 경쟁을 막지 못한다 — optimistic lock(version 컬럼)도, 행 잠금도 없다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `rotate` 메서드. `requireEntity` 로 읽은 `entity.credentials`(1080행)를 `baseCreds`(1099~1101행)로 삼아 `merged = { ...baseCreds, ...body.credentials }`(1102행)를 계산하고, 수 초~수십 초 걸리는 `dispatchTest`(1115행, DB 는 최대 ~26초·HTTP 는 ~10~20초)를 기다린 뒤 그 `merged` 를 그대로 `update({ id }, { credentials: merged, ... })`(1139행)로 덮어쓴다.
  - 상세: 같은 integration id 에 대해 두 rotate 요청(A, B)이 거의 동시에 들어오면 둘 다 같은 `entity.credentials`(base)를 읽고, 각자 자신의 `body.credentials` 만 병합한 `merged` 를 만든다. 두 테스트가 모두 통과하면 두 `update` 가 모두 성공하고 두 응답 모두 200·감사 로그(`INTEGRATION_ROTATED`)도 둘 다 남지만, DB 에는 **나중에 update 가 끝난 쪽의 `merged`** 만 남는다 — 먼저 끝난 rotate 가 바꾼 필드 중 나중 요청의 `body.credentials` 에 없는 필드는 base 값으로 조용히 되돌아간다(두 요청이 서로 다른 필드를 바꿨다면 특히 위험). 호출자 입장에서는 자신의 rotate 가 200 을 받고 감사 로그까지 남았으므로 반영됐다고 믿지만 실제로는 유실될 수 있다. 이번 diff 는 바로 이 함수의 동시성 안전성(rotate vs `logUsage` 경쟁, `save()`→`update()` 전환, 재조회 응답)을 여러 라운드에 걸쳐 다듬었지만, rotate-vs-rotate 경쟁은 다뤄지지 않았다.
  - 제안: `update` 시 `WHERE id = :id AND updated_at = :readAt`(또는 별도 version 컬럼)으로 조건부 갱신을 걸어 0 rows affected 면 409/재시도를 유도하거나, id 단위 advisory lock(`pg_advisory_xact_lock`)으로 같은 integration 의 rotate 를 직렬화할 것을 권장한다. 다만 admin 전용 저빈도 동작이라 실사용 위험도는 낮다는 점도 함께 고려.

- **[INFO]** entity tester 의 재진입 금지 계약이 코드가 아니라 주석으로만 강제된다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `registerEntityTester` docstring(466~473행 부근), "MUST NOT call back into `testConnection` / `previewTest` / `rotate` — a nested wait on the same limit can deadlock once every slot is held by such a tester." 문구.
  - 상세: `connectionTestLimit = pLimit(2)` 안에서 실행되는 entity tester 가 이 계약을 어기고 `testConnection`/`rotate` 를 재호출하면, 이미 점유된 슬롯이 다시 같은 큐에서 빈 슬롯을 기다리게 되어 데드락(정확히는 무기한 대기)이 발생한다. 현재 등록된 Cafe24·MakeShop 테스터(`cafe24.module.ts`, `makeshop.module.ts` — 이번 diff 대상 아님)는 계약을 지키고 있어 즉각적 위험은 없지만, 런타임 가드나 재진입 감지 없이 순수 문서 규약에만 의존한다.
  - 제안: 당장 수정을 요구할 정도는 아니나, 향후 확장점 추가 시 리뷰 체크리스트에 이 계약 준수 여부를 명시적으로 넣을 것을 권장.

## 요약

이번 변경(Database·HTTP 연결 테스트 실장, `p-limit(2)` 기반 동시 실행 상한, `closeWithin` 소켓 강제 종료, rotate 의 `save→update` 전환)은 이미 여러 리뷰 라운드를 거치며 대부분의 명백한 동시성 결함(닫기 무한 대기로 인한 슬롯 고갈, rotate 와 logUsage 의 컬럼 덮어쓰기 경쟁, entity tester 재진입 데드락 등)을 상세한 근거 코멘트와 함께 잘 막아 두었고, `integrations.service.spec.ts` 의 동시성 상한 테스트(`releases`/`inFlight`/`peak` 패턴)도 견고하다. 다만 이 설계 전체의 안전 마진(슬롯당 "DB 약 26초·HTTP 약 20초" 상한)이 의존하는 SSRF preflight DNS lookup(`assertSafeOutboundHostResolved`) 단계 자체는 여전히 아무 타임아웃도 없이(단일 환경 실측치에만 근거) 그 좁은 동시성 풀 안에서 실행되며, HTTP 리다이렉트 홉마다 반복 호출되는데도 `AbortSignal.timeout` 예산 밖에 있다 — 이 PR 이 고치려는 문제 유형이 이 PR 이 새로 추가한 코드 경로에서 재발할 수 있는 구조다. 또한 `rotate()` 의 read-test-write 구간은 동시 rotate 요청 사이의 lost-update 를 막지 못한다(버전 컬럼·조건부 update 없음) — 이번 diff 가 rotate 의 다른 경쟁(logUsage 와의 컬럼 충돌)은 정확히 고쳤지만 rotate-vs-rotate 경쟁은 손대지 않았다.

## 위험도

MEDIUM
