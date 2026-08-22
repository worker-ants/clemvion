# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — target(`spec/5-system/`)은 이번 PR 에서 diff 0줄(순수 코드 리팩터 + plan lifecycle 정리)이며, 5개 checker 전원이 CRITICAL 없음으로 판정. 유일한 WARNING(401 코드명 drift)은 이번 diff 와 무관한 선존 이슈이고 이미 planner 턴 항목으로 트래커에 등재돼 있다.

## 검토 대상 요약

이번 PR(`masked-marker-plan-close-d8edad`, `origin/main` 대비 3커밋)의 실제 diff:
- `codebase/backend/src/modules/executions/executions.service.ts` — `reRun()` 의 입력 해석 40줄을 private 헬퍼 `resolveManualOverrideInput` 로 추출하는 순수 리팩터(에러 코드·`details` 필드·마커 거부 검사 시점 전부 무변경).
- `plan/**` — `masked-marker-test-gaps.md`, `rerun-input-resolution-extract.md` 를 `complete/` 로 이동/신설, `spec-sync-external-interaction-api-gaps.md` 트래커 갱신.
- `spec/**` 변경은 diff 에 **없음**(0줄).

5개 checker(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 전원 정상 실행·전문 확보(재시도 필요 항목 없음). 5개 output 파일(`cross_spec.md`, `rationale_continuity.md`, `convention_compliance.md`, `plan_coherence.md`, `naming_collision.md`)은 이미 디스크에 존재함을 확인했다(누락 파일 없음, 별도 영속화 불요).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 아래 WARNING 은 Critical 이 아니므로 이 표에 해당하지 않으나, 참고를 위해 이관 상태를 기록한다: `13-replay-rerun.md` §8.1/§8.2 의 401 코드명 drift(`UNAUTHORIZED` → 표준 `AUTH_REQUIRED`)는 5개 checker(cross_spec, convention_compliance, naming_collision, plan_coherence) 모두가 동일하게 발견했고, 전원이 "이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 planner 턴 항목으로 등재돼 있으며 `spec/` 편집은 developer 권한 밖" 이라고 일관되게 판정했다. 신규 유입이 아닌 선존 drift이며 별도 인계 조치 불요(이미 정본 트래커에 반영됨).

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | `13-replay-rerun.md` §8.1/§8.2 의 401 에러 코드가 `UNAUTHORIZED` 로 표기돼 표준 카탈로그와 불일치(선존, 이번 diff 무관) | `spec/5-system/13-replay-rerun.md:240`, `:269` | `spec/5-system/2-api-convention.md:171`(401=`AUTH_REQUIRED` 기본값) · `spec/5-system/3-error-handling.md:42` | 신규 조치 불요 — 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 planner 턴 항목으로 등재됨. 다음 planner 턴에서 두 표의 `code` 열을 `AUTH_REQUIRED` 로 1줄 정정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `spec/5-system/` 6개 문서(`2-api-convention.md`, `6-websocket-protocol.md`, `16-system-status-api.md`, `5-expression-language.md`, `7-llm-client.md`, `11-mcp-client.md`)가 권장 3섹션 구성(`## Overview`)을 따르지 않음(선존, 이번 diff 무관) | 각 파일 상단 | 기계 강제 대상 아님. 다음에 해당 문서를 손댈 때 `## Overview` 로 헤딩 정렬 권장 |
| 2 | convention_compliance | 신규 헬퍼 `resolveManualOverrideInput` 의 코드 주석이 `spec/conventions/error-codes.md §5` rename 이력을 정확히 인용 | `codebase/backend/src/modules/executions/executions.service.ts` | 조치 불요 |
| 3 | plan_coherence | 트래커의 나머지 이월 항목 4건(단위 테스트 부재·401 drift·swagger 길이-예외·`execute` DTO 부재)은 각각 유예 근거를 단 채 정확히 열어둔 상태로 확인됨 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:824-836` | 조치 불요 — 후속 세션에서 순서대로 처리 |
| 4 | naming_collision | 신규 프로덕션 식별자는 `resolveManualOverrideInput` 하나뿐이며 코드베이스 전역 유일(정의 1곳·호출 1곳), 기존 사용처와 충돌 없음 | `codebase/backend/src/modules/executions/executions.service.ts` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec diff 0줄. 유일 발견은 `13-replay-rerun.md` 401 코드 drift(선존, 트래커 등재됨) |
| rationale_continuity | NONE | 리팩터가 `1-data-model.md` Rationale 이 금지한 phase 병합/재정렬을 재도입하지 않음을 뮤테이션 재검증으로 확인 |
| convention_compliance | LOW | 신규 규약 위반 없음. 선존 WARNING(401 drift) + INFO(Overview 섹션 6건 미준수) 재확인 |
| plan_coherence | NONE | 유일하게 닫은 트래커 항목이 등재 시점 처방을 그대로 집행. 나머지 이월 항목은 유예 근거와 함께 정확히 열어둠 |
| naming_collision | NONE | 신규 식별자 `resolveManualOverrideInput` 코드베이스 전역 유일, 6개 관점 전부 충돌 없음 |

## 권장 조치사항

1. (BLOCK 해소 불요 — Critical 없음)
2. 다음 `project-planner` 턴에서 `spec/5-system/13-replay-rerun.md` §8.1/§8.2 의 `code` 열 `UNAUTHORIZED` → `AUTH_REQUIRED` 로 정정(이미 트래커에 등재된 항목 집행).
3. `spec/5-system/` 6개 문서의 `## Overview` 섹션 정렬은 해당 문서를 다음에 편집할 때 함께 처리(비차단, 권장 사항).