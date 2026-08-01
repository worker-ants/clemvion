# 유지보수성(Maintainability) 코드 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅)

## 검토 범위 및 방법

프롬프트가 지정한 19개 파일(`audit-action.const.ts`, model-config/schedules/triggers/workflows 4개 모듈의
controller·service·module·spec) 전부를 `git diff origin/main...HEAD -- codebase/` 로 확인했다. 프롬프트
크기 제한으로 전문이 생략된 4개 파일(`triggers.service.ts`/`.spec.ts`, `workflows.service.ts`/`.spec.ts`)은
`Read`/`grep`으로 워크트리에서 직접 열어 diff 와 전체 컨텍스트를 대조했다.

이 브랜치는 이미 3라운드 코드 리뷰(`review/code/2026/08/01/{10_05_53,10_49_18,11_35_19}`)와
`review/code/2026/08/01/10_05_53/RESOLUTION.md` 에 걸친 조치 이력을 갖고 있다. 특히 직전
유지보수성 라운드(`10_49_18`, WARNING 0 · INFO 4 · risk LOW)가 이미 이번 기능을 정밀 검토했고,
그 이후 커밋(`0b862fe17` 2차 리뷰 조치, `d7d4f67fa` 3차 조치+rebase)은 import 누락·문서 오류·
review 산출물 정합성 수정으로 구조적 변경이 아니었다. 이번 라운드는 그 결과를 소스 레벨로
독립 재검증하는 데 집중했고, 4건 모두 여전히 유효하며 새로운 CRITICAL/WARNING 은 없었다.

## 발견사항

- **[INFO]** `WorkflowsService.create()` 의 `userId` 파라미터 위치가 같은 클래스의 나머지 3개 메서드와 다르다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:191-194` (`create(workspaceId, userId, dto)` — `userId` 가 **가운데**) vs `:229-233`(`update(id, workspaceId, dto, userId)`) · `:254`(`remove(id, workspaceId, userId)`) · `:277-280`(`duplicate(id, workspaceId, userId)`) — 나머지 세 메서드는 모두 `userId` 를 **마지막**에 둔다. 자매 서비스인 `TriggersService.create(workspaceId, dto, userId)`·`SchedulesService.create(workspaceId, dto, userId)`·`ModelConfigService.create(workspaceId, kind, dto, userId)` 도 전부 마지막이다.
  - 상세: `create` 시그니처 자체는 이번 diff 가 새로 만든 게 아니다(`workflows.controller.ts:163` 의 유일한 호출부 `this.workflowsService.create(workspaceId, user.sub, dto)` 도 무변경) — `createdBy` 컬럼 때문에 감사 로깅 이전부터 이미 이 위치였다. 다만 이번 PR 이 같은 클래스의 `update`/`remove`/`duplicate` 세 메서드에 "userId 마지막" 규약으로 신규 파라미터를 배선하면서, 네 번째 자매 메서드와 다른 위치를 그대로 남겼다. `dto`(클래스 타입)와 `userId`(string)는 타입이 달라 위치를 바꿔 호출해도 컴파일 에러로 잡히므로 기능적 위험은 낮다.
  - 제안: 급하지 않음. `WorkflowsService.create()` 시그니처를 다음에 만질 기회에 `create(workspaceId, dto, userId)` 로 맞춰 클래스 내 4개 메서드를 통일하는 것을 검토.

- **[INFO]** `@CurrentUser` 사용자 추출 관용구가 `schedules.controller.ts`/`workflows.controller.ts` 파일 내부에서 두 스타일로 혼재
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:153,203,224`(신규 `@CurrentUser('sub') userId: string`) vs `:179`(기존 `runNow`, `@CurrentUser() user: JwtPayload` + `user.sub`). `codebase/backend/src/modules/workflows/workflows.controller.ts:185,206`(신규 `update`/`remove`, `@CurrentUser('sub') userId: string`) vs `:94,160,234,270,378,459,486,532`(기존 `findAll`/`create`/`duplicate`/`execute`/`executeNode`/`saveCanvas`/`restoreVersion`/`importWorkflow`, `@CurrentUser() user: JwtPayload` + `.sub`).
  - 상세: 두 스타일 모두 코드베이스 전역에는 이미 존재하고(예: `auth-configs.controller.ts` 는 `'sub'` 축약을, `sessions`/`notifications` 컨트롤러는 `user: JwtPayload` 전체 페이로드를 일관되게 씀) 이번 PR 이 전역 규약을 새로 깬 것은 아니다. 다만 **같은 파일 안**에서 두 스타일이 나란히 있는 상태를 만든 것은 이번 PR 이 처음이라, 해당 파일만 열어보는 사람은 어느 쪽이 파일의 관용구인지 헷갈릴 수 있다.
  - 제안: 차단 사유 아님. 여유가 있을 때 두 파일 내에서 하나로 통일(다수결인 `user: JwtPayload` + `.sub` 채택 또는 반대) 하면 파일 내 일관성이 개선된다.

- **[INFO]** `recordAudit()` named-param 래퍼가 5개 서비스(기존 `auth-configs` 1 + 이번 4)에 거의 동일한 뼈대로 반복
  - 위치: `model-config/model-config.service.ts:239-254`, `schedules/schedules.service.ts:141-154`, `triggers/triggers.service.ts:209-224`, `workflows/workflows.service.ts:174-189` (+ 기존 `auth-configs/auth-configs.service.ts:73-95`)
  - 상세: "resourceType 고정 + named-param 위임(positional 인자 순서 스왑을 컴파일러가 못 잡는다는 동일 rationale)" 뼈대가 다섯 곳에 손으로 반복된다. `details` 스키마는 도메인별로 다르다(`model_config`→`{kind}`, `trigger`→`{type}`, `workflow`→임의 `details?`, `schedule`/`auth_config`→없음/`ipAddress`). `review/code/2026/08/01/10_05_53/RESOLUTION.md`(W4)가 "6번째 리소스 추가 시점에 팩토리화 검토"로 명시적으로 유예를 결정했고, `details` 형태가 갈리는 현재 상태에서 조기 추상화하면 오히려 제네릭 인터페이스가 어색해진다는 판단은 여전히 타당하다.
  - 제안: 재조치 불요. 5번째 신규 리소스(예: `workflow.executed` 구현 시점) 추가 시 `createResourceAuditRecorder(auditLogsService, resourceType)` 같은 작은 팩토리로 재검토.

- **[INFO]** 4개 신규 서비스가 이미 export 된 `AuditAction` 타입 별칭 대신 인라인 매핑 타입을 재작성
  - 위치: `model-config/model-config.service.ts:242`, `schedules/schedules.service.ts:144`, `triggers/triggers.service.ts:212`, `workflows/workflows.service.ts:177` — 4곳 모두 `action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];`
  - 상세: `audit-logs/audit-action.const.ts` 가 이미 `export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];` 를 export 하고, `AuditLogsService.record()`(호출 대상) 와 이번 코드가 스스로 "동일 근거"로 인용하는 `auth-configs/auth-configs.service.ts:79`(`action: AuditAction;`) 도 이를 재사용한다. 구조적으로 동일 타입이라 런타임·타입체크 결과 차이는 없다.
  - 제안: 급하지 않음. 다음에 이 블록을 손댈 때 `import { AUDIT_ACTIONS, AuditAction } from '../audit-logs/audit-action.const';` + `action: AuditAction;` 로 축약 — 기계적이고 위험 없는 정리.

## 요약

신규 코드(4개 서비스의 `recordAudit` 헬퍼, named-param 방어, 트랜잭션/BullMQ/secret-store 호출보다 앞선 "커밋 직후" 기록 불변식과 그 순서를 고정하는 `order: string[]` 회귀 테스트, TypeORM `remove()` 이전 `kind`/`type` 선-캡처, 컨트롤러의 `@CurrentUser('sub')` 전파)는 가독성·네이밍·함수 길이·중첩 깊이·매직 넘버·중복 어느 관점에서도 새 CRITICAL/WARNING 급 문제를 만들지 않는다. 기존 `auth-configs.service.ts` 패턴(resourceType 고정, named-param, W-1 순서-스왑 rationale)을 4개 모듈에 충실히 재사용해 전반적으로 일관되고 읽기 쉬우며, 특히 테스트가 "코드로만 맞춰지고 리팩터링이 되돌려도 GREEN"인 vacuous 형태를 피하려고 순서·횟수를 명시적으로 관측하는 방식(예: `트리거 chatChannel 분기가 있어도 기록은 한 번` W5 회귀 테스트)은 모범적이다. 이번 라운드에서 확인한 4건은 전부 직전 라운드(`10_49_18`)와 `RESOLUTION.md`(W4/W8 계열)가 이미 저우선순위로 판단·유예한 항목의 재확인이며, 그 사이 커밋(import 누락 수정, 리뷰 산출물 정합성)이 이 판단을 바꿀 구조적 변경을 만들지 않았다. 새로운 항목은 없다.

## 위험도

LOW
