# Cross-Spec 일관성 검토 — cross_spec

## 실측 전제

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- **scope(`spec/conventions/`) 델타: 0개 파일** — 이 브랜치는 `spec/**` 를 전혀 바꾸지 않았다.
  실제 변경은 `codebase/backend` 의 test/harness 6개 파일(트리거 canary 하드닝)뿐이다.
  프롬프트 번들의 `## 구현 변경 사항` diff 본문이 예산에 잘려 보이지 않아, HEAD 워킹트리를
  절대경로로 직접 읽고 `git diff origin/main...HEAD` 로 재확인했다 (지시된 절차).
- 실제 diff 대상:
  - `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-{guard,spec}.ts` (신규 — 정본·사본 3중 목록 정합 가드)
  - `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (docstring 번호 표기 정리)
  - `codebase/backend/test/{chat-channel-trigger-create,schedule-trigger,trigger-workflow-ref}.e2e-spec.ts` (주석 보강 + `schedule-trigger.e2e-spec.ts` 에 `expectTriggerWorkflowRef(present:true)` 3건 신규)
- 코드 변경 자체는 spec 이 이미 선언한 계약(§5.4 `TriggerDto.workflow` 키 생략형, `secret-store.md §1.1` 비밀 컬럼 3종)을 그대로 따르며 새 모순을 만들지 않는다. 아래 발견은 **이 diff 가 재확인/증폭시킨, 이미 존재하던 spec 간 명명 드리프트**다.

## 발견사항

- **[WARNING] `TriggersService.delete()` 라는 존재하지 않는 메서드명이 두 spec 문서에 남아 있다**
  - target 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 註 (신규 — `secret-store.md §R4` 를 처음으로 명시 인용하며 "그 경로(`remove()` → `deleteByPrefix`)는 R4 대로 동작한다" 고 주장)
  - 충돌 대상: `spec/conventions/secret-store.md:428` (§R4, `TriggersService.delete()` 가 clean-up 책임을 진다고 서술) · **`spec/1-data-model.md:791`** (Trigger `workspace_id` 행, 동일하게 `TriggersService.delete()` 를 인용)
  - 상세: 실제 코드(`triggers.service.ts:842`)의 메서드명은 `remove()` 다. 같은 문서 `secret-store.md:390`(§2.1 근방)은 이미 `remove()` + `deleteByPrefix('secret://triggers/{id}/')` 로 정정돼 있어, **`secret-store.md` 한 파일 안에서 두 서술이 갈린다** — 게다가 `1-data-model.md:791` 도 같은 스테일 이름을 반복해 **두 개의 서로 다른 spec 파일**이 정정 전 이름을 쓰고 있다. 이번 diff 는 §R4 를 코드 주석에서 **처음 명시 인용**해 이 불일치를 실제로 노출시켰다 (`plan/in-progress/spec-draft-nullable-notation-followups.md` 가 §R4 건은 이미 planner 백로그로 등재 — `--impl-done 11_52_23 cross_spec INFO#1` + `/ai-review 11_52_13 requirement INFO#3`). 다만 **`1-data-model.md:791` 쪽은 아직 그 백로그에 등재돼 있지 않다** — 처분이 §R4 한 곳만 고치면 `1-data-model.md` 쪽 스테일 이름이 남는다.
  - 제안: `spec/conventions/secret-store.md §R4` 와 `spec/1-data-model.md:791` 두 곳 모두 `TriggersService.delete()` → `TriggersService.remove()`(+`deleteByPrefix`)로 정정. 기존 백로그 항목("§R4 의 `delete()` → `remove()` 한 단어")의 스코프에 `1-data-model.md:791` 도 함께 넣을 것 — 한 곳만 고치면 재발한다.

- **[INFO] `2-trigger-list.md` 의 `code:` 가 이번 diff 로 새로 추가된 시행 파일을 아직 반영하지 않음**
  - target 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` (신규 — `expectTriggerWorkflowRef(row, {present:true, expectedWorkflowId})` C-2 목록 + G·H PATCH 세 자리)
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` (§3 `TriggerDto.workflow` 계약의 시행 파일로 `trigger-workflow-ref.e2e-spec.ts` + `trigger-workflow-ref*.ts` 만 등재, `schedule-trigger.e2e-spec.ts` 없음) / `spec/2-navigation/3-schedule.md §4`
  - 상세: 이 PR 이전엔 `type:'schedule'` 트리거의 `TriggerDto.workflow` 양성 커버리지가 저장소 전체에 0건이었고(계획 문서가 이미 이 갭을 추적), 이번 diff 가 그 갭을 `schedule-trigger.e2e-spec.ts` 세 자리로 처음 메웠다. 그런데 `2-trigger-list.md` 의 `spec-impl-evidence` 시행-코드 추적 목록은 여전히 그 파일을 모른다 — "e2e 가 고정한다" 는 §3 註의 근거가 이 새 표면에 대해서는 `code:` 밖에 있다. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 백로그로 등재됨(`/ai-review 11_27_40 requirement WARNING#1`) — cross-spec 관점에서도 동일 갭이 관측돼 carry-forward 로 남긴다.
  - 제안: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 에 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 추가 (기존 백로그 항목과 동일 처분, 이 라운드에서 중복 신규 등재 불요).

## 요약

이 diff 는 `spec/conventions/` 를 전혀 수정하지 않고, `spec/2-navigation`·`spec/1-data-model`·`spec/conventions/secret-store.md` 가 이미 선언한 계약(§5.4 키 생략형 `TriggerDto.workflow`, §1.1 비밀 컬럼 3종 스트립)을 그대로 준수하는 테스트·하드닝 가드 추가에 그친다 — 새로운 데이터 모델/API/상태/RBAC/계층 충돌은 발견되지 않았다. 다만 diff 의 신규 주석이 `secret-store.md §R4` 를 처음 명시 인용하면서, 그 섹션과 `1-data-model.md:791` 이 이미 정정된 실제 메서드명(`remove()`)과 다른 스테일 이름(`delete()`)을 쓰고 있다는 기존 spec-간 드리프트를 노출시켰다(§R4 건은 이미 planner 백로그, `1-data-model.md` 쪽은 미등재). 또 새로 추가된 schedule 표면의 시행 커버리지가 `2-trigger-list.md` `code:` 트레이서빌리티에 아직 반영되지 않은 기존 갭도 함께 남아 있다. 둘 다 이 브랜치가 만든 신규 모순이 아니라 이미 추적 중인 문서 정합 부채이며, 코드 자체의 동작은 spec 과 충돌하지 않는다.

## 위험도

LOW
