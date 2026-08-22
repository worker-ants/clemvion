# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 순수 주석/JSDoc/Swagger description 한글화·보강(cosmetic followup)이며 로직·계약 변경 없음. WARNING 1건(swagger 길이 가이드라인) + INFO 2건만 확인.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `ReRunRequestDto.inputOverride` 의 Swagger `description` 이 129자로 길이 가이드라인(10~40자)을 크게 초과하며, 초과를 정당화하는 예외 조항의 문언 범위(응답 필드 한정)와 정확히 일치하지 않음(대상은 요청 필드의 검증/거부 정책 caveat) | `codebase/backend/src/modules/executions/dto/re-run.dto.ts` (`ReRunRequestDto.inputOverride`) | `spec/conventions/swagger.md` §3 (DTO description 10~40자 가이드라인 및 응답-필드 한정 예외 조항) | (1) `swagger.md` §3 예외 문구를 "요청 필드의 보안 관련 검증/거부 정책 caveat"까지 포괄하도록 갱신하거나, (2) description 을 더 짧게 유지("마스킹 마커 재제출 시 400 거부. SoT: EIA §R17." 등)하고 상세는 spec 본문에만 둔다. 실무 영향 미미. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `0-common.md` 에 명시적 `## Rationale` 섹션 부재 (이번 diff 범위 밖, 사전부터 존재하던 상태) | `spec/4-nodes/7-trigger/0-common.md` | 조치 불요(이번 diff 범위 밖). 후속 spec 편집 시 선택적으로 보강. |
| 2 | plan_coherence | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` W1 항목("마커 리터럴을 산문으로 재기술한 지점이 3곳")의 근거 문구가 같은 PR 의 이후 커밋(Swagger description 129자로 재축약, 마커 리터럴 verbatim 나열 제거)보다 한 단계 뒤처짐. 항목의 결론(열어두고 `#1194` 흡수 대기) 자체는 여전히 유효 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` §"마커 재제출 거부 PR 의 이월 항목" (W1) | 차단 사유 아님. 다음 편집 시 "Swagger description 은 이후 두 라운드에 걸쳐 리터럴 나열 없이 축약됨(129자, SoT 링크만 유지)" 한 줄 추가해 실측 드리프트 제거. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 4개 코드 파일(주석/JSDoc/Swagger description)·frontmatter 1줄 추가 모두 EIA §R17 등 기존 SoT 를 산문으로 재인용할 뿐, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어디에서도 모순 없음 |
| rationale_continuity | NONE | 신규 주석은 `1-manual-trigger.md` §Rationale·§6 및 EIA §R17 이 이미 확정한 설계(base/wrapper 분리, Manual 전용 스코프)를 정확히 코드 레벨로 반영. 기각 대안 재도입·번복·invariant 우회 없음 |
| convention_compliance | LOW | `re-run.dto.ts` description 길이 초과(WARNING 1) + `0-common.md` Rationale 섹션 부재(INFO, 범위 밖). 에러 코드 매핑·`UPPER_SNAKE_CASE`·SoT 앵커는 전부 정합 |
| plan_coherence | LOW | 트래커(`spec-sync-external-interaction-api-gaps.md`)가 정확히 이 diff 범위의 4개 체크리스트 항목을 닫음. 미체크 W1 항목 문구만 최신 커밋 대비 근거가 한 단계 뒤처짐(INFO) |
| naming_collision | NONE | 신규 식별자(요구사항 ID·엔티티/타입명·endpoint·이벤트명·환경변수·spec 경로) 전무 — 검토 대상 자체가 존재하지 않음 |

## 권장 조치사항
1. (선택) `spec/conventions/swagger.md` §3 예외 문구를 요청 필드의 보안 검증/거부 정책 caveat 까지 포괄하도록 정정하거나, `re-run.dto.ts` 의 `inputOverride` description 을 더 짧게 축약한다 — BLOCK 사유 아니므로 이번 세션에서 필수는 아님.
2. (선택) `plan/in-progress/spec-sync-external-interaction-api-gaps.md` W1 항목에 "Swagger description 이 이후 두 라운드에 걸쳐 리터럴 나열 없이 축약됨" 한 줄을 추가해 실측 드리프트를 제거한다.