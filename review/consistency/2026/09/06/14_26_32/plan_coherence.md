# Plan 정합성 검토 — target: `spec/2-navigation/`

## 검토 범위 확인 (실측)

- `git diff origin/main...HEAD --stat -- codebase/` → **15개 파일, 1818(+)/11(-)**. 전부
  `workflow-versions.service(.spec).ts` · `workspace-response.dto.ts` · 신규 가드 3종
  (`user-entity-exposure-guard.ts`/`.spec.ts`, `user-secret-absence.ts`/`.spec.ts`,
  `dto-jsdoc-citation-guard.ts`/`.spec.ts`) · fixture · e2e 3건이다.
- 이 파일 목록을 `spec/2-navigation/2-trigger-list.md`·`3-schedule.md` frontmatter `code:`
  (triggers/schedules 모듈 전체)와 대조 — **교집합 0**. `spec/2-navigation` 델타도 0(프롬프트
  명시). 즉 이 브랜치는 target 영역의 코드도 문서도 건드리지 않는다.
- 이 브랜치의 실질 작업(`User` 엔티티 컬럼 수준 방어 결정)은 `plan/in-progress/
  spec-draft-nullable-notation-followups.md` 의 "`User` 엔티티에 컬럼 수준 방어를 둘지 결정"
  항목 — 이미 `[x] 완료 (2026-09-06)` 로 그 plan 안에서 닫혀 있고, 후속 3건(§5.4 검증 층 등재·
  `User` 노출 금지 규범화·트리거 비밀 deny-list)도 같은 문서에 별도 항목으로 올바르게
  이월돼 있다. target=`spec/2-navigation` 과는 무관한 영역(`2-api-convention.md`,
  `secret-store.md`, `1-data-model.md`)이 그 후속의 소유 문서다.

위 실측 기준으로, **이 PR 이 `spec/2-navigation` 의 미해결 결정을 우회하거나, target 이
가정하는 사전 조건을 건드리거나, target 변경으로 다른 plan 의 후속 항목을 무효화하는 사례는
없다** —애초에 target 을 변경하지 않았고 코드 교집합도 없기 때문이다.

## 발견사항

### [INFO] `spec/2-navigation` 도메인의 선행 미해소 항목 (이 PR 과 무관, 추적용)

- target 위치: `spec/2-navigation/3-schedule.md §4`(API), `2-trigger-list.md`(§2.3.1/§3)
- 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` — 미체크 항목
  "`ScheduleDto.trigger`/`workflow` 를 nav-spec 에 문서화" (owner: planner, 2026-09-05 등재)
- 상세: `ScheduleDto.trigger` 를 키-생략형에서 §5.4 기본형(상시 존재)으로 바꾸고
  `TriggerDto.workflow` 는 키-생략 사유를 필드 주석에 적은 코드 쪽 결정은 이미 끝났으나, 그
  사유를 nav-spec(`3-schedule.md §4` 또는 `2-trigger-list.md`)으로 옮기는 문서화 작업만
  아직 열려 있다. plan 자신이 이를 정확히 열린 상태로 추적하고 있어 target 과 plan 이
  "모순"인 것은 아니다 — 단지 미완이다. 이 브랜치는 이 항목의 소유자도 아니고 관련 코드도
  건드리지 않았으므로 이 PR 의 책임은 아니다.
- 제안: 해당 planner 턴이 열릴 때 target(`3-schedule.md`/`2-trigger-list.md`)을 갱신. 이번
  PR 에서 조치할 필요 없음.

### [INFO] `2-trigger-list.md` §2.3.1 이 이미 삭제된 plan 파일을 인용

- target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 필드 권한 매트릭스,
  "External Interaction (Notification)" 행 — *"별 plan `eia-trigger-edit-ui` 가 구현"*
- 관련 plan: 해당 파일은 `plan/in-progress/`·`plan/complete/` 어디에도 없다. 이력 확인
  (`git log --all --oneline -- 'plan/in-progress/eia-trigger-edit-ui.md'`) 결과 `#235`
  (`b6d25a17c`)에서 생성됐다가 `#387`(`bf68394e4`, "완료 검증된 14건 git rm")에서 **완료
  검증 후 삭제**됐다 — plan lifecycle 상 `plan/complete/` 이동이 아니라 직접 `git rm` 된
  사례. 기능 자체는 살아 있고(§2.3.1 이 `edit` 모드로 서술) TBD 표시도 없으므로 실질적
  모순은 아니지만, 인용이 가리키는 대상이 더 이상 존재하지 않는 dangling reference다.
- 제안: 이 PR 의 스코프 밖(코드·문서 교집합 0). 다음에 `2-trigger-list.md` §2.3.1 을 손댈
  때 그 인용을 "구현 완료, 과거 `#235` 로 추적됨" 식의 역사적 각주로 정리하거나 제거.

## 요약

target(`spec/2-navigation/`)은 이번 diff(15개 파일, User 엔티티 노출 방어 가드 3종 +
`workflow-versions.service.ts` 유출 수정)와 코드·문서 교집합이 0이며, target 자체도
변경되지 않았다(델타 0). 이 PR 이 실제로 완결한 작업(`User` 컬럼 수준 방어 결정)은
`spec-draft-nullable-notation-followups.md` 안에서 이미 `[x]` 로 닫혀 있고 그 후속 3건도
같은 문서에 올바르게 이월돼 있어, plan 정합성 관점에서 이 PR 이 미해결 결정을 우회하거나
선행 조건을 무시하거나 다른 plan 의 후속 항목을 무효화하는 사례는 발견되지 않았다. 다만
`spec/2-navigation` 도메인 자체에는 이 PR 과 무관한 두 가지 경미한 기존 항목 — (1)
`ScheduleDto.trigger`/`workflow` nav-spec 문서화가 plan 에 이미 열린 채로 남아 있는 것,
(2) `2-trigger-list.md` 가 삭제된 plan 파일을 인용하는 것 — 이 있어 추적용 INFO 로 남긴다.

## 위험도

NONE
