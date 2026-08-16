# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker(cross_spec / rationale_continuity /
convention_compliance / plan_coherence / naming_collision) 모두 전문을 확보했고, 어느 것도
CRITICAL 을 내지 않았다.

## 전체 위험도
**LOW** — convention_compliance 가 낸 WARNING 1건(신규 마스킹이 적용된 응답 DTO 4곳의
Swagger JSDoc 미갱신) 외에는 전부 NONE.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 이번 PR 이 신규 도입한 `error` 필드 egress 마스킹 부수효과가 응답 DTO 4곳의 Swagger JSDoc 에 반영되지 않음 (spec=닫힘, API 문서=미갱신 비대칭) | `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:64`(`ExecutionDto.error`), `:161`(`ExecutionDetailDto`/`NodeExecutionSummaryDto.error`), `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:62` | `spec/conventions/swagger.md` §1-1/§3/§5-1, `PROJECT.md` "변경 유형→갱신 위치 매핑"(같은 turn 갱신 의무, 사후 보정 PR 패턴 금지) | 4개 DTO 필드 JSDoc 에 "자격증명으로 판별된 값은 마스킹되어 반환됨(DB 원문과 다를 수 있음)" 한 줄 추가 + SoT 포인터(`14-external-interaction-api.md#R17` 또는 `redact-stored-error.ts`) 명시. 같은 PR 안에서 반영 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `12-background.md` frontmatter `code:` 목록에 `redact-stored-error.ts` 미등재 (본문 §8.2 는 재사용 서술) | `spec/4-nodes/1-logic/12-background.md` frontmatter | 후속 spec-coverage 패스에서 등재 통일 (선택) |
| 2 | rationale_continuity | 이전 라운드(`16_32_42`) CRITICAL "`nodeExecutions[].error` 형제 필드 우회"가 이번 diff 에서 실제로 닫힘 확인 | `executions.service.ts` `findById` nodeExecutions map + `BackgroundRunsService` | 없음 — 이미 반영·검증됨 |
| 3 | rationale_continuity | R17 "미결" → "결정 확정" 은 번복이 아니라 미결 해소, 새 Rationale 온전히 동봉 | `spec/5-system/14-external-interaction-api.md` §R17 | 없음 |
| 4 | rationale_continuity | `secret-store.md` `triggerToken` 예외 — 독립 근거 + 서두 caveat 모두 반영(이전 라운드 WARNING 2건 해소) | `spec/conventions/secret-store.md` §1 | 없음 |
| 5 | rationale_continuity | WS `execution.snapshot` 마스킹 상속 서술이 실제 호출 그래프(`emitExecutionSnapshot`→`findById`)와 일치 | `spec/5-system/6-websocket-protocol.md` §6.2 | 없음 |
| 6 | convention_compliance | `1-data-model.md §2.14` 에 마스킹 정책 역참조 없음(AuthConfig §2.17.2 와 서술 결 다름). diff 범위(spec/5-system) 밖이라 격상 안 함 | `spec/1-data-model.md §2.14` | `error` 필드 설명에 "egress 마스킹 적용 — SoT: EIA §R17" 포인터 추가 고려 (선택) |
| 7 | plan_coherence | `pending_plans:` 방향이 문서 정의(plan→plan 선행 의존)와 다르게 "정본 트래커→집행 자식 plan" 용법으로 쓰임. 기존 선례(`spec-draft-eia-notification-payload-contract.md`) 있고 build guard 없어 실질 피해 없음 | `plan/in-progress/eia-internal-rest-error-masking.md` frontmatter | 정정 불요. `.claude/docs/plan-lifecycle.md §4` 에 세 번째 용례로 추가 고려 (선택) |
| 8 | naming_collision | 델타의 유일한 신규 식별자 `ResponseExecution`(TS 타입) — 기존 `*Dto` 계열과 접미사·용도 뚜렷이 구분, 충돌 없음 | `executions.service.ts:87` | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 5개 target 문서(EIA/WS/execution-history/background/secret-store)가 동일 결정(2026-08-16)을 일관 반영, 코드 4경로+WS+Background 직접 대조 일치 |
| rationale_continuity | NONE | 오늘 앞선 3라운드의 WARNING 2건·CRITICAL 1건(형제 필드 우회) 모두 이번 diff 에서 해소·재검증됨 |
| convention_compliance | LOW | 응답 DTO 4곳 Swagger JSDoc 이 신규 마스킹 부수효과 미반영(WARNING). 나머지(secret-store 인용, node-output §3.2, swagger §1-4, frontmatter)는 위반 없음 |
| plan_coherence | NONE | 신규 plan 이 정본 트래커 미결 항목(I1·D)을 사용자 결정으로 명시 집행, 잔여 3항목은 별도 체크박스로 분리돼 은폐 없음 |
| naming_collision | NONE | 델타의 유일 신규 식별자 `ResponseExecution` 충돌 없음. 나머지는 기존 식별자 재참조·문서 교차링크 |

## 권장 조치사항
1. (선택, 비차단) 응답 DTO 4곳(`execution-response.dto.ts` `error` 필드 3곳,
   `background-run-response.dto.ts` `error` 필드 1곳)의 Swagger JSDoc 에 마스킹 부수효과
   한 줄 + SoT 포인터 추가 — 가능하면 같은 PR 안에서, 아니면 `spec-sync-external-interaction-api-gaps.md`
   트래커에 항목으로 등재.
2. (선택, 비차단) `1-data-model.md §2.14` 에 EIA §R17 로의 역참조 포인터 추가.
3. BLOCK 사유 없음 — push 진행 가능.

---

> **조치 (main, 같은 턴)**: WARNING 1 은 `PROJECT.md` 가 "같은 turn 갱신 의무 · 사후 보정 PR
> 패턴 금지" 로 규정하므로 **이 PR 안에서 반영**했다 — 응답 DTO 4곳에 마스킹 부수효과 한 줄 +
> SoT 포인터. INFO 1·6(frontmatter `code:` · `1-data-model.md` 역참조)도 함께 반영했다.
