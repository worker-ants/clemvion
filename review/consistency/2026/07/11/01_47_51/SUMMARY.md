# Consistency Check (--spec) 통합 보고서

대상: `plan/in-progress/spec-draft-waiting-surface-guard.md` — 대기 표면 ↔ 명령 매트릭스
가드의 spec 본문 역류 반영 (5개 위치).

## BLOCK 결정: **NO** (반영 진행)

spec 본문 내용에 CRITICAL 없음. convention_compliance 가 올린 CRITICAL 1건은 **draft plan
파일 자체의 frontmatter `worktree:` 누락**(spec 본문 계약 아님) — draft 는 반영 후 삭제(transient)
되므로 무효화됐고, 반영된 spec 파일들은 doc-guard(vitest `src/lib/docs/__tests__` 2548 pass)
통과. 나머지는 WARNING/INFO.

## checker 별 결과

| checker | CRITICAL | 요지 |
|---|---|---|
| cross_spec | 0 | draft 의 before/after 텍스트가 실제 파일·코드와 라인 단위 정합. 신규 계약 없이 기존 매핑 재사용. WARNING: 1b 라인 인용 정밀도 → **1b 미채택으로 해소** |
| rationale_continuity | 0 | 신규 Rationale 이 기각 대안 재도입·invariant 위반 없음. §10.9 인용·fail-closed 선례 실재 확인. WARNING: 문구 정정 권고(비차단) |
| convention_compliance | 1(draft frontmatter) | error-codes·spec-link-integrity·3섹션 구조 준수. CRITICAL=draft plan `worktree:` 누락(transient draft 삭제로 무효). WARNING: registry `code:` 는 repo-root 경로로 반영(적용됨) |
| plan_coherence | 0 | S-1 위임 5위치 빠짐없이 반영, 스코프 제한 준수. WARNING: 1b 가 §7.5.1 lookup-key 서술과 상충(F-1 pre-existing) → **1b 미채택으로 회피**, F-1/F-2/F-3 aggregator 미러링은 후속 |
| naming_collision | 0 | `WaitingSurface`(3값)↔`WaitingInteractionType`(4값) 파생 뷰 관계를 §1.1 note 로 명시. BLOCK:NO |

## 반영 결과 (적용됨)

1. `spec/5-system/4-execution-engine.md` — §7.5.1 표 3번째 행 + Rationale 신규 항목.
2. `spec/5-system/14-external-interaction-api.md` — §5.1 STATE_MISMATCH 예시 + §6.2 expectedCommands 각주.
3. `spec/4-nodes/6-presentation/0-common.md` — §10.9 buttons publisher 거부 대칭 서술.
4. `spec/3-workflow-editor/3-execution.md` — §9 /continue 422 조건 확장.
5. `spec/conventions/interaction-type-registry.md` — §1.1 표면 가드 소비처 cross-ref + `code:` frontmatter.

**미채택**: §7.5.1 L1041 receiver 서술 변경(1b) — F-1 pre-existing 갭 영역이라 lookup-key 서술은
F-1 트랙에서 처리(plan_coherence 지적 반영).

## 후속 (비차단)

- F-1/F-2/F-3 를 `spec-sync-external-interaction-api-gaps.md` aggregator 에 미러링(plan_coherence).
