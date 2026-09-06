# Consistency Check 통합 보고서

**BLOCK: YES** — `notification_secret_v2` 저장 형태에 대한 spec 서술과 실제 코드 동작이 정면으로 모순되는 Critical 1건(cross_spec·rationale_continuity 두 checker 가 동일 사실을 각자 확인)이 있어 차단해야 한다.

## 전체 위험도
**CRITICAL** — `spec/5-system/14-external-interaction-api.md §7.1` 과 `spec/conventions/secret-store.md §1` 이 "ref 만 보관"이라 명시한 `notification_secret_v2` 컬럼이 실제로는 rotation-grace 24h 동안 평문으로 DB 에 존재하고 SecretResolver 를 우회한다 — secret-store.md 자신이 경고해 둔 "세 번째 필드가 근거 없이 예외를 얻는 실패 모드"가 이미 실현된 상태다. 그 외에는 문서 동기화 지연 수준의 WARNING/INFO 뿐이며, 이번 PR 자체(§5.4 응답-계약 검증자 확장 + 트리거 secret 이중 유출 차단)의 코드 품질은 건강하다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | `notification_secret_v2` 컬럼이 rotation-grace(24h) 동안 **평문**으로 DB 에 저장·소비되는데(`triggers.service.ts` `rotateNotificationSecret`/`promoteRotatedNotificationSecrets`, `notification-webhook.processor.ts:211-215` — SecretResolver 미경유), target spec 은 "ref 만 보관"이라 반대로 명시 | `spec/5-system/14-external-interaction-api.md` §7.1 (line 922) | `spec/conventions/secret-store.md` §1 예외 목록(등재 2건뿐: `AuthConfig.config`, `Trigger.config.interaction.triggerToken`)에 `notification_secret_v2` 미등재, §4 `SS-SE-01`("DB는 항상 ciphertext만") | (1) `secret-store.md §1`에 독립 근거를 갖는 세 번째 예외로 `notification_secret_v2` 등재 + `14-external-interaction-api.md §7.1` "ref만 보관" 문구를 사실(평문)로 정정, 또는 (2) 코드 측에서 해당 컬럼을 실제 ref 저장으로 전환(별도 설계 변경 PR). 두 경로 모두 `spec/` 쓰기가 필요 — 아래 §planner 인계 참조 |

## planner 인계 (권한 밖 Critical)

> 아래 항목은 등급 CRITICAL, `BLOCK: YES` 그대로이며, 다음 행동을 지정하는 표다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/5-system/14-external-interaction-api.md`·`spec/conventions/secret-store.md` 두 spec 문서의 정정이 필요하고 developer 는 `spec/` write 권한이 없다. 자기반증형 소정정 예외(CLAUDE.md) 미해당 — 대상 문장 "ref 만 보관"은 developer 가 이 PR 에서 새로 쓴 예고·트리거 문장이 아니라 2026-05-22(`ad0ea7cdb` #264)에 이미 확정된 저장 형태에 대한 API 계약/보안 invariant 서술이라, 조건 2("예고·트리거 한정, 제품정의·API계약 제외")를 충족하지 못한다 | project-planner | `14-external-interaction-api.md §7.1` 의 "notification_secret_v2 컬럼도 동일하게 ref 만 보관" 문구를 실측(24h grace 동안 평문)으로 정정. `secret-store.md §1` 예외 목록에 `Trigger.notification_secret_v2` 를 독립 근거(예: dual-sign hot-path 비용 트레이드오프)와 함께 세 번째 항목으로 등재하거나, 등재를 거부하고 코드측 ref화를 요구하는 결정을 명시 | `spec/5-system/14-external-interaction-api.md` §7.1, `spec/conventions/secret-store.md` §1 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 2 | convention_compliance | §5.4 를 시행하는 정적 가드(`swagger-dto-contract-guard.ts`)가 `2-api-convention.md` 의 `code:` 프런트매터에 미등재 — 같은 날 커밋이 다른 검증자(`response-contract.ts`)는 양쪽에 등재하며 세운 "양쪽 등재" 원칙을 자신이 못 지킴 | `spec/5-system/2-api-convention.md` 프런트매터 `code:` | `spec/conventions/swagger.md` 프런트매터(이미 등재됨) | `2-api-convention.md` 의 `code:` 에 `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts` 한 줄 추가 (planner 턴) |
| 3 | cross_spec | `IntegrationDto` 신규 5필드(`mallId`·`tokenExpiresAt`·`lastRotatedAt`·`lastUsedAt`·`consecutiveNetworkFailures`)가 nav-spec §9.1 표에 미등재 (데이터모델과는 모순 없음, 신규 노출도 아님 — 선언만 뒤늦게 정합) | `spec/2-navigation/4-integration.md` §9.1 | `spec/1-data-model.md §2.10` (엔티티엔 이미 정의됨) | §9.1 에 "derived 2필드 + 엔티티-그대로 노출 필드는 §2.10 참조" 포인터 한 줄 추가 |
| 4 | plan_coherence | HEAD 최신 커밋(`cb17f0870` — §5.4 금지조합 자기반박·정정 + 78건 래칫 가드 신설 + `ScheduleDto.trigger` wire 형태를 null-present→키 생략으로 변경)이 이 워크스트림 SoT 인 plan 트래커에 미반영 | `plan/in-progress/spec-draft-nullable-notation-followups.md` §후속 "§5.4 drift 배치 — 2단계"(:331), "종결 조건" 표(:728) | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`(신규 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 78건), `schedules.controller.ts`/`schedule-response.dto.ts` | plan `## 후속`에 (a) 자기반박·정정 경위 (b) 신규 78건 래칫이 기존 "78곳"(2단계 배치)과 다른 모집단임을 명시 (c) `ScheduleDto.trigger` 최종 wire 형태(키 생략) 기록 |
| 5 | naming_collision | 신규 `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(전수 래칫, 78건)와 기존 `OPTIONAL_NULLABLE_DRIFT`(`ExecutionDto` 전용, 10건)가 동일한 10개 필드를 상호 참조 없이 근접한 이름으로 중복 추적 — 한쪽만 상환 시 다른쪽이 조용히 stale화 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:365` | `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.spec.ts:63` | (a) 후자를 신규 래칫에 흡수시켜 중복 SoT 제거, 또는 (b) 양쪽 JSDoc 에 상호 참조 포인터 추가. `2-api-convention.md` "검증 층" 표에 상수 레벨 근접 명명 주의 한 줄 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `IntegrationDto.consecutiveNetworkFailures` 노출 지속 여부 — 이미 plan 에 검토 항목으로 등재됨 | `plan/in-progress/spec-draft-nullable-notation-followups.md` (신규 체크박스) | 조치 불요, 중복 등재 방지 차원 기록만 |
| 2 | convention_compliance | 신규 DTO 클래스(`ScheduleTriggerWorkflowRefDto`/`ScheduleTriggerRefDto`)의 클래스-레벨 JSDoc 에 보안사고 경위 서사가 포함 — `swagger.md §3` 관례상 `//` 로 옮기는 편이 맞으나, `@nestjs/swagger` 플러그인이 클래스 JSDoc 을 스키마로 승격하지 않음을 실측 확인해 현재는 공개 OpenAPI 유출 없음 | `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` | 필수 아님 — 경위 문단을 `//` 로 옮겨 형제 파일과 패턴 통일 권장 |
| 3 | plan_coherence | "스윕 착수 시 헬퍼로 접기" 항목의 "지금 2곳" 서술이 이미 이번 스윕만으로 낡음(실제로는 다수 파일에 패턴 확산) — plan 이 이미 헬퍼 도입을 의도적으로 유예해 둔 항목이라 결정 충돌 아님 | `plan/in-progress/spec-draft-nullable-notation-followups.md` (:266) | 급하지 않음 — 다음에 이 항목을 열 때 숫자만 실측치로 갱신 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | `notification_secret_v2` 평문 vs EIA §7.1 "ref만 보관" 모순 |
| rationale_continuity | CRITICAL | 동일 모순 — secret-store.md §1 미등재 예외 + 자신이 경고한 실패모드 실현 |
| convention_compliance | LOW | §5.4 검증자 양쪽 등재 원칙 자체 미준수(WARNING) + JSDoc 서사 배치(INFO, 실해 없음 확인) |
| plan_coherence | LOW | 최신 커밋(cb17f0870) plan 트래커 미반영(WARNING) |
| naming_collision | LOW | `EXPECTED_OPTIONAL_NULLABLE_DRIFT` vs `OPTIONAL_NULLABLE_DRIFT` 근접 명명 중복 추적(WARNING) |

## 권장 조치사항
1. (BLOCK 해소 우선) planner 턴에서 `spec/5-system/14-external-interaction-api.md §7.1`의 "notification_secret_v2 는 ref만 보관" 문구를 실측(평문)으로 정정하고, `spec/conventions/secret-store.md §1` 예외 목록에 해당 컬럼을 독립 근거와 함께 등재하거나 코드측 ref화 결정을 명시한다.
2. `plan/in-progress/spec-draft-nullable-notation-followups.md`에 `cb17f0870` 커밋 내용(자기반박·정정 경위, 신규 78건 래칫의 별개 모집단 성격, `ScheduleDto.trigger` wire 형태 변경)을 반영한다.
3. `spec/5-system/2-api-convention.md` 프런트매터 `code:`에 `swagger-dto-contract-guard.ts` 경로를 추가해 "양쪽 등재" 원칙을 자신부터 지킨다.
4. `spec/2-navigation/4-integration.md §9.1`에 `IntegrationDto` 확장 필드에 대한 `1-data-model.md §2.10` 포인터를 추가한다.
5. `EXPECTED_OPTIONAL_NULLABLE_DRIFT`/`OPTIONAL_NULLABLE_DRIFT` 중 하나로 SoT를 통합하거나 상호 참조 포인터를 추가해 근접 명명 중복을 해소한다.
