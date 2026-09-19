# 성능(Performance) 리뷰 — Database · HTTP 연결 테스터

## 발견사항

- **[INFO]** 연결 테스트 4종(mcp·email·database·http)이 프로세스 전역 동시 상한 2를 공유한다 — 이질적 워크로드 직렬화 가능성
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:127` (`CONNECTION_TEST_MAX_CONCURRENCY`), `:1545` (`dispatchTest` 의 `this.connectionTestLimit(() => tester(...))`)
  - 상세: `pLimit(2)` 는 `p-limit` 내부 큐가 무한이라, 상한을 넘는 요청은 대기열에 쌓이고 개수 제한이 없다. Database 프로브는 최악의 경우 연결(10s)+쿼리(10s)+닫기 유예(1s) ≈ 21초, HTTP 프로브는 리다이렉트 포함 최대 10초까지 슬롯을 쥔다. `preview-test` 엔드포인트가 분당 20회로 throttle 되어 있어 한 사용자가 응답 없는 외부 host 를 반복 지정하면 대기열이 계속 길어질 수 있다.
  - 다만 이 트레이드오프는 코드 주석과 `plan/in-progress/integration-db-http-testers.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`(«연결 테스트의 `dns.lookup` 이 스레드풀을 쥔다» 항목)에 이미 인지·기록돼 있고, 근본 해법(c-ares resolver, 대기열 길이 제한)은 developer 가 낮은 우선순위 후속 과제로 명시적으로 defer 했다. 새로 발견된 회귀가 아니라 기존에 문서화된 잔여 리스크의 재확인이다.
  - 제안: 추가 조치는 불필요 — 이미 트래커에 있는 항목이므로 재작업만 상기.

- **[INFO]** `testHttpConnection` 안에서 같은 URL 문자열을 `new URL(...)` 로 최대 3번 파싱한다
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts` — `isValidUrl`(52행), `withQuery`(44행), `ssrfBlockReason`(32행) 이 각각 별도로 `new URL()` 을 생성한다.
  - 상세: 요청당 한 번뿐이고 문자열 길이도 짧아 실측 영향은 미미하지만, `isValidUrl` 로 이미 유효성을 확인한 뒤 `withQuery` 에서 다시 파싱하고, `ssrfBlockReason` 에서 hostname 추출을 위해 세 번째로 파싱한다. `URL` 객체 하나를 만들어 재사용하면 중복 파싱을 없앨 수 있다.
  - 제안: 우선순위 낮음(INFO) — 리팩터링 여지로만 기록. 현재 트래픽 규모(분당 20회 throttle)에서 병목이 될 가능성은 없다.

- **[INFO]** (긍정적 관찰) 응답 본문 폐기·메시지 클램프·부분 `save` 로 메모리·쓰기 비용을 이미 잘 억제함
  - 위치: `http-connection-tester.ts` `discardBody`(92행) · `http-redirect.ts` `followRedirectsSafely`(각 홉에서 `response.body?.cancel()`) · `clamp-message.ts` `clampMessage` · `integrations.service.ts` `rotate()`(1117~1128행 부근, 엔티티 전체 대신 `{id, ...changes}` 부분 `save`)
  - 상세: HTTP 커넥션 테스트는 응답 본문을 읽지 않고 매 홉·최종 응답 모두 `cancel()` 하여 대형 응답이 메모리에 쌓이는 것을 막는다. `clampMessage` 는 드라이버·서버가 돌려주는 임의 길이 에러 메시지를 `MCP_ERROR_MESSAGE_MAX_LEN` 로 잘라 `last_error` JSONB 컬럼 팽창을 막는다. `rotate()` 는 이번 변경으로 엔티티 전체 `save` 대신 바뀌는 컬럼만 부분 `save` 하도록 바뀌어, 쓰기 페이로드가 줄고 `logUsage` 의 동시 `update` 와의 stale-overwrite 경쟁도 없앴다 — 성능과 정합성을 동시에 개선한 변경이다.
  - 제안: 없음 — 유지.

- **[INFO]** DB/HTTP 프로브는 각각 단일 연결·단일 요청이며 반복문 내 DB/외부 호출(N+1) 패턴은 없음
  - 위치: `database-connection-tester.ts` `probePostgres`/`probeMysql`, `http-connection-tester.ts` `testHttpConnection`
  - 상세: 두 테스터 모두 `dispatchTest` 호출당 정확히 한 번의 연결·쿼리(DB) 또는 한 번의 요청 체인(HTTP, 리다이렉트 추종은 SSRF 재검증이 필수라 순차 처리가 불가피)만 수행한다. 배치화가 필요한 반복 구조는 없다.
  - 제안: 없음.

## 요약

이번 변경은 Database·HTTP 연결 테스트에 실제 네트워크 프로브를 추가하면서도, 연결·쿼리·닫기 각각에 명시적 타임아웃을 걸고(10초/10초/1초), 프로세스 전역 동시성 상한(`pLimit(2)`)으로 libuv 스레드풀 고갈을 막았으며, 응답 본문 폐기·에러 메시지 클램프·rotate 부분 저장으로 메모리·쓰기 비용까지 신경 쓴 신중한 구현이다. N+1 패턴이나 O(n²) 누적, 불필요한 대량 메모리 적재 같은 새로운 성능 결함은 발견되지 않았다. 유일하게 주목할 지점은 이질적 4종 테스터가 동시성 상한 하나를 공유해 응답 없는 외부 host 를 겨냥한 프로브가 대기열을 길게 만들 수 있다는 점인데, 이는 이번 PR 이 스스로 인지해 후속 트래커(`spec-draft-nullable-notation-followups.md`)에 낮은 우선순위로 이미 등재한 잔여 리스크이며 새로 발견된 회귀가 아니다.

## 위험도
LOW
