# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[WARNING]** `CONNECTION_TEST_MAX_CONCURRENCY`(pLimit) 동시 상한이 entity-aware 테스터(cafe24 · makeshop)에는 적용되지 않는다 — 같은 DNS-스레드풀 소모 위험이 그 경로엔 그대로 남는다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `testConnection()` (게이트 967~977: `entityTester` 분기는 `dispatchTest`/`connectionTestLimit` 을 거치지 않고 바로 `return entityTester(entity)`), `dispatchTest()` (게이트 1525~1548: `connectionTestLimit` 은 여기서만 걸린다)
  - 상세: 이번 PR 이 추가한 `connectionTestLimit`(`integrations.service.ts` 게이트 405~408, `CONNECTION_TEST_MAX_CONCURRENCY` 문서 주석 게이트 113~123)의 목적은 "연결 테스트가 `dns.lookup` 으로 libuv 스레드풀(기본 4)을 채워 무관한 작업(`fs`·`crypto`·`zlib`)까지 멈추는 것"을 막는 것이라고 명시돼 있다. 그런데 이 상한은 `dispatchTest`→`transportTesters`(`mcp`·`email`·`database`·`http`) 경로에만 걸린다. `registerEntityTester`(`cafe24.module.ts:103`, `makeshop.module.ts:86`)로 등록된 cafe24 · makeshop 의 `pingConnection` 은 `testConnection()`(게이트 969~972)에서 `entityTester` 를 찾으면 `dispatchTest` 를 아예 거치지 않고 바로 호출된다 — 이 테스터들도 실제 외부 API 로 HTTP 요청을 보내므로 같은 `dns.lookup`/libuv 경합을 일으킬 수 있다. 즉 "연결 테스트 동시 개수를 프로세스 전체에서 2개로 묶는다"는 의도가 실제로는 mcp/email/database/http 네 서비스에만 적용되고, cafe24/makeshop 은 무제한으로 겹칠 수 있어 원 CRITICAL(전 라운드 리뷰, `review/code/2026/09/19/13_58_22`)이 겨눴던 스레드풀 고갈 시나리오가 그 두 서비스를 통해 여전히 열려 있다.
  - 제안: cafe24 · makeshop 의 `entityTester` 도 `connectionTestLimit` 으로 감싸거나(`testConnection()` 의 `entityTester` 분기를 `this.connectionTestLimit(() => entityTester(entity))` 로), 최소한 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "연결 테스트의 `dns.lookup` 이 스레드풀을 쥔다" 항목(게이트 4803~4809)에 "entity-aware 테스터는 상한 밖" 이라는 한 줄을 추가해 보장 범위를 실제와 맞춘다.

- **[INFO]** `pLimit(2)` 뒤 대기열은 길이 제한이 없다 — 이미 문서화된 낮은 우선순위 잔여 항목
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` 게이트 405~408 (`connectionTestLimit`)
  - 상세: 상한을 넘는 요청은 대기열에 무한정 쌓인다(연결 테스트 기능 자체의 지연은 유발하나 프로세스 전체를 멈추지는 않는다). `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 4803~4809 에 developer 가 이미 낮은 우선순위 잔여 항목으로 등재했고, `Promise.race` 타임아웃은 스레드를 풀지 못해 채택하지 않았다는 근거도 함께 있다 — 재지적하지 않고 확인만 한다.
  - 제안: 없음(추적 중).

- **[INFO]** `rotate()` 의 read-merge-test-write 패턴은 동시 rotate 호출 사이의 lost-update 가능성이 이번 diff 이전부터 있었고, 이번 변경으로 해소되지 않았다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `rotate()` 게이트 1067(`entity` 조회) ~ 1124(`save`)
  - 상세: 이번 diff 는 "엔티티 전체 `save`" → "바꾸는 컬럼만 부분 `save`" 로 바꿔, 연결 테스트(수 초 소요) 동안 `logUsage` 의 원자적 `update` 가 쓴 `lastUsedAt` 을 되돌리는 문제를 정확히 고쳤다(주석 게이트 1114~1116, 검증 테스트 `integrations.service.spec.ts` "rotate 는 바꾸는 컬럼만 저장한다..." 게이트 2075~2121). 다만 `merged = { ...baseCreds, ...body.credentials }`(게이트 1086~1089)는 `rotate()` 시작 시점에 읽은 `entity.credentials` 스냅샷을 기준으로 하므로, 같은 통합에 대해 두 `rotate()` 요청이 동시에 들어오면 둘 다 같은 옛 `credentials` 를 베이스로 병합해 나중에 완료되는 쪽이 이긴다(먼저 저장된 자격증명 교체가 조용히 유실될 수 있다) — 부분 `save` 로 바뀌어도 `credentials` 컬럼 자체에 대해서는 낙관적 잠금/버전 검사가 없다. 단, 이 패턴은 diff 범위 밖(변경되지 않은 코드)에 있던 기존 동작이라 이번 PR 이 새로 만든 결함은 아니다.
  - 제안: 필요 시 별도 후속으로 `WHERE credentials = <읽은 값>`/버전 컬럼 기반 조건부 update 를 검토(참고: 같은 서비스의 `handleUniqueViolation` 이 이미 유사한 DB-level race backstop 패턴을 씀).

- **[INFO]** MCP 연결 테스트 하나가 스레드 2개 이상을 쥘 수 있는 점은 상한 계산에 이미 반영·문서화됨
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` 게이트 113~123 (`CONNECTION_TEST_MAX_CONCURRENCY` 주석)
  - 상세: MCP SDK 가 연결 중 요청을 순차화하는지 보장하지 않아 테스트 1건이 스레드를 2개 이상 쥘 수 있음을 주석이 인지하고, 그래도 "테스트 수에 비례해 묶인다"는 근거로 상한 2를 선택했다고 명시한다. 근거가 검증 가능하고 반증되지 않았으므로 추가 지적 없음.

## 검증

- `pLimit(2)` 동시 상한: `integrations.service.spec.ts` 게이트 2026~2073 테스트에서 5개 동시 요청 중 정확히 2개만 즉시 진입하고(`peak === CONNECTION_TEST_MAX_CONCURRENCY`), 하나가 끝날 때마다 대기열에서 순서대로 하나씩 들어오는 것을 `inFlight`/`peak` 카운터로 검증 — 실제 세마포어 동작을 관측 가능한 형태로 확인했다(vacuous 아님).
- `rotate()` 부분 저장: unit(`integrations.service.spec.ts` 게이트 2075~2121, 저장 객체의 키 집합을 정확히 단언)과 e2e(`integration-connection-test.e2e-spec.ts` 게이트 161~189, 부분 객체 저장에서도 TypeORM 컬럼 transformer(암호화)가 걸리는지 실제 DB 로 확인) 양쪽에서 실측했다.
- 저장소 파일은 읽기만 했고 뮤테이션·임시 파일 생성은 하지 않았다 — `git status --short` 확인 불필요(트리 변경 없음).

## 요약

이번 PR 은 이전 라운드 리뷰가 지적한 CRITICAL(연결 테스트가 겹치면 `dns.lookup` 이 libuv 스레드풀을 고갈시켜 무관한 작업까지 지연시킬 수 있다)을 `pLimit(2)` 기반 동시 상한으로 고쳤고, 세마포어의 진입·대기·해제 동작을 실측 테스트로 검증했다. `rotate()` 의 부분 컬럼 저장 변경도 "연결 테스트 대기 중 `logUsage` 의 동시 원자적 update 를 엔티티 전체 저장이 되돌리는" 실질적 경쟁 조건을 정확히 겨냥해 고쳤고 unit·e2e 양쪽에서 검증됐다. 다만 새로 도입한 동시 상한의 보장 범위가 스스로 명시한 목적(연결 테스트 전체의 스레드풀 보호)보다 좁다 — cafe24 · makeshop 의 entity-aware 테스터는 같은 상한을 타지 않는다. 이는 이번 diff 가 새로 만든 회귀는 아니지만, "문서화된 보장이 실제 커버리지보다 넓다"는 형태의 갭이라 WARNING 으로 남긴다. 그 외 항목(대기열 무제한, rotate 의 사전 존재 lost-update 가능성, MCP 스레드 다중 점유)은 이미 트래커에 낮은 우선순위로 등재돼 있거나 근거가 문서화돼 있어 확인만 하고 재지적하지 않았다.

## 위험도

LOW
