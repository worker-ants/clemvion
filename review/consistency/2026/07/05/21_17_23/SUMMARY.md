# Consistency SUMMARY — impl-done spec/conventions/ (21_17_23)

모드: `--impl-done` scope=`spec/conventions/`, diff-base=origin/main. 대상 커밋 `b6a9c6cf5` + `358f12ca1` (ResultDetail waiting props hook 추출 + interaction-type-registry 매트릭스 SoT 동반 갱신).

경로: 직접 Agent fan-out (5 checker). 각 checker 는 orchestrator prompt payload 가 target(`interaction-type-registry.md`) 대신 무관 cafe24 catalog dump 를 담은 mis-scoping 을 감지하고 working-tree `git diff origin/main..HEAD` 직접 검증으로 우회함 (impl-done payload 오배선 알려진 이슈 — prompt 에 명시 diff 컨텍스트 제공으로 보정됨).

## BLOCK: NO

Critical 0, Warning 0.

## Checker 결과

| Checker | block | Critical | Warning | 판정 |
|---|---|---|---|---|
| cross_spec | NO | 0 | 0 | 매트릭스 §1.2 vs 코드(hook deriveFlags·drawer·page) 정합. 타 spec 에 drawer/page 를 파생 site 로 지목하는 stale 참조 없음. (INFO: `code:` frontmatter hook 미등재 = 기존 정책 일관, 비회귀) |
| rationale_continuity | NO | 0 | 0 | §4 Rationale 3-guard 설계(매트릭스 SoT + AST REGISTRY_SITES + TS exhaustive) 불변·손상 없음. 기각 대안 재도입/원칙 위반 없음 |
| convention_compliance | NO | 0 | 0 | rule 3 프로즈 = 실제 REGISTRY_SITES 배열 정합. 레터 (a)~(f) 연속. drawer isLiveConversation subset 서술 정확 |
| plan_coherence | NO | 0 | 0 | plan 체크박스 = 실제 상태. follow-up 누락 0. 타 in-progress plan 충돌 없음 |
| naming_collision | NO | 0 | 0 | `useResultDetailWaiting`·`deriveFlags`·파일명 유일. barrel 재수출 모호성 없음 |

CRITICAL 정합 위배 없음 → BLOCK: NO. spec-linked 코드 변경(interaction-type-exhaustiveness.test.ts) SPEC-CONSISTENCY 게이트 충족.
