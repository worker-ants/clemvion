# 성능(Performance) 코드 리뷰

## 개요

본 변경은 `workflow.*` / `trigger.*` / `schedule.*` / `model_config.*` CRUD 액션에 대한 감사 로그
기록(`AuditLogsService.record`) 배선을 4개 모듈(`WorkflowsService`, `TriggersService`,
`SchedulesService`, `ModelConfigService`)에 추가하고, 컨트롤러→서비스 경계에 `userId` 를 통과시키는
작업이다. `AuditLogsService.record()` 자체(및 `audit_log` 테이블/인덱스)는 이번 diff 의 변경 대상이
아니며 기존 구현 그대로다(`idx_audit_log_workspace_created (workspace_id, created_at DESC)` 인덱스는
V002 마이그레이션에 이미 존재).

## 발견사항

- **[INFO]** 모든 CRUD mutation 에 감사 로그 INSERT 1회가 요청 critical path 에 동기 추가됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` (recordAudit 정의 174-193, 호출부 create 220 / update 245 / remove 257 / duplicate 397 / importWorkflow 582), `codebase/backend/src/modules/triggers/triggers.service.ts` (정의 209-224, 호출부 create 262 / update 342 / remove 876), `codebase/backend/src/modules/schedules/schedules.service.ts` (정의 141-154, 호출부 create 188 / update 246 / remove 273), `codebase/backend/src/modules/model-config/model-config.service.ts` (정의 239-254, 호출부 create 284 / update 337 / setDefault 385 / remove 402)
  - 상세: `create`/`update`/`remove`(+ model-config 의 `setDefault`, workflow 의 `duplicate`/`importWorkflow`) 경로마다 `await this.recordAudit(...)` 가 추가되어, 응답을 반환하기 전에 `audit_log` 테이블에 대한 동기 INSERT 왕복이 하나씩 늘었다. `AuditLogsService.record()` 내부는 실패를 삼켜(catch) 주 동작을 깨지 않도록 설계돼 있어(`audit-logs.service.ts:81-96`) 안전성 측면은 문제없지만, 응답 지연(latency) 관점에서는 각 mutation 요청마다 DB 왕복이 하나씩 늘어난다. 다만 모든 호출이 트랜잭션 **커밋 이후**(예: `workflows.service.ts` 의 `create`/`duplicate`/`importWorkflow` 는 `dataSource.transaction(...)` 반환 뒤, `model-config.service.ts` 의 `setDefault` 도 `repo.manager.transaction(...)` 반환 뒤)에 위치해 있어 DB 트랜잭션/락 보유 시간을 늘리지는 않는다 — 이는 긍정적인 설계 선택이다.
  - 제안: 현 패턴은 `auth-configs`/`integrations` 등 기존 모듈과 동일해 신규 아키텍처 결정이 아니라 기존 관례의 확장이다. 별도 조치가 필요하다기보다, 만약 이 4개 리소스의 write QPS 가 향후 크게 늘어날 경우(특히 `workflow.updated` 처럼 캔버스 저장과 무관하게 자주 호출될 수 있는 경로) BullMQ 비동기 큐잉으로 전환하는 옵션을 검토할 수 있다는 정도로 참고.

- **[INFO]** 필드 변경 여부와 무관하게 no-op PATCH 도 항상 감사 로그 1행을 추가로 기록
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:294-345`(`update`), `codebase/backend/src/modules/schedules/schedules.service.ts:205-262`(`update`), `codebase/backend/src/modules/triggers/triggers.service.ts:262-370`(`update`), `codebase/backend/src/modules/workflows/workflows.service.ts:227-249`(`update`)
  - 상세: 네 서비스 모두 `update()` 가 `dto` 필드 존재 여부(`dto.xxx !== undefined`)로 개별 필드만 조건부 반영하지만, 엔티티 `save()` 와 `recordAudit()` 자체는 항상(빈 PATCH 바디여도) 실행된다. 엔티티 `save()` 무조건 호출은 이번 diff 이전부터 있던 기존 동작이라 diff 범위 밖이지만, 새로 추가된 `recordAudit()` 호출이 그 위에 얹혀 no-op 업데이트마다 `audit_log` insert 를 하나 더 얹는 구조가 됐다. 액션 자체(`schedule.updated` 등)는 "호출됐다"는 사실을 남기는 것이 의도된 설계로 보이나(코드 주석에서 감사의 목적을 명시), 값 변경이 전혀 없는 PATCH 호출까지 영구 테이블에 행을 남기는 것은 `audit_log` 가 "무제한 보존 정책·pruner 없음"(`audit-action.const.ts:46-51` 주석에 명시)이라는 이미 알려진 제약과 맞물려 불필요한 테이블 증가 요인이 될 수 있다.
  - 제안: 기능적 문제는 아니므로 필수 조치는 아니다. 다만 no-op PATCH 를 빈번히 보내는 클라이언트(예: 자동 저장 UI)가 있다면 실제 필드 변경이 있을 때만 `recordAudit` 을 호출하도록 좁히는 것을 향후 고려할 수 있다.

- **[INFO]** `audit_log` 무제한 보존 상태에서 감사 대상 리소스군이 4종 확장됨 (알려진 트레이드오프, 재확인 차원)
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:46-51`
  - 상세: 파일 상단 주석이 이미 "`audit_log` 은 보존 정책 미정·pruner 없음" 을 명시하고, 그 근거로 `workflow.executed` 처럼 고빈도 액션은 이번 스코프에서 의도적으로 제외했다고 설명한다. 반면 이번 diff 가 실제로 구현한 `workflow/trigger/schedule/model_config` 의 CRUD(저빈도) 액션은 그 판단대로 포함됐다. 팀이 이미 카디널리티 리스크를 인지하고 분리 결정한 흔적이 코드에 남아 있어 새로운 발견이라기보다 재확인에 가깝다.
  - 제안: 조치 불요. 추후 `audit_log` 증가 추이를 보아 보존 정책/pruner 도입 시점을 판단하면 된다(이미 코드 주석이 그 다음 단계로 명시).

## 알고리즘/데이터구조/N+1 관련 확인 사항 (문제 없음)

- `recordAudit()` 호출은 4개 서비스 전부에서 루프 밖 단건 호출로만 존재한다 (grep 결과 전체 호출부 확인 — 반복문 내부 호출 없음). N+1 패턴 없음.
- `workflows.service.ts` 의 `duplicate()`/`importWorkflow()` 는 노드/엣지를 `manager.insert(Entity, rows[])` 형태의 배치 insert 로 처리하며(개별 insert 루프 아님), 이번 diff 는 그 로직을 들여쓰기만 바꾸고(트랜잭션 클로저를 `await`로 감싸 반환값을 변수에 저장) 알고리즘 자체는 무변경이다.
- `ModelConfigService.findManyByIds()`(`model-config.service.ts:163-169`)는 이미 `IN` 절 배치 조회로 N+1 을 회피하도록 구현돼 있으며(주석에도 명시), 이번 diff 로 변경되지 않았다.
- `AUDIT_ACTIONS` 상수 34개 항목·`AuditLogDto.action` 의 긴 설명 문자열 리터럴 연결은 모듈 로드 시 1회만 평가되며 요청 경로 반복 연산이 아니다.
- `parseKind()`(`model-config.controller.ts`)의 `MODEL_CONFIG_KINDS.join(', ')` 은 3-요소 배열 join 으로 무시 가능한 비용이다.

## 요약

이번 변경은 감사 로그 기록 배선(감사 액션 4종 모듈 확장 + `userId` 인자 통과)에 한정된 계측성 코드이며,
알고리즘 복잡도 변화·N+1 패턴·비효율적 자료구조·불필요한 대량 메모리 할당은 발견되지 않았다. 유일한
성능 관련 포인트는 각 mutation 요청마다 감사 로그 INSERT 1회가 동기적으로 critical path 에 추가된다는
점인데, 트랜잭션 커밋 이후에 위치시켜 락 보유 시간을 늘리지 않도록 이미 신경 쓴 설계이고, 기존
`auth-configs`/`integrations` 모듈과 동일한 기존 관례를 따른다. no-op PATCH 에도 감사 행이 쌓이는 점과
`audit_log` 무제한 보존 상태에서 대상 리소스가 늘어나는 점은 모두 INFO 수준의 참고 사항이며, 코드 주석에서
팀이 이미 트레이드오프를 인지하고 있음이 확인된다.

## 위험도

LOW
