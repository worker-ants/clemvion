# Plan 정합성 검토 — target: `spec/2-navigation/`

## 조사 방법

- target scope(`spec/2-navigation/**`) 델타: **0개 파일** (`git diff origin/main...HEAD --stat` 로 재확인).
  이 브랜치("user-entity-column-defense")의 실제 diff 는 `codebase/backend/src/common/db/pg-error.ts`,
  `triggers.service.ts`, `workflow-versions.service.ts`, `workspace-response.dto.ts`,
  `repo-guards/__tests__/user-entity-exposure*` 등 — User 엔티티 컬럼 노출 방어·에러 처리
  일반화가 주제이고 `spec/2-navigation/` 은 건드리지 않는다.
- 관련성 있는 유일한 코드 변경은 `triggers.service.ts` 의 `rethrowEndpointPathConflict` /
  `isEndpointPathUniqueViolation` 신설이다 — target `2-trigger-list.md §3`·PATCH 상세 블록이
  이미 문서화해 둔 *"`(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT`
  (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)"* 계약을
  구현이 뒤늦게 따라잡은 것이다. `git log -S` 로 그 문구가 `#1277`(이미 origin/main 에
  병합)에서 들어왔음을 확인 — 이번 PR 이 새 결정을 내린 것이 아니라 기존 spec 문구를
  실현한 것이다. **충돌 아님.**
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (이번 PR 이 +305줄 갱신)를
  전문 대조했다. 이 세션 자체가 낳은 후속 항목 3건이 이미 정확히 그 파일에 등재돼 있다.

## 발견사항

- **[WARNING]** `2-trigger-list.md` §2.3.1 `botToken` 행의 자기모순이 target 에 그대로 남아 있다
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 필드 권한 매트릭스, `Chat Channel | botToken` 행 — *"응답에는 `hasBotToken: boolean` 만 노출"* 과 *"마스킹 placeholder (`•••• <last4>`)"* 를 한 문장에서 동시에 주장
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` — `- [ ] "2-trigger-list.md:106 botToken 행의 자기모순"` (planner, 2026-09-06 등재, `review/consistency/2026/09/06/14_59_49` W2)
  - 상세: plan 은 이 모순을 이미 실측·등재했고("이 PR 이 만든 결함이 아니다. 게이트가 넓어지며 드러났다") planner 턴을 기다리는 미해결 상태다. `spec/2-navigation` 델타가 0인 이 PR 은 이 모순을 만들지도 고치지도 않았으나, 지금 impl-done 검토 대상인 target 문서 그 자체가 여전히 이 모순을 안고 있다 — 다음 구현자가 이 행을 근거로 실제 last4 노출 필드를 신설하면 `secret-store.md §1.1` 위반으로 이어질 위험이 plan 문서에 이미 적혀 있다.
  - 제안: 이 PR 의 책임 범위는 아니다(발견만). plan 의 해당 체크박스가 이미 "planner, 등재" 상태이므로 **추가 등재는 불필요** — 다음 planner 턴에서 우선순위를 올릴 근거로 이 검토를 인용하면 된다. target 자체를 이 PR 에서 고치라는 뜻은 아니다.

- **[INFO]** `2-trigger-list.md §2.3.1` External Interaction 행이 가리키는 `eia-trigger-edit-ui` plan 이 트래커에 없다
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1, `External Interaction (Notification)` 행 — *"별 plan `eia-trigger-edit-ui` 가 구현"*
  - 관련 plan: `plan/in-progress/**`, `plan/complete/**` 전체에서 `eia-trigger-edit-ui` 이름의 파일이 존재하지 않음 (전수 검색 결과 0건)
  - 상세: `git log -S`로 확인한 결과 이 참조 문구는 `#265`(오래전, 이 세션과 무관)에서 도입됐다. 이번 PR 의 diff 와도, 현재 진행 중인 다른 어떤 plan 과도 관련이 없는 **오래된 dangling 참조** — 실제로는 backend `notification`/`interaction` DTO 가 이미 구현돼 있어(§3 PATCH 문서 참조) 남은 것은 frontend edit UI 뿐일 수 있는데 그 작업을 추적하는 plan 파일이 안 보인다.
  - 제안: 이번 PR 범위 밖. 다음 spec 정비 턴에서 실제 담당 plan 이름으로 갱신하거나(이미 완료됐다면 참조 제거) 확인이 필요하다는 정도의 추적 메모.

- **[INFO]** `spec-draft-nullable-notation-followups.md` 의 두 nav-spec 관련 후속 항목은 이번 PR 과 충돌 없음
  - target 위치: 해당 없음 (target 미변경 확인용)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` — `- [ ] "ScheduleDto.trigger/workflow 를 nav-spec 에 문서화"` (`spec/2-navigation/3-schedule.md §4` 대상, planner, 2026-09-05 등재) / `- [ ] "도메인 세부 에러 코드의 표현 방식을 정식화한다"` (`2-api-convention.md §5.3` 대상, planner, 2026-09-06 등재, 이번 PR 의 `TRIGGER_ENDPOINT_PATH_CONFLICT` 구현이 계기)
  - 상세: 둘 다 target(`spec/2-navigation/`) 이 아직 반영하지 않은 문서 갱신 항목이지만, 이번 PR 이 target 을 건드리지 않았으므로 "target 변경이 후속 항목을 무효화" 하는 상황이 아니다. 두 번째 항목은 이 PR 의 `triggers.service.ts` 변경이 계기가 됐지만, 구현은 **이미 문서화된** 계약(`details.code` 형태)을 그대로 따랐고 plan 은 "향후 다른 도메인 코드를 위한 일반 규칙 성문화"만 열어 둔 것이라 이 PR 의 구현과 충돌하지 않는다.
  - 제안: 조치 불필요 — 이미 정상적으로 plan 에 등재돼 있다.

## 요약

target(`spec/2-navigation/`)은 이번 PR 에서 델타 0으로 변경되지 않았고, 이 PR 의 코드 변경 중 유일하게 그 영역과 접점을 가진 `triggers.service.ts`의 `TRIGGER_ENDPOINT_PATH_CONFLICT` 구현은 이미 origin/main 에 병합돼 있던 spec 문구(`#1277`)를 뒤늦게 실현한 것이라 새로운 결정 충돌이 아니다. 이 세션이 스스로 만든 후속 plan 항목(`spec-draft-nullable-notation-followups.md`)도 nav-spec 관련 2건 모두 정상적으로 planner 턴 대기 상태로 등재돼 있어 "미반영 후속" 문제는 없다. 유일하게 남는 것은 target 문서 자체에 이미 존재하던(이 PR 과 무관한) botToken 자기모순 — plan 이 이미 알고 있고 developer 책임 밖이라 이번 PR 의 결함은 아니지만, impl-done 검토 시점의 target 이 여전히 그 결함을 안고 있다는 사실은 기록해 둘 가치가 있다. `eia-trigger-edit-ui` dangling 참조는 이 세션과 무관한 오래된 문서 위생 문제다.

## 위험도

LOW
