# 변경 범위(Scope) 리뷰 — FK 인덱스 V121~V130 (「쓸 인덱스가 없는 FK 서른하나의 처분」)

## 발견사항

- **[INFO]** `AssistantSession` 기존 인덱스 행 정정이 이번 작업(FK 인덱스 신설) 범위 밖의 별도 수정과 섞여 있음
  - 위치: `spec/1-data-model.md` — `AssistantSession | (workflow_id, status, last_interaction_at DESC) | ...` 행 (V125 신규 행 바로 앞줄)
  - 상세: `-| AssistantSession | (workflow_id, status, last_interaction_at DESC) | ...` → `+| AssistantSession | (workflow_id, user_id, status, last_interaction_at DESC) | ...` 로 **기존** 인덱스 서술의 컬럼 구성 자체를 바꿨다. 이건 이번 처분 대상(V121~V130, 쓸 인덱스 없는 FK)과 무관한 **기존 오기 정정**이다 — 실제로 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 추가된 새 항목(`WorkflowAssistantSession` 엔티티의 `@Index(...)` 에 `userId` 가 빠졌다)이 "`spec/1-data-model.md` §3 의 같은 누락은 그 PR 이 정정했다" 고 스스로 명시하고 있어, 의도적으로 함께 들어간 것임은 확인된다. `cross_spec.md`(22:33 세션) 리뷰어도 이 정정이 실제 `V019__workflow_assistant.sql` 정의와 일치함을 별도로 검증했다.
  - 평가: 순수 스코프 관점에서는 "요청 범위(FK 서른한 개 처분) 밖의 문서 정정"이 섞인 것이 맞다. 다만 (a) 코드가 아니라 spec 문서 한 줄 정정에 그치고, (b) 실제 엔티티 데코레이터 코드 수정(`workflow-assistant-session.entity.ts`)은 "다음 PR 이 함께 고친다"며 명시적으로 **미루어** `--impl-done` 스코프 확장을 피했다 — 오히려 스코프 규율을 지키려 한 흔적(자기 인지 + 후속 항목 등재)이 보인다. CRITICAL/WARNING 급 문제는 아니다.
  - 제안: 조치 불요 — 이미 트래커에 후속 항목으로 분리 등재됨.

- **[INFO]** 리뷰 대상 diff 에 코드 변경 외 다량의 `review/consistency/**` 산출물·`plan/**` 갱신이 섞여 있으나 전부 프로젝트 규약이 강제하는 프로세스 산출물
  - 위치: `review/consistency/2026/09/18/22_33_00/**`(`--spec` 게이트), `review/consistency/2026/09/18/22_44_08/**`(`--impl-prep` 게이트), `plan/in-progress/spec-draft-fk-remaining-dispositions.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, `plan/complete/spec-draft-deletion-cascade-indexes.md`
  - 상세: CLAUDE.md 는 `project-planner` 가 `spec/` 작성 직전 `consistency-check --spec` 을, `developer` 가 구현 착수 직전 `--impl-prep` 을 의무화한다. 두 세션 산출물(SUMMARY.md·5개 checker md·`_retry_state.json`·`meta.json`·`_target/` 스냅샷)이 그대로 diff 에 들어있는 것은 스코프 이탈이 아니라 규약이 요구하는 정상 흔적이다. `plan/complete/spec-draft-deletion-cascade-indexes.md`(직접 diff 확인, 이 프롬프트엔 미포함)의 "처분" 칸 채움, 트래커의 체크박스 전환·후속 항목 등재(`endpoint_path` 인덱스 문제·`@Index` `userId` 누락·conventions 3섹션 편차)도 이번 작업이 실측 중 발견한 부수 사실을 "지금 고치지 않고 트래커에만 남긴다"는 스코프 규율을 그대로 따른다.
  - 제안: 조치 불요.

- **[INFO]** 리뷰 프롬프트 번들에 `git status`상 수정된 두 plan 파일 중 일부 diff가 누락되어 있었음(리뷰 도구 한계, 코드 결함 아님)
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`, `plan/complete/spec-draft-deletion-cascade-indexes.md` — 프롬프트의 "### 파일" 목록엔 없었으나 `git status`엔 M 으로 표시됨
  - 상세: 직접 `git diff HEAD`로 두 파일을 열어 확인한 결과, 둘 다 이번 FK 처분 작업의 정상적인 마무리 기록(트래커 체크박스 전환, 부록 표의 "처분" 칸 채움, 후속 항목 3건 신설)이었고 스코프 이탈은 없었다. 다만 이 사실이 scope 프롬프트 번들 자체에는 반영되지 않아 다른 reviewer 가 이 두 파일을 놓칠 위험이 있다.
  - 제안: 조치 불요(직접 확인으로 갈음) — harness 번들링 한계로 별도 기록.

## 요약

핵심 변경(마이그레이션 V121~V130 `.sql`/`.conf` 10쌍, e2e `deletion-cascade-indexes.e2e-spec.ts` 기대값 추가, `spec/1-data-model.md` 신규 Rationale 절 + 인덱스 표 10행, 6개 `spec/data-flow/*.md` sink 행 미러링)는 커밋 메시지·plan 제목이 선언한 "쓸 인덱스가 없는 FK 서른하나의 처분(인덱스 열 V121~V130)"과 정확히 일치하며, 불필요한 리팩토링·기능 확장·무관한 파일 수정·의미 없는 포맷팅·부적절한 임포트·설정 변경은 발견되지 않았다. diff 에 포함된 대량의 `review/consistency/**` 산출물과 `plan/**` 갱신은 프로젝트가 강제하는 `--spec`/`--impl-prep` 게이트의 정상 부산물이지 스코프 이탈이 아니다. 유일하게 주목할 지점은 `spec/1-data-model.md` 의 `AssistantSession` 기존 인덱스 행 하나를 이번 처분과 무관하게 함께 고친 것인데, 문서 한 줄 수정에 그치고 실제 코드(엔티티 데코레이터) 수정은 스코프 확장을 피하려 명시적으로 다음 PR 로 미뤄 등재했다는 점에서 오히려 스코프 규율이 잘 지켜진 사례로 평가한다.

## 위험도

NONE
