# 데이터베이스(Database) 리뷰 결과

## 발견사항

- **[INFO]** `schedule.deleted`/`trigger.deleted` 감사 기록이 트랜잭션으로 묶이지 않은 다단계 삭제 뒤에 붙는다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` `remove()` (264행 부근, `triggerRepository.delete` → `scheduleRepository.remove` → `recordAudit` 순), `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (851행 부근, BullMQ 해제 → secret 삭제 → `triggerRepository.remove` → `recordAudit` 순)
  - 상세: 두 메서드 모두 연관 리소스(트리거 cascade, secret store row, BullMQ job)를 순차적으로 지운 뒤 마지막에 엔티티를 삭제하고 감사를 기록한다. 이 다단계 삭제 자체가 단일 DB 트랜잭션으로 묶여 있지 않은 것은 본 변경 이전부터 있던 기존 패턴이고, 이번 diff 는 그 끝에 `recordAudit` 호출 한 줄을 추가했을 뿐이라 새로 도입된 문제는 아니다. 다만 audit 기록이 "커밋 직후"를 전제로 설계된 만큼(다른 모든 신규 recordAudit 호출은 이 원칙을 일관되게 지킨다), 선행 단계 중간에 실패하면 리소스는 부분 삭제된 채 감사도 남지 않는 조합이 여전히 가능하다.
  - 제안: 이번 PR 범위는 아니지만, 후속으로 `schedule`/`trigger` 삭제 경로를 `dataSource.transaction`으로 묶는 걸 고려할 수 있다(예: `workflows.service.ts`의 `create`/`duplicate`/`importWorkflow`가 이미 이 패턴을 따른다).

- **[INFO]** `recordAudit`의 `action` 파라미터 타입이 리소스별로 좁혀져 있지 않음
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` `recordAudit()`, `codebase/backend/src/modules/schedules/schedules.service.ts` `recordAudit()`, `codebase/backend/src/modules/triggers/triggers.service.ts` `recordAudit()`, `codebase/backend/src/modules/workflows/workflows.service.ts` `recordAudit()`
  - 상세: 네 서비스 모두 `action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]` 로 전체 34개 액션의 union 을 받는다. `resourceType` 은 각 서비스에서 상수로 하드코딩되어 안전하지만, `action` 은 컴파일러가 "이 서비스는 `model_config.*` 만 넘겨야 한다"를 강제하지 못한다. 실수로 다른 리소스의 액션 상수를 붙여넣으면 `audit_log.action` 과 `resource_type` 이 불일치하는 row 가 조용히 쌓일 수 있다(감사 로그 데이터 정합성 문제). 다만 각 호출부는 인접한 `AUDIT_ACTIONS.XXX_YYY` 리터럴을 명시적으로 쓰고 있어 실수 확률은 낮고, 이번 변경에서 실제 오배선은 없었다(각 서비스 spec 이 `action` 문자열을 정확히 단언).
  - 제안: 여유가 있으면 `recordAudit` 시그니처를 리소스별 액션 서브셋 타입으로 좁혀 컴파일 타임에 차단하는 것도 고려 가능(현재는 낮은 우선순위).

- **[INFO]** `audit_log` 테이블 write 볼륨 확대 — 기존에 이미 인지·문서화된 트레이드오프
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 파일 상단 JSDoc (46~51행)
  - 상세: 이번 변경으로 `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` 13개 CRUD 액션이 `audit_log`에 추가로 쌓인다. `audit_log`는 `V001__initial_schema.sql` 기준 보존 정책·pruner 가 없는 무제한 테이블이며, 조회 경로(`AuditLogsService.findAll`)는 `V002__indexes.sql`의 `idx_audit_log_workspace_created (workspace_id, created_at DESC)` 로 워크스페이스 스코프 조회는 커버된다. 코드 주석이 이미 이 트레이드오프를 인지하고 있고(같은 이유로 고빈도 `workflow.executed` 는 의도적으로 이번 범위에서 제외됨), 이번에 추가된 액션들은 CRUD(저빈도) 라 카디널리티 위험이 낮다는 판단도 명시돼 있다. 실측 없이 재론할 사안은 아니며, 별도 보존 정책 결정이 나오기 전까지는 현재 설계가 합리적이다.
  - 제안: 조치 불요. 추후 audit_log 보존 정책 결정 시 참고.

## 관점별 요약

1. **인덱스** — 새 쿼리 패턴 없음(모두 기존 `AuditLogsService.record()`의 단건 INSERT 재사용). `audit_log` 조회 경로는 기존 `(workspace_id, created_at DESC)` 인덱스로 커버됨. 신규 스키마 변경 없음.
2. **N+1 쿼리** — 신규 `recordAudit()` 호출은 각 CRUD 메서드당 단 1회, 루프 내부에 없음. `duplicate()`/`importWorkflow()`의 노드·엣지 배치 insert 는 기존 로직 그대로(로직 변경 없이 감사 호출 추가 래핑만 반영).
3. **트랜잭션** — 모든 신규 `recordAudit()` 호출이 "주 mutation 커밋 직후, 실패 가능한 외부 호출(BullMQ 등록, secret store, chat-channel setup) 이전"에 위치하도록 일관되게 배치됨. `model-config.setDefault`/`workflows.create`/`workflows.duplicate`/`workflows.importWorkflow` 는 트랜잭션 내부가 아니라 커밋 후 기록해 롤백 시 감사가 남는 것을 방지. `triggers.service.ts update()` 는 4차 리뷰에서 잡힌 순서 버그(스케줄 역동기화 앞으로 이동)가 이미 반영되어 있음.
4. **마이그레이션 안전성** — 이번 diff 에 스키마/마이그레이션 파일 없음. `audit_log` 테이블은 기존 스키마(V001) 그대로 재사용.
5. **스키마 설계** — 신규 컬럼 없이 기존 `action`(free string)/`resource_type`/`details`(JSONB) 설계를 그대로 확장. `details.kind`(model_config)/`details.type`(trigger)/`details.duplicatedFrom`·`details.imported`(workflow) 처럼 리소스별 부가 정보를 JSONB 에 담아 컬럼 증설 없이 확장한 것은 기존 패턴과 일관됨.
6. **커넥션 관리** — `EntityManager`/`Repository` 는 모두 NestJS DI 를 통한 기존 TypeORM pool 재사용. `saveWithDefaultSwap`/`saveCanvas` 등은 트랜잭션 매니저 스코프 repository 를 명시적으로 넘겨 추가 커넥션을 잡지 않도록 주석으로 근거를 남김.
7. **SQL 인젝션** — 신규 코드 경로 없음. 기존 `resolveOrderBy`/`getSortColumn` 화이트리스트 폴백(schedules/workflows) 은 변경 없이 유지되고 안전.
8. **대량 데이터** — 신규 페이지네이션 경로 없음. `audit_log` 무제한 성장은 기존에 문서화된 리스크이며 이번 변경이 그 트레이드오프를 악화시키긴 하나 저빈도 CRUD 액션으로 제한한 설계 판단이 근거와 함께 명시돼 있음(위 INFO 참고).

## 요약

이번 변경은 스키마·마이그레이션 변경 없이 기존 `audit_log` 인프라(`AuditLogsService.record`)를 `model-config`/`schedules`/`triggers`/`workflows` 4개 서비스의 CRUD 경로에 연결하는 순수 애플리케이션 계층 확장이다. 모든 신규 `recordAudit()` 호출이 "주 mutation 커밋 후, 실패 가능한 외부 부수효과 이전" 원칙을 예외 없이 일관되게 지키고 있어(주석에 각 배치 근거가 명시됨) 감사 데이터 정합성 측면에서 설계 품질이 높다. N+1·SQL 인젝션·커넥션 누수·마이그레이션 위험은 발견되지 않았고, 인덱스도 기존 `(workspace_id, created_at DESC)` 복합 인덱스로 신규 쓰기 패턴을 충분히 커버한다. 유일하게 남는 사안은 `schedules`/`triggers`의 다단계 삭제가 여전히 단일 트랜잭션이 아니라는 기존 갭(이번 diff 로 새로 생긴 것은 아님)과, 이미 코드 주석에 인지·근거가 남아 있는 `audit_log` 무제한 성장 트레이드오프뿐이며 둘 다 INFO 수준이다.

## 위험도

LOW
