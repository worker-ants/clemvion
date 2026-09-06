# Consistency Check 통합 보고서

**BLOCK: YES** — `config.interaction.triggerToken`(트리거 회전 토큰) 이 여전히 `GET/POST/PATCH
/api/triggers` 응답에 평문 노출된다. `spec/conventions/secret-store.md §1.1` 이 응답 노출을
명시 금지하는 3개 필드 중 하나이며, 이 PR 이 나머지 2개(`notification_secret_v2`,
`chat_channel_token_v2`)는 닫으면서 이 필드만 남겼다.

## 전체 위험도
**CRITICAL** — 회전 토큰 잔여 노출 1건이 차단 사유. 그 외 WARNING 2건(JSDoc 내부 경로 노출,
plan 트래커 누락)은 비차단.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `Trigger.config.interaction.triggerToken`(per-trigger 영구 평문 회전 토큰 `itk_*`)이 `sanitizeForResponse` 스트립 대상에서 빠져 `GET/POST/PATCH /api/triggers` 응답에 그대로 노출된다. `TriggerDto.config` 가 `additionalProperties: true` 인 열린 스키마라 이 PR 이 신설한 §5.4 응답-계약 검증자·swagger-dto-contract-guard 모두 이 누락을 탐지하지 못한다 | `codebase/backend/src/modules/triggers/triggers.service.ts` `sanitizeForResponse()`(구 `sanitizeChatChannelForResponse`, L555 부근) | `spec/conventions/secret-store.md §1.1` — "`secret://` 밖에 사는 필드(AuthConfig.config 자격증명 · `Trigger.config.interaction.triggerToken` · `Trigger.notification_secret_v2`)... 는 응답 바디에 실려서도 안 된다" 명시 열거 3필드 중 1. §1 이 `itk_*` 를 secret store 비통합 예외로 인정하는 근거(c) "발급 응답에 1회만 노출" 전제도 이 누락으로 깨진다. RBAC §3.2(Trigger: Viewer 도 R) 상 노출 인구도 좁지 않다 | `NOTIFICATION_SIGNING_STRIP_KEYS` 와 동형인 `INTERACTION_RESPONSE_STRIP_KEYS = new Set(['triggerToken'])` 를 `sanitizeForResponse` 에 추가해 `config.interaction.triggerToken` 스트립(발급/재발급 엔드포인트의 1회성 평문 응답은 `revokePerTriggerToken` 직접 반환값이라 영향 없음). 회귀 e2e: `per_trigger` 전략 트리거 생성 후 `GET /api/triggers`·`GET /api/triggers/:id` 응답에 `triggerToken` 부재 단언 |

## planner 인계 (권한 밖 Critical)

> (없음) — 위 Critical 의 근본 원인은 `sanitizeForResponse` 의 스트립 목록 누락이라는 **코드
> 커버리지 갭**이며, `spec/conventions/secret-store.md §1.1` 자체는 이미 이 필드를 정확히
> 금지 대상으로 열거하고 있어 spec 정정이 필요하지 않다. developer 권한 내에서 코드 수정으로
> 해소 가능하므로 planner 인계 대상이 아니다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `ScheduleDto.trigger` 필드 JSDoc 에 내부 리뷰 라운드 참조(`review/consistency/2026/09/05/21_40_38 W1`)가 그대로 실려 `nest-cli.json` 의 `introspectComments:true` 로 **공개 OpenAPI `description`** 으로 승격된다 | `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` L95-106 `ScheduleDto.trigger` docblock (커밋 `7e85da873`) | `spec/conventions/swagger.md §3` — "JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사(리뷰·PR 참조)를 담지 않는다" | `review/consistency/...` 절만 필드 선언 바로 위 `//` 주석으로 옮기고, `/** */` 에는 소비자 관점 설명("연결된 트리거 — 참조 수준, 항상 존재")만 남긴다 |
| 2 | plan_coherence | 같은 커밋(`7e85da873`)이 신설한 §5.4 key-omission 필드 `TriggerDto.workflow` 가 nav-spec 문서화 후속 트래커에서 빠졌다 — 자매 필드 `ScheduleDto.trigger.workflow` 만 등재됨 | `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` `TriggerWorkflowRefDto`/`TriggerDto.workflow` / `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `ScheduleDto.trigger/workflow` bullet | `spec/5-system/2-api-convention.md §5.4` — 키 생략은 "그 필드를 문서화하는 절에 사유 명시" 요구, 신규 도입 필드는 소급 예외 미적용 | 해당 plan bullet 제목·본문을 `TriggerDto`/`ScheduleDto` 의 `trigger`/`workflow` 참조 필드 전체를 포함하도록 확장(또는 별도 bullet 신설), nav-spec(`2-trigger-list.md`·`3-schedule.md §4`) 반영 대상에 `TriggerDto.workflow` 포함 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | 클래스 레벨 JSDoc 에 내부 경위·리뷰 참조가 3번째로 반복(`TriggerWorkflowRefDto` 신규, `ScheduleTriggerWorkflowRefDto` 기존) — `introspectComments` 는 클래스 레벨엔 승격 안 해 실제 wire 유출은 없음 | `trigger-response.dto.ts` L9-17, `schedule-response.dto.ts` L3-14 | 비차단. 다음 편집 시 경위 문단을 `//` 블록으로 이동 권장 (WARNING #1 과 근본 원인 동일 — 습관적 패턴) |
| 2 | rationale_continuity | `spec/conventions/secret-store.md §1` 의 "노출 창이 아직 설계대로 닫혀 있지 않다" 서술이 이 브랜치 머지로 stale 화됨 | `spec/conventions/secret-store.md §1` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 몫 항목으로 등재(2026-09-05, `21_40_38` W2) — 별도 조치 불요, 머지 후 planner 턴에서 소비 |
| 3 | rationale_continuity | `ScheduleDto.trigger`/`workflow` 의 §5.4 키-생략 사유가 코드 JSDoc 에만 있고 nav-spec(`spec/2-navigation/3-schedule.md`)엔 아직 미반영 | `schedule-response.dto.ts` `ScheduleTriggerRefDto.workflow` | 이미 tracker 등재(`21_40_38` W1, WARNING #2 로 확장 예정) — 별도 조치 불요 |
| 4 | plan_coherence | `IntegrationDto.appUrl` 필드가 자매 plan(`spec-draft-notification-secret-storage.md`)의 "머지 후 반영할 5필드" 열거에 빠짐(사소한 열거 누락) | `integration-response.dto.ts` `IntegrationDto.appUrl` | 별도 항목 불요, 머지 후 planner 가 실제 diff 보고 반영 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | `config.interaction.triggerToken` 이 secret-store.md §1.1 이 금지한 응답 노출 상태로 잔존 |
| rationale_continuity | LOW | Rationale 위반 없음(오히려 secret-store §1.1 요구 이행). stale 서술 2건은 이미 plan 추적 중 |
| convention_compliance | LOW | 신규 WARNING 1건(필드 JSDoc 내부 경로 노출) + INFO 1건(클래스 JSDoc 재발) — §5.4 금지 조합·secret-store §1.1·numeric 타입 등은 전수 준수 확인 |
| plan_coherence | LOW | `TriggerDto.workflow` nav-spec 후속 트래커 누락 WARNING 1건, 그 외 결정 우회·선행 plan 미해소 없음 |
| naming_collision | NONE | 신규 식별자 전수 대조 충돌 없음. 이전 라운드 WARNING(근접 명명)은 상호 JSDoc 포인터로 이미 해소 확인 |

## 권장 조치사항
1. (BLOCK 해소) `TriggersService.sanitizeForResponse` 에 `INTERACTION_RESPONSE_STRIP_KEYS`(`triggerToken`) 추가해 `config.interaction.triggerToken` 스트립 + `GET /api/triggers`(목록/상세) 회귀 e2e 로 부재 단언
2. `ScheduleDto.trigger` JSDoc 의 내부 리뷰 경로 참조를 `//` 주석으로 이동(공개 OpenAPI description 유출 차단)
3. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 nav-spec 문서화 bullet 에 `TriggerDto.workflow` 추가
4. (선택, 비차단) `TriggerWorkflowRefDto`/`ScheduleTriggerWorkflowRefDto` 클래스 docblock 경위 서술 정리, `IntegrationDto.appUrl` 을 자매 plan 열거에 보완
