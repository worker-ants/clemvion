# Plan 정합성 검토 — `spec/5-system/` (impl-done, diff-base `origin/main`)

## 조사 방법 메모

이 브랜치(`claude/sweep-response-contract-5ba0ad`)는 `spec/5-system/` 을 1줄도 바꾸지 않는
코드 전용 diff(31파일, `codebase/backend`)다. 따라서 "target 문서"는 정적이고, 실제로 정합성을
따져야 할 대상은 **이 diff 가 구현한 것과 `plan/in-progress/**` 가 기대·추적하는 것의 일치
여부**다. `_prompts/plan_coherence.md` 번들은 예산 절단으로 plan 본문 대부분이 생략돼 있어,
후보로 짚이는 항목은 워킹트리에서 원문을 직접 열어 확인했다(`Read` 절대경로 + `git log
origin/main..HEAD`, `git diff origin/main...HEAD -- codebase/`).

핵심 발견: 이 diff 는 **두 개의 다른 worktree 에서 진행된 planner 턴**
(`plan/in-progress/spec-draft-notification-secret-storage.md`,
`plan/in-progress/spec-draft-nullable-notation-followups.md`)이 "이 브랜치가 처리할 것"으로
명시적으로 위임·대기시킨 항목들과 **정확히 일치하는 코드**를 담고 있다. 즉 plan 이 앞서 세운
기대와 실제 구현이 맞아떨어지는, 드물게 잘 정렬된 사례다. 다만 병합 이후에만 실행 가능한
후속 planner 항목 몇 개가 남아 있어 INFO 로 기록한다.

---

## 발견사항

- **[INFO]** `secret-store.md §1` 의 "노출 창이 아직 닫혀 있지 않다" 서술이 이 브랜치 병합
  순간 stale 해진다 — 단, 이미 추적 중
  - target 위치: `spec/conventions/secret-store.md §1`(이 diff 는 건드리지 않음, origin/main
    에 이미 존재)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:797-805`
    ("`secret-store.md §1` 의 '노출 창이 아직 닫혀 있지 않다' 가 낡는다", planner,
    2026-09-05 등재, `review/consistency/2026/09/05/21_40_38` W2)
  - 상세: 이 문장은 직전 planner 턴이 직접 써 넣은 것이고, 그 턴 스스로 "`sweep-response-contract`
    브랜치가 바로 그 창을 닫는다"고 적어 두었다. 실측 확인: 이 diff 의
    `codebase/backend/src/modules/triggers/triggers.service.ts` 가
    `TRIGGER_RESPONSE_STRIP_COLUMNS = ['notificationSecretV2', 'chatChannelTokenV2']` 로
    실제로 응답 스트립을 구현했고(`triggers.service.spec.ts:267,303`,
    `schedules.controller.spec.ts:77,97` 의 `not.toHaveProperty` 로 회귀 테스트도 있음),
    e2e(`chat-channel-trigger-create.e2e-spec.ts`)도 이를 검증한다. 따라서 이 PR이 머지되면
    `secret-store.md §1`의 "노출 창 열림" 서술은 사실과 어긋난다.
  - 제안: 이 PR 자체의 조치는 불요(스코프 밖, 코드 전용 PR이 spec을 고칠 계약도 없음).
    plan이 이미 정확한 절차("이 창은 `#…`로 닫혔다"+커밋 참조를 §7.1 정정 이력 패턴으로
    추가, 규범 §1.1은 유지)를 세워 두었으니, **병합 직후 그 planner 턴이 실제로 집행되는지**
    integrator/후속 세션에서 확인만 하면 된다. 새로 만들 항목은 없음.

- **[INFO]** `4-integration.md §9.1` IntegrationDto 확장 필드 포인터 — 이 브랜치가 선행조건
  - target 위치: `spec/2-navigation/4-integration.md §9.1`(이 diff 범위 밖)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:768-773`,
    `plan/in-progress/spec-draft-notification-secret-storage.md:172-181`("선행 의존 — 그
    5필드 선언은 아직 `origin/main` 에 없다(`claude/sweep-response-contract-5ba0ad`). 그
    브랜치가 머지된 뒤에 반영한다")
  - 상세: 실측으로 확인 — 이 diff의 `integration-response.dto.ts`가 정확히 그 5필드
    (`mallId`·`tokenExpiresAt`·`lastRotatedAt`·`lastUsedAt`·`consecutiveNetworkFailures`,
    `appUrl` 포함 6필드)를 신규 선언한다. 두 plan 문서 모두 "이 브랜치 머지 후"를 트리거
    조건으로 명시해 두었으므로, 이 PR 자체가 그 선행조건을 충족시키는 쪽이지 위반하는 쪽이
    아니다.
  - 제안: 이 PR에서 조치 불요. 병합 후 두 plan의 §9.1 포인터 항목이 열릴 수 있음을
    integrator가 인지하면 충분.

- **[INFO]** 신규 래칫 fixture(`optional-nullable.fixture.ts`)가 아직 어떤 spec의 `code:`
  에도 걸리지 않음 — 이미 트래커에 planner 항목으로 등재됨
  - target 위치: `spec/5-system/2-api-convention.md` frontmatter `code:`(이 diff는 spec을
    건드리지 않으므로 미등재 상태 그대로 유지됨)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:781-795`
    ("§5.4 래칫 canary fixture 를 `code:` 에 등재", planner, 2026-09-05 등재,
    `review/consistency/2026/09/05/20_45_39` W1)
  - 상세: 이 diff가 신설한
    `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts`
    는 §5.4 금지 조합(`required:false`+`nullable:true`) 래칫의 양성 대조군이다. plan이 이미
    "가드 본체는 spec-linked ✓, fixture는 ✗"임을 게이트에 직접 물어 확인해 두었고, 처방
    (`2-api-convention.md` frontmatter에 `fixtures/**` glob 추가)도 적어 두었다. 이 fixture
    를 약화시키는 편집이 있어도 `--impl-done` 게이트가 재검토를 안 잡을 수 있다는 뜻인데,
    이는 이 PR의 결함이 아니라 **다음 planner 턴이 아직 안 왔을 뿐**이다.
  - 제안: 이 PR에서 조치 불요 — spec 쓰기는 `developer` 권한 밖이고 이미 planner 항목으로
    등재돼 있다. 새로 만들 항목 없음.

---

## 요약

이 브랜치의 diff(`spec/5-system/` 델타 0, 코드 31파일)는 두 개의 별도 worktree에서 진행된
planner 턴(notification-secret-storage, nullable-notation-followups)이 명시적으로 "이
브랜치가 처리할 것"으로 지목·대기시킨 항목들 — `notification_secret_v2`/
`chat_channel_token_v2`/`triggerToken` 응답 스트립, `IntegrationDto` 5필드 선언 — 을 정확히
구현했고, 각 plan 파일의 체크리스트도 같은 커밋들 안에서 동기화됐다(`git log`로 확인). 미해결
결정을 일방적으로 우회한 흔적, 선행 plan을 무시하고 진행한 흔적은 찾지 못했다. 남은 항목은
전부 "이 PR이 머지된 뒤에만 실행 가능한 후속 planner 턴"으로 이미 트래커에 등재돼 있어
(INFO 3건), 이 PR 자체가 새로 만들어야 할 plan 갱신은 없다.

## 위험도

LOW
