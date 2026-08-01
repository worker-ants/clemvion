# 동시성(Concurrency) 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅)

## 검토 범위·방법

프롬프트 번들이 크기 제한으로 잘라낸 6개 서비스 파일(`model-config.service.ts`, `schedules.service.ts`,
`triggers.service.ts`, `workflows.service.ts` 및 각 컨트롤러/spec)을 `Read`로 직접 전문을 열어 확인했다.
아울러 diff 에 포함되지 않았지만 신규 호출부가 전부 의존하는 `AuditLogsService.record()`
(`codebase/backend/src/modules/audit-logs/audit-logs.service.ts`), `AuditLog` 엔티티, `model_config`
의 default-swap 관련 마이그레이션(`V089__model_config_kind_default_unique.sql`), 그리고 동일 패턴의
선례인 `auth-configs.service.ts:273-288` 도 대조 확인했다.

## 발견사항

- **[WARNING]** 동시 삭제(DELETE) 요청이 동일 리소스에 대해 중복 `*.deleted` 감사 로그를 생성할 수 있음 — 4개 서비스에 동일 패턴으로 반복
  - 위치:
    - `codebase/backend/src/modules/model-config/model-config.service.ts:394-409` (`remove`, 신규 `recordAudit` 호출은 402-408)
    - `codebase/backend/src/modules/schedules/schedules.service.ts:260-275` (`remove`, 신규 호출 269-274)
    - `codebase/backend/src/modules/triggers/triggers.service.ts:859-888` (`remove`, 신규 호출 881-887)
    - `codebase/backend/src/modules/workflows/workflows.service.ts:254-263` (`remove`, 신규 호출 257-262)
  - 상세: 네 `remove()` 모두 `find*(id, workspaceId)` → (부수효과) → `repo.remove(entity)` →
    `await this.recordAudit(<RESOURCE>_DELETED)` 순서로 동작하고, 이 전체가 하나의 DB 트랜잭션이나
    `SELECT ... FOR UPDATE` 같은 락으로 묶여 있지 않다. TypeORM `Repository.remove(entity)` 는 엔티티의
    PK 로 `DELETE ... WHERE id = :id` 를 실행할 뿐 영향받은 행 수를 검사·보고하지 않으므로, 이미 삭제된
    행에 재호출해도 예외 없이 조용히 0-row DELETE 로 끝난다. `AuditLog` 엔티티
    (`codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts:12-48`)도 append-only 라
    `(action, resource_id)` 류의 유니크 제약이 전혀 없어 DB 레벨에서 중복을 막지 못한다. 따라서 동일
    리소스에 두 개의 DELETE 요청(더블클릭·재시도, 혹은 서로 다른 사용자)이 겹치면 두 요청 모두
    `find*` 시점엔 엔티티가 존재해 통과하고, 각자 `remove()` 뒤 `recordAudit()` 를 호출해 **동일한
    논리적 삭제 이벤트에 대해 두 건의 `*.deleted` 행**이 `audit_log` 에 남는다 — 실제로는 한 번만
    일어난 삭제가 두 행위자가 각각 삭제를 수행한 것처럼 기록된다. 사후 보안 조사·컴플라이언스
    감사에서 "누가 언제 삭제했는가"를 오판하게 만들 수 있어, 이 기능(감사 로깅) 고유의 목적을
    직접 훼손하는 결함이다. 다만 이 근본 패턴(`find→remove→recordAudit`, 행 수 미검증) 자체는
    이번 diff 가 처음 도입한 게 아니라 기존 `auth-configs.service.ts:273-288` 에 이미 있던 것이고,
    이번 diff 는 그 관측 가능한 결과(중복 감사 행)를 4개 리소스 타입으로 새로 확장·복제한다 —
    즉 "회귀"는 아니지만 같은 결함 클래스가 4곳 더 늘었다. `model-config`/`triggers` 의 경우 `kind`/
    `type` 필드를 삭제 전에 미리 읽어 TOCTOU 를 세심하게 방지한 반면(코드 주석: "TypeORM `remove` 는
    엔티티의 id 를 지운다"), "삭제가 실제로 이 요청에 의해 일어났는가" 자체는 검증하지 않는다는
    비대칭이 있다. 같은 근본 원인(행 수 미검증)이 이론적으로는 `update()` 계열에도 적용될 수 있다 —
    예컨대 `triggers.service.ts` 의 `update()`(L349-357/360-366)처럼 `save()` 이후 바로 `recordAudit`
    하는 경로에서, 저장 시점에 행이 동시 삭제돼 있었다면 TypeORM 은 이를 에러로 알리지 않고 조용히
    지나갈 수 있어 "이미 삭제된 리소스를 수정 성공"으로 오기록될 가능성이 있다 — 이쪽은 TypeORM
    내부 저장 전략에 따라 달라질 수 있어 확신도는 낮지만 같은 클래스의 파생 위험으로 남겨둔다.
  - 제안: `repo.remove(entity)` 대신 `Repository.delete(criteria)`/`manager.delete(...)` 를 사용해
    반환된 `DeleteResult.affected` 가 1 이상일 때만 `recordAudit(...)` 를 호출(실제로 삭제를
    수행한 요청만 감사 기록)하거나, 삭제 직전 `SELECT ... FOR UPDATE` 로 대상 행을 잠가 동시
    삭제 자체를 직렬화할 것. 네 서비스가 완전히 동일한 패턴을 반복하므로 공통 헬퍼(예:
    `AuditLogsService` 쪽에 "삭제 확인 후 기록" 유틸)로 한 번에 고치는 것이 재발을 막는 데
    효율적이다.

- **[INFO]** 감사 기록은 주 연산 커밋 후 별도(비원자적) 쓰기이며 실패는 의도적으로 삼켜진다 — 순서·원자성 설계 자체는 이번 diff 전체에서 일관되고 검증됨. 다만 트레이드오프는 인지 필요
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:68-97`(`record()` 의
    try/catch, 주석 "Failures are swallowed — audit logging must never break the primary
    action"). 호출부 예: `model-config.service.ts` `create()`(284-291)/`update()`(337-343)/
    `setDefault()`(366-392, 트랜잭션 커밋 뒤 384-391)/`remove()`(402-408), `workflows.service.ts`
    `create()`(191-227, 트랜잭션 커밋 뒤 219-226)/`duplicate()`(277-405, 커밋 뒤 394-404).
  - 상세: `AuditLogsService.record()` 는 내부에서 모든 에러를 삼키고 `logger.warn` 만 남기므로,
    `await this.recordAudit(...)` 가 실패해도 호출자(`create`/`update`/`setDefault`/`remove`/
    `duplicate`)는 절대 reject 되지 않는다 — 감사 실패가 주 연산의 성공 응답을 깨뜨리지 않는다는
    설계가 이번에 새로 추가된 4개 도메인 전체에서 정확히 지켜진다. 순서 보장(트랜잭션 커밋 →
    감사 기록, 롤백 시 감사 미기록)도 `model-config.service.spec.ts:958-1007`,
    `workflows.service.spec.ts:784-828` 테스트가 tx-start/tx-commit/audit 순서를 명시적으로
    관측해 뮤테이션까지 검증했다고 주석에 기록돼 있다 — 이 부분은 견고하다. 다만 `record()` 가
    에러를 삼키는 특성상, DB 커넥션 풀 고갈·순간 장애로 감사 INSERT 가 실패해도 주 응답은
    200/201/204 로 정상 반환되고 감사 로그만 조용히 유실된다. 트래픽이 몰려 동시성이 가장 높을
    때(=풀 경합이 심할 때) 감사 유실 가능성도 함께 커지는 역설이 있고, 재시도·DLQ 는 없다. 이
    설계 자체는 이번 diff 가 새로 도입한 게 아니라 기존 `AuditLogsService.record()` 계약을
    4개 신규 도메인으로 확장 적용한 것뿐이라 회귀는 아니다.
  - 제안: 조치 불요(의도된 트레이드오프, 이번 diff 범위 밖). 다만 향후 감사 로그 완전성이
    컴플라이언스 요건으로 격상되면, 실패 시 이미 스택에 있는 BullMQ 등으로 재시도 큐를 두는
    방안을 검토할 것.

- **[INFO]** 컨트롤러→서비스 인자 순서 전수 검증 — "W-1 류"(동일 타입 문자열 인자 순서 스왑) 버그 없음 확인
  - 위치: `model-config.controller.ts`/`schedules.controller.ts`/`triggers.controller.ts`/
    `workflows.controller.ts` 의 `create`/`update`/`setDefault`/`remove`/`duplicate` 전 호출부와
    대응 서비스 시그니처.
  - 상세: 각 서비스의 `recordAudit` 위에 달린 주석이 "positional 이면 동일 타입(string) 인자
    순서 스왑을 컴파일러가 못 잡아 감사 주체·대상이 조용히 뒤바뀐다(auth-configs W-1 과 동일
    근거)"고 명시 경고하는데, 정작 바깥쪽 공개 메서드(`create(workspaceId, dto, userId)` 류)
    자체는 여전히 위치 인자(문자열 3~4개)를 쓴다 — 잠재적으로 같은 클래스의 실수가 호출부에서
    발생할 수 있는 지점. 8개 컨트롤러 호출부를 서비스 시그니처와 전수 대조한 결과 `workspaceId`/
    `userId`/`id` 인자 순서 스왑은 발견되지 않았다. `workflows.controller.ts` 의 `create` 만
    다른 세 서비스와 인자 순서가 달라 `(workspaceId, userId, dto)` 형태인데, 호출부
    `this.workflowsService.create(workspaceId, user.sub, dto)`(`workflows.controller.ts:163`)
    와 정확히 일치함을 확인했다. `@CurrentUser` 데코레이터(`current-user.decorator.ts`)도
    요청마다 독립된 `request.user` 를 읽는 순수 함수라 요청 간 공유 상태 오염 위험이 없다.
  - 제안: 조치 불요(검증 결과 이상 없음). 다만 코드 스스로 지적한 위험 클래스이니, 차후
    리팩터링 시 이 네 서비스의 public CRUD 메서드도 `recordAudit` 처럼 params 객체로 바꾸는
    것을 고려할 만하다.

## 확인했으나 문제 없다고 판단한 항목

- `await` 누락: `recordAudit(` 전 호출부(model-config 4곳/schedules 3곳/triggers 5곳/workflows 4곳)
  전수 `grep` 결과 예외 없이 `await` 가 붙어 있다 — async/await 오용 없음.
- 데드락: 이번 diff 가 추가한 트랜잭션은 각 메서드당 최대 1개(`saveWithDefaultSwap`/`setDefault`/
  `workflows.create`/`duplicate`)이고 중첩 락 순서가 없어 신규 데드락 경로는 없다.
  `model-config.service.ts` 의 `saveWithDefaultSwap`/`setDefault` 동시 경합(서로 다른 config 를
  동시에 default 로 지정)은 `V089__model_config_kind_default_unique.sql` 의 partial unique index
  `(workspace_id, kind) WHERE is_default = true` 가 DB 레벨에서 막는다 — 진 쪽 트랜잭션은 unique
  violation 으로 throw 되어 롤백되고, `recordAudit` 는 트랜잭션 완료 **후**에만 호출되므로(순차
  `await`) 실패한 요청에 대해 감사가 잘못 남지 않는다(`model-config.service.spec.ts` 의 "트랜잭션이
  실패하면 setDefault 는 감사를 남기지 않는다" 테스트로 확인).
- 모듈 순환 의존: `AuditLogsModule`(`audit-logs.module.ts`)은 `TypeOrmModule.forFeature`만
  import 하고 다른 feature 모듈에 의존하지 않아, 이번 diff 가 4개 모듈(`model-config`/`schedules`/
  `triggers`/`workflows`)에 추가한 `imports: [..., AuditLogsModule]` 은 순환을 만들지 않는다
  (forwardRef 불필요, 부팅 시 undefined 주입 위험 없음).
- 이벤트 루프 블로킹: 이번 diff 는 순수 I/O(DB 쓰기) 기반 async 코드만 추가했고 동기 CPU 바운드
  연산·콜백 지옥은 없다.

## 요약

이번 diff 는 workflow/trigger/schedule/model_config 4개 도메인에 CRUD 감사 로깅을 추가하면서,
"트랜잭션 커밋 뒤에만 기록"·"named 파라미터로 인자 순서 스왑 방지"·"삭제 전 필드 선-읽기로 TOCTOU
방지"·"실패해도 주 연산을 깨지 않음" 등 동시성/원자성을 의식한 설계를 일관되게 적용했고, 테스트로
그 순서 보장까지 뮤테이션 수준으로 검증했다는 점에서 전반적으로 신중하다. 다만 정작 이 신중함이
비껴간 지점이 하나 있다 — 네 서비스의 `remove()` 가 모두 "삭제가 실제로 이 요청에 의해 일어났는가"
를 검증하지 않고 무조건 `recordAudit(DELETE)` 를 호출해, 동시 삭제 요청 경합 시 동일 리소스에 대해
중복된 `*.deleted` 감사 행이 남을 수 있다(WARNING). 이 패턴 자체는 `auth-configs.service.ts` 에
이미 있던 기존 관행을 그대로 재사용한 것이라 이번 diff 의 회귀는 아니지만, 감사 로그의 정확성이
곧 기능의 존재 이유인 만큼 4곳으로 늘어난 지금이 `DeleteResult.affected` 체크 같은 값싼 수정으로
한 번에 정리하기 좋은 시점이다. 그 외 감사 쓰기 실패가 조용히 삼켜지는 기존 계약의 확장 적용(INFO)과
컨트롤러→서비스 인자 순서 전수 검증(문제 없음, INFO)을 함께 기록해 둔다. CRITICAL 급(데이터 손상·
데드락·서비스 중단)이나 새로운 lost-update/race 는 발견되지 않았다.

## 위험도

MEDIUM
