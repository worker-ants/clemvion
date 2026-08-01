# 동시성(Concurrency) Review

## 발견사항

- **[INFO]** 감사 기록(`recordAudit`) 배치가 원자성을 올바르게 보존한다 — 결함 아님
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` (`setDefault`, 게이트 366-392), `codebase/backend/src/modules/schedules/schedules.service.ts` (`create`/`update`, 게이트 156-262), `codebase/backend/src/modules/triggers/triggers.service.ts` (`create`/`update`/`remove`, 게이트 199-260, 332-354, 854-880), `codebase/backend/src/modules/workflows/workflows.service.ts` (`create`/`duplicate`/`importWorkflow`, `dataSource.transaction(...)` 커밋 이후 `recordAudit` 호출부)
  - 상세: 이번 변경은 4개 모듈(model-config/schedules/triggers/workflows) CRUD 경로에 `AuditLogsService.record()` 호출을 일괄 주입한다. 모든 호출부가 `await`로 순차 실행되고, 트랜잭션을 쓰는 경로(`ModelConfigService.setDefault`/`saveWithDefaultSwap`, `WorkflowsService.create/duplicate/importWorkflow` 의 `dataSource.transaction(...)`)에서는 예외 없이 **커밋 완료 후**에 감사를 기록한다 — 트랜잭션이 롤백되면 감사도 남지 않는다(코드 주석과 `model-config.service.spec.ts:1002-1019` "트랜잭션이 실패하면 setDefault 는 감사를 남기지 않는다" 테스트로 실측 확인). `AuditLogsService.record()` 자체는 내부적으로 try/catch 로 실패를 흡수하므로(`audit-logs.service.ts:81-96`), 감사 기록 실패가 primary 요청 흐름을 깨거나 unhandled rejection 을 만들지 않는다. `recordAudit` 호출은 예외 없이 전부 `await` 되어 있어 floating promise 도 없다.
  - 제안: 없음(정상 설계 확인용 기록).

- **[INFO]** `remove()` 경로의 필드 선-캡처는 TOCTOU 로 오독될 수 있으나 실제로는 단일 요청 스코프 지역 변수라 안전
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:394-409` (`remove`), `codebase/backend/src/modules/schedules/schedules.service.ts:264-279` (`remove`), `codebase/backend/src/modules/triggers/triggers.service.ts:854-880` (`remove`)
  - 상세: 세 서비스 모두 `repo.remove(entity)` 호출 전에 `kind`/`type` 필드를 지역 변수로 미리 읽어 감사에 사용한다(TypeORM `remove()` 가 엔티티의 `id`를 지우는 부작용 방지 목적). 이는 같은 요청 내부의 순차 코드라 동시성 문제가 아니며, 요청 간(concurrent delete) TOCTOU 는 이 diff 가 도입한 게 아니라 기존 CRUD 패턴이다(`findEntity`/`findById` 로 조회 후 삭제하는 구조 자체가 변경 전부터 존재). 리소스가 삭제 사이 다른 요청에 의해 이미 지워졌다면 `findEntity`/`findById` 단계에서 404 로 걸러진다.
  - 제안: 신규 결함 아님 — 참고용.

- **[INFO]** `ModelConfigService` 의 default-swap 트랜잭션(`saveWithDefaultSwap`, 게이트 351-364)은 이번 diff 로 수정되지 않은 기존 코드이며, 이론상 동시 `create(isDefault:true)` 두 건이 겹치면 "기존 default 해제" UPDATE 가 서로의 신규 INSERT 를 보지 못해(READ COMMITTED 하에서 매치 행 0건이면 잠금도 없음) 일시적으로 두 행이 `isDefault=true` 가 될 여지가 있다. 다만 이는 DB 파셜 유니크 인덱스 `model_config_workspace_kind_default_unique`(`V089__model_config_kind_default_unique.sql`, `(workspace_id, kind) WHERE is_default = true`)가 최종 정합성을 보장하고, 위반 시 `common/filters/http-exception.filter.ts` 가 Postgres `23505` 를 409 RESOURCE_CONFLICT 로 매핑해 데이터 손상이나 unhandled 500 없이 처리된다. 이번 audit-logging diff 는 이 메서드를 건드리지 않았고(‌`userId`+`recordAudit` 호출만 그 바깥에 추가) DB 계층에서 이미 안전망이 있으므로 심각도를 매기지 않는다.
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:351-364` (`saveWithDefaultSwap`, 컨텍스트만 — diff 비수정)
  - 제안: 조치 불필요 (참고 사실 기록). 향후 `saveWithDefaultSwap` 자체를 수정하는 변경이 있다면 이 동시성 특성을 재확인할 것.

## 요약

이번 변경은 `model-config`/`schedules`/`triggers`/`workflows` 4개 모듈의 CRUD 서비스에 `AuditLogsService` 를 주입하고 `recordAudit()` 사설 메서드를 추가해 각 액션(create/update/remove/setDefault/duplicate/import)에 감사 기록 호출을 삽입하는 작업이며, 새로운 락·뮤텍스·스레드풀·커넥션풀·이벤트 루프 블로킹 코드는 도입하지 않는다. 모든 `recordAudit` 호출이 `await` 로 순차 실행되고, 트랜잭션을 쓰는 경로는 일관되게 커밋 이후 시점에 감사를 기록하도록 배치되어 있어(그리고 `model-config.service.spec.ts` 가 트랜잭션 실패 시 감사 미기록을 실측 검증) 원자성·일관성 관점에서 문제가 없다. `AuditLogsService.record()` 는 내부 try/catch 로 실패를 흡수하므로 감사 기록 자체가 primary 요청 흐름에 unhandled rejection 을 유발할 위험도 없다. `remove()` 계열의 필드 선-캡처는 단일 요청 내 순차 로직으로 동시성 결함이 아니다. `ModelConfigService.saveWithDefaultSwap` 의 이론적 동시 default 중복 가능성은 이 diff 가 건드리지 않은 기존 코드이고 DB 파셜 유니크 인덱스 + 전역 예외 필터의 409 매핑으로 이미 안전망이 갖춰져 있다. 종합적으로 신규 Critical/Warning 급 동시성 결함은 발견되지 않았다.

## 위험도

LOW
