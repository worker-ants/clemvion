# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건, 전문 확보 완료)

## 전체 위험도
**LOW** — Critical/구조적 충돌 없음. WARNING 2건(모두 문서 정밀도·가독성 성격, 실제 동작·계약 오류 아님)만 잔존.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | "Egress 마스킹 좌표계" 참조가 markdown 하이퍼링크가 아니라 평문 괄호 서술 | `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 "마스킹 규칙" 첫 문단, `(Egress 마스킹 좌표계 참조)` | `spec/5-system/14-external-interaction-api.md:1399`, `spec/5-system/6-websocket-protocol.md:200` — 둘 다 같은 좌표계를 `[...](../conventions/egress-masking.md)` 형태로 링크함 | `(Egress 마스킹 좌표계 참조)` → `([Egress 마스킹 좌표계](../conventions/egress-masking.md) 참조)` 로 링크화 (1줄 수정) |
| 2 | naming_collision | 신설 비-export 헬퍼 `redactAssistantFields` 가 기존 `redactStoredFieldsForResponse`(및 `redactNodeExecutionRow`)와 이름·파라미터/반환 shape(`{inputData, outputData, error}`)·대상 필드가 겹치나 보안 강도(키+값 2겹 vs 값 1겹)가 달라 혼동·오사용 위험 | `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:83` | `codebase/backend/src/shared/utils/redact-stored-error.ts:97`(`redactStoredFieldsForResponse`), `:163`(`redactNodeExecutionRow`) — 이 저장소의 "자매 헬퍼 `{@link}` 교차 인용" 관례가 이 쌍에는 미적용(grep 0건) | `redactAssistantFields` docstring 에 "자매는 `redactStoredFieldsForResponse`(REST 응답 경로) — 이쪽은 채팅에 원문 렌더되므로 키 축을 추가로 겹친다" 교차 인용 추가, 또는 함수명을 `redactAssistantExecutionFields` 로 구체화 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | "다른 소비처는 영향을 받지 않는다" 문구가 포맷 축에서만 정확 — `DEFAULT_SENSITIVE_KEYS`(공유 상수) 확장이 config echo 등 자매 표면의 마스킹 **범위**에는 실제로 영향을 준다는 사실(CHANGELOG·캐너리 테스트는 이미 정확히 문서화)과 미묘하게 어긋나 보일 수 있음 | `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 "이 포맷은 이 도구의 로컬 합성 결과다" 문단 | "(포맷 기준. `DEFAULT_SENSITIVE_KEYS` 의 `token` 계열 확장은 이 유틸을 공유하는 config echo 등에도 적용되어 새 키가 마스킹 대상에 추가된다 — 마스킹 범위는 넓어지고 포맷만 불변이다)" 한 문장 추가 |
| 2 | convention_compliance | `"***"` 리터럴 인용 자체는 egress-masking.md 의 "wire 계약 서술 레이어" 예외에 해당해 위반 아님이나, target 문서 자체에는 그 예외 근거가 적혀 있지 않아 향후 검토자가 오탐 가능 | §4.1.1 문단 및 §14 Rationale 표 | 위 WARNING #1 링크 옆에 "wire 계약 서술이므로 리터럴 인용" 각주 추가 (선택) |
| 3 | plan_coherence | 이전 두 라운드(`16_09_25` BLOCK:YES → `16_21_45` BLOCK:NO)가 지적한 항목 전부 이번 diff 에서 실제 반영 확인 | `4-ai-assistant.md` §4.1.1/:1429, EIA §R17 잔여③, EH-NAV-04, egress-masking.md §1 | 조치 불필요 — 확인만 |
| 4 | plan_coherence | 자매 표면(`handler-output.adapter.ts` 값 축) 및 `DEFAULT_SENSITIVE_KEYS` 정적 grep 한계는 결합 없이 별도 미체크 항목으로 정상 분리됨 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 신규 `[ ]` 2건 | 조치 불필요 |
| 5 | naming_collision | 신규 `token` 계열 마스킹 키 8종(`csrfToken` 등)은 기존 사용처와 의미 충돌 없음 (grep 재확인) | `mask-sensitive-fields.util.ts` `DEFAULT_SENSITIVE_KEYS` | 조치 불필요 |
| 6 | naming_collision | 요구사항 ID(`ED-AI-37`)·API endpoint·이벤트명·plan 파일 경로 축 신규 충돌 없음 | 전역 | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 1·2차 라운드에서 지적된 WARNING 전부 해소 확인. 신규 CRITICAL/WARNING 없음 |
| rationale_continuity | LOW | EIA §R17 "잔여③" 종결은 정당한 후속 결정(경고 보존+새 Rationale). INFO 1건(스코핑 문구 정밀도) |
| convention_compliance | LOW | 코드·spec·좌표계 문서 3곳 정합 확인. WARNING 1건(좌표계 링크 누락) |
| plan_coherence | NONE | 정본 트래커의 결정 집행·파급 4곳 동반 갱신·자매 잔여 정상 분리 확인 |
| naming_collision | LOW | 신규 마스킹 키·ID·endpoint 충돌 없음. WARNING 1건(`redactAssistantFields` 명명 유사) |

## 권장 조치사항
1. `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 의 "(Egress 마스킹 좌표계 참조)" 를 `[Egress 마스킹 좌표계](../conventions/egress-masking.md)` 형태의 markdown 링크로 교체한다 (WARNING #1 해소, 1줄).
2. `explore-tools.service.ts` 의 `redactAssistantFields` docstring 에 자매 헬퍼(`redactStoredFieldsForResponse`) 교차 인용을 추가하거나 함수명을 더 구체화한다 (WARNING #2 해소).
3. (선택) §4.1.1 에 `DEFAULT_SENSITIVE_KEYS` 확장이 config echo 등 자매 표면의 마스킹 **범위**에 미치는 영향을 한 문장으로 명시해 CHANGELOG 의 구분을 spec 에도 미러한다 (INFO #1).
