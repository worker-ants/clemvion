# Consistency Check 통합 보고서 (--impl-done spec/7-channel-web-chat/, diff-base origin/main)

**BLOCK: NO** (journal 복구 후 확정) — 5/5 checker Critical 0. disk-write gap 이던 rationale_continuity·convention_compliance 를 journal.jsonl 에서 복구해 확인.

> **disk-write gap 재판정** ([[feedback_workflow_disk_write_gap_false_counts]]): rationale_continuity·convention_compliance output 미기록 → main 이 journal 복구. 결과: rationale WARNING 1(pre-existing, 무관)·convention INFO 1(pre-existing), 둘 다 Critical 0.

## Critical 위배
없음 (5/5 checker Critical 0).

## 경고 (WARNING)

| # | Checker | 발견 | 조치 |
|---|---------|------|------|
| W1 | plan_coherence | widget-app §3.1 L88·"새 대화" 행·§R6·§R7·§R9 + auth-session §R6 이 **EIA-RL-07 백엔드 idle-wait reaper 를 유보 마커 없이 기정사실**로 서술. 백엔드 reaper 코드 부재(PR-2 미착수) | **정정**: 해당 EIA-RL-07 backstop 참조에 "(Planned — 백엔드 reaper PR-2)" 마커 추가. PR-2 랜딩 시 implemented 로 flip |
| W2 | rationale_continuity | 2-sdk.md R4 "§5 ChatInstance=공개 계약 SoT" 가 실제 공개 export `ClemvionChat.setWidgetBase` 를 누락(SoT 완전성 우회) | **본 PR 범위 밖**(2-sdk.md·SDK 패키지, §R9 무관·pre-existing). 후속 planner 항목으로 기록 |

## 참고 (INFO)

| # | Checker | 항목 | 조치 |
|---|---------|------|------|
| I1 | plan_coherence | `spec-sync-external-interaction-api-gaps.md:22` item 이 위젯 완료 반영 못한 `[~]` stale (governing plan 은 정확) | 갱신(위젯 부분완료·EIA-RL-07 백엔드 잔여) |
| I2 | convention_compliance | `EmbedConfigDto` 파일명 `*-response.dto.ts` 미준수(pre-existing, web-chat 미유발) | 본 PR 범위 밖 |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| cross_spec | NONE | diff(§3.1 410 정밀화)가 impl-prep WARNING 정확 반영. §R9 coalesce/cancel 전 인접 spec 정합, 새 모순 0 |
| rationale_continuity | LOW (journal 복구) | Rationale 연속성 양호(R6~R9·admin R2 명문화). WARNING=2-sdk setWidgetBase(무관) |
| convention_compliance | LOW (journal 복구) | 규약 준수 높음. WEBCHAT_ prefix 근거 명시 모범. INFO=EmbedConfigDto 파일명(pre-existing) |
| plan_coherence | LOW | WARNING=EIA-RL-07 유보 마커 부재 + INFO=백로그 stale |
| naming_collision | NONE | 신규 식별자 실충돌 0 |

## 결론
BLOCK: NO — push 가능. W1(EIA-RL-07 Planned 마커) 정정, I1(백로그 갱신) 반영. W2/I2 는 pre-existing·본 §R9 PR 무관 → 후속 기록만.
