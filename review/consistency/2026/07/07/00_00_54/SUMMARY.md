# Consistency Check 통합 보고서 (--impl-done — 커밋 1374638ef postdate)

**BLOCK: YES** — Critical 1건 (target 문서 내부 자기모순, §2.3 vs §6.2). → **후속 커밋에서 해소**.

## 전체 위험도
**MEDIUM** — §2.3 이 call-phase `errors[]` 누적을 "Planned"로 잘못 남긴 자기모순(§6.2/§8.1/§8.2 및 실제 구현·테스트와 반대). 문서 1개 절 국한, 타 spec 충돌 없음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | 위치 | 처분 |
|---|---------|------|------|------|
| 1 | cross_spec | §2.3 "에러 처리" 단락이 Internal Bridge call-phase `errors[]` 누적을 "Planned"로 기술 — 실제로는 이 PR 에서 구현됨(`cafe24/makeshop mcpErrorDelta`, §6.2/§8.1/§8.2 및 테스트와 모순) | `spec/5-system/11-mcp-client.md` §2.3 라인 81 | **해소** — §2.3 라인 81 을 "call-phase 실패는 tool_result+IntegrationUsageLog 에 더해 mcpDiagnostics.errors[](phase=tools/call, Cafe24/MakeShop vocabulary)로도 누적된다"로 정정, "Planned" 제거. (§6.2 잔여 Planned 는 §3.3 캐시만 지칭 — 그대로) 원인: 이 PR spec-sync 중 §2.3 편집이 "file not read" 로 무산된 것을 놓침 → 게이트가 정확히 검출. |

## 참고 (INFO)
| # | Checker | 항목 | 처분 |
|---|---------|------|------|
| 1 | cross_spec | Cafe24/MakeShop 노드 spec 에 call-phase errors[] cross-ref 미언급(모순 아님) | 선택 — 향후 spec 갱신 시 §6 에 한 줄. 본 PR 필수 아님. |
| 2 | naming_collision | 신규 식별자(mcpErrorDelta·McpErrorPhase 확장·redactMcpSecrets 등) 충돌 없음 | 조치 불요. |

## Checker별 위험도
| Checker | 위험도 |
|---------|--------|
| cross_spec | MEDIUM (§2.3 자기모순 Critical → 해소) |
| naming_collision | NONE |
| rationale_continuity / convention_compliance / plan_coherence | 미기록(write 차단) |

## 권장 조치
1. (BLOCK 해소) §2.3 라인 81 "Planned" 정정 → **후속 커밋 적용**.
2. 정정 후 fresh --impl-done 재실행하여 BLOCK: NO 확보.
