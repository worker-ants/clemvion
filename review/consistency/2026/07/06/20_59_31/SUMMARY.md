# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — target(`spec/5-system/11-mcp-client.md`)은 조사된 모든 축에서 실제 코드·인접 spec과 대체로 정합하나, `mcpDiagnostics` shape 서술이 `1-ai-agent.md`와 어긋나는 WARNING 1건과 문서 구조·Rationale 미비 관련 INFO 다수가 있음. 단, `rationale_continuity`/`naming_collision` 2개 checker는 output 파일 부재로 검증 미완료.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `mcpDiagnostics` shape 불일치 — `1-ai-agent.md`가 미구현 필드를 이미 구현된 것처럼 제시 | `spec/5-system/11-mcp-client.md` §6.2 (미구현/Planned 명시: `attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`errors[]`) | `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 (라인 485-491) 동일 JSON 예시가 "미구현" 표기 없이 현재 출력처럼 제시. `0-common.md` §7(113행)은 현재 구현(`serverSummaries[]`)과 일치 | 단기: `1-ai-agent.md` §7.1 예시에 mcp-client.md와 동일한 "미구현(Planned)" 각주 추가하거나 현재 구현 shape(`serverSummaries[]`)로 교정. 중기: `plan/in-progress/spec-sync-mcp-client-gaps.md`의 "spec 동기화" phase 범위에 `1-ai-agent.md` §7.1 예시 갱신을 명시적으로 추가 (현재 plan은 §6.2/§8.2만 언급, 1-ai-agent.md 누락) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `autoRefresh` derived 필드 Rationale 문구 stale (target과 직접 무관한 인접 drift) | `spec/2-navigation/4-integration.md` 라인 794(본문, 3-provider: cafe24/google/makeshop) vs 라인 1197(Rationale, 2-provider: cafe24/google만) | 라인 1197을 본문과 동일하게 3-provider로 갱신 (project-planner 소관, 별건) |
| 2 | convention_compliance | `## Rationale` 섹션 부재 | 문서 전체 (마지막 섹션 `## 12. 확장 포인트`로 종료) | §2.2(stdio 미지원 근거)/§2.3(Internal Bridge 신설 근거)/§8.4(자동 status 전환 근거)를 모아 `## Rationale` 섹션 신설. CLAUDE.md상 "권장" 수준이라 차단 사유 아님 |
| 3 | convention_compliance | `mcpDiagnostics.errors[].code` vocabulary와 실제 코드(`mcp-error-codes.ts`) 대조 — 위반 없음, 정합 확인 기록 | §6.2, §8.2 | 조치 불필요 (참고용) |
| 4 | plan_coherence | payload에 `spec-sync-mcp-client-gaps.md` 관련 plan 누락되었으나 저장소 직접 조회로 교차검증 결과 target은 이미 정합 | frontmatter `pending_plans:`, 본문 §3.3/§6.2/§8.2 | target 갱신 불필요. orchestrator의 plan_coherence payload 생성 스크립트가 target 경로 역참조(`grep -l`)를 놓치는지 점검 권장 (스크립트 개선 사항) |
| 5 | plan_coherence | `ai-agent-tool-connection-rewrite.md`와의 관계 확인 — 충돌 없음 | §2.3 Internal Bridge, §5.2 `mcp_*` prefix | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `mcpDiagnostics` shape가 `1-ai-agent.md` §7.1과 불일치(WARNING); `autoRefresh` Rationale stale(INFO, 별건) |
| rationale_continuity | **재시도 필요** | status=success로 보고되었으나 output 파일(`rationale_continuity.md`)이 디스크에 존재하지 않음 |
| convention_compliance | LOW | `## Rationale` 섹션 부재(INFO); 명명·출력 포맷·frontmatter 등 나머지 모든 축 정합 확인 |
| plan_coherence | NONE | 관련 in-progress plan과 완전 정합, 충돌 없음 |
| naming_collision | **재시도 필요** | status=success로 보고되었으나 output 파일(`naming_collision.md`)이 디스크에 존재하지 않음 |

## 권장 조치사항
1. **재시도**: `rationale_continuity`, `naming_collision` 두 checker를 재실행 — status는 `success`로 보고됐으나 output 파일이 실제로 디스크에 기록되지 않았음 (write 차단/실패 추정).
2. (WARNING 해소) `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 예시에 "미구현(Planned)" 각주 추가 또는 현재 구현 shape로 교정 — `spec-sync-mcp-client-gaps.md`의 spec 동기화 phase 범위에 이 파일을 명시적으로 포함.
3. (INFO, 선택) `spec/2-navigation/4-integration.md` 라인 1197 Rationale 문구를 본문과 동일하게 3-provider로 갱신 (별건, project-planner 소관).
4. (INFO, 선택) `spec/5-system/11-mcp-client.md` 말미에 `## Rationale` 섹션 신설 — 급하지 않은 문서 정리성 개선.
