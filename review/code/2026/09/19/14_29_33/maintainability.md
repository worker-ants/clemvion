# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** `DB_HOST_BLOCKED_MESSAGE`(`_MESSAGE` 접미) vs `SSRF_BLOCKED_CLIENT_MESSAGE`(`_CLIENT_MESSAGE` 접미) — 같은 역할(SSRF 차단 시 클라이언트에 돌려줄 일반화 문구 상수)인데 두 상수의 네이밍 패턴이 다르다.
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-connection.ts:25`(`export const DB_HOST_BLOCKED_MESSAGE`), `codebase/backend/src/nodes/integration/http-request/http-safety.ts:33`(`export const SSRF_BLOCKED_CLIENT_MESSAGE`)
  - 상세: 두 상수 모두 "SSRF 가드가 막았을 때 client 에 보여줄 일반화 문구"라는 동일한 목적의 JSDoc 을 달고 있다. 이름의 접미사가 다르면 다음에 Email 쪽(`EMAIL_HOST_BLOCKED`)에 같은 상수를 추가할 사람이 어느 컨벤션을 따를지 헷갈릴 수 있다.
  - 제안: 급하지 않음 — 이미 이 PR 의 plan(`plan/in-progress/integration-db-http-testers.md`)이 두 상수를 "노드와 테스터가 같은 문구를 쓴다"는 취지로 의도적으로 병렬 도입했으므로, 다음에 셋째 상수를 추가할 때 접미사를 통일하면 된다.

- **[INFO]** DB · HTTP 두 테스터의 "SSRF 차단 → 로그 + blocked 결과 생성" 패턴이 한쪽은 인라인, 한쪽은 헬퍼 함수(`blocked()`)로 서로 다르게 구조화되어 있다.
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts` `testDatabaseConnection` 내 SSRF catch 블록(호출부 1곳), `codebase/backend/src/modules/integrations/http-connection-tester.ts:19`(`function blocked`, 호출부 2곳: preflight·redirect 차단)
  - 상세: HTTP 쪽은 호출부가 2곳이라 헬퍼로 뽑을 근거가 있고, DB 쪽은 호출부가 1곳뿐이라 인라인이 자연스럽다 — 실질적인 결함은 아니고 두 "형제" 테스터를 나란히 읽을 때 구조가 다르다는 점만 눈에 띈다.
  - 제안: 조치 불요. 참고 사항으로만 남긴다.

- **[INFO]** `DB_CONNECT_FAILED`(신규) 와 기존 `DB_CONNECTION_ERROR`(노드 런타임)의 근접 동형 네이밍은 이미 같은 라운드의 consistency-check 에서 WARNING #5(`review/consistency/2026/09/19/13_03_41/SUMMARY.md`)로 잡혔고 후속 처리가 `plan/in-progress/spec-draft-nullable-notation-followups.md` §14.1 에 등재돼 있다 — 중복 지적 방지를 위해 새 결함으로 올리지 않고 교차 참조만 남긴다.
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:109`
  - 상세: 이미 처분 경로가 있으므로 이 리뷰에서는 상태만 확인.
  - 제안: 없음(추적 중).

- **[INFO]** `clampMessage` 이동(서비스 → `clamp-message.ts`) 자체는 깔끔한 중복 제거지만, JSDoc 이 "email · database · http testers" 세 소비자를 나열하면서 실제로 이 함수를 쓰는 `integrations.service.ts`(usage-log 클램핑)를 언급하지 않는다.
  - 위치: `codebase/backend/src/modules/integrations/clamp-message.ts:3-9`
  - 상세: 원래 주석은 `IntegrationUsageLog.error.message` 클램핑 목적을 명시했는데, 새 주석은 "connection-test result messages" 만 나열하고 원래의 usage-log 목적 문장은 그대로 유지("The same bound is applied to ... and to the connection-test result messages")해서 실질적으로는 정확하다 — 오탐에 가까운 관찰이라 INFO 로만 남긴다.
  - 제안: 조치 불요.

## 요약

이번 변경은 두 개의 새 트랜스포트 테스터(Database·HTTP)를 기존 `IntegrationsService.dispatchTest` 규약에 맞춰 깔끔하게 추가했다. 순환 import를 피하기 위해 노드 핸들러와 테스터가 공유하는 로직(`database-connection.ts`, `http-credentials.ts`, `http-redirect.ts`)을 의존성 없는 모듈로 뽑아낸 설계가 근거(순환 import 회피)와 함께 문서화되어 있고, `http-request.handler.ts`의 리팩터로 노드 실행과 연결 테스트가 실제로 같은 코드를 타는지가 구조적으로 보장된다. 각 함수는 짧고 단일 책임을 지키며(`probePostgres`/`probeMysql`/`isAuthFailure`/`classify`/`withQuery` 등), 중첩 깊이도 얕다. 매직 넘버(타임아웃 10초, 리다이렉트 5홉, 동시성 상한 2)는 모두 이름 있는 export 상수로 승격되었고 각 상수마다 그 값을 고른 근거를 설명하는 JSDoc(특히 `CONNECTION_TEST_MAX_CONCURRENCY`의 libuv 스레드풀 설명)이 붙어 있어 다음 사람이 값을 바꿀 때 근거를 다시 조사할 필요가 없다. 테스트(`*.spec.ts`, 신규 e2e)도 분기별로 잘게 나뉘어 있고 각 케이스의 의도가 한글 설명으로 명확하다. `rotate()`의 부분 저장(`Object.assign` + partial `save`) 변경도 왜 전체 엔티티 저장이 위험한지(동시 `logUsage`의 원자적 update를 덮어씀) 주석으로 설명되어 있어 다음에 이 코드를 만질 사람이 그 결정을 되돌리지 않도록 방어한다. 발견된 항목은 모두 INFO 수준의 사소한 관찰(네이밍 접미사 비대칭, 두 테스터의 SSRF-차단 코드 구조 차이)이며 이미 알려진 트래킹 항목과 중복되는 것도 있다 — 유지보수성을 저해하는 실질적 결함은 없었다.

## 위험도
NONE
