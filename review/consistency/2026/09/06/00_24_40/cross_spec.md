# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 스코프 메모

`spec/5-system/**` 자체의 델타는 0 (이 브랜치는 spec 파일을 바꾸지 않았다). 대신
`codebase/backend`(31파일 / +1497 -50)가 트리거·스케줄 응답 경계의 비밀 유출 스윕
(`TriggersService.sanitizeForResponse` 확장, `SchedulesController.toResponse` 신설, DTO
필드 추가 다수, `response-contract.ts`/`swagger-dto-contract-guard.ts` 검증기 보강)을
구현한다. 아래는 이 diff 가 `spec/5-system/` 외부(및 인접) 영역과 충돌하는지에 대한
점검이며, `origin/main` 대신 워크트리 HEAD 를 코드 SoT 로 삼아 직접 확인했다.

핵심 판정: **새로 도입된 데이터 모델/충돌은 없다.** 오히려 diff 는
`spec/conventions/secret-store.md §1.1` 과 `spec/5-system/14-external-interaction-api.md
§7.1`이 이미 "미해결 결함"으로 명시해 둔 트리거 비밀 컬럼(`notification_secret_v2` ·
`chat_channel_token_v2`) 및 `config.interaction.triggerToken` 응답 노출을 닫는다 — 즉
문서가 요구하던 방향과 **일치**한다. 새 DTO 필드(`AlertRuleDto.createdBy/lastTriggeredAt`,
`IntegrationDto.appUrl/mallId/tokenExpiresAt/lastRotatedAt/lastUsedAt/
consecutiveNetworkFailures`, `KnowledgeBaseDto.documentCount/rerankMode/rerankCandidateK/
rerankScoreThreshold/rerankConfigId/rerankLlmConfigId/embeddingModelConfigId`,
`TriggerDto.chatChannelHealth/notificationHealth/...`)는 전수 대조한 결과
`spec/1-data-model.md` §2.9~2.25 의 엔티티 컬럼 타입·nullable 여부와 정확히 일치한다.

---

## 발견사항

- **[INFO]** `secret-store.md §1` / `14-external-interaction-api.md §7.1` 의 "노출 창이
  아직 닫혀 있지 않다" 서술이 이 diff 로 낡는다 (이미 추적 중)
  - target 위치: (구현) `codebase/backend/src/modules/triggers/triggers.service.ts`
    `sanitizeForResponse`(`TRIGGER_RESPONSE_STRIP_COLUMNS` 신설) ·
    `codebase/backend/src/modules/schedules/schedules.controller.ts` `toResponse`
  - 충돌 대상: `spec/conventions/secret-store.md` §1 세 번째 비대상 등재 하단
    (*"노출 창은 아직 설계대로 닫혀 있지 않다... `GET/POST/PATCH /api/triggers` 와
    `GET /api/schedules`(트리거 조인) 응답에도 이 컬럼을 그대로 싣는다... 매 요청
    노출된다"*) · `spec/5-system/14-external-interaction-api.md` §7.1 "정정 이력
    (2026-09-05)" 블록의 동일 서술 (*"현재 이 컬럼은 응답에도 나간다... 이는
    **미해결 결함**이며..."*)
  - 상세: 두 spec 문서는 `notification_secret_v2`·`chat_channel_token_v2` 가 매 응답에
    실린다고 **현재형**으로 서술하지만, 이 diff 의 `TRIGGER_RESPONSE_STRIP_COLUMNS`
    (`deleteSecretColumns`)와 `SchedulesController.toResponse`(트리거를 참조 4필드로
    좁힘)가 그 경로를 닫는다 — e2e/unit 뮤테이션으로 확인됨. 머지 후에는 두 문서의
    해당 문장이 거짓이 된다.
  - 제안: **이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`**
    (worktree `plan-in-progress-items-b0c80b`)의 미체크 항목 *"`secret-store.md §1` 의
    '노출 창이 아직 닫혀 있지 않다' 가 낡는다"* 가 정확히 이 상황을 예고하며 이 브랜치
    (`sweep-response-contract`)의 머지를 트리거 조건으로 명시해 두었다. 신규 조치
    불필요 — 머지 시 그 plan 항목을 집행(§7.1 "정정 이력" 패턴 준용, 커밋 참조 추가)하면
    된다는 점만 재확인.

- **[INFO]** `ScheduleDto.trigger` / `TriggerDto.workflow` 참조 축약 형태가 nav-spec
  에는 아직 없음 (이미 추적 중)
  - target 위치: (구현) `codebase/backend/src/modules/schedules/dto/responses/
    schedule-response.dto.ts` (`ScheduleTriggerRefDto`) ·
    `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`
    (`TriggerWorkflowRefDto`)
  - 충돌 대상: `spec/2-navigation/3-schedule.md` §4 (API 표) · `spec/2-navigation/
    2-trigger-list.md` — 둘 다 `trigger`/`workflow` 참조 필드의 키-생략형 근거(§5.4
    기준 (b))를 아직 문서화하지 않음. 근거는 현재 DTO 필드 JSDoc(`introspectComments`
    로 공개 OpenAPI description 화)에만 있음.
  - 상세: `spec/5-system/2-api-convention.md` §5.4 는 "키 생략형은 그 필드를
    문서화하는 절에 사유를 명시" 하라고 요구한다. OpenAPI description 자체는 이
    요구를 기술적으로 충족하지만, nav-spec 문서(화면·API 계약 SoT)에는 아직 반영이
    없다.
  - 제안: 이미 같은 plan 파일에 *"`ScheduleDto.trigger`/`workflow` 를 nav-spec 에
    문서화"* 항목(미체크)이 planner 소유로 등재돼 있다. 신규 등재 불필요.

- **[INFO]** 응답 축약 책임 소재가 레이어 간 비대칭 (컨트롤러 vs 서비스) — 문서화된
  근거 있음, 규약 위반 아님
  - target 위치: `TriggersService.sanitizeForResponse`(서비스 레이어에서 축약) vs
    `SchedulesController.toResponse`(컨트롤러 레이어에서 축약)
  - 충돌 대상: 없음 — `spec/**`에 "응답 정화는 어느 레이어에서 하는가"를 규정한 문서가
    없어 형식적 충돌은 아니다.
  - 상세: 코드 주석이 근거를 명시한다 — `SchedulesService.findById/create/update` 는
    내부 로직도 트리거 엔티티를 소비하므로 서비스 반환 타입을 좁히면 그 경로가
    깨진다는 것. 두 모듈이 다른 지점에서 축약하는 비대칭 자체는 근거가 있어 결함이
    아니다.
  - 제안: 조치 불필요. 향후 세 번째 유사 리소스가 추가될 때 이 비대칭이 관례로
    굳어지면 `spec/5-system/2-api-convention.md`에 "응답 축약은 컨트롤러 경계에서,
    단 서비스 반환값이 내부 로직에도 쓰이지 않는 경우에 한해 서비스에서" 정도의
    한 줄을 남기는 것을 고려할 수 있다(강제 아님).

---

## 요약

Cross-spec 관점에서 이 diff 가 **새로** 만들어내는 데이터 모델·API 계약·요구사항 ID·상태
전이·RBAC·계층 책임 충돌은 발견되지 않았다. 추가된 응답 DTO 필드(Trigger/Schedule/
AlertRule/Integration/KnowledgeBase) 전부를 `spec/1-data-model.md` 엔티티 정의와
대조했고 타입·nullable 여부가 정확히 일치했으며, 트리거 비밀 스트립 확장은
`spec/conventions/secret-store.md §1.1` 이 이미 요구해 둔 금지 규범을 뒤늦게 시행하는
방향이라 오히려 spec-code 정합성을 개선한다. 유일한 잔여 사항은 두 spec 문서
(`secret-store.md §1`, `14-external-interaction-api.md §7.1`)가 "미해결 결함"이라고
쓴 서술이 이 diff 의 머지로 낡는다는 점인데, 이는 이미 `plan/in-progress/
spec-draft-nullable-notation-followups.md` 가 이 정확한 브랜치를 지목해 planner 후속
조치로 추적 중이므로 신규 차단 사유가 아니다.

## 위험도

LOW
