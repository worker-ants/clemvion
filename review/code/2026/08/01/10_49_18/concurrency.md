# 동시성(Concurrency) 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅), 2차 라운드

## 검토 범위·방법

프롬프트 번들이 크기 제한으로 diff 를 생략한 파일(`model-config.service.spec.ts`,
`triggers.service.spec.ts`, `workflows.service.ts` 등)과, 프롬프트 자체에 diff 만 있고 전체 맥락이
필요한 서비스 파일(`model-config.service.ts`, `schedules.service.ts`, `triggers.service.ts`)을
`Read`로 전문 확인했다. 아울러 신규 `recordAudit()` 호출부가 전부 의존하는
`AuditLogsService.record()`, `AuditLog` 엔티티(유니크 제약 유무), `model_config` default-swap
관련 마이그레이션(`V089__model_config_kind_default_unique.sql`), 동일 패턴의 선례인
`auth-configs.service.ts:271-286`(`remove()`)를 대조 확인했고, `git diff origin/main...HEAD --
workflows.service.ts` 로 diff 생략분을 직접 재구성해 신규/기존 코드 경계를 검증했다.

본 세션은 이전 라운드(`review/code/2026/08/01/10_05_53/concurrency.md`, risk MEDIUM)의 조치 결과가
반영된 상태를 이 diff 자체가 포함하고 있다(`RESOLUTION.md` 가 신규 파일로 diff 에 포함됨). 해당
RESOLUTION 은 동시성 관련 항목(W6: 커밋 직후 기록 순서 정정, W5: trigger 이중 `recordAudit` 호출 통합,
W9: 트랜잭션 순서 테스트 mock 복원 try/finally)을 조치했다고 기록하고, 이전 라운드가 지적한 WARNING
(동시 삭제 시 감사 로그 중복)은 **의도적으로 미조치**로 남겼다고 명시한다. 이번 라운드는 그 주장을
그대로 받아들이지 않고 현재 코드 상태를 직접 다시 검증했다.

## 발견사항

- **[WARNING]** 동시 DELETE 요청이 동일 리소스에 대해 중복 `*.deleted` 감사 로그를 생성할 수 있음 — 4개 서비스 모두 동일 패턴 (여전히 미조치 확인)
  - 위치:
    - `codebase/backend/src/modules/model-config/model-config.service.ts:394-409` (`remove`, `recordAudit` 호출 402-408)
    - `codebase/backend/src/modules/schedules/schedules.service.ts:264-279` (`remove`, 호출 273-278)
    - `codebase/backend/src/modules/triggers/triggers.service.ts:849-878` (`remove`, 호출 871-877)
    - `codebase/backend/src/modules/workflows/workflows.service.ts:254-263` (`remove`, 호출 257-262)
  - 상세: 네 `remove()` 모두 `find*(id, workspaceId)`(존재 확인) → (부수효과: BullMQ 해제·secret 정리·
    캐시 무효화 등) → `repo.remove(entity)` → `await this.recordAudit(<RESOURCE>_DELETED)` 순서로
    동작하며, 이 전체를 하나의 DB 트랜잭션이나 `SELECT ... FOR UPDATE` 로 묶지 않는다. TypeORM
    `Repository.remove(entity)` 는 PK 로 `DELETE ... WHERE id = :id` 를 실행할 뿐 영향받은 행 수를
    검사·보고하지 않으므로, 이미 삭제된 행에 재호출해도 예외 없이 조용히 0-row DELETE 로 끝난다.
    `AuditLog` 엔티티(`codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts:12-48`)도
    append-only 라 `(action, resource_id)` 류의 유니크 제약이 전혀 없어 DB 레벨에서도 중복을 막지
    못한다(직접 확인). 따라서 동일 리소스에 대한 두 DELETE 요청(더블클릭·재시도, 혹은 서로 다른
    사용자)이 겹치면 둘 다 `find*` 시점엔 엔티티가 존재해 통과하고, 각자 `remove()` 뒤
    `recordAudit()` 를 호출해 **동일한 논리적 삭제 이벤트에 대해 두 건의 `*.deleted` 행**이
    `audit_log` 에 남는다 — 실제로는 한 번만 일어난 삭제가 두 행위자가 각각 삭제를 수행한 것처럼
    기록된다. 이 기능(감사 로깅) 자체의 존재 이유(사후 감사·컴플라이언스에서 "누가 언제
    삭제했는가"를 정확히 추적)를 직접 훼손하는 결함이다.
    이 diff 이전에는 이 4개 `remove()` 가 애초에 `recordAudit` 를 호출하지 않았으므로(감사 로깅
    기능 자체가 이번 PR 로 신규 추가), 중복 감사 행이라는 **관측 가능한 결과는 이번 diff 가 4곳에
    새로 만들어낸 것**이다. 다만 그 원인이 되는 근본 패턴(`find→remove→recordAudit`, 행 수 미검증)
    자체는 이번 diff 가 처음 고안한 게 아니라 기존 `auth-configs.service.ts:271-286` 의 `remove()`
    를 그대로 답습한 것이다(직접 대조 확인 — `findById` → `authConfigRepository.remove(config)` →
    `recordAudit(AUTH_CONFIG_DELETE, ...)` 로 완전히 동형).
    본건은 이전 라운드(`review/code/2026/08/01/10_05_53/concurrency.md` WARNING)가 이미 지적했고,
    `review/code/2026/08/01/10_05_53/RESOLUTION.md` "미조치 — 근거" 표의 W7 이 "기존 `auth-configs`
    패턴이 확장 복제된 것으로 이번 PR 이 만든 회귀가 아니다 … audit 은 append-only 라 중복 행이
    조회를 깨지도 않는다"는 근거로 의도적으로 미조치 처리했다고 기록돼 있다. 실측으로 재확인한 결과
    이 판단대로 코드는 그대로이며, 회귀가 아니라는 결론에는 동의하나(root cause 는 기존 패턴)
    "이번 PR 이 만든 것이 아니다"는 표현과 별개로 **이번 PR 이 처음으로 이 결함을 관측 가능하게
    만드는 4개 신규 진입점을 열었다**는 점은 유효한 사실이며, 감사 로그가 중복되어도 "조회를 깨지
    않는다"는 것이 곧 "안전하다"를 뜻하지는 않는다(행 개수 자체가 데이터라서, 삭제 이벤트 수를 세는
    질의·리포트가 왜곡된다).
  - 제안: `repo.remove(entity)` 대신 `Repository.delete(criteria)`/`manager.delete(...)` 를 쓰고
    반환된 `DeleteResult.affected` 가 1 이상일 때만 `recordAudit(...)` 를 호출(실제로 삭제를 수행한
    요청만 감사 기록)하거나, 삭제 직전 `SELECT ... FOR UPDATE` 로 대상 행을 잠가 동시 삭제 자체를
    직렬화할 것. 4개 서비스(+기존 `auth-configs`)가 완전히 동일한 패턴을 반복하므로, 공통 헬퍼(예:
    `AuditLogsService` 측에 "삭제 확인 후에만 기록" 유틸)로 한 번에 정리하면 5곳을 개별 수정하는
    것보다 재발 방지에 효율적이다. RESOLUTION.md 가 이미 이 항목을 `plan/in-progress/
    spec-sync-auth-gaps.md` 후속 목록(W7)에 등재했으므로, 신규 작업으로 만들기보다 해당 후속 항목의
    우선순위를 재확인할 것을 권장한다.

## 검토했으나 문제 없음으로 판단한 항목

- **await 누락**: `recordAudit(` 호출 전수(model-config 4곳 · schedules 3곳 · triggers 5곳 ·
  workflows 4곳) 를 직접 대조한 결과 모두 `await` 가 붙어 있다. `AuditLogsService.record()`
  (`codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-97`)는 내부 try/catch 로
  모든 에러를 삼키므로(`await` 대상이 절대 reject 하지 않음) 감사 기록 실패가 unhandled rejection
  이나 주 응답 실패로 번질 위험이 없다.
- **`setDefault`/`saveWithDefaultSwap` 동시 경합**(`model-config.service.ts:351-392`): 같은
  (workspace, kind) 에 대해 서로 다른 config 를 동시에 default 로 지정하는 두 요청이 애플리케이션
  트랜잭션만으로는 완전히 직렬화되지 않지만(먼저 "기존 default 해제" UPDATE 가 서로 다른 대상
  row 를 잠그지 않는 이상 이론상 두 config 가 동시에 `isDefault=true` 가 될 창이 있다), DB 레벨의
  partial unique index `model_config_workspace_kind_default_unique ON model_config (workspace_id,
  kind) WHERE is_default = true`(`codebase/backend/migrations/V089__model_config_kind_default_unique.sql:21-23`)
  가 이를 막는다 — 진 쪽 트랜잭션은 unique violation 으로 실패·롤백되고, `recordAudit` 는 트랜잭션
  완료 **후**에만 순차 `await` 로 호출되므로 실패한 요청에 대해 감사가 잘못 남지 않는다. 이 부분은
  이번 diff 가 변경하지 않은 기존 로직(트랜잭션 본문)이라 범위 밖이지만, 새로 추가된 `recordAudit`
  호출이 그 안전성을 해치지 않음을 확인했다.
- **W5 조치 검증**(`triggers.service.ts` `create`/`update`): `let result = saved;` 로 통합해
  `recordAudit` 호출이 `chatChannel` 분기와 무관하게 1회만 일어나도록 고친 것을 직접 코드로
  재확인했다(`create` 262-268, `update` 344-350) — 이중 호출 회귀 없음.
  `duplicate()`(`workflows.service.ts:277-405`)도 `REPEATABLE READ` 트랜잭션 커밋 후 1회만
  `recordAudit` 를 호출하고 노드/엣지 개수만큼 반복 호출되지 않는다.
- **데드락/순환 대기**: 이번 diff 가 다루는 트랜잭션은 메서드당 최대 1개(`saveWithDefaultSwap`/
  `setDefault`/`workflows.create`/`workflows.duplicate`)이고 중첩 락 순서가 없어 신규 데드락 경로는
  없다.
- **이벤트 루프 블로킹**: 추가된 코드는 순수 I/O(DB 쓰기) 기반 `async` 뿐이고 동기 CPU-바운드
  연산·콜백 지옥은 없다. `recordAudit` 호출이 반복문(loop) 안에서 발생하는 곳도 없어(전수 grep 확인)
  N+1 성 직렬 대기가 아니라 요청당 1회 추가 DB 왕복에 그친다 — 커넥션 풀을 반복 점유하지 않는다.
- **모듈 순환 의존**: `AuditLogsModule` 은 `TypeOrmModule.forFeature` 만 import 하는 leaf 모듈이라,
  4개 모듈에 추가된 `imports: [..., AuditLogsModule]` 은 순환을 만들지 않는다(forwardRef 불필요).

## 요약

이번 라운드에서 대상 코드는 "트랜잭션 커밋 뒤에만 기록"·"named 파라미터로 인자 순서 스왑 방지"·
"삭제 전 필드 선-읽기로 TOCTOU 방지"·"실패해도 주 연산을 깨지 않음" 등 동시성/원자성을 의식한 설계를
4개 도메인 전체에 일관되게 유지하고 있고, 이전 라운드에서 지적된 W6(감사 기록을 실패 가능한 외부
호출보다 먼저 배치)·W5(trigger 이중 호출 통합)도 코드로 직접 재확인해 정상 반영됐음을 확인했다.
다만 이전 라운드가 지적한 핵심 WARNING — 4개 서비스의 `remove()` 가 "삭제가 실제로 이 요청에 의해
일어났는가"를 검증하지 않고 무조건 `recordAudit(DELETE)` 를 호출해, 동시 삭제 경합 시 동일 리소스에
중복 `*.deleted` 감사 행이 남을 수 있는 문제 — 는 여전히 미조치 상태임을 실측으로 재확인했다.
`RESOLUTION.md` 가 이를 "기존 패턴의 확장이라 회귀가 아니다"라는 근거로 의도적으로 보류했다고
기록하고 있고, 그 root-cause 진단 자체는 타당하지만(`auth-configs.service.ts` 에 동일 패턴이 이미
있었음을 직접 대조 확인), 감사 로그의 정확성이 이 기능의 존재 이유인 만큼 4곳(+기존 1곳)으로
늘어난 지금이 `DeleteResult.affected` 체크 같은 값싼 공통 수정으로 정리하기 좋은 시점이라는 평가는
유효하다. 그 외 신규 데드락·이벤트 루프 블로킹·await 누락·모듈 순환은 발견되지 않았고,
`model_config` default-swap 경합은 기존 DB 유니크 제약으로 안전하게 보호됨을 확인했다.

## 위험도

MEDIUM
