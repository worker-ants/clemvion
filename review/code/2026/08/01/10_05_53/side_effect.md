# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 시그니처 변경(`userId` 필수 매개변수 추가)이 같은 PR 이 수정한 기존 테스트 호출부 70곳에 반영되지 않음 — `tsc` 로만 검출되고 lint/unit/build 3개 CI 게이트를 모두 통과
  - 위치(원인 — 신규 필수 매개변수, 게이트로 확인):
    `codebase/backend/src/modules/model-config/model-config.service.ts:260`(`create`),
    `codebase/backend/src/modules/schedules/schedules.service.ts:159`(`create`),
    `codebase/backend/src/modules/triggers/triggers.service.ts:229`(`create`),
    `codebase/backend/src/modules/workflows/workflows.service.ts:233`(`update`) 등 4개 서비스의
    `create`/`update`/`remove`/`setDefault` 에 `userId: string` 가 필수 매개변수로 추가됨.
    위치(영향 — diff 밖 기존 코드, `Read`+`tsc --noEmit` 로 직접 확인한 실제 소스 줄번호):
    `model-config.service.spec.ts:79` 외 28곳(파일 내 총 29곳 — 79, 97, 112, 125, 229, 239, 250, 258, 266, 275, 300, 306, 340, 351, 364, 376, 386, 397, 423, 438, 452, 486, 501, 525, 704, 719, 734, 753, 774),
    `triggers.service.spec.ts:508` 외 31곳(총 32곳 — 508, 523, 538, 567, 597, 617, 649, 672, 694, 718, 741, 1038, 1069, 1087, 1123, 1162, 1178, 1197, 1221, 1241, 1260, 1398, 1421, 1442, 1535, 1892, 1914, 1930, 1940, 1953, 1963, 1980),
    `schedules.service.spec.ts:212,222,231,239`(총 4곳),
    `workflows.service.spec.ts:317,333,350`(총 3곳, 전부 `update` 호출),
    `triggers.web-chat.spec.ts:142,174`(총 2곳). 5개 파일 합계 **70곳**.
  - 상세: 프로덕션 호출부(4개 컨트롤러)는 전부 올바르게 갱신되어 런타임 경로는 안전하다. 문제는 같은 PR 이 새로
    추가한 "감사 로깅" describe 블록 몇 개만 새 인자로 갱신하고, 같은 파일에 이미 있던 나머지 호출부는 그대로
    두었다는 점이다. JS 는 인자 수 부족을 허용해(누락분은 `undefined`) 이 70개 호출은 `userId: undefined` 로
    실행된다. 재현: `cd codebase/backend && npx tsc --noEmit -p tsconfig.json | grep TS2554` → 정확히 70건
    (`model-config.service.spec.ts` 29 / `triggers.service.spec.ts` 32 / `schedules.service.spec.ts` 4 /
    `workflows.service.spec.ts` 3 / `triggers.web-chat.spec.ts` 2). 그런데 이 70건이 CI 3단계
    (lint/unit/build) 어디에도 걸리지 않음을 직접 실행해 확인했다:
    (1) `codebase/backend/tsconfig.build.json` 이 `**/*spec.ts` 를 exclude — `nest build`(=`pnpm --filter backend build`) 는 스펙 파일을 컴파일하지 않는다.
    (2) `pnpm --filter backend test -- <해당 5개 파일>` 실행 결과 `Test Suites: 5 passed / Tests: 220 passed, 1 skipped, 0 failed` — 이 저장소의 `ts-jest` 는 (`tsconfig.json` 의 `isolatedModules: true` 영향으로 추정) 인자 개수 같은 타입 진단을 강제하지 않는다.
    (3) 해당 5개 파일에 `npx eslint` 실행 결과 0 건 — `typescript-eslint` type-aware 규칙 세트에도 "인자 개수 불일치"를 잡는 규칙은 없다.
    즉 이 저장소의 tsconfig 특성이 만든 사각지대이며, 향후 `tsc --noEmit` 이 CI 에 추가되거나 IDE 로 전체
    프로젝트를 열면 즉시 70건의 컴파일 에러로 드러난다. 더 실질적인 문제는, 각 서비스의 `recordAudit` 주석이
    반복 강조하는 "named 필드 사용 이유 — positional 인자 순서 스왑을 컴파일러가 못 잡아 감사 주체가 조용히
    뒤바뀐다"(auth-configs W-1 근거)는 방어 논리가, 정작 이 70곳에서는 `userId` 자체가 통째로 빠진 채
    조용히 통과해 무력화된다는 점이다.
  - 제안: 70개 호출부에 실제(더미) `userId` 인자를 기계적으로 추가한다. 각 파일에 이미 있는 `'u-1'`/`'u-9'` 류
    패턴을 재사용하거나 공용 상수(`const TEST_USER_ID = 'u-test'`)를 도입해 일괄 치환하면 리뷰 부담이 준다.
    부가로 `tsconfig.json` 의 `isolatedModules: true` 가 ts-jest 진단을 실제로 무력화하는 것이 의도된
    설정인지 짧게 확인해 팀에 공유할 가치가 있다 — 의도가 아니라면 이 클래스의 회귀를 계속 놓치는 원인이다.

- **[WARNING]** `triggers.service.ts`/`schedules.service.ts` 의 `create`/`update` 는 DB 커밋과 감사 기록
  사이에 실패 가능한 외부 호출을 끼워 넣어, 같은 PR 이 다른 두 서비스(`model-config`/`workflows`)에서 지키고
  또 스스로 인용한 선례(`auth-configs` "커밋 직후 기록")의 불변식을 어긴다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:258-260`
    (`saved = await this.triggerRepository.save(trigger);` 뒤 `await this.normalizeNotificationSecretRef(saved);`,
    `recordAudit` 는 그 뒤 조건부 분기인 gate 271/281 — 게이트로 확인). 정의부
    `triggers.service.ts:565-596`(`normalizeNotificationSecretRef` 가 `this.secrets.rotate(...)` 외부
    호출 후 재-save — 직접 `Read` 로 확인, diff 범위 밖). `update()` 도 동일 구조(gate 338, 346, 356/366).
    `codebase/backend/src/modules/schedules/schedules.service.ts:190`(`await this.scheduleRunnerService.registerJob(saved);`)
    이 `recordAudit`(gate 193) 보다 먼저 실행되고, `update()` 도 동일(gate 246/248 `registerJob`/`removeJob` →
    gate 251 `recordAudit`) — 전부 게이트로 확인.
  - 상세: 두 서비스 모두 "트랜잭션 커밋 뒤에 기록한다"는 원칙을 주석으로 명시하지만, 실제로는 DB 저장 이후에도
    `this.secrets.rotate(...)`(외부 secret store, triggers) 또는
    `scheduleRunnerService.registerJob`/`removeJob`(BullMQ/Redis, schedules) 호출이 감사 기록 이전에 끼어
    있다. 이 호출들은 try/catch 로 보호되지 않으므로, 여기서 예외가 발생하면(secret store 장애, Redis 연결
    장애 등) trigger/schedule 행은 이미 커밋된 채 남지만 `trigger.created`/`schedule.created` 등 감사
    항목은 전혀 기록되지 않는다 — 상태 변경(1)과 그에 따라야 할 감사 기록(8. 이벤트) 사이의 의도치 않은
    괴리다. 대조적으로 `model-config.service.ts:279-284`(`create`, 저장 직후 바로 `recordAudit`)와
    `workflows.service.ts:196-226`/`244-251`/`254-263`/`397-403`(`create`/`update`/`remove`/`duplicate` 전부
    커밋 직후 바로 `recordAudit`)는 이런 창을 열지 않는다 — 같은 PR 로 나란히 추가된 4개 미러 구현 중 2개만
    스스로 규정한 불변식을 지킨다.
  - 제안: `triggers.service.ts`/`schedules.service.ts` 의 `recordAudit` 호출도 최초 커밋 직후로 앞당기거나,
    순서를 유지해야 한다면 `normalizeNotificationSecretRef`/`registerJob`/`removeJob` 을 (다른 best-effort
    부수효과들처럼) try/catch 로 감싸 실패해도 `recordAudit` 가 반드시 실행되도록 보정한다.

- **[INFO]** 신규 감사 로깅 테스트 블록에 실행에 영향 없는 죽은 코드가 남음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2166-2170`
    (`const idx = moduleRef as unknown as { container?: unknown } as unknown as never; void idx;`) —
    게이트·실제 파일 `Read` 모두 일치 확인.
  - 상세: `moduleRef` 를 `never` 로 캐스팅해 바로 `void` 처리 — 값을 생성·소비하지 않아 부작용은 없다.
    `createBaseProviders` 로 audit mock 을 오버라이드하려던 시도가 무산되고(주석 "여기서 override" 참고),
    바로 아래 `moduleRef.get(AuditLogsService)` 재조회로 우회한 흔적으로 보이는 디버그 잔재로 추정된다.
  - 제안: 제거. `auditLogs = moduleRef.get(AuditLogsService) as unknown as { record: jest.Mock };` 줄만
    남기면 동작에 차이가 없다.

## 확인했으나 문제 없음 (참고)

- **프로덕션 호출부**: `ModelConfigService`/`SchedulesService`/`TriggersService`/`WorkflowsService` 의
  `create`/`update`/`remove`/`setDefault`/`duplicate` 를 호출하는 프로덕션 코드는 4개 컨트롤러가 유일하며
  전부 새 시그니처로 일관되게 갱신됐다(`grep` 전수 확인 — chat-channel/knowledge-base/workflow-assistant 등
  타 모듈의 동명 서비스 참조는 전부 타입 참조 또는 무관한 리포지토리 메서드였다).
- **공개 API 영향 없음**: 신규 `userId` 는 `@CurrentUser('sub')` 로 JWT 에서 파생되며 요청 바디/쿼리에 새
  필드를 요구하지 않는다 — 외부 API 클라이언트 관점의 계약(request/response 스펙)은 변경되지 않았다.
- **모듈 순환의존 없음**: `AuditLogsModule`(`codebase/backend/src/modules/audit-logs/audit-logs.module.ts`)은
  `TypeOrmModule.forFeature` 외 어떤 앱 모듈도 import 하지 않는 leaf 모듈이며, 이미 6개 모듈
  (auth-configs/auth/executions/integrations/users/workspaces)이 동일하게 import 하는 기존 패턴이다 — 4개
  모듈에 신규로 추가해도 순환 위험이 없다.
- **감사 기록 실패가 주 동작을 깨지 않음**: `AuditLogsService.record()`(미변경, 기존 코드)는 내부에서
  try/catch 로 모든 실패를 삼키고 `logger.warn` 만 남긴다 — `recordAudit` 호출 자체가 throw 해서 create/
  update/remove 응답을 깨뜨릴 위험은 없다(위 두 번째 WARNING 은 `record()` 자체가 아니라 그 *앞*에 낀 다른
  외부 호출이 원인).
- `triggers/dto/notification-config.dto.ts` 의 `@IsIn(NOTIFICATION_EVENT_TYPES as unknown as string[] → NOTIFICATION_EVENT_TYPES)` 캐스트 제거는 순수 타이핑 정리로, 런타임 동작(멤버십 검사)에 차이가 없음을 확인했다(제거 후에도 신규 `tsc` 에러 없음).
- `review/consistency/2026/08/01/09_11_58/**`(파일 21~28)는 사전 `/consistency-check` 실행 산출물로,
  프로젝트 컨벤션(`review/consistency/<날짜>/<시각>/`)에 부합하는 기대된 신규 파일이며 실행 코드가 아니라
  이번 부작용 관점 검토 대상은 아니다.

## 요약

이번 변경은 `workflow`/`trigger`/`schedule`/`model_config` 4개 도메인에 CRUD 감사 로깅을 추가하며, 프로덕션
경로(컨트롤러→서비스 시그니처 확장, `AuditLogsModule` 배선, 트랜잭션 커밋 이후 기록)는 대체로 신중하게
설계되어 있다 — 실패를 삼키는 `AuditLogsService.record()`, remove 전 필드 캡처, 트랜잭션 순서 보장 테스트
등 기존 정책을 잘 따른다. 다만 두 가지 실측된 부작용이 있다: (1) 시그니처 변경(`userId` 필수화)이 같은 PR 이
수정한 스펙 파일 안의 기존 호출부 70곳에 전파되지 않았고, 이 저장소의 tsconfig/ts-jest 설정 특성상
lint·unit·build 어느 CI 게이트도 이를 잡지 못해 조용히 누적된 타입 안전성 부채가 됐다(런타임 프로덕션 영향은
없음, `tsc --noEmit` 로만 드러남). (2) `triggers`/`schedules` 서비스는 `model-config`/`workflows` 와 달리
DB 커밋과 감사 기록 사이에 실패 가능한 외부 호출(secret store, BullMQ)을 끼워 넣어, 그 호출이 실패하면
리소스는 생성/수정되지만 감사 기록은 남지 않는 완전성 갭이 생긴다 — 같은 PR 이 스스로 규정한 "커밋 직후
기록" 불변식을 4개 미러 구현 중 2개에서만 지킨 셈이다. 두 항목 모두 현재 애플리케이션을 깨뜨리거나 보안
문제를 유발하지는 않지만, 감사 로깅 기능의 핵심 목적(신뢰 가능한 추적성)과 이 PR 이 스스로 세운 방어
논리·불변식을 부분적으로 무력화하므로 병합 전 정정을 권장한다.

## 위험도

MEDIUM
