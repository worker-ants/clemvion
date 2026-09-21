# 정식 규약 준수 검토 — `spec/2-navigation` (--impl-done)

## 검토 범위 및 방법

- target: `spec/2-navigation` (해당 영역의 spec 델타는 이번 diff 에서 0개 파일 — 코드 전용 PR 이므로 정상)
- 구현 diff: `codebase/backend/src/modules/integrations/integrations.service.ts` (+ `integrations.service.spec.ts`, 신규 `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts`) — `spec/2-navigation/4-integration.md` 의 `code: codebase/backend/src/modules/integrations/**` 소유 범위
- 대조한 정식 규약: `spec/conventions/audit-actions.md`, `spec/conventions/error-codes.md`, `spec/conventions/swagger.md`, `spec/conventions/spec-impl-evidence.md` (모두 워크트리에서 원문 직접 확인 — 번들이 예산으로 절단한 부분은 `Read`/`git -C` 로 보완)
- diff 는 `git diff origin/main...HEAD -- ':(top)codebase/backend/src/modules/integrations/integrations.service.ts'` 로 워크트리에서 직접 확인 (HEAD 기준, 실제 구현 반영됨)

## 발견사항

- **[INFO]** 신규 e2e 증거 파일이 `4-integration.md` frontmatter `code:` 에 미등재 (기존 패턴의 연장, 신규 위반 아님)
  - target 위치: `spec/2-navigation/4-integration.md` frontmatter `code:` (전체 문서에 이번 PR 로 인한 diff 없음)
  - 관련 규약: `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 필드 정의, §R-1 (글로브 허용의 알려진 한계)
  - 상세: 이번 PR 이 추가한 `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts` 는 "동시 DELETE 두 건이 감사 행을 두 번 남기던 결함" 을 고정하는 유일한 e2e 증거이며, 자기 주석에서 "이 결함 클래스의 다섯 번째 짝(`workflow-`/`workspace-`/`trigger-`/`schedule-delete-concurrency.e2e-spec.ts`)" 이라고 스스로 명시한다. 그러나 이 파일은 `codebase/backend/test/` 아래에 있어 `4-integration.md` 의 `code: codebase/backend/src/modules/integrations/**` 글로브에 매칭되지 않는다. `spec/2-navigation/2-trigger-list.md` 는 정확히 같은 성격의 e2e(`trigger-deletion-releases-resources.e2e-spec.ts`, `trigger-update-save-window.e2e-spec.ts`)를 "그 파일이 정본을 고정한다" 는 설명 주석과 함께 `code:` 에 개별 등재해 두는 선례를 이미 세워 두고 있다 — 이번 파일은 그 선례를 따르지 않는다.
  - **다만 신규 위반이 아니라 기존 패턴의 연장이다**: 직접 확인한 결과 형제 4개 e2e(`workflow-`/`workspace-`/`trigger-`/`schedule-delete-concurrency.e2e-spec.ts`) 도 각자의 spec(`1-workflow-list.md`/`2-trigger-list.md`/`3-schedule.md` 등) `code:` 어디에도 등재돼 있지 않다(`grep -rl delete-concurrency spec/` 결과 0건). 즉 이번 PR 이 특별히 뒤처진 것이 아니라, 이 결함 클래스 전체가 처음부터 이 gap 을 갖고 있다. `spec-impl-evidence.md` §R-1 이 "글로브의 stale 매칭은 `/spec-coverage` standing audit 로 보완" 한다고 스스로 적어 두어, 이 gap 을 build 가드가 아니라 별도 도구의 몫으로 이미 넘겨 두고 있다.
  - 제안: 필수 사항은 아니나, `2-trigger-list.md` 수준의 등재 밀도를 다른 형제 문서에도 맞추고 싶다면 `4-integration.md` (및 `1-workflow-list.md`/`3-schedule.md`/워크스페이스 spec)의 `code:` 에 각 `*-delete-concurrency.e2e-spec.ts` 를 "동시 DELETE 감사 중복 방지의 정본" 주석과 함께 추가하는 편이 일관적이다. 이번 PR 단독의 되돌림 사유는 아니므로 별도 정리 plan 항목으로 미뤄도 무방.

## 이번 diff 자체에 대한 준수 확인 (위반 없음)

- **에러 코드**: 신규 `throwIntegrationNotFound()` 헬퍼가 던지는 `RESOURCE_NOT_FOUND` 는 기존 리터럴 7곳을 그대로 통합한 것으로 새 코드 신설이 아니다. `error-codes.md` §1 의 "시스템 전역 공용 코드는 prefix 없이 쓴다" 범주에 해당하며, 형제 서비스(`triggers.service.ts` `throwTriggerNotFound()`, `schedules.service.ts` `throwScheduleNotFound()`)와 동형이라 명명 규약 위반이 없다.
- **감사 액션**: `integration.deleted` 는 `audit-actions.md` §3 레지스트리에 이미 등재된 과거분사(§2.1) 패턴이며 이번 diff 로 신설·변경되지 않았다. `affected === 0` 판정 도입은 감사가 **한 번만** 남도록 만드는 수정이라 오히려 audit 카디널리티를 규약이 기대하는 상태(요청 1건 = 감사 1행)로 되돌린다.
- **Swagger/DTO**: 이번 diff 는 컨트롤러·DTO·데코레이터를 전혀 건드리지 않는다(서비스 내부 로직 + private 헬퍼 + `delete(criteria)` 전환뿐). `swagger.md` 의 명명·wrapper·`Update` 접두 규칙이 적용될 표면이 없다.
- **`spec_impact` 표기**: 신규 `plan/in-progress/integration-dup-delete.md` 의 `spec_impact: none` 은 bare sentinel 로 Gate C 요구 형식(리스트 또는 bare `none`)을 정확히 지킨다.
- **`code:` 인라인 주석 허용**: `2-trigger-list.md` frontmatter 의 `code:` 리스트에 다수 `#` 주석이 섞여 있으나, 이는 `spec-impl-evidence.md` §2.1 이 2026-09-06 이후 명시적으로 허용한 형태(파서가 빈 줄·`#` 을 건너뛰도록 수정됨)라 위반이 아니다.

## 요약

이번 diff 는 `spec/2-navigation` 영역(정확히는 `4-integration.md` 가 소유하는 `IntegrationsService`) 의 동시 DELETE 중복 감사 버그를 고치는 좁은 코드 전용 변경이며, 새 에러 코드·새 감사 액션·새 DTO·새 Swagger 표면을 전혀 도입하지 않고 기존에 확립된 명명·헬퍼 패턴(형제 서비스의 `throw*NotFound()`, 기존 `RESOURCE_NOT_FOUND`/`integration.deleted`)을 그대로 재사용한다. `spec/conventions/**` 의 명명·출력 포맷·API 문서 규약을 직접 위반하는 지점은 발견되지 않았다. 유일하게 짚을 만한 점은 신규 e2e 증거 파일이 `4-integration.md` 의 `code:` frontmatter 에 등재되지 않은 것인데, 이는 형제 4개 파일(workflow/workspace/trigger/schedule-delete-concurrency)에서도 동일하게 나타나는 기존 패턴이라 이번 PR 특유의 회귀가 아니고, 규약 자신도 이 한계를 `/spec-coverage` 로 보완하도록 설계해 두었다. spec 델타 0은 내부 동시성 버그 수정이라는 변경 성격상 타당하다.

## 위험도

LOW
