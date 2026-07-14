# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 3건 (convention_compliance 2건 + naming_collision 1건, 부분 중복 통합)

> **주의: 이 보고서는 불완전합니다.** `cross_spec` / `rationale_continuity` / `plan_coherence` 3개 checker 는 workflow manifest 상 `status=success` 로 보고되었으나, 실제 output 파일이 디스크에 생성되지 않았습니다 (알려진 비결정적 FS-write 실패 패턴, `_prompts/` 에는 5개 프롬프트 전부 존재해 실제로 invoke 는 됐음이 확인됨). 아래 통합은 확보된 2개 checker 결과만 반영하며, 나머지 3개는 revised draft 로 재실행 후 최종 판정.

## 전체 위험도
**HIGH** — "저장 시점 경고" 설계 축 전반에서 API 계약 모순 + 기존 컨벤션 우회 + 에러코드 명명 충돌.

## Critical 위배 (BLOCK 사유)

### C1 (convention_compliance) — `PATCH /workflows/:id` API 스코프 모순
`PATCH /workflows/:id` 는 `UpdateWorkflowDto`(name/description/isActive/tags/folderId/settings) 만 받고 `nodes`/`mcpServers`/`presentationTools` 는 포함하지 않음(전역 whitelist pipe 거부). 노드 config 를 담는 경로는 `POST /workflows/:id/save`(`SaveCanvasDto`) 뿐.
- 대상: 확정 정책, D3
- 제안: `PATCH :id` 제거, `POST :id/save`(`saveCanvas`) 단일 지점으로 정정.

### C2 (convention_compliance + naming_collision) — `cross-node-warning-rules.md` 우회
저장 시점 non-blocking 경고를 위해 기존 `GraphWarningRule`/`GRAPH_VALIDATION_FAILED` 체계(이 use case 전용으로 이미 존재)를 참조 없이 우회하고 별도 `warnings[]` + `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` + 400 재사용 병행 체계 신설. 필드명 `warnings` 는 향후 충돌 위험.
- 대상: Phase 1 항목 3, 확정 정책, D3
- 제안: `graphWarningRules` 로 등록(async 카탈로그 조회 필요 → mini-DSL 불가) + 기존 severity·`GRAPH_VALIDATION_FAILED` 재사용.

### C3 (naming_collision) — 에러코드 `AI_TOOL_BUDGET_EXCEEDED` 명명 충돌
기존 `TOOL_BUDGET_EXCEEDED_ERROR='tool_call_budget_exceeded'`·`MAX_TOOL_CALLS_EXCEEDED`(도구 **호출 횟수** 축)와 토큰 거의 동일 → 서로 다른 실패 지점(호출 전 vs 호출 중)인데 이름으로 구분 안 됨.
- 대상: D2 §10 신규 행, Phase 2
- 제안: `AI_TOOL_DEFINITION_PAYLOAD_EXCEEDED`/`AI_TOOL_SCHEMA_PAYLOAD_EXCEEDED` 로 개명.

## 경고 (WARNING)
- W1 (convention_compliance): 에러가 자유 텍스트 message 에만 담고 구조화 `details` 없음 — §7.9(`LLM_RATE_LIMIT` details) 선례 불일치. `details: { totalBytes, budgetBytes, culpritProvider?, toolCount }` 명문화 권장.

## 참고 (INFO)
- I1: 에러코드 접두어 `AI_` 가 §10 기존 계열(`LLM_*`/`TOOL_*`)과 정합성 낮음 — `TOOL_PAYLOAD_BUDGET_EXCEEDED` 계열 재검토(권장, 강제 아님).
- I2: Phase 2 에 저장 응답 DTO/swagger 갱신 명시 추가.
- I3: "budget" 용어가 3자원(정의 payload bytes / 호출 횟수 maxToolCalls / working-memory memoryTokenBudget)에 재사용 — disambiguation 문구 유지.
- I4: 신규 env/함수/섹션명 grep 결과 정확 충돌 없음 — 조치 불요.

## Checker별 상태
| Checker | 상태 |
|---------|------|
| cross_spec | 재시도 필요 (output 미생성) |
| rationale_continuity | 재시도 필요 (output 미생성) |
| convention_compliance | HIGH — C1·C2 |
| plan_coherence | 재시도 필요 (output 미생성) |
| naming_collision | HIGH — C3 |

## 조치 (revised draft 반영 예정)
1. `PATCH :id` → `POST :id/save`(saveCanvas) 정정.
2. 저장 경고 → `graphWarningRules`/`GRAPH_VALIDATION_FAILED` 재사용, 별도 `warnings[]`·strict 플래그 폐기.
3. 에러코드 `AI_TOOL_DEFINITION_PAYLOAD_EXCEEDED` 개명.
4. 구조화 `details` 명문화.
5. Phase 2 DTO/swagger 명시.
6. revised draft 로 5 checker 전체 재실행.
