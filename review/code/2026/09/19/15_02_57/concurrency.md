# 동시성(Concurrency) 리뷰

## 발견사항

- **[INFO]** `connectionTestLimit(2)` 뒤 대기열은 길이 제한이 없다 — 이미 트래킹된 잔여 리스크
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:409` (`connectionTestLimit = pLimit(CONNECTION_TEST_MAX_CONCURRENCY)`), 사용처 `integrations.service.ts:1545`
  - 상세: `preview-test`/`:id/test`/`rotate` 세 경로 모두 같은 프로세스-전역 `pLimit(2)` 슬롯을 공유한다. `@Throttle` 은 분당 20회 요청 *속도*만 제한하므로, 한 사용자가 응답하지 않는 host 를 겨눈 연결 테스트를 짧은 시간에 여러 번 큐잉하면 최대 10~21초(Database: connect+query+close, HTTP: 10초)씩 슬롯 두 개를 계속 점유해 같은 기능을 쓰는 다른 워크스페이스 사용자 요청이 줄줄이 대기하게 된다(프로세스 전체가 멈추는 것은 아니고 연결 테스트 기능만 느려진다). 이는 이번 diff 가 새로 만든 문제가 아니라, 같은 PR 이 `dns.lookup`/libuv 스레드풀 고갈 CRITICAL(이전 라운드 `review/code/2026/09/19/13_58_22`)을 상한 도입으로 완화하면서 남긴 잔여이며, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 developer 가 이미 "낮음" 으로 등재해 뒀다(대기열 길이 제한 없음 · MCP 스레드 중복 사용 · 근본 해법은 c-ares/IP 직결). 새 결함이 아니라 기존에 열어둔 트래킹 항목의 재확인.
  - 제안: 별도 조치 불필요(이미 백로그에 있음). 재차 우선순위를 올리려면 대기열에도 상한을 두거나(예: `pLimit` 앞에 요청별 대기 타임아웃), MCP 테스터가 스레드 두 개 이상을 쥐는 케이스를 카운트에 반영하는 안을 검토.

- **[INFO]** `rotate()` 동시 호출은 last-write-wins — 손상은 아니나 감사로그와 실제 저장값이 어긋날 수 있음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1105-1139` (`rotate`)
  - 상세: 같은 integration 에 대해 두 개의 `rotate()` 요청이 거의 동시에 들어오면, 둘 다 `requireEntity` 로 옛 엔티티를 읽고, 각자 다른 새 자격증명으로 `dispatchTest`(연결 테스트, `connectionTestLimit(2)` 를 통과하는 데 수 초~수십 초)를 통과한 뒤 `save({id, ...changes})` 로 부분 저장한다. 두 저장 모두 유효(테스트를 통과한) 값이므로 데이터 손상은 아니지만, 나중에 끝난 쪽이 최종 상태를 결정하고 먼저 끝난 쪽의 `auditLogsService.record`/`broadcastCredentialChange` 호출 순서와 실제 DB 최종값의 대응 관계가 요청 완료 순서에 따라 달라질 수 있다(낙관적 잠금 없음). 기존 동작(전체 엔티티 `save`)도 같은 성격의 경합이 있었으므로 이번 diff 가 새로 만든 회귀는 아니다 — 부분 저장으로 바뀐 것은 오히려 `logUsage` 의 원자적 `update` 와의 충돌만 좁혀 고친 것(주석·테스트로 명확히 의도됨, `integrations.service.spec.ts:2075` 케이스로 검증됨).
  - 제안: 현재 위험 수용 가능(자격증명 교체는 드문 관리자 동작). 필요하면 `WHERE last_rotated_at = :expected` 형태의 조건부 update 로 좁힐 수 있으나 이 PR 스코프 밖.

## 확인한 항목 (결함 아님 — 설계 의도대로 동작)

- `closeWithin()`(`database-connection-tester.ts:34-50`) — `Promise.race([graceful().then(()=>true, ()=>true), timeout(DB_TEST_CLOSE_GRACE_MS)])` 로 닫기 대기에 1초 상한을 걸고, 넘기면 소켓을 파괴한다. graceful() 이 나중에 resolve/reject 되어도 이미 `.then(fulfilled, rejected)` 로 두 경로 모두 처리해 둬 unhandled rejection 이 나지 않는다. `database-connection-tester.spec.ts:95-111` 가 fake timer 로 "응답 없는 서버 → 상한까지만 기다리고 destroy" 를 직접 검증한다. 이는 커밋 `edd468476` 이 고친 "닫기가 안 끝나면 `connectionTestLimit` 슬롯을 영원히 쥔다" CRITICAL 의 재발 방지가 잘 됐음을 보여준다.
- `IntegrationsService` 는 `@Injectable()` 기본(싱글턴) 스코프라 `connectionTestLimit` 필드는 프로세스당 한 번만 생성된다 — REQUEST 스코프였다면 요청마다 새 `pLimit` 이 생겨 전역 상한이 무력화됐을 텐데, 그런 문제는 없다.
- `dispatchTest` → `connectionTestLimit(...)` 호출 경로(`testConnection`/`previewTest`/`rotate`)는 서로 재귀 호출하지 않아 세마포어 하나만 쓰는 구조다 — 락 중첩·순서 문제로 인한 데드락 여지가 없다.
- `http-connection-tester.ts` 의 `AbortSignal.timeout(HTTP_TEST_TIMEOUT_MS)` 는 `followRedirectsSafely` 의 리다이렉트 루프 전체에서 같은 `init.signal` 을 재사용해, 홉이 늘어도 총 대기가 10초를 넘지 않는다(주석과 일치). 루프 자체는 순차 `await fetch` 라 경쟁 조건 없음.
- `integrations.service.spec.ts:2026-2073` 의 동시성 상한 테스트는 mock resolver 를 수동으로 제어해(peak in-flight count) `CONNECTION_TEST_MAX_CONCURRENCY=2` 초과 시 큐잉되고, 하나가 끝나면 다음이 시작되는 것을 정확히 관측한다 — 가짜로 통과하는 vacuous 테스트가 아니다.
- `rotate()` 의 부분 `save({id, ...changes})` + `Object.assign(entity, changes)` 조합은 응답용 로컬 변수만 갱신하며, TypeORM 이 요청 간 identity map 캐시를 쓰지 않으므로 다른 요청과 공유 상태를 오염시키지 않는다.

## 요약

이 PR 은 Database·HTTP 연결 테스트를 실제 접속으로 바꾸면서 발생 가능한 두 가지 동시성 결함 — (1) 응답 없는 DNS/서버를 겨눈 테스트가 libuv 스레드풀·소켓 닫기 대기를 무기한 점유해 `connectionTestLimit` 슬롯을 영원히 쥐는 문제, (2) `rotate()` 의 전체-엔티티 `save` 가 연결 테스트 대기 중 `logUsage` 의 원자적 `update` 결과를 되돌리는 lost-update — 를 각각 `closeWithin`(1초 상한 + 소켓 강제 종료)과 부분 컬럼 `save` 로 정확히 막았고, 두 수정 모두 전용 유닛 테스트(fake timer 기반 타임아웃 검증, mock 기반 동시성 상한 검증, 부분 save 필드 검증)로 뒷받침된다. `pLimit(2)` 는 싱글턴 서비스에 한 번만 생성되고 재귀 호출이 없어 데드락 여지가 없다. 남은 잔여(대기열 무제한, MCP 스레드 중복 점유)는 이번 diff 가 새로 만든 것이 아니라 이미 planner 트래커에 등재된 알려진 저위험 항목이다. 새로 도입된 Critical/Warning 급 동시성 결함은 발견되지 않았다.

## 위험도

LOW
