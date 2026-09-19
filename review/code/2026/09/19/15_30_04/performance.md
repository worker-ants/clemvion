# 성능(Performance) 코드 리뷰

## 관측된 이상 상태 — 리뷰 중 워킹트리 동시 뮤테이션 (본 리뷰어 기인 아님)

리뷰 수행 중(2026-09-19 15:35 KST 경) `codebase/backend/src/modules/integrations/integrations.service.ts` 가 **본 리뷰어의 Read/Bash 조회 이후, 어떤 조작도 하지 않은 상태에서** 워킹트리 상 uncommitted 로 바뀌어 있는 것을 관측했다(`git status --short` 상 `M`, 직전 커밋 `6bf7c026d` 이후 미커밋). 본 리뷰어는 저장소에 어떤 Write/Edit 도 수행하지 않았다 — 다른 동시 프로세스(다른 세션·resolution-applier 등)가 같은 워킹트리를 편집 중인 것으로 보인다. 관측된 차이는 `rotate()` 의 응답 조립부로, `Object.assign(entity, changes)` 대신 `save()` 직후 `integrationRepository.findOne({ where: { id } })` 로 **재조회하는 코드**로 바뀌어 있었다(주석: "`updated_at` 은 DB 가 정하고 … e2e 실측 1ms 어긋났다"). 이 변경이 사실이라면 `rotate()` 경로에 **추가 DB 왕복 1회**가 생기는 성능 관련 변화이지만, 이 프롬프트(본 리뷰의 대상 diff)에는 포함되어 있지 않아 정식 발견사항으로 채점하지 않는다 — 다음 라운드 리뷰가 최신 커밋 기준으로 다시 봐야 한다. 아래 발견사항·요약은 **프롬프트로 주어진 diff**(직전 상태, `Object.assign` 버전)를 대상으로 한다.

## 발견사항

- **[INFO]** 연결 테스트 4종(mcp·email·database·http, entity tester 포함)이 프로세스 전역 동시 상한 2를 공유 — `p-limit` 대기열은 깊이 제한 없음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (`CONNECTION_TEST_MAX_CONCURRENCY = 2`, `connectionTestLimit = pLimit(...)` 필드, `dispatchTest` 내부 `this.connectionTestLimit(() => tester(authType, credentials))`, `testConnection` 내부 `this.connectionTestLimit(() => entityTester(entity))`)
  - 상세: 이번 라운드에서 entity tester(Cafe24·MakeShop) 도 같은 상한 안으로 들어와, 확장점으로 새로 등록되는 테스터가 사용자 host 를 받더라도 기본적으로 안전한 동시성 상한을 갖게 됐다(3라운드 fix, `6bf7c026d`). `pLimit`은 내부 큐 깊이를 제한하지 않으므로, 응답 없는 host 를 겨냥한 요청이 몰리면 대기열 길이 자체는 무한정 늘 수 있다 — Database 프로브는 최악의 경우 연결(10s)+쿼리(10s)+닫기 유예(1s)≈21초, HTTP 는 리다이렉트 포함 최대 10초까지 슬롯을 쥔다. 이 잔여 항목은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(«연결 테스트의 `dns.lookup` 이 스레드풀을 쥔다» 항목)에 developer 자신이 낮은 우선순위로 등재해 뒀고, 이전 세 라운드 성능 리뷰에서도 반복 확인된 사항이라 새로 발견된 회귀는 아니다.
  - 제안: 추가 조치 불요 — 이미 트래커에 있음. 재차 강조가 필요하면 대기열 길이 상한(예: 초과 시 즉시 `503`/거절)만 향후 후보로 남긴다.

- **[INFO]** SSRF 사전검사와 실제 연결이 같은 host 를 중복으로 DNS 해석 — 리다이렉트 홉마다 반복
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` `outboundBlockReason`(`assertSafeOutboundHostResolved` 호출) → `followRedirectsSafely` 루프에서 홉마다 재호출 → 곧이어 `fetch(url, init)` 가 내부적으로 같은 host 를 재해석. `database-connection-tester.ts` 의 `testDatabaseConnection` 도 `assertSafeOutboundHostResolved` 이후 드라이버가 다시 해석.
  - 상세: 5홉 리다이렉트 체인이면 최대 10회의 DNS 조회가 발생할 수 있다. 두 조회가 동시에 겹치지는 않으므로 위 동시성 상한이 막으려는 "스레드 동시 점유"는 늘리지 않지만, 총 지연시간·스레드풀 total work 는 배가된다. 이는 노드 실행 경로(`http-request.handler.ts`)와 SSRF 가드를 공유하는 기존 패턴을 테스터가 그대로 재사용한 것이라 이번 PR 이 새로 만든 회귀는 아니며, 근본 해법(해석한 IP 로 직접 연결)은 같은 백로그 항목에 이미 defer 로 기록돼 있다.
  - 제안: 신규 조치 불요 — 이미 트래킹됨.

- **[INFO]** (긍정적 관찰) `closeWithin` 의 강제 종료 유예(1초)가 동시 상한 슬롯 점유 시간을 상한 짓는다
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts` `closeWithin`(`Promise.race` + `DB_TEST_CLOSE_GRACE_MS = 1_000` 뒤 `stream.destroy()`), `probePostgres`/`probeMysql` 의 `finally` 블록
  - 상세: 2라운드에서 지적된 "닫기가 끝나지 않으면 동시 상한 슬롯을 영원히 쥔다" 문제(`edd468476`)가 `Promise.race` 로 해소돼, 연결 테스트 하나가 쥐는 시간의 상한이 연결(10s)+쿼리(10s)+닫기 유예(1s)로 확정된다. `setTimeout` 타이머도 매 호출마다 `clearTimeout` 으로 정리되어 타이머 누적(메모리 누수)도 없다.
  - 제안: 없음 — 유지.

- **[INFO]** 응답 본문 미소비·부분 컬럼 저장·메시지 클램프 — 메모리·쓰기 비용 억제가 그대로 유지됨
  - 위치: `http-connection-tester.ts` `discardBody` 호출, `http-redirect.ts` `discardBody`(각 홉), `clamp-message.ts` `clampMessage`, `integrations.service.ts` `rotate()`(바뀐 컬럼만 담은 `{id, ...changes}` 로 `save`, `Object.assign` 으로 메모리상 엔티티만 갱신 — 위 "관측된 이상 상태" 참고, 이 구조가 최신 워킹트리에서는 재조회로 바뀌어 있을 수 있음)
  - 상세: 대형 응답을 돌려주는 `base_url` 을 테스트해도 본문 전체를 메모리에 적재하지 않고, 드라이버·서버가 돌려주는 임의 길이 에러 메시지는 `MCP_ERROR_MESSAGE_MAX_LEN` 으로 잘라 `last_error` JSONB 컬럼 팽창을 막는다. 프롬프트 기준 `rotate()` 는 연결 테스트(수~십여 초)가 끝난 뒤 엔티티 전체를 `save` 하지 않고 바뀐 컬럼만 저장해 `logUsage` 의 동시 `update` 와의 stale-overwrite 경쟁·불필요한 쓰기 폭을 줄인다. `updatedAt` 을 명시적으로 changes 에 포함시킨 것도 정확성 수정이며 추가 쿼리·연산 비용은 없다.
  - 제안: 없음(프롬프트 기준 유지) — 다만 위에서 관측한 대로 최신 워킹트리가 `findOne` 재조회로 바뀌어 있다면, 그 변경은 추가 DB 왕복을 도입하므로 다음 라운드에서 재평가가 필요하다.

- **[INFO]** DB/HTTP 프로브는 각각 단일 연결·단일 요청 체인이며 반복문 내 DB/외부 호출(N+1) 패턴 없음
  - 위치: `database-connection-tester.ts` `probePostgres`/`probeMysql`, `http-connection-tester.ts` `testHttpConnection`, `http-redirect.ts` `followRedirectsSafely`(리다이렉트 추종은 홉마다 SSRF 재검증이 필수라 순차 처리가 불가피 — 상수 상한 5)
  - 상세: `dispatchTest` 호출당 정확히 한 번의 연결·쿼리(DB) 또는 한 번의 요청 체인(HTTP)만 수행하며, 알고리즘 복잡도는 상수(O(1), 홉 수 상한 고정)다. 배치화가 필요한 반복 구조는 없다.
  - 제안: 없음.

## 요약

이번 diff 는 Database·HTTP 연결 테스터 신설 이후 3라운드에 걸친 리뷰 fix(닫기 상한, entity tester 동시성 편입, `updatedAt` 정확성, query 조립·SSRF 검사 공유화)가 모두 반영된 상태다. 새로 도입된 네트워크 I/O 경로는 연결·쿼리·전체 요청 각각 명시적 타임아웃(10초)과 강제 종료 유예(1초)로 상한이 있고, 프로세스 전역 `pLimit(2)` 로 libuv DNS 스레드풀 고갈을 막았으며, 응답 본문 미소비·에러 메시지 클램프·부분 컬럼 저장으로 메모리·쓰기 비용도 억제한다. N+1 호출, O(n²) 문자열 누적, 부적절한 자료구조, 불필요한 선행 로딩 같은 전형적 성능 결함은 발견되지 않았다. 남은 두 항목(`pLimit` 대기열 깊이 무제한, SSRF 사전검사·실제 연결의 중복 DNS 해석)은 새로운 회귀가 아니라 developer 자신이 이미 낮은 우선순위 백로그(`plan/in-progress/spec-draft-nullable-notation-followups.md`)로 정직하게 등재해 둔 잔여 리스크이며, 이전 세 차례 성능 리뷰에서도 반복 확인됐다. 다만 리뷰 도중 워킹트리가 본 리뷰어 외부 요인으로 뮤테이션돼 `rotate()` 응답 조립부가 재조회 방식으로 바뀐 것을 관측했다 — 그 변경이 최종적으로 커밋되면 추가 DB 왕복 1회가 생기므로 다음 라운드에서 별도 평가가 필요하다. 이번 라운드(프롬프트 기준)에서 새로 차단할 성능 사유는 없다.

## 위험도

NONE
