# 요구사항(Requirement) 리뷰 — trigger-canary-hardening

## 검증 방법

프롬프트에 실린 diff/컨텍스트 외에, 아래는 저장소를 직접 열람·실행해 확인했다(저장소 파일은
전혀 수정하지 않음 — `git status --short` 로 확인, 리뷰 종료 시점 변경분은 harness 가 자동
생성한 `review/code/2026/09/14/` · `review/consistency/2026/09/14/11_27_47/` 뿐):

- `TRIGGER_RESPONSE_STRIP_COLUMNS`(정본) · `TRIGGER_SECRET_COLUMNS`(사본 2곳) 실제 선언을 grep 으로 대조 — 값·형태(`as const satisfies …` vs `as const`) 일치 확인.
- `trigger-secret-columns.spec.ts` 단독 실행 → **9/9 GREEN**, `trigger-workflow-ref.spec.ts` 단독 실행 → **12/12 GREEN** (plan 의 claim 과 일치).
- `grep -nP "[①-⑪]"` 로 원문자 잔여 0 확인, `grep '가드 [0-9]'` 로 9~11번 케이스 표기 전수 검색됨 확인.
- `Makefile` 의 `e2e-down: docker compose down -v --remove-orphans` 및 `e2e-test` 가 성공/실패 무관하게 항상 `e2e-down` 을 실행함을 확인 — teardown 재정정 근거(§4, 세션 간 볼륨 삭제) 실측 확인.
- `secret_store` 를 실제로 SELECT/INSERT/DELETE 하는 e2e 파일이 `secret-store-like-prefix.e2e-spec.ts` **하나뿐**임을 grep 으로 확인 — 다른 두 파일(`chat-channel-trigger-create`, `trigger-workflow-ref`)은 주석에서만 언급. 그 파일의 스코프 패턴이 `uniqueName()` 기반 자기 접두어라 다른 e2e 의 실제 트리거 secret ref(`secret://triggers/{triggerId}/…`)와 겹치지 않음을 확인.
- `expectTriggerWorkflowRef` 시그니처(`opts: { present, expectedWorkflowId? }`)와 `schedule-trigger.e2e-spec.ts` C-2/G/H 세 호출 자리의 실제 사용을 대조 — 시그니처 일치, 셋 다 같은 공유 `workflowId` 를 identity 로 넘김.
- `spec/2-navigation/3-schedule.md` §4 표를 직접 열람 — 註가 말하는 "양성 3+음성 1" 은 `ScheduleDto.trigger.workflow`(참조 축소)에 대한 것이지 이번에 커버리지를 채운 `TriggerDto.workflow`(schedule 타입, `/api/triggers` 표면)와 다른 표면임을 확인 — plan 의 반박(§A.2, checker INFO#3 반증 주장)이 spec 원문과 일치함.
- `codebase/backend/tsconfig.build.json` 이 `test/`·`*spec.ts`·`repo-guards/**`·`shared/testing/**` 를 exclude 함을 확인(→ "build" 단계는 이 diff 의 신규 테스트 파일 타입을 검증하지 않음, MEMORY `feedback_typecheck_ratchet_not_in_run_test.md` 와 동일 함정). 이를 보완하려 `tsc --noEmit -p tsconfig.json` 전체 실행 → 이 PR 이 건드린 6개 파일(`trigger-secret-columns-guard.ts`, `trigger-secret-columns.spec.ts`, `trigger-workflow-ref.spec.ts`, `chat-channel-trigger-create.e2e-spec.ts`, `schedule-trigger.e2e-spec.ts`, `trigger-workflow-ref.e2e-spec.ts`)에서 발생한 에러 **0건**(다른 무관 파일들에서 다수의 기존(pre-existing) 타입 에러가 나오지만 이 diff 범위 밖).
- `unwrap()` 이 `SatisfiesExpression` 을 안 벗기면 정본에서 `null` 이 남을지 정적으로 추적 — JSDoc 이 주장하는 뮤턴트 실측(반증: "빈 배열"이 아니라 "null")과 일치함을 코드 경로로 확인.
- `INTERACTION_RESPONSE_STRIP_KEYS`(축2, `triggerToken`)가 이번 repo-guard 의 대상(`TRIGGER_RESPONSE_STRIP_COLUMNS`, 축1)과 분리돼 있어 스코프 혼동이 없음을 확인.

## 발견사항

- **[INFO] repo-guard 는 "알려진 3곳"만 비교한다 — 미지의 4번째 사본은 구조적으로 못 잡는다**
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` — `CANONICAL_SOURCE` + `MIRROR_SOURCES`(하드코딩 2개)
  - 상세: 이 가드는 "정본이 늘어나도 사본이 안 늘어나는" 드리프트는 막지만, 저장소 어딘가(예: 프런트엔드 fixture, 다른 e2e 헬퍼)에 **아직 등재 안 된 새 사본**이 생기는 경우는 이 가드의 감시 범위 밖이다. 이는 이 방식(정본+열거된 사본 리스트) 자체의 태생적 한계이고 이번 구현이 잘못한 것은 아니다 — 다만 plan/헤더 어디에도 "이 가드가 알려진 3곳까지만 지킨다"는 경계가 명시돼 있지 않아, 다음 사람이 "비밀 컬럼 유출은 이 가드가 전부 막는다"고 과신할 여지가 있다.
  - 제안: 헤더 JSDoc 에 "신규 사본이 생기면 `MIRROR_SOURCES` 에 추가해야 이 가드가 그것도 본다"는 한 줄을 남겨 두면 향후 혼동을 막는다. 블로킹 아님.

- **[WARNING] `[SPEC-DRIFT]` 아님 — spec-impl-evidence 관점의 완결성 갭**: `2-trigger-list.md` frontmatter `code:` 목록이 §3 `TriggerDto.workflow` 주장의 enforcing 파일로 `trigger-workflow-ref.e2e-spec.ts`(+헬퍼)만 등재하는데, 이번 PR 이 `schedule-trigger.e2e-spec.ts` 에 추가한 3개 단언(C-2/G/H)도 **같은 DTO 필드의 같은 §3 계약**(`workflow` 키 생략형 규칙)을 schedule 타입에 대해 처음으로 시행한다
  - 위치: `spec/2-navigation/2-trigger-list.md:20-27` (frontmatter `code:`) vs `codebase/backend/test/schedule-trigger.e2e-spec.ts` (C-2/G/H, `expectTriggerWorkflowRef` 3회 호출)
  - 상세: `trigger-workflow-ref.e2e-spec.ts` 자신의 JSDoc 은 "TriggerDto shape 를 내보내는 곳은 네 개뿐"이라는 표로 자신의 커버리지 범위를 스스로 선언하는데, 그 표는 트리거 **타입**을 구분하지 않는다. `schedule-trigger.e2e-spec.ts` 가 이번에 메운 것은 정확히 그 표의 `GET /api/triggers`(목록)·`PATCH /api/triggers/:id`(수정) 두 행을 **schedule 타입 트리거**로 재검증하는 것이라, §3 이 주장하는 계약을 시행하는 파일이 실질적으로 하나 더 늘었다. 이것이 spec 위반은 아니지만(코드가 옳다, 계약을 더 넓게 지킴), doc-sync-matrix 의 `code:` 목록이 그 사실을 반영하지 못해 향후 `spec-coverage` standing audit 이나 사람이 "이 §3 계약을 누가 지키는가"를 추적할 때 `schedule-trigger.e2e-spec.ts` 를 놓칠 수 있다. plan 은 `spec_impact: none` 으로 선언했고 developer 는 `spec/` 쓰기 권한이 없으므로 이번 PR 이 직접 고칠 항목은 아니다.
  - 제안: `project-planner` 턴에서 `2-trigger-list.md` frontmatter `code:` 에 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 를 추가하거나(§3 註 옆에 "schedule 타입 커버리지는 이 파일" 한 줄), 최소한 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 이 갭을 한 줄 남겨 다음 spec 정리 세션이 놓치지 않게 한다.

- **[INFO] `GET /api/triggers/:id`(단건) 의 schedule 타입 `workflow` 양성 커버리지는 여전히 0건 — 단, plan 이 명시적으로 인지·유예한 갭**
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` 전체(단건 상세 조회 테스트 없음), plan 문서 `plan/in-progress/trigger-canary-hardening.md:63-68`
  - 상세: plan §A.2 표가 "이 파일에 단건 `GET /api/triggers/:id` 는 없다"고 스스로 밝히고 세 자리(C-2·G·H)만 처리하기로 결정했다 — 은폐가 아니라 명시적 스코프 축소다. 다만 "회귀 방어: schedule 커버리지 0건"이라는 원 트래커 항목의 정신에서 보면, 4개 응답 경로(create 제외 findAll/findOneDetail/update x2) 중 `findOneDetail` 한 곳은 schedule 타입에 대해 여전히 미검증 상태로 남는다.
  - 제안: 블로킹 아님 — 다음 트리거 관련 세션에서 "단건 조회 스케줄 타입 workflow 양성 1건" 을 별도 후속으로 등재할 가치는 있다(트래커에 이미 반영돼 있는지 확인 권장).

- **[INFO] `review/consistency/2026/09/14/10_44_37/_retry_state.json` 이 부트스트랩(초기) 상태를 그대로 커밋 — `agents_success: []`·`agents_pending` 5개 전부 미완료로 남아 있음에도 5개 리포트 전문과 SUMMARY 의 "BLOCK:NO, 전원 완료" 결론은 실제로 맞다**
  - 위치: `review/consistency/2026/09/14/10_44_37/_retry_state.json`
  - 상세: 이 파일 자체는 harness 산출물이라 이번 feature 구현의 정확성과 무관하지만, 상태 파일과 실제 산출물(완전한 5개 .md + SUMMARY.md)이 불일치하는 형태라 — 실제 완료 판정은 파일 존재로 하는 것으로 보이며(SUMMARY 자신도 "5개 output_file 모두 기존 존재 확인됨"이라 명시), 이 diff 의 결론(BLOCK:NO)에는 영향 없음. 참고용으로만 남긴다.

## 요약

핵심 변경(트리거 비밀 컬럼 3중 사본 AST 정적 가드, schedule 타입 `TriggerDto.workflow` e2e 양성 커버리지 3자리, 캐너리 주석 표기 통일, e2e teardown 근거 재정정)은 plan 이 서술한 그대로 구현돼 있고, 코드·spec·실측(단위 테스트 9/9·12/12 GREEN, 신규 파일 tsc 에러 0건, Makefile `e2e-down -v` 확인, `secret_store` 유일 소비 e2e 의 자기 접두 스코프 확인) 이 서로 일치한다. `spec/2-navigation/3-schedule.md §4`·`2-trigger-list.md §3` 원문을 직접 대조한 결과 plan 이 consistency-check 의 INFO#3("§4 양성 3 이 미이행")을 반증한 근거도 타당하다 — 두 표면(`ScheduleDto.trigger.workflow` vs `TriggerDto.workflow`)이 실제로 다르다. CRITICAL 급 기능 결함·spec 불일치는 발견되지 않았다. 다만 doc-sync-matrix 완결성 관점에서 `2-trigger-list.md` frontmatter 가 신규 enforcing 파일(`schedule-trigger.e2e-spec.ts`)을 등재하지 못한 점, 그리고 repo-guard 가 "알려진 사본"만 비교한다는 경계가 문서화돼 있지 않은 점을 WARNING/INFO 로 남긴다 — 둘 다 developer 권한 밖(`spec/` 쓰기 불가)이거나 블로킹이 아닌 후속 트래킹 항목이다.

## 위험도

LOW
