# 성능(Performance) 코드 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅, 2차/조치 라운드)

## 검토 범위·방법

이 브랜치는 5개 커밋(`646a0bad4` feat → `24d0db60a` test → `65087584b` style → `f77c1e0de` fix C1 →
`a92f53df6` fix C2/W5/W6/W9/W10/W2)으로 구성된다. 동일 기능은 이전 리뷰 세션
(`review/code/2026/08/01/10_05_53/performance.md`)에서 이미 전담 성능 리뷰(위험도 LOW, INFO 3건, CRITICAL/WARNING
0건)를 받았고, 이번 diff 는 그 세션의 Critical/Warning 조치(C1 userId 배선·C2 회귀 테스트·W5 중복 호출 통합·W6
기록 시점 이동 등)와 이전 리뷰 산출물 자체를 커밋에 포함한 상태다. 이번 라운드에서는 (1) 조치 커밋
(`f77c1e0de`, `a92f53df6`)이 실제 런타임 코드에 새 성능 이슈를 만들지 않았는지 재검증하고, (2) 이전 라운드
INFO 항목이 여전히 유효한지 확인했다.

- `git diff origin/main...HEAD --stat` 로 45개 변경 파일 전수 확인, 실질 소스(서비스/컨트롤러/모듈) 8개 파일을
  `Read` 로 직접 열람.
- `git diff 65087584b a92f53df6 -- <service>.ts` 로 이번 라운드가 추가한 조치만 별도 대조(`triggers`/
  `schedules`/`workflows` 서비스).
- `grep -n "recordAudit("` 로 4개 서비스의 모든 호출부를 전수 나열해 반복문(`for`/`.map`/`.forEach`/`while`)
  내부 호출이 없는지 확인.
- 감사 기록 sink(`audit-logs.service.ts` `record()`)와 `audit_log` 인덱스(`migrations/V002__indexes.sql`)를
  직접 확인해 이전 라운드의 INFO 근거가 이번 diff 로 변하지 않았음을 재확인.

## 발견사항

CRITICAL·WARNING 급 성능 결함은 발견되지 않았다. 아래 3건은 모두 INFO 수준이다.

- **[INFO]** `recordAudit` 이 여전히 각 CRUD 경로마다 `await` 로 직렬 대기하는 DB round-trip 1회를 추가한다 (이전 라운드 INFO 재확인, 회귀 없음)
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:284-290`(create)·`:337-343`(update)·`:385-391`(setDefault)·`:402-408`(remove); `codebase/backend/src/modules/schedules/schedules.service.ts:188-193`(create)·`:246-251`(update)·`:273-278`(remove); `codebase/backend/src/modules/triggers/triggers.service.ts:262-268`(create)·`:344-350`(update)·`:871-877`(remove); `codebase/backend/src/modules/workflows/workflows.service.ts:220-225`(create)·`:245-250`(update)·`:257-262`(remove)·`:397-403`(duplicate)
  - 상세: `grep -n "recordAudit("` 로 4개 서비스의 모든 호출부(총 14곳)를 나열한 결과 어디도 `for`/`.map`/`.forEach`/`while` 안에 있지 않다 — N+1 패턴은 아니다. `AuditLogsService.record()`(`codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-97`)는 단건 `repository.save()` 뿐이고 내부에서 추가 조회를 하지 않으며 실패를 `try/catch` 로 삼킨다. 이번 라운드의 W6 조치(`triggers`/`schedules`)는 이 `await recordAudit(...)` 호출을 "커밋 직후"로 **재배치**한 것이지 호출 횟수를 늘리거나 줄이지 않았다 — 요청당 DB round-trip 총량은 조치 전후 동일하며, 실패 가능한 외부 호출(secret store rotate·BullMQ register/removeJob) 이전으로 옮겨 그 상대적 순서만 바뀌었다. 트랜잭션을 쓰는 경로(model-config `setDefault`, workflows `create`/`duplicate`)는 여전히 커밋 **뒤**에 기록해 트랜잭션 보유 시간을 늘리지 않는다.
  - 제안: 조치 불요. 현재 규모(단건 row, 요청당 정확히 1회)에서는 문제가 되지 않는다. 프로덕션에서 레이턴시가 실측으로 문제가 되면 비동기 큐(BullMQ) 위임을 검토할 수 있으나, 이는 "커밋 후 정확한 순서 보장" 이라는 현재 설계 목표와 트레이드오프이므로 지금은 권고하지 않는다(이전 라운드 결론과 동일).

- **[INFO]** W5 조치("중복 호출 통합")는 요청당 DB INSERT 횟수를 줄인 것이 아니라 소스 코드 중복(호출 지점 2곳)을 1곳으로 합친 것 — 표현 정정 참고
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `create()`(226-284행)·`update()`(286-364행); 대조용 이전 상태는 `git diff 65087584b a92f53df6 -- .../triggers.service.ts` 로 확인
  - 상세: `review/code/2026/08/01/10_05_53/RESOLUTION.md` 의 W5 항목은 "triggers create/update 가 chatChannel 분기별로 recordAudit 을 2회씩 호출"이라 적었다. 조치 전 코드를 직접 대조한 결과, 실제 구조는 `if (chatChannel) { ...; const refreshed = await findOne(...); if (refreshed) { await recordAudit(...); return sanitize(refreshed); } } await recordAudit(...); return sanitize(saved);` 형태의 상호배타적 분기다 — `if (refreshed)` 블록이 실행되면 그 자리에서 즉시 `return` 하므로, 정상 흐름에서 한 요청당 `recordAudit()` 은 **항상 1회만** 실행됐다(2개의 소스 호출 지점 중 정확히 하나만 도달). 즉 조치 전에도 요청당 audit INSERT 는 1건이었고, 이번 조치(`result` 변수로 통합, 262-268행 단일 호출)로도 여전히 1건이다 — 성능(DB 쓰기 횟수) 관점에서는 조치 전후 차이가 없다. 실제 리스크는 `details` 필드를 늘릴 때 두 호출 지점 중 하나만 고치는 소스 drift(유지보수성 문제)였다.
  - 제안: 코드 조치 자체는 올바르고 유지보수성 개선으로 유효하다. 다만 `RESOLUTION.md`/커밋 메시지가 이를 "2회 호출→1회" 로 서술해 향후 읽는 사람이 "런타임 중복 INSERT 버그를 고쳤다"로 오독할 여지가 있다 — 재현 가능한 표현으로("소스 중복 1곳→1곳 통합, 런타임 호출 횟수는 조치 전후 동일") 정정을 권장한다. 성능 관점의 재조치는 불필요.

- **[INFO]** `audit_log` 무제한 테이블 — 신규 쓰기 소스 4곳(13개 액션) 추가로 소진 속도가 빨라지는 기존 갭 (이전 라운드 INFO 재확인, 이번 diff 로 변경 없음)
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:32-44`(신규 헤더 주석이 "무제한 테이블, pruner 없음" 을 스스로 인지), `codebase/backend/migrations/V002__indexes.sql:33`(`idx_audit_log_workspace_created` — `(workspace_id, created_at DESC)` 복합 인덱스만 존재, `action`/`resource_type`/`user_id` 필터 전용 인덱스는 없음)
  - 상세: `AuditLogsService.findAll()`(`audit-logs.service.ts:39-54`)는 `action`/`resourceType`/`userId` 로 필터링할 수 있으나 이 컬럼들에 별도 인덱스가 없어 워크스페이스 규모가 커지면 `(workspace_id, created_at DESC)` 인덱스 스캔 후 필터링에 의존하게 된다. 이번 diff 는 이 구조를 바꾸지 않으며, 추가되는 13개 액션도 전부 저빈도 CRUD 라 즉각적 위험은 낮다 — `workflow.executed`(고빈도)는 바로 이 이유로 의도적으로 범위에서 제외됐다(같은 주석, `plan/in-progress/spec-sync-auth-gaps.md` 후속 항목에도 등재). 기존 consistency 리뷰(`review/consistency/2026/08/01/09_11_58/plan_coherence.md` INFO 2)가 이미 추적 중인 갭이다.
  - 제안: 이번 PR 에서 조치 불요. 후속으로 `GET /audit-logs` 필터 조회 성능이 실측 저하되면 `action`/`resource_type` 보조 인덱스 또는 보존 정책(pruner) 도입을 검토.

## 검토했으나 문제 없음으로 판단한 항목

- **C1 조치(`f77c1e0de`, spec 호출부 70곳에 `userId` 인자 추가)**: 전부 `*.spec.ts` 테스트 파일과 타입 시그니처 변경이며 런타임 프로덕션 코드·I/O 패턴에 영향 없음.
- **C2 조치(회귀 테스트 8곳 추가)**: 테스트 전용 변경. `workflows.service.spec.ts` 의 트랜잭션 순서 단언(`order: string[]`)도 실제 서비스 코드가 아니라 mock 함수 안에서 배열에 push 하는 것뿐이라 프로덕션 성능과 무관.
- **W6 조치(`triggers`/`schedules` 의 `recordAudit` 를 커밋 직후로 이동)**: `git diff 65087584b a92f53df6` 로 대조한 결과 순수 statement 재배치이며 `await` 횟수·쿼리 수 변화 없음.
- **`workflows.service.ts` `duplicate()` 의 대규모 재인덴트**: `originalNodes.map(...)`/`originalEdges.flatMap(...)` 로 메모리상 배열을 구성한 뒤 `manager.insert(Node, nodeRows)`/`manager.insert(Edge, edgeRows)` 로 **일괄 batch insert** 하는 기존 패턴이 그대로 유지된다(행 단위 루프 insert 아님). 신규 `recordAudit` 호출도 트랜잭션 완료 후 1회만 실행되며 노드/엣지 개수와 무관하다.
- **`AuditLogsModule` 4개 모듈 반복 import**: 정적 모듈(다이나믹 `forRoot` 없음)이라 NestJS DI 그래프상 단일 인스턴스로 캐시되고, `AuditLogsModule` 은 leaf 노드라 순환 의존도 생기지 않는다.
- **`@CurrentUser('sub') userId` 파라미터 추가(4개 컨트롤러)**: Guard 가 이미 request 에 부착한 JWT payload 에서 동기적으로 필드를 읽을 뿐 추가 DB/네트워크 호출이 없다.
- **`notification-config.dto.ts` 의 `@IsIn(NOTIFICATION_EVENT_TYPES as unknown as string[], ...)` → `@IsIn(NOTIFICATION_EVENT_TYPES, ...)`**: 타입 단언 제거일 뿐 런타임 검증 로직·성능에 영향 없음(스코프 이탈 여부는 scope 리뷰어 소관).

## 요약

이번 라운드는 이전에 전담 성능 리뷰(위험도 LOW)를 받은 감사 로깅 기능(model-config/schedules/triggers/workflows
4개 모듈, `recordAudit` 총 14개 호출부)에 대한 Critical/Warning 조치 커밋(C1 userId 배선·C2 회귀 테스트·W5 중복
호출부 통합·W6 기록 시점 이동)이다. `grep` 전수 확인 결과 모든 `recordAudit` 호출은 반복문 밖에 있어 N+1
패턴이 없고, W6 의 재배치는 순수 statement 순서 변경(쿼리 수 불변)이며, `duplicate()` 의 노드/엣지 batch
insert 패턴도 그대로 유지된다 — 이번 조치가 새로 만든 성능 결함은 없다. 다만 RESOLUTION.md 의 W5 서술("2회씩
호출"→"1회 통합")이 실제로는 요청당 항상 1회만 실행되던 상호배타적 분기를 소스 레벨에서 통합한 것이라, "런타임
중복 INSERT 버그 수정"으로 오독될 소지가 있어 표현 정정을 INFO 로 남긴다. 그 외 audit INSERT 의 순차 대기
비용과 `audit_log` 무제한 테이블 갭은 이전 라운드에서 이미 INFO 로 추적 중이며 이번 diff 로 악화되지 않았다.

## 위험도

LOW
