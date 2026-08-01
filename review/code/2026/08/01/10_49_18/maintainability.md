STATUS=success 유지보수성 리뷰 완료 — WARNING 0건, INFO 4건 (CRITICAL 없음)
===REPORT_MARKDOWN_BELOW===
# 유지보수성(Maintainability) 코드 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅), 2차 라운드

## 검토 범위 및 방법

`git diff origin/main...HEAD`(22개 소스/문서 파일: `CHANGELOG.md`, `audit-action.const.ts`, model-config/schedules/triggers/workflows 4개 모듈의 controller·service·module·spec, `plan/in-progress/spec-sync-auth-gaps.md`)를 대상으로 검토했다. `review/code/2026/08/01/10_05_53/**`·`review/consistency/2026/08/01/09_11_58/**` 하위 파일들은 이전 리뷰/consistency-check 라운드의 산출물(자동 생성 리포트)이며 소스 코드가 아니므로 유지보수성 관점 검토 대상에서 제외했다(저장 위치 자체는 CLAUDE.md 규약과 일치).

프롬프트 번들에서 크기 제한으로 전문이 생략된 서비스 파일(model-config/schedules/triggers/workflows 의 `.service.ts`, 대응 `.spec.ts`)은 `Read`로 워크트리에서 직접 열어 전문을 확인했다. 이번 브랜치에는 1차 코드리뷰(`review/code/2026/08/01/10_05_53`) 이후 조치 커밋(`f77c1e0de` C1, `a92f53df6` C2·W5·W6·W9·W10·W2, `5e44ff8a0` 포맷 정정)이 더 쌓여 있어, 1차 라운드 `maintainability.md`가 남긴 WARNING 2건이 실제로 해소됐는지를 소스 레벨로 재검증하는 것을 우선했다.

## 발견사항

- **[INFO]** 1차 라운드 WARNING 2건 모두 해소 확인 — 회귀 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts`(`describe('TriggersService — 감사 로깅 (trigger.*)')` → `beforeEach`), `codebase/backend/src/modules/triggers/triggers.service.ts`(`create` 258-283행, `update` 333-363행)
  - 상세: (a) `triggers.service.spec.ts`의 `const idx = moduleRef as unknown as {...} as unknown as never; void idx;` 죽은 코드 4줄이 제거됐고, "createBaseProviders 는 모듈 레벨이라 공유 mock 을 못 받는다 — 여기서 override" 주석이 실제 override 가 일어나는 `auditLogs = moduleRef.get(AuditLogsService) ...` 줄 바로 위로 옮겨져 주석과 코드 위치가 정확히 일치한다. (b) `TriggersService.create()`/`update()`는 `chatChannel` 분기·폴백 분기에 각각 독립적으로 있던 `recordAudit()` 중복 호출이 `let result = saved;` → `if (refreshed) result = refreshed;` → 함수 끝 단일 `recordAudit({..., resourceId: saved.id, ...})` 패턴으로 통합되어, 액션(create/update)당 호출 지점이 하나씩만 남았다. 두 수정 모두 정확하고 부작용 없이 적용됐다.
  - 제안: 없음(확인용, 재조치 불요).

- **[INFO]** `WorkflowsService` 안에서 감사 주체(`userId`) 파라미터의 위치가 메서드마다 다르다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:191-195`(`create(workspaceId, userId, dto)` — `userId` 가 **가운데**) vs `:229-234`(`update(id, workspaceId, dto, userId)`) · `:254`(`remove(id, workspaceId, userId)`) · `:277-281`(`duplicate(id, workspaceId, userId)`) — 나머지 세 메서드는 모두 `userId` 를 **마지막**에 둔다.
  - 상세: `create`는 이번 diff 가 만든 시그니처가 아니다(`workflows.controller.ts:163`의 유일한 호출부 `this.workflowsService.create(workspaceId, user.sub, dto)`도 이번 diff 에서 무변경). 다만 이번 diff 는 같은 클래스의 `update`/`remove`/`duplicate` 세 메서드에 (model-config/schedules/triggers 3개 서비스와 동일하게) "userId 마지막" 규약으로 새 파라미터를 배선하면서도, 같은 클래스의 네 번째 자매 메서드 `create` 와는 다른 위치를 쓰는 상태를 그대로 남겼다. 이번 코드가 명시적으로 선례로 인용하는 `auth-configs.service.ts`(`create` 152-157행, `update` 201-207행)도 `userId` 를 항상 payload(`data`) 바로 뒤에 일관되게 두는데, `workflows.service.ts`의 `create` 만 그 패턴과도 어긋난다. 기능적 위험은 낮다 — `dto`(클래스 타입)와 `userId`(string)는 타입이 달라 위치를 바꿔 호출하면 컴파일 에러로 잡힌다. `create` 호출부는 컨트롤러 1곳뿐이라 정정 비용도 작다.
  - 제안: 급하지 않음. 다음에 `WorkflowsService.create()` 시그니처를 만질 기회에 `create(workspaceId, dto, userId)`로 맞춰 클래스 내 4개 메서드를 "userId 마지막"으로 통일하는 것을 검토.

- **[INFO]** `recordAudit()` named-param 래퍼가 5개 서비스(기존 auth-configs 1 + 이번 4)에 반복 — 1차 라운드 INFO(W4), 여전히 유효하나 의도적으로 유예된 상태
  - 위치: `model-config.service.ts:239-254`, `schedules.service.ts:141-154`, `triggers.service.ts:209-224`, `workflows.service.ts:174-189`
  - 상세: "resourceType 고정 + named-param 위임 + 동일 순서-스왑 rationale 주석"뼈대가 다섯 곳에 손으로 반복된다. `review/code/2026/08/01/10_05_53/RESOLUTION.md`가 "6번째 리소스 추가 시점에 팩토리화 검토"로 명시적으로 유예를 결정했고, 지금 4개 구현이 `details` 스키마를 도메인별로 다르게 가진 상태(`{kind}`/`{type}`/`{duplicatedFrom?}`/없음)에서 조기 추상화하면 오히려 인터페이스가 어색해진다는 그 판단은 여전히 타당하다.
  - 제안: 재조치 불요 — 5번째 리소스(예: `workflow.executed` 구현 시점) 추가 시 재검토 대상으로 유지.

- **[INFO]** 4개 서비스 모두 이미 export 된 `AuditAction` 타입 별칭 대신 인라인 매핑 타입을 재작성
  - 위치: `model-config.service.ts:242`, `schedules.service.ts:144`, `triggers.service.ts:212`, `workflows.service.ts:177` — 전부 `action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];`
  - 상세: `audit-action.const.ts:83`이 이미 `export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];`를 내보내고, `AuditLogsService.record()`와 이번 코드가 선례로 인용하는 `auth-configs.service.ts`도 `action: AuditAction`으로 축약해 쓴다. 1차 라운드에서 이미 지적된 INFO 이며 이번 라운드까지 4곳 모두 그대로다. 기능 차이는 없다(구조적으로 동일 타입이라 런타임·타입체크 결과가 같다).
  - 제안: 급하지 않음. 다음에 이 블록을 손댈 때 `import { AUDIT_ACTIONS, AuditAction } from '../audit-logs/audit-action.const';` + `action: AuditAction;`로 축약 — 기계적이고 위험 없는 정리.

## 요약

1차 라운드(`review/code/2026/08/01/10_05_53`)가 지적한 WARNING 2건 — triggers 감사 로깅 테스트의 죽은 코드(`idx`/`void idx`), `TriggersService.create()`/`update()`의 `recordAudit` 중복 호출 — 은 이번 라운드에서 소스 레벨로 재확인한 결과 정확하게 해소됐고 새 회귀도 없다. 신규 코드(4개 서비스의 `recordAudit` 헬퍼, named-param 방어, 트랜잭션 커밋 후 기록, TypeORM `remove()` 이전 필드 선-캡처, 컨트롤러의 `@CurrentUser('sub')` 전파)는 가독성·네이밍·함수 길이·중첩 깊이·매직 넘버 어느 관점에서도 새로운 CRITICAL/WARNING 급 문제를 만들지 않으며, 기존 `auth-configs.service.ts` 패턴을 충실히 재사용해 전반적으로 일관되고 읽기 쉽다. 이번 라운드에서 새로 포착한 사항은 `WorkflowsService.create()`가 감사 주체 파라미터(`userId`) 위치를 같은 클래스의 `update`/`remove`/`duplicate`(전부 마지막) 및 인용 선례 `auth-configs.service.ts`(항상 payload 바로 뒤)와 다르게 가운데에 두는 위치 불일치 1건뿐인데, `create` 시그니처 자체는 이번 diff 가 만든 게 아니고 인접 타입이 달라(`dto` vs `userId`) 실질적 스왑 위험도 낮아 INFO로 남긴다. 나머지 두 건(`recordAudit` 보일러플레이트 반복, `AuditAction` 타입 별칭 미사용)은 1차 라운드에서 이미 발견·저우선순위로 판단되어 의도적으로 유예된 항목이 이번 라운드까지 그대로 남아 있음을 재확인한 것으로, 재조치를 요구하지 않는다.

## 위험도

LOW
