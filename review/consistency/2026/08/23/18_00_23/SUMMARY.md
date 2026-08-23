# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 5개 checker 전원 CRITICAL 0건. `token` 계열 마스킹 키 확장 + workflow-assistant 이중 마스킹(`deepRedactSecrets` over `maskSensitiveFields`) 변경은 spec 4파일(동일 커밋)과 정합하며, 유일한 반복 지적은 같은 target 문서 내부의 stale 구현 체크리스트 한 줄과 신규 헬퍼 명명 혼동 가능성.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, convention_compliance, plan_coherence | `4-ai-assistant.md`의 "실행 조회 도구 기획 결정 메모" → "구현 단계에서 유의 사항 (실제 구현 반영)" 4번 항목이 2026-08-23 마스킹 이중화 결정(§4.1.1 + "확정된 결정 사항" 표는 취소선+갱신됨)을 반영하지 않고 옛 단일-층(`mask-sensitive-fields.util.ts` 재사용만) 서술을 그대로 유지 — 3개 checker가 동일 지점을 각각 WARNING/WARNING/INFO로 지적, 최고 등급(WARNING) 채택 | `spec/3-workflow-editor/4-ai-assistant.md` (약 L1471, "구현 단계에서 유의 사항" #4) | 같은 파일 L1435 "확정된 결정 사항" 표(갱신됨) 및 §4.1.1 본문(갱신됨) — 저장소가 이번 결정 변경에 일관 적용한 "취소선 + 갱신 주석" 관례를 이 항목만 누락 | 4번 항목을 `~~응답 직렬화 직전에 inputData/outputData/error 필드를 각각 한 번씩 통과시킴~~ → 2026-08-23: deepRedactSecrets 를 추가로 겹치는 redactAssistantFields 로 대체 (§4.1.1 참조)` 형식으로 취소선+갱신해 표와 동기화 |
| 2 | naming_collision | 신규 non-exported 함수 `redactAssistantFields`(`explore-tools.service.ts:89`)가 기존 `redactStoredFieldsForResponse`(`shared/utils/redact-stored-error.ts:97`)와 동일한 3-필드 shape(`inputData`/`outputData`/`error`)를 다루면서 이름 패턴이 겹치나 보안 강도가 다름(키+값 이중 vs 값만 단일) — 코드 docstring은 이 위험을 인지·서술했으나 이름 자체엔 강도 차이가 드러나지 않음 | `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:89` (`redactAssistantFields`) | `codebase/backend/src/shared/utils/redact-stored-error.ts:97` (`redactStoredFieldsForResponse`) | 코드 변경 불요(non-exported, 이미 문서화됨). 후속 변경 시 이름에 강도 접미사 고려 또는 `redactStoredFieldsForResponse` JSDoc에 "value-pattern-only" 한 줄 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | target §4.1.1 "잔여 갭은 상속된다" 콜아웃(3항목: 자격증명 없는 연결 문자열·내부 호스트명·스택 프래그먼트)이 EIA §R17 "잔여 갭(의도)"(4항목, "사설 IP" 포함)을 그대로 인용한다고 하면서 1개 항목 누락 | `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 콜아웃 vs `spec/5-system/14-external-interaction-api.md` §R17 | "사설 IP" 추가 또는 "EIA §R17 잔여 갭 목록 전체를 그대로 상속" 식으로 축약해 향후 drift 방지 |
| 2 | cross_spec | `spec/1-data-model.md` §2.14 "응답 마스킹" 행이 이번에 새로 생긴 "AI Assistant 도구 전용, 포맷이 다른(`***` 완전 치환 vs `****<last4>`) 마스킹"의 존재를 신호하지 않음 (기존 패턴, 이번 PR이 만든 갭은 아니나 이번 변경으로 차이가 실체화됨) | `spec/1-data-model.md` L564 (참조 대상, 이번 diff 미수정) | data-model.md §2.14에 "단, workflow-assistant LLM 도구는 별도 강도(`***`) — SoT는 [AI Assistant §4.1.1]" 한 문장 추가 (target 범위 밖, 후속 과제) |
| 3 | rationale_continuity | `DEFAULT_SENSITIVE_KEYS`의 `token` 접두형 확장이 `node-output.md` Principle 7("비-자격증명 config는 무변화로 echo")과 만나는 경계 사례 — diff 코드 주석은 이미 트레이드오프를 인지·서술했으나 convention 문서 쪽엔 반영 안 됨 | `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` (`DEFAULT_SENSITIVE_KEYS`) | `spec/conventions/node-output.md` Principle 7 | Principle 7 콜아웃에 "사용자 정의 `headers`/`body` 키가 `DEFAULT_SENSITIVE_KEYS`와 완전 일치하면 비-자격증명이어도 과잉 마스킹될 수 있다(안전 방향의 잔여 갭)" 한 줄 추가 |
| 4 | naming_collision | `redact*` 네이밍 공간이 이미 10개 이상 심볼로 밀집 — 신규 `redactAssistantFields`가 그 공간을 한 칸 더 좁힘 (정확한 이름 충돌은 없음, exported도 아님) | `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts` 및 저장소 전역 `redact*` 심볼들 | 코드 변경 불요. `spec/conventions/egress-masking.md` §1 좌표계 표에 심볼→강도→소비처 통합 인덱스 유지 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec 4파일 상호 SoT 교차 인용 정합, 실제 코드 상수/함수명과 일치. CRITICAL 없음. INFO 3건(잔여 갭 항목 수 불일치, data-model.md SoT 포인터 미신호, 자기내부 stale 체크리스트) |
| rationale_continuity | LOW | `****<last4>`→`***` 포맷 축소 결정 번복에 대한 근거(JSDoc·spec 갱신·convention append)가 충실. WARNING 1건(같은 항목 구현 노트 미동기화), INFO 1건(node-output.md Principle 7 경계 사례) |
| convention_compliance | LOW | egress-masking.md 좌표계·레이어 구분·마커 리터럴 인용 예외 정확히 준수. error-codes.md/audit-actions.md 상충 없음. WARNING 1건(동일 stale 체크리스트 항목) |
| plan_coherence | LOW | `plan/in-progress/spec-sync-external-interaction-api-gaps.md`가 2026-08-23 "유출 차단이 우선" 결정으로 이미 닫아 둔 항목을 정확히 집행, plan이 요구한 spec 동반 갱신 4곳 전수 반영 확인. INFO 1건(동일 stale 체크리스트 항목) |
| naming_collision | LOW | 신규 엔티티/API/이벤트 없음, 신규 코드 식별자는 non-exported `redactAssistantFields` 1개뿐, 정확한 이름 충돌 없음. WARNING 1건(자매 함수 강도 혼동 가능성), INFO 1건(redact* 밀집) |

## 권장 조치사항
1. `spec/3-workflow-editor/4-ai-assistant.md` "구현 단계에서 유의 사항" 4번 항목을 §4.1.1/결정표와 동일한 취소선+갱신 패턴으로 정정 — 3개 checker가 독립적으로 지적한 유일한 반복 결함 (WARNING #1)
2. (선택) `redactAssistantFields` / `redactStoredFieldsForResponse` 중 하나에 강도를 드러내는 이름 접미사 또는 JSDoc 보강 — 실질 위험은 낮으나 이미 문서화된 리스크를 코드 레벨로도 고정 (WARNING #2)
3. (후속, target 범위 밖) `spec/1-data-model.md` §2.14 및 `spec/conventions/node-output.md` Principle 7에 이번 PR로 실체화된 예외를 한 줄씩 반영 (INFO #2, #3)
4. (선택) target §4.1.1 "잔여 갭" 콜아웃에 "사설 IP" 추가 또는 EIA §R17 전체 상속 문구로 축약 (INFO #1)