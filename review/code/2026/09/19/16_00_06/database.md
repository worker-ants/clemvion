# Database 리뷰

## 요약 (스코프)

이번 변경은 Database·HTTP 통합의 "연결 테스트"가 필드 구조만 보던 것을 실제 접속(`SELECT 1`, `GET base_url`)으로
바꾸는 기능이다. 스키마 변경(마이그레이션)은 없고, 자체 애플리케이션 DB에 대한 새 쿼리도 거의 없다 — 새로
추가된 `testDatabaseConnection`은 **사용자가 등록한 외부 DB**에 대해 일회성 연결을 열어 `SELECT 1`을 실행하고 닫을
뿐이다. 자체 DB(Postgres, `integration` 테이블) 쪽 변경은 `IntegrationsService.rotate()`의 저장 방식을 `save()` →
`update()`로 바꾼 것이 핵심이다.

## 발견사항

- **[INFO]** `testDatabaseConnection`의 일회성 연결은 스키마·풀 관리가 깔끔함 (특이사항 없음, 참고용)
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:81-119` (`probePostgres`/`probeMysql`)
  - 상세: 노드 실행용 커넥션 풀(`database-query.handler.ts`의 `pools` 맵)과 완전히 분리된 일회성 `Client`/`Connection`을 만들고, `finally`에서 항상 `closeWithin()`으로 닫는다. `closeWithin`은 graceful close에 상한(`DB_TEST_CLOSE_GRACE_MS=1000ms`)을 두고, 넘기면 드라이버 내부 소켓(`connection.stream`)을 강제 파괴해 소켓·연결 누수를 막는다. 연결(10s)·쿼리(10s)·닫기(1s) 각각에 타임아웃이 있어 응답하지 않는 서버에 무한정 매달리지 않는다. `database-connection-tester.spec.ts`가 정상/타임아웃/소켓 파괴/구조 변경 대비 케이스를 모두 커버한다.
  - 제안: 없음 — 커넥션 관리 관점에서 양호.

- **[INFO]** 프로세스 전역 동시성 상한(`CONNECTION_TEST_MAX_CONCURRENCY=2`)이 모든 연결 테스트(Database·HTTP·MCP·Email·엔티티 테스터)를 한 줄에 묶음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:132` (상수), `:413-416`(`connectionTestLimit = pLimit(2)`), `:983-984`(entity tester), `:1570`(transport tester)
  - 상세: `dns.lookup`이 libuv 스레드풀(기본 4)을 점유하고 Node 쪽 타임아웃이 없어(뮤테이션 없이 커밋 로그의 실측 근거 확인 — musl `EAI_AGAIN` ~5s) 응답 없는 DNS를 겨냥한 테스트가 몰리면 스레드풀이 고갈된다는 근거가 주석에 상세히 기록돼 있다. 상수 2는 스레드풀 절반을 상한으로 둔 의도적 설계이며, 데드락 방지를 위해 "entity tester는 같은 limit을 재진입(nested wait)하면 안 된다"는 계약도 문서화돼 있다(`:466-472`). DB 관점에서 문제는 아니지만, 워크스페이스가 많은 멀티테넌트 배포에서는 서로 다른 워크스페이스의 연결 테스트 요청도 프로세스 전역 2개로 직렬화된다 — 정상 케이스(성공 응답, 수백 ms)에서는 체감이 적겠지만, 느린 대상(느린 DNS·응답 없는 서버)에 대한 테스트가 몰리면 무관한 워크스페이스의 테스트 요청도 최대 수십 초 대기할 수 있다.
  - 제안: 이미 4라운드 리뷰를 거쳐 근거가 실측으로 뒷받침된 트레이드오프이므로 재작업을 요구하지는 않음. 다만 운영 중 "연결 테스트가 느리다"는 문의가 들어오면 이 전역 큐(인스턴스당 2)를 먼저 의심할 수 있도록 운영 문서/모니터링에 큐 대기시간 로그가 있는지 확인 권장.

- **[INFO]** `rotate()`가 `save()` → `update()`로 바뀐 것은 정합성 관점에서 개선 — 단, 두 단계(`update` → `findOne`) 사이에 트랜잭션이 없음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1139-1153`
  - 상세: 커밋 로그(`fix(integrations): rotate 는 update 로`)가 밝히듯, 기존 `save(entity)`는 연결 테스트로 수 초가 걸리는 동안 다른 요청(`logUsage`)이 원자적 `update`로 쓴 `lastUsedAt` 등의 컬럼을 엔티티 스냅샷의 옛 값으로 되돌리는 lost-update 버그였다. `update({id}, changes)`로 바꿔 변경 대상 컬럼만 쓰도록 고친 것은 올바른 방향이다. 다만 `update()` 성공(`affected>0`) 직후 별도의 `findOne()`으로 재조회하는 두 단계 사이에는 트랜잭션이 없다 — 그 찰나에 행이 삭제되면(동시 `remove` 호출) `saved`가 `null`이 되어 자격증명은 이미 바뀐 채로 404가 반환된다. 실제로는 `remove`가 흔치 않은 admin 동작이라 발생 확률은 낮고, "행이 사라졌으니 404"라는 응답 자체는 틀리지 않아 데이터 정합성 파손은 아니다.
  - 제안: 현재로선 심각도 낮음(허용 가능) — 다만 `update`+`findOne`을 하나의 트랜잭션(또는 `RETURNING` 절을 쓰는 raw query)으로 묶으면 두 라운드트립을 하나로 줄이고 이 틈새를 원천 차단할 수 있다는 점만 기록해 둔다.

- **[INFO]** `rotate()`의 자격증명 read-merge-write는 여전히 낙관적 동시성 제어 없이 경쟁 가능 (이번 diff가 도입한 문제 아님)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1080-1113` (`requireEntity` 로 읽은 `entity.credentials` 를 `merged = {...baseCreds, ...body.credentials}` 로 합친 뒤 그대로 `update` 에 씀)
  - 상세: 두 `rotate` 요청이 같은 integration에 대해 거의 동시에 들어오면, 각자 오래된 `baseCreds` 스냅샷을 기준으로 병합한 값을 무조건 덮어쓴다(버전 체크·`WHERE credentials = 기존값` 조건 없음) — 나중에 커밋되는 쪽이 이긴다(lost update). 다만 이 merge-then-unconditional-write 패턴은 이번 diff 이전부터 있던 구조(`save()` 시절에도 동일)이고, 이번 변경은 그중 `update` 전환에 관한 것이라 새로 만든 결함은 아니다.
  - 제안: 별도 개선 과제로만 남겨둠 — 이번 PR 스코프에서 고칠 것을 요구하지 않음.

- **[INFO]** 새 자체-DB 쿼리는 파라미터화됨 / SQL 인젝션 표면 없음
  - 위치: `codebase/backend/test/integration-connection-test.e2e-spec.ts:141-145, 169-177` (`db.query('... WHERE id = $1', [id])`)
  - 상세: e2e 테스트가 직접 조회하는 raw SQL도 `$1` 바인딩을 쓴다. `testDatabaseConnection`이 외부 DB에 실행하는 쿼리는 상수 문자열 `'SELECT 1'`뿐이라 사용자 입력이 SQL에 섞이지 않는다.
  - 제안: 없음.

- **[INFO]** 마이그레이션 없음 / 스키마 변경 없음
  - 상세: `git diff origin/main...HEAD`에 `codebase/backend/src/migrations` 하위 파일이 없다. 새 컬럼·인덱스·제약조건 추가가 없으므로 무중단 배포 관점의 lock 위험은 없음.
  - 제안: 없음.

## 위험도

LOW — 신규 코드가 자체 애플리케이션 DB(Postgres)에 미치는 영향은 `rotate()`의 저장 방식 개선(오히려 버그 수정) 정도이고, 나머지는 외부 사용자 DB에 대한 일회성 연결 테스트라 커넥션 관리·타임아웃·인젝션 방지가 모두 꼼꼼히 돼 있다. 남은 지적(rotate의 update+findOne 비원자성, read-merge-write 경쟁)은 이번 diff가 새로 만든 결함이 아니고 발생 확률·영향도 모두 낮아 INFO 수준에 그친다.
