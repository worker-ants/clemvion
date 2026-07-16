# Consistency Check 통합 보고서 — `--impl-done spec/4-nodes/3-ai/` (14_46_28)

**BLOCK: NO** — 5/5 checker Critical 0 (직접 Agent 재실행으로 전수 산출 확보, FS-flakiness 회피).

W4/W2 리팩터(`operation-tool-schema.ts` 공유 추출 + `cafe24-api-metadata.md` pointer 정정)의 impl-done 검증. **cross_spec 0 Warning → ai-review W1 SPEC-DRIFT 가 실제로 해소됐음이 확인**됨.

## Checker별 결과

| Checker | Critical | Warning | 요지 |
|---|---|---|---|
| cross_spec | 0 | 0 | pointer 정정으로 spec↔code 정합. (pre-existing out-port/count_max Critical 은 이 diff 무관 — task_3ac39ebd) |
| rationale_continuity | 0 | 0 | per-provider 중복이 의도적 결정이었던 근거 없음 — dedup 은 기각 대안 재도입 아님 |
| convention_compliance | 0 | 1 | W1 아래 |
| plan_coherence | 0 | 1 | W2 아래 |
| naming_collision | 0 | 0 | `operation-tool-schema`/`buildOperationJsonSchema`/`makeEnabledToolsFilter`/`OperationSchemaSource`/`OperationFieldSpec` 충돌 없음 |

## Warning + 조치

| # | Checker | 발견 | 조치 |
|---|---|---|---|
| W1 | convention_compliance | `cafe24-api-metadata.md` frontmatter `code:` 가 본문 §2/§7 이 새로 지목한 `operation-tool-schema.ts` 미등재 (glob 가드는 통과하나 evidence 불완전) | **FIX**: `code:` 에 `operation-tool-schema.ts` 추가 (파일 단위 나열 스타일 유지). |
| W2 | plan_coherence | followups.md 를 complete 로 옮기면 pre-existing Critical 2건(out 포트·count_max)의 유일한 durable 앵커(ephemeral `task_3ac39ebd`) 소실. plan L45("plan-complete 에서 처리") vs L55("이관 불필요") 자기모순. 4회 연속 미해소. | **FIX**: 신규 `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` durable 앵커 분리 + `1-ai-agent.md` pending_plans 등록 + followups.md L45/L55 모순 해소. |

## INFO (조치 불요)

- plan_coherence: single-turn 일반 LLM error-routing 갭(§7.3/§10) pending_plans 미등록 — 본 PR 무관(별 트랙).
- plan_coherence: followups.md "후속 백로그" 섹션이 이제 PR #3 로 해소됨(문서 정리 가능 — followups.md complete 이동으로 자연 해소).

## 처분

W1/W2 조치 후 spec frontmatter 2건 변경 → SPEC-CONSISTENCY 가드 재무장 → **fresh impl-done 재실행으로 최종 게이트 확정** (본 14_46_28 은 그 조치 전 baseline).
