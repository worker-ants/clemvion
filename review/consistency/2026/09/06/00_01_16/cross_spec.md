# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 개요

- scope(`spec/5-system/`) 델타: **0개 파일** — 이 브랜치는 spec 을 바꾸지 않는다(정상, 코드 전용 PR).
- 코드 diff: `codebase/backend/**` 32파일 — `TriggerDto`/`ScheduleDto`/`IntegrationDto`/
  `KnowledgeBaseDto`/`AlertRuleDto` 응답-계약(§5.4) 정합화 + 트리거 회전 secret(`notificationSecretV2`·
  `chatChannelTokenV2`·`config.interaction.triggerToken`) 응답 유출 차단.
- HEAD(`30b0f60b6`)는 같은 세션의 직전 라운드(`review/consistency/2026/09/05/23_30_01`)가 낸 WARNING 1
  및 코드리뷰 `23_30_00`/`22_48_39` 의 후속 수정 2커밋(`48704becd`·`30b0f60b6`)까지 포함한 상태다. 두 커밋을
  포함해 재검증했다.

## 발견사항

- **[INFO]** `ScheduleDto.trigger`/`ScheduleTriggerRefDto.workflow`·`TriggerDto.workflow` 의 키-생략 사유가
  nav-spec 에 아직 미반영
  - target 위치: `spec/5-system/2-api-convention.md §5.4`("키 생략은 (a)/(b) 중 하나일 때만 쓰고, 그 필드를
    문서화하는 절에 사유를 명시")
  - 충돌 대상: `spec/2-navigation/3-schedule.md`(§4 인근) · `spec/2-navigation/2-trigger-list.md`
  - 상세: 신규 참조 필드(`ScheduleTriggerRefDto.workflow` — 생성 응답에만 부재, `TriggerDto.workflow` —
    §5.4 기준 (b))의 사유는 DTO 파일의 `//` 주석에만 있고, 두 nav-spec 문서에는 아직 옮겨지지 않았다.
    §5.4 가 요구하는 "표에 근거를 남긴다"는 절차상 아직 완결되지 않은 상태이나, 코드·spec 이 서로 다른
    사실을 주장하는 **모순은 아니다**(nav-spec 은 이 필드에 대해 침묵할 뿐 반대되는 내용을 적고 있지 않다).
  - 제안: 별도 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속
    항목("`ScheduleDto.trigger`/`workflow` 를 nav-spec 에 문서화", `21_40_38` W1 / `22_25_00` W2)으로
    이미 정확히 등재돼 있다.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 신규 노출 필드가 `4-integration.md §9.1` 에 미등재
  - target 위치: `spec/5-system/2-api-convention.md §5.4`
  - 충돌 대상: `spec/2-navigation/4-integration.md §9.1`(현재 `appUrl`/`autoRefresh` derived 필드만 설명)
  - 상세: 내부 health 카운터가 이미 응답에 실려 나가고 있던 것을 §5.4 기본형으로 선언만 한 것 — 코드
    자체의 모순은 아니다. `data-model.md §2.10` 의 `consecutive_network_failures` DB 컬럼과 타입·nullable
    여부는 일치한다.
  - 제안: 별도 조치 불요 — 같은 plan 파일에 "노출 중단 검토"(developer, wire-breaking 이라 CHANGELOG
    동반 필요)로 이미 열려 있다.

## 정합성 확인(충돌 없음으로 판정한 항목 — 근거)

- `Schedule.trigger_id NOT NULL 1:1`(`ScheduleDto.trigger` 를 §5.4 기본형 `@ApiProperty`로 선언한 근거) —
  `spec/1-data-model.md §2.9.1`과 정확히 일치.
- `AlertRuleDto.createdBy`/`lastTriggeredAt`, `IntegrationDto.appUrl`/`mallId`/`tokenExpiresAt`/
  `lastRotatedAt`/`lastUsedAt`, `KnowledgeBaseDto.documentCount`/`embeddingModelConfigId`/`rerankMode`/
  `rerankCandidateK`/`rerankScoreThreshold`/`rerankConfigId`/`rerankLlmConfigId`, `TriggerDto.workflow`
  (id/name) — 전부 `spec/1-data-model.md §2.8·§2.10·§2.11·§2.25` 컬럼 정의(타입·nullable)와 1:1 대응.
- `TriggerDto.chatChannelHealth`/`chatChannelLastError`/`chatChannelSetupAt`/`chatChannelRotatedAt`/
  `notificationHealth`/`notificationLastError`/`notificationRotatedAt` — `spec/2-navigation/2-trigger-list.md`
  가 이미 이 7개 키를 "API 응답 시 camelCase" 로 명시 문서화해 두었고, enum 값 집합(`unknown/healthy/degraded`)
  도 `1-data-model.md §2.8` 과 일치.
- 신규 응답-정화 대상 3종(`Trigger.notification_secret_v2` · `chat_channel_token_v2` ·
  `config.interaction.triggerToken`)은 `spec/conventions/secret-store.md §1.1`(이번 세션 초반 planner
  턴이 신설)이 "응답 DTO 에 선언되어서도, 응답 바디에 실려서도 안 된다"고 이름으로 열거한 바로 그
  집합과 정확히 일치 — 누락 없음. `triggerToken`(config.interaction, JSONB 축) 은 §1 비대상 등재 근거
  (c) "발급 응답 1회 노출" 이 목록·상세 응답 상시 노출과 충돌한다는 점을 이 diff 가 직접 시행한다.
- `swagger-dto-contract-guard.ts` 신설 축(§5.4 금지 조합 `required:false`+`nullable:true` 응답 필드 래칫)은
  `api-convention.md §5.4` 본문의 "키 생략형 → `field?: T`(`| null` 금지) / null형 → `field: T | null`"
  이분법과 정확히 대응 — 새 규범을 만드는 것이 아니라 기존 §5.4 문언이 이미 배제한 조합을 코드로 강제한다.
- RBAC/권한 가드 파일(`common/guards/*.ts` 등)은 이번 diff 에서 변경되지 않음 — 권한 모델 충돌 표면 없음.
- 상태 전이(Schedule/Trigger 라이프사이클)는 `schedules.service.ts` 의 `saved.trigger` 대입 위치 버그
  수정뿐이며, `1-data-model.md §2.9.1` 의 동기화 규칙(Schedule↔Trigger 1:1, isActive 동기화)과 모순되지
  않는다 — 오히려 그 규칙("Schedule.trigger_id 는 NOT NULL")을 응답에서 어겼던 것을 바로잡는다.
- 최신 두 커밋(`48704becd`·`30b0f60b6`)은 직전 라운드(`23_30_01`)가 남긴 WARNING 1(JSDoc 배치)과
  코드리뷰 security W(열린 `config` map 비밀의 e2e 미방어)만 처리하는 순수 후속 수정이며, 새로운
  데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌을 도입하지 않는다.

## 요약

Target 인 `spec/5-system`(특히 `2-api-convention.md §5.4`)과 이번 구현 diff(응답-계약 정합화 + 트리거
회전 secret 유출 차단)는 `1-data-model.md`, 트리거/스케줄/통합 nav-spec, `secret-store.md §1.1` 전 영역에
걸쳐 필드명·타입·nullable 여부·비밀 스트립 대상이 1:1로 대응한다. 새로 발견된 CRITICAL/WARNING 급
Cross-Spec 충돌은 없다. 잔여 사항 2건(nav-spec 문서 동기화 지연)은 동일 브랜치의
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 planner 후속 항목으로 정확히
등재돼 있어 본 검토가 새로 지적할 필요가 없으며, 직전 라운드(`23_30_01`) 이후 추가된 두 커밋도 그
라운드가 낸 지적을 처리하는 후속 수정일 뿐 새 충돌을 만들지 않는다.

## 위험도

LOW
