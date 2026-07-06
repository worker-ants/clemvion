# Consistency Check 통합 보고서 (--impl-done, 재실행 — 커밋 1a4124842 postdate)

**BLOCK: NO** — Critical 발견 없음. cross_spec / plan_coherence / naming_collision 3개 정상 산출 (rationale_continuity·convention_compliance 2개는 harness write 차단으로 미기록; convention_compliance 는 직전 21_50_54 회차에서 산출됨).

## 전체 위험도
**LOW** — `mcpDiagnostics` 구조화 승격은 cross-spec/plan 정합성 문제 없음(NONE). naming_collision WARNING 1건(식별자 shape 재사용).

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | 위치 | 처분 |
|---|---------|------|------|------|
| 1 | naming_collision | `mcpDiagnostics` 식별자가 계층별로 다른 shape 로 재사용 — provider 입력 슬롯 `ProviderBuildCtx.mcpDiagnostics: McpServerSummary[]` vs meta 출력 `meta.mcpDiagnostics: McpDiagnostics`(구조화) | `agent-tool-provider.interface.ts:69` vs `ai-turn-executor.ts` meta | **해소** — reviewer 제시 2안 중 spec 각주(b)안 채택: spec §6.2 에 두 슬롯 shape 차이 명시(provider 는 serverSummaries/errors sub-array 로만 push, meta 는 finalize 결과). 코드 rename(a안)은 5개 provider push 사이트+테스트 churn 대비 이득 낮아 미채택(field 는 이미 doc comment 로 slot 성격 명시). |

## 참고 (INFO)

| # | Checker | 항목 | 처분 |
|---|---------|------|------|
| 1-2 | rationale_continuity·convention_compliance | 결과 파일 부재(harness write 차단) | convention_compliance 는 21_50_54 회차 산출(BLOCK:NO). rationale_continuity 는 impl-prep 20_59_31 및 본 변경이 기각 대안 재도입 없는 factual sync 라 위험 낮음. |
| 3 | plan_coherence | `spec-update-mcp-client-diagnostics.md` draft 가 적용 후에도 in-progress 잔류 | 하우스키핑 — 내용이 이미 spec 본문+`spec-sync-mcp-client-gaps.md` 완료 요약에 흡수. PR 이력 추적용으로 유지(정합성 영향 없음). |
| 4 | plan_coherence | payload target-plan 매칭 누락(orchestrator) | 프로세스 개선 사항, 본 변경 무관. |
| 5 | naming_collision | 구 `mcpServerSummaries` meta 키 완전 제거·rename 확인 | 조치 불요. |
| 6 | naming_collision | `TimeoutError` vs 기존 `SubWorkflowTimeoutError` — 직접 충돌 없음 | 조치 불요(3번째 사례 시 규약 성문화 검토). |
| 7 | naming_collision | 신규 API 표면 충돌 없음, MCP_ERROR_CODES 값 수준 spec §8.2 일치 | 조치 불요. |
| 8 | cross_spec | 연관 spec 4건(1-ai-agent §7.1/§9·0-common §7·Information Extractor·Cafe24)+SoT 상수 전부 정합, dead ref 없음 | 조치 불요. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 연관 spec 4건·SoT 상수 정합, dead ref 없음 |
| Rationale Continuity | (미산출) | write 차단 — 위험 낮음(factual sync) |
| Convention Compliance | (미산출) | 21_50_54 회차 BLOCK:NO 산출 |
| Plan Coherence | NONE | 사전 설계·승인 범위 정확 일치, INFO 2건(하우스키핑) |
| Naming Collision | LOW | 식별자 shape 재사용 WARNING 1건(spec 각주로 해소) |

## 권장 조치사항
1. (WARNING 해소) spec §6.2 에 `ProviderBuildCtx.mcpDiagnostics` vs `meta.mcpDiagnostics` shape 차이 각주 추가 — 적용함.
2. (하우스키핑) spec-update draft 유지(PR 이력).
