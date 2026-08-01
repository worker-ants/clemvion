# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** 신규 감사 로깅 삽입이 4개 서비스의 mutating 엔드포인트마다 동기 DB round-trip 1회를 추가
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:284`(create), `:337`(update), `:385`(setDefault), `:402`(remove) / `codebase/backend/src/modules/schedules/schedules.service.ts:188`(create), `:246`(update), `:273`(remove) / `codebase/backend/src/modules/triggers/triggers.service.ts:262`(create), `:344`(update), `:871`(remove) / `codebase/backend/src/modules/workflows/workflows.service.ts:220`(create), `:245`(update), `:257`(remove), `:397`(duplicate)
  - 상세: 13개 신규 action 전부가 `await this.recordAudit(...)` → `AuditLogsService.record()`(`codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-97`, 본 diff 밖) 내부에서 `auditLogRepository.save()`(INSERT 1건)를 실행하고 컨트롤러 응답 반환 전까지 항상 대기한다. 이전에는 workflow/trigger/schedule/model_config CRUD 경로에 이 대기가 없었으나, 이번 변경으로 4개 모듈의 create/update/remove(+setDefault/duplicate) 전 경로에 편입되어 호출마다 순차적 DB round-trip 1회가 늘었다. 다만 각 `recordAudit` 호출은 반복문 밖에서 메서드당 정확히 1회만 실행되므로 N+1 패턴은 아니며, 대상 테이블에는 이미 `idx_audit_log_workspace_created(workspace_id, created_at DESC)` 복합 인덱스(V002 마이그레이션, 본 diff 밖)가 있어 INSERT 자체는 가벼운 편이다.
  - 제안: 기존 user/workspace/integration/auth_config 감사 패턴과 동일한 트레이드오프이므로 구조적 결함은 아니다. 다만 workflow/trigger/schedule/model_config CRUD는 관리 콘솔에서 빈번히 호출되는 경로이므로, 향후 p99 latency budget 이 빠듯해지면 audit INSERT를 fire-and-forget 큐잉(BullMQ 등)으로 전환하는 방안을 고려할 수 있다. 현재 수준(단일 indexed INSERT, 수 ms)에서는 즉각 조치 불필요.

- **[INFO]** `triggers.service.ts` create/update — `recordAudit` 와 독립적인 후속 I/O를 불필요하게 순차 실행
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:262-268`(create 의 recordAudit 호출) 직후 `:270`의 `normalizeNotificationSecretRef(saved)`, 그리고 `:344-350`(update 의 recordAudit 호출) 직후 `:351`의 동일 호출.
  - 상세: `recordAudit()`은 `saved.id`/`saved.type`만 읽고, `normalizeNotificationSecretRef()`(정의: `triggers.service.ts:555`)는 `trigger.config`의 notification.signing.secret 유무를 확인해 있으면 secret store로 옮기고 별도로 `triggerRepository.save(trigger)`를 호출한다 — 두 호출은 서로의 완료 여부에 의존하지 않는 독립적 부수효과다. `AuditLogsService.record()`는 자체 실패를 내부에서 삼키므로(try/catch), 두 작업을 동시 실행해도 "커밋 후 감사가 반드시 남는다"는 W6 불변식은 깨지지 않는다.
  - 제안: `await Promise.all([this.recordAudit({...}), this.normalizeNotificationSecretRef(saved)])` 로 병렬화하면, secret rotation 이 실제로 필요한 요청(외부 secret store 호출 포함)에서 DB round-trip 1회분 지연을 줄일 수 있다. 다만 이득이 마이크로초~밀리초 단위인 마이크로 최적화라 우선순위는 낮다.

- **[INFO]** (컨텍스트 — 새 결함 아님) `audit_log` 무제한 보존 하에서 write 볼륨 증가
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:38-43`
  - 상세: 코드 주석이 이미 명시하듯 `audit_log`에는 pruner가 없다. 이번 diff는 CRUD 저빈도 action 13개만 추가했고(고빈도인 `workflow.executed`는 같은 이유로 의도적으로 제외 — 주석 참조), 읽기 경로(`AuditLogsService.findAll`)는 기존 복합 인덱스로 커버되어 당장 회귀는 없다. 팀이 이미 인지하고 보존 정책 결정과 분리해 둔 사안이므로 본 리뷰에서 재조치를 요구하지 않는다.

## 요약

이번 변경은 model-config/schedules/triggers/workflows 4개 서비스에 감사 로그 기록(`recordAudit`)을 추가하는 기능으로, 모든 호출이 반복문 밖에서 mutating 메서드(create/update/remove/setDefault/duplicate)당 정확히 1회만 실행되어 N+1 쿼리·배치 누락 등 구조적 성능 결함은 발견되지 않았다. `workflows.service.ts`의 `duplicate()`는 기존 Node/Edge 배치 insert 로직을 그대로 보존하며 audit record는 트랜잭션 커밋 뒤 1회만 추가한다. 관찰된 사항은 (1) 13개 신규 action 전부가 응답 반환 전에 대기하는 동기 INSERT를 추가해 각 mutating 엔드포인트의 지연시간이 소폭 늘었다는 점(기존 감사 패턴과 동일한 설계 트레이드오프)과, (2) `triggers.service.ts`의 create/update에서 `recordAudit`과 `normalizeNotificationSecretRef`가 서로 독립적인데도 순차 실행된다는 점뿐이며, 둘 다 즉각 조치가 필요한 결함이 아니라 향후 최적화 여지에 가깝다.

## 위험도

LOW
