# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** DNS 해석 스레드풀 압박 완화는 이미 이 PR 이 스스로 다룬 항목 — 잔여는 백로그 등재됨
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:124` (`CONNECTION_TEST_MAX_CONCURRENCY`), `:406-408` (`connectionTestLimit = pLimit(...)`), `:1542` (`dispatchTest` 배선)
  - 상세: `dns.lookup`(libuv 스레드풀, 기본 4)을 쓰는 transport 연결 테스트(mcp·email·database·http)가 겹치면 무관한 `fs`/`crypto`/`zlib` 작업까지 지연될 수 있던 것을, 이번 커밋이 `p-limit(2)`로 프로세스 전체 동시 실행 상한을 걸어 완화했다. 정확한 근거(스레드풀 크기 절반, MCP SDK 의 요청 중첩 미방지 등)가 주석에 실측 근거와 함께 남아 있다. 다만 (1) `pLimit` 큐는 깊이 제한이 없어 버스트 시 연결 테스트 기능 자체의 지연이 커질 수 있고 (2) SSRF 사전검사(`assertSafeOutboundHostResolved`)와 실제 `fetch`/드라이버 연결이 같은 host 에 대해 순차적으로 두 번 DNS 를 질의해 스레드풀 총 사용량이 두 배가 된다 — 이 두 잔여 항목은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "연결 테스트의 `dns.lookup` 이 스레드풀을 쥔다" 항목으로 이미 낮은 우선순위 백로그로 등재되어 있다.
  - 제안: 별도 조치 불요 — 이미 트래킹됨. 재차 강조할 필요가 있다면 큐 깊이 제한(예: 초과 요청 즉시 거절 or 타임아웃)만 향후 후보로 남긴다.

- **[INFO]** HTTP 연결 테스트 — SSRF 사전검사와 실제 fetch 의 중복 DNS 조회
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:29-37`(`ssrfBlockReason`), `:137`(호출), `:149`(`fetch(url, init)`); 리다이렉트 홉마다 반복되는 지점은 `codebase/backend/src/nodes/integration/http-request/http-redirect.ts:49-58`
  - 상세: `ssrfBlockReason`이 `assertSafeOutboundHostResolved`로 host 를 완전히 해석한 뒤, 곧이어 `fetch()`가 undici 내부에서 같은 host 를 다시 해석한다. 리다이렉트 홉마다 이 패턴이 반복되므로(`http-redirect.ts`), 5홉 리다이렉트 체인이면 최대 10회의 DNS 조회가 발생할 수 있다. 두 조회가 동시에 겹치지 않으므로 위 CRITICAL 이 걱정하는 "동시 스레드 점유"는 늘리지 않지만, 총 지연시간·스레드풀 total work 는 배가된다. 이 역시 SSRF 가드가 노드 실행 경로(`http-request.handler.ts`)와 공유하는 기존 패턴을 테스터가 그대로 재사용한 것이라 이번 PR 이 새로 만든 회귀는 아니다. 근본 해법(해석한 IP 로 직접 연결)은 같은 백로그 항목의 "근본 해법" 절에 이미 defer 로 적혀 있다.
  - 제안: 신규 조치 불요 — 이미 트래킹됨. 참고로만 기재.

- **[INFO]** rotate() 부분 컬럼 저장으로의 전환은 성능·정합성 양쪽에 긍정적
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (rotate, `entity.credentials = merged... save(entity)` → `save({ id: entity.id, ...changes })` + `Object.assign(entity, changes)`; 새 파일 diff 게이트 1111-1136 부근, 실제 줄 번호는 `grep -n "connectionTestLimit\|async rotate" integrations.service.ts` 로 확인)
  - 상세: 연결 테스트(수 초~10여 초 소요)가 끝난 뒤 엔티티 전체를 `save()`하던 기존 방식은 그 사이 `logUsage`의 원자적 `update`가 갱신한 `lastUsedAt` 등의 컬럼을 되돌리는 UPDATE 를 만들었다(불필요한 쓰기 + 데이터 유실 가능성). 이번 변경은 바뀐 컬럼만 담은 부분 객체를 `save`하고 반환값 재조회 대신 `Object.assign`으로 메모리 상 엔티티만 갱신한다 — 쓰기 폭(write amplification)과 컬럼 clobbering 을 동시에 줄인 개선이다. 새 결함은 없음.
  - 제안: 없음(긍정 확인).

- **[INFO]** 응답 본문 미소비(discardBody/body.cancel) — 불필요한 메모리 적재 회피
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:92-94`(`discardBody`), `codebase/backend/src/nodes/integration/http-request/http-redirect.ts:37`(리다이렉트 중간 응답 `cancel()`)
  - 상세: 연결 테스트는 상태 코드만으로 판정하고(`classify`) 응답 본문을 파싱하지 않으며, 각 리다이렉트 홉의 중간 응답 본문도 즉시 `cancel()`한다. 대용량 응답을 돌려주는 `base_url`을 테스트해도 본문 전체를 메모리에 적재하지 않는다 — 불필요한 연산/메모리 할당 관점에서 바람직한 설계.
  - 제안: 없음(긍정 확인).

## 요약

이번 변경은 신규 Database·HTTP 연결 테스터 도입과 함께, 이전 라운드 리뷰에서 지적된 성능/자원 문제(연결 테스트 동시 실행이 libuv DNS 스레드풀을 고갈시킬 수 있던 점)를 `p-limit(2)`로 직접 완화하고, `rotate()`의 전체 엔티티 저장을 부분 컬럼 저장으로 바꿔 쓰기 폭을 줄였다. 새 테스터들은 일회성 DB 연결·10초 타임아웃·응답 본문 미소비 등 리소스를 절제하는 방식으로 구현되어 있고, N+1 호출·O(n²) 문자열 누적·부적절한 자료구조 같은 전형적 성능 결함은 발견되지 않았다. 남은 잔여(비대칭 pLimit 큐 깊이, SSRF 사전검사와 실제 fetch 의 중복 DNS 조회)는 이미 이 PR 자신이 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 낮은 우선순위 백로그로 정직하게 등재해 두었으므로 이번 라운드에서 새로 차단할 사유는 없다.

## 위험도

NONE
