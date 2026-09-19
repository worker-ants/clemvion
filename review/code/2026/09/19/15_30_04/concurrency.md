# 동시성(Concurrency) 리뷰

## 발견사항

- **[CRITICAL]** SSRF DNS 사전검사(`assertSafeOutboundHostResolved`)에 타임아웃이 없어, 신규 전역 동시 상한(`connectionTestLimit`, 2슬롯)을 영원히 붙잡을 수 있다
  - 위치:
    - `codebase/backend/src/modules/integrations/database-connection-tester.ts:137` — `await assertSafeOutboundHostResolved(creds.host);` (연결 시도 전, `DB_TEST_TIMEOUT_MS` 적용 전 단계)
    - `codebase/backend/src/nodes/integration/http-request/http-redirect.ts:27` — `outboundBlockReason()` 내부의 `await assertSafeOutboundHostResolved(...)` (최초 요청 + 리다이렉트 홉마다 호출)
    - `codebase/backend/src/modules/integrations/http-connection-tester.ts:115` — `const preflight = await outboundBlockReason(url);` — 이 호출은 123번째 줄의 `AbortSignal.timeout(HTTP_TEST_TIMEOUT_MS)` 가 만들어지기 **이전**에 실행되므로 그 신호로 취소되지 않는다
    - `codebase/backend/src/modules/integrations/integrations.service.ts:410-411`(`connectionTestLimit = pLimit(CONNECTION_TEST_MAX_CONCURRENCY)`), `:976`, `:1551` — 위 무제한 대기 구간이 전부 이 전역 세마포어 안에서 실행된다
  - 상세: `assertSafeOutboundHostResolved`(`http-safety.ts`)는 `node:dns/promises`의 `lookup(hostname, { all: true })`을 감싼다. `dns.lookup`은 AbortSignal/타임아웃 옵션을 받지 않고, OS 리졸버가 응답하지 않으면(예: 사용자가 등록한 DB host·HTTP base_url이 가리키는 도메인의 네임서버가 UDP 패킷을 blackhole 하는 경우) 매우 길게 또는 사실상 무기한 대기할 수 있다. 이 PR은 바로 이 함수를 감싸는 새 database/http 테스터를, 프로세스 전체가 공유하는 `pLimit(2)` 뒤에 새로 묶었다. `pLimit`이 관리하는 job(즉 `() => tester(...)`)의 promise가 절대 settle 되지 않으면 그 슬롯은 영구히 반환되지 않는다 — 딱 2건만 이런 host를 겨냥하면 이후의 **모든** workspace의 `preview-test`·`:id/test`·`rotate`(그리고 cafe24/makeshop entity tester까지, 동일 세마포어를 공유하므로) 가 프로세스를 재시작할 때까지 영원히 대기열에 걸린다.
    같은 라운드에서 이미 "닫기가 끝나지 않으면 동시 상한 슬롯을 영원히 쥔다"는 동일한 버그 유형을 `closeWithin`(소켓 close, 1초 유예 후 강제 destroy)으로 고쳤고, `connect`/`query`(10초)·`fetch`(`AbortSignal.timeout`)도 전부 개별 타임아웃을 갖도록 설계돼 있다. 이 SSRF 사전검사만 그 불변식(각 tester 안의 모든 대기 지점은 유계여야 한다)에서 빠져 있다. 스펙 파일들(`database-connection-tester.spec.ts`, `http-connection-tester.spec.ts`)도 close-hang 시나리오는 fake timer로 검증하면서 host-guard hang 시나리오는 검증하지 않는다(전부 `mockResolvedValue`/`mockRejectedValue`만 사용, hang 없음) — 설계상 인지된 트레이드오프가 아니라 누락으로 보인다.
  - 제안: `assertSafeOutboundHostResolved` 호출을 `closeWithin`과 같은 패턴(`Promise.race` + 타이머)으로 감싸 자체 타임아웃을 주거나, `dns.lookup` 대신 취소 가능한 DNS 조회로 교체한다. 타임아웃 시 "성공"으로 fail-open 하면 SSRF 완화 의도가 무너지므로, `DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED`류의 실패로 fail-closed 처리하고 슬롯을 반드시 반환하게 만든다.

- **[WARNING]** `entityTester`를 전역 `connectionTestLimit` 안에 새로 감싸면서, 재진입(reentrant) 호출 시 자기 데드락 가능성이 생겼다 — 현재는 발현하지 않지만 계약에 없다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:976`(`return this.connectionTestLimit(() => entityTester(entity));`), `registerEntityTester`의 calling contract 문서 — `:460`~`:465`
  - 상세: `registerEntityTester`로 등록되는 콜백(현재 cafe24·makeshop의 `pingConnection`)은 `p-limit(2)` 세마포어 안에서 실행된다. 만약 등록된 tester가 (직접이든 내부적으로든) 같은 `IntegrationsService`의 `testConnection`/`previewTest`/`dispatchTest` 등 같은 `connectionTestLimit`을 타는 경로를 다시 호출하면, 이미 슬롯을 점유한 채 그 슬롯의 해제를 기다리는 재귀 대기가 되어 concurrency=2 조건에서 두 슬롯이 모두 이런 중첩 호출로 채워지면 영구 데드락이 된다. cafe24/makeshop의 현재 구현(`cafe24-api.client.ts`의 `pingConnection`, `makeshop.module.ts`)은 직접 HTTP 호출만 해서 지금은 안전하지만, `registerEntityTester`의 docstring(460행 "Calling contract")에는 이 제약이 명시돼 있지 않다.
  - 제안: `registerEntityTester` 문서에 "등록하는 tester는 `IntegrationsService`의 연결 테스트 경로(`testConnection`/`previewTest`/`dispatchTest`)를 재귀 호출해서는 안 된다(같은 세마포어 재진입 시 데드락)"는 제약을 명시하거나, `pLimit` 대신 재진입을 감지/우회하는 구조로 바꾼다.

- **[INFO]** 전역 동시 상한(2)은 프로세스 전체·모든 workspace가 공유하며 테넌트별 공정성이 없다 — 의도된 설계지만 부작용 인지 필요
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:128`(`CONNECTION_TEST_MAX_CONCURRENCY = 2`), `:410-411`
  - 상세: `pLimit(2)`가 `IntegrationsService` 싱글턴 한 인스턴스에 붙어 있어 CHANGELOG가 밝힌 "한 프로세스에서 동시 2개"라는 설계 의도와 일치한다(entity tester 포함 모든 종류가 슬롯을 공유함은 `integrations.service.spec.ts`의 교차 테스트로 잘 검증됨). 다만 이는 워크스페이스 격리가 없는 전역 자원이므로, 한 workspace가 (분당 20회 throttle 한도 내에서) 정상적으로 느린 대상(각 최대 ~20초: DB 연결 10초+쿼리 10초, 혹은 HTTP 10초)을 반복 테스트하면 다른 모든 workspace의 연결 테스트가 그 시간만큼 줄을 서게 된다. 위 CRITICAL 항목이 고쳐지면(모든 대기 지점이 유계가 되면) 이 INFO는 "지연"으로 유계화되지만, 그 전까지는 위 CRITICAL과 결합해 전체 잠금으로 악화된다.
  - 제안: 별도 조치 불요(의도된 트레이드오프). CRITICAL 항목 수정 후에는 잔여 리스크가 "일시적 대기열 지연" 수준으로 축소됨을 확인만 하면 됨.

## 좋았던 점 (참고)

- `closeWithin`(`database-connection-tester.ts:34-62`)은 소켓 close가 끝나지 않을 때 1초 유예 후 강제 destroy해 슬롯을 반환하도록 정확히 고쳤고, `jest.useFakeTimers`로 실측 검증됐다(`database-connection-tester.spec.ts`).
- `rotate()`(`integrations.service.ts:1119-1134`)는 연결 테스트(수 초~수십 초 소요) 동안 `logUsage`가 원자적 `update`로 쓰는 `lastUsedAt` 등을 되돌리지 않도록, 전체 엔티티 저장 대신 바뀐 컬럼만 저장하게 바뀌었다 — 서로 다른 두 writer(rotate/logUsage)가 겹치는 구간의 lost-update를 컬럼 분리로 피한 합리적 수정이다(스펙 `integrations.service.spec.ts:2075` 이하로 검증).
- database/http/entity tester가 모두 같은 `connectionTestLimit` 슬롯을 공유하고 상한을 넘지 않음을 상세히 검증하는 통합 테스트(`integrations.service.spec.ts:2026`, `:2137`)가 추가돼 있다.

## 요약

이번 변경의 핵심은 Database·HTTP 연결 테스트를 신설하고 이를 프로세스 전역 `p-limit(2)` 세마포어로 묶은 것이다. 세마포어 자체의 FIFO 대기·슬롯 공유 로직은 견고하게 구현·검증되어 있고, 이전 라운드에서 발견된 "소켓 close가 끝나지 않으면 슬롯을 영원히 쥔다"는 문제도 `closeWithin`으로 정확히 막았다. 그러나 같은 패턴의 결함이 SSRF 사전검사(`assertSafeOutboundHostResolved`가 감싸는 `dns.lookup`)에는 여전히 남아 있다 — 이 호출에는 어떤 타임아웃도 없고, DB/HTTP 두 테스터 모두 `connect`/`fetch` 타임아웃이 걸리기 **이전** 단계에서 이 호출을 거치므로, 응답 없는 DNS를 겨냥한 단 2건의 테스트만으로 전역 슬롯 2개가 영구히 고갈되어 프로세스 재시작 전까지 모든 workspace의 연결 테스트 기능 전체가 멈출 수 있다. 이는 이번 PR이 직접 도입한 위험(기존에 존재하던 무제한 DNS 대기를, 새로 만든 전역 공유 세마포어 뒤로 끌어들인 것)이므로 배포 전 수정이 필요하다. 추가로 `entityTester`를 같은 세마포어로 감싼 것은 향후 등록되는 tester가 재귀적으로 같은 경로를 호출할 경우 자기 데드락 여지를 남긴다(현재 등록된 cafe24/makeshop tester는 안전).

## 위험도

CRITICAL
