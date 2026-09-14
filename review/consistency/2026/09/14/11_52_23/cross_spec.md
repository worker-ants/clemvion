# Cross-Spec 일관성 검토 — trigger-canary-hardening (impl-done, scope=spec/conventions/)

## 검토 방법 메모

- 프롬프트 번들의 `spec/conventions/**` 대부분과 `<git diff origin/main...HEAD -- code_areas>` 섹션이 컨텍스트 예산으로 절단되어 있었다(경고 문구 확인). 지시에 따라 **HEAD 워킹트리를 절대경로로 직접** 조회했다 — `git diff origin/main...HEAD -- codebase/` (6 files, 345 insertions / 23 deletions), `plan/in-progress/trigger-canary-hardening.md`, 관련 `spec/**` 원문.
- 실제 코드 변경은 전부 `codebase/backend` **테스트·가드**에 한정된다: (1) 신규 repo-guard `trigger-secret-columns-{guard.ts,spec.ts}` (비밀 컬럼 3중 사본 정합 검사), (2) `trigger-workflow-ref.spec.ts` 캐너리 헤더 번호 표기 정리(원문자→아라비아), (3) `schedule-trigger.e2e-spec.ts` 에 `TriggerDto.workflow` 양성 단언 3건 추가, (4) 두 e2e 파일의 teardown 주석 정정(근거 실측 반영). **spec/conventions/ 델타는 실제로 0** — plan frontmatter `spec_impact: none` 과 일치.

## 발견사항

- **[INFO]** `secret-store.md §R4` 가 인용하는 메서드명이 실제 코드와 다르다
  - target 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 주석(신규) — `secret-store.md §R4` 와의 관계를 명시적으로 인용하며 "그 경로(`remove()` → `deleteByPrefix`)는 R4 대로 동작한다" 고 서술
  - 충돌 대상: `spec/conventions/secret-store.md` §R4 — "trigger 삭제 시의 명시적 cleanup 책임은 **`TriggersService.delete()`** 가 진다"
  - 상세: 실제 코드의 메서드명은 `delete()` 가 아니라 `remove()` 다 (`codebase/backend/src/modules/triggers/triggers.service.ts:842` `async remove(id, workspaceId, userId)`). 이 PR 이 만든 결함은 아니다(§R4 원문이 이미 그렇게 적혀 있었다) — 다만 이번 PR 이 신규 e2e 주석에서 §R4 를 **1차 근거로 명시 인용**하면서 그 절이 실제로는 안 맞는 메서드명을 담고 있다는 점이 처음으로 독자 서술의 전제가 됐다. `secret-store.md` 는 `developer` 쓰기 권한 밖(spec/)이라 이 PR 범위에서 고칠 항목은 아니다.
  - 제안: planner 백로그에 `secret-store.md §R4` 의 `TriggersService.delete()` → `TriggersService.remove()` 정정 1줄 등재. 코드·PR 자체는 수정 불필요(인용 방향이 code→spec 이 아니라 spec 인용이 code 를 서술하는 쪽이라 이 PR 이 틀린 것은 아님).

## 교차 검증 — 충돌 없음을 확인한 항목 (근거 남김)

- **`TriggerDto.workflow` 두 표면의 분리**: 이번 diff 가 `schedule-trigger.e2e-spec.ts` 에 추가한 `expectTriggerWorkflowRef(..., {present:true})` 3건(목록 C-2, PATCH G·H)은 **`type:'schedule'` 트리거의 `TriggerDto.workflow`** 표면이다. `spec/2-navigation/2-trigger-list.md` 의 §5.4 주석은 **"네 반환 경로를 다섯 케이스(양성4+음성1)로 고정"** 이라 말하지만, 그 다섯 케이스는 `trigger-workflow-ref.e2e-spec.ts`(`type:'webhook'`, A/B/C/D + chatChannel PATCH)가 이미 담당하는 별개 표면이며 이번 diff 는 그 파일의 테스트 케이스를 건드리지 않았다(teardown 주석만 수정). `spec/2-navigation/3-schedule.md §4` 의 `ScheduleDto.trigger.workflow`(중첩, 이미 양성3+음성1 커버)와도 다른 표면이다. 세 표면·세 문서 서술이 서로 겹치거나 모순되지 않고, 이번 diff 는 미커버 표면(schedule 타입 직접 `TriggerDto.workflow`)만 additive 로 채운다 — plan §A.2 의 "표면이 둘" 분석과 실제 파일 경계가 일치함을 확인.
- **§5.4 부재 표현 규약과의 정합**: 신규 주석 "`TriggerDto.workflow` 는 §5.4 키 생략형이라 계약 대조가 부재를 위반으로 보지 않는다"는 `spec/5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략` 및 `2-trigger-list.md`/`3-schedule.md` 의 기존 서술과 정확히 부합한다. 새 모순 없음.
- **`secret-store.md §R4` 범위 한정 주장**: 신규 e2e 주석이 "R4 는 프로덕션 삭제 경로 규율이고 여기는 테스트 인프라 한정"이라 선을 긋는데, R4 원문의 주어("trigger 삭제 시의 cleanup 책임")가 실제로 프로덕션 서비스 메서드를 가리키므로 이 한정은 타당하다. R4 를 다른 6개 e2e 로 확장하려는 시도가 아님을 스스로 명시한 점도 확인(`--impl-prep rationale_continuity INFO#2` 처분과 일치).
- **비밀 컬럼 목록 3중 사본**: 신규 가드가 참조하는 정본 `TRIGGER_RESPONSE_STRIP_COLUMNS`(`triggers.service.ts`)와 사본 두 곳(`schedule-trigger-ref.ts`, `trigger-workflow-ref.ts`)의 `TRIGGER_SECRET_COLUMNS` 값이 실제로 `['notificationSecretV2', 'chatChannelTokenV2']` 로 3곳 모두 일치함을 직접 확인. 이 두 필드는 기존 spec(`data-flow/10-triggers.md`, `5-system/15-chat-channel.md`) 이 이미 정의한 비밀 컬럼이며 이번 PR 이 새 필드를 추가하지 않는다 — 데이터 모델 충돌 없음.
- **RBAC·상태 전이·요구사항 ID**: 이번 diff 는 권한 로직·엔티티 상태 머신·엔드포인트 계약을 전혀 건드리지 않는다(테스트·가드 전용). 새 요구사항 ID 도 부여하지 않는다(기존 R-17 인용만). 해당 축의 충돌 표면 자체가 없음.
- **계층 책임**: 신규 가드가 `src/repo-guards/__tests__/` 에서 소스(`triggers.service.ts`)를 AST 로 파싱해 읽는 패턴은 형제 가드 `redis-fail-open-catalog-guard.ts`/`masked-reject-callers-guard.ts` 와 동일 구조이며 실제로 그 두 파일이 존재함을 확인했다. 기존 계층 관례에서 벗어나지 않는다.

## 요약

이번 PR 은 `spec/conventions/**` 를 전혀 수정하지 않는 순수 테스트·가드 하드닝(백엔드 6파일)이며, plan frontmatter `spec_impact: none` 이 실측과 일치한다. 코드가 새로 주장하는 서술(§5.4 부재 표현, `TriggerDto.workflow` 두 표면 분리, `secret-store.md §R4` 범위 한정)은 모두 기존 `spec/2-navigation/2-trigger-list.md`·`3-schedule.md`·`5-system/2-api-convention.md`·`conventions/secret-store.md` 의 실제 문구와 대조했을 때 모순 없이 정합한다. 유일한 소견은 `secret-store.md §R4` 자체가 담고 있는 기존(이 PR 이전부터 존재) 메서드명 오기(`delete()` vs 실제 `remove()`) — 이 PR 의 신규 주석이 그 절을 처음으로 근거로 명시 인용하면서 가시성이 생겼을 뿐, PR 자체의 결함은 아니며 spec 쓰기 권한 밖이라 planner 백로그감이다.

## 위험도

NONE
