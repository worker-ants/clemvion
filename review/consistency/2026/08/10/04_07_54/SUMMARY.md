# Consistency Check 통합 보고서 (impl-done, 7차 — 최종)

- 대상: `spec/conventions/` · diff-base `origin/main`
- checker 5종 전원 실행·전문 확보. 누락 없음.

## BLOCK: NO

Critical 0건. WARNING 4건은 전부 문서 정확성·규약 성문화 문제이며 **아래 §조치대로 이번
라운드에서 해소**했다(2건은 코드 수정, 2건은 문서 정정).

## 전체 위험도

**MEDIUM** — plan_coherence NONE · naming/cross_spec/convention LOW ·
rationale_continuity MEDIUM.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | checker | 발견사항 | 조치 |
|---|---------|----------|------|
| 1 | rationale_continuity | 신규 등재 4건을 "선재 구조" 로 분류했으나 **절반이 이 PR 자신의 코드**다 — `matter(raw, {})` 4곳 중 `plan-scan.ts` 2곳은 신규 파일이고 `spec-plan-completion.test.ts` 2곳은 `origin/main` 에 옵션이 **아예 없었다**(그 PR 이 `{}` 를 넣으며 관용구를 복제). Gate C 동등성 갭도 신규 `collectCompletePlanMarkdown` 이 기존 구현을 재사용하지 않은 데서 나왔다 | **fix.** 항목별로 `git show origin/main` 실측해 확인. 자기 PR 이 만든 중복이므로 등재가 아니라 제거 — `parseFrontmatterSafe` 단일 진입점 신설(4곳 전부 위임) + `collectCompletePlans` 를 공유 구현 위임으로 축소. 등재 문서의 오분류도 정정 |
| 2 | rationale_continuity · cross_spec | `worktree-policy.md §3` 이 폐기된 `plan_coherence` 충돌 검출을 **여전히 정본처럼** 서술 — `plan-lifecycle.md` 만 고쳐 "SoT 를 함께 정정했다" 는 주장이 부분적으로만 참이었다 | **fix.** 정정 + 폐기 이력 인용. 전수 grep 으로 그 기능이 살아있다고 주장하는 곳이 0건임을 확인 |
| 3 | convention_compliance | in-progress plan **삭제** 경로가 `plan-lifecycle.md` 에 성문화돼 있지 않다 — 문서는 `research/` 삭제만 허용한다. 이번 삭제는 실질적으로 정당하나(코드로 실측 확인), 규약이 침묵하면 향후 **Gate C 회피용 삭제**가 같은 논리로 정당화된다 | **fix.** §3 에 좁은 예외를 성문화 — 조건 넷(미착수 · 항목 전부 해소 · 인입 참조 0 · 삭제 커밋에 흡수처 명시)을 모두 만족할 때만. 넓어지면 안 되는 이유와 선례 2건을 함께 적었다 |
| 4 | naming_collision | `collectCompletePlanMarkdown` vs `collectCompletePlans` 근접 충돌 | **해소.** WARNING #1 의 통합으로 후자가 3줄 위임 함수가 되어 병렬 구현이 사라졌다 |

## 참고 (INFO)

| # | checker | 발견사항 | 조치 |
|---|---------|----------|------|
| 1 | convention_compliance | `spec-impl-evidence.md` `code:` 에 `plan-scan.test.ts`/`spec-links.test.ts` 미등재. 다만 `spec-links.ts` 가 이 PR 이전부터 짝 테스트 없이 등재된 기존 패턴이라 **새 불일치를 만든 것이 아니다** | 조치 불요(직전 라운드와 동일 판단) |
| 2 | naming_collision | `WORKTREE_SENTINEL`(`"(unstarted)"`)이 bash·Python·TS·산문 4곳에 독립 하드코딩 — 언어 경계라 구조적으로 불가피, 현재 값 전부 일치 | 조치 불요(선재 특성) |
| 3 | naming_collision | 같은 파일의 `fm`/`frontmatter` 두 fixture 빌더 — 시그니처가 달라 오호출은 컴파일 타임에 막힌다 | 조치 불요 |

## checker 별 위험도 요약

| checker | 위험도 | 핵심 |
|---------|--------|------|
| plan_coherence | **NONE** | 삭제한 plan 의 네 항목이 전부 코드에 반영됐음을 실측 확인 — "등재가 사라진 것" 이 아니라 정당한 종결. 등재한 orchestrator 결함 수치도 `meta.json` 으로 독립 재현 |
| naming_collision | LOW | 신규 식별자 7종 충돌 없음. 근접 충돌 1건은 통합으로 소멸 |
| cross_spec | LOW | 세 미러가 코드와 line-level 일치. 자매 문서 stale 1건 발견(위 #2) |
| convention_compliance | LOW | 미러 3종 정합. 삭제 경로 성문화 공백 1건(위 #3) |
| rationale_continuity | MEDIUM | vacuous-test 전환은 "진짜 fix" 로 확인. 등재 근거의 사실관계 오분류 1건(위 #1) |

## 이 라운드의 성격

checker 3종에게 **내 판단을 직접 겨누도록** 요청했고, 그중 둘이 실제로 반박했다:

- rationale 은 내 "선재 구조" 분류를 항목별 `git show` 로 반박했다 — **유예 근거는
  실측해야 한다**는 이 저장소 교훈의 세 번째 재현이다. 근거를 항목별로 재지 않고 묶어서
  적으면 절반이 틀려도 통과한다.
- convention 은 내 삭제가 정당함을 확인해 주면서도 **그 정당성이 커밋 메시지 산문에만
  있다**는 점을 짚었다. 규약이 침묵하는 한 다음 사람은 같은 문장으로 회피를 정당화할 수
  있다 — 실질 정당성과 규약 성문화는 다른 문제다.
