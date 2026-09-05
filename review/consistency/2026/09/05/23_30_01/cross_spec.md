# Cross-Spec 일관성 검토 — sweep-response-contract-5ba0ad (--impl-done, scope=spec/5-system/)

## 전제 확인

- `spec/5-system/**` 자체는 이번 브랜치에서 델타 0 — 정상(코드 전용 PR).
- 실제 변경은 `codebase/backend` 응답 DTO 6종(schedules/triggers/integrations/knowledge-base/alerts) +
  `swagger-dto-contract-guard.ts`(§5.4 3번째 축 ratchet 신설) + `response-contract.ts` +
  다수 e2e 배선 + `plan/in-progress/spec-draft-nullable-notation-followups.md` 갱신, 총 31파일/약 1,490줄
  (`git diff --stat origin/main...HEAD -- codebase/ spec/ plan/`).
- 아래는 이 diff 를 target 인 `spec/5-system/2-api-convention.md §5.4`(및 그 §5.4 가 링크하는
  `spec/conventions/swagger.md §5-1`)와, 그리고 필드 값이 파생되는 타 영역
  (`spec/1-data-model.md`, `spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/4-integration.md`,
  `spec/2-navigation/3-schedule.md`, `spec/conventions/secret-store.md §1.1`, `spec/5-system/14-external-interaction-api.md`,
  `spec/5-system/15-chat-channel.md`)와 대조한 결과다.

## 발견사항

- **[INFO]** `ScheduleDto.trigger`/`ScheduleDto.trigger.workflow`/`TriggerDto.workflow` 키-생략 사유가 nav-spec 에 아직 미반영
  - target 위치: `spec/5-system/2-api-convention.md §5.4`("키 생략은 …그 필드를 문서화하는 절에 사유를 명시")
  - 충돌 대상: `spec/2-navigation/3-schedule.md §4`(API 표), `spec/2-navigation/2-trigger-list.md`
  - 상세: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` 와
    `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` 의 `workflow?:` 키-생략
    사유(§5.4 기준 (b))는 이번 diff 에서 **필드 JSDoc 에만** 적혔다. §5.4 는 "그 필드를 문서화하는 절"에
    사유를 두라고 요구하는데, 두 nav-spec 문서의 `## 4. API`/응답 섹션에는 아직 이 필드들 자체가
    등장하지 않는다 (`grep` 결과 0건). 실제 DTO 선언·wire 형태와 모순되는 것은 아니고 — 단지 SoT 분산이 아직
    완료 전이라는 뜻.
  - 제안: 이미 같은 브랜치의 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
    planner 후속 항목("`ScheduleDto.trigger`/`workflow` 를 nav-spec 에 문서화", `21_40_38` W1 / `22_25_00` W2)으로
    등재돼 있다 — 신규 항목 추가는 불필요, 그 항목을 중복 없이 그대로 진행할 것.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 신규 노출 필드가 `spec/2-navigation/4-integration.md §9.1`(응답 DTO 필드 설명)에 미등재
  - target 위치: `spec/5-system/2-api-convention.md §5.4`(선언과 실제 일치 요구)
  - 충돌 대상: `spec/2-navigation/4-integration.md §9.1`(현재 `appUrl`/`autoRefresh` derived 필드만 설명, `consecutiveNetworkFailures` 미언급)
  - 상세: 코드 diff 는 이 필드가 "이미 응답에 실려 나가고 있었다"(엔티티 패스스루)는 사실을 §5.4 기본형으로
    선언만 했을 뿐 — `data-model.md §2.10`(`consecutive_network_failures`)에는 DB 컬럼으로 존재하지만
    API 응답 필드로서 nav-spec 에 아직 없다. 코드 자체 모순은 아니다.
  - 제안: 동일 plan 파일에 "`IntegrationDto.consecutiveNetworkFailures` 노출 중단 검토" 항목으로 이미 열려 있다
    (developer, wire-breaking 이라 CHANGELOG 동반 필요) — 별도 처리 불필요.

- **[INFO]** §5.4 ratchet 양성 대조군 fixture 가 두 규약 문서의 `code:` glob 밖
  - target 위치: `spec/5-system/2-api-convention.md` frontmatter `code:` / `spec/conventions/swagger.md` frontmatter `code:`
  - 충돌 대상: 신규 파일 `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts`
    (이번 diff 의 `optional-nullable.fixture.ts` 31줄 추가분)
  - 상세: 두 문서 모두 `code:` 에 `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts` 만
    등재돼 있고(직접 확인, `sed -n` 결과), `*` 는 `/` 를 넘지 않으므로 `__tests__/fixtures/dto/responses/…` 는
    매치되지 않는다. fixture 가 없으면 ratchet 술어가 죽어도 그린이 나온다는 위험은 코드 diff 자체가 이미
    자기 인지하고 있다.
  - 제안: plan 파일에 "§5.4 래칫 canary fixture 를 `code:` 에 등재"(planner, `20_45_39` W1)로 이미 열려 있음 —
    다음 planner 턴에서 두 문서 `code:` 에 `codebase/backend/src/repo-guards/__tests__/fixtures/**` 추가.

## 정합성 확인(충돌 없음으로 판정한 항목 — 반증 근거)

교차 검증한 결과 실질적 CRITICAL/WARNING 은 없었다. 근거:

- `Schedule.trigger_id NOT NULL 1:1` 이라는 코드 주석 주장은 `spec/1-data-model.md §2.9.1`
  ("Schedule.trigger_id는 NOT NULL — 반드시 Trigger와 1:1 매핑")과 정확히 일치.
- `AlertRuleDto.createdBy`/`lastTriggeredAt`, `IntegrationDto.appUrl`/`mallId`/`tokenExpiresAt`/`lastRotatedAt`/`lastUsedAt`,
  `KnowledgeBaseDto` 의 `documentCount`/`embeddingModelConfigId`/`rerank*` 필드의 nullable 여부는
  전부 `spec/1-data-model.md §2.11`/`§2.16`/`§2.10`/`§2.25` 의 컬럼 정의(`UUID?`/`Timestamp?`/`Integer`/`Enum` 등)와
  1:1로 일치한다.
- `TriggerDto.chatChannelHealth`/`chatChannelLastError`/`chatChannelSetupAt`/`chatChannelRotatedAt`/
  `notificationHealth`/`notificationLastError`/`notificationRotatedAt` 는 `spec/2-navigation/2-trigger-list.md`
  가 이미 "API 응답 시 camelCase" 로 정확히 이 7개 키를 문서화해 두었고, `spec/5-system/14-external-interaction-api.md`·
  `spec/5-system/15-chat-channel.md` 의 컬럼 마이그레이션 SQL·enum 정의와도 일치.
- `IntegrationDto.appUrl: string | null` 은 `spec/2-navigation/4-integration.md §9.1`에 이미 명시적으로
  문서화된 계약과 정확히 같은 타입.
- 새 응답-정화 상수(`TRIGGER_RESPONSE_STRIP_COLUMNS`, `INTERACTION_RESPONSE_STRIP_KEYS`,
  `NOTIFICATION_SIGNING_STRIP_KEYS`)가 스트립하는 필드 3종(`notification_secret_v2` · `chat_channel_token_v2` ·
  `config.interaction.triggerToken`)은 `spec/conventions/secret-store.md §1.1`이 "응답 DTO 에 선언되어서도,
  응답 바디에 실려서도 안 된다"고 이름으로 열거한 바로 그 세트와 정확히 일치 — 누락 없음.
- RBAC/권한 데코레이터·가드 파일은 이번 diff 에서 변경되지 않았다(`common/guards/*.ts` 등 미포함) — 권한 모델 충돌 표면 없음.
- `swagger.md §5-1`("엔티티를 그대로 노출하지 말 것")과 이번 diff 의 "이미 실려 나가고 있던 필드를 선언만
  실제에 맞춘다" 전략 사이의 긴장은 **신규 충돌이 아니다** — `2-api-convention.md §5.4` 자신이 "컨트롤러가
  엔티티를 그대로 반환하는 경로에서는 tsc 가 대조할 지점이 없다"고 이미 그 현실을 전제하고 두 검증자
  (선언↔선언 정적 / 값↔선언 런타임)로 이를 관리하도록 두 문서가 상호 조정돼 있다.

## 요약

Target 인 `spec/5-system`(특히 `2-api-convention.md §5.4` 응답-계약 규칙)과 이번 구현 diff 는 데이터 모델
(`1-data-model.md`), 트리거/스케줄/통합 nav-spec, `secret-store.md §1.1`, EIA/chat-channel spec 전 영역에
걸쳐 필드명·타입·nullable 여부·비밀 스트립 대상이 정확히 1:1로 대응한다 — 새로 발견된 데이터 모델·API 계약·
요구사항 ID·상태 전이·RBAC·계층 책임 충돌은 없다. 유일한 잔여 사항은 세 건의 **문서 동기화 지연**
(nav-spec 에 키-생략 사유 미반영, `consecutiveNetworkFailures` 신규 노출 필드 미등재, ratchet fixture 의
`code:` glob 누락)이며, 이는 모두 같은 브랜치의 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 이미 planner 후속 항목으로 정확히 등재돼 있어 본 검토가 중복 지적할 필요가 없다.

## 위험도

LOW
