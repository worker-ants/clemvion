# Rationale 연속성 검토 — `trigger-workflow-ref-canary` (--impl-prep)

대상: `plan/in-progress/trigger-workflow-ref-canary.md` (owner: developer)
스코프: `spec/2-navigation/` (§5.4 요구 rationale 연속성)

## 발견사항

- **[CRITICAL]** §자기-반증형 소정정(T-4) 조건 1 위반 — 대상 문장은 developer 가 아니라 planner 가 썼다
  - target 위치: 계획서 `## 설계 > T-4. spec 문장 정정 — 2-trigger-list.md §3` 및 그 아래 5-조건 표, 1행
    `"1. developer 자신이 그 문서에 썼다 | ✅ #1304 (git blame 으로 확인 가능)"`
  - 과거 결정 출처: `CLAUDE.md` §자기-반증형 소정정 (2026-08-23 사용자 결정, `#1202`) 의 5개 조건, 그리고
    바로 이 PR 체인 안의 실제 선례 — 커밋 `08fbf133d`(#1292) 본문:
    *"`dto-jsdoc-citation-guard.ts` 가 `review-citations.md` 의 Rationale … 를 반증했다.
    자기-반증형 소정정 예외는 쓸 수 없다 — 그 문장은 developer 가 쓴 예고가 아니라 planner
    턴(`90c1751e8`)이 등재한 것이라 조건 1이 깨진다. 우회하지 않고 planner 턴을 열었다."*
  - 상세: `git blame -L 175,190 spec/2-navigation/2-trigger-list.md` 결과 해당 문단
    (*"자매 스케줄 축과 달리 이 축에는 캐너리가 아직 없다"* 포함)은 커밋 `dc77317cd4`
    (`docs(spec): §5.4 가 요구한 키-생략 사유를 nav-spec 으로 — 그리고 그 사유의 위계를 바로잡다
    (#1304)`)에서 도입됐다. 이 커밋을 직접 열어 보면:
    - 커밋 메시지 자체가 `docs(spec)` — spec 만 편집한 diff (`codebase/` 변경 0건, 메시지 말미
      "`codebase/` 변경 0건이라 `/ai-review` 와 두 타입체크 ratchet 은 이 축에 대상이 없다").
    - 게이트가 **`--spec`**(`review/consistency/2026/09/10/11_13_14` BLOCK:NO) — 이는
      `CLAUDE.md` 가 명시하는 **project-planner 의무 게이트**다. developer 의 self-refutation
      경로는 반대로 `--impl-done` 을 요구한다(계획서 T-4 자신도 이를 알고 "게이트: `--spec` 이
      아니라 `--impl-done`" 이라고 적었는데, 정작 #1304 는 그 반대인 `--spec` 을 썼다).
    - 커밋 메시지가 스스로 "고정(캐너리 작성)은 `spec-draft-nullable-notation-followups.md` 의
      **신규 developer 항목**으로 넘겼다" 고 적어, 문장을 쓴 주체(planner)와 그것을 실행할
      주체(developer, 후속 티켓)를 명시적으로 분리하고 있다.
    - `spec-draft-nullable-notation-followups.md` frontmatter 는 `owner: planner` 이고, 지금
      검토 중인 계획서 자신의 머리말도 *"`spec-draft-nullable-notation-followups.md` 단일
      항목(2026-09-10 등재)"* 이라고 그 planner 트래커에서 파생됐음을 밝힌다.
    - 이 저장소는 모든 역할의 커밋이 **동일한 git author**(`worker-ants`)를 쓴다(세션 시작
      `git status` 의 `Git user: worker-ants`) — 즉 `git blame` 은 "어떤 사람이 언제 썼나" 는
      보여주지만 **"어떤 역할(role) 턴에서 썼나"는 구분하지 못한다.** 계획서가 조건 1 충족의
      근거로 든 "git blame 으로 확인 가능"은 이 저장소 구조상 **성립하지 않는 검증 방법**이다 —
      실제 판별은 diff 스코프(spec-only) + 게이트 종류(`--spec`) + 소유 plan(`owner: planner`)
      세 가지 독립 신호로 해야 하고, 셋 다 "planner 가 썼다"를 가리킨다.
  - 결론: 조건 1(*"developer 자신이 그 문서에 썼다"*)은 충족되지 않는다. `CLAUDE.md` 는 다섯
    조건을 **전부** 충족해야 예외가 성립한다고 명시하므로, 조건 1 실패만으로 T-4 전체가
    무효다. 이는 "합의된 원칙(§자기-반증형 소정정의 다섯 조건) 위반"이자, 바로 이 PR 체인 안에서
    이미 한 번 올바르게 적용된 선례(#1292 의 `review-citations.md` 케이스)를 **같은 세션·같은
    작업자가 반대로 뒤집는** 결과다.
  - 제안: T-4 를 **developer 직접 정정에서 project-planner 턴으로 바꾼다.** 계획서
    `spec_impact`(`spec/2-navigation/2-trigger-list.md`)는 그대로 유효하되, 실제 문장 정정은
    developer 가 T-3(e2e 캐너리) 를 완료해 실측을 만든 뒤, 그 실측을 planner 에게 전달해
    planner 턴에서 반영하게 한다(선례와 동일 절차). 혹은, 이 특정 문장에 대해 사용자가 명시적으로
    "developer 가 고쳐도 된다"는 별도 승인을 받는다면 그 승인을 §자기-반증형 소정정과는 별개의
    근거로 plan 에 명시해야 한다 — 조건 1을 우회하는 것이 아니라 예외 자체를 쓰지 않는 것으로
    정직하게 기록해야 한다.

- **[WARNING]** (조건 1 과는 별개, 조건 1이 해소된 이후에도 남는 문제) "아직 없다"가 예고·트리거인지 모호
  - target 위치: `2-trigger-list.md` §3, `> **응답 형태 — TriggerDto.workflow 는 키 생략형이다**`
    문단 전체(175~187행)
  - 상세: 계획서 체크표는 조건 2를 *"상태 고지('아직 없다')이고 제품 정의·API 계약이 아니다"*
    라고 판정한다. 그런데 이 문장이 속한 문단은 (a) §5.4 부재-표현 판정 근거, (b)
    `id`/`name` 필드 구성이 자매 타입과 의도적으로 다르다는 계약 설명과 **한 문단 안에 섞여
    있다** — 즉 순수한 "아직 안 했다" 예고가 아니라 API 응답 계약 설명의 **일부 문장**이다.
    조건 4(*"정정은 그 문장에 국한 — 원문은 취소선으로 남기고 인접 서술은 건드리지 않는다"*)를
    지키더라도, "이 문장만 따로 떼면 예고", "문단 전체로 보면 계약 서술"이라는 경계가
    실무적으로 애매하다.
  - 제안: (조건 1 문제가 planner 턴으로 해소된 이후) 그 planner 턴에서 문장 경계를 조건 2
    기준으로 한 번 더 명시적으로 판정해 기록한다 — "이 문장은 상태 고지이지 §5.4 판정 근거
    자체를 바꾸지 않는다"는 한 줄이면 충분하다.

- **[INFO]** 두 선례 인용은 실측 결과 실재하고 계획서 서술과 일치 — 인용 좌표만 보강 권장
  - target 위치: 계획서 `## 무엇을 하지 않나` 2번째 항목
    (*"이 저장소가 `User` 투영 상수에서 같은 판단을 내린 선례가 있다(4개 shape 중 2개만
    우연히 일치)"*), `## 설계 T-1`
  - 확인 결과:
    - **"자매 헬퍼를 일반화하지 않는다" 선례**: 실재. `git log -1 --format=%B aa15503c7`
      (PR #1300, `origin/main` 에 이미 병합)의 *"W2. 거부한다 — 같아 보이는 넷이 서로 다른
      계약에 묶여 있다"* 절이 정확히 4곳(`CREATOR_PROJECTION`·`listMembers`·
      `notifications.service.ts:449`·`notifications.service.ts:353·367·417`)을 실측해 **값이
      겹치는 것은 둘뿐**(`{id,name,email}`)임을 확인하고, 나머지 둘은 shape 자체가 다름을
      근거로 **개명·재사용 모두 기각**했다("우연히 같은 값" vs `pg-error.ts` 의 "같은 개념"을
      구분). 계획서의 "4개 shape 중 2개만 우연히 일치" 서술과 수치·논리 모두 정확히 일치한다.
    - **`{id,name}` vs `{name}` 비대칭 결정**: 실재. `review/consistency/2026/09/06/00_48_52`
      의 `naming_collision.md`/`SUMMARY.md`(WARNING #2) + 같은 세션 `RESOLUTION.md` 가
      *"개명하지 않았다 — 필드 차이는 결함이 아니라 의도"* 라고 명시하고, 처방으로
      **상호 참조 JSDoc**(개명이나 통합이 아님)을 택했다. 현재 `TriggerWorkflowRefDto`/
      `ScheduleTriggerWorkflowRefDto` JSDoc 이 그 처분 그대로 `review/consistency/2026/09/06/
      00_48_52` W2를 인용하고 있어 인용도 정확하다. 캐너리가 `{id,name}` 을 양성 조건으로
      고정하는 것은 이 **이미 닫힌 결정을 되돌리는 것이 아니라 그대로 시행**하는 것이다 —
      "의도적으로 열어둔 것"은 없다.
  - 제안(선택): 계획서 본문에 `aa15503c7`(#1300) 커밋 해시/PR 번호를 직접 인용하면, 다음
    사람이 "선례가 있다"는 주장을 재검증할 때 grep 없이 바로 찾을 수 있다(현재는 산문
    서술만 있어 이번 검토처럼 커밋 이력을 뒤져야 확인 가능했다).

- **[없음 — 확인 완료]** "생성 응답에만 없다"는 이 저장소에서 이미 결정으로 취급되고 있고, 캐너리로
  고정하는 것은 선례와 정합한다
  - 확인: `3-schedule.md §4` 의 `ScheduleDto` 응답 형태 註는 동일한 §5.4 (b) 판정(*"소비자가
    부재를 정상 경로로 다룬다"*)을 근거로 들며 *"e2e 가 네 응답 형태를 **양성 3 + 생성 음성
    대조 1** 로 고정한다"* 고 이미 명문화·시행 중이다(`schedule-trigger.e2e-spec.ts`). 즉
    "create 응답에만 부재 → 이를 e2e 캐너리로 고정"은 트리거 축에서 처음 시도되는 방식이
    아니라 **자매 축이 이미 채택한 처리 방식을 그대로 미러링**하는 것이다.
  - 부가 확인: `codebase/frontend/src/lib/api/triggers.ts` 의 `create()` 도 스케줄 쪽과
    동일하게 `Promise<void>` 로 응답 바디를 버린다 — 즉 프런트엔드가 create 응답의 `workflow`
    부재를 실제로 소비하지도 않는다는, 스케줄 축 Rationale 의 "보강" 근거와 같은 조건이
    트리거 축에도 성립한다. 다만 스케줄 축 문서는 이 사실을 "재검토 신호"(optimistic
    update 등으로 소비가 시작되면 전제가 무너진다)로 명시하는데, 트리거 축 §3 문단에는 이
    대응 캐비아트가 없다 — T-4 spec 정정 시(위 planner 턴에서) 같은 재검토 신호 한 줄을
    같이 적어주면 두 축의 문서 무게가 맞는다(강제 사항은 아님, INFO 성격).

- **[없음 — 확인 완료]** `2-trigger-list.md`/`6-websocket-protocol.md` Rationale 재개봉 없음
  - `2-trigger-list.md` Rationale 전항(R-1~R-16: workflowId v1 lock, isActive 단일 PATCH 경로,
    authConfigId v1 inline 필드 제거, Chat Channel 카드 분리 등)을 전수 확인했으나 계획서가
    건드리는 범위(`TriggerDto.workflow` 캐너리, 테스트 파일 신설, §3 문장 1곳)는 이들 결정
    중 어느 것도 재론하거나 뒤집지 않는다.
  - `6-websocket-protocol.md` Rationale(§3.3 채널 인가, breakpoint 로드맵 등)은 트리거의
    `workflow` 참조·§5.4 부재 표현과 접점이 없다 — 재개봉 대상 없음.

## 요약

가장 중대한 문제는 계획서 T-4 가 `CLAUDE.md` §자기-반증형 소정정을 적용하려는 근거(조건 1
"developer 자신이 그 문서에 썼다")가 사실과 다르다는 점이다. 대상 문장은 `docs(spec)` 커밋으로
`--spec` 게이트를 거쳐 planner 소유 트래커(`spec-draft-nullable-notation-followups.md`,
`owner: planner`)에서 등재된 것이며, 같은 PR 체인의 직전 커밋(#1292)이 정확히 같은 패턴을
"조건 1 위반이니 우회하지 않고 planner 턴을 연다"로 올바르게 처리한 선례까지 남아 있다 —
이번 계획은 그 선례를 반대로 뒤집는다. 반면 나머지 세 가지 연속성 질문(자매 헬퍼 비일반화 +
User 투영 선례, `{id,name}`/`{name}` 비대칭 결정, "생성 응답에만 없다"의 계약화)은 전부 실제
이력·코드로 검증되며 계획서의 서술과 정확히 일치하거나(선례 인용) 자매 축이 이미 시행 중인
패턴을 그대로 따르는 것이어서(캐너리 고정) Rationale 연속성 관점에서 문제가 없다. 6-websocket
관련 재개봉도 없다.

## 위험도

CRITICAL
