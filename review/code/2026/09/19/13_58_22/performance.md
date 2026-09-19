# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** 매 연결 테스트마다 커넥션을 새로 열고 닫는다 (풀 재사용 없음)
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:37-50`(`probePostgres`), `:52-67`(`probeMysql`)
  - 상세: `testDatabaseConnection` 은 매 호출마다 `new PgClient(...)` / `mysqlCreateConnection(...)` 로 TCP+핸드셰이크 비용이 드는 새 연결을 열고 `SELECT 1` 실행 뒤 즉시 닫는다. 노드 실행의 커넥션 풀과 의도적으로 분리했다는 주석(`:70-73`)이 있어 설계 결정임을 확인했다 — pool 재사용 시 "테스트 성공"이 실제 실행 시점의 자격증명/네트워크 상태를 보장하지 못하는 문제를 피하려는 것으로 보인다.
  - 제안: 현재로선 문제 없음(저빈도·rate-limit 대상 endpoint). 다만 향후 이 테스터가 더 빈번히 호출되는 경로(예: 헬스체크 폴링)에 재사용되면 커넥션 오버헤드가 누적될 수 있으니, 그런 확장 시엔 재검토 필요.

- **[INFO]** `preview-test`/`:id/test`/`rotate` 세 경로 모두 사용자당 분당 20회로만 제한 — 전역 동시성 상한 없음
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` (`@Throttle({ default: { limit: 20, ttl: 60_000 } })`), `database-connection-tester.ts:18`(`DB_TEST_TIMEOUT_MS = 10_000`), `http-connection-tester.ts:15`(`HTTP_TEST_TIMEOUT_MS = 10_000`)
  - 상세: `UserThrottlerGuard`(`codebase/backend/src/common/guards/user-throttler.guard.ts`)가 사용자 단위로 20회/분을 제한하지만, 워크스페이스/전체 서버 단위의 동시 실행 상한은 없다. 각 요청은 실패해도 최대 10초까지 소켓을 열어 둘 수 있어(SSRF 통과 후 unresponsive host 를 가리키는 경우), 사용자 수가 많아지면 동시에 열린 소켓·파일 디스크립터 수가 `활성 사용자 수 × 20` 규모까지 늘어날 수 있다.
  - 제안: 현재 스케일에서는 낮은 위험이지만, 다중 워크스페이스 환경에서 순간적 부하 스파이크가 우려되면 전역 세마포어(예: 동시 연결 테스트 N개 제한)를 고려. 성능보다는 리소스 고갈(DoS) 성격이 강해 security reviewer 범위와 겹칠 수 있음.

- **[INFO]** `base_url` 문자열이 한 요청 내에서 최대 3회 파싱된다 (`new URL(...)` 중복 호출)
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts` — `isValidUrl`(:50-57) → `withQuery`(:39-48, query 가 있을 때) → `isSafeTarget`(:27-37, `new URL(url).hostname`)
  - 상세: `testHttpConnection` 흐름에서 같은 `resolved.baseUrl` 문자열이 유효성 검사, 쿼리 병합, SSRF 검사 세 지점에서 각각 `new URL()` 로 재파싱된다. 요청당 1회만 실행되는 경로라 비용은 무시할 수준(µs 단위)이지만, 형식적으로는 중복 계산이다.
  - 제안: 성능상 시급하지 않음. 리팩터링 시 파싱 결과(`URL` 객체)를 한 번 만들어 재사용하면 코드도 더 명확해질 수 있음(선택 사항).

- **[INFO]** HTTP 리다이렉트 루프는 상한(5홉)·타임아웃(10초, 전체 공유)·바디 즉시 취소(`discardBody`)로 잘 방어됨 — 긍정적 관찰
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:146-168`
  - 상세: `while` 루프는 홉 수(`HTTP_TEST_MAX_REDIRECTS = 5`)로 상한이 있고, `AbortSignal.timeout(HTTP_TEST_TIMEOUT_MS)` 를 루프 밖에서 한 번 생성해 전체 리다이렉트 체인이 하나의 10초 예산을 공유하므로 최악의 경우 지연이 홉 수에 비례해 불어나지 않는다. 응답 바디는 매 홉·최종 응답 모두 `res.body?.cancel()` 로 즉시 버려 불필요한 다운로드·소켓 점유를 피한다. 알고리즘 복잡도는 O(1)(상수 상한), 자료구조(`Set`, 컴파일된 정규식)도 적절하다.
  - 제안: 없음 — 참고용 관찰.

## 요약

이번 변경은 신규 Database·HTTP 연결 테스터를 실제 네트워크 I/O 경로로 추가하지만, 두 테스터 모두 비동기(await) 로 작성돼 이벤트 루프를 블로킹하지 않고, 타임아웃 상한(10초)·리다이렉트 홉 상한(5)·사용자별 rate-limit(20/분)·응답 바디 즉시 취소 등으로 무제한 대기·메모리 누수·소켓 고갈을 잘 방어하고 있다. 반복문 내 DB/API 호출(N+1)이나 O(n²) 문자열 누적 같은 구조적 문제는 발견되지 않았고, 자료구조(Set/정규식) 선택도 용도에 맞다. 유일하게 주목할 점은 테스트마다 커넥션을 새로 열고 닫는 설계(의도적)와 전역 동시성 상한의 부재인데, 둘 다 현재 빈도·rate-limit 수준에서는 CRITICAL/WARNING 급 위험이 아니라 향후 스케일 변화 시 참고할 INFO 사항이다.

## 위험도

LOW
