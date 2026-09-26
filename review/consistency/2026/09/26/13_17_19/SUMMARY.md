# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 전문 확보, 재시도 필요 항목 없음)

## 전체 위험도
**LOW** — 구현 착수(`plan/in-progress/success-advert.md`: 래퍼 `ApiOkWrappedNullableResponse` + 응답 DTO 11곳 + 가드 강화)를 막는 직접 모순은 없으나, spec 문서 갭 2건·완료형 서술 1건·명명 사전 조율 1건이 방치되면 다음 사람의 판단을 그르칠 수 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, plan_coherence | `GET /api/workflow-assistant/sessions/latest` 가 도메인 spec API 표에 아예 없음 — 이번 PR 이 `ApiOkWrappedNullableResponse` 로 이 라우트를 OpenAPI 상 정식 광고하면서 "코드엔 있는데 제품 spec 표엔 없는" 격차가 더 눈에 띄게 된다 | `spec/3-workflow-editor/4-ai-assistant.md` §6 REST API 표 (약 585~590행, 5개 라우트만 등재) | `plan/in-progress/success-advert.md` 실측표의 `latest` 행; 실제 컨트롤러 `workflow-assistant.controller.ts:73` `@Get('sessions/latest')` | 이번 PR 또는 후속 plan 에서 §6 표에 `GET /api/workflow-assistant/sessions/latest` 행 추가(쿼리 `workflowId` 필수, 없으면 `null`, 권한=멤버십만). `success-advert.md`/`spec-draft-swagger-success-advert.md` 어느 `spec_impact` 에도 없고 트래커에도 없어 소유자가 없는 gap — 이번 PR 범위 포함 여부를 명시적으로 결정해 트래커에 남길 것 |
| 2 | cross_spec | `interaction/revoke-token` 의 상태 전이를 "회전이 아니라 폐기"(trigger-list) vs "새 값으로 rotation"(EIA §7.3/AU-07) 로 두 target 문서가 반대로 서술 — 실제 구현(`revokePerTriggerToken`)은 무효화+신규 발급으로 EIA 쪽이 메커니즘상 정확함 | `spec/2-navigation/2-trigger-list.md` §3 API 표 — `interaction/revoke-token` 행 "회전이 아니라 폐기다" | `spec/5-system/14-external-interaction-api.md` §7.3(약 961행) "새로운 값으로 rotation" 및 EIA-AU-07(약 111행) | `trigger-list.md` 문구를 EIA-AU-07 의 실제 논거(메커니즘은 회전·감사 액션명만 대화 단절 강조해 `_revoked` 로 구분)로 정정 또는 완화. 신규 작성할 컨트롤러 JSDoc/응답 DTO 설명(`{ token }` 반환)은 EIA §7.3 표현을 따를 것 — JSDoc 이 그대로 공개 OpenAPI 로 나가는 규약(swagger.md §3)상 어긋난 어투가 고정되면 되돌리기 비용이 커진다 |
| 3 | rationale_continuity | Assistant `tool_calls[*].arguments`/`result` 를 `additionalProperties: true` 로 여는 근거("키 집합이 런타임에 정해진다")가 `swagger.md` §1-4 가 명시적으로 기각한 "타입 특정이 번거롭다" 프레이밍과 표면상 구별되지 않음. 도구 16종·인자/반환 형태는 코드로 확정 + `4-ai-assistant.md` §4에 인터페이스까지 문서화돼 있어 §1-4 가 닫힌 union 을 요구하는 사례와 구조적으로 동일 | (저장소 밖 구현 초안) `assistant-session-response.dto.ts` `AssistantToolCallDto.arguments`/`result` 주석; `plan/in-progress/success-advert.md` "방향" §3항 | `spec/conventions/swagger.md` §1-4 Rationale/본문 ("타입을 특정하기 번거롭다는 사유로 쓰지 않는다") | 실제 완화 근거(엔티티 `Record<string, unknown>`/프런트 타입이 이미 양쪽 다 미분화 선언 — EIA `context` 사례처럼 한쪽만 몰래 좁힌 타입이 없어 drift 위험 없음)를 draft DTO 주석 또는 §1-4 Rationale 에 명시적으로 옮겨 적을 것. 그렇지 않으면 다음 리뷰에서 "§1-4 위반"으로 재지적될 소지가 크다 |
| 4 | convention_compliance | `## Rationale` §2-4 절 불릿이 아직 착수 전인 작업(래퍼·11곳 DTO·가드 강화 — `success-advert.md` 체크리스트 전부 미체크, `ApiOkWrappedNullableResponse` grep 0건, 가드 코드 미변경)을 완료형으로 서술 — `spec-impl-evidence.md` §3 이 요구하는 "지금 구현됨" 원칙과 어긋남. 직전 `--spec` 라운드(`review/consistency/2026/09/26/13_07_11` WARNING #1)가 이미 지적했으나 경로 인용만 지우고 시제는 유지된 채 재커밋됨(불충분 봉합) | `spec/conventions/swagger.md` `### §2-4 광고한 성공 코드 ↔ 실제 성공 코드 — 왜 가드로 세는가` 절, 약 697-700행 "이 규칙과 같은 변경에서 11곳을 채웠고 ... 가드가 실패한다" | `plan/in-progress/success-advert.md` 체크리스트(전부 미체크); `http-status-advertised-guard.ts` 주석(여전히 옛 동작 — "광고 없으면 통과") | (a) 불릿 시제를 예정형으로 낮추거나("채운다, 진행 중"), (b) `status: partial` + `pending_plans` 로 frontmatter 를 내리거나, (c, 선호) 직전 두 선례(`dde7c3013`/`1335f8174`)처럼 이 Rationale 구절 자체를 가드/DTO 반영 커밋에 합쳐, 지금 커밋에서는 규칙 정의만 반영 |
| 5 | naming_collision | workflow-assistant 응답 DTO 6종(세션·세션상세·메시지 등)의 클래스명이 아직 미정 — 일반명("세션"·"메시지")을 그대로 쓰면 다른 모듈 기존 DTO 와 개념이 겹쳐 OpenAPI 스키마 목록에서 혼동 가능 | `plan/in-progress/success-advert.md` "실측" 표 workflow-assistant 행 (구체적 클래스명 미정) | `codebase/backend/src/modules/auth/dto/responses/session.dto.ts` `SessionDto`/`SessionListDto`; `codebase/backend/src/modules/users/dto/responses/user-response.dto.ts` `MessageResponseDto` | 같은 모듈 기존 형제 DTO(`CreateAssistantSessionDto`·`UpdateAssistantSessionDto`·`AssistantMessageRequestDto`)가 이미 쓰는 `Assistant` 접두 관례를 따라 `AssistantSessionDto`/`AssistantSessionListDto`/`AssistantSessionDetailDto`/`AssistantMessageDto` 로 명명(grep 확인상 미존재, 충돌 없음). 리터럴 동명 충돌 자체는 `dto-class-name-collision.spec.ts` 가드가 빌드 시점에 잡음 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `notification/rotate-secret`·`interaction/revoke-token` 응답 DTO 는 기각된 R-2 가 아니라 살아있는 EIA-NX-12/EIA-AU-07 을 그대로 미러링 — 재도입 리스크 없음, 재확인 기록 | `trigger-secret-issue-response.dto.ts`(초안) vs `spec/2-navigation/2-trigger-list.md` R-2(폐기) / `spec/5-system/14-external-interaction-api.md` EIA-NX-12·AU-07 | 조치 불요. 다만 R-2 표제("Webhook HMAC secret 입력 vs rotate 분리")와 이름이 비슷해 혼동 소지 있으므로 "이 rotate 는 R-2 아니라 EIA-NX-12 대상"이라는 각주를 남겨두면 재조사 비용 절감 |
| 2 | rationale_continuity | 세션 응답 DTO 구성(nullable-but-present vs key-absent 구분)이 §5.4/§1-4 판단 근거를 정확히 따름 — 위반 없음 | draft `AssistantSessionDto`/`AssistantSessionDetailDto` 등 | 조치 불요 |
| 3 | convention_compliance | §5-2 신규 `ApiOkWrappedNullableResponse` 표 행이 §1-4 가 이미 문서화한 `nullable`+`$ref` 형제 키 무시 함정(`allOf` 래핑 필요)을 정식 문서에 재언급하지 않음 — 현재는 draft plan Rationale 에만 있음 | `spec/conventions/swagger.md` §5-2 표 | 헬퍼 구현 커밋에서 표 행 또는 주석에 "구현은 `allOf` 로 감싸 `nullable` 을 붙인다" 한 줄 추가 |
| 4 | convention_compliance | `swagger.md` 에 명시적 `## Overview` 섹션 없음 — 이번 diff 범위 밖, 기존 상태 | `spec/conventions/swagger.md` 최상단 | 즉시 조치 불요, 차후 구조 정리 시 고려 |
| 5 | plan_coherence | `success-advert.md` 체크리스트 `[ ] spec draft \`--spec\`·반영` 이 미체크 — 실제로는 `24084fd0e` 로 이미 완료됨(`git log` 확인) | `plan/in-progress/success-advert.md` 체크리스트 | 이번 `--impl-prep` 통과 후 커밋 시 두 체크박스(`spec draft·반영`, `--impl-prep`) 함께 갱신 |
| 6 | plan_coherence | "자원을 만들지 않는 POST" 상태 코드 분류 미해결 결정을 target 이 우회하지 않고 트래커(`spec-draft-nullable-notation-followups.md:4881`)와 정확히 일치하게 유보 — 문제 아님, 교차검증 기록 | `spec/conventions/swagger.md` §2-4 Rationale 마지막 문단 | 조치 불요 |
| 7 | naming_collision | `ApiOkWrappedNullableResponse` — grep 0건, 기존 `ApiOk*Response` 명명 패턴 정확히 준수, 충돌 없음 | `spec/conventions/swagger.md` §5-2 신규 행 | 조치 불요 |
| 8 | naming_collision | `notification/rotate-secret`·`interaction/revoke-token` 신규 응답 DTO 2종 이름 미정 — generic 이름 사용 시 `RefreshTokenResponseDto`(EIA) 와 개념 인접 우려 | `codebase/backend/src/modules/triggers/dto/responses/` (신규) | 같은 모듈 선례 `ChatChannelRotateBotTokenDto` 처럼 도메인 접두 적용 — `NotificationRotateSecretResponseDto`/`InteractionRevokeTokenResponseDto` |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `sessions/latest` 미등재, `revoke-token` 서술 상충 — 둘 다 구현 진행 가능하나 문서 정정 필요 |
| rationale_continuity | LOW | 핵심 변경은 신규 Rationale 근거 보유·트래커 등재 확인됨. `tool_calls` open map 근거 문구만 §1-4 기각 사유와 겹쳐 보임(실무적 방어는 가능하나 미문서화) |
| convention_compliance | LOW | 신규 규칙/래퍼/체크리스트 문구는 conventions 와 정합. Rationale 완료형 서술이 직전 라운드 지적을 불충분하게만 봉합 |
| plan_coherence | LOW | 트래커 실측 수치와 완전 일치, 미해결 결정 우회 없음. `sessions/latest` spec 표 누락이 유일한 실질 갭이며 소유자 없음 |
| naming_collision | LOW | 신규 식별자 `ApiOkWrappedNullableResponse` 충돌 없음. 향후 DTO 6~8종 명명은 `Assistant`/도메인 접두 관례 따르면 충돌 회피 가능 |

## 권장 조치사항

1. (BLOCK 해소 우선 — 단, 이번 라운드는 BLOCK:NO 이므로 순서는 착수 전 정리 우선순위) `spec/conventions/swagger.md` §2-4 Rationale 불릿의 완료형 서술을 예정형으로 낮추거나, 가드/DTO 반영 커밋과 합쳐 재작성한다 (WARNING #4) — 직전 라운드 지적이 불충분 봉합된 재발 항목이라 우선순위가 가장 높다.
2. `interaction/revoke-token` 상태 전이 서술을 EIA-AU-07 기준으로 정정하고, 신규 컨트롤러 JSDoc 을 그 표현에 맞춘다 (WARNING #2) — JSDoc 이 그대로 공개 OpenAPI 로 나가므로 착수 전 정리가 되돌리기 비용을 줄인다.
3. `spec/3-workflow-editor/4-ai-assistant.md` §6 표에 `GET /sessions/latest` 행 추가 여부를 이번 PR 범위로 결정하고 트래커/`spec_impact` 에 명시 (WARNING #1).
4. workflow-assistant 응답 DTO 6종과 triggers 응답 DTO 2종의 클래스명을 구현 착수 전에 `Assistant`/도메인 접두 관례로 사전 확정 (WARNING #5, INFO #8).
5. Assistant `tool_calls.arguments`/`result` open map 근거를 draft 주석 또는 §1-4 Rationale 에 명시적으로 기록 (WARNING #3) — 다음 리뷰의 재지적 방지.
6. `success-advert.md` 체크리스트의 완료된 단계(`spec draft·반영`)를 이번 커밋에서 갱신 (INFO #5).
7. `ApiOkWrappedNullableResponse` 구현 커밋에서 §5-2 표에 `allOf`+`nullable` 함정 주의 문구 한 줄 추가 (INFO #3).
