"""required status check 로 등록된(될) 워크플로의 skip-job 계약 회귀 가드.

## 무엇을 지키는가

`paths:` 필터가 걸린 워크플로를 required check 로 등록하면, 무관한 PR 에서 워크플로가
아예 실행되지 않아 체크가 `Expected — Waiting for status to be reported` 로 남고
**머지가 영구히 막힌다.**

그래서 아래 워크플로들은 `on.pull_request` 에서 `paths:` 를 걷어내고(항상 실행),
`changes` 잡이 관련성을 판정해 무관하면 각 잡의 **스텝만** 건너뛴다 — 잡 자체는
success 로 보고되어 required check 가 통과한다.

## 왜 잡 전체를 `if:` 로 skip 하지 않는가

skip 된 잡의 conclusion 은 `skipped` 이고 그것이 required check 를 만족하는지는 문서상
모호하다. 그 모호함에 기대면 이 패턴이 없애려는 데드락이 그대로 재발한다.

같은 이유로 하위 잡은 `if: ${{ !cancelled() }}` 를 달아 **`changes` 가 실패해도 돈다** —
`needs` 실패로 skip 되면 그 모호함이 다른 경로로 되돌아온다(ai-review W3).

## 조건 문자열의 방향 (`!= 'false'`, `== 'false'`)

`== 'true'` 가 아니라 **`!= 'false'`** 로 게이팅한다. `changes` 가 실패하면 출력이 빈
문자열이 되는데, 그때 실제 검사가 **돌아야** 하기 때문이다(fail-safe). `== 'true'` 였다면
빈 값에서 전부 no-op 이 되어 "초록인데 아무것도 검사하지 않는" 상태가 된다.

## 이 가드가 잡는 회귀

1. 누군가 `paths:` 를 되살린다 → 데드락 복귀
2. 스텝을 추가하면서 `if:` 게이팅을 빠뜨린다 → **무관한 PR 에서 그 스텝이 실제로 실행**된다
   (조용한 오작동이라 로그를 안 보면 모른다)
3. `needs: changes` 를 빠뜨린다 → `needs.changes.outputs` 가 비어 게이팅이 무력화된다
4. `changes.outputs.relevant` 가 엉뚱한 스텝을 가리킨다(step id 오타) → 같은 결과
5. 두 파일의 전환 목록이 어긋난다 → 한쪽 가드가 그 워크플로를 안 본다

3·4번은 **fail-safe 방향 덕에 "전부 실행"** 으로 떨어지지만(안전), 의도한 게이팅이
사라진 상태라 여전히 회귀다 — 비용은 CI 시간이고 조용하다.

판정 스크립트 자체의 실행 검증은 `test_ci_paths_changed.py` 가 담당한다(임시 git 저장소 +
subprocess). 이 파일은 **워크플로 배선**만 본다.
"""

import pathlib
import unittest

import yaml

REPO = pathlib.Path(__file__).resolve().parents[2]
WORKFLOWS = REPO / ".github" / "workflows"

# skip-job 패턴을 적용한(= required check 후보) 워크플로.
# 새로 전환할 때마다 여기 추가한다 — 목록이 곧 계약이다.
CONVERTED = [
    "backend-checks.yml",
    "deps-security-checks.yml",
    "frontend-checks.yml",
    "harness-checks.yml",
    "migration-check.yml",
    "packages-checks.yml",
    "spec-link-checks.yml",
    "web-chat-checks.yml",
]

# 세 워크플로가 공유하는 `changes` 잡의 reusable workflow. 판정 wiring 이 여기 한 곳에
# 산다 — 아래 계약들은 **호출부의 `uses:` 를 따라가** 이 파일에서 확인해야 한다.
# 지름길로 "reusable 을 쓰면 통과" 로 두면, 그 파일이 출력을 안 내거나 step id 가
# 어긋나도 전 워크플로가 조용히 게이팅을 잃는다 — 한 곳이라 파급이 오히려 크다.
CHANGES_REUSABLE = "_changed-paths.yml"


def load(name):
    return yaml.safe_load((WORKFLOWS / name).read_text(encoding="utf-8"))


def triggers(doc):
    """YAML 이 `on:` 을 boolean True 로 파싱하므로 두 키를 모두 본다."""
    return doc.get(True) if True in doc else doc.get("on")


def parse_pathspecs(block):
    """블록 스칼라 본문 → pathspec 목록. **런타임(`_changed-paths.yml`)과 같은 규칙.**

    빈 줄과 `#` 로 시작하는 줄을 버리고 앞뒤 공백을 뗀다. 이 셋이 어긋나면 가드와 런타임의
    판정이 갈려서, 목록은 통과하는데 실제로는 그 pathspec 이 조용히 무력화된다 — 이 파일이
    통째로 막으려는 클래스다. `#` 를 버리는 쪽은 블록 스칼라에 YAML 주석이 없기 때문이고
    (전부 본문이다), 그래서 항목별 근거를 pathspec 옆에 둘 수 있다.
    """
    out = []
    for line in block.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        out.append(line)
    return out


def pathspecs_of(name):
    """호출부가 공유 판정 워크플로에 넘기는 pathspec **목록**.

    종전에는 워크플로 텍스트에 `'scripts/ci-paths-changed.sh'`(따옴표 포함) 가 있는지
    substring 으로 봤다 — 셸 인자였기 때문이다. 지금은 YAML 블록 스칼라라 따옴표가 없고,
    무엇보다 substring 은 **주석에 적힌 경로도 통과시킨다.** 파싱해서 실제 원소로 본다.
    """
    with_ = (load(name).get("jobs", {}).get("changes") or {}).get("with") or {}
    return parse_pathspecs(with_.get("pathspecs") or "")


class PathspecParsingTest(unittest.TestCase):
    """블록 스칼라 → 인자 배열 정규화를 **런타임과 같은 규칙**으로 고정한다.

    `_changed-paths.yml` 의 `read` 루프가 하는 일과 한 글자라도 갈리면, 이 파일의 등재
    단언은 통과하는데 러너에서는 그 pathspec 이 빠진다(조용한 게이팅 상실). 실행 층은
    `test_changed_paths_reusable.py` 가 실제 bash 로 확인하고, 여기서는 파서 쪽을 못 박는다.
    """

    def test_drops_blank_and_comment_lines_and_strips(self):
        self.assertEqual(
            parse_pathspecs("a/**\n\n  # 왜 등재했는가\n  b.yaml  \n"),
            ["a/**", "b.yaml"],
        )

    def test_a_hash_that_is_not_line_initial_stays(self):
        """줄 **시작**의 `#` 만 주석이다 — 런타임의 `case "$spec" in '#'*)` 와 동일."""
        self.assertEqual(parse_pathspecs("dir/a#b.txt\n"), ["dir/a#b.txt"])

    def test_no_converted_workflow_leaks_a_comment_as_a_pathspec(self):
        """주석이 pathspec 으로 새면 git 이 아무것도 못 맞히는 인자가 하나 늘 뿐이지만,
        `test_no_filter_is_dead` 류 대조에서 목록이 실제보다 넓어 보이게 만든다."""
        for name in CONVERTED:
            with self.subTest(workflow=name):
                specs = pathspecs_of(name)
                self.assertTrue(specs, f"{name}: pathspec 이 0개다")
                self.assertEqual(
                    [s for s in specs if s.startswith("#")],
                    [],
                    f"{name}: 주석 줄이 pathspec 으로 새어 나왔다",
                )


class RequiredCheckSkipJobContractTest(unittest.TestCase):
    def test_the_converted_list_is_not_empty(self):
        """vacuity 방지 — 목록이 비면 아래 테스트가 전부 헛통과한다."""
        self.assertTrue(CONVERTED, "CONVERTED 가 비었다")
        for name in CONVERTED:
            self.assertTrue(
                (WORKFLOWS / name).is_file(), f"{name} 이 존재하지 않는다"
            )

    def test_pull_request_has_no_paths_filter(self):
        """`paths:` 가 살아나면 required check 데드락이 복귀한다."""
        for name in CONVERTED:
            with self.subTest(workflow=name):
                pr = (triggers(load(name)) or {}).get("pull_request")
                if isinstance(pr, dict):
                    self.assertNotIn(
                        "paths",
                        pr,
                        f"{name}: on.pull_request.paths 가 되살아났다 — "
                        "required check 가 영원히 대기 상태가 된다",
                    )

    def test_changes_job_publishes_relevant(self):
        """키 존재만이 아니라 **값이 실제 스텝을 가리키는지**까지 본다.

        초판은 존재만 봤다 — step id 오타(`steps.detekt.outputs.relevant`)가 있어도
        통과했고, 그 경우 출력이 빈 문자열이라 게이팅이 통째로 무력화된다
        (ai-review W6). 참조 문자열과 `id:` 를 함께 단언한다.
        """
        for name in CONVERTED:
            with self.subTest(workflow=name):
                jobs = load(name).get("jobs", {})
                self.assertIn("changes", jobs, f"{name}: changes 잡이 없다")
                # 호출부는 wiring 을 갖지 않고 reusable workflow 를 부른다.
                self.assertEqual(
                    jobs["changes"].get("uses"),
                    f"./.github/workflows/{CHANGES_REUSABLE}",
                    f"{name}: changes 잡이 공유 판정 워크플로를 부르지 않는다",
                )
                # pathspec 을 안 넘기면 판정 대상이 0개다.
                pathspecs = (jobs["changes"].get("with") or {}).get("pathspecs")
                self.assertTrue(
                    pathspecs and pathspecs.strip(),
                    f"{name}: changes 잡이 pathspecs 를 넘기지 않는다",
                )

        # 지름길 방지 — 실제 출력을 내는 쪽은 reusable workflow 다. 여기까지 따라가
        # 확인하지 않으면 세 워크플로가 한꺼번에 게이팅을 잃어도 이 스위트는 초록이다.
        shared = load(CHANGES_REUSABLE)
        outputs = (shared.get("jobs", {}).get("detect") or {}).get("outputs") or {}
        self.assertEqual(
            outputs.get("relevant"),
            "${{ steps.detect.outputs.relevant }}",
            f"{CHANGES_REUSABLE}: detect 잡 출력이 detect 스텝을 가리키지 않는다",
        )
        step_ids = {s.get("id") for s in shared["jobs"]["detect"].get("steps", [])}
        self.assertIn(
            "detect",
            step_ids,
            f"{CHANGES_REUSABLE}: `id: detect` 스텝이 없다 — 출력이 빈 문자열이 된다",
        )
        # workflow_call 의 `outputs.relevant.value` 가 그 잡을 가리켜야 호출부의
        # `needs.changes.outputs.relevant` 가 값을 받는다. 여기가 끊기면 전부 빈 문자열이다.
        call_outputs = ((triggers(shared) or {}).get("workflow_call") or {}).get("outputs") or {}
        self.assertEqual(
            (call_outputs.get("relevant") or {}).get("value"),
            "${{ jobs.detect.outputs.relevant }}",
            f"{CHANGES_REUSABLE}: workflow_call 출력이 detect 잡을 가리키지 않는다",
        )

    def test_the_two_registries_agree(self):
        """전환 목록이 두(사실상 3) 곳에 독립 존재해 한쪽만 갱신해도 조용히 통과했다.

        `test_workflow_yaml_structure.py` 의 `_SKIP_JOB_WORKFLOWS`·`_PULL_REQUEST_KEYS`
        (빈 집합 항목)와 이 파일의 `CONVERTED` 가 같은 집합을 가리켜야 한다 —
        어긋나면 어느 한쪽 가드가 그 워크플로를 안 본다 (ai-review W5).
        """
        import test_workflow_yaml_structure as wys

        cls = wys.WorkflowStructureTest
        self.assertEqual(
            set(CONVERTED),
            set(cls._SKIP_JOB_WORKFLOWS),
            "CONVERTED 와 _SKIP_JOB_WORKFLOWS 가 어긋난다",
        )
        bare = {k for k, v in cls._PULL_REQUEST_KEYS.items() if v == set()}
        self.assertEqual(
            set(CONVERTED),
            bare,
            "CONVERTED 와 `_PULL_REQUEST_KEYS` 의 빈-집합(bare pull_request) 항목이 어긋난다",
        )

    def test_every_other_job_needs_changes(self):
        """needs 가 빠지면 게이팅이 무력화돼 **모든 스텝이 조용히 건너뛰어진다**."""
        for name in CONVERTED:
            jobs = load(name).get("jobs", {})
            for jid, job in jobs.items():
                if jid == "changes":
                    continue
                with self.subTest(workflow=name, job=jid):
                    needs = job.get("needs")
                    needs = [needs] if isinstance(needs, str) else (needs or [])
                    self.assertIn(
                        "changes",
                        needs,
                        f"{name}:{jid} 에 `needs: changes` 가 없다 — "
                        "needs.changes.outputs 가 빈 값이라 전 스텝이 no-op 이 된다",
                    )

    def test_every_step_is_gated(self):
        """게이팅이 빠진 스텝은 무관한 PR 에서도 실제로 실행된다."""
        for name in CONVERTED:
            jobs = load(name).get("jobs", {})
            for jid, job in jobs.items():
                if jid == "changes":
                    continue
                ungated = [
                    s.get("name") or s.get("uses") or "(run)"
                    for s in job.get("steps", [])
                    if "if" not in s
                ]
                with self.subTest(workflow=name, job=jid):
                    self.assertEqual(
                        [],
                        ungated,
                        f"{name}:{jid} 에 `if:` 없는 스텝 {len(ungated)}건: {ungated}",
                    )

    def test_each_job_announces_the_no_op_path(self):
        """무관해서 건너뛴 것인지 로그로 드러나야 한다.

        조용히 초록이면 "검사가 돌았다" 와 "검사를 건너뛰었다" 가 구분되지 않는다 —
        이 저장소가 diff 생략·파일 드롭에서 반복해 세운 관측 가능성 원칙과 같다.
        """
        for name in CONVERTED:
            jobs = load(name).get("jobs", {})
            for jid, job in jobs.items():
                if jid == "changes":
                    continue
                has_announce = any(
                    "== 'false'" in str(s.get("if", "")) for s in job.get("steps", [])
                )
                with self.subTest(workflow=name, job=jid):
                    self.assertTrue(
                        has_announce,
                        f"{name}:{jid} 에 no-op 안내 스텝이 없다 "
                        "(`if: needs.changes.outputs.relevant == 'false'`)",
                    )

    def test_detect_script_exists_and_is_executable(self):
        script = REPO / "scripts" / "ci-paths-changed.sh"
        self.assertTrue(script.is_file(), "scripts/ci-paths-changed.sh 부재")
        self.assertTrue(
            script.stat().st_mode & 0o111, "ci-paths-changed.sh 에 실행 권한이 없다"
        )

    def test_converted_workflows_pass_the_script_its_own_path(self):
        """스크립트 자신이 바뀌면 그 워크플로도 돌아야 한다.

        판정 로직이 바뀌었는데 검사가 안 도는 것은 `harness-checks.yml` 이 여섯 번 겪은
        paths 커버리지 갭과 같은 클래스다.
        """
        for name in CONVERTED:
            with self.subTest(workflow=name):
                specs = pathspecs_of(name)
                self.assertIn(
                    "scripts/ci-paths-changed.sh",
                    specs,
                    f"{name}: detect 대상 글롭에 판정 스크립트 자신이 없다",
                )
                # wiring 도 같은 이유로 등재돼야 한다 — reusable workflow 가 바뀌면
                # 그것에 기대는 이 워크플로가 돌아야 한다. 추출로 **새로 생긴** 의존이라
                # 등재를 빠뜨리기 쉬운 자리다(이 저장소가 여섯 번 겪은 갭의 7번째 후보).
                self.assertIn(
                    f".github/workflows/{CHANGES_REUSABLE}",
                    specs,
                    f"{name}: detect 대상 글롭에 공유 판정 워크플로가 없다",
                )

    def test_manifest_globs_cover_depth_zero(self):
        """`codebase/**/package.json` 은 **혼자서는** `codebase/package.json` 을 못 잡는다.

        git pathspec 에서 중간 `**` 는 디렉터리가 1개 이상일 때만 맞는다(실측 —
        `test_ci_paths_changed.py::test_middle_double_star_alone_misses_depth_zero`).
        그래서 워크플로는 깊이 0 을 별도 pathspec 으로 함께 넘긴다. 짝 중 하나만 지우면
        그 매니페스트 변경이 조용히 `relevant=false` 로 판정된다 — "초록인데 검사가 안
        도는" 상태로, 이 파일이 막으려는 바로 그 클래스다(ai-review W3).
        """
        for name in CONVERTED:
            specs = pathspecs_of(name)
            if "codebase/**/package.json" not in specs:
                continue  # 그 워크플로는 매니페스트를 대상으로 하지 않는다
            with self.subTest(workflow=name):
                self.assertIn(
                    "codebase/package.json",
                    specs,
                    f"{name}: 중간 `**` pathspec 만 있고 깊이 0(`codebase/package.json`)이 "
                    "빠졌다 — 그 파일이 생기는 순간 조용히 검사에서 빠진다",
                )


if __name__ == "__main__":
    unittest.main()
