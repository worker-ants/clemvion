# Consistency Check 통합 보고서

**BLOCK: NO** — 5종 checker 전원 Critical 0건, 신규 발견 0건 (전 위험도 NONE)

> **세션 성격**: `spec/conventions/`(특히 `spec-impl-evidence.md`) 변경에 대한 **3차(종결)
> 라운드**다. 같은 브랜치·같은 target 에 세 번 돌았고, 본 라운드가 "코드/문서를 추가로
> 건드릴 필요가 있는 발견이 0건" 이라는 종료 조건을 만족한 첫 라운드다.
>
> `_retry_state.json` 의 `agents_pending` 에 5종이 남아 있으나(orchestrator bookkeeping
> 미갱신) 5개 산출 파일 전부가 디스크에 있고 각 말미에 `STATUS=success` 가 있다 —
> **5종 정상 완료**로 판단했다(파일 실측: 5/5).

## 3라운드 수렴 — 코드 수정을 유발한 발견 건수

| 라운드 | 세션 | 발견 | 비고 |
|---|---|---|---|
| 1차 | `01_09_04` | **9건** | naming 3 · convention 1+2 · cross-spec 2+1 · plan-coherence 2+1 |
| 2차 | `01_37_01` | **1건** | 3종 checker 가 같은 항목으로 수렴 — `plan-scan.ts:21` 의 stale plan 포인터 |
| 3차 | 본 세션 | **0건** | 5종 전부 NONE. 2차 지적이 `e9b789a44` 로 전부 반영됐음을 재확인 |

세 번 돈 이유는 `review_guard` 의 freshness 규칙이다 — 리뷰 완료 시각을 **세션 디렉터리
타임스탬프**로 읽으므로, 지적을 반영하느라 spec-linked 파일을 건드리면 그 라운드가 통째로
무효가 된다. 그래서 "코드를 건드리는 발견이 0인 라운드" 가 종료 조건이었다.

## 알려진 프롬프트 결함 (숨기지 않고 명시)

세 라운드 모두 **`## 구현 변경 사항` diff 섹션이 번들 예산에 밀려 프롬프트에 없었다.**
1·2차에는 target 문서(`spec-impl-evidence.md`)마저 번들에서 빠졌다. 5종 전원이 이 결함을
리포트 상단에 명시했고, 대응은 동일했다 — 워킹트리 절대경로에서 `git log`/`git show`/
`git diff origin/main...HEAD`/`git grep`/직접 `Read` 로 재구성해 판정했다.

**즉 이번 판정의 근거는 번들이 아니라 직접 확인이다.** 이 한계를 다음 사람이 알아야 한다.
번들 예산 문제 자체는 이 라운드의 조치 범위 밖이며
[`harness-review-gate-followups.md`](../../../../plan/in-progress/harness-review-gate-followups.md)
에 별도 등재돼 있다.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

없음. 2차의 유일한 WARNING(`plan-scan.ts:21` stale plan 포인터 — cross-spec/plan-coherence/
naming 3종이 각자 관점에서 지적)은 `e9b789a44` 에서 정정됐고 이번 라운드 5종 전원이 반영을
직접 확인했다.

## 참고 (INFO)

| # | Checker | 항목 | 판단 |
|---|---|---|---|
| 1 | plan_coherence | **스캔 범위에 따라 결과가 갈린다** — walker 코드 도메인(`codebase/frontend/src/lib/docs/__tests__/`)으로 좁히면 stale 0건이지만, harness 전반으로 넓히면 `.claude/tests/test_review_changeset_warning.py:10` 이 `plan/in-progress/harness-review-gate-ci-backstop.md` 를 가리키는데 그 파일은 `plan/complete/` 로 이동했다(실측 확인). | **이 PR 이전부터 있던 것**이라 신규 결함 아님. 마크다운 링크가 아닌 평문 코드 주석 참조는 이 PR 이 만든 링크 게이트의 대상도, `spec-link-integrity` 의 대상도 아니다(§4.2 각주가 소관 제외를 명시). 게이트 비차단 |
| 2 | convention_compliance | `plan-scan.test.ts` 가 `spec-impl-evidence` frontmatter `code:` 에 미등재 — `spec-links.ts`/`spec-links.test.ts` 의 기존 비대칭 패턴 연장 | 미조치 유지(기존 판단), 재지적 불필요 |

> **INFO 1 은 내(호출자) 진술을 정정한다.** 나는 앞서 "코드 주석이 부르는 실존 plan 파일
> 12종 중 stale 은 한 건뿐" 이라고 했는데, 그 스캔은 `codebase/**/*.ts` **한정**이었다.
> `.claude/**/*.py` 를 포함하면 최소 1건이 더 있다. **범위를 말하지 않은 채 전수처럼
> 말한 것이 오류다** — 이 저장소가 반복 학습한 "측정 주장은 범위와 함께" 의 같은 클래스다.

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---|---|---|
| cross_spec | NONE | 2차 지적 3건 반영 확인. 네 층 미러(PROJECT.md:277 · `spec-impl-evidence §2.2/§4.2` · `plan-lifecycle §4/§5` · 가드 코드)가 검사 스코프·TERMINAL 4값·cutoff(2026-06-04)·도입일(2026-08-09) 축으로 완전 일치 |
| rationale_continuity | NONE | `#970` 인용 축소가 원 사건(security 게이트 설계 원칙)과 부합함을 `harness-guard-followups.md`·`push-guard-worktree-scope.md` 실측 대조로 검증. 기각 대안 재도입·원칙 위반·무근거 번복·invariant 우회 전부 해당 없음 |
| convention_compliance | NONE | 도입일 정정이 실제 커밋 author date(`9e880e908`, 2026-08-09T23:33:51+09:00)와 일치. 세 미러가 순서·세부·예외조건까지 정합 |
| plan_coherence | NONE | 두 plan 상호 참조 양방향 일관. `Gate C`/`plan-frontmatter`/`TERMINAL_PLAN_STATUSES` 를 언급하는 진행 중 plan 7건 전수 확인 — 충돌 없음. 신규 plan 규약 준수 |
| naming_collision | NONE | `git grep` 전수: 살아있는 `docs-guard-walker-dedup` 참조는 정확히 2곳(정정된 포인터 + 상호참조). `TERMINAL_PLAN_STATUSES`(backend 동명 상수와 분리) · `pr:`(6개 완료 plan 동일 관례, `merged_pr` 잔존 0) 충돌 없음 |

## 권장 조치사항

1. **조치 불요** — 본 라운드는 종결 라운드다. push gate 는 이 SUMMARY 의 `BLOCK: NO` 를
   근거로 통과 가능하다.
2. (선택) INFO 1 의 stale 참조 — 코드 주석 속 **평문** plan 경로를 저장소 전역에서 점검하는
   저비용 정리를 원하면 별도 plan 으로 열 것. 이 PR 이 만든 게이트가 보지 않는 축이다.
3. INFO 2 는 기존 판단대로 미조치 유지.
