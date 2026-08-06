# Requirement Review — 리뷰 게이트 CI 백스톱 (round 9, HEAD `88ce9994d` "8R" 커밋 기준)

## 운영 노트 (평가 대상 고정에 관한 사실 확인 — 코드 결함 아님)

리뷰 도중 이 워크트리에서 **동시 수정**을 관측했다. 최초 `Read`(`.claude/hooks/_lib/review_guard.py`)
시점에는 프롬프트가 보여준 것과 동일한, 함수가 로컬에 그대로 정의된 구버전이 읽혔다. 이후
`git status`를 재확인하니:

```
 M .claude/hooks/_lib/plan_guard.py
 M .claude/hooks/_lib/review_guard.py
 M .claude/tests/test_plan_guard.py
?? .claude/_shared/git_probe.py
?? review/code/2026/08/06/13_33_32/   (본 리뷰 세션 산출물)
```

`review_guard.py`/`plan_guard.py`는 `_run_git`/`_repo_root`/`_default_branch`/`_merge_base`/
`_porcelain_path`를 새 `.claude/_shared/git_probe.py`(untracked)로 위임하도록 편집되는 중이었고,
편집 시각(mtime)이 여러 차례 갱신됐다(`review_guard.py`/`plan_guard.py` 13:36→13:40,
`git_probe.py` 13:38). 이 변경은 본인이 만든 것이 아니며(본 세션은 이 세 파일에 `Write`/`Edit`를
호출한 적이 없다), 다른 프로세스(병렬 세션)가 실시간으로 편집 중임을 시사한다.

WORKING-TREE RULE에 따라 이 변경을 건드리지 않았다. 본 리뷰는 프롬프트가 제시한 커밋 스냅샷
(`HEAD = 88ce9994d`, "CI 백스톱 8R")을 대상으로 하며, 아래 모든 발견사항은 **그 커밋을 격리된
`git archive` 사본(`mktemp -d` 후 아카이브 추출, 실제 워킹트리 미접촉)에서 재현·검증**했다. 이
진행 중 편집은 흥미롭게도 아래 발견사항 3의 "손-동기 쌍 미통합"을 정확히 해소하려는 시도로
보이지만, 커밋되지 않은 상태라 평가 대상이 아니다. 오케스트레이터는 이 사실을 인지하고, 그 편집이
커밋되면 새 리뷰를 다시 돌려야 한다.

## 검증 방법

- `git archive HEAD | tar -x` 로 워킹트리와 독립된 사본을 만들고 그 안에서 `git init` + 커밋 1개로
  실제 git 저장소를 구성, 그 위에서 harness 테스트와 수제 mutation을 구동했다.
- `test_plan_guard.py`(31) / `test_review_guard_hardening.py`(53) / `test_review_gate_ci.py`(19) /
  `test_workflow_yaml_structure.py`(12) / `test_stop_guard_failopen.py`(17) /
  `test_harness_checks_paths_coverage.py`(26) / `test_block_integrity.py::PlanStubsMirrorTheRealInterfaceTest`
  — 전부 그 사본에서 **GREEN**으로 재확인했다(전체 스위트(844)는 2분 내 완주하지 못해 표본만
  구동. 관련 파일은 전량 커버).
- `.github/workflows/*.yml`을 PyYAML로 직접 파싱해 `test_workflow_yaml_structure.py`의 등재제
  딕셔너리(`_PULL_REQUEST_KEYS`/`_JOB_CONDITIONS`/`_STEP_CONDITIONS`)와 실제 파일 내용을 코드
  밖에서 독립 재계산해 대조 — 전부 일치.
- `WorkflowWiringTest.EXPECTED`를 실제 `.github/workflows/review-gate.yml`과 수동 대조 — 전부 일치.
- mutation testing으로 "헬퍼가 mock으로만 구동돼 한 번도 실제로 안 돈다" 클래스가 남아 있는지
  탐색(아래 발견사항 1).

## 발견사항

- **[WARNING]** `plan_guard.evaluate_plan()`의 **committed-diff 경로**가 여전히 실제 git 저장소로
  구동되는 end-to-end 테스트 없이 전량 mock에 의존한다 — 바로 이 파일이 두 라운드 연속(7R→8R로
  전파, 8R에서 수정) "헬퍼를 mock으로만 구동해 실결함을 놓친" 클래스의 당사자인데도, 이번 수정이
  추가한 실물-저장소 테스트(`PorcelainPathSurvivesOnARealRepoTest`)는 `_uncommitted_changes`만
  구동하고 `_committed_changes`/`_merge_base`/`_default_branch`(커밋된 변경 인식 경로 전체)는
  여전히 미구동이다. `EvaluatePlanDecisionTableTest`는 `_branch_changes`를 통째로 mock 한다.
  **뮤테이션으로 검증**: `_committed_changes`를 `return []`로 무력화한 사본에서
  `test_plan_guard.py` 31개 테스트 **전부 GREEN**(무의미한 변화가 아님을 별도로 확인 — 동일
  뮤턴트를 `review_guard._committed_code_changes`에 적용하면 `test_review_guard_hardening.py`가
  2건 RED로 즉시 잡는다: `NotesReachThePublicEntryPointTest`/`RebaseAuthorDateTest`가 실물
  저장소로 `evaluate_review()`를 끝까지 구동하기 때문). 또한 수동으로 실물 저장소에서
  "plan 파일을 codebase 변경과 **같은 커밋**으로 커밋"하는 시나리오를 재현해 현재 코드는 정확히
  동작함을 확인했다(`untouched=False`, 정상) — 즉 **오늘 살아있는 결함은 아니다**. 그러나
  회귀 감지 능력이 없다는 사실 자체가, 이 파일에서 이미 두 번(7R/8R) 실현된 바로 그 위험이다.
  - 위치: `.claude/hooks/_lib/plan_guard.py:178-184`(`_committed_changes`), `:130-135`(`_repo_root`),
    `:144-156`(`_default_branch`), `:159-164`(`_merge_base`); 테스트 갭은
    `.claude/tests/test_plan_guard.py` `PorcelainPathSurvivesOnARealRepoTest`(gate 266-327,
    `_uncommitted_changes`만 구동)와 `EvaluatePlanDecisionTableTest`(gate 27-150, 전량 mock).
  - 제안: `review_guard.py`의 `NotesReachThePublicEntryPointTest`/`RebaseAuthorDateTest`와 같은
    패턴으로, 실물 임시 git 저장소에 plan 갱신을 코드 변경과 함께(또는 별도 커밋으로) 커밋한 뒤
    `pg.evaluate_plan()`을 처음부터 끝까지(목 없이) 구동하는 테스트를 추가할 것.

- **[WARNING]** `.claude/tests/README.md`의 `test_plan_guard.py` 카탈로그 행(현재 한 줄짜리
  일반 설명)이 이번 라운드(8R)에서 추가된 핵심 불변식 — round 7/8의 `.strip()` 선행공백
  거짓차단 결함, `-c core.quotePath=false` 수정, 그리고 그 회귀를 고정하는
  `PorcelainPathSurvivesOnARealRepoTest` 실물-저장소 테스트 클래스 — 를 전혀 언급하지 않는다.
  8R 커밋 메시지는 "W5: README 카탈로그 **2행**을 5R~8R 누적 불변식으로 재작성"이라 주장하지만,
  실제로 다시 쓰인 두 행은 `test_review_gate_ci.py`와 `test_workflow_yaml_structure.py`뿐이었다
  (직전 라운드 SUMMARY의 발견 #5가 정확히 이 두 파일만 지목했었다 — `test_plan_guard.py`의
  새 테스트 클래스는 그 리뷰 **이후**의 수정(resolution)에서 추가돼 그 라운드 리뷰어는 볼 수
  없었다). 즉 "README 갱신 완료"라는 커밋 서술과 실제 갱신 범위 사이에 사각이 남아 있다.
  - 위치: `.claude/tests/README.md:62`
  - 제안: `test_review_guard_hardening.py` 행(README.md:57)과 동등한 수준으로, `test_plan_guard.py`
    행에 round 7/8 `.strip()` 회귀와 `PorcelainPathSurvivesOnARealRepoTest`를 명시.

- **[WARNING]** 커밋된 HEAD 기준으로 `_run_git`/`_repo_root`/`_default_branch`/`_merge_base`/
  `_porcelain_path` 다섯 함수가 `plan_guard.py`와 `review_guard.py`에 여전히 문자 그대로
  중복돼 있다 — 정확히 이 "손-동기 쌍"이 두 라운드(7R: review_guard만 고침 / 8R: plan_guard에
  같은 결함이 남아 있었음을 발견)에 걸쳐 실결함으로 이어진 그 모양이다. (위 "운영 노트"에 적었듯,
  워킹트리에는 이를 `.claude/_shared/git_probe.py`로 통합하려는 uncommitted 작업이 진행 중으로
  보이나, 커밋되지 않았으므로 이 리뷰가 보는 스냅샷에는 아직 반영되지 않았다.)
  - 위치: `.claude/hooks/_lib/plan_guard.py:98-176`, `.claude/hooks/_lib/review_guard.py:224-314`
  - 제안: 다섯 함수를 공용 모듈로 추출(`report_paths`/`retry_state`가 이미 쓴 것과 같은 처방).
    워킹트리의 진행 중 작업이 이를 겨냥한 것으로 보이므로, 완료·커밋되면 이 항목은 해소된다.

- **[INFO]** `branch_guard.py`가 `_run_git`의 **세 번째** 독립 사본을 갖고 있고, 거기는
  `.strip()`(review_guard/plan_guard가 겪은 결함과 동일 형태)이며 `-c core.quotePath=false`도
  없다. 다만 이 파일의 모든 소비처(`rev-parse`, `symbolic-ref`, `remote`, `remote show origin`)는
  `git status --porcelain`의 고정폭 파싱이나 경로 문자열을 다루지 않으므로 **오늘은 도달 불가**
  — 살아있는 결함은 아니다. 향후 이 파일에 porcelain 경로 파싱이 추가되면 이미 두 번 겪은 바로
  그 결함이 세 번째로 재발할 자리라는 점만 기록.
  - 위치: `.claude/hooks/_lib/branch_guard.py:35-47`
  - 제안: 지금 조치 불요. 위 공용화 작업 범위에 포함하면 근본적으로 닫힌다.

- **[INFO]** spec fidelity — 이 변경 영역(harness/CI 백스톱)을 정의하는 `spec/` 문서는 없다
  (제품 표면이 아니라 harness 거버넌스이므로 정상 — `spec/` grep 0건, 이전 라운드도 동일하게
  확인함). 사실상의 spec은 `plan/in-progress/harness-review-gate-ci-backstop.md`다. 그 문서가
  기록한 결정들을 구현과 line-level로 대조했고 불일치를 찾지 못했다: `if:
  github.actor != 'dependabot[bot]'` 일치, `pull_request.paths` 목록이
  `WorkflowWiringTest.EXPECTED` 및 실제 `review-gate.yml`/`harness-checks.yml`과 일치(직접
  파싱해 재대조 완료), `--enforce` 미부착(관측 모드 문서와 일치), `fetch-depth: 0` 존재, "Fetch
  base ref" 스텝 주석이 이번 라운드에 `_default_branch()` → `_merge_base()`로 정정됨(문서가 W7로
  기록한 바로 그 정정, plan §열린질문/round-8 WARNING 7과 일치).
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md`, `.github/workflows/review-gate.yml:67`
  - 제안: 없음(기록용).

## 재확인한 기존 결정 (재지적 아님)

- C1(게이트가 산출물의 존재/형태만 보고 실제 리뷰 수행 여부를 검증하지 않음)은 이번 라운드가
  의도적으로 "`--enforce` 전환의 선행 조건"으로만 plan에 등재하고 코드는 고치지 않은 **기록된
  설계 결정**이다(날짜 검사 같은 반쪽 조치를 피한 이유도 plan에 명시). 새 결함으로 재분류하지
  않았다.
- `TheGateItselfDoesNotBranchOnCiEnvTest._SCANNED`가 `_shared/report_paths.py`/
  `block_integrity.py`를 정적으로 스캔하지 않는 것은 이전 라운드부터 알려진 문서적 갭이며,
  `TheRealGateIgnoresTheEnvironmentTest`(실물 게이트를 bare vs 14-변수 CI 환경으로 두 번 구동해
  판정 일치를 확인)가 행위로 이미 보완한다. 두 `_shared` 모듈을 직접 열어 `os.environ`/`getenv`
  접근이 0건임도 확인했다(grep) — 살아있는 우회 없음.

## 요약

이번 라운드(HEAD `88ce9994d`)가 반영한 8R 수정 — `plan_guard._run_git`의 `.strip()` → `.rstrip()`
+ `-c core.quotePath=false` 적용, 실물 저장소 회귀 테스트 3종, 문서 오기 정정 — 은 격리된 커밋
스냅샷에서 관련 테스트(31+53+19+12+17+26개, 전 파일 표본)를 전부 GREEN으로 재확인했고, 뮤테이션
테스트로도 `.strip()` 계열 결함이 재발하지 않음을 확인했다. 여섯~여덟 라운드에 걸쳐 반복된
"가드 우회" 클래스는 이번 라운드에도 발견되지 않았다(워크플로 문서 전체 정확일치·행위 기반 판정
테스트가 실제로 방어하고 있음을 직접 파싱/재구동으로 검증). 새로 찾은 것은 활성 결함이 아니라
**테스트 커버리지 부채**(plan_guard의 committed-diff 경로가 여전히 mock에만 의존 — 뮤테이션으로
검증된 실측 갭)와 **문서 정합성 부채**(README 카탈로그 행 하나가 이번 라운드 신규 테스트를
반영 못함)다. 두 항목 모두 이 저장소가 이미 두 번 실제로 데인 바로 그 실패 클래스("mock으로만
구동되는 헬퍼", "손-동기 쌍 drift")의 잔여 표면이라는 점에서 우선순위 있게 처리할 가치가 있다.
아울러 리뷰 도중 이 워크트리에서 동시 편집이 관측됐다는 사실을 오케스트레이터에 전달한다 — 정확히
발견사항 3(중복 제거)을 겨냥한 것으로 보이는 uncommitted 작업이 진행 중이므로, 그것이 커밋되면
이 리뷰는 갱신이 필요하다.

## 위험도

LOW
