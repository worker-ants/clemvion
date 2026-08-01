# 변경 범위(Scope) 리뷰 — round 9

> **방법론**: 프롬프트 번들 중 4개 파일이 크기 제한으로 생략돼 있었으나(`review_guard.py`/
> `code_review_orchestrator.py`/`consistency_orchestrator.py`/`tests/README.md`/
> `test_block_integrity.py` 등), 이번 라운드에서 실제로 바뀐 부분은 `git show`/`Read`로 현재
> 소스를 직접 열어 확인했다. 판단은 검사(inspection)가 아니라 실측으로 교차검증했다:
> `git log`/`git diff --stat`로 라운드 경계 확정, `git show <commit>`으로 이번 라운드 델타만
> 분리, `git diff` vs `git diff -w`로 포맷팅 잡음 유무, 그리고 — 이번 라운드 컨텍스트가 요구하는
> 대로 — **회귀 테스트를 실제로 되돌려 RED 가 나는지 mutation 으로 직접 재현**(복구는 `cp` 로,
> `git checkout` 미사용). round 8 자체 scope 리뷰(`review/code/2026/08/01/08_11_19/scope.md`)를
> 먼저 읽어 연속성을 확인한 뒤 독립적으로 재검증했다.

## 이번 라운드의 실제 델타 확정

round 8 리뷰(`08_11_19`, CRITICAL 3/WARNING 11)에 대한 대응 커밋은 `54fff611f`
("8R 리뷰 반영") 하나뿐이며, `git status`는 이 세션 자신의 출력 디렉토리 외에 미커밋 변경이
없다. 즉 round 9 가 실질적으로 새로 봐야 할 코드 델타는 이 커밋이다:

```
.claude/_shared/block_integrity.py                 |  22 ++-
.claude/hooks/_lib/review_guard.py                 |  30 +++-
.../scripts/code_review_orchestrator.py            |  31 +++-
.claude/tests/test_block_integrity.py              | 106 ++++++++++++-
.claude/tests/test_review_changeset_warning.py     |  58 +++++++
review/code/2026/08/01/08_11_19/*                  | (세션 산출물, 컨벤션대로 커밋)
```

## 발견사항

- **[WARNING]** round 8 자신이 지적한 죽은(orphaned) 주석이 이번 라운드에도 그대로 방치.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:42-43`
    (주석), `:44-45`(그 아래 실제 import — 현재 소스 `Read`로 직접 재확인)
  - 상세: `42-43`행 "Report location/validity is shared with the push/stop gate and the
    code-review orchestrator — see `.claude/_shared/report_paths.py`. One rule, three
    consumers." 는 3라운드 전(`b06982ec4`)에 삭제된 `_report_paths_lib` import 를 가리키던
    주석이며, 지금은 무관한 `block_integrity`/`retry_state` import 위에 얹혀 있다. round 8의
    scope.md 가 이미 WARNING 으로 지적했고(SUMMARY.md 통합 보고서에도 "Scope" 카테고리 #9로
    반영됨), round 8의 RESOLUTION.md 는 CRITICAL 2건 + `--files` 침묵 WARNING 만 명시적으로
    처분했을 뿐 이 항목은 "기등재/후속" 목록에도 없다 — 즉 논의 없이 그냥 남았다. 이번 라운드의
    수정 커밋(`54fff611f`)은 이 파일을 아예 건드리지 않아(위 델타 참조) 그대로다. 기능 영향은
    없으나(순수 문서), 같은 문제가 두 라운드 연속 보고되고도 처분되지 않는 것은 "review/**는
    SoT가 아니다 — 처분 안 된 항목은 방치되면 유실된다"는 이 저장소 자신의 교훈과 정확히 같은
    모양이다.
  - 제안: 주석 삭제 또는 "`report_paths` 규칙은 이제 `retry_state.py`를 통해 간접 소비된다"로
    갱신. 한 줄짜리 수정이라 다음에 이 파일을 손댈 때 반드시 함께 처리할 것.

- **[WARNING]** plan 문서의 후속 #11 "최소 조치" 서술이 이번 라운드에 실제로 배선된 동작과
  모순되는데, 문서는 갱신되지 않았다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:94`(항목 #11 표제),
    `:119`("최소 조치" 문장) — `grep`으로 현재 소스 확인. 대응 코드:
    `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1250-1259`
    (`scope_flag` 판정 + 경고 출력 블록, `Read`로 직접 확인).
  - 상세: plan 문서 119행은 지금도 "두 옵션이 같이 오면 **`--files` 우선** + 무시되는 쪽을
    stderr 로 경고(현재 침묵)"라고 적혀 있다 — 즉 문서가 제안하는 최소 조치는 **`--files`가
    우선순위를 가져야 한다**는 것이다. 그런데 이번 라운드에 실제로 배선된 코드는 그 반대를
    한다: `collect_change_infos`의 `scope_flag`(commit/range/branch) 우선순위는 그대로 두고
    (`if scope_flag and getattr(args, "files", None):` 블록이 `if/elif` 체인보다 **앞에서
    관측만** 하고 값은 바꾸지 않음), `--files`가 폐기된다는 사실만 stderr 로 경고한다. 코드
    자신의 docstring이 이 선택을 정당화한다 — "Precedence is left as it is (a scope flag
    wins) because other callers depend on it; what changes is that the discard is now
    impossible to miss." 근거 있는 판단이지만, **plan 문서 쪽은 갱신되지 않아 지금 두 문서가
    서로 다른 사실을 주장한다.** 같은 plan 문서가 다른 항목(#2)에는 처분 시 취소선 +
    "**구현 완료**" 주석을 다는 관례를 쓰는데, #11 에는 그 처리가 없다 — 이번 라운드의
    수정 커밋(`54fff611f`)이 plan 문서를 전혀 건드리지 않았기 때문(위 델타 참조). 다음
    라운드나 다른 세션이 이 plan 항목만 보고 "`--files`가 이겨야 하는데 아직 구현 안 됐다"고
    오판하거나, 반대로 이미 구현됐다고 착각해 재작업을 건너뛸 위험이 있다.
  - 제안: plan 문서 #11을 "최소 조치 구현 완료(우선순위는 유지, 경고만 추가 — 근거:
    `code_review_orchestrator.py` docstring)"로 갱신하거나 취소선 처리. 우선순위를 실제로
    `--files` 쪽으로 바꿀 계획이 없다면 문서의 "최소 조치" 문구 자체를 지금 배선과 일치하도록
    고칠 것.

- **[INFO]** round 7·8이 이미 "조치 불요"로 판정한 두 항목은 이번 라운드에도 변화 없음(재기재
  목적으로만 짧게 확인).
  - 관심사 번들링(`30cc0f738` feat + `7b54b088a` refactor가 한 브랜치에 공존): 기능적으로
    독립이고 상호 참조 주석·커밋 분리로 투명하게 관리됨 — 그대로.
  - 공백 줄 2줄: `code_review_orchestrator.py:302-303`(`Read`로 재확인), `_apply_status_update`
    위임 재배치의 잔여물, 실질 변경과 섞이지 않음 — 그대로.

## 확인했지만 문제 없음 (실측 근거)

- **이번 라운드 델타의 hunk-대-주장 1:1 대응**: `git show 54fff611f`로 3개 소스 파일의 diff를
  전부 읽었다 — 모든 hunk가 커밋 메시지의 [C1]/[C2]/[W] 중 정확히 하나에 대응한다. 새 import
  없음(`git show 54fff611f | grep -E "^\+(import|from) "` 결과 0건), 무관한 리팩터·주석·설정
  변경 없음.
- **브랜치 전체 범위**: `git diff --stat origin/main...HEAD -- . ':!review/**'`가 이 세션
  `meta.json`의 18개 파일과 정확히 일치(18 files changed 확인). 설정 파일(`settings.json`,
  `.claude.project.json`, `package.json` 등) 변경 없음.
- **포맷팅 잡음 없음**: 같은 범위에 대해 `git diff`와 `git diff -w`의 줄 수가 2646줄로 동일.
- **회귀 테스트가 실제로 RED 가 되는지 mutation 으로 직접 재현**(이번 라운드 컨텍스트가 요구한
  검증 방식): `block_integrity.py`의 두 정규식을 수정 전 패턴(`\s*\**\s*`)으로 되돌리자
  `test_a_bare_block_followed_by_a_long_run_returns_fast`가 정확히 실패(5초 타임아웃)했고,
  원복 후 clean. `review_guard.py`의 `_MAX_GLOB_WILDCARDS` 캡 체크를 제거하자
  `SpecGlobCompilationIsBoundedTest`의 2개 테스트가 모두 실패, 원복 후 clean(`cp` 백업/복원,
  `git checkout` 미사용). 즉 이번 라운드가 추가한 테스트는 vacuous 하지 않다.
- **같은 파일의 다른 정규식이 같은 결함 클래스를 공유하지 않는지 실측**: `review_guard.py`의
  `_TABLE_DATA_ROW`/`_RISK_LINE`(둘 다 `\s*` 포함)을 40,000자 입력으로 타이밍 측정 —
  선형(≤0.0001s). 이번 수정이 "이 두 파일 안의 유일한 이차/지수 자리"라는 암묵적 주장이
  과장이 아님을 확인.
- **커밋 메시지의 수치 주장 재실측**: (a) "커밋된 SUMMARY 1,507개 전수, 판정 변화 0건" —
  직접 재현하면 현재 1,508개(세션 1건 자연 증가, 무해)·판정 차이 0건, 주장의 실질은 성립.
  (b) "실제 glob 633개 중 528개가 `*` 0개, 한 세그먼트 최대 1개" — `_parse_frontmatter_code`로
  직접 재현: 633/528 정확히 일치. "세그먼트 최대 1개"는 최초 측정 시 내가 `**`(안전한 단일
  토큰, `_glob_to_regex`가 `i+=2`로 통째로 소비)를 "별 2개"로 잘못 셌던 착오였고, `**`를
  올바르게 제외하고 세면(코드 자신의 처리 방식과 동일 기준) 실제 최대는 1이 맞다 — 처음
  의심했던 불일치는 내 계측 오류였고, 재확인 후 기각.
- **테스트 개수**: `pytest --collect-only -q`로 762개 정확히 확인 — 커밋 메시지 수치와 일치.
- **미변경 파일들의 연속성**: 이번 라운드 델타(`54fff611f`)가 건드리지 않은 나머지 13개 대상
  파일(`retry_state.py`/`failopen_state.py`/`consistency-summary.md`/
  `guard_review_before_push.py`/`guard_review_before_stop.py`/`merge_coordinator_orchestrator.py`
  등)은 round 7·8 scope 리뷰가 이미 "브랜치 전체 diff와 정확히 일치, 곁다리 없음"으로 확인한
  상태에서 이번 라운드에 추가 변경이 없다 — 재감사 대신 델타 부재를 `git show --stat`으로
  확인하는 것으로 연속성을 검증했다.

## 요약

이번 라운드의 실질 코드 델타(`54fff611f`, 8R 리뷰 3건 반영)는 매우 정밀하게 스코프가
통제되어 있다 — 모든 hunk가 커밋 메시지가 명명한 항목에 1:1 대응하고, 새 import·설정 변경·
포맷팅 잡음·무관한 리팩터가 전혀 없으며, 새로 추가된 회귀 테스트는 직접 mutation 재현으로
vacuous 하지 않음을 확인했다. 다만 두 건의 WARNING은 "이번 커밋이 손대지 않은 문서가 이번
커밋이 만든 사실과 어긋난다"는, 좁은 의미의 코드 스코프 밖에서 발생한 정합성 문제다: (1)
round 8이 이미 지적한 `consistency_orchestrator.py`의 죽은 주석이 두 라운드째 처분 없이
방치되고 있고, (2) 이번 라운드가 실제로 구현한 "`--branch` 우선순위 유지 + 경고 추가"라는
결정이 plan 문서 #11의 "최소 조치"(`--files` 우선순위로 바꾸라는 서술)와 정면으로 다른데
plan 문서는 갱신되지 않았다. 둘 다 기능적 위험은 없지만, 방치하면 다음 라운드/세션이 잘못된
전제로 재작업하거나 이미 끝난 일을 다시 열게 만들 수 있다.

## 위험도

LOW
