# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 차단 불요

> 본 PR(code-node-followups-close)의 변경은 `spec/conventions/chat-channel-adapter.md §3.1` timeout 행에 레이어 구분 註 1개 추가 + plan complete/ 이동뿐이다. 아래 WARNING/INFO 는 checker 가 파일 전체를 검토하며 표면화한 **기존(pre-existing) cross-doc drift** 로, 본 변경이 도입한 것이 아니며 scope 규율상 본 PR 에서 확장 수정하지 않는다(별 후속 권장).

## 전체 위험도
**LOW** — 경고 2건(shape 불일치, 크로스-문서 명칭 불일치), Critical 없음. 모든 핵심 계약·frontmatter·에러코드·타입명은 정합.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `botIdentity.teamId?` 가 Convention §2.3 에 정의돼 있으나 §4.1 JSONB 예제에 누락 — shape 불일치 | `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` | `spec/5-system/15-chat-channel.md §4.1` JSONB 예제 | `§4.1` 예제에 `"teamId": "T012ABCDE" // workspace/team 개념 있는 provider 한정` 주석을 추가해 Convention §2.3 SoT 와 동기화 |
| 2 | Naming Collision | `15-chat-channel.md` R-CC-16 이 target §1.2 union 타입을 `EiaAiMessageEvent` 로 호명하나, §1.2 에는 해당 이름 없음 — 크로스-문서 명칭 불일치 | `spec/conventions/chat-channel-adapter.md §1.2 EiaEvent` | `spec/5-system/15-chat-channel.md` line 654 (R-CC-16) | `15-chat-channel.md` R-CC-16 을 "Convention §1.2 `EiaEvent` (ai_message variant)" 로 수정하거나, §1.2 에 `EiaAiMessageEvent` 별칭을 명시 |

> 두 WARNING 모두 본 PR 의 timeout 註 변경과 무관한 기존 drift (teamId 예제 / EiaAiMessageEvent 명칭). 본 PR scope 밖.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `EiaEvent` 주석이 내부 `executionEvents$` 경로를 EIA 외부 표면 spec 번호로 잘못 인용 (`/* EIA §6.2 */`, `/* EIA §6.5 */`) | `spec/conventions/chat-channel-adapter.md §1.2` | 주석을 "내부 executionEvents$" 임을 명시하도록 수정 |
| 2 | Convention Compliance | `## Overview` 섹션 헤딩 누락 — 본문 첫 단락이 Overview 역할을 하나 섹션 헤딩이 없음 | `spec/conventions/chat-channel-adapter.md` 파일 상단 | `## Overview` 헤딩 추가 (권장 사항, 강제 아님) |
| 3 | Convention Compliance | Rationale ID 혼용 — `R1`–`R4` 가 `R-CCA-N` prefix 없이 유지 (문서 자체가 예외로 자기 선언) | `spec/conventions/chat-channel-adapter.md §Rationale` | 현 상태 유지 |
| 4 | Plan Coherence | gap plan 완료 시 target §7 "두 spec 동시 갱신 의무" 발생 | `spec/conventions/chat-channel-adapter.md §7` / `plan/in-progress/spec-sync-*-gaps.md` | gap plan 체크리스트에 §7 동시 갱신 의무 명시 권장 |
| 5 | Plan Coherence | 머지 완료된 stale worktree 10건 잔류 | `.claude/worktrees/` 다수 | `./cleanup-worktree-all.sh --yes --force` 실행 권장 (필수 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 1건 (botIdentity.teamId? §4.1 예제 누락), INFO 1건 (EiaEvent 주석 오인용) |
| Rationale Continuity | NONE | 기존 Rationale 위반 없음. R-CCA-5·R-CC-15·R3·R4 모두 정합 |
| Convention Compliance | LOW | INFO 2건 (Overview 헤딩 누락, Rationale ID 혼용). 핵심 frontmatter·에러코드·타입명 모두 준수 |
| Plan Coherence | NONE | pending_plans 3건 모두 backlog/unstarted, worktree 경합 없음 |
| Naming Collision | LOW | WARNING 1건 (EiaAiMessageEvent 크로스-문서 명칭 불일치). 타입명·에러코드·이벤트명 충돌 없음 |

## 권장 조치사항 (모두 본 PR scope 밖 — 별 후속)

1. **[WARNING — 권장]** `spec/5-system/15-chat-channel.md §4.1` JSONB 예제에 `"teamId": "T012ABCDE"` 주석 추가 (Convention §2.3 SoT 동기화, 런타임 영향 없음).
2. **[WARNING — 권장]** `spec/5-system/15-chat-channel.md` R-CC-16 line 654 에서 `EiaAiMessageEvent` → `EiaEvent (ai_message variant)` 로 수정해 크로스-문서 명칭 정합화.
3. **[INFO — 선택]** `spec/conventions/chat-channel-adapter.md §1.2` 의 `/* EIA §6.2 */`, `/* EIA §6.5 */` 주석을 "내부 executionEvents$" 임을 명시하는 내용으로 수정.
4. **[INFO — 선택]** gap plan(`spec-sync-*-gaps.md`) 완료 시 체크리스트에 `chat-channel-adapter.md §7` 동시 갱신 의무 항목 추가.
