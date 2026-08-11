# 변경 범위(Scope) 리뷰

## 사전 확인 (`git diff origin/main`)

```
.claude/skills/consistency-checker/scripts/consistency_orchestrator.py | 46 ++++++--
.claude/tests/test_consistency_bundle_priority.py                      | 76 +++++++++++++
plan/complete/consistency-named-in-substring-match.md (신규)           | 126 +++++++++++++++++++++
3 files changed, 240 insertions(+), 8 deletions(-)
```

선언된 스코프(`_named_in` 경계 고정 + `_n_on_topic` 주석 정정 + 테스트 4건 추가 + 완료 plan 1건, **codebase/ 변경 0**)와 실제 diff 가 정확히 일치한다. `codebase/**` 변경 0건 확인. 신규 테스트 메서드 수도 정확히 4건(`test_longer_name_does_not_promote_the_shorter_one` · `test_the_named_file_is_still_promoted` · `test_mention_forms_that_must_still_count` · `test_extension_suffix_does_not_count`)이며, 기존 테스트는 한 줄도 수정되지 않았다(순수 삽입). 임포트 변경 없음(`re` 는 이미 상단에서 import 되어 있고 `_CATALOG_BULK_RE`/`RATIONALE_HEADER_RE`/`_natural_key` 가 이미 사용 중). 포맷팅-only 변경 없음. `.claude/_shared/git_probe.py` 등 다른 파일은 건드리지 않았다(초기 세션 컨텍스트에 보이는 그 파일의 `M` 표시는 이 워크트리가 아닌 별개 워크트리의 잔상이며, 본 브랜치 diff 에는 나타나지 않는다).

### 발견사항

- **[INFO]** 주석 정정(`_n_on_topic`)은 범위 안이다 — 별 건 아님
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:562-571` (`_n_on_topic` 함수 내부, `n = 0` 루프 직전 주석)
  - 상세: 이 주석은 `_named_in` 이 부분 문자열 매치를 하던 시절 "카탈로그 페이지는 브랜치가 직접 편집하지 않는 한 prefix 에 도달할 수 없다"는 **틀린 전제**를 명시적으로 진술하고 있었고, 그 틀린 전제가 바로 이번 PR 이 고치는 결함의 근본 원인 설명과 직접 맞닿아 있다. 코드 로직 자체(`n=0`/for/`break`)는 이 hunk 에서 전혀 바뀌지 않았고 주석 문구만 교체됐다 — 같은 함수, 같은 자리, 같은 근본 원인에 대한 정정이므로 drive-by 리팩터링이 아니라 이번 fix 의 직접적 부산물이다.
  - 제안: 없음 — 정당한 범위.

- **[WARNING]** 완료 plan 이 `plan/in-progress/` 를 거치지 않고 `plan/complete/` 에 바로 생성됐고, 그 안에 미해결(`[ ]`) 항목이 남아 있다
  - 위치: `plan/complete/consistency-named-in-substring-match.md:6`(frontmatter `status: complete`), `plan/complete/consistency-named-in-substring-match.md:122`(`- [ ] **--impl-done 의 code diff 에 예산 바닥을 깔지 판정**`)
  - 상세: `.claude/docs/plan-lifecycle.md §2`는 "미체크 체크박스(`[ ]`) … 미해결 follow-up 항목이 **하나라도** 있으면 `in-progress/`"라고 명시하고, §3/§5 자가점검도 "모든 체크박스 `[x]` + 미해결 follow-up 0건"을 이동 조건으로 든다. 이 plan 은 `status: complete` 로 `plan/complete/` 에 신규 생성됐지만 "후속 (등재만)" 절에 `- [ ]` 항목이 하나 남아 있어 문서 자신의 완료 기준과 문자적으로 충돌한다. `developer/SKILL.md:30` 도 `plan/complete/` 진입 경로를 "모든 항목 끝나면 `git mv`"로 서술해, in-progress 를 거치지 않고 곧바로 complete 로 태어나는 패턴은 문서화된 표준 경로가 아니다.
  - 다만 이를 강제하는 빌드 가드는 현재 없다(`plan-frontmatter.test.ts`/`plan-scan.ts` 에 체크박스 검사 없음 확인 — CI 를 막지 않음) — 최근 신설된 두 게이트(`status` 종료값 검증·상대링크 무결성)는 이 항목을 보지 않는다. 그리고 이 저장소에 실제 전례가 있다 — `plan/complete/**` 374개 중 27개가 유사하게 미체크 `[ ]` 항목을 남긴 채 완료 상태다(예: `background-context-key-followups.md`). 즉 이 PR 이 만든 새로운 위반이 아니라 이 저장소가 이미 관행적으로 허용해온 패턴을 그대로 따른 것이다.
  - 제안: "후속 (등재만)" 항목을 체크박스(`- [ ]`) 대신 산문 불릿("추후 검토:")으로 적어 `plan-lifecycle.md §2` 의 문자적 정의와의 충돌을 없애거나, 혹은 plan-lifecycle 문서 쪽에 "후속(등재만) 섹션의 체크박스는 이 plan 자체의 미해결 항목이 아니라 별도 백로그 등재"라는 예외를 명문화하는 편이 낫다. 이번 PR 단독의 blocking 사유는 아니다.

## 3번 — "더 고쳤어야 할 것을 안 고쳤는가" (엄격 판정)

**절제는 옳다. 결함을 절반만 닫은 것이 아니라, 두 개의 독립된 결함 중 확인된 하나만 닫고 나머지는 정직하게 등재한 것이다.**

- **(a) 카탈로그 tier-4 강등을 넓히지 않은 것**: plan Rationale 이 드는 근거(`cafe24-api-catalog/store.md` 는 최상위 인덱스 페이지이고, `_CATALOG_BULK_RE`(`…-api-catalog/[^/]+/`)가 하위 리소스 파일만 강등 대상으로 삼는 것은 `spec-impl-evidence.md` R-7 의 의도된 설계)는 코드·기존 테스트(`test_catalog_top_level_index_is_not_demoted`)와 일치한다. 강등 규칙을 넓혔다면 정당한 인덱스 페이지가 함께 죽는 회귀가 됐을 것 — 안 고친 것이 아니라 **잘못된 방향으로 안 넓힌 것**이다.
- **(b) diff 예산 바닥을 깔지 않은 것**: 이번 관측 사례는 "무관한 파일이 오매치로 승격돼 diff 를 밀어낸" 경우이고, plan 이 등재한 후속 항목은 "브랜치가 **정당하게** 대형 spec 파일을 여럿 편집해 diff 가 밀려나는" 별개 시나리오다. 원인이 다르므로(오매치 vs 정당한 압박) 같은 커밋에서 묶어 고칠 필연성이 없고, 오히려 한 PR 에 두 방어선을 섞으면 "이 fix 가 정확히 무엇을 닫았는가"가 흐려진다. 후속 항목은 `review/**` 가 아니라 **plan 안에 명시적으로 등재**돼 있어(이 저장소의 반복 교훈 — "미룬 항목은 그 턴에 plan/ 에 적어라"와 정확히 부합), 유실 위험도 낮다.

억지로 흠을 만들자면 "diff 바닥을 같은 PR 에서 함께 처리했으면 더 좋았을 것"이라는 선호는 가능하지만, 이는 **선호이지 결함이 아니다**. 근본원인(이름 매칭 경계 부재)을 정확히 특정하고 그 범위만 최소로 고친 뒤 별개 시나리오를 후속으로 분리한 것은 scope 원칙(최소 변경)에 부합하는 판단이다.

## 요약

diff 는 선언된 스코프(하니스 이름-매칭 경계 고정, 관련 주석 정정, 회귀 테스트 4건, 완료 plan 1건)와 정확히 일치하며 `codebase/**` 변경은 실제로 0건이다. 주석 정정은 같은 함수·같은 근본원인에 대한 직접적 정정으로 별 건이 아니다. 카탈로그 강등을 넓히지 않고 diff 예산 바닥을 후속으로 미룬 절제는 근거가 명확하고(R-7 준수, 별개 결함 분리) 절반짜리 수정이 아니라 정확한 스코프 판단이다. 유일한 주목할 점은 완료 plan 이 `in-progress/` 를 거치지 않고 미해결 체크박스를 남긴 채 `plan/complete/` 에 생성된 것인데, 이는 문서(`plan-lifecycle.md §2/§3/§5`)의 문자적 완료 기준과는 충돌하지만 빌드 가드 미적용 + 저장소 내 27건의 기존 전례가 있어 이 PR 만의 일탈은 아니다.

## 위험도

LOW
STATUS: OK
