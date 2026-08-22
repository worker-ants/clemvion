# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker(cross_spec, rationale_continuity,
convention_compliance, plan_coherence, naming_collision) 전원 `success` 로 전문 확보,
재시도 필요 항목 없음.

## 전체 위험도
**LOW** — `spec/5-system/` 대상 diff 는 실질적으로 spec 무변경(순수 OpenAPI 문서화 코드
3파일)이며, 유일한 주목 지점은 형제 DTO 간 동명 필드(`input`) 의미 차이 노출(WARNING 1건)뿐.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | `ExecuteWorkflowDto.input`(레거시 파라미터 봉투, `.parameters` 하위 키 필요)이 같은 컨트롤러의 형제 `ExecuteNodeDto.input`(단일 노드 실행의 직접 입력값)과 필드명은 같으나 shape·의미가 다르며, 이번 PR 의 `@ApiBody` 배선으로 처음 Swagger 문서 표면에 동시 노출됨 | `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:58` (`POST /workflows/:id/execute`) | `codebase/backend/src/modules/workflows/dto/execute-node.dto.ts:31` (`POST /workflows/:id/nodes/:nodeId/execute`) | 이미 docstring 이 `{@link ExecuteNodeDto.input}` 로 상호 참조·구분해 완화돼 있어 즉시 변경 불요. 여지가 있다면 `ExecuteWorkflowDto` 필드를 `legacyInput` 등으로 리네이밍(런타임 계약 불변, OpenAPI 표면만 변경)하거나 두 endpoint `@ApiOperation` 상단 상호 참조 배너 유지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `execute` 본문 여분 키 400 거부 여부가 정본 트래커에 신규 이연 등재됨 — 결정 시 반영할 spec 문서 자리가 아직 없음 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 신규 항목 / `spec/5-system/2-api-convention.md`(webhook 수신만 문서화, execute 본문 절 없음) | 필수 조치 아님. 해당 트래커 항목 실행 시점에 `2-api-convention.md §11` 또는 신규 절 배치를 함께 결정하도록 메모 추가 고려 |
| 2 | convention_compliance | `spec/5-system/2-api-convention.md` 에 로컬 `## Overview` 섹션 부재 (carry-forward, 이번 diff 와 무관) | `spec/5-system/2-api-convention.md` 타이틀 직후 | 이번 PR 조치 불필요. 별도 spec 그루밍 후속에서 처리 |
| 3 | naming_collision | `ExecuteWorkflowDto` 클래스가 class-validator 데코레이터 없는 OpenAPI 스키마 전용 클래스로, `swagger.md §1` 이 암시하는 "검증되는 요청 DTO" 기대와 형태적으로 어긋남 (의도적, docstring 명시, 동일 changeset 코드 리뷰에서 이미 INFO 기록) | `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` | 중복 조치 불요 — 교차 확인만 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `spec/` 무변경(diff 0). 신규 DTO 필드 shape·`SoT: EIA §R17`·swagger.md §3 예외·열린 map 규약·RBAC·계층 책임 전부 기존 spec 과 정합 |
| rationale_continuity | NONE | 마커 재검사 2단계 절차·config-soft/structure-hard 구분·`INVALID_TRIGGER_PARAMETERS` 3경로 공용·AuthConfig 단일 진입 등 기존 Rationale 우회/재도입 없음. 이연 결정은 무근거 번복이 아닌 최초 확정 |
| convention_compliance | NONE | `swagger.md` §1-4(열린 map 정확 표기)·§3(description 길이 예외) 준수. 직전 라운드 WARNING(`type: Object` 축약형)은 신규 파일에서 정정, 형제 파일 잔여 결함은 트래커 등재로 스코프 명시 분리 |
| plan_coherence | NONE | 미해결 결정(여분 키 검증) 우회 없이 트래커 명시 이연. 선행 조건 3건 모두 이미 origin/main 에 해소. 부수 실측 2건 모두 정본 트래커 한 곳에 정확히 등재 |
| naming_collision | LOW | 신규 요구사항 ID/endpoint/이벤트/ENV/spec 경로 충돌 없음. 형제 DTO 동명 필드(`input`) shape 차이 노출 1건(WARNING, docstring 으로 상당 부분 완화됨) |

## 권장 조치사항

1. (비차단) `ExecuteWorkflowDto.input` 필드명 재검토 — 즉시 조치 불요하나, 여지가 있다면
   `legacyInput` 등으로 리네이밍해 형제 `ExecuteNodeDto.input` 과의 Swagger 표면 혼동을
   원천 차단(런타임 계약 영향 없음).
2. (비차단, 후속) `execute` 본문 여분 키 400 거부 결정 시 `spec/5-system/2-api-convention.md`
   에 반영할 절 위치를 함께 정하도록 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
   에 메모 추가 고려.
3. (비차단, 후속) `spec/5-system/2-api-convention.md` 로컬 Overview 섹션 부재는 별도 spec
   그루밍에서 처리(이번 PR 무관, carry-forward).