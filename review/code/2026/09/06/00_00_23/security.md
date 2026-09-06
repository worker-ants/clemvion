# 보안(Security) 리뷰

## 발견사항

- **[INFO]** 트리거 비밀 스트립이 **deny-list(허용 아님, 금지 목록) 3~4벌**로 나뉘어 있고, 이 PR 자신의 서사가 "같은 형태로 세 번 좁았다"(`config.chatChannel` 안의 키 → `config.notification.signing` → `config.interaction` → 엔티티 컬럼)고 명시한다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`(53행) · `NOTIFICATION_SIGNING_STRIP_KEYS`(74행) · `INTERACTION_RESPONSE_STRIP_KEYS`(114행) · `TRIGGER_RESPONSE_STRIP_COLUMNS`(94행), 통합 지점 `sanitizeForResponse`(627행).
  - 상세: deny-list 기반 정화는 "새 비밀 필드가 추가됐는데 어느 목록에도 넣는 것을 잊는다"는 fail-open 실패 모드에 구조적으로 취약하다 — 실제로 이 코드베이스에서 그 실패가 이미 3회 이상 재발했다(회전 secret 두 컬럼이 조인을 타고 샌 것이 이번 PR 의 발단, `triggerToken` 이 별도 라운드에서 뒤늦게 발견). 이번 PR 의 `sanitizeForResponse` JSDoc(611~625행) 스스로 "다음에 비밀 축이 하나 더 생기면 목록을 늘리지 말고 선언적 SoT(엔티티 데코레이터 등)로 옮길 것"이라고 명시적으로 남겨 뒀고, `review/code/2026/09/05/22_24_58` 라운드에서 이미 관찰·유예로 처분됐다(INFO#4/#5, "다음 재설계 때 allow-list 전환 우선 검토"). 현재 코드는 유닛·e2e 회귀 테스트로 알려진 4개 비밀 필드(`notificationSecretV2`·`chatChannelTokenV2`·`triggerToken`·`config.notification.signing.secret`)를 견고하게 고정하고 있어 **당장의 코드는 안전**하지만, 설계 자체의 구조적 위험은 남아 있다.
  - 제안: 즉시 조치 불요(이미 프로젝트가 인지·유예 결정함). 다음에 `sanitizeForResponse` 를 다시 만질 일이 생기면 `@Sensitive()` 데코레이터 + 리플렉션 기반 allow-list 전환을 이번 기회에 검토할 것.

- **[INFO]** `response-contract.ts`/`swagger-dto-contract-guard.ts` 는 테스트 전용 검증 유틸리티(`src/shared/testing/`, `src/repo-guards/__tests__/`)이며 런타임 보안 경계가 아니다 — 프로덕션 응답을 실제로 필터링하지 않고, drift 를 사후에 검출·회귀 고정하는 개발 시점 도구다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts`, `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
  - 상세: 두 파일 모두 AST(TypeScript compiler API) 기반 정밀 파싱과 실제 OpenAPI 문서 생성을 사용해 판정하므로 정규식 기반 오탐/누락 위험은 낮다. 다만 이 계층이 잡지 못하는 형태(예: 런타임에 동적으로 조립되는 응답 객체, `@ApiProperty` 데코레이터를 거치지 않는 raw `res.send()` 등)는 이 리뷰 범위 밖이며, 이 도구들이 "안전을 보장"하는 것이 아니라 "선언과 실측의 불일치를 드러내는" 도구임을 다음 리뷰어가 혼동하지 않도록 남긴다.
  - 제안: 조치 불요. 참고용 관찰.

## 확인된 보안 수정 사항 (긍정적)

이번 PR 은 §5.4 응답-계약 검증자를 4→18개 DTO 로 넓히는 과정에서 실측으로 드러난 **실제 자격증명 유출 2건**을 함께 닫았다. 직접 코드를 열어 확인한 결과:

1. `TriggersService.sanitizeForResponse`(`triggers.service.ts:627-705`) — 종전 `sanitizeChatChannelForResponse` 는 `config.chatChannel` 이 없으면 조기 return 하여 chat-channel 이 아닌 트리거는 정화를 전혀 거치지 않았고, `notification_secret_v2`(평문 서명 secret)·`chat_channel_token_v2`(secret store ref) 두 **엔티티 컬럼**은 애초에 대상이 아니었다. `GET/POST/PATCH /api/triggers` 의 `createQueryBuilder`/`findOne` 이 전 컬럼을 select 하므로 로테이션 유예 중이면 평문 secret 이 wire 로 나갔다. 현재는 조기 return 을 제거하고 4개 축(chat-channel JSONB · notification.signing JSONB · interaction JSONB · 엔티티 컬럼)을 모두 덮으며, `TRIGGER_RESPONSE_STRIP_COLUMNS` 는 `delete` 로 키 자체를 제거한다(직렬화 우회 대비).
2. `SchedulesController.toResponse`(`schedules.controller.ts:67-85`) — `GET/POST/PATCH /api/schedules` 가 `leftJoinAndSelect('s.trigger','t')`/`relations:['trigger']` 로 **Trigger 엔티티 전체**를 실었고, 트리거 자신의 응답에서 빼는 바로 그 비밀 컬럼이 조인을 타고 2차 유출됐다. 현재는 컨트롤러 응답 경계에서 `trigger` 를 참조 4필드(`id`·`name`·`workflowId`·`workflow.name`)로 명시적으로 좁힌다 — `findAll`/`findOne`/`create`/`update` 네 경로 모두 이 헬퍼를 거치는 것을 코드로 직접 확인했다.
3. `INTERACTION_RESPONSE_STRIP_KEYS`(`triggerToken`, `itk_*` 영구 평문 bearer 토큰)도 같은 라운드에서 `secret-store.md §1.1` 이 명시한 세 필드 중 누락돼 있던 것이 추가로 닫혔다.

세 곳 모두 유닛(`triggers.service.spec.ts:240-303,463-473` 등, `schedules.controller.spec.ts:31-32,77-78,97-98`)·e2e(`chat-channel-trigger-create.e2e-spec.ts`, `schedule-trigger.e2e-spec.ts`) 회귀 테스트가 비밀 필드 부재를 직접 단언하는 것을 확인했다. 워크스페이스 스코프(`{ id, workspaceId }` where 절)는 이번 diff 로 변경되지 않아 기존 격리 경계는 그대로 유지된다.

신규로 선언된 24개 DTO 필드(`AlertRuleDto.createdBy/lastTriggeredAt`, `IntegrationDto.appUrl/mallId/tokenExpiresAt/lastRotatedAt/lastUsedAt/consecutiveNetworkFailures`, `KnowledgeBaseDto` 7필드, `TriggerDto` 의 health/타임스탬프 7필드, `ScheduleDto.trigger`)를 엔티티 원본과 대조했다 — 전부 상태 메타데이터·타임스탬프·참조 ID 이고, `Integration.credentials`(암호화 컬럼, `maskCredentials` 로 별도 마스킹)·`Integration.installToken`·`Trigger.notificationSecretV2`·`Trigger.chatChannelTokenV2` 등 실제 비밀 값은 어느 것도 새로 노출되지 않았다. 하드코딩된 시크릿·API 키·평문 자격증명은 diff 전체에서 발견되지 않았다.

## 요약

이 PR 의 핵심은 응답-계약 검증자(§5.4)를 넓히는 과정에서 발견된 **트리거 회전 secret(평문 서명 secret + secret-store ref)의 2-경로 유출(트리거 직접 조회 + 스케줄 조인을 통한 2차 유출)**과 `triggerToken` 누락 스트립을 실제로 닫은 보안 수정이다. 직접 소스를 읽어 (1) 새 `sanitizeForResponse` 가 4개 비밀 축을 모두 덮고 모든 응답 경로(`findAll`/`findOneDetail`/`create`/`update`)에서 호출됨, (2) `SchedulesController.toResponse` 가 조인된 트리거를 참조 4필드로 좁혀 네 응답 경로 모두에 적용됨, (3) 신규 선언된 24개 필드 중 실제 비밀 값은 없음, (4) 유닛·e2e 회귀 테스트가 비밀 필드 부재를 직접 단언함을 확인했다. 남은 것은 deny-list 기반 정화의 구조적 fail-open 위험뿐이며, 이는 프로젝트가 이미 인지하고 후속 재설계 항목으로 명시적으로 유예한 상태다. 새로운 인젝션·인증 우회·하드코딩 시크릿·안전하지 않은 암호화는 발견되지 않았다.

## 위험도

NONE
