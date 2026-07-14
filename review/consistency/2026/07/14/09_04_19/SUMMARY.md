# Consistency Check 통합 보고서 (revised draft)

**BLOCK: NO** — 확보된 3개 checker(Convention Compliance / Plan Coherence / Naming Collision) 에 Critical 없음. Cross-Spec / Rationale Continuity 2개는 status=success 지만 output_file 미생성(known FS-write flakiness), `unfinished:[]`.

대상: `plan/in-progress/ai-agent-tool-payload-budget-guardrail.md` (D1~D5 spec draft)

## 전체 위험도: MEDIUM (Critical 0, WARNING 5, INFO 5)

## WARNING (spec 반영 전 incorporate)
- **W1 (Plan Coherence)**: single-turn `executeSingleTurn`(ai-turn-executor.ts:1397-1534)은 buildTools/llmService.chat 을 try/catch 없이 호출 → pre-flight throw 의 `error` 포트 라우팅 인프라가 `node-output-redesign/ai-agent.md` 에 미해결 CRITICAL. → Phase 2 항목 2 에 single-turn 전용 try/catch 신설 명시.
- **W2/W4 (Convention Compliance)**: backend-only rule 이 (a) guard②(frontend pre-eval) 생략, (b) severity 동적 승격(warning→error) — 둘 다 cross-node-warning-rules §5/§8 고정-severity·3중가드 모델 이탈. → Phase 1 에 §5(backend-only async 예외 조항)·§8(backend-only/승격 note) 개정 추가.
- **W3 (Naming Collision)**: `ai_agent:tool-payload-budget` 이 shared-package 밖(backend-only)이라 `backend-labels.test.ts` P3-C-1 i18n parity 가드 사각지대 → KO 매핑 누락이 조용히 빌드 통과. → Phase 1/2 에 ruleId 등록 + `GRAPH_WARNING_KO` 매핑 명시.
- **W5 (Convention Compliance)**: `output.error` 에 LLM 계열 필수 `retryable` 누락(node-output §3.2.1). → D1/D2 에 `retryable: false` 명시.

## INFO
- I1: D1 예산 표에 개명 전 `AI_TOOL_BUDGET_EXCEEDED` 잔존 → `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 정정 (spec 반영 전 필수).
- I2: `evaluateAiAgentToolPayloadWarnings` 의 도구 소스가 `ai-agent-tool-connection-rewrite`(TBD) 확정 시 `toolNodeIds` 추가 동기화 필요 → 백로그 추적 메모.
- I3: "워크스페이스 설정" 대안 트리거 미정의 → 삭제 또는 "(백로그)" 스코프아웃.
- I4: `_MAX_BYTES`(soft) vs `_HARD_BYTES` 비대칭 → `_SOFT_BYTES`/`_HARD_BYTES` 대칭 명명.
- I5: estimator 반환 타입 표기 통일.

## Checker별
| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | 재시도 필요 (output 미생성) | — |
| Rationale Continuity | 재시도 필요 (output 미생성) | — |
| Convention Compliance | MEDIUM | 3중가드/동적severity/retryable |
| Plan Coherence | MEDIUM | single-turn error 라우팅 미해결 CRITICAL 충돌 |
| Naming Collision | LOW | i18n 가드 사각지대 (리터럴 충돌 없음) |

## 판정: BLOCK NO → WARNING 전부 plan/spec 에 incorporate 후 진행.
