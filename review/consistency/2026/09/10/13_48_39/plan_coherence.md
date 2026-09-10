STATUS: success

# Plan 정합성 검토 — `trigger-workflow-ref-canary.md` (--impl-prep, scope=spec/2-navigation/)

## 발견사항

- **[CRITICAL]** T-4 의 자기-반증형 소정정 조건 1("developer 자신이 그 문서에 썼다")이 사실과 다르다 — 정정 대상 문장은 **planner 가 썼다**
  - target 위치: `plan/in-progress/trigger-workflow-ref-canary.md` §T-4 조건표, 1행 —
    `| 1. developer 자신이 그 문서에 썼다 | ✅ #1304 (\`git blame\` 으로 확인 가능) |`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 종결 대상 항목
    (등재 2026-09-10, "TriggerDto.workflow 의 '생성 응답에만 부재' 를 캐너리로 고정") 자신이
    이미 이 지점을 지적해 두었다 — *"그리고 `spec/2-navigation/2-trigger-list.md §3` 註가
    …고 적고 있으니, 캐너리를 세우면 그 문장도 함께 정정해야 한다(자기-반증형 소정정 조건
    1~5 해당 — **그 문장은 planner 가 썼으므로** planner 턴이거나 `--impl-done` 스코프로
    훑는다)."*
  - 상세: 3중으로 교차검증했다.
    1. `git blame -L 178,188 spec/2-navigation/2-trigger-list.md` → 정정 대상 문장
       ("자매 스케줄 축과 달리 이 축에는 캐너리가 아직 없다") 전체 단락이 커밋 `dc77317cd4`
       (#1304, 2026-09-10 11:51)에서 한 번에 들어갔다.
    2. `dc77317cd4` 의 `--name-only` 는 `spec/2-navigation/{2-trigger-list,3-schedule}.md` ·
       `plan/complete/spec-draft-schedule-trigger-ref-nav.md` · `plan/in-progress/*` ·
       `review/**` 만 건드린다 — **`codebase/**` 는 0건**. 이 저장소 관행상 순수 `spec/`
       변경은 project-planner 소관이다(`CLAUDE.md` "spec/ 변경 → project-planner").
    3. 그 커밋을 만든 plan `plan/complete/spec-draft-schedule-trigger-ref-nav.md` 의
       frontmatter 가 `owner: planner` 이고 제목이 *"(planner 턴)"* 이라고 명시한다 — 결정적
       증거.
    - 추가로: developer 가 이전에 (#1291, `bfa124920`) 같은 DTO 필드에 실제로 쓴 JSDoc
      (`codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:95-99`)은
      *"생성 응답에만 없다"* 까지만 적었고, "캐너리가 아직 없다" 는 관측은 **그 JSDoc 에
      없다** — #1304 가 nav-spec 으로 옮기며 **새로 추가한 문장**이다. 즉 "developer 가 이전에
      다른 곳에 쓴 걸 planner 가 옮겼을 뿐" 이라는 완화 해석도 성립하지 않는다.
    - `CLAUDE.md` §자기-반증형 소정정은 다섯 조건을 **전부** 충족해야 한다고 명시한다
      ("아래 **다섯 조건을 전부** 충족해야 한다"). 조건 1 이 거짓이면 예외 전체가
      성립하지 않고, 원칙("구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner
      위임")으로 되돌아간다.
  - 제안: target plan 을 갱신 — T-4 를 "developer 가 `--impl-done` 스코프로 직접 정정"에서
    "project-planner 턴으로 위임" 으로 바꾸거나, 최소한 조건표 1행을 정직하게 ❌ 로 고치고
    자기-반증형 소정정이 적용되지 않음을 명시해야 한다. `spec_impact` 에 spec 파일을 올려
    두고 developer 소유 plan 이 직접 편집하는 현재 설계는 이 조건이 참일 때만 정당화되므로,
    조건이 무너지면 그 frontmatter 항목 자체의 근거도 함께 무너진다. 등재 트래커
    (`spec-draft-nullable-notation-followups.md`) 가 이미 이 갈림길을 적어 두었으니, 병합
    시점에 developer 턴이 "impl-done 스코프로 훑는다" 쪽으로 임의로 정착한 것으로 보인다 —
    그 선택 근거(조건 1)가 사실이 아니므로 재검토가 필요하다.

- **[WARNING]** `webhook-trigger.e2e-spec.ts` 의 `it()` 개수 재실측 — 19개가 아니라 **18개** (경미한 과대 서술 재발)
  - target 위치: `plan/in-progress/trigger-workflow-ref-canary.md` §"① 'webhook-trigger.e2e-spec.ts 에 건다' — 그 파일에는 걸 자리가 없다" — *"그 파일은 webhook 수신 경로 전용이다 — `it()` **19개**가 202/404/401/409/410/413 과 AuthConfig 4종을 다루고…"*
  - 관련 plan: 없음(target 자체의 실측 오류) — 단 `spec-draft-nullable-notation-followups.md`
    의 이력이 "실측했다" 류 과대서술 재발을 두 항목 연속 지적한 바 있다(작업 지시문의 "that
    happened on the last two items").
  - 상세: `grep -n "^\s*it(" codebase/backend/test/webhook-trigger.e2e-spec.ts | wc -l` → **18**.
    나열된 라벨(A, A2, B, B2, B4, B3, C, D, E, J, K, L, M, N, F, G, H, I)도 18개다. 다루는
    상태 코드(202/404/401/409/410/413)와 AuthConfig 4종(bearer/hmac/api_key/basic_auth)
    분류 자체는 정확하다 — 개수만 하나 많게 적었다.
  - 제안: 이 파일이 "걸 자리 없음"이라는 **결론**에는 영향이 없다(그 결론은 별도로 검증
    완료 — 아래 참고). 다만 같은 문서 안에서 다시 나타난 계수 오류이므로, target 의 "실측"
    표기 신뢰도를 낮춘다. 커밋 전에 18로 정정 권고(WARNING 이지 CRITICAL 은 아님 — 결론에
    영향 없는 오탈자성 계수 오류).

## 검증 완료 (결함 아님, 참고용 기록)

- **① "그 파일에는 걸 자리가 없다"는 참이다.** `webhook-trigger.e2e-spec.ts` 에는 GET
  목록·GET 단건·PATCH(일반) 테스트가 없다. 유일한 PATCH(`:293`)는 410 테스트 전 트리거를
  `isActive:false` 로 바꾸는 준비 동작이 맞다. 표에 적힌 세 위치도 실측과 일치했다 — GET
  목록 `schedule-trigger.e2e-spec.ts:248-249`(`?type=schedule&limit=100`), PATCH(isActive)
  `schedule-trigger.e2e-spec.ts:373`·`407`, GET 단건
  `chat-channel-trigger-create.e2e-spec.ts:126-127`.
- **② "얹으면 세트가 안 보인다"는 반증 가능한 주장은 아니지만(가독성 판단) 전제 사실은
  참이다.** `schedule-trigger.e2e-spec.ts` 는 실제로 네 단언을 한 파일 안에 모아 두고 있다
  (목록:257 `assertMatchesContract(row, contractForDto(TriggerDto))`, PATCH 양성:297
  `expectNarrowedScheduleTriggerRef(..., {withWorkflow:true})` 등). 신설 파일 접근이 그
  선례를 그대로 따른다는 서술도 사실에 부합한다.
- **`jest-e2e.json` 배선 불필요 주장** — `testRegex: ".e2e-spec.ts$"` 확인, 정확하다.
- **"chatChannel 을 PATCH 바디로 보내는 e2e 0건" / "relations:['workflow'] 를 단언하는
  테스트 0건(무관 fixture 제외)"** — 둘 다 grep 재실측으로 확인, 정확하다.
- **schedule-trigger.e2e-spec.ts 와의 충돌·중복 없음.** 두 축은 서로 다른 코드 경로를
  테스트한다 — `schedules.service.ts` 는 자신만의 독립 쿼리를 갖는다(`:82-83`
  `leftJoinAndSelect('s.trigger')/('t.workflow')`, `:129`
  `relations: ['trigger', 'trigger.workflow']`). 이 canary 가 겨냥하는 회귀 지점은
  `triggers.service.ts:550` 의 PATCH-chatChannel 재조회 전용 `relations: ['workflow']` 이며,
  `schedules.service.ts` 경로와는 별개다 — 하나가 깨져도 다른 하나가 자동으로 못 잡는다.
  즉 "두 곳에 흩어진 것처럼 보이는 자매 헬퍼"는 실제로는 **서로 다른 회귀를 각자 잡는
  분리된 캐너리**이고, target 문서(T-1)가 이를 명시적으로 인지하고 통합을 거부한 근거
  (`User` 투영 상수 선례)도 타당하다. "두 곳을 동기화해야 한다"는 우려는 낮다 — INFO 수준.
- **다른 in-progress plan 과의 충돌 없음.**
  - `chat-channel-discord-gateway.md`/`chat-channel-slack-socket-mode.md` 는 둘 다
    `status: backlog`, `worktree: (unstarted)`, "사용자 결정 필요" 진입 조건 미충족 상태다.
    v2 Gateway/Socket Mode 기능 자체를 다루며 `triggers.service.ts update()`/
    `setupChatChannel` PATCH 경로는 건드리지 않는다.
  - `eia-context-schema-followups.md`/`spec-draft-eia-notification-payload-contract.md` 의
    `chatChannel` 언급은 **outbound notification envelope 유출**(`attachRoutingContext`)
    문제로, 트리거 PATCH `setupChatChannel` 경로와는 무관한 별개의 `chatChannel` 개념이다.
  - `shared/testing/` 을 언급하는 다른 plan(`auth-guard-reflection-hardening.md`,
    `eia-context-schema-followups.md`, `spec-sync-external-interaction-api-gaps.md`)은
    각각 `pg-error-fixtures.ts`/`swagger-probe.ts`/`response-contract.ts` 를 다루며 신설
    파일명(`trigger-workflow-ref.ts`/`.spec.ts`)과 겹치지 않는다.
  - `2-trigger-list.md §3` 을 겨냥하는 다른 활성 plan 없음(단, `spec-sync-auth-gaps.md` 가
    같은 파일의 다른 위치를 줄 번호로 인용하는데 — 아래 INFO 참고).
- **Gate C**: `spec/2-navigation/2-trigger-list.md` 존재 확인. `spec_impact` 는 YAML
  리스트 형식(단일 원소)이라 형식은 유효하다. 두 번째 spec 파일(`3-schedule.md`)은 편집
  대상이 아니며 — 그쪽 워크플로우 참조 사유는 이미 자매 plan `spec-draft-schedule-trigger-ref-nav.md`
  (planner 턴, complete)에서 별도로 닫혔으므로 이 canary 가 다시 건드릴 이유가 없다는 점도
  맞다. 다만 "developer 소유 plan 이 spec_impact 를 갖는 것이 정당한가"는 위 CRITICAL 항목의
  전제(조건 1)가 무너지면 함께 무너진다.
- **"무엇을 하지 않나" 세 항목** — 다른 plan 이 소유한 미해결 결정과 겹치는지 확인했으나
  겹치지 않는다. (1) 기존 세 e2e 파일 통합/이관은 어떤 다른 plan 도 등재해 두지 않았다.
  (2) 스케줄 헬퍼 일반화 거부 — 다른 plan 도 일반화를 요구하지 않는다. (3)
  `hasBotToken`/`inboundSigningRef` 최신성 축 — `spec-draft-nullable-notation-followups.md`
  에 이 두 필드에 대한 **별개의 열린 결정**(마스킹 placeholder 문장 관련) 이 있으나, 그것은
  "회귀 테스트를 세워야 한다"는 결정이 아니라 문서 표현에 관한 별개 논점이라 이 canary 의
  defer 와 충돌하지 않는다.

## 요약

핵심 결함은 하나다 — target plan 이 `spec/2-navigation/2-trigger-list.md §3` 문장을
"자기-반증형 소정정" 예외로 developer 가 직접 고치겠다고 선언하면서, 그 예외의 전제조건
("developer 자신이 그 문서에 썼다")을 인용한 근거(#1304)로 뒷받침했는데 실측(git blame ·
커밋 diff 범위 · 자매 plan frontmatter `owner: planner`)은 정반대를 보여준다 — 그 문장은
project-planner 턴에서 새로 작성됐다. 이 canary 가 종결하려는 원 트래커 항목 자신이 이미
이 균열을 예견해 적어 두었는데("그 문장은 planner 가 썼으므로…"), 자식 plan 은 그 갈림길을
"developer 가 impl-done 스코프로 직접 훑는다" 쪽으로 조용히 정착시켰다. 이는 다섯 조건을
전부 요구하는 CLAUDE.md 규정과 정면으로 어긋나며, planner 턴을 우회하는 결과를 낳는다.
그 밖의 설계(전용 e2e 파일 신설, 자매 스케줄 축과의 비-중복, 다른 in-progress plan 과의
비-충돌, Gate C 형식)는 전부 실측 검증을 통과했고 — 유일한 흠은 `webhook-trigger.e2e-spec.ts`
`it()` 개수를 19로 적은 사소한 과대서술(실제 18)뿐이다.

## 위험도

CRITICAL
