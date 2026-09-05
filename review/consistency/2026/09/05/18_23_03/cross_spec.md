# Cross-Spec 일관성 검토 — §5.4 응답-계약 스윕 1차 (트리거 회전 secret 누출 수정)

## 검토 대상 요약

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- **`spec/5-system/**` 델타 0개 파일** — 이 브랜치는 spec 을 바꾸지 않았다(코드 전용 PR). 코드
  diff 23개 파일 / 975줄 (실제로는 CHANGELOG·plan 포함 25개 파일 / 560줄, 워킹트리 실측
  `git diff origin/main...HEAD --stat`).
- 내용: `TriggersService.sanitizeChatChannelForResponse` → `sanitizeForResponse` 로 확장해
  엔티티 컬럼(`notificationSecretV2`·`chatChannelTokenV2`)까지 응답에서 제거하고,
  `SchedulesController` 가 조인된 Trigger 엔티티 전체 대신 참조 4필드만 노출하도록 좁혔다.
  같은 스윕이 발견한 "응답엔 있는데 DTO 미선언" 24필드(`TriggerDto`·`IntegrationDto`·
  `KnowledgeBaseDto`·`AlertRuleDto`·`ScheduleDto.trigger`)도 선언을 실제에 맞췄다.
  `response-contract.ts` 에 `allowMissing` 옵션 신설.

이 변경이 `spec/**` 의 다른 영역(데이터 모델·API 계약·RBAC·상태 전이·계층 책임)과 충돌하는지
아래 6개 관점으로 대조했다.

## 대조 결과 (전 관점 통과 — 충돌 없음)

### 1. 데이터 모델 충돌 — 없음
신규로 선언된 모든 필드가 `spec/1-data-model.md` 의 기존 엔티티 컬럼 정의와 이름·타입까지
정확히 일치한다:

| DTO | 신규 선언 필드 | data-model 대응 컬럼 |
|---|---|---|
| `TriggerDto` | `chatChannelHealth`·`chatChannelLastError`·`chatChannelSetupAt`·`chatChannelRotatedAt`·`notificationHealth`·`notificationLastError`·`notificationRotatedAt` | §2.8 Trigger 의 동명 snake_case 컬럼 (`chat_channel_health` 등) — **전부 일치** |
| `IntegrationDto` | `appUrl`·`mallId`·`tokenExpiresAt`·`lastRotatedAt`·`lastUsedAt`·`consecutiveNetworkFailures` | §2.10 Integration (`mall_id`·`token_expires_at`·`last_used_at`·`last_rotated_at`·`consecutive_network_failures`) + `appUrl` 은 §2.10 이 명시한 "응답 DTO 전용 derived 필드" |
| `KnowledgeBaseDto` | `documentCount`·`embeddingModelConfigId`·`rerankMode`·`rerankCandidateK`·`rerankScoreThreshold`·`rerankConfigId`·`rerankLlmConfigId` | §2.11 KnowledgeBase 의 동명 컬럼 — 전부 일치. 기존 `embeddingModel`(derived, §2.11 명시)과 신규 `embeddingModelConfigId`(raw FK)는 spec 이 이미 두 필드 공존을 명시("변경은 embeddingModelConfigId 로만 수행")하므로 중복 아님 |
| `AlertRuleDto` | `createdBy`·`lastTriggeredAt` | §2.25 AlertRule (`created_by`·`last_triggered_at`) — 일치 |
| `ScheduleDto` | `trigger`(참조 4필드로 좁힘) | §2.9.1 Trigger↔Schedule 동기화 규칙과 상충 없음 — data-model 은 Schedule 응답에 Trigger 전체 노출을 요구하지 않음 |

**응답에서 제외한** `notificationSecretV2`·`chatChannelTokenV2` 도 `spec/1-data-model.md` §2.8 이
"Secret rotation 기간 동안 사용되는 신규 secret"(평문)·"bot token reference"로 각각 정의하며,
[`spec/5-system/14-external-interaction-api.md`](../../../../spec/5-system/14-external-interaction-api.md)
의 §3.1 예시 응답은 **`signing.secret` 이 "응답에서 영구 마스킹"** 됨을 이미 명시하고 있다 —
이번 코드 수정은 그 문서화된 의도를 실제로 관철시킨 것이지 새 정책을 만든 것이 아니다.

### 2. API 계약 충돌 — 없음
- `spec/2-navigation/4-integration.md` §9.1/§9.2 는 `IntegrationDto.appUrl`·`autoRefresh` 등
  derived 필드를 이미 상세히 문서화하고 있고, 이번 PR 은 그 문서화된 계약과 실제 OpenAPI
  선언 사이의 간극(선언 누락)을 닫은 것이다 — 방향이 스펙→코드 정합화.
- `spec/2-navigation/3-schedule.md` §4, `spec/2-navigation/2-trigger-list.md` §3 은 엔드포인트
  목록만 규정하고 응답 바디의 필드 단위 shape 을 못박지 않아, `ScheduleDto.trigger` 를 참조
  4필드로 좁힌 선택과 상충하는 문서 진술이 없다.
- `spec/5-system/2-api-convention.md` §5.4 "검증 층" 소절은 "판정 규칙의 상세 표는 코드의
  JSDoc 이 단일 진실"이라고 명시적으로 위임해 두었다 — `allowMissing` 옵션 신설은 그 위임
  범위 안의 코드측 확장이라 spec 갱신 의무가 없다.

### 3. 요구사항 ID 충돌 — 해당 없음
이 diff 는 신규 요구사항 ID 를 도입하지 않는다(코드 전용, spec 델타 0).

### 4. 상태 전이 충돌 — 해당 없음
Trigger/Schedule/Integration/KnowledgeBase 의 상태 머신(`status`·`reembed_status` 등)은
변경되지 않았다. 응답 경계 필드 노출/은닉만 바뀌었다.

### 5. 권한·RBAC 모델 충돌 — 없음
`spec/5-system/1-auth.md` §3.2 매트릭스는 Trigger/Schedule 을 Owner/Admin/Editor=CRUD,
Viewer=R 로만 규정하며 **필드 단위 가시성 차등을 두지 않는다**. 이번 수정은 시크릿 2필드를
**전 역할 공통으로** 완전 제거하는 것이라 어떤 역할의 기존 읽기 권한도 축소·확장하지 않는다.
오히려 `spec/5-system/1-auth.md` §3.3 의 "Auth Config Reveal 은 Admin+ 로 별도 분리"라는
민감정보-분리 원칙과 같은 방향(비밀은 role 불문 마스킹/미노출)이라 정합적이다.

### 6. 계층 책임 충돌 — 없음
`SchedulesController` 에서(서비스가 아니라) `trigger` 를 좁히는 선택은
`spec/conventions/swagger.md` §5-1("엔티티를 그대로 노출하지 말고 응답 DTO 로 별도 구성 —
비밀값은 마스킹/제외")과 상충하지 않는다. §5-1 은 배치 계층(서비스 vs 컨트롤러)을 규정하지
않으며, 코드 주석이 그 이유(서비스 반환 타입은 `update` 등 내부 로직이 공유 소비하므로 응답
경계에서만 좁힌다)를 명시해 근거가 있다.

## 요약

이번 PR 은 `spec/5-system/**` 을 전혀 건드리지 않는 코드 전용 보안 수정이며, 신규로
선언한 24개 필드 전부가 `spec/1-data-model.md`·`spec/2-navigation/4-integration.md`·
`spec/2-navigation/5-knowledge-base.md` 등 기존 spec 문서의 필드 정의와 이름·의미 모두
일치했다. 응답에서 제거한 두 시크릿 컬럼(`notificationSecretV2`·`chatChannelTokenV2`) 도
`spec/5-system/14-external-interaction-api.md`·`spec/5-system/15-chat-channel.md` 가 이미
"영구 마스킹" 대상으로 명시해 온 것과 정확히 같은 방향이라, 이번 수정은 spec 과 어긋나는
새 정책이 아니라 **문서화된 의도와 구현 사이의 간극을 코드 쪽에서 메운 것**이다. RBAC
매트릭스·상태 전이·계층 책임 원칙 어디에도 저촉되는 지점을 찾지 못했다. Cross-spec
일관성 관점에서 이 변경은 위험 요소가 없다.

## 위험도

NONE
