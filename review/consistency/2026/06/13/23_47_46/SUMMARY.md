# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 모든 위배는 WARNING 이하.

## 전체 위험도
**LOW** — spec doc-sync 3건 + 코드 주석 교정 1건은 기존 spec 과 직접 모순 없이 채택 가능. 단, 적용 후 관련 plan 체크박스 갱신 및 plan 간 순서 조율이 필요한 WARNING 4건 존재.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Plan Coherence | 변경 2(W2) 적용 후 `spec-sync-resume-dispatch-registry.md` W2 체크박스 미갱신 → stale plan. 또한 plan 의 §1.1 Backend 행 범위 포함 여부가 draft 에 명시되지 않음 | `spec/conventions/interaction-type-registry.md §1.2` | `plan/in-progress/spec-sync-resume-dispatch-registry.md` W2 | 적용 후 W2 를 `[x]` 로 갱신, §1.1 처리 여부 명시 |
| W2 | Plan Coherence | 부수 I3(JSDoc 교정) 적용 후 동일 plan 의 I3(선택) 체크박스 미갱신 → stale. W2·I3 모두 완료 시 plan 을 `plan/complete/` 로 이동 검토 필요 | `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts` JSDoc | `plan/in-progress/spec-sync-resume-dispatch-registry.md` I3 | 적용 후 I3 를 `[x]` 처리, plan 완료 이동 여부 결정 |
| W3 | Plan Coherence | 변경 3(SSE Rationale 블록) 이 `spec-update-sse-single-instance-rationale.md` 와 동일 변경 — 중복 적용 가능성. worktree `trigger-schedule-sync-f88604` 에서 병행 작업 여부 미확인 | `spec/data-flow/15-external-interaction.md` Rationale | `plan/in-progress/spec-update-sse-single-instance-rationale.md` (전체) | 적용 완료 후 해당 plan 을 `plan/complete/` 로 이동, `trigger-schedule-sync-f88604` worktree 중복 편집 여부 확인 |
| W4 | Plan Coherence | 변경 1 이 §1.3 note 를 압축하면 `spec-update-gap-callout-plan-links.md` 의 동일 위치 plan 링크 추가 문안이 불일치 — 순서대로 적용 시 충돌 가능성 | `spec/data-flow/7-llm-usage.md §1.3` | `plan/in-progress/spec-update-gap-callout-plan-links.md` | 변경 1 적용 후 gap-callout-plan-links 의 §1.3 항목을 새 note 형태에 맞게 갱신하거나, 두 변경을 동일 적용 단위로 묶음 |
| W5 | Convention Compliance | draft frontmatter `status: draft` 가 spec-impl-evidence §3 라이프사이클 enum 비표준 값 (표준 5값: implemented/partial/planned/deprecated/archived). draft 가 실수로 `spec/` 에 놓일 경우 frontmatter 가드 fail 위험 | draft 2행 `id: spec-sync-s-batch-draft` | `spec/conventions/spec-impl-evidence.md §2.1`, §3 | 작업용 합성 draft 에는 spec-impl-evidence 스키마 대신 plan frontmatter 스키마 사용 권장. 현재 파일 위치(`/Users/gehrig/.claude/jobs/`)에서는 즉각 위반 아님 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | 변경 3 SSE Rationale 가 EIA `§R10` 과 동일 사안 이중 기재 우려 (직접 모순 없음) | `spec/data-flow/15-external-interaction.md` Rationale 신설 블록 | 신설 블록 내 "상세 근거: EIA §R10" cross-ref 추가 또는 블록 내용을 축약해 이중 기재 면적 최소화 |
| I2 | Cross-Spec | 부수 I3 — JSDoc `§6.2(중첩 재개)` 표기가 실제 spec 섹션 명칭과 불일치 (§6.2는 저장 전략, 중첩 재개는 §7.5). draft 교정안이 이미 올바른 교정 제시 | `resume-turn-dispatch.ts` line 24 JSDoc | draft 교정안(`§7.5(rehydration · 중첩 sub-workflow 재개) · §6.2(영속화 정책)`) 그대로 적용 |
| I3 | Plan Coherence | `spec-update-doc-style.md` W10 예시가 attribution 갭을 "해소됨"으로 표현 — 현행 spec 의 "결정 대기" 상태와 방향 상이. target 변경 1 이 "결정 대기 보존"을 올바르게 유지하므로 SoT 는 target | `spec/data-flow/7-llm-usage.md §1.3` | `plan/in-progress/spec-update-doc-style.md` W10 예시 | `spec-update-doc-style.md` W10 예시를 "결정 대기 보존" 방향으로 메모 수준 정정 |
| I4 | Naming Collision | draft 내부 이슈 번호 `(W2)`·`(W10)`·`(I3)` 가 기존 spec 내 레이블(`W2 SPEC-DRIFT` 등)과 표기 중복. spec 본문에 직접 삽입될 식별자가 아니므로 실질 충돌 없음 | draft 내부 번호 전체 | `spec/5-system/4-execution-engine.md` L1343, `spec/data-flow/13-agent-memory.md` L76 | spec 편집 시 괄호 이슈 번호를 본문에 남기지 않도록 주의 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 3건 변경 모두 기존 spec 과 직접 모순 없음. INFO 2건(EIA §R10 이중 기재 우려, JSDoc 섹션 레이블 교정) |
| Rationale Continuity | NONE | 기각된 대안 재도입 없음, 합의 원칙 위반 없음, 결정 무근거 번복 없음 |
| Convention Compliance | LOW | spec 편집 내용 자체는 전 규약 준수. WARNING 1건은 draft 파일 자체의 frontmatter 패턴 메타 지적 (운영 영향 없음) |
| Plan Coherence | LOW | 적용 후 plan 체크박스 갱신 누락·순서 조율 미이행 시 stale plan 위험 4건. 결정 번복 CRITICAL 없음 |
| Naming Collision | NONE | 신규 식별자 전부 기존 spec 의 동일 의미 코드 식별자 재사용 또는 spec 비노출 내부 번호. 충돌 없음 |

## 권장 조치사항

1. **(적용 전)** 변경 1 과 `spec-update-gap-callout-plan-links.md` 를 동일 적용 단위로 묶거나, 변경 1 적용 후 gap-callout 의 §1.3 문안을 새 note 형태에 맞게 갱신 (W4 해소).
2. **(적용 전)** `trigger-schedule-sync-f88604` worktree 에 `spec/data-flow/15-external-interaction.md` 편집이 병행 진행 중인지 확인해 변경 3 중복 커밋 방지 (W3 예방).
3. **(적용 후)** `plan/in-progress/spec-sync-resume-dispatch-registry.md` W2, I3 를 `[x]` 로 갱신, §1.1 범위 처리 여부 명시 후 plan 완료 이동 검토 (W1·W2 해소).
4. **(적용 후)** `plan/in-progress/spec-update-sse-single-instance-rationale.md` 를 `plan/complete/` 로 이동 (W3 해소).
5. **(권장)** 변경 3 SSE Rationale 신설 블록에 EIA §R10 cross-ref 추가해 이중 기재 면적 최소화 (I1 해소).
6. **(권장)** 작업용 합성 draft 의 frontmatter 에 spec-impl-evidence 라이프사이클 스키마 대신 plan frontmatter 스키마를 사용하도록 orchestrator 패턴 정비 (W5 예방).
