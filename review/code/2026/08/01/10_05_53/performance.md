# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** 감사 로그 기록이 각 CRUD 쓰기 경로에 동기 DB round-trip 1회를 추가한다 (의도된 트레이드오프)
  - 위치:
    - `codebase/backend/src/modules/model-config/model-config.service.ts:239-254`(`recordAudit` 헬퍼), 호출부 `:284-290`(create), `:337-343`(update), `:385-391`(setDefault), `:402-408`(remove)
    - `codebase/backend/src/modules/schedules/schedules.service.ts:141-154`(헬퍼), 호출부 `:193-198`(create), `:251-256`(update), `:269-274`(remove)
    - `codebase/backend/src/modules/triggers/triggers.service.ts:209-224`(헬퍼), 호출부 `:271-277`/`:281-287`(create), `:356-362`/`:366-372`(update), `:881-887`(remove)
    - `codebase/backend/src/modules/workflows/workflows.service.ts:174-189`(헬퍼), 호출부 `:220-225`(create, 트랜잭션 커밋 뒤), `:245-250`(update), `:257-262`(remove), `:397-403`(duplicate, 트랜잭션 커밋 뒤)
  - 상세: `AuditLogsService.record()`(`codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-97`)는 실패를 내부에서 삼키는 단건 INSERT지만, 4개 서비스의 create/update/remove/setDefault/duplicate 총 13개 지점 모두에서 `await`로 컨트롤러 응답 반환 전에 순차 대기한다. 트랜잭션이 있는 경로(model-config `setDefault`, workflows `create`/`duplicate`)는 커밋 **뒤**에 기록해 트랜잭션을 불필요하게 연장하지 않도록 정확히 설계돼 있고, 테스트(`model-config.service.spec.ts` `트랜잭션 **커밋 뒤**에 남긴다`, `workflows.service.spec.ts` 동일 케이스)가 그 순서를 명시적으로 고정한다 — 순서 자체는 옳다. 다만 순서를 지키기 위해 항상 `await`로 직렬화하므로, 각 쓰기 요청은 기존 DB 왕복에 audit INSERT 왕복 1회가 항상 추가되어 해당 엔드포인트들의 p50/p99 레이턴시가 소폭 증가한다. 루프 안에서 호출되는 곳은 없음을 확인했다(`grep`으로 모든 `recordAudit(` 호출 직전 컨텍스트에 `for`/`.map`/`.forEach`/`while` 없음 확인) — N+1 패턴은 아니다.
  - 제안: 현재 규모(단건 row, 실패해도 primary flow를 막지 않음)에서는 조치 불요. 프로덕션에서 이 레이턴시가 실측으로 문제가 되면, 코드베이스에 이미 있는 BullMQ 큐 패턴(schedules 모듈 등)을 재사용해 audit 기록을 비동기 큐로 위임하는 방안을 고려할 수 있다. 다만 이는 "커밋 후 정확한 순서 보장 + 실패 시 감사 누락을 즉시 로그로 관측" 이라는 현재 설계 목표와 트레이드오프이므로, 지금 시점에 변경을 권고하지는 않는다.

- **[INFO]** `audit_log` 무제한 테이블에 신규 쓰기 소스 4곳(13개 액션)이 추가되어 기존에 이미 알려진 보존 정책 공백의 소진 속도가 빨라진다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:38-43`(자체 doc-comment가 "무제한 테이블, pruner 없음"을 인지하고 CRUD는 저빈도라 포함, `workflow.executed`는 고빈도라 의도적으로 제외한다고 명시)
  - 상세: `audit_log` 테이블은 `(workspace_id, created_at DESC)` 복합 인덱스(`codebase/backend/migrations/V002__indexes.sql:33`) 외에 `action`/`resource_type`/`user_id` 필터 전용 인덱스가 없고 보존 정책(pruner)도 없다. 이는 이번 PR 번들에 포함된 consistency 리뷰(`review/consistency/2026/08/01/09_11_58/SUMMARY.md` INFO 6)가 이미 지적한 기존 갭이며, 본 diff의 설계도 그 갭을 인지한 채 고빈도 액션(`workflow.executed`)은 의도적으로 제외했다 — 판단 자체는 합리적이다. 다만 4개 모듈(model-config/schedules/triggers/workflows)의 일상적 CRUD 트래픽이 이제 이 테이블에 새로 쓰기 시작하므로, 테이블 증가 속도와 `GET /audit-logs` 조회(액션/리소스타입/유저 필터 시 인덱스 미사용) 성능 저하 시점은 실질적으로 앞당겨진다.
  - 제안: 이미 INFO 6으로 추적 중이므로 이번 PR에서 신규 조치는 불요. 후속으로 조회 API 필터 성능이 실측으로 저하되면 그때 `action`/`resource_type` 보조 인덱스 또는 보존 정책(pruner) 도입을 검토할 것.

- **[INFO]** `CurrentUser` 데코레이터·controller pass-through 변경은 런타임 비용 없음
  - 위치: `codebase/backend/src/common/decorators/current-user.decorator.ts:10-19`
  - 상세: `@CurrentUser('sub')`는 이미 인증 Guard가 request에 부착한 JWT payload에서 동기적으로 필드를 읽어올 뿐, 추가 DB/네트워크 호출이 없다. `model-config.controller.ts`/`schedules.controller.ts`/`triggers.controller.ts`/`workflows.controller.ts`의 변경은 파라미터 추가 및 그대로 전달뿐이라 성능 영향 없음.
  - 제안: 조치 불요(참고용 확인 사항).

## 검토했으나 문제 없음으로 판단한 항목

- `workflows.service.ts`의 `duplicate()`(노드/엣지 복제)는 diff에서 코드 블록이 `dataSource.transaction(...)` 반환값을 변수에 담는 형태로 재구성됐지만, 노드/엣지 복사 로직 자체(batch `manager.insert(Node, nodeRows)` / `manager.insert(Edge, edgeRows)`)는 변경되지 않았다 — per-row insert 루프가 아니라 배열 일괄 insert를 그대로 유지한다. audit 기록도 트랜잭션 전체 완료 후 1회만 호출되고 노드/엣지 개수만큼 반복 호출되지 않는다.
- `triggers.service.ts`의 `create()`/`update()`에서 `chatChannel` 지정 시 `refreshed` 재조회(`findOne`) 후 `recordAudit`을 호출하는 분기는 `if (refreshed) { ...; return ...; }` 형태로 조기 반환하므로, 이후의 두 번째 `recordAudit` 호출과 중복 실행되지 않는다(이중 audit INSERT 없음).
- `AuditLogsModule`은 정적 모듈(다이나믹 `forRoot`/파라미터 없음)이라 model-config/schedules/triggers/workflows 4개 모듈에서 반복 import해도 NestJS DI 그래프상 단일 인스턴스로 캐시되며, 순환 의존도 생기지 않는다(해당 모듈이 leaf 노드).
- `notification-config.dto.ts`의 `@IsIn(NOTIFICATION_EVENT_TYPES as unknown as string[], ...)` → `@IsIn(NOTIFICATION_EVENT_TYPES, ...)` 변경은 TS 타입 캐스트 제거일 뿐 런타임 동작·성능에 영향 없음.

## 요약

이번 변경은 workflow/trigger/schedule/model_config 4개 모듈의 CRUD 경로(총 13개 지점)에 감사 로그 기록(`AuditLogsService.record()`, 단건 INSERT)을 추가하는 것이 핵심이다. 루프 내 DB 호출(N+1), 불필요한 대규모 메모리 할당, O(n²) 문자열 연산, 부적절한 자료구조 사용 등 CRITICAL/WARNING급 성능 결함은 발견되지 않았다. 트랜잭션 커밋 뒤에 감사를 기록하는 순서(model-config `setDefault`, workflows `create`/`duplicate`)가 정확히 지켜지고 있으며 이는 트랜잭션 보유 시간을 불필요하게 늘리지 않는 올바른 설계다. 유일한 성능 관점 트레이드오프는 각 쓰기 요청마다 audit INSERT 왕복이 `await`로 직렬 추가되어 레이턴시가 소폭 증가한다는 점과, 이미 알려진 `audit_log` 무제한 테이블·인덱스 공백(INFO 6)의 소진 속도가 이 PR로 인해 빨라진다는 점인데, 둘 다 현재 규모에서는 실질적 위험이 낮고 설계상 의도된 선택이라 INFO 수준으로 기록한다.

## 위험도

LOW
