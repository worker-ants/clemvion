# Consistency Check 통합 보고서 (--impl-done, spec/5-system/)

**BLOCK: NO** — 5개 checker 전원 실제 diff 기준 **0 Critical**.

> Workflow 자동 summary 는 3/5 만 확보돼 "잠정" 이라 했으나, 나머지 2개
> (rationale_continuity·plan_coherence)도 journal 확인 결과 **NONE** — 전수 확보.
> 인프라 이슈 2건(판정 무영향): (1) orchestrator target 오선정(size-cap truncate 로
> 무관 문서 `1-auth`/`10-graph-rag` 전달) — 3개 checker 가 독립적으로 감지해 워킹트리
> `git diff` 로 대체 검증. (2) 2개 checker 파일 FS-write flakiness → journal 복원.

## 전체 위험도
**LOW** — 이번 diff 는 프론트엔드 순수 behavior-preserving DRY 리팩터, **`spec/**` 변경
0건**. 기존 248 테스트 전수 통과로 무회귀 보증.

## Critical
없음 (5 checker 전원, 실제 diff 기준).

## Checker별 판정 (전원 실제 diff)
| Checker | 위험도 | 확보 |
|---|---|---|
| cross_spec | NONE | 자가보정(git diff) — 데이터모델·API·요구사항ID·상태전이·RBAC·계층 6관점 무위반 |
| rationale_continuity | NONE | journal — 기각대안 재도입·번복·invariant 우회 없음(리팩터라 결정 변경 없음) |
| convention_compliance | LOW | 자가보정 — 규약 정밀 준수. 유일 WARNING(error-codes 카탈로그 SoT 괴리)은 **내 PR diff 무관 기존 spec 이슈** |
| plan_coherence | NONE | journal — 실제 target 무변경, 미해결 결정 충돌·선행 미해소·후속 누락 없음 |
| naming_collision | NONE | 코드 심볼 6개(cloneSchema/collectProps/getOrCreateObjectChild/mergeLeafProps/enrichByProjecting/OUTPUT_SCHEMA_ENRICHERS) grep 전수 — 충돌 없음 |

## WARNING (내 PR 무관, 별도 백로그)
- convention #2: `3-error-handling.md §1.2` 에 WebAuthn/2FA/`KB_REEXTRACT_IN_PROGRESS` 코드 미등재(카탈로그 SoT 괴리). pre-existing standing 이슈 → project-planner 별도 정합화.

## 인프라 백로그 (tooling)
- orchestrator target 선정을 "디렉터리 사전순 dump" → "code-glob 매칭 우선" 으로 개선(오선정 반복 재발).
- consistency Workflow FS-write flakiness(2/5 파일 미기록) — journal authoritative 로 판정 무영향.
