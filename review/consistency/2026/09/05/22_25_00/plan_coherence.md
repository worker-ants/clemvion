# Plan 정합성 검토 — §5.4 스윕 5라운드 (계약 대조를 목록·PATCH 로 넓히자 drift 2건)

검토 대상: HEAD 최신 커밋 `7e85da873`(fix(backend): 계약 대조를 목록·PATCH 로 넓히자 drift
2건이 나왔다) 및 그 이전 `sweep-response-contract-5ba0ad` 브랜치 전체 diff
(`origin/main...HEAD`, codebase 30파일/1857줄). target 문서 `spec/5-system/` 자체의 스코프
델타는 0(코드 전용 PR, 정상)이므로 `plan/in-progress/**` 의 진행 중 결정·후속 항목과 이
diff 가 정합한지를 중심으로 검토했다.

이전 라운드(`review/consistency/2026/09/05/21_40_38`)는 커밋 `67881bbd4` 까지를 검토해
"발견사항 없음"으로 닫았다. 이번 라운드가 다루는 **신규 델타는 그 다음 커밋
`7e85da873` 하나**다 — 이 커밋은 직전 라운드가 지적한 W1/W2 에 대한 응답이자, `--ai-review
21_40_37` 지적을 따라 계약 대조를 목록(`GET /api/triggers`)·PATCH(`PATCH /api/triggers/:id`)
경로로 넓히자 실제로 발견한 결함 2건(`workflow` undeclared · PATCH `name` missing)의
수정이다.

1차 SoT 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md`, 관련 자매
plan `spec-draft-notification-secret-storage.md`(§7.1 정정·secret-store.md §1.1 이
이 브랜치의 노출 차단 코드를 전제로 함) · `spec-draft-api-convention-verifier-registration.md`
(이미 `origin/main` 에 병합됨, `983fd0ade`/`21182db02`)를 교차 확인했다.

## 발견사항

- **[WARNING]** 신규 key-omission 필드 `TriggerDto.workflow` 가 nav-spec 문서화 후속
  트래커에서 빠졌다
  - target 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`
    (`TriggerWorkflowRefDto` 신설 + `TriggerDto.workflow?: TriggerWorkflowRefDto`, 커밋
    `7e85da873`). JSDoc 원문: *"연결된 워크플로우 — **키 생략형**이다 (§5.4 기준 (b))."*
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
    `- [ ] **ScheduleDto.trigger/workflow 를 nav-spec 에 문서화** (planner, 2026-09-05
    등재, 21_40_38 W1)` 항목 (같은 커밋 `7e85da873` 이 이 bullet 을 신설했다).
  - 상세: `spec/5-system/2-api-convention.md §5.4` 는 *"키 생략은 (a)/(b) 중 하나에
    해당할 때만 쓰고, **그 필드를 문서화하는 절에 사유를 명시**한다"* 를 요구하고,
    소급 적용 예외는 "이미 문서화된" 필드에 한정된다 — 이번에 신규 도입된 필드는
    그 예외에 해당하지 않는다. 같은 커밋(`7e85da873`)이 **동일한 성격의 키 생략 필드
    두 개**를 만들었다: `ScheduleTriggerRefDto.workflow`(스케줄 응답에 동봉되는 트리거
    참조 안의 workflow) 와 `TriggerWorkflowRefDto`(`TriggerDto.workflow`, 트리거 자신의
    응답에 동봉되는 워크플로우 참조). 커밋은 전자에 대해서만 nav-spec 후속 bullet
    (`ScheduleDto.trigger/workflow`)을 등재했고, 후자(`TriggerDto.workflow`)는 코드
    JSDoc 에만 사유가 적혀 있을 뿐 어떤 plan 항목에도 등재되지 않았다. 대상 nav-spec
    문서(`spec/2-navigation/2-trigger-list.md`)를 실측했으나 `workflow`(name-only 파생
    참조) 필드에 대한 서술은 없다(§2.3.1 필드 권한 매트릭스는 `workflowId` 만 다룬다).
    두 필드는 같은 §5.4 (b) 근거·같은 커밋·같은 처방(참조 DTO로 좁히기)을 공유하므로
    한쪽만 트래킹되면 다음에 이 항목을 여는 사람이 `TriggerDto.workflow` 존재 자체를
    놓칠 위험이 크다(플랜의 "부재 = 없음의 근거 아님" 원칙이 그대로 재현된다).
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 해당 bullet
    제목·본문을 `TriggerDto.workflow` 까지 포함하도록 갱신(예: 제목을 `TriggerDto`/
    `ScheduleDto` 의 `trigger`/`workflow` 참조 필드를 nav-spec 에 문서화" 로 확장)하거나,
    별도 bullet 을 신설해 두 필드를 함께 nav-spec(`2-trigger-list.md` §2.3 상세 카드 또는
    §2.3.1 매트릭스, `3-schedule.md §4`)에 반영하도록 등재한다. developer 권한으로 코드는
    끝났으므로 planner 턴에서 처리될 항목이지만, **트래커 등재 자체**는 이번 커밋에서
    developer 가 놓친 부분이라 지금 보완 가능하다.

이 외에는 발견사항 없음. 구체적으로 확인한 것:

- **결정 우회 없음** — `plan/in-progress/spec-draft-nullable-notation-followups.md` 가
  명시적으로 남긴 경고("`TriggerDto`/`ScheduleDto` 에 도달하면 주의 —
  `notificationSecretV2`/`chatChannelTokenV2` 를 **DTO 선언으로 해소하지 말 것**, RED 는
  응답 스트립으로만 해소")를 이 브랜치의 코드(`TRIGGER_RESPONSE_STRIP_COLUMNS` +
  스케줄 컨트롤러 `toResponse` 좁히기)가 정확히 따른다 — 선언 대신 스트립을 택했다.
- **`spec-draft-api-convention-verifier-registration.md`** (이미 `origin/main` 에 병합,
  `21182db02`)의 "리네임은 하지 않는다" 결정과 충돌 없음 — `response-contract.ts` diff 에
  `ContractViolation` 등 타입 리네임 없음, 메모이제이션만 추가.
  - `spec/conventions/secret-store.md §1.1`(응답 노출 금지 규범)도 이미 `origin/main` 에
    있다(`spec/conventions/secret-store.md:86`) — 이 브랜치의 코드 주석이 인용하는 규범은
    미해결이 아니라 이미 확정된 것이다.
- **`spec-draft-notification-secret-storage.md`**(별도 worktree `spec-notification-secret-
  storage-7768dd` 소유, planner)와의 관계 — 그 plan 은 "저장 형태(평문)는 정상이며 코드측
  후속이 없다"는 결정과 별개로 "**노출 창은 아직 안 닫혔다**"는 별도 축을 인정하고, 그
  노출을 닫는 코드가 **"이미 병행 브랜치(`sweep-response-contract-5ba0ad`)에 있다"**
  고 명시하며 "머지되면 닫는다"로 조건부 완료를 적어 두었다. 이 브랜치의
  `TRIGGER_RESPONSE_STRIP_COLUMNS` 도입이 정확히 그 코드다 — 충돌이 아니라 그 plan이
  기대하는 선행 조건의 이행이다. 그 plan 이 `4-integration.md §9.1` 반영을 "이 브랜치가
  머지된 뒤" 로 명시적으로 순서를 미뤄 둔 것도 이 브랜치의 `IntegrationDto` 5필드
  선언(`mallId`·`tokenExpiresAt`·`lastRotatedAt`·`lastUsedAt`·`consecutiveNetworkFailures`)
  과 정확히 일치한다(다만 `appUrl` 필드는 같은 이유로 함께 선언됐지만 그 plan 의 5필드
  목록엔 없다 — 사소한 열거 누락이며 머지 후 planner 가 실제 diff 를 보고 반영할 자리라
  별도 항목으로 올릴 정도는 아니다).
- **다른 in-progress plan 과의 상호작용 없음** — `eia-terminal-payload.md` ·
  `spec-sync-external-interaction-api-gaps.md` 등 인접 도메인(EIA/notification) plan 을
  `notification_secret_v2`/`TriggerDto`/`ScheduleDto`/`response-contract` 키워드로 전수
  검색했으나 이 브랜치가 건드리는 것과 겹치는 미해결 항목은 없었다(유일한 매치는
  `spec-sync-external-interaction-api-gaps.md` 의 이미 완료된 §8.2 HMAC 화이트리스트
  항목, 무관).
- **함수 리네임에 따른 stale 참조 없음** — `sanitizeChatChannelForResponse` →
  `sanitizeForResponse` 리네임 이후, `plan/**`·`spec/**` 어디에도 옛 이름을 인용하는
  자리가 없다(전수 grep 0건).

## 요약

이 브랜치는 여러 라운드에 걸쳐 plan 트래커(`spec-draft-nullable-notation-followups.md`)를
스스로 매우 꼼꼼히 갱신해 왔고, 직전 두 라운드가 지적한 항목들도 순차 해소됐다. 이번
라운드가 새로 다루는 커밋(`7e85da873`)에서도 미해결 결정 우회나 선행 plan 미해소는
없었으며, `notification_secret_v2`/`chatChannelTokenV2` 노출 차단이라는 자매 plan
(`spec-draft-notification-secret-storage.md`)의 명시적 선행 조건을 정확히 이행했다. 다만
같은 커밋이 새로 만든 §5.4 key-omission 필드 하나(`TriggerDto.workflow`)가, 그 커밋이
직접 신설한 nav-spec 문서화 후속 트래커 항목의 범위에서 빠져 있다 — 자매 필드
(`ScheduleDto.trigger.workflow`)는 등재됐는데 짝이 누락된 형태라 다음 사람이 놓치기 쉬운
전형적인 "후속 항목 누락" 이다. 이 한 건을 제외하면 plan 정합성 관점에서 이 브랜치는
건강하다.

## 위험도

LOW
