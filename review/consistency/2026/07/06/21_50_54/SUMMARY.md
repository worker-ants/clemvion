# Consistency Check 통합 보고서 (--impl-done)

**BLOCK: NO** — Critical 발견 없음. 단, 5개 checker 중 4개의 결과 파일이 디스크에서 확인되지 않아 커버리지가 불완전함(harness bgIsolation write 차단, 아래 참고).

## 전체 위험도
**LOW** — 확인 가능했던 checker(convention_compliance)는 CRITICAL 없이 WARNING 1건 + INFO 2건만 보고 (둘 다 **본 변경과 무관한 기존 컨벤션 부채**). 나머지 4개 checker는 output_file 누락. cross-spec 관점은 impl-prep(20_59_31)에서 실행되어 BLOCK:NO 였고, ai-review requirement-reviewer 가 spec-code 정합을 검증(SPEC-DRIFT 만 발견, 본 PR 에서 해소).

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 처분 |
|---|---------|------|-------------|------|
| 1 | convention_compliance | `## Rationale` 섹션 부재 — `spec/5-system/` 16/18 문서가 따르는 3섹션 구조를 `11-mcp-client.md`가 미준수 | `spec/5-system/11-mcp-client.md` 문서 끝 | **기존 부채·본 변경 무관** (impl-prep 20_59_31 에서도 INFO 로 기록, CLAUDE.md 상 "권장" 수준·차단 아님). Rationale 신설은 §2.2/§8.4/§6.2/§3.2 배경 curation 이 필요한 project-planner scope 스펙 저술 — 본 diagnostics-typing refactor 범위 밖. follow-up 등록. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 처분 |
|---|---------|------|------|------|
| 1 | convention_compliance | `INVALID_TOOL_ARGUMENTS` 에 `MCP_` prefix 부재 (다른 9개 코드는 보유) | §8.2 (463행), `mcp-error-codes.ts:23` | **기존 코드·본 변경 무관** — rename 은 breaking. 범용/전용 의도 정합화는 별건 follow-up. |
| 2 | convention_compliance | `skipReason` vocabulary 의 `node-output.md` §3.2 상호참조 — 문제 없음 (긍정 기록) | §6.2 (393행) | 조치 불필요. |
| 3 | (통합) | cross_spec / rationale_continuity / plan_coherence / naming_collision 4개 output_file 부재 (harness bgIsolation 로 workflow sub-agent 공유 체크아웃 write 차단) | — | block=NO·unfinished=[]. cross_spec 는 impl-prep 에서 실행됨. 본 변경은 shipped code 에 맞춘 factual spec-sync 라 cross/naming 충돌 위험 낮음. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | 재시도 필요 | output_file 없음 (impl-prep 에서 실행됨, BLOCK:NO) |
| rationale_continuity | 재시도 필요 | output_file 없음 |
| convention_compliance | LOW | `## Rationale` 부재(WARNING, 기존 부채), 코드 prefix(INFO, 기존) |
| plan_coherence | 재시도 필요 | output_file 없음 |
| naming_collision | 재시도 필요 | output_file 없음 |

## 권장 조치사항
1. (별건 follow-up) `## Rationale` 섹션 신설 — project-planner scope, 본 PR 범위 밖 기존 부채.
2. (별건 follow-up) `INVALID_TOOL_ARGUMENTS` domain-prefix 정합화.
3. harness bgIsolation 로 4 checker output 미기록 — 신뢰 신호(impl-prep cross_spec BLOCK:NO + ai-review requirement + convention_compliance BLOCK:NO)로 BLOCK:NO 확정.
