# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. 동일 사안(신규 400 분기 미반영)을 2개 checker 가 WARNING, 2개 checker 가 INFO 로 각각 지적했으나 가장 강한 등급인 WARNING 으로 통합해도 차단 사유는 아님(둘 다 developer 권한 밖 spec 문서이며 이미 planner 항목으로 등재 완료 확인됨).

## 전체 위험도
**LOW** — target(`spec/5-system/`) 델타 0(코드 전용 PR). 실제 diff(`ParseUUIDPipe`/`@ApiParam format:'uuid'` 하드닝 + repo-guard 신설 + 가이드 문서 오귀속 정정)는 기존 invariant(`data-flow/12-workspace.md` UUID 검증 강도 비대칭)를 위반하지 않고 오히려 마지막 예외를 닫는 방향. 유일한 잔여 갭은 spec 카탈로그 문서 지연(lag)이며 이미 추적 중.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — 아래 WARNING 항목들이 권한 밖 spec 갭이긴 하나 등급이 CRITICAL 이 아니므로 이 표의 적용 대상 아님. 단, 두 항목 모두 다음 planner 턴에서 처리될 필요가 있어 "권장 조치사항"에 명시함.)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance (WARNING) / rationale_continuity, plan_coherence (INFO — 통합 시 최강 등급 WARNING 채택) | `rotateBotToken`(`triggers.controller.ts`)에 `ParseUUIDPipe` 부착으로 `:id` 가 UUID 형식이 아닐 때 신규 `400 VALIDATION_ERROR` 관측 가능 분기가 생겼으나, 이 엔드포인트의 canonical 실패-응답 카탈로그가 이를 반영하지 못함 | `spec/5-system/15-chat-channel.md §5.4`(실패 응답 표, ~369~380행) 및 echo 대상 `spec/5-system/3-error-handling.md §1.12` | 실제 코드(`@ApiBadRequestResponse`)·`CHANGELOG.md`·유저가이드(4곳 MDX)는 이미 반영, spec 표만 지연 | `spec/5-system/15-chat-channel.md §5.4` 표에 `400 \| VALIDATION_ERROR \| :id 가 UUID 형식이 아님 (ParseUUIDPipe)` 행 추가 — **project-planner 소관**. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재됨(확인됨) |
| 2 | convention_compliance, cross_spec (WARNING) / rationale_continuity (INFO — 통합 시 WARNING 채택) | `swagger.md §5-4` 새 엔드포인트 체크리스트가 UUID 경로 파라미터의 "문서 축"(`@ApiParam format:'uuid'`)만 요구하고 "런타임 축"(`ParseUUIDPipe`)을 명시하지 않음 — 신규 `param-uuid-pipe` 가드는 두 축을 모두 강제하도록 설계되어 규약 문면보다 코드가 더 엄격한 상태 | `spec/conventions/swagger.md §5-4` 새 엔드포인트 체크리스트 | 저장소 실측: id-형 `@Param` 136/136 이 이미 `ParseUUIDPipe` 보유(이번 PR 이 마지막 1건을 채움) — 관례는 완성됐지만 규약 문서가 못 따라감 | `swagger.md §5-4` 항목을 "`@Param(name, ParseUUIDPipe)` + `@ApiParam({format:'uuid'})` 두 축 모두 적용"으로 확장 — **project-planner 소관**. 같은 plan 문서에 이미 등재됨(확인됨). 2026-08-08 선례(§5-4 확장 배경)와 같은 톤으로 갱신 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | naming_collision | `plan/in-progress/trigger-uuid-and-guide-error-codes.md`(신규)와 `plan/complete/trigger-endpoint-path-uuid-validate.md`(완료, 무관한 DB CHECK 제약 건)가 "trigger"+"uuid" 토큰이 겹쳐 향후 grep 검색 시 혼동 가능 | `plan/in-progress/trigger-uuid-and-guide-error-codes.md` | 의미 충돌 없음, 조치 불요. 필요시 신규 문서 서두에 "DB 컬럼 제약이 아니라 컨트롤러 경로 파라미터 검증"이라는 스코프 고지 한 줄 추가 |
| 2 | plan_coherence | `spec/5-system/15-chat-channel.md` frontmatter `pending_plans:`에 이번에 등재된 두 WARNING 항목의 tracker(`spec-draft-nullable-notation-followups.md`)가 아직 cross-reference 되어 있지 않음(기존 3개 chat-channel 전용 plan만 등재) | `spec/5-system/15-chat-channel.md` frontmatter | 다음 planner 턴에서 §5.4 표 갱신과 함께 `pending_plans:` 갱신 여부 검토(그 필드가 "구현 완료·문서만 지연" 케이스도 대상인지는 모호 — 판단은 planner) |
| 3 | cross_spec, rationale_continuity, convention_compliance | `TRIGGER_NOT_FOUND`→`RESOURCE_NOT_FOUND` 오귀속 정정(가이드 4곳·`backend-labels.ts`), `MCP_INSECURE_URL_ALLOWED`→`MCP_ALLOW_INSECURE_URL` 오타 정정, `switchWorkspace` `@ApiParam format:'uuid'` 추가는 모두 기존 spec/코드 정본과 정확히 일치하는 방향으로 확인됨(신규 결함 아님) | `codebase/frontend/src/lib/i18n/backend-labels.ts` 외 | 조치 불요 — 정합 확인 완료 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `15-chat-channel.md §5.4`/`swagger.md §5-4` 문서 지연 2건(이미 추적 중), 그 외 오귀속 정정 전부 정합 확인 |
| rationale_continuity | LOW | 동일 2건을 INFO 로 관찰, `data-flow/12-workspace.md` UUID 검증 강도 비대칭 invariant 를 오히려 강화하는 방향으로 확인 |
| convention_compliance | LOW | 동일 2건 WARNING, 명명·에러코드·Swagger 데코레이터·리뷰 인용·i18n 규약 등 준수 항목 다수 확인, 위반 없음 |
| plan_coherence | NONE | 두 갭 모두 developer 가 자기-반증형 소정정 조건 미충족을 정확히 판정해 planner 항목으로 등재 완료. 결정 충돌·중복 등록 없음 |
| naming_collision | NONE | 신규 식별자(타입·함수·파일 경로)는 저장소 전수 grep 기준 충돌 없음. plan 파일명 근접만 INFO |

## 권장 조치사항
1. (BLOCK 해소 대상 없음 — 참고용) 다음 `project-planner` 턴에서 `spec/5-system/15-chat-channel.md §5.4` 표에 `400 VALIDATION_ERROR (:id 가 UUID 형식이 아님)` 행을 추가하고, 같은 턴에 `spec/conventions/swagger.md §5-4` 체크리스트에 `ParseUUIDPipe` 런타임 축을 함께 명시할 것 — 두 갭이 같은 실측(`param-uuid-pipe` 가드)에서 나왔으므로 한 번에 닫는 것이 효율적.
2. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 두 항목이 정확히 등재돼 있음을 확인(developer 처리 완료) — 이번 PR 자체는 차단 사유 없이 진행 가능.
3. (선택) `plan/in-progress/trigger-uuid-and-guide-error-codes.md` 서두에 "DB 컬럼 제약이 아니라 컨트롤러 경로 파라미터 검증" 스코프 고지 한 줄 추가해 향후 검색 혼동 예방.
