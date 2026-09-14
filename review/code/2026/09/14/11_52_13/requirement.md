# 요구사항(Requirement) 리뷰 — trigger-canary-hardening (재검토 라운드)

## 검증 방법

이 라운드는 `plan/in-progress/trigger-canary-hardening.md` 가 선언한 4개 항목(① 트리거 비밀
컬럼 3중 사본 repo-guard ② `TriggerDto.workflow`(schedule) 양성 커버리지 ③ 캐너리 두 파일
주석 정리 ④ e2e teardown 근거 정정)의 실제 구현(코드 diff 6파일, `origin/main` 대비
+345/-23)을 독립적으로 재검증했다. 이전 라운드(`review/code/2026/09/14/11_27_40`)가 WARNING
2건을 남겼고 그중 1건(vacuous 삼항식)이 `4c1a49b30` 로 고쳐진 뒤의 diff 라서, 그 수정이
실제로 반영됐는지부터 확인했다. 저장소는 전혀 수정하지 않았다(`git status --short` 로 확인 —
untracked 항목은 harness 가 자동 생성한 `review/code/.../11_52_13/`·`review/consistency/.../11_52_23/` 뿐).

실행/대조한 것:

- `npx jest repo-guards/__tests__/trigger-secret-columns.spec.ts src/shared/testing/trigger-workflow-ref.spec.ts` → **21/21 GREEN** (plan 이 주장하는 9+12 와 일치).
- `npx tsc --noEmit -p tsconfig.json` 전체 실행 → 이번 diff 6개 파일에서 에러 **0건** (grep 필터로 확인).
- `TRIGGER_RESPONSE_STRIP_COLUMNS`(`triggers.service.ts:104`) vs `TRIGGER_SECRET_COLUMNS`(`schedule-trigger-ref.ts:24`, `trigger-workflow-ref.ts:45`) 세 선언을 직접 열람 — 값·순서 `['notificationSecretV2', 'chatChannelTokenV2']` 완전 일치.
- `readStringArrayConst`/`readAllTriggerSecretColumnLists` 전체 구현을 직접 읽고 unwrap 루프·null vs `[]` 분기·non-string 원소 처리 로직을 소스 레벨로 추적 — JSDoc 이 서술하는 동작과 실제 구현이 일치.
- `trigger-secret-columns.spec.ts` 의 이전 WARNING#2(vacuous 삼항식) 수정 확인 — `if (value === null) throw new Error(...)` 로 명시적으로 갈라졌고, 삼항식은 제거됨.
- `expectTriggerWorkflowRef(dto, { present, expectedWorkflowId })` 실제 시그니처(`trigger-workflow-ref.ts:103-140`)와 `schedule-trigger.e2e-spec.ts` C-2(237행)·G(366행)·H(404행) 세 호출부를 대조 — 시그니처·호출 형태 일치.
- `grep -n "가드 [0-9①-⑪]"` 로 `trigger-workflow-ref.spec.ts` 재확인 — 원문자 잔존 0, `## 가드` 케이스 헤딩 3개(3·5 결합 포함)로 RESOLUTION.md 의 재계산(2→3)과 일치.
- `Makefile` `e2e-down: docker compose down -v --remove-orphans` + `e2e-test` 가 실패해도 항상 `e2e-down` 실행함을 확인 — teardown 무해성 근거(세션 간 볼륨 삭제) 실측 일치.
- `secret_store` 테이블을 실제로 `SELECT/INSERT/DELETE` 하는 e2e 는 `secret-store-like-prefix.e2e-spec.ts` 하나뿐임을 grep 으로 확인(다른 3개 파일은 주석/코멘트 언급뿐). 그 파일이 `uniqueName('like')` 기반 자기 네임스페이스로 스코프됨을 소스로 확인 — "다른 e2e 와 안 겹친다"는 diff 의 근거 주장이 실측과 일치.
- `spec/conventions/secret-store.md:426-428` §R4 원문 대조 — diff 의 인용("`ON DELETE CASCADE` 는 채택하지 않는다 — implicit DB 동작과 explicit application 동작이 섞이면 추적이 어려워지기 때문")이 원문과 정확히 일치. 실제 코드 `triggers.service.ts:842(remove)/860(deleteByPrefix)` 도 확인.
- `spec/2-navigation/2-trigger-list.md` frontmatter `code:`(1-27행) 직접 열람 — §3 계약의 시행 파일로 `trigger-workflow-ref.e2e-spec.ts`(+헬퍼)만 등재, `schedule-trigger.e2e-spec.ts` 미등재 확인.
- `plan/in-progress/spec-draft-nullable-notation-followups.md:3935-3963` 확인 — 위 gap 과 "단건 조회 schedule workflow 0건" 갭이 실제로 트래커에 `[ ]` 로 등재돼 있음(우회 아님, 권한 경계 준수).
- TODO/FIXME/HACK/XXX grep — 6개 변경 파일 전체에서 0건.

## 발견사항

- **[WARNING] (이전 라운드 WARNING#1 재확인 — 미해소, 단 권한 밖이라 정당)** `2-trigger-list.md` frontmatter `code:` 가 §3(`TriggerDto.workflow` 계약)의 시행 파일로 `trigger-workflow-ref.e2e-spec.ts`(+헬퍼)만 등재하는데, 이번 diff 가 `schedule-trigger.e2e-spec.ts` 에 추가한 3개 단언(C-2/G/H)도 같은 §3 계약을 **schedule 타입에 대해 처음** 시행한다.
  - 위치: `spec/2-navigation/2-trigger-list.md:20-26`(frontmatter `code:`) vs `codebase/backend/test/schedule-trigger.e2e-spec.ts:237,366,404`(`expectTriggerWorkflowRef` 3회 호출)
  - 상세: 직접 열람 결과 이 상태는 이전 라운드가 지적한 그대로 남아 있다. 코드 자체가 틀린 것은 아니다 — §3 이 주장하는 계약을 더 넓게(schedule 타입까지) 지키는 확장이라 "코드가 spec 을 위반"하는 방향이 아니라 spec 의 `code:` 목록(문서 메타데이터)이 실제 시행 파일 집합보다 좁아진 것이다. `developer` 는 `spec/` 쓰기 권한이 없고, `plan/in-progress/spec-draft-nullable-notation-followups.md:3935-3941` 에 이 갭이 정확히 이 인용(requirement WARNING#1)과 함께 처분 후보("frontmatter `code:` 에 `schedule-trigger.e2e-spec.ts` 추가")로 등재돼 있음을 확인했다 — 우회가 아니라 올바른 권한 경계 처리다.
  - 제안: `project-planner` 턴에서 `2-trigger-list.md` frontmatter `code:` 에 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 를 추가. 코드 쪽 조치는 불필요.

- **[INFO] `GET /api/triggers/:id`(단건) 의 schedule 타입 `workflow` 양성 커버리지 0건 — plan 이 명시적으로 인지·유예**
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` 전체(단건 상세 조회 케이스 없음), `plan/in-progress/spec-draft-nullable-notation-followups.md:3958-3963`
  - 상세: 헬퍼 계약상 단건 조회도 `workflow` 를 채우므로(`trigger-workflow-ref.ts:98` JSDoc — "목록·단건·수정은 채운다") 이 표면도 이론상 양성 대상이지만, 이번 배치는 목록(C-2)·PATCH(G·H) 세 자리만 처리하기로 스코프를 좁혔고 트래커에 별도 항목(`[ ]`)으로 남겨 다음 세션이 추적 가능하게 했다. 은폐가 아니라 명시적 스코프 축소.
  - 제안: 블로킹 아님. 트래커 항목이 이미 존재하므로 추가 조치 불필요.

- **[INFO] spec 자체 내부 불일치 — `secret-store.md` 가 같은 메서드를 두 이름으로 부른다 (이번 diff 무관, 참고용)**
  - 위치: `spec/conventions/secret-store.md:390`(`TriggersService.remove()`) vs `spec/conventions/secret-store.md:428`(§R4, `TriggersService.delete()` 라고 서술)
  - 상세: 실제 코드의 메서드명은 `remove()`(`codebase/backend/src/modules/triggers/triggers.service.ts:842`)이고, 이번 diff 가 `trigger-workflow-ref.e2e-spec.ts` 에 새로 단 주석은 `remove()` 를 정확히 인용한다 — diff 자체는 옳다. 다만 같은 spec 문서 안에서 §2.1 근방(390행)은 `remove()`, §R4(428행)는 `delete()` 로 서로 다르게 불러 spec 문서 자체가 자기 모순이다. 이번 PR 이 만든 결함이 아니고 `secret-store.md` 를 건드리지도 않았으므로 `developer` 조치 대상은 아니다.
  - 제안: 차기 `project-planner` 턴에서 `secret-store.md §R4` 의 `TriggersService.delete()` 를 `TriggersService.remove()` 로 정정.

- **[INFO] 검증 완료 — 기능 완전성·엣지 케이스·에러 시나리오**
  - `readStringArrayConst` 는 대상 파일 부재(`ENOENT` 대신 명시 메시지) · 선언 부재(`null`) · 빈 배열(`[]`) · non-string 원소(`null` 반환, 조용히 축약 안 함) 네 엣지 케이스를 전부 명시적으로 처리하며, spec(`trigger-secret-columns.spec.ts`)의 대조군 6건이 각각을 실측한다. 이전 라운드가 vacuous 로 지적한 지점은 이번 diff 에서 이미 고쳐졌다(`if (value === null) throw` 로 분리, 직접 확인).
  - `expectTriggerWorkflowRef` 의 `present:false`/`true` 두 갈래, `null` vs 키 생략 구분, identity 고정(`expectedWorkflowId`)이 헬퍼 안에서 모두 반환값 있는 경로로 처리되며(early return 포함) 누락된 경로 없음.

## 요약

이전 라운드가 지적한 vacuous 삼항식(WARNING#2)은 이번 diff 에서 정확히 고쳐졌음을 직접
확인했다. 4개 plan 항목(비밀 컬럼 3중 사본 정적 가드, schedule `TriggerDto.workflow` e2e 양성
커버리지 3자리, 캐너리 주석 표기 통일, e2e teardown 근거 재정정) 모두 코드·JSDoc·plan 서술이
서로 일치하고, 인용된 모든 spec 근거(`secret-store.md §R4`, `Makefile` teardown 동작,
`secret_store` 유일 소비 e2e 의 스코프)를 직접 재현·대조해 정확함을 확인했다. CRITICAL 급
기능 결함이나 spec-코드 line-level 불일치는 발견하지 못했다. 남은 항목은 모두 `developer`
권한 밖(`spec/` 쓰기 불가)이라 트래커에 정당하게 등재만 된 상태이며, 그 등재 자체도 실제
트래커 파일에 존재함을 확인했다. 추가로 `secret-store.md` 자체의 사소한 내부 명명 불일치
(§2.1 vs §R4)를 발견했으나 이번 diff 와 무관한 기존 spec 결함이다.

## 위험도

LOW
