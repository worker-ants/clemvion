# Plan 정합성 검토 — spec/2-navigation/ (impl-done)

## 검토 범위 요약

- scope(`spec/2-navigation/`) 델타: **0개 파일** — 이 브랜치(`user-entity-column-defense`)는
  이 spec 영역을 건드리지 않았다. 실제 코드 diff(21파일/2671줄)도
  `triggers.service.ts`(endpoint_path 409 충돌 처리)·`workflow-versions.service.ts`·
  `workspace-response.dto.ts`·`pg-error.ts`·User/Trigger 관련 가드·테스트 신설이 전부이며,
  트리거/스케줄 UI 계약 자체를 바꾸는 코드는 없다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 를 실측 대조한 결과, 이
  plan 은 `spec/2-navigation/2-trigger-list.md`·`3-schedule.md` 를 겨눈 **미해결(`- [ ]`) planner
  항목 5건**을 이미 담고 있고, 그 항목들이 지적하는 모순은 현재 워킹트리의 실제 spec 파일에서
  **여전히 재현된다**(아래 상세). 이 PR 이 새로 만든 모순은 아니다 — 전부 이전 라운드에서 등재된
  기존 결함이며, 이 PR 은 spec 파일을 건드리지 않았으므로 이 라운드 자체가 이 모순을 악화시키지도,
  해소하지도 않았다.

## 발견사항

- **[WARNING] `2-trigger-list.md` R-2 가 폐기된 설계를 여전히 유효한 것처럼 서술 — cross-doc 파급까지 미반영**
  - target 위치: `spec/2-navigation/2-trigger-list.md` Rationale R-2(275~283행) vs §3 블록쿼트(209행)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 491~503행
    (`review/consistency/2026/09/06/15_31_00` W1 출처, 미체크)
  - 상세: R-2 는 `POST /api/triggers/:id/auth/rotate-secret` 를 "v1.1 예고 API" 로 적고,
    같은 문서 §3 각주는 "그 경로는 신설되지 않은 채 본 PR 에서 폐기됐다(R-14)" 라고 적어
    한 문서 안에서 자기모순이다. 직접 확인한 결과 **파급이 문서 밖으로도 나가 있다** —
    `spec/5-system/15-chat-channel.md:610` R-CC-10 이 "PATCH+rotate 양쪽 허용은 R-2 의
    hmacSecret 패턴과 정렬되나" 라고 R-2 를 **현재 유효한 설계**처럼 인용 중이다. plan 항목이
    이미 이 파급까지 정확히 예견해 등재해 두었다(두 파일 같은 턴에 갱신 요구).
  - 제안: 이 PR 의 책임이 아니다(developer 는 spec 쓰기 권한 없음, 정상적으로 planner 이월).
    plan 항목이 이미 정확하므로 **plan 갱신은 불필요** — 다음 planner 턴에서 R-2 취소선 정정 +
    `15-chat-channel.md` R-CC-10 인용 동시 갱신을 그대로 집행하면 된다.

- **[WARNING] `2-trigger-list.md §2.3.1` botToken 행의 자기모순 재확인**
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 `Chat Channel | botToken` 행(155행)
  - 관련 plan: 같은 파일 564~576행 (`review/consistency/2026/09/06/14_59_49` W2, 미체크)
  - 상세: 같은 셀이 "응답에는 `hasBotToken: boolean` 만 노출" 과 "마스킹 placeholder
    (`•••• <last4>`)" 를 동시에 말한다 — boolean 만 나가면 서버가 last4 를 보낼 방법이 없다.
    직접 확인 결과 현재 워킹트리에도 두 문구가 그대로 공존한다. plan 이 이미 정확히 지적했고
    아직 반영 전이다.
  - 제안: planner 턴에서 AuthConfig 의 `***<last4>` 마스킹 관례를 write-only 필드에 잘못
    차용한 문구를 제거. plan 항목 자체는 갱신 불필요.

- **[WARNING] Auth Config "새 인증 설정 만들기" 링크의 editor/admin 권한 불일치 — 직접 대조로 확정**
  - target 위치: `spec/2-navigation/2-trigger-list.md §2.3.1` Auth Config 행(152행,
    `editor+` 노출로 서술)
  - 관련 plan: 같은 파일 518~527행 (`review/consistency/2026/09/06/15_31_00` W2, 미체크)
  - 상세: `spec/2-navigation/6-config.md` 를 직접 열어 대조한 결과, §A.4(125행)·Authentication
    API 표(262행) 모두 "Add Config" 생성 액션을 **명확히 Admin+ 전용**으로 못박고 있다
    (`5-system/1-auth.md §3.2` 근거, 모호함 없음). 즉 plan 이 "제품 의도 확인 필요" 로
    유보한 것과 달리, **`6-config.md` 쪽은 이미 확정된 서술이고 `2-trigger-list.md` 쪽이
    유일하게 어긋난 문서**임을 이번 대조로 좁힐 수 있다.
  - 제안: planner 항목 문구를 "제품 의도 확인" 에서 "`2-trigger-list.md` 링크 노출을
    `admin+` 로 정정(6-config.md 가 이미 SoT)" 으로 좁혀도 될 근거가 이번 검토로 추가됐다.
    plan 항목 자체를 폐기하지 말고, 위 실측을 정정 근거로 덧붙이는 것을 권고.

- **[INFO] plan 의 `spec_impact` 가 본문이 요구하는 nav-spec 파일들을 누락**
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` frontmatter
    `spec_impact`(8~12행) — `spec/1-data-model.md`·`spec/data-flow/10-triggers.md`·
    `spec/5-system/2-api-convention.md`·`spec/conventions/swagger.md` 4건만 등재
  - 관련 plan: 같은 문서의 `## 후속` 섹션 자체 — R-2/frontmatter-status/auth-link/botToken
    4건(`2-trigger-list.md`)과 `ScheduleDto.trigger/workflow` 문서화 1건(`3-schedule.md §4`)이
    각각 `spec/2-navigation/2-trigger-list.md`·`3-schedule.md` 편집을 요구하는데, 이 두 파일과
    `spec/5-system/15-chat-channel.md`(R-CC-10 동반 갱신)가 `spec_impact` 목록에 없다.
  - 상세: `spec_impact` 는 향후 `--spec`/`--impl-done` 게이트가 번들 스코프를 정하는 근거다.
    이 목록이 실제 후속 작업 범위보다 좁으면, 이 plan 을 집행하는 planner 턴에서 해당 파일들이
    검토 번들에 안 실릴 위험이 있다(이미 이 plan 문서 안에 "`--spec` 번들이 `spec_impact` 를
    떨군다" 는 별개 harness 결함이 등재돼 있어, 좁은 목록의 대가가 더 커진다).
  - 제안: 이 plan 을 다음에 여는 planner 턴에서 `spec_impact` 에
    `spec/2-navigation/2-trigger-list.md`·`spec/2-navigation/3-schedule.md`·
    `spec/5-system/15-chat-channel.md` 를 추가.

## 요약

이번 라운드(`user-entity-column-defense`)는 `spec/2-navigation/` 을 전혀 건드리지 않았고,
실제 코드 diff 도 트리거/스케줄 UI 계약과 무관한 backend 방어 코드(User 컬럼 노출 가드,
endpoint_path 409 충돌 처리, WorkflowVersion select 축소)에 한정돼 있어 target 과 plan 의
미해결 결정 사이에 **이 라운드가 만든 새로운 충돌은 없다**. 다만 `plan/in-progress/
spec-draft-nullable-notation-followups.md` 가 이미 정확히 추적 중인 `2-trigger-list.md`
자기모순 4건(R-2 폐기 설계·botToken 응답 형태·frontmatter status·auth-config 링크 권한)이
현재 워킹트리의 실제 spec 파일에서 여전히 재현됨을 직접 대조로 재확인했고, R-2 모순의 cross-doc
파급이 `5-system/15-chat-channel.md` R-CC-10 에도 실제로 남아 있음을 추가로 확인했다. 이들은
전부 developer 권한 밖의 planner 이월 항목으로 정상 절차를 따르고 있으므로 이 PR 을 막을
사유는 아니다 — 다음 planner 턴에서 해당 체크박스들을 집행할 때 참고할 실측을 보강하는 선에서
반영을 권고한다.

## 위험도

LOW
