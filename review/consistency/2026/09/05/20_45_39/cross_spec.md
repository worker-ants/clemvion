# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, `sweep-response-contract-5ba0ad`)

검토 대상: scope(`spec/5-system/`)의 spec 델타는 **0개 파일**(코드 전용 PR). 실제 diff(29파일/
1573줄, `origin/main...HEAD`)는 §5.4 응답-계약 스윕 1차 — `SchedulesController` /
`TriggersService` / `AlertRuleDto` / `IntegrationDto` / `KnowledgeBaseDto` / `TriggerDto` /
`ScheduleDto` 에 "이미 응답에 실려 나가고 있었지만 선언되지 않았던" 필드를 선언하고, 그
과정에서 드러난 트리거 회전-secret 응답 유출(`notificationSecretV2` · `chatChannelTokenV2`)을
차단한 것이다. 프롬프트 번들 자체는 `<git diff>` 본문과 다수 관련 spec 이 컨텍스트 예산으로
절단돼 있어(`spec/5-system/14-external-interaction-api.md` · `15-chat-channel.md` ·
`3-error-handling.md` 등 17개), 본 검토는 워킹트리(`git diff origin/main...HEAD`)와 해당 spec
파일을 절대경로로 직접 열어 대조했다.

## 대조 방법

새로 선언된 필드 전부를 `spec/1-data-model.md` 의 엔티티 정의, 그리고 각 도메인 spec
(`14-external-interaction-api.md`, `15-chat-channel.md`, `2-navigation/4-integration.md`,
`2-navigation/3-schedule.md`)과 1:1로 대조했다.

| DTO | 신규 필드 | 대조 대상 | 결과 |
|---|---|---|---|
| `TriggerDto` | `chatChannelHealth`·`chatChannelLastError`·`chatChannelSetupAt`·`chatChannelRotatedAt`·`notificationHealth`·`notificationLastError`·`notificationRotatedAt` | `1-data-model.md §2.8` (컬럼명·enum 동일) · `14-external-interaction-api.md §7.1/EIA-NX-07` · `15-chat-channel.md §3.4/§4.2` | **일치** — enum 값(`unknown/healthy/degraded`)·필드명(camelCase 변환)·nullable 여부 모두 부합 |
| `IntegrationDto` | `appUrl`·`mallId`·`tokenExpiresAt`·`lastRotatedAt`·`lastUsedAt`·`consecutiveNetworkFailures` | `1-data-model.md §2.10` | **일치** — `consecutiveNetworkFailures` 는 데이터 모델의 `NOT NULL DEFAULT 0`과 DTO의 non-nullable 선언이 부합. `mallId`/`tokenExpiresAt`/`lastRotatedAt`/`lastUsedAt`은 데이터 모델의 `String?`/`Timestamp?`와 DTO의 `\| null` 이 부합 |
| `KnowledgeBaseDto` | `documentCount`·`embeddingModelConfigId`·`rerankMode`·`rerankCandidateK`·`rerankScoreThreshold`·`rerankConfigId`·`rerankLlmConfigId` | `1-data-model.md §2.11` | **일치** — `rerank_mode` enum(`off/cross_encoder/cross_encoder_llm`) 동일. 기존 `embeddingModel`(derived) 필드와 신규 `embeddingModelConfigId`(raw FK)는 공존 관계로 이미 spec 이 구분해 둔 것(§2.11 주석) |
| `AlertRuleDto` | `createdBy`·`lastTriggeredAt` | `1-data-model.md §2.25` | **일치** — `created_by UUID?`/`last_triggered_at Timestamp?` |
| `ScheduleDto` | `trigger`(참조 4필드로 좁힌 형태) | `1-data-model.md §2.9`·`§2.9.1` (Schedule.trigger_id NOT NULL, 1:1 필수) · `2-navigation/3-schedule.md §4` | 데이터 모델상 트리거는 **항상** 존재하므로 이 필드가 실제로 생략되는 경로는 희박하다. `@ApiPropertyOptional`(키 생략형) 선택은 방어적 선언이며 데이터 모델과 모순되지는 않음 — convention_compliance 영역의 §5.4 해석 문제이지 cross-spec 충돌은 아니라고 판단 |

## 발견사항

### [INFO] 이전 라운드(19_08_19)가 지적한 CRITICAL — 이미 해소, 회귀 없음 확인

- target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts`(`sanitizeForResponse`)
  · `codebase/backend/src/modules/schedules/schedules.controller.ts`(`toResponse`)
- 이전 cross-spec 라운드(`review/consistency/2026/09/05/19_08_19/cross_spec.md`)는
  `notification_secret_v2` 가 실제로는 **평문**인데 `14-external-interaction-api.md §7.1`
  이 "ref 만 보관"이라 반대로 적고 있던 것을 CRITICAL 로 지적했다. 이번 검토에서
  `spec/5-system/14-external-interaction-api.md` §7.1(line 922-941)과
  `spec/conventions/secret-store.md` §1.1(line 52 이하)을 직접 열어 확인한 결과, **이미
  정정돼 있다** — "정정 이력(2026-09-05)" 주석과 `secret-store.md` 세 번째 비대상 예외
  등재가 present. `plan/in-progress/spec-draft-nullable-notation-followups.md` 도 이 항목을
  `[x]` 완료(PR #1290)로 표시한다. **재발 없음, 조치 불요** — 기록만 남긴다.

### [INFO] `IntegrationDto` 5필드의 `4-integration.md §9.1` 미등재 — 의도적으로 "이 브랜치 머지 후"로 예정됨

- target 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
  신규 `mallId`·`tokenExpiresAt`·`lastRotatedAt`·`lastUsedAt`·`consecutiveNetworkFailures`
- 충돌 대상: `spec/2-navigation/4-integration.md` §9.1(`GET /api/integrations/:id`) — 현재도
  "IntegrationDto 는 다음 **두** derived 필드를 포함한다"(`appUrl`·`autoRefresh`)로만 서술하고
  위 5필드는 언급하지 않는다(확인: line 795, 여전히 미변경).
- 상세: `1-data-model.md §2.10` 에는 다섯 필드 모두 엔티티 컬럼으로 이미 정의돼 있어
  **모순은 아니다** — 다만 §9.1 표가 "포함한다"는 서술이라 신규 독자가 전체 목록으로
  오독할 여지가 여전히 있다. 이 항목은 새 발견이 아니다 — 이전 라운드(19_08_19 W3)가 이미
  지적했고, `plan/in-progress/spec-draft-nullable-notation-followups.md` (line 724-729)가
  **"대상 5필드 선언이 아직 origin/main 에 없다 → 그 브랜치(본 브랜치) 머지 후 포인터를
  넣는다"** 라고 명시적으로 순서를 예정해 두었다. 즉 이 브랜치가 머지되기 전에는 고칠 수
  없는 순서 의존성이 있고, 계획대로 진행 중이다.
- 제안: 신규 조치 불요 — 이 브랜치 머지 후 planner 턴에서 트래커 항목(§9.1 포인터 1줄)을
  처리하면 된다. 이번 리뷰가 그 순서를 다시 확인해 두는 것으로 충분하다.

### [INFO] `IntegrationDto.consecutiveNetworkFailures` — FE 미소비 노출, 별도 트랙에서 추적 중

- target 위치: 동일 파일, `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규
  체크박스("`IntegrationDto.consecutiveNetworkFailures` 노출 중단 검토").
- 데이터 모델(§2.10)에 정의된 실제 컬럼이라 "선언되지 않은 것을 선언한" 정상적인 §5.4 적용
  사례이며, 노출 중단 여부는 이미 별도 항목으로 등재돼 중복 판단 불필요.

## 검토한 범위에서 충돌 없음을 확인한 축

- **데이터 모델**: Trigger·Schedule·Integration·KnowledgeBase·AlertRule 5개 엔티티의 신규
  DTO 필드가 `spec/1-data-model.md` 의 컬럼 정의·enum·nullable 여부와 전부 일치.
- **API 계약**: 신규 필드는 기존 엔드포인트(`GET/POST/PATCH /api/triggers`,
  `GET/POST/PATCH /api/schedules`, `/api/integrations`, `/api/knowledge-bases`,
  alert-rules)의 선언만 갱신했을 뿐 URL·메서드·envelope 변경 없음.
- **§5.4 규칙 자체와의 정합**: 모든 신규 필드가 "엔티티 컬럼 = 상시 존재 → `@ApiProperty`
  + `nullable: true`" 규칙을 따르고, `appUrl`(파생·조건부)만 키 생략형으로 올바르게
  구분됨 — `spec/5-system/2-api-convention.md §5.4` 및 `swagger.md §1-3` 과 부합.
- **검증자 등재**: `swagger-dto-contract*.ts`/`response-contract*.ts` 는 `2-api-convention.md`
  와 `conventions/swagger.md` 양쪽 `code:` 프런트매터에 모두 등재돼 있음 — 이전 라운드가
  지적한 W2("한쪽만 등재")는 이미 해소된 상태.
- **RBAC**: 이번 diff 는 컨트롤러·서비스의 응답 셰이핑만 바꾸고 `@Roles()`/가드/권한 분기를
  건드리지 않는다 — 신규 필드는 기존에 이미 그 역할에게 노출되던 값의 재선언이므로 권한
  경계 변화 없음.
- **상태 전이**: `chatChannelHealth`/`notificationHealth` 상태 머신(전이 조건)은
  `14-external-interaction-api.md`/`15-chat-channel.md` 가 소유하며 이번 diff 는 그 전이
  로직을 바꾸지 않고 이미 정의된 상태값을 응답에 노출만 한다.

## 요약

이 diff 는 §5.4 응답-계약 스윕 1차로, 신규 선언 필드 전부가 `spec/1-data-model.md` 의 기존
엔티티 정의와 정확히 일치하며 데이터 모델·API 계약·RBAC·상태 전이 어느 축에서도 새로운
모순을 만들지 않는다. 유일하게 남아 있던 CRITICAL(이전 라운드가 지적한 `notification_secret_v2`
저장 형태와 EIA spec 의 불일치)은 별도 planner 턴(PR #1290)에서 이미 정정되어 현재 spec 상태에
반영돼 있음을 직접 확인했다. `IntegrationDto` 신규 5필드가 `2-navigation/4-integration.md §9.1`
표에 아직 포인터로 등재되지 않은 것은 남아 있지만, 이는 "이 브랜치가 머지된 뒤에 추가한다"는
순서 의존성이 계획 문서에 명시돼 있는 의도된 지연이지 새로 발견된 결함이 아니다. Cross-Spec
관점에서 이 PR 을 막을 사유는 없다.

## 위험도

NONE
