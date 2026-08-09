# Consistency Check 통합 보고서 (impl-done, 8차 — 종결)

- 대상: `spec/conventions/` · diff-base `origin/main`
- checker 5종 전원 실행·전문 확보. 누락 없음.

## BLOCK: NO

Critical 0건. WARNING 2건은 아래 §조치대로 이 라운드에서 해소했다.

## 전체 위험도

**MEDIUM** — cross_spec/naming/convention/plan_coherence LOW · rationale_continuity MEDIUM.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | checker | 발견사항 | 조치 |
|---|---------|----------|------|
| 1 | rationale_continuity | **세 라운드 연속 미해소.** `developer/SKILL.md §REVIEW WORKFLOW`("PR 에서 미루는 것은 위반")·`§ISSUE FIX 정책`("기존부터 있던 것이라도 조치")을 뒤집으면서 새 Rationale 을 규칙 쪽에 안 남겼다. 앞선 두 라운드가 "(a) 예외 명문화 또는 (b) 실제 fix 를 이번에 결정하라" 고 요구했는데 세 번째까지 **둘 다 안 함** — RESOLUTION 에 `SKILL.md` 언급조차 없어 인지 흔적도 없었다 | **(a) 채택.** `SKILL.md §ISSUE FIX 정책` 에 "수렴 예외" 조항 신설 — 조건 (a) 동작 결함 아님 · (b) fix 가 새 라운드를 강제함 · (c) RESOLUTION 이 근거와 조항을 인용 · (d) 등재는 그 턴에, **넷을 모두** 만족할 때만. 넓어지면 안 되는 이유와 3라운드 이력을 함께 기록. `05_39_08/RESOLUTION.md` 도 조항을 인용하도록 갱신 |
| 2 | plan_coherence | `docs-guard-walker-dedup.md` 에 `NONE_VALUES` 테스트 갭이 **두 번 등재**(01:30·05:48). 5라운드 연속 지적되며 매번 "plan 에 적어라" 관례를 따르다 **갱신 대신 추가**가 반복됨 | 병합 — 구체적인 쪽을 정본으로, 첫 항목은 별개 내용(`collectCompletePlans` fixture 갭)만 남김. 이 경험을 위 §수렴 예외 조건 (d)("기존 항목이 있으면 추가가 아니라 **갱신**")로 규칙화 |

## 참고 (INFO)

| # | checker | 발견사항 | 조치 |
|---|---------|----------|------|
| 1 | plan_coherence | `spec-frontmatter-parse.ts:113` 잔여 hazard 가 다른 항목의 **각주에 묻혀** 착수 시 빠뜨리기 쉬움 | **반영** — 독립 체크박스로 승격 |
| 2 | plan_coherence | 문서 범위가 "판정 선행 필요" 항목과 "바로 착수 가능" 항목이 섞여 자람 | **반영** — 두 절로 분리 |
| 3 | naming_collision | 코드 리뷰가 `find*`=위반배열을 "모듈 컨벤션" 이라 했으나 실제로는 **docs-guard 클러스터 국소 패턴** — 같은 폴더 `findGuiFlowSections` 는 콘텐츠 반환, backend `find*` 는 단건 검색 | **반영** — 등재 문구에 범위 조건 명시(다음 사람이 "전역 규약 위반" 으로 과잉 대응하지 않도록) |
| 4 | convention_compliance | `PROJECT.md:277` 은 `plan-frontmatter.test.ts` 행이고 Gate C 는 `:278` — 내가 이 세션 내내 두 행을 같은 번호로 인용 | 기록. 실질 드리프트는 없음 |
| 5 | convention_compliance | §3 "흡수 시 삭제" 선례 `1493b5ae9` 는 `worktree` 가 `(unstarted)` 가 아니라 **부재**였음 | **반영** — 조건 문구를 "`(unstarted)` 이거나 아예 없는" 으로 보강 |
| 6 | cross_spec | `spec-impl-evidence.md §4.2` 가 `spec/` 접두 제약을 문면에 안 드러냄(모순 아니라 덜 구체적) | 조치 불요. 강제력 SoT 는 코드 |
| 7 | rationale_continuity | RESOLUTION 섹션 표제가 스키마 문자열과 다름 | 조치 불요 |

## checker 별 위험도 요약

| checker | 위험도 | 핵심 |
|---------|--------|------|
| cross_spec | LOW | Gate C 경화가 실데이터를 안 깸 — `spec-plan-completion` **805 tests 전원 GREEN**(강제 대상 각 plan 이 개별 describe 로 실행되므로 전수 검증) |
| naming_collision | LOW | 신규 식별자 6종 충돌 0. `isGateCEnforced` 시그니처 변경이 **파괴적 아님**(외부 import 0건 전수 확인) |
| convention_compliance | LOW | **"미러 한쪽만 정정" 패턴이 이번 델타에서 재발하지 않음** — 이 PR 에서 네 번 낸 결함 |
| plan_coherence | LOW | 등재 중복 1건(위 W2). `plan/complete/` 인용 수정 2건은 본문·다른 필드 무변경 확인 |
| rationale_continuity | MEDIUM | 위 W1 |

## 이 라운드의 성격

**checker 가 내 종결 결정 자체를 판정하도록 요청했고, 그 판정이 결정을 바꿨다.**

rationale 은 "문자 그대로는 재발이 아니다 — 근거 품질이 앞선 둘보다 명확히 낫다" 면서도
"**구조적으로는 재발**" 이라고 갈랐다. 실질 판단(수렴 신호에 따른 등재)은 사용자 memory
교훈에 부합하지만, 절차적으로 규칙 문언을 세 번째로 침묵 속에 우회했다는 것이다.

이 구분이 정확해서 받아들였다. 그리고 그 처방(규칙에 예외를 명문화)은 같은 티켓에서
convention checker 가 plan 삭제 예외에 대해 짚은 것과 **같은 층위**다 — 두 checker 가
서로 다른 축에서 같은 원리를 가리켰다: **실질 정당성과 규약 성문화는 다른 문제다.**
