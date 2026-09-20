# 데이터베이스(Database) 리뷰

## 컨텍스트

이번 diff 는 이전 라운드(`review/code/2026/09/20/20_06_26`)에서 WARNING #1(아키텍처)·WARNING #3(테스트)로
지적된 항목에 대한 **resolution 커밋들**(`27f488d09`, `e175489fe`, `64e4e434d`, `ee3fb4f75`)이다. 실제
DB 관련 코드 변경은 파일 2·4·6·8(구현)과 파일 3·5·7·9(테스트)에 있고, 나머지(파일 10~34)는 plan·이전
리뷰 라운드 산출물(md/json)로 DB 관점에서 점검할 대상이 아니다. 저장소는 Read/grep/sed 로만 조사했고
어떤 파일도 쓰거나 고치지 않았다 — 뮤테이션·복구 관련 보고 사항 없음(`git status --short` 로 확인, 리뷰
세션이 만든 신규 미추적 리뷰 산출물 외 변경 없음).

## 발견사항

- **[INFO]** 워크플로 경로의 "감사 중복" 실사고와 달리, 워크스페이스 삭제(`deleteWorkspace`)는 애초에
  삭제 시점에 `auditLogsService.record(...)` 호출이 없다(grep 결과 `WorkflowsService.remove` 만
  `AUDIT_ACTIONS.WORKFLOW_DELETED` 를 기록하고, `deleteWorkspace` 본문에는 그런 호출이 없다). 즉 이번
  PR 이 워크스페이스 경로에 대칭으로 추가한 `parentPresence === 'absent'` → 404 단락은 "감사 행 중복"을
  막는 것이 아니라(애초에 그 경로엔 막을 중복 행이 없다), 403 오응답 + 거짓 ERROR 로그를 막는 것이다.
  DB 데이터 정합성 관점에서는 문제였던 적이 없다는 뜻이라 CHANGELOG·plan 의 "트리거 목록 §4.4 대칭"
  서술과 완전히 같은 성격의 결함은 아니었음을 짚어 둔다(코드 결함 아님 — 서술의 정밀도 참고 사항).
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`deleteWorkspace` 전체,
    `auditLogsService.record` 호출 없음) 대조 `codebase/backend/src/modules/workflows/workflows.service.ts:302`
    (`this.recordAudit({ ... action: AUDIT_ACTIONS.WORKFLOW_DELETED ... })`, 트랜잭션·`releaseSecretsAfterCommit`
    **이후**에 호출되어 두 번째 요청이 `NotFoundException` 으로 끝나면 이 줄에 도달하지 않는다 — 정상)
  - 제안: 조치 불필요. 다음에 워크스페이스 삭제에 감사 로그를 추가할 때, 이 PR 이 이미 확보해 둔
    `parentPresence` 기반 404 단락 덕분에 중복 기록 위험 없이 안전하게 붙일 수 있다는 점만 기억하면 된다.

- **[INFO]** 동시성에 대한 **실제 DB 레벨(row-lock) e2e 재현**이 워크플로 경로에만 있고 워크스페이스
  경로에는 없다 — 비대칭. `workflow-delete-concurrency.e2e-spec.ts` 는 별도 커넥션으로
  `SELECT ... FOR UPDATE` 를 직접 쥐어 두 DELETE 요청의 겹침을 결정적으로 만들고
  `audit_log` 테이블을 직접 질의해 행 수가 1임을 확인한다. 워크스페이스 경로의 동일 시나리오(404 단락 +
  로그 억제)는 리포지토리 mock 을 쓰는 단위 테스트(`workspaces.service.spec.ts`)와 코드 뮤테이션으로만
  검증됐다(`RESOLUTION.md` 기록). 위 INFO 에서 짚었듯 워크스페이스 경로엔 애초에 감사 중복이 없어
  파급력은 낮지만, CASCADE(`invitation`/`member` 행 삭제)와 `assertWorkspaceDeletable` 의 두 번째
  `pessimistic_write` 재잠금이 실제 동시 트랜잭션 하에서도 교착(`40P01`) 없이 의도대로 직렬화되는지는
  실제 DB 로 아직 실측되지 않았다.
  - 위치: `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts` (신규, 워크플로만 커버)
  - 제안: 필수는 아님(비차단). 후속으로 동일 기법(`plan/complete/rotate-lost-update.md` 패턴)을 재사용한
    `workspace-delete-concurrency.e2e-spec.ts` 를 추가하면 워크스페이스 쪽 잠금 순서(워크스페이스 →
    멤버십)가 실제 경합 하에서도 안전함을 코드 리뷰가 아닌 실측으로 고정할 수 있다.

## 관점별 점검 결과

1. **인덱스** — 변경된 쿼리는 모두 PK(`Workflow.id`, `Workspace.id`) 또는 FK 인덱스가 이미 있는 컬럼
   (`Trigger.workflowId`/`workspaceId`) 기준이다. 신규 쿼리 패턴 추가 없음(기존 `findOne`/`find` 반환값
   소비 방식만 바뀜). 이슈 없음.
2. **N+1** — `lockParentAndListTriggerIds`(`trigger-resource-releaser.service.ts:81-109`)는 부모 조회
   1회 + 트리거 조회 1회, 고정 2쿼리다. 반복문 내 개별 쿼리 없음. 변경 전후 쿼리 횟수 동일 — 버려지던
   `findOne` 결과를 반환하도록만 바뀌었다.
3. **트랜잭션** — 이번 diff 의 핵심 축. `WorkflowsService.remove()`(`workflows.service.ts:269-298`)는
   `pessimistic_write` 로 부모 행을 잠근 뒤 그 결과(`parentPresence`)를 **트랜잭션 내부에서 즉시** 분기해
   `absent` 면 `NotFoundException` 을 던져 TypeORM `transaction()` 콜백이 자동 ROLLBACK 하도록 한다 —
   감사 기록(`recordAudit`, :302)과 `releaseSecretsAfterCommit` 모두 트랜잭션 반환값(`triggerIds`) 이후에
   실행되므로, 두 번째 요청은 그 지점에 도달하지 못해 audit 중복이 원천 차단된다. `WorkspacesService
   .deleteWorkspace()`(`workspaces.service.ts:519-561`)도 같은 헬퍼 결과를 같은 자리에서 검사하도록
   대칭 수정됐고, `assertWorkspaceDeletable` 재검사(`:536-541`, 잠금 순서 워크스페이스→멤버십 유지)도
   같은 트랜잭션·같은 커넥션 내 재잠금이라 자기 자신을 막지 않는다(교착 없음). `.catch` 블록 양쪽 모두
   `NotFoundException` 을 먼저 걸러 재던지도록 대칭 추가됐다(`workflows.service.ts:293`,
   `workspaces.service.ts:553`) — "정상적인 동시-삭제 패배"와 "진짜 반쯤-삭제 실패"를 구분해, 전자에
   거짓 error 로그를 남기지 않는다. e2e(`workflow-delete-concurrency.e2e-spec.ts`)는 별도 커넥션의
   `FOR UPDATE` 로 겹침을 우연에 맡기지 않고 만들고, `Promise.race` 로 "판별력 가드"까지 둬 무의미한
   통과를 스스로 차단한다.
4. **마이그레이션 안전성** — 스키마 변경(마이그레이션 파일) 없음. 해당 없음.
5. **스키마 설계** — 테이블 구조 변경 없음. `lockParentAndListTriggerIds` 반환 타입이
   `Promise<string[]>` → `Promise<LockedParentTriggers>`(`{ parentPresence: 'present'|'absent';
   triggerIds: string[] }`, `trigger-resource-release.ts:120-129`)로 바뀐 것은 애플리케이션 계약
   변경이며, "부재"와 "0개"를 이름 있는 판별 유니온으로 분리해 이전 truthiness 오판 계열을 막는
   합리적 설계다.
6. **커넥션 관리** — 서비스 코드의 `manager` 는 `dataSource.transaction()` 스코프 내에서만 쓰이고 별도
   획득/해제 코드 없음(기존 패턴 유지). e2e 는 `db`·`locker` 두 `pg.Client` 를 `beforeAll`에서 열고
   `afterAll`에서 `end()` 로 닫으며, 테스트 본문의 `try/finally` 가 `ROLLBACK`(이미 COMMIT 된 뒤라도
   `.catch(() => undefined)` 로 안전하게 무시)과 `pending` 실패를 모두 흡수해 락이나 커넥션이 새는
   경로가 없다.
7. **SQL 인젝션** — 변경된 쿼리는 전부 TypeORM `findOne`/`find`(파라미터 바인딩)이거나, e2e 의 원시
   SQL(`SELECT id FROM workflow WHERE id = $1 FOR UPDATE`, `SELECT COUNT(*)::text ... WHERE resource_id
   = $1 ...`)도 `$1` 플레이스홀더로 파라미터화되어 있다. 문자열 결합으로 사용자 입력을 SQL 에 직접
   삽입하는 자리는 없음.
8. **대량 데이터** — 이번 변경은 단건 PK/FK 조회·삭제이며 목록 페이지네이션이나 대용량 스캔과 무관.
   해당 없음.

## 요약

이번 diff 는 이전 라운드 database 리뷰(LOW, `20_06_26/database.md`)가 남긴 유일한 INFO — 워크스페이스
삭제 경로가 워크플로와 비대칭적으로 거짓 ERROR 로그·403 오응답을 남길 수 있다는 지점 — 를 헬퍼가 이미
잠그며 읽은 부모 존재 여부(`parentPresence`)를 트랜잭션 내부에서 즉시 검사해 404 로 단락하는 방식으로
정확히 대칭 해소했다. 추가 쿼리 없이 기존 `pessimistic_write` 조회 결과를 재사용하며, TypeORM
트랜잭션 자동 ROLLBACK 에 의존해 원자성을 유지하고, `.catch` 양쪽 모두 `NotFoundException` 을 먼저
걸러 거짓 경보를 없앴다. 워크플로 경로는 실제 DB 행 락(`FOR UPDATE`)으로 경합을 결정적으로 재현하는
e2e 로 "감사 행 1건, 응답 `[204, 404]`"를 실측 고정했다. 인덱스·N+1·마이그레이션·스키마·커넥션
관리·SQL 인젝션·대량 데이터 관점에서 새로 발견된 문제는 없다. 다만 (1) 워크스페이스 삭제 경로는 애초에
그 시점에 감사 로그를 기록하지 않아 "감사 중복"이 아니라 "오응답 코드·거짓 로그" 문제였다는 점,
(2) 워크스페이스 경로의 동시성 수정은 워크플로처럼 실제 DB 행 락 e2e 로는 아직 검증되지 않고 mock
단위 테스트 + 뮤테이션으로만 검증됐다는 점을 INFO 로 남긴다 — 둘 다 이번 PR 을 막을 사유는 아니다.

## 위험도

LOW
