# 동시성(Concurrency) Review — round 7 CI 백스톱

## 0. 스코프 확인

라운드 7 diff 자체(`git diff HEAD~1`)는 다음 3개 파일만 건드린다:

- `.github/workflows/review-gate.yml` — `on.pull_request.paths` 를 `review_guard.py`/`branch_guard.py` 개별 파일명에서 `.claude/hooks/_lib/**` 글롭으로 확장 (8줄 diff)
- `.claude/tests/test_review_gate_ci.py` — `TheGateItselfDoesNotBranchOnCiEnvTest`(환경변수 (파일,변수) 레지스트리), `PyYamlPinsAgreeTest` 추가
- `.claude/tests/test_workflow_yaml_structure.py` — 신규 파일, 9개 워크플로 전수에 대한 `pull_request` 키 집합·job/step identity·`continue-on-error` 금지 레지스트리

세 파일 모두 스레드/프로세스/락/async 코드가 없다 — YAML 트리거 범위, AST 정적 검사, dict 전수일치 단언뿐이다. **라운드 7 diff 자체에는 동시성 관련 코드가 없다.**

프롬프트에 함께 실린 파일 6(`harness-checks.yml`)·7(`review-gate.yml` 전체)·9(`check-review-gate.py`)·8(plan 문서)·1(README)은 diff 밖(변경 없음, 문맥용)이라 같은 결론이 적용된다. `.claude/hooks/_lib/review_guard.py`(check-review-gate.py 가 import 하는 판정 본체)도 확인했다 — `_run_git` 서브프로세스 호출은 전부 순차적이고 스레드/락이 없다.

## 1. 적대적 조사 (라운드7 "다음 바깥 층" 탐색 — 동시성 관점)

지시에 따라 실제 PR 이 받는 판정을 동시성 축에서 바꿀 수 있는지 자체 sandbox 에서 시도했다. 확인한 경로와 결과:

1. **GH Actions `concurrency: group: review-gate-${{ github.ref }}` / `cancel-in-progress: true`** (review-gate.yml, `WorkflowWiringTest.EXPECTED["concurrency"]` 에 이미 고정됨) — `pull_request` 이벤트의 `github.ref` 는 PR 번호에 묶인 `refs/pull/<N>/merge` 이므로 그룹은 PR 단위다. 취소된 이전 run 은 그 SHA 의 체크 상태를 "성공"으로 남기지 않으므로(취소/미완료로 남는다) 최신 SHA 의 체크는 항상 그 SHA 자신의 run 이 결정한다 — 여기서 판정을 바꿀 레이스를 찾지 못했다.
2. **`refs/pull/N/merge` 가 트리거 시점과 checkout 시점 사이에 재계산될 수 있는지, `Fetch base ref` 스텝의 필요성** — 라이브 Actions 러너 없이는 관측 불가능한 영역으로, 과제 지시에서도 명시적으로 배제된 항목이다. 로컬로 반증도 실증도 못 했다.
3. **`review_guard.py` 의 "checkout-immune" 시각 처리** — `_newest_commit_time`(커밋 author date, rebase-면역), `_path_session_time`(세션 디렉터리 이름에서 파싱, checkout mtime 면역) 를 이미 쓰고 있어, "CI 는 fresh checkout 이라 전 파일 mtime 이 checkout 시각으로 뭉친다" 는 뻔한 축은 **이미 막혀 있음**을 확인했다(막힌 이유까지 코드에 문서화돼 있다). 새 구멍 없음.
4. **세션 디렉터리 생성 레이스** (아래 §2) — 유일하게 실측 가능하고 재현되는 레이스를 찾았다. 다만 diff 밖의 인접 파일이며, "이 백스톱이 원래 막으려는 공격자"(자기 PR 에 아무 텍스트나 커밋할 수 있는 사람)에게는 새 권한을 주지 않는다 — 그 경우 레이스 없이 그냥 가짜 SUMMARY.md 를 쓰면 된다. 하지만 **정상적인 동시 실행에서 사고로 Critical 이 조용히 사라질 수 있는** 진짜 결함이라 아래에 기록한다.

## 발견사항

- **[WARNING]** 리뷰 세션 디렉터리 생성이 원자적이지 않다 — 초 단위 충돌 시 최신 판정이 이전 판정(Critical 포함)을 조용히 덮어쓴다
  - 위치: `.claude/skills/code-review-agents/lib/session.py:23`(`create_session_dir`) 및 `:32-44`(초 단위 이름 + `os.makedirs(session_dir, exist_ok=True)`). 이 함수는 `code-review-agents`(`code_review_orchestrator.py`)와 `consistency-checker`(`consistency_orchestrator.py:38`,`:790`) 양쪽이 그대로 재사용한다 — `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 에는 자체 `session.py` 가 없다(확인: `find .claude/skills/consistency-checker -iname session.py` 결과 없음).
  - 상세: 세션 경로는 `<output_dir>/<YYYY>/<MM>/<DD>/<HH>_<MM>_<SS>` 로, **초 단위 해상도**다. 같은 워킹트리에서 같은 초에 두 번째 오케스트레이션(재시도, 중복 트리거, 병렬 Bash 호출 등)이 시작되면 `os.makedirs(..., exist_ok=True)` 가 예외 없이 같은 디렉터리를 반환한다 — 잠금도, 유일성 접미사(PID/UUID)도 없다. 두 세션의 하위 Agent 들이 시간차를 두고(생성 시각이 아니라 각자 리포트를 쓰는 시각) 같은 파일명(`SUMMARY.md`, 그리고 `consistency-checker` 쪽은 `cross_spec.md`/`convention_compliance.md`/`plan_coherence.md` 등 고정된 checker 이름)에 쓰면, 두 세션 중 **나중에 쓰는 쪽이 먼저 쓴 쪽을 완전히 덮어쓴다**. 라운드7 이 강화한 `GateSurfacesTheContradictionTest`/`DowngradedCriticalsTest`(§`.claude/tests/test_block_integrity.py`)가 신뢰하는 전제 — "세션 디렉터리 하나 = 리뷰 하나" — 가 이 지점에서 깨진다.
  - PoC (자체 sandbox, 저장소 미변경):
    ```
    D=$(mktemp -d)
    cp -R .../code-review-agents/lib "$D/lib"
    cp -R .../.claude/_shared "$D/_shared"
    cd "$D" && python3 - <<'PY'
    import sys, os
    sys.path.insert(0, "lib"); sys.path.insert(0, "_shared")
    import session, block_integrity as BI
    d = session.create_session_dir("review_out")
    path = os.path.join(d, "SUMMARY.md")
    with open(path, "a", encoding="utf-8") as f:
        f.write("- **[CRITICAL]** 실 발견\n**BLOCK: YES** — 실 세션\n")
    with open(path, "a", encoding="utf-8") as f:
        f.write("**BLOCK: NO** — 무관한 동시 세션\n")
    print(open(path, encoding="utf-8").read())
    print("verdict ->", BI.summary_block_verdict(open(path, encoding="utf-8").read()))
    PY
    ```
    실측 출력:
    ```
    - **[CRITICAL]** 실 발견
    **BLOCK: YES** — 실 세션
    **BLOCK: NO** — 무관한 동시 세션

    verdict -> NO
    ```
    (별도 실행으로 `threading` 두 워커를 동시에 `create_session_dir()` 호출시켜 **같은 디렉터리**가 반환됨도 직접 확인했다: `A-clean -> review_out/2026/08/06/12_21_11`, `B-critical -> review_out/2026/08/06/12_21_11`, `same_dir: True`.)
    `BI.summary_block_verdict` 는 `test_two_equally_anchored_verdicts_the_later_one_wins`(`.claude/tests/test_block_integrity.py:179-187`)에 문서화된 대로 "동률 앵커는 나중 것이 이긴다" 는 의도된 tie-break 규칙을 쓴다 — 그 규칙 자체는 정상 단일-세션 시나리오(초안→최종 정정)를 위해 옳지만, 세션 디렉터리 충돌이 두 개의 **무관한** 세션을 하나의 문서로 섞어버리면 같은 규칙이 Critical 을 삼키는 방향으로도 작동한다.
  - 영향 범위: `code-review-agents`(`review/code/**`, Gate 1 — `_summary_is_resolved` 는 BLOCK 파서를 쓰지 않고 위험도/표 행을 직접 파싱하므로 이 특정 tie-break 취약점은 없지만, `SUMMARY.md` 자체가 통째로 뒤섞이는 것은 동일하게 발생), `consistency-checker`(`review/consistency/**`, Gate 2 — 위 PoC 가 직접 겨냥하는 경로이며 `_newest_resolved_impl_done_mtime`/`contradiction_note` 가 이 문서를 그대로 신뢰한다) 양쪽 모두.
  - 이것이 "판정자를 하나로 유지" 라운드7 레지스트리들을 우회하는가: 아니다 — `check-review-gate.py`/`review_guard.py` 는 여전히 유일한 판정자이고 CI 는 커밋된 것만 본다. 다만 그 판정자가 신뢰하는 **입력**(committed `SUMMARY.md`)이 생성 단계에서 손상될 수 있다는 별개의 데이터 무결성 문제다. 공격자 모델(자기 PR 을 스스로 조작하는 사람)에게는 새 힘을 주지 않지만, 정직한 동시 사용(같은 워크트리에서의 재시도·중복 호출)에서 **사고로 Critical 이 사라지는** 진짜 실패 모드다.
  - 제안: `create_session_dir`에 (a) 마이크로초/PID/난수 접미사로 유일성을 보장하거나, (b) `os.makedirs(..., exist_ok=False)` + 충돌 시 재시도 루프로 바꾼다. 최소한 `GateSurfacesTheContradictionTest` 계열에 "두 세션이 같은 디렉터리로 충돌하면 무엇이 일어나는가"를 고정하는 회귀 테스트를 추가할 가치가 있다 — 현재 라운드7 테스트 어느 것도 오케스트레이터의 동시/중복 호출을 구동하지 않는다.

- **[INFO]** 라운드 7 diff(워크플로 paths 글롭화 + 신규 정적/행위 레지스트리 테스트) 자체에는 검토할 동시성 코드가 없음 — 스레드·락·async·커넥션 풀이 전혀 등장하지 않는다. `.github/workflows/*.yml` 의 `concurrency:` 블록은 이번 diff 로 변경되지 않았고(기존 값 그대로 `WorkflowWiringTest.EXPECTED` 에 재확인됨), review 시점에 조사한 결과 이 설정 자체에서 판정을 뒤집는 레이스는 찾지 못했다(§1-1 참조).

- **[INFO]** "라이브 Actions 러너가 있어야만 검증 가능한" 두 축(`refs/pull/N/merge` 의 트리거-시점 대비 checkout-시점 부동 여부, `fetch-depth: 0` 위에 `Fetch base ref` 가 실제로 필요한지)은 과제 지시에서 이미 알려진 한계로 배제되어 있어 이 조사에서 더 파고들지 않았다.

## 요약

라운드 7 diff(워크플로 트리거 글롭화 + 정적/행위 레지스트리 테스트 2건 추가) 자체는 동시성 관점에서 완전히 무해하다 — 스레드/락/async 코드가 전혀 없고, 유일하게 관련 있는 GH Actions `concurrency:` 설정은 이번 diff 로 바뀌지 않았으며 직접 조사해도 판정을 뒤집는 레이스를 찾지 못했다. 지시받은 "다음 바깥 층" 탐색을 동시성 렌즈로 수행한 결과, diff 밖의 인접 파일(`code-review-agents/lib/session.py`)에서 실측 가능한 진짜 레이스 컨디션 하나를 발견했다 — 초 단위 세션 디렉터리 이름 + `exist_ok=True` 로 인해 같은 워크트리에서 같은 초에 시작된 두 리뷰/일관성 검토 오케스트레이션이 같은 디렉터리로 충돌하면, 나중에 쓰는 세션이 앞선 세션의 `SUMMARY.md`(Critical 포함 가능)를 조용히 덮어쓸 수 있음을 PoC 로 확인했다. 이것은 CI 백스톱의 "판정자는 하나" 원칙을 직접 우회하지는 않지만(공격자는 이 레이스 없이도 자기 PR 을 조작할 수 있으므로 새 공격 표면은 아니다), 라운드7 이 신뢰하는 committed `SUMMARY.md` 의 무결성 전제를 조용히 깨는 정직한 동시 사용 시나리오이며, 어떤 기존 테스트도 이를 구동/방어하지 않는다.

## 위험도

LOW — (diff 자체는 NONE, 인접 발견 1건은 WARNING이나 발생 확률이 낮고 공격자에게 새 힘을 주지 않아 종합 LOW로 평가)
