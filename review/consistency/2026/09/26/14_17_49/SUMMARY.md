# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 success, 전문 확보 완료)

## 전체 위험도
**LOW** — 순수 Swagger/OpenAPI 응답 스키마 광고 + 가드 강화(런타임 동작 불변). WARNING 2건은 모두 이번 PR 이전부터 존재하던 spec 간 서술 불일치이며 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소관으로 등재돼 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 자체가 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `interaction/revoke-token` 상태 전이 서술이 두 spec 에서 반대 — trigger-list.md 는 "폐기"(즉시 무효화), EIA §7.3 은 "rotation". EIA 문서 **내부**에서도 §7.3 vs EIA-AU-07 이 서로 어긋남 | `spec/2-navigation/2-trigger-list.md` §3 API 표, 구현: `triggers.controller.ts` (`InteractionRevokeTokenDto`) | `spec/5-system/14-external-interaction-api.md` §7.3 / EIA-AU-07 | 기존 spec 상태(이번 PR 신설 아님). 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 등재됨 — 후속 `--spec` 턴에서 문구 통일. 이번 PR 병합 차단 사유 아님 |
| 2 | cross_spec | `4-ai-assistant.md` §6 REST API 표에 `GET /api/workflow-assistant/sessions/latest` 행 누락 — 이번 PR 이 그 라우트에 `@ApiOkWrappedNullableResponse` 를 붙여 OpenAPI 로 정식 노출시켜 격차가 더 뚜렷해짐 | `spec/3-workflow-editor/4-ai-assistant.md` §6 표 | 코드 `workflow-assistant.controller.ts` `@Get('sessions/latest')`, 및 동일 문서 §6.1 서술 | 기존 spec 갭(이번 PR 신설 아님). 동일 트래커 파일에 planner 항목으로 이미 등재됨. developer 범위 밖 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `4-ai-assistant.md` §6 "모든 엔드포인트는 editor 이상 역할 필요" 서술이 `list`/`latest`/`findOne` 의 실제 가드(워크스페이스 멤버십만, editor 아님)와 다름. 동작 변경 없음, 이번 PR 이 그 3개 GET 계약을 처음 OpenAPI 로 정식화한 시점이라 기록 | `spec/3-workflow-editor/4-ai-assistant.md` §6 본문 | 다음 spec 정리 때 "쓰기 계열은 editor 이상, 조회는 워크스페이스 멤버"로 정정 권장 |
| 2 | rationale_continuity | `spec/conventions/swagger.md` §2-4 Rationale 번복(빈 광고 라우트를 이제 위반으로 잡음) — 새 근거는 동일 문단에 실측(15곳 중 11곳 채움, 나머지 4곳 예외 사유)과 함께 적혔으나, trigger-list.md R-2 처럼 원문을 취소선으로 남기는 관례는 따르지 않음 | `spec/conventions/swagger.md` §2-4 하단 Rationale, 커밋 `24084fd0e` | 향후 규약 번복 시 R-2 처럼 원문 취소선 + "정정(날짜)" 박스 권장(강제 아님) |
| 3 | rationale_continuity | `AssistantToolCallDto.arguments`/`result` 의 열린-map 예외(§1-4) 근거가 DTO 의 `## Rationale` 이 아니라 코드 `//` 주석에만 있음. 다만 저장소 기존 DTO(`assistant-message-request.dto.ts` 등)에도 동일 관행이 이미 반복돼 있어 이번 diff 가 새 해석을 도입한 것은 아님 | `codebase/backend/src/modules/workflow-assistant/dto/responses/assistant-session-response.dto.ts` | 급하지 않음 — §1-4 문구를 "`## Rationale` 또는 인접 주석"으로 완화하거나 기존 DTO 소급 정리는 별도 트래커로 |
| 4 | convention_compliance | `spec/conventions/swagger.md` §5-2 `ApiOkWrappedNullableResponse` 행에 `allOf`+`nullable` 구현 함정(“OpenAPI 3.0 은 `$ref` 옆 형제 키 무시”) 각주가 아직 없음 — 직전 `--impl-prep` INFO 가 "구현 커밋에서 반영" 하라 했는데 그 구현 커밋(`api-wrapped.ts`)이 JSDoc 에만 남기고 영구 문서에는 옮기지 않음 | `spec/conventions/swagger.md` §5-2 표, `ApiOkWrappedNullableResponse` 행 | §5-2 행 아래 "구현은 `allOf:[<ref>]`+`nullable`(§1-4 와 같은 사정)" 각주 한 줄 추가. 차단 사유 아님, 비용 1줄 |
| 5 | plan_coherence | 선행 draft plan `spec-draft-swagger-success-advert.md` 이 아직 `status: in-progress` — 내용(4개 변경안)은 `swagger.md` 에 완전히 반영됐으나 lifecycle 정리(complete 이동/구현 plan 흡수)가 안 됨 | `plan/in-progress/spec-draft-swagger-success-advert.md` frontmatter | `success-advert.md` 남은 체크리스트(트래커 항목 닫기) 완료 커밋에서 이 draft 도 함께 `plan/complete/` 이동 또는 구현 plan 에 병합 |
| 6 | plan_coherence | 트래커 `spec-draft-nullable-notation-followups.md:5130` "성공 응답 미광고 라우트 15곳" 항목이 아직 미체크 — `success-advert.md` 자체가 "`--impl-done` 통과 후" 로 순서화해 둔 정상 시퀀스 | `plan/in-progress/spec-draft-nullable-notation-followups.md:5130` | 없음 — `--impl-done` 통과 후 체크 + 커밋 SHA 기록 |
| 7 | plan_coherence | 인접 트래커 2건(`sessions/latest` 표 누락, `revoke-token` 명명 불일치)을 이번 PR 이 선점적으로 확정하지 않고 트래커에만 정확히 등재 — 적절한 처분(위 WARNING #1·#2 와 동일 항목) | `spec-draft-nullable-notation-followups.md:5118`, `:5124` | 없음 — 별도 planner 턴에서 처리 |
| 8 | naming_collision | 신규 식별자(DTO 8종, `wrapNullableDataSchema`/`ApiOkWrappedNullableResponse`, 가드 내부 타입 5종, enum 5종, 신규 파일 경로 2개) 전수를 저장소 전체(`codebase/`·`spec/`·`plan/`)와 대조 — 리터럴 동명·의미 충돌 0건, 신규 endpoint·env var·큐/이벤트명 도입도 없음 | 다수 (`trigger-secret-issue-response.dto.ts`, `assistant-session-response.dto.ts`, `http-status-advertised-guard.ts` 등) | 없음 — 그대로 유지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | Critical 0. WARNING 2건 모두 기존 spec 상태(이번 PR 신설 아님), 이미 planner 트래커 등재. INFO 1건(§6 역할 서술 불일치) |
| rationale_continuity | LOW | 결정 번복(§2-4) 은 동일 문단에 실측 근거 동반 — 프로젝트 요구 원칙 충족. INFO 2건은 문서 스타일·근거 배치 제안 |
| convention_compliance | LOW | 신설 규약(§2-4/§5-2) 을 코드가 정확히 채움, 직전 라운드 WARNING 은 구현으로 해소됨. INFO 1건(문서 각주 미기재) |
| plan_coherence | LOW | 정규 절차(draft → `--spec` → `--impl-prep` → 구현) 그대로 준수, 다른 진행 plan 영역 미침범. INFO 3건 모두 lifecycle 마무리 절차 |
| naming_collision | NONE | 신규 식별자 전수 충돌 0건, 명명 관례(도메인 접두) 그대로 준수, 신규 endpoint/env/큐 없음 |

## 권장 조치사항
1. (BLOCK 해소 우선) 해당 없음 — Critical 없음, 즉시 병합 가능.
2. WARNING 2건(`revoke-token` 폐기/rotation 용어 불일치, `sessions/latest` §6 표 누락)은 developer 범위 밖 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소관으로 등재돼 있으므로 별도 조치 불요, 후속 planner `--spec` 턴에서 처리.
3. `plan/in-progress/spec-draft-swagger-success-advert.md` 는 내용이 이미 반영됐으므로 이번 PR 마무리 커밋에서 `plan/complete/` 로 이동 또는 구현 plan 에 병합 정리.
4. (선택, 비차단) `spec/conventions/swagger.md` §5-2 `ApiOkWrappedNullableResponse` 행에 `allOf`+`nullable` 구현 함정 각주 1줄 추가.
