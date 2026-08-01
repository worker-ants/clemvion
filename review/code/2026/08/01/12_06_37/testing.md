# 테스트(Testing) 리뷰 — 감사 로깅(audit-logging) 커버리지 확장

## 발견사항

### [CRITICAL] triggers.service.ts `update()` — W6 순서 원칙이 schedule 동기화 경로에서 깨짐 (미검증)

- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:338-350` (`update()`)
- 상세:
  `update()`는 `triggerRepository.save(trigger)`(커밋) 직후 `recordAudit()`를 호출해, 그
  아래(secret 마이그레이션·chatChannel setup)의 "실패할 수 있는 외부 호출" 때문에 감사가
  누락되지 않도록 한다고 스스로 주석에 명시한다(리뷰 W6 원칙). 그런데 실제 실행 순서는:

  ```
  333  const saved = await this.triggerRepository.save(trigger);   // 커밋
  338  if (trigger.type === 'schedule' && rest.isActive !== undefined) {
  339    await this.syncScheduleActivation(saved, rest.isActive);  // ← BullMQ 외부호출, 감사 이전!
  340  }
  341  // **커밋 직후** 기록한다 — 아래 secret 마이그레이션·chatChannel setup 은 실패할 수
  342  // 있는 외부 호출이라 ...(W6)
  344  await this.recordAudit({ ... TRIGGER_UPDATED ... });
  351  await this.normalizeNotificationSecretRef(saved);           // 감사 이후 (올바름)
  353  if (chatChannel) { await this.setupChatChannel(saved, chatChannel); }  // 감사 이후 (올바름)
  ```

  `syncScheduleActivation`(triggers.service.ts:827-844)은 내부에서
  `scheduleRunner.registerJob`/`removeJob`(BullMQ)을 호출하는, 주석이 경계하는 것과 동일한
  "실패할 수 있는 외부 호출"이다. 이 호출이 커밋보다 **먼저**, 감사 기록보다도 **먼저**
  실행되므로, schedule 타입 트리거의 `isActive` PATCH 도중 BullMQ 호출이 실패하면
  트리거/schedule 변경은 이미 DB에 커밋됐는데 감사 로그는 영구히 남지 않는다 — 바로 이
  주석이 막으려던 시나리오가 이 경로에서는 그대로 재현된다.

  `triggers.service.spec.ts`의 "Schedule 역방향 동기화" describe 블록(1997행대,
  `registerJob`/`removeJob` 호출 여부만 단언)과 신규 "감사 로깅 (trigger.*)" describe
  블록(triggers.service.spec.ts:2278-2299, `type: 'webhook'` 트리거만 사용)이 서로
  교차하지 않아, 이 조합(schedule 타입 + isActive 변경 + audit)은 어떤 테스트에도 걸리지
  않는다. `runner.registerJob`/`removeJob` mock 도 전체 스펙에서 단 한 번도
  `mockRejectedValue`로 실패하도록 설정되지 않는다(grep 결과 전부 성공 mock).
- 제안: `recordAudit()` 호출을 `syncScheduleActivation()` 호출보다 앞으로 옮기거나(다른
  두 외부호출과 동일하게), 최소한 "schedule 타입 트리거 + isActive 변경 시 registerJob이
  실패해도 감사는 남는다/커밋된 변경과 감사가 같이 일어난다" 를 고정하는 순서(order-array)
  테스트를 추가해 이 경로를 명시적으로 커버할 것.

### [WARNING] "W6 순서 고정" 회귀 가드가 `create()`에만 있고 `update()`에는 없음 (schedules·triggers 공통 패턴)

- 위치:
  - `codebase/backend/src/modules/schedules/schedules.service.spec.ts:289` (`create` 순서
    테스트만 존재). `update()`도 동일한 W6 주석(schedules.service.ts:245 "커밋 직후 기록 —
    아래 BullMQ 재등록이 실패해도 감사는 남는다")을 갖지만, 대응하는 순서 테스트가
    `schedules.service.spec.ts:319`(`update` 감사 테스트)에는 없다 — 단순 호출 인자만
    단언한다.
  - `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2314` (`create`만).
    `update`(2299행)도 W6 주석이 있으나 순서 미검증 — 위 CRITICAL 항목이 바로 이 갭이
    실제 버그로 이어진 사례다.
- 상세: 두 서비스 모두 "커밋 직후 기록"이라는 동일한 설계 불변식을 `create()`/`update()`
  양쪽에 적용했다고 주석으로 명시하지만, 뮤테이션에 강한 순서(`order: string[]`) 테스트는
  `create()`에만 붙어 있다. `update()`가 이 불변식을 지키는지는 순전히 코드 리뷰에
  의존하며, 실제로 triggers.service.ts의 `update()`에서는 이미 깨져 있었다(위 CRITICAL).
  같은 패턴이 model-config에도 나타난다: `model-config.service.spec.ts:970`의
  "setDefault 는 트랜잭션 **커밋 뒤**에 남긴다" 순서 테스트는 `setDefault()`에만 있고,
  동일하게 `saveWithDefaultSwap` 트랜잭션을 타는 `create()`(`isDefault: true`)·
  `update()`(`isDefault: true`) 경로는 순서 검증이 없다. 더 나아가 `create()`의
  `isDefault: true` 분기는 `model-config.service.spec.ts` 전체에서 단 한 번도 실행되지
  않는다(`isDefault` grep 결과 `create()` 호출부에 `isDefault: true` 케이스가 없음) —
  트랜잭션 경로 자체가 미방문이므로 순서 여부를 떠나 존재 커버리지도 빠져 있다.
- 제안: `create()`에 적용한 순서-테스트 패턴을 `update()`(schedules, triggers)와
  `create()`/`update()`의 `isDefault: true` 경로(model-config)에도 동일하게 적용.

### [WARNING] Controller → Service `userId` 배선 검증이 4개 모듈에서 비일관적 — create/setDefault·duplicate 경로 다수 미검증, e2e 전무

- 위치:
  - `codebase/backend/src/modules/model-config/model-config.controller.spec.ts` — `update`
    (169-186행대)·`remove`(189-207행대)는 "userId 까지 단언한다 — 감사 로그의 **주체**"라는
    명시적 코멘트와 함께 `mockModelConfigService.{update,remove}`가 `userId`를 받는지
    검증한다. 그러나 같은 diff에서 `@CurrentUser('sub') userId`가 새로 추가된
    `create`/`setDefault` 컨트롤러 메서드(model-config.controller.ts:115-121, 148-157)는
    이 파일 어디에도 `describe('create', ...)` / `describe('setDefault', ...)` 블록이
    없어 배선이 전혀 검증되지 않는다(`mockModelConfigService.create`/`setDefault` mock은
    타입 충족용으로만 존재).
  - `codebase/backend/src/modules/triggers/triggers.controller.spec.ts`,
    `codebase/backend/src/modules/workflows/workflows.controller.spec.ts` — 둘 다 이번
    diff로 `create`/`update`/`remove`에 `@CurrentUser('sub') userId`가 추가됐지만, 두
    파일 모두 `rotateBotToken`/`execute`/`executeNode`/`saveCanvas`/`restoreVersion`/
    `findAll`/`graphWarnings`만 다루고 `create`/`update`/`remove`(workflows는 `duplicate`
    포함) 컨트롤러 위임 테스트는 아예 없다.
  - schedules 모듈은 `schedules.controller.spec.ts` 파일 자체가 존재하지 않는다.
  - e2e 레벨에서도 이 배선을 검증하는 테스트가 없다.
    `codebase/backend/test/audit-logs.e2e-spec.ts`는 `audit_log` 행을 SQL로 직접
    INSERT해 시딩한 뒤 `GET /api/audit-logs`의 접근 제어(RBAC)만 검증하며, 실제 HTTP
    요청으로 workflow/trigger/schedule/model-config를 생성·수정·삭제해 `audit_log`에
    올바른 `userId`(행위자)가 기록되는지 확인하는 e2e는 4개 모듈 어디에도 없다
    (`workflow-crud.e2e-spec.ts` 등 기존 CRUD e2e는 감사 로그를 전혀 참조하지 않음).
- 상세: 서비스 레이어의 `recordAudit()`는 named 필드로 설계해 "positional 이면 동일 타입
  (string) 인자 순서 스왑을 컴파일러가 못 잡는다"는 위험을 스스로 명시적으로 경계한다.
  그런데 정작 컨트롤러 → 서비스 호출부(`this.triggersService.create(workspaceId, dto,
  userId)` 등)는 여전히 위치 인자이고, `workspaceId`/`userId`처럼 같은 타입(string) 인자가
  실수로 뒤바뀌어도 TypeScript는 잡지 못한다. 이걸 잡을 수 있는 컨트롤러 유닛테스트도,
  실제 DB row로 확인하는 e2e도 create/setDefault/duplicate 등 다수 경로에서 비어 있다.
- 제안: 최소한 model-config의 `update`/`remove` 테스트와 동일한 패턴(서비스 mock에
  전달된 `userId` 단언)을 `create`/`setDefault`(model-config), `create`/`update`/`remove`
  (triggers, workflows), schedules 전체(신규 controller spec 파일)에 확장. 4개 모듈 중
  최소 1개 액션에 대해서만이라도 실제 HTTP 요청 → `audit_log` row의 `user_id` 일치를
  검증하는 e2e를 추가해 배선 전체를 한 번은 끝까지 통과시킬 것.

### [WARNING] `importWorkflow()`가 `workflow.created`를 남기지 않음 — 의도/누락을 확정하는 테스트 부재

- 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:451`
  (`importWorkflow()`, `manager.create(Workflow, ...)` + `manager.save`로 새 Workflow
  row를 생성하지만 `recordAudit()` 호출이 없음)
- 상세: 같은 diff에서 `duplicate()`(workflows.service.ts:133-314 부근)는 "복제본도 별개
  리소스이므로 감사가 필요하다"는 판단 아래 `WORKFLOW_CREATED` + `details.duplicatedFrom`
  기록을 명시적으로 추가하고, `workflows.service.spec.ts`에 전용 테스트
  ("duplicate 는 details.duplicatedFrom 으로 원본을 남긴다")까지 붙였다. `importWorkflow`
  역시 새 워크플로우 row를 생성하는 동일 성격의 대안 경로인데, 이번 diff는 여기에 감사
  기록을 추가하지 않았고, 그 부재가 스코프상 의도(가져오기는 감사 대상 아님)인지 단순
  누락인지 어느 테스트로도 고정돼 있지 않다. `workflows.service.spec.ts`에
  `importWorkflow` 관련 새 테스트가 diff에 없음을 확인함(현재 상태로는 향후 누군가 실수로
  추가/누락을 바꿔도 아무 테스트도 깨지지 않는다).
- 제안: 의도된 스코프 제외라면 "importWorkflow는 감사를 남기지 않는다"를 명시하는 회귀
  테스트를 1개 추가해 의도를 문서화. 누락이라면 `duplicate()`와 동일하게 `WORKFLOW_CREATED`
  기록 + 테스트를 추가.

## 요약

이번 PR은 4개 모듈(workflow/trigger/schedule/model_config)의 CRUD 13개 액션에 대한 감사
로깅을 추가하면서, 각 서비스마다 "커밋 직후 기록"(W6) · "삭제 전 필드 캡처" ·
"트랜잭션 롤백 시 미기록" 같은 핵심 불변식을 순서-배열(`order: string[]`) 기법으로
뮤테이션에 강하게 테스트하는 등 전반적인 테스트 품질은 높다. 다만 그 순서-테스트 패턴이
`create()`(또는 model-config의 `setDefault()`) 딱 한 곳에만 적용되고 자매 메서드인
`update()`/`create()`의 트랜잭션 분기에는 적용되지 않았는데, 실제로 triggers.service.ts의
`update()`에서 이 갭이 가리키는 정확한 지점에 진짜 순서 결함(schedule 동기화의 BullMQ
호출이 감사 기록보다 먼저 실행됨)이 존재했다 — 코드 리뷰로 발견됐고 어떤 테스트도 잡지
못했다. 여기에 더해 컨트롤러 → 서비스 `userId` 배선 검증이 모듈별로 들쭉날쭉하고(모델
컨피그는 update/remove만, 트리거·워크플로우는 전무, 스케줄은 컨트롤러 spec 자체가 없음)
e2e로 실제 요청-DB row 왕복을 확인하는 테스트가 전무해, "누가 했는가"라는 감사 로그의
핵심 목적이 컨트롤러 계층에서 실수로 깨져도 아무 것도 잡지 못하는 구조다.

## 위험도

HIGH
