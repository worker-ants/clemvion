# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전부 Critical 0건)

## 전체 위험도
**LOW** — Critical/구조적 불일치 없음. `execution-response.dto.ts` 의 두 `inputData` JSDoc 이 swagger.md §3 길이 예외 조항의 "요약 1~2문장 + SoT 링크" 형식을 벗어난 WARNING 1건만 존재.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData` JSDoc 이 swagger.md §3 길이 예외 조항("요약 1~2문장 + SoT 링크")을 벗어나 역사적 서술(카브아웃 배경사)을 인용 블록째 담고 있음. 같은 diff 안 자매 DTO(`BackgroundRunNodeExecutionDto.inputData`)는 정확히 그 형식으로 압축됨 | `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` — `ExecutionDto.inputData`(라인 ~48-63), `NodeExecutionSummaryDto.inputData`(라인 ~174-186) | `spec/conventions/swagger.md` §3 "주석/설명 톤" 길이 예외 조항 (2026-08-17, 이 두 필드를 근거로 신설) | 두 JSDoc 을 `background-run-response.dto.ts` 의 `BackgroundRunNodeExecutionDto.inputData` 와 동일한 형태(주제문 1문장 + SoT 링크 `EIA §R17` 1문장)로 압축하고, "2026-08-20 이전에는 카브아웃이었다" 류 히스토리는 `spec/5-system/14-external-interaction-api.md` §R17 잔여② Rationale 에 맡길 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | naming_collision | frontend `masked-markers.ts` 의 `MASKED_MARKERS`/`isMaskedMarker` 가 backend `sanitize-error-message.ts` 의 module-private 동명 상수/함수와 이름이 완전히 동일 — 의도된 미러링 관용구(양쪽 JSDoc 상호 참조 존재), 모듈 스코프 분리로 실질 충돌 없음 | `codebase/frontend/src/lib/utils/masked-markers.ts` vs `codebase/backend/src/shared/utils/sanitize-error-message.ts:150,156` | 조치 불필요. 향후 리팩터링 시 두 JSDoc 상호 참조 유지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `Execution.inputData` egress 마스킹 카브아웃 폐지 결론이 7개 spec 파일(SoT 포함) 전수 동기화됨. 인접 영역(expression-language 런타임 `$trigger`, webhook ingestion-time 마스킹, RBAC/dry-run)과 충돌 없음. frontend/backend 마커 상수 미러·`code:` frontmatter·i18n 키 실물 일치 확인 |
| rationale_continuity | NONE | 과거 Rationale(§R17 잔여②)이 명시한 "닫는 조건"(프런트 마커 가드 선행)이 3개 소비처에서 충족되어 예정대로 집행된 변경. 취소선으로 이력 보존, webhook ingestion-time 마스킹 기각 결정·node-level 카브아웃 확대 기각 결정과도 비충돌, 오히려 whack-a-mole 반대 근거에 정면 응답 |
| convention_compliance | LOW | naming/layering/i18n/spec-impl-evidence 규약 전부 준수. swagger.md §3 길이 예외 조항 형식 미준수 1건(WARNING, non-production Swagger UI 노출이라 보안 임팩트 없음) |
| plan_coherence | NONE | developer/planner 두 plan 이 예고한 변경과 target diff 가 문장·표·frontmatter 수준까지 일치. 상위 트래커 체크리스트 "해소" 갱신, 후속 백로그 유실 없음. 다른 in-progress plan 중 뒤집힌 결론을 전제로 한 stale plan 없음 |
| naming_collision | NONE | 신규 요구사항 ID·엔티티·API endpoint·이벤트명·ENV var 도입 없음. 유일한 신규 파일(`masked-markers.ts`)의 식별자는 backend 동명 심볼과 의도된 미러링(모듈 스코프 분리로 무충돌) |

## 권장 조치사항
1. (BLOCK 해소 불필요 — Critical 없음) `execution-response.dto.ts` 의 `ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData` JSDoc 을 swagger.md §3 예외 조항 형식(주제문 1문장 + SoT 링크 1문장)에 맞춰 압축 — `background-run-response.dto.ts` 의 `BackgroundRunNodeExecutionDto.inputData` 를 템플릿으로 사용.