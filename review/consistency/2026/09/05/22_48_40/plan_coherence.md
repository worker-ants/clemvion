# Plan 정합성 검토 — §5.4 스윕, `triggerToken` 스트립 반영 후 최신 상태

검토 대상: `sweep-response-contract-5ba0ad` 브랜치 전체 diff (`origin/main...HEAD`,
codebase 30파일). HEAD 최신 커밋은 `66a2510fd`(`fix(backend): §1.1 이 세 필드를 열거했는데
둘만 닫았다 — triggerToken 스트립`). target 문서 `spec/5-system/` 자체의 스코프 델타는
0(코드 전용 PR, 정상)이므로 `plan/in-progress/**` 의 진행 중 결정·후속 항목과 이 diff 가
정합한지를 중심으로 검토했다.

1차 SoT 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md`, 관련 자매 plan
`spec-draft-notification-secret-storage.md`(§7.1 정정 · `secret-store.md §1.1` 이 이
브랜치의 노출 차단 코드를 전제로 함) · `spec-draft-api-convention-verifier-registration.md`
(이미 `origin/main` 에 병합, `983fd0ade`/`21182db02`)를 직접 열어 교차 확인했다.

## 직전 라운드(`review/consistency/2026/09/05/22_25_00`) 대비 델타

직전 라운드는 커밋 `7e85da873` 까지를 검토해 **CRITICAL 1건(`triggerToken` 잔여 노출,
cross_spec) + WARNING 2건**(JSDoc 내부 경로 유출 · `TriggerDto.workflow` nav-spec 트래커
누락, plan_coherence 담당은 후자)으로 BLOCK 됐다. 이번 라운드가 다루는 신규 델타는 그
지적을 반영한 커밋 `66a2510fd` 하나다. 확인 결과:

- **plan_coherence WARNING(`TriggerDto.workflow` 트래커 누락)이 해소됐다** — 같은 커밋이
  `spec-draft-nullable-notation-followups.md` 를 함께 수정(+5줄)해, 기존
  `ScheduleDto.trigger/workflow` bullet(:768)을 `TriggerDto.workflow` 까지 포함하도록
  확장했다(:775-778, `22_25_00 W2` 로 출처 명기). 반영 대상 nav-spec 을
  `2-navigation/2-trigger-list.md` + `3-schedule.md §4` 둘로 명시했다 — 직전 라운드가
  제안한 조치와 정확히 일치한다.
- **cross_spec CRITICAL(`triggerToken` 노출)도 코드로 닫혔다** — `INTERACTION_RESPONSE_
  STRIP_KEYS = new Set(['triggerToken'])` 가 `sanitizeForResponse()` 에 추가돼
  `config.interaction.triggerToken` 을 스트립한다(`triggers.service.ts`). `secret-store.md
  §1.1` 이 이름으로 열거한 3필드(`notification_secret_v2`·`chat_channel_token_v2`·
  `triggerToken`)가 이제 전부 응답 경계에서 닫혔다.
- **convention_compliance WARNING(JSDoc 내부 경로 유출)도 해소** — `ScheduleDto.trigger`
  필드 `/** */` 에서 `review/consistency/... W1` 인용을 제거하고 `//` 내부 주석으로
  옮겼다(`schedule-response.dto.ts`).

## 발견사항

없음 — 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 셋 다 확인했으나 새로 발견된
항목이 없다. 구체적으로 확인한 것:

- **`spec-draft-notification-secret-storage.md`(별도 worktree `spec-notification-secret-
  storage-7768dd`)와 충돌 없음** — 그 plan 은 "저장 형태(평문)는 정상, 코드측 후속
  없음"과 별개로 "노출은 막아야 한다"는 축(`secret-store.md §1.1` 신설)을 세웠고, 그
  노출 차단 코드가 "이미 병행 브랜치(`sweep-response-contract-5ba0ad`)에 있다"고 명시하며
  "머지되면 닫는다"로 조건부 완료를 적어 두었다. `TRIGGER_RESPONSE_STRIP_COLUMNS` +
  `INTERACTION_RESPONSE_STRIP_KEYS` 도입이 정확히 그 코드다.
  - 그 plan 이 `4-integration.md §9.1` 반영을 "이 브랜치가 머지된 뒤"로 순서를 미뤄 둔
    것도, 이 브랜치의 `IntegrationDto` 5필드 선언(`mallId`·`tokenExpiresAt`·
    `lastRotatedAt`·`lastUsedAt`·`consecutiveNetworkFailures`)과 정확히 일치한다 — 이
    5필드가 diff 에 실제로 존재함을 직접 확인했다. 이것은 이 PR 이 지켜야 할 미해결
    결정이 아니라, 이 PR 이 **다른 plan 이 기다리는 선행 조건**을 충족하는 방향이다
    (developer 권한 밖 spec 반영은 그 plan 이 후속에서 처리).
- **`spec-draft-nullable-notation-followups.md` 와 충돌 없음** — `notificationSecretV2`/
  `chatChannelTokenV2` 를 "DTO 선언으로 해소하지 말 것 — 응답 스트립으로만 해소"라 남긴
  경고를 이 브랜치의 코드가 정확히 따른다(선언이 아니라 strip 상수 확장). §5.4 스윕
  잔여로 등재된 `CanvasSaveResultDto.nodes/edges` 타입 미선언, `IntegrationDto.
  consecutiveNetworkFailures` 노출 중단 검토, §5.4 스윕 2차(e2e 미도달 DTO) 등은 이
  diff 범위 밖으로 이미 별도 bullet 으로 정확히 분리돼 있다.
- **`spec-draft-api-convention-verifier-registration.md`(이미 `origin/main` 병합)와 충돌
  없음** — "리네임은 하지 않는다" 결정대로 `response-contract.ts`/`swagger-dto-contract-
  guard.ts` 에 `ContractViolation` 류 리네임이 없다. 그 plan 이 등재한 `code:` glob
  (`response-contract*.ts`·`swagger-probe*.ts`·`swagger-dto-contract*.ts`)이
  `spec/5-system/2-api-convention.md` frontmatter 에 이미 반영돼 있어, 이 diff 가 건드린
  파일 전부가 spec-linked 로 잡힌다(게이트 사각지대 없음).
- **다른 in-progress plan 과의 상호작용 없음** — `execution-engine-residual-gaps.md` ·
  `eia-terminal-payload.md` · `spec-sync-external-interaction-api-gaps.md` ·
  `cafe24-backlog-residual.md` 등 인접 도메인 plan 을 이 diff 가 건드리는 필드/함수명으로
  전수 검색했으나 겹치는 미해결 항목이 없었다(`spec-sync-external-interaction-api-gaps.md`
  의 `interaction.triggerToken` 저장 형태 항목은 **이미 2026-08-16 사용자 택일로 (b) 명시
  예외 등재로 종결**돼 있고, 이 브랜치는 저장 형태가 아니라 노출만 건드려 그 결정과
  직교한다).
- **함수 리네임에 따른 stale 참조 없음** — `sanitizeChatChannelForResponse` →
  `sanitizeForResponse` 리네임 이후 `plan/**`·`spec/**` 어디에도 옛 이름을 인용하는 자리가
  없다.
- **`AlertRuleDto`/`KnowledgeBaseDto` 신규 필드 선언**(createdBy·lastTriggeredAt·
  documentCount·rerankMode 등)은 `2-navigation/`·`data-flow/` 어디에도 응답 필드 단위로
  문서화된 자리가 없어(grep 0건), 이 선언-실측 정합 작업이 기존 spec 서술과 어긋나거나
  다른 plan 의 전제를 깨는 지점이 없다.

## 요약

이 브랜치는 여러 라운드에 걸쳐 plan 트래커(`spec-draft-nullable-notation-followups.md`)를
스스로 매우 꼼꼼히 갱신해 왔고, 직전 라운드(`22_25_00`)가 지적한 plan_coherence
WARNING(`TriggerDto.workflow` nav-spec 후속 누락)은 최신 커밋(`66a2510fd`)에서 정확히
해소됐다. 자매 plan(`spec-draft-notification-secret-storage.md`)이 이 브랜치의 병합을
전제로 건 두 항목(노출 차단 코드·`IntegrationDto` 5필드)도 diff 와 정확히 대응한다. 이번
라운드에서 새로 발견된 미해결 결정 우회·선행 plan 미해소·후속 항목 누락은 없다.

## 위험도

NONE
