# Plan 정합성 검토 — `spec/2-navigation/` (impl-done, diff-base=origin/main)

## 검토 대상 요약

이 브랜치(`trigger-workflow-ref-canary-96ae33`)의 실제 diff 는 `spec/2-navigation/` 을
전혀 건드리지 않는다 — 신규 파일 3개(`codebase/backend/src/shared/testing/trigger-workflow-ref.ts`,
그 `.spec.ts`, `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`, 총 420줄)뿐이고
전부 backend 테스트/헬퍼다. `spec/2-navigation` 델타 0은 정상이다.

이 작업의 plan 문서는 이미 `plan/complete/trigger-workflow-ref-canary.md`(status: complete,
owner: developer, spec_impact: none)로 이관돼 있고, 출처인
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 단일 항목으로 등재돼 있었다.
두 문서를 직접 열어 대조했다.

## 발견사항

- **[INFO]** 캐너리 착지로 `2-trigger-list.md §3` 의 비대칭 서술이 일시적으로 낡지만, 이미 planner 후속으로 추적 중
  - target 위치: `spec/2-navigation/2-trigger-list.md:182` — *"자매 스케줄 축과 달리 이 축에는
    캐너리가 아직 없다 — 그쪽은 네 응답 형태를 양성/음성으로 고정한다. 보장을 구현보다 넓게
    적지 않기 위해 이 비대칭을 함께 적는다."*
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:1798`
    (실제 파일 직접 확인, 그대로 `[ ]` 미체크) — **"planner: 캐너리 착지 후속 4건 (한 턴으로
    묶임)"**. 4개 항목 중 특히:
    - #1 `2-trigger-list.md §3` 위 문장을 취소선+실측으로 정정 (비대칭이 이 PR 로 해소됐으므로)
    - #2 `2-trigger-list.md` frontmatter `code:` 에 `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 등재 (실측: 현재 frontmatter `code:` 에 없음, 직접 확인)
    - #3 `PROJECT.md` §e2e 파일 위치 규칙에 "self-spec 동반 헬퍼는 `test/helpers/` 가 아니라
      `src/shared/testing/`" 한 줄 (실측: `PROJECT.md:315` 는 아직 "신규 헬퍼:
      `codebase/backend/test/helpers/<name>.ts`" 만 적고 있음, 예외 없음)
    - #4 캐너리가 고정하는 것이 계약(§5.4)이 아니라 구현 반영이라는 점을 §3 註에 명시
  - 상세: `plan/complete/trigger-workflow-ref-canary.md` 자신이 이 사실을 정확히 인지하고
    있다 — T-4(spec 문장 정정)를 이 PR 에서 **의도적으로 빼내** planner 후속으로 이관했다
    (자기-반증형 소정정 조건 1 불성립: 그 문장을 쓴 것은 developer 가 아니라 planner 였음을
    diff 스코프·게이트 종류·plan owner 세 신호로 확인). 즉 이것은 누락이 아니라 governance
    규칙(`CLAUDE.md` "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임")을
    따른 **의도적 2-PR 분리**이고, 후속 4건은 이미 정확한 위치(`spec-draft-nullable-notation-followups.md`)에 planner 소유로 등재돼 있다. `2-trigger-list.md` frontmatter `pending_plans:` 도
    이미 그 문서를 정확히 가리킨다. 다른 in-progress plan 에 `trigger-workflow-ref` 관련 중복·
    상충 등재는 없음(`grep -rl` 로 전수 확인, 1개 파일만 매치).
    실질적 효과는 **일시적 진실성 창(truthfulness window)**이다 — 이 PR 이 머지되는 순간부터
    후속 planner 턴이 착지하기 전까지, §3 의 "캐너리가 아직 없다" 는 문장은 실제로는 거짓이
    된다(캐너리가 이미 존재하므로). Plan 자체는 이 창을 숨기지 않고 명시적으로 적어 뒀다.
  - 제안: plan (already correct) 을 갱신할 필요는 없다 — 이미 정확히 추적됨. 다만
    `spec-draft-nullable-notation-followups.md` 의 해당 planner 후속 4건을 **머지 직후
    우선순위 높게** 처리할 것을 권고한다. 그래야 위 진실성 창이 최소화된다.

- **[INFO]** 별도 트랙된 CRITICAL(bot token PATCH 우회)은 이 diff 범위 밖으로 정확히 분리됨
  - target 위치: 해당 없음(이 diff 는 `triggers.service.ts` 를 건드리지 않음)
  - 관련 plan: `spec-draft-nullable-notation-followups.md` "CRITICAL: chatChannel PATCH 가
    bot token single-path 를 우회한다" (판정: 예, developer 수정 대기)
  - 상세: 이 항목은 이 캐너리 작업 중 부수 발견됐고, "이 diff(테스트 3파일)가 그 코드를
    건드리지 않는다" 는 이유로 명시적으로 이 PR 밖으로 분리·기록됐다. 충돌이나 우회가 아니라
    올바른 스코프 분리다.
  - 제안: 조치 불필요 — 정보성 확인.

## 요약

이 브랜치는 `spec/2-navigation/` 을 변경하지 않는 순수 backend 테스트 추가(캐너리)이며,
자신의 plan(`plan/complete/trigger-workflow-ref-canary.md`)이 spec 쪽 후속 작업 4건을
developer 권한 밖이라는 이유로 명시적으로 별도 planner 턴(`spec-draft-nullable-notation-followups.md`,
현재 미체크)으로 넘긴 것을 직접 대조 확인했다. 이는 governance 경계를 우회한 것이 아니라
정확히 지킨 사례이며, 미해결 결정과의 충돌이나 선행 plan 미해소는 없다. 유일한 잔여 사항은
"캐너리가 이미 섰다"는 사실과 "spec §3 는 아직 캐너리가 없다고 적고 있다"는 문서 상태 사이의
일시적 비정합인데, plan 이 이를 이미 인지·등재했으므로 새로 만들 항목은 없고 신속한 후속 처리를
권고하는 INFO 로 충분하다.

## 위험도

LOW

STATUS: success
