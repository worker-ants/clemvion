# 성능(Performance) 리뷰 — Database · HTTP 통합 연결 테스트

## 발견사항

- **[INFO]** 연결 테스트 동시 실행 상한(2)이 프로세스 전역 단일 큐 — 정당하지만 처리량 상한을 명시적으로 낮춘다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `CONNECTION_TEST_MAX_CONCURRENCY`(132행), `connectionTestLimit` 필드(414행), `dispatchTest`(1570행), `testConnection`(984행)
  - 상세: `pLimit(2)` 를 서비스 싱글턴 필드로 두어 mcp·email·database·http transport tester 와 entity tester(cafe24·makeshop) 전부가 프로세스당 슬롯 2개를 공유한다. 각 슬롯은 Database 최대 약 26초(가드 lookup 5 + 연결 10 + 쿼리 10 + 닫기 1), HTTP 최대 약 20초를 붙잡을 수 있다(코드 주석에 실측 근거와 함께 명시됨: `node:24-alpine`(musl) 응답 없는 네임서버 5.0초 `EAI_AGAIN`). 즉 워크스페이스가 여럿인 배포에서 3번째 이상의 동시 연결 테스트 요청은 최악의 경우 수십 초 동안 큐에서 대기하며, `@Throttle` 은 사용자별 호출 **속도**만 제한하고 프로세스 전역 **동시성**은 이 하나의 큐가 통제한다. libuv 스레드풀(기본 4) 고갈을 막기 위한 의도된 트레이드오프로, 근거·수치가 주석에 상세히 남아 있어 설계 결함은 아니다.
  - 제안: 현재로선 조치 불요(의도된 설계). 다만 다중 워크스페이스 환경에서 큐 대기가 사용자 체감 지연으로 이어지면, 인스턴스 수평 확장(각 프로세스가 독립적으로 슬롯 2개를 가짐)으로 완화되는지, 혹은 프로세스당 상한을 CPU 코어/스레드풀 크기에 연동해 조정 가능하게 할지 후속 검토 가치가 있다.

- **[INFO]** `rotate()` 가 연결 테스트 성공 후 `update` + `findOne` 두 번 왕복 — 의도적이나 추가 쿼리 비용
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1139-1153` (`rotate` 메서드)
  - 상세: 자격증명 교체는 연결 테스트(수 초~수십 초) 뒤 `update()` 로 변경 컬럼만 쓰고, 그 직후 `findOne()` 으로 행을 다시 읽어 응답을 구성한다. 커밋 이력(`48dfb2f0e`, `e6b98cd65`)에 남긴 대로 메모리에 채운 `updatedAt` 이 DB 값과 어긋나는 문제(e2e 실측 1ms)를 고치기 위한 의도된 추가 쿼리이며, `save()` 전체 엔티티 저장 대신 `update()` 로 바꿔 `logUsage` 의 원자적 갱신과의 경합도 함께 없앴다 — 정합성을 위해 왕복 1회를 추가로 지불하는 합리적 트레이드오프다. 단일 행 대상이라 N+1 은 아니다.
  - 제안: 조치 불요. 성능보다 정합성이 우선인 저빈도 관리자 작업(rotate)이라 왕복 1회 추가는 무시할 수준.

- **[INFO]** HTTP 연결 테스트가 응답 본문을 절대 읽지 않고 매 리다이렉트 홉마다 즉시 취소 — 메모리 측면에서 바람직
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` `discardBody`(34-37행), `followRedirectsSafely`(48-73행); `codebase/backend/src/modules/integrations/http-connection-tester.ts:132`(`await discardBody(followed.response)`)
  - 상세: `res.body?.cancel()` 으로 응답 스트림을 즉시 취소해 대형 응답 본문을 메모리에 적재하지 않는다. 리다이렉트 체인 전체가 하나의 `AbortSignal.timeout(10_000)` 에 묶여 홉이 늘어도 총 대기시간이 선형으로 증가하지 않는다. 불필요한 메모리 적재·블로킹 없이 설계된 양호한 패턴이라 별도 조치가 필요 없다.

- **[INFO]** DB 드라이버 close 타임아웃(`closeWithin`)이 `Promise.race` + 미해결 프라미스 방치 — 누수 아님, 검증됨
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:34-62`
  - 상세: `graceful()` 이 grace 기간(1초) 안에 끝나지 않으면 소켓을 강제 파괴하고 함수는 반환하지만, 원래의 `graceful()` 프라미스(`client.end()`/`connection.end()`)는 백그라운드에 남는다. `.then(() => true, () => true)` 로 성공/실패 모두 흡수해 unhandled rejection 은 생기지 않고, 소켓 파괴 후 그 프라미스도 곧 정착되어 단발성 참조라 누적 누수로 이어지지 않는다. `database-driver-sockets.spec.ts` 로 `connection.stream` 구조 가정을 별도 고정해 향후 드라이버 업그레이드 시 조용한 회귀도 막아 뒀다. 성능 관점에서 문제 없음.

## 요약

이번 변경(Database·HTTP 통합 연결 테스트 신설)은 성능 관점에서 사전에 잘 설계됐다. 핵심 리스크였을 법한 "다수 연결 테스트가 libuv DNS 스레드풀을 고갈시켜 무관한 I/O(`fs`/`crypto`/`zlib`)까지 멈추는" 문제를 `CONNECTION_TEST_MAX_CONCURRENCY=2` 전역 큐로 선제 차단했고, 그 상한의 근거(스레드풀 크기, 실측 DNS 타임아웃, 각 테스터가 슬롯을 쥐는 최대 시간)를 주석에 정량적으로 남겼다 — 이 자체가 이번 리뷰에서 가장 중요한 성능 결정이다. 리다이렉트 체인은 홉 상한(5)과 단일 타임아웃 신호로 유계이고, 응답 본문은 절대 버퍼링하지 않는다. `rotate()` 의 추가 `findOne` 왕복은 정합성을 위한 의도된 비용이며 N+1 패턴은 아니다. 유일하게 지켜볼 지점은 전역 동시성 상한 2가 다중 워크스페이스 환경에서 체감 지연(큐 대기)으로 이어질 수 있다는 것인데, 이는 설계자가 이미 인지하고 수치까지 남긴 트레이드오프이므로 CRITICAL/WARNING 이 아닌 INFO 로 남긴다. Critical·Warning 급 성능 결함은 발견되지 않았다.

## 위험도

NONE
