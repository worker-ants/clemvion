# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, code-only diff)

## 전제

이 PR 은 `spec/5-system/**` 자체를 변경하지 않는다 (scope 델타 0개 파일 — 코드 전용 응답-계약
스윕이라 정상). 검토 대상은 diff 된 코드
(`codebase/backend/src/modules/{triggers,schedules,alerts,integrations,knowledge-base}/**`,
`shared/testing/response-contract.ts`, `repo-guards/__tests__/swagger-dto-contract-guard.ts`)가
**다른 spec 영역**(`spec/conventions/secret-store.md`, `spec/conventions/swagger.md`,
`spec/1-data-model.md`, `spec/5-system/{12-webhook,14-external-interaction-api,15-chat-channel,
2-api-convention}.md`, `spec/2-navigation/{1-workflow-list,2-trigger-list,4-integration}.md`)와
상충하는지다. prompt 번들의 `<git diff>` 섹션이 예산 초과로 절단되어, 대상 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad`)에서
`git diff origin/main...HEAD` 를 파일별로 직접 열어 실측했다.

이 세션 안에서 이미 5라운드(`18_23`·`19_08`·`20_45`·`21_40`·`22_25`)의 cross_spec 검토가
돌았고, 각 라운드가 지적한 항목을 다음 라운드의 diff 가 순차로 닫아 온 이력이 코드 주석·
CHANGELOG·plan 체크리스트에 남아 있다. 본 라운드는 그 마지막 상태(직전 `22_25_00` 라운드가
남긴 CRITICAL 1건)부터 이어서 검증한다.

## 발견사항

- **[정보 — 직전 CRITICAL 해소 확인]** `review/consistency/2026/09/05/22_25_00/cross_spec.md`
  가 지적한 CRITICAL(`config.interaction.triggerToken` 이 `sanitizeForResponse` 스트립 대상
  세 곳— `config.chatChannel`/`config.notification.signing`/엔티티 컬럼 — 어디에도 없어
  `GET/POST/PATCH /api/triggers` 에 평문 `itk_*` 가 매 요청 노출된다는 지적, `secret-store.md
  §1.1` 이 이름으로 금지한 세 필드 중 유일한 미해결 잔여)가 **이번 diff 에서 해소됐다.**
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` —
    `INTERACTION_RESPONSE_STRIP_KEYS = new Set(['triggerToken'])` 신설 +
    `sanitizeForResponse()` 안에 `cfg.interaction` 을 (조기 return 과 무관하게) 항상 훑어
    스트립하는 블록 추가.
  - 대조 근거: `spec/conventions/secret-store.md` §1.1 "비대상 필드도 응답 바디에는 나가지
    않는다" 이 명시 열거하는 세 항목 — `AuthConfig.config` 자격증명 / `Trigger.config.
    interaction.triggerToken` / `Trigger.notification_secret_v2`(+ ref 형제
    `chat_channel_token_v2`·`config.notification.signing.secretRef`) — 중 앞 라운드가 닫지
    못했던 `interaction.triggerToken` 이 이번 diff 의 `INTERACTION_RESPONSE_STRIP_KEYS` 로
    닫혔다. 회귀는 `triggers.service.spec.ts` 에 `triggerToken: 'itk_should_not_leak'` 픽스처
    + `expect(interaction).not.toHaveProperty('triggerToken')` 단언으로 고정되어 있다.
  - 남은 잔여(경미, 본 라운드 범위 밖): `plan/in-progress/spec-draft-nullable-notation-
    followups.md` 의 해당 체크리스트 항목(709행 부근, `[x]` 완료)은 텍스트상 여전히
    `notificationSecretV2`/`chatChannelTokenV2` 두 컬럼만 명시하고 `interaction.triggerToken`
    닫힘을 문장으로 언급하지 않는다 — **plan 서술 최신화**이지 spec-대-spec 충돌이 아니라
    본 리뷰(cross-spec) 범위에서는 지적하지 않는다(plan_coherence 축 소관).

- **[대조 — 신규/보강 필드가 다른 spec 영역과 정합]** 이번 diff 가 새로 선언하거나 스트립한
  필드를 각 SoT 문서와 1:1 대조했다. 전부 일치했다:
  - `TriggerDto` 의 `chatChannelHealth`/`chatChannelLastError`/`chatChannelSetupAt`/
    `chatChannelRotatedAt`/`notificationHealth`/`notificationLastError`/`notificationRotatedAt`
    — 필드명·enum(`unknown`/`healthy`/`degraded`)이 `spec/2-navigation/2-trigger-list.md`
    §2.1·§2.3.1, `spec/5-system/12-webhook.md`(WH-MG-07/09), `spec/5-system/15-chat-channel.md`
    (CCH-SE-01/CCH-NF-03), `spec/5-system/14-external-interaction-api.md`(EIA-NX-07/11),
    `spec/1-data-model.md` §2.8 과 정확히 일치.
  - `IntegrationDto` 의 `appUrl`/`mallId`/`tokenExpiresAt`/`lastRotatedAt`/`lastUsedAt`/
    `consecutiveNetworkFailures` — `spec/1-data-model.md` §2.10(`mall_id`·
    `consecutive_network_failures`·`token_expires_at`·`last_used_at`·`last_rotated_at`)과
    `spec/2-navigation/4-integration.md` §9.1(`IntegrationDto.appUrl` derived 필드 명시)에
    정확히 대응. 컬럼 nullable 여부(`String?`/`Timestamp?` vs NOT NULL DEFAULT 0)도 DTO
    의 `nullable: true` 부여 여부와 일치.
  - `KnowledgeBaseDto` 의 `documentCount`/`embeddingModelConfigId`/`rerankMode`/
    `rerankCandidateK`/`rerankScoreThreshold`/`rerankConfigId`/`rerankLlmConfigId` —
    `spec/1-data-model.md` §2.11 컬럼 표(`document_count`·`embedding_model_config_id`·
    `rerank_mode`(`off`/`cross_encoder`/`cross_encoder_llm`)·`rerank_candidate_k`·
    `rerank_score_threshold`(Float?)·`rerank_config_id`·`rerank_llm_config_id`)와 정확히
    일치. 기존 derived 필드 `embeddingModel`(§2.11 "유효 임베딩 모델은 API 응답의
    `embeddingModel`" 요구)과 신규 raw FK `embeddingModelConfigId` 는 서로 다른 개념으로
    공존 — data-model 이 "변경은 `embeddingModelConfigId` 로만 수행" 이라 적어 두 필드
    모두 정당화된다.
  - `AlertRuleDto` 의 `createdBy`/`lastTriggeredAt` — `spec/1-data-model.md` §2.25
    (`created_by UUID? SET NULL`, `last_triggered_at Timestamp?`)와 정확히 일치.
  - `ScheduleDto.trigger` 를 **상시 존재**(`@ApiProperty`, 키 생략 아님)로 선언한 근거는
    `spec/1-data-model.md` §2.9.1 "`Schedule.trigger_id` 는 NOT NULL — 반드시 Trigger 와
    1:1" 과 일치. `ScheduleTriggerRefDto.workflow`/`TriggerDto.workflow` 를 키 생략형으로
    남긴 근거(§5.4 기준 (b))도 프런트엔드 실소비 지점(`schedules/page.tsx`
    `s.trigger?.workflow?.name`, `triggers/page.tsx` `t.workflow?.name`)과 대조해 일치를
    확인했다.
  - `codebase/backend/test/workflow-crud.e2e-spec.ts` 의 `allowMissing: ['formatVersion']`
    은 `spec/2-navigation/1-workflow-list.md`("포맷 버전 협상은 미구현 (Planned)")가 이미
    문서화한 갭을 정확히 인용한다 — `response-contract.ts` 의 신설 `allowMissing` 옵션이
    요구하는 "spec 본문에 Planned 로 이미 적혀 있는 경우" 조건을 충족.

- **[대조 — §5.4/swagger §5-1 검증 층 정합]** 신설 `OptionalNullableOffender` 정적 축
  (`swagger-dto-contract-guard.ts`)의 판정 로직(`required:false` + `nullable:true` 응답
  바디 조합을 금지, 요청 DTO 는 `/dto/responses/` 경로 필터로 제외)은
  `spec/5-system/2-api-convention.md` §5.4 원문("키를 생략하는 필드 → `@ApiPropertyOptional()`
  + `field?: T`(`| null` 금지)", "요청 바디는 대상이 아니다")과 문구·조건이 정확히 대응한다.
  두 검증자(`swagger-dto-contract-guard.ts` 정적 vs `response-contract.ts` 런타임)의 역할
  분담 서술도 §5.4 "검증 층" 표와 일치.

## 요약

이번 라운드는 spec 본문을 건드리지 않는 코드 전용 응답-계약 스윕이며, 직전 라운드
(`22_25_00`)가 발견한 CRITICAL(트리거 per-trigger 영구 토큰 `interaction.triggerToken` 이
`secret-store.md §1.1` 이 금지한 세 노출 경로 중 유일하게 안 닫힌 상태)이 이번 diff 의
`INTERACTION_RESPONSE_STRIP_KEYS` 스트립 + unit 회귀로 해소된 것을 코드·테스트 양쪽에서
직접 확인했다. 이번에 신규·보강된 모든 DTO 필드(트리거 health 7필드, 통합 6필드, 지식베이스
7필드, 알림규칙 2필드, 스케줄 `trigger` 참조 축소)를 `spec/1-data-model.md`,
`spec/2-navigation/{2-trigger-list,4-integration,1-workflow-list}.md`,
`spec/5-system/{12-webhook,14-external-interaction-api,15-chat-channel,2-api-convention}.md`
와 필드명·타입·nullable 여부·enum 값 단위로 대조했고 전부 일치했다. `secret-store.md §1.1`
이 명시 열거한 응답-노출 금지 필드 셋(엔티티 컬럼 2개·JSONB 키 2개·`interaction.triggerToken`
1개, 총 5개 노출 경로)도 이번 diff 로 전부 스트립 대상에 포함됐다. 새로 발견된 CRITICAL/
WARNING 급 cross-spec 충돌은 없다.

## 위험도

NONE
