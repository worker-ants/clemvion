# Cross-Spec 일관성 검토 — cross_spec

## 실측 전제

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- **scope(`spec/conventions/`) 델타: 0개 파일** — 이 브랜치는 `spec/**` 를 전혀 바꾸지 않았다 (`spec_impact: none`, `plan/in-progress/trigger-canary-hardening.md` frontmatter).
- 프롬프트 번들의 `## 구현 변경 사항` diff 본문이 예산에 잘려 보이지 않아, 지시된 절차대로 HEAD 워킹트리를 절대경로로 직접 확인 (`git diff origin/main...HEAD --stat`, `git diff origin/main...HEAD -- codebase/`, `git show 026fbb610`).
- 실제 코드 diff (5커밋, `efb0e4b36`~`026fbb610`):
  - `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-{guard,spec}.ts` (신규 — 트리거 응답 비밀 컬럼 목록 3중 사본 정합 가드, AST 파싱)
  - `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (docstring 번호 표기 정리 — 원문자→아라비아 숫자)
  - `codebase/backend/test/{chat-channel-trigger-create,schedule-trigger,trigger-workflow-ref}.e2e-spec.ts` (주석 보강 + `schedule-trigger.e2e-spec.ts` 에 `expectTriggerWorkflowRef(present:true)` 3건 신규)
  - 모두 **test/harness 코드**이며 controller·service·DTO 등 프로덕션 계약 코드는 diff 에 없음(`git diff --stat` 확인, `codebase/` 아래 변경 파일 6개 전부 `__tests__`/`.spec.ts`/`.e2e-spec.ts`).
- 검증 결과 `TRIGGER_RESPONSE_STRIP_COLUMNS`(정본, `triggers.service.ts`)·`TRIGGER_SECRET_COLUMNS`(사본 2, `schedule-trigger-ref.ts`/`trigger-workflow-ref.ts`) 모두 diff 이전부터 이미 존재하는 상수다 — 이 배치는 그 셋의 정합을 **감시**하는 가드를 신설했을 뿐 새 데이터 계약을 만들지 않는다.
- 라운드 4(`026fbb610`, 이 예산 절단 전 최신 커밋)는 `trigger-secret-columns.spec.ts` 에 대조군 테스트 1건 + JSDoc 표 추가만 했고 `plan/**` 외 다른 파일은 건드리지 않았다 — 순수 test-only 라 신규 cross-spec 표면 없음.

## 발견사항

- **[WARNING] `TriggersService.delete()` 라는 존재하지 않는 메서드명이 두 spec 문서에 남아 있다 (carry-forward, 이 라운드에서 신규 발생 아님)**
  - target 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 註 (이 배치가 `secret-store.md §R4` 를 처음 명시 인용하며 "그 경로(`remove()` → `deleteByPrefix`)는 R4 대로 동작한다" 고 주장)
  - 충돌 대상: `spec/conventions/secret-store.md:428` (§R4, `TriggersService.delete()` 가 clean-up 책임을 진다고 서술) / `spec/1-data-model.md:791` (Trigger `workspace_id` 행, 동일 스테일 이름 반복) — 실제 메서드명은 `triggers.service.ts` 의 `remove()`. 같은 문서 `secret-store.md:390`(§2.1 근방)은 이미 `remove()` 로 정정돼 있어 **한 문서 안에서 두 서술이 갈린다**.
  - 상세: 이 브랜치는 이 드리프트를 만들지 않았다 — §R4 자체는 이 diff 이전부터 스테일했다. 다만 신규 e2e 주석이 §R4 를 코드에서 처음 명시 인용해 이 불일치를 노출·확산시켰다. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 **전수 grep 으로 세 곳**(§R4·`1-data-model.md:791`·`migrations/V063__secret_store.sql:20`)이 등재돼 있고, 세 번째(마이그레이션 파일)는 Flyway 체크섬 문제로 **의도적 무조치**, 나머지 둘은 planner 소유로 적혀 있다 — developer 권한(`spec/` read-only)상 이 세션에서 직접 고칠 수 없는 것이 정상이다.
  - 제안: 별도 조치 불요 — 기존 백로그 항목 그대로 planner 턴에서 `secret-store.md §R4` + `1-data-model.md:791` 두 곳을 `remove()`(+`deleteByPrefix`)로 동시 정정할 것. 이 PR 을 이 사유로 막을 필요는 없다(신규 모순이 아니라 기존 부채의 재확인).

- **[INFO] `2-trigger-list.md` 의 `code:` frontmatter 가 이번 diff 로 새로 생긴 시행 파일을 아직 반영하지 않음 (carry-forward)**
  - target 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` (신규 — `expectTriggerWorkflowRef(row, {present:true, expectedWorkflowId})` 목록(C-2)·PATCH(G·H) 세 자리)
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` (§3 `TriggerDto.workflow` 계약의 시행 파일로 `trigger-workflow-ref.e2e-spec.ts` + `trigger-workflow-ref*.ts` 만 등재, `schedule-trigger.e2e-spec.ts` 없음 — 직접 확인)
  - 상세: 이 PR 이전엔 `type:'schedule'` 트리거의 `TriggerDto.workflow`(키 생략형, §5.4 기준 (b)) 양성 커버리지가 저장소 전체에 0건이었고, 이번 diff 가 그 갭을 처음 메웠다. `2-trigger-list.md` 의 시행-코드 추적 목록(spec-impl-evidence 관례)이 아직 그 파일을 모른다. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 백로그로 등재됨 — 신규 지적 불요.
  - 제안: 기존 백로그 항목대로 `code:` 에 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 추가.

- **[INFO] 신규 repo-guard(`trigger-secret-columns-{guard,spec}.ts`)가 어느 spec `code:` 에도 없음 (carry-forward, 관례 미확립)**
  - target 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-{guard,spec}.ts` (신규)
  - 충돌 대상: `spec/conventions/secret-store.md` (비밀 컬럼 정책 §1.1 SoT) — frontmatter `code:` 미등재
  - 상세: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 전수 실측(주어 `repo-guards/__tests__/*-guard.ts` 14개, `code:` glob 매칭 5개, 미등재 9개)으로 "관례라 부를 만큼 일관되지 않다" 고 정리했다 — repo-guard 등재를 규약으로 세울지(택일 미정) 자체가 별도 planner 결정 사항이라 이 라운드에서 새로 지적할 것이 없다.
  - 제안: 기존 백로그 항목("(a) `code:` 등재 여부 (b) repo-guard 등재 규약 신설 여부" 두 질문)을 planner 턴에서 함께 결정.

## 요약

이번 diff(5커밋, `codebase/` 6파일)는 test/harness 코드만 건드리며 `spec/conventions/` 를 포함해 어떤 `spec/**` 파일도 수정하지 않는다(`spec_impact: none`). 신설된 트리거 비밀 컬럼 3중 사본 가드와 schedule 표면 `TriggerDto.workflow` 양성 커버리지는 모두 spec 이 이미 선언한 기존 계약(`secret-store.md §1.1` 비밀 컬럼, `2-api-convention.md §5.4` 키 생략형)을 그대로 시행할 뿐 새로운 데이터 모델·API·상태·RBAC·계층 충돌을 만들지 않는다. 이전 라운드(`12_37_09`)가 발견한 두 건 — `secret-store.md §R4`/`1-data-model.md:791` 의 스테일 메서드명(`delete()`→`remove()`)과 `2-trigger-list.md` `code:` 트레이서빌리티 갭 — 은 이 라운드까지 여전히 남아 있으나 둘 다 이 브랜치가 새로 만든 모순이 아니라 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소유로 정확히 등재된 기존 부채이며, developer 는 `spec/` read-only 라 이 세션에서 직접 고칠 권한이 없다. 최신 라운드(`026fbb610`)는 순수 test-only 추가라 새 cross-spec 표면을 만들지 않았다. Critical 은 없다.

## 위험도

LOW
