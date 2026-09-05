# Plan 정합성 검토 — `spec/5-system/` (impl-done, diff-base `origin/main`)

## 조사 방법 메모

이 브랜치(`claude/sweep-response-contract-5ba0ad`)는 `spec/5-system/` 을 1줄도 바꾸지 않는
코드 전용 diff다(`git diff origin/main...HEAD --stat -- spec/` 결과 0). 따라서 "target 문서"는
정적이고, 실제 정합성 판단 대상은 이 diff 가 구현한 것과 `plan/in-progress/**` 가 기대·추적하는
것의 일치 여부다. 번들(`_prompts/plan_coherence.md`)은 예산 절단으로 대부분 생략돼 있어,
`plan/in-progress/spec-draft-nullable-notation-followups.md`(전문 적재)와
`plan/in-progress/spec-draft-notification-secret-storage.md`(헤더만 적재 — 워킹트리에서
절대경로로 직접 Read)를 원문으로 확인했고, `git log origin/main..HEAD`·`git show <sha> --stat`
으로 실제 커밋 이력을 대조했다.

이 라운드는 직전 라운드(`review/consistency/2026/09/06/00_01_16`)의 바로 다음 커밋
(`e018a176f`, 00:24:27 — `sanitizeForResponse` 5책임 분해 + `chatChannel` 축 unit 커버리지 갭
수정 + `appUrl` JSDoc 정정)만 추가된 상태에서 열렸다. 그 커밋은 `spec/`·`plan/` 어느 것도
건드리지 않고(`git show e018a176f --stat` 확인), 코드 리뷰(`00_00_23`) WARNING 처분이라
plan 정합성 판단에 영향을 주는 새 사실을 만들지 않는다.

## 발견사항

- **[INFO]** `secret-store.md §1` 의 "노출 창이 아직 닫혀 있지 않다" 서술이 이 브랜치 병합
  순간 stale 해진다 — 이미 양쪽 plan 이 조건부로 추적 중, 이 PR 의 조치 불요
  - target 위치: `spec/conventions/secret-store.md §1`(이 diff 는 건드리지 않음, `origin/main`
    에 이미 존재)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md`
    ("`secret-store.md §1` 의 '노출 창이 아직 닫혀 있지 않다' 가 낡는다", planner, 2026-09-05
    등재, `review/consistency/2026/09/05/21_40_38` W2) ·
    `plan/in-progress/spec-draft-notification-secret-storage.md` §"`--spec` 2차 반영"
    ("유출을 닫는 코드 항목을 트래커에 등재… 머지되면 닫고, 아니면 백포트한다")
  - 상세: 이 문장은 별도 worktree 의 직전 planner 턴이 직접 써 넣은 것이고, 그 턴 스스로
    "`sweep-response-contract` 브랜치가 바로 그 창을 닫는다"고 적어 두었다. 실측 확인:
    `codebase/backend/src/modules/triggers/triggers.service.ts` 의
    `TRIGGER_RESPONSE_STRIP_COLUMNS = ['notificationSecretV2', 'chatChannelTokenV2']` (+
    `stripChatChannelSecrets`/`stripInteractionSecrets`/`stripNotificationSigningSecrets` 로
    분해된 나머지 세 축)가 실제로 응답 스트립을 구현했고, `triggers.service.spec.ts`·
    `schedules.controller.spec.ts` 의 `not.toHaveProperty` 회귀 테스트와
    `chat-channel-trigger-create.e2e-spec.ts` e2e 도 이를 검증한다. 즉 이 PR 이 머지되면
    `secret-store.md §1` 의 "노출 창 열림" 서술은 사실과 어긋나게 된다.
  - 제안: 이 PR 자체의 조치는 불요(코드 전용 PR 이 `spec/` 을 고칠 계약이 없음). 병합 직후
    "이 창은 `#…`로 닫혔다" + 커밋 참조를 §7.1 정정 이력 패턴으로 추가하는 후속 planner 턴이
    실제로 집행되는지 integrator/후속 세션에서 확인만 하면 된다.

- **[INFO]** `4-integration.md §9.1` `IntegrationDto` 확장 필드 포인터 — 이 브랜치가 선행조건을
  충족시켰다(위반이 아니라 완료 방향), 반영은 병합 후 planner 턴
  - target 위치: `spec/2-navigation/4-integration.md §9.1`(이 diff 범위 밖)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md`
    ("`4-integration.md §9.1` — `IntegrationDto` 확장 필드 포인터", planner, `19_08_19` W3 /
    `19_59_16` W3) · `plan/in-progress/spec-draft-notification-secret-storage.md` §③
    ("선행 의존 — 그 5필드 선언은 아직 `origin/main` 에 없다(`claude/sweep-response-contract-
    5ba0ad`). 그 브랜치가 머지된 뒤에 반영한다")
  - 상세: 실측 확인 — `integration-response.dto.ts`(이 diff, +51줄)가 정확히 그 5필드
    (`mallId`·`tokenExpiresAt`·`lastRotatedAt`·`lastUsedAt`·`consecutiveNetworkFailures`,
    `appUrl` 포함 6필드)를 신규 선언한다. 마지막 커밋(`e018a176f`)은 그중 `appUrl` 의 JSDoc
    설명을 "cafe24 전용" → cafe24+makeshop 양쪽을 반영하도록 정정했는데, 스펙 §9.1 은 이미
    그 두 갈래를 옳게 적고 있었다고 커밋 메시지가 확인한다 — 코드 설명만 낡아 있었을 뿐 spec
    과의 새로운 불일치는 만들지 않았다. 두 plan 문서 모두 "이 브랜치 머지 후"를 트리거
    조건으로 명시해 두었으므로, 이 PR 자체가 그 선행조건을 충족시키는 쪽이지 위반하는 쪽이
    아니다.
  - 제안: 이 PR 에서 조치 불요. 병합 후 두 plan 의 §9.1 포인터 항목이 열릴 수 있음을
    integrator 가 인지하면 충분.

- **[INFO]** 신규 래칫 fixture(`optional-nullable.fixture.ts`)가 아직 어떤 spec 의 `code:`
  에도 걸리지 않음 — 이미 트래커에 planner 항목으로 등재됨, 이 PR 의 조치 불요
  - target 위치: `spec/5-system/2-api-convention.md` frontmatter `code:`(이 diff 는 spec 을
    건드리지 않으므로 미등재 상태 그대로 유지됨)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md`
    ("§5.4 래칫 canary fixture 를 `code:` 에 등재", planner, 2026-09-05 등재,
    `review/consistency/2026/09/05/20_45_39` W1)
  - 상세: 이 diff 가 신설한
    `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts`
    는 §5.4 금지 조합(`required:false`+`nullable:true`) 래칫의 양성 대조군이다. plan 은 이미
    "가드 본체는 spec-linked ✓, fixture 는 ✗" 임을 게이트에 직접 물어 확인해 두었고, 처방
    (`2-api-convention.md` frontmatter 에 `fixtures/**` glob 추가)도 적어 두었다. 이 fixture
    가 약화돼도 `--impl-done` 게이트가 재검토를 안 잡을 수 있다는 뜻이지만, 이는 이 PR 의
    결함이 아니라 **다음 planner 턴이 아직 안 왔을 뿐**이다.
  - 제안: 이 PR 에서 조치 불요 — `spec/` 쓰기는 `developer` 권한 밖이고 이미 planner 항목으로
    등재돼 있다.

미해결 결정과 충돌하는 것으로 볼 수 있는지 별도로 확인한 항목들(전부 충돌 없음, 결정을
우회하지 않고 열린 채로 둠):

- **"트리거 비밀 스트립을 deny-list 4벌에서 선언적 SoT 로"** (developer + 보안 판단, 아직
  `[ ]`) — `e018a176f` 가 `sanitizeForResponse` 를 다섯 개의 이름 있는 순수 함수로 분해했지만
  `@Sensitive()` 데코레이터 등 선언적 방식으로 전환하지는 않았다(`grep` 확인 — 신규
  `@Sensitive` 식별자 없음, 여전히 `TRIGGER_RESPONSE_STRIP_COLUMNS` 배열 + 함수형 분해).
  plan 이 이 결정을 developer+보안 판단이 필요한 별도 항목으로 열어 둔 채이고, 이 diff 는
  그 결정을 선점하지 않았다 — 일치.
- **"`User` 엔티티에 컬럼 수준 방어를 둘지 결정"** (아직 `[ ]`) — `git diff origin/main...HEAD
  -- codebase/backend/src/entities` 결과 0, `User` 엔티티는 이 diff 에서 변경되지 않았다 —
  미결정 항목을 우회하는 코드 없음.

## 요약

이 브랜치의 diff(`spec/5-system/` 델타 0, `codebase/backend` 위주 다수 파일)는 두 개의 별도
worktree 에서 진행된 planner 턴(`spec-draft-notification-secret-storage`,
`spec-draft-nullable-notation-followups`)이 "이 브랜치가 처리할 것"으로 명시적으로 위임·대기
시킨 항목들(트리거 회전 secret 응답 노출 차단, `IntegrationDto` 필드 선언 정합화, §5.4 drift
스윕 1차 확장) 및 그 항목들이 등재한 잔여 세부(deny-list→선언적 SoT 전환, `User` 컬럼 방어)를
건드리지 않고 열린 채로 남긴 두 미결정 항목과 정확히 일치하게 동작한다. 직전 라운드
(`00_01_16`) 이후 추가된 유일한 커밋(`e018a176f`)은 코드 리뷰 WARNING 처분(unit 커버리지 갭
수정 + 낡은 JSDoc 정정)이며 `spec/`·`plan/` 어느 것도 건드리지 않아 이전 판정을 바꾸지 않는다.
미해결 결정을 일방적으로 우회한 흔적, 선행 plan 을 무시하고 진행한 흔적은 찾지 못했다. 남은
항목은 전부 "이 PR 이 머지된 뒤에만 실행 가능한 후속 planner 턴"으로 이미 트래커에 등재돼
있어(INFO 3건), 이 PR 자체가 새로 만들어야 할 plan 갱신은 없다.

## 위험도

LOW
