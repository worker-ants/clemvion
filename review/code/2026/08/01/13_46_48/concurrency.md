# 동시성(Concurrency) Review

## 발견사항

- **[INFO]** `recordAudit` 배치가 트랜잭션 원자성을 올바르게 보존한다 — 결함 아님
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` (`setDefault`, 게이트 366-392), `codebase/backend/src/modules/schedules/schedules.service.ts` (`create` 게이트 156-193, `update` 게이트 204-262), `codebase/backend/src/modules/triggers/triggers.service.ts` (`create` 게이트 226-284, `update` 게이트 286-369, `remove` 게이트 854-883), `codebase/backend/src/modules/workflows/workflows.service.ts` (`create`/`duplicate`/`importWorkflow` — `dataSource.transaction(...)` 반환값을 받은 뒤 `recordAudit` 호출)
  - 상세: 이번 diff 는 model-config/schedules/triggers/workflows 4개 모듈의 CRUD 경로에 `AuditLogsService.record()` 호출을 일괄 주입한다. 트랜잭션을 쓰는 모든 경로(`ModelConfigService.setDefault`→`saveWithDefaultSwap`, `WorkflowsService.create`/`duplicate`/`importWorkflow`의 `dataSource.transaction(...)`)에서 예외 없이 **커밋 완료 후**에 `recordAudit`을 호출한다 — 트랜잭션이 throw 로 롤백되면 그 뒤의 `await this.recordAudit(...)` 자체가 실행되지 않으므로 감사도 남지 않는다. 이 불변식은 `model-config.service.spec.ts:970-1019`의 두 테스트(`setDefault 는 트랜잭션 **커밋 뒤**에 남긴다` / `트랜잭션이 실패하면 setDefault 는 감사를 남기지 않는다`)로 순서 관측(`order` 배열, tx-start/tx-commit/audit)까지 포함해 mutation-검증됐다(직접 `Read`로 확인). `AuditLogsService.record()`는 내부적으로 try/catch 로 실패를 흡수하므로(`audit-logs.service.ts:81-96`) 감사 기록 실패가 primary 요청 흐름을 깨거나 unhandled rejection 을 만들지 않는다. 모든 `recordAudit` 호출이 `await`되어 floating promise 도 없다.
  - 제안: 없음(정상 설계 확인용 기록).

- **[INFO]** `ModelConfigService.saveWithDefaultSwap`의 이론적 동시 default 중복 가능성 — 이번 diff 는 건드리지 않았고 DB 레벨 안전망 존재
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:351-364` (`saveWithDefaultSwap` — 컨텍스트만, diff 비수정)
  - 상세: `saveWithDefaultSwap`은 "기존 default 해제 UPDATE" + "신규 저장"을 한 트랜잭션으로 묶지만, 동시에 두 요청이 같은 (workspace, kind)에 대해 `isDefault=true`인 기존 row가 **하나도 없는 상태**(최초 default 지정)에서 겹치면 두 UPDATE 모두 매치 행 0건(잠금 없음)으로 통과하고, 두 INSERT/UPDATE 모두 `isDefault=true`로 커밋될 여지가 이론상 있다. 다만 `V089__model_config_kind_default_unique.sql`이 `(workspace_id, kind) WHERE is_default = true` partial unique index를 두고 있어(직접 `Read`로 확인), 위 경합이 실제로 발생해도 후속 커밋 쪽이 `23505 unique_violation`으로 실패하고 `http-exception.filter.ts`가 이를 409 `RESOURCE_CONFLICT`로 매핑한다(데이터 손상·unhandled 500 없음). 이번 audit-logging diff는 이 메서드 자체를 수정하지 않고 바깥에 `userId`+`recordAudit`만 추가했다.
  - 제안: 조치 불필요(참고 사실 기록). `saveWithDefaultSwap` 자체를 수정하는 후속 변경이 있으면 이 특성을 재확인할 것.

- **[INFO]** `TriggersService.rotateBotToken`의 6단계 오케스트레이션(secret resolve→backup→primary 교체→adapter 재호출→inbound-signing 저장→컬럼 갱신)은 단일 요청 내에서 여러 `await` 외부 호출을 순차 실행하며, 동일 trigger에 대한 동시 rotate 요청 2건이 겹치면 마지막 커밋이 이전 커밋을 덮어써 한쪽 응답의 `newBotToken`이 최종 저장된 값과 달라질 수 있는 lost-update 여지가 있다. 그러나 이 함수는 이번 audit-logging diff의 변경 대상이 아니며(`git diff origin/main...HEAD`로 확인 — 무변경), 감사 로깅과 무관한 기존 코드다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:980-1099` (`rotateBotToken` — 컨텍스트만, diff 비수정)
  - 제안: 이번 리뷰 범위(감사 로깅 추가) 밖 — 후속 별도 검토 대상으로만 기록.

## 요약

이번 변경은 `model-config`/`schedules`/`triggers`/`workflows` 4개 모듈의 CRUD 서비스에 `AuditLogsService`를 주입하고 `recordAudit()` 사설 헬퍼를 추가해 각 액션(create/update/remove/setDefault/duplicate/import)에 감사 기록 호출을 삽입하는 작업이며, 새로운 락·뮤텍스·스레드풀·커넥션풀·이벤트 루프 블로킹 코드는 도입하지 않는다. 트랜잭션을 쓰는 경로는 일관되게 커밋 이후 시점에 감사를 기록하고, 이 순서 불변식이 실측 테스트(`order` 배열 assertion)로 mutation-검증돼 있어 원자성·일관성 관점에서 문제가 없다. `AuditLogsService.record()`는 내부 try/catch로 실패를 흡수해 primary 흐름에 unhandled rejection을 유발하지 않는다. `remove()` 계열의 필드 선-캡처(`kind`/`type`을 `repo.remove()` 전에 지역 변수로 읽어두는 패턴)는 단일 요청 스코프 내 순차 코드라 동시성 결함이 아니다. `ModelConfigService.saveWithDefaultSwap`의 이론적 동시 default 중복 가능성과 `TriggersService.rotateBotToken`의 lost-update 여지는 둘 다 이 diff가 건드리지 않은 기존 코드이며, 전자는 DB 파셜 유니크 인덱스 + 전역 예외 필터의 409 매핑으로 이미 안전망이 갖춰져 있다. 종합적으로 이번 diff가 신규로 도입한 Critical/Warning 급 동시성 결함은 발견되지 않았다.

## 위험도

NONE
