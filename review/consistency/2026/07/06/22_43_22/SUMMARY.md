# Consistency Check 통합 보고서 (--impl-prep)

**BLOCK: NO** — Critical 위배 없음. convention_compliance/naming_collision 산출(2/5), cross_spec/rationale_continuity/plan_coherence 는 harness write 차단으로 미기록(재시도 대상이나 block 무관).

## 전체 위험도
**LOW** — 검증된 checker 기준 Critical 없음. WARNING/INFO 는 본 PR(#3 follow-up)이 해소 대상.

## 경고 (WARNING)
| # | Checker | 위배 | 처분 |
|---|---------|------|------|
| 1 | convention_compliance | `## Rationale` 섹션 부재(3섹션 구성 미준수) | **본 PR #3 에서 해소** — 11-mcp-client.md 에 `## Rationale` 신설(task_947e443e). |

## 참고 (INFO)
| # | Checker | 항목 | 처분 |
|---|---------|------|------|
| 1 | convention_compliance | `INVALID_TOOL_ARGUMENTS` prefix 없음 | **본 PR #3 에서 해소** — error-codes.md 에 전역 공용 코드 예외 등재(rename 대신). |
| 2-3 | convention_compliance | skipReason/code 병존·API 문서 해당없음 | 조치 불요. |
| 4 | naming_collision | ProviderBuildCtx.mcpDiagnostics vs meta.mcpDiagnostics 이름 공유 | 이미 §6.2 각주 소명(#840). 조치 불요. |
| 5 | naming_collision | errors[]/phase/MCP_* 신규 충돌 없음 | 조치 불요. |
| 6 | (통합) | cross_spec/rationale_continuity/plan_coherence output 미기록(write 차단) | block=NO·unfinished=[]. impl-done 에서 cross_spec 재검증. |

## Checker별 위험도
| Checker | 위험도 |
|---------|--------|
| convention_compliance | LOW (Rationale 부재·prefix — 본 PR 해소) |
| naming_collision | NONE |
| cross_spec / rationale_continuity / plan_coherence | 미기록(write 차단) |

## 권장 조치
1. WARNING/INFO(Rationale·prefix) → 본 PR #3 에서 해소.
2. cross_spec 등 3개 → impl-done 에서 재검증.
