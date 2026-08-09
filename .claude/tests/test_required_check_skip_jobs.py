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
]


def load(name):
    return yaml.safe_load((WORKFLOWS / name).read_text(encoding="utf-8"))


def triggers(doc):
    """YAML 이 `on:` 을 boolean True 로 파싱하므로 두 키를 모두 본다."""
    return doc.get(True) if True in doc else doc.get("on")


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
                outputs = jobs["changes"].get("outputs") or {}
                self.assertEqual(
                    outputs.get("relevant"),
                    "${{ steps.detect.outputs.relevant }}",
                    f"{name}: changes.outputs.relevant 가 detect 스텝을 가리키지 않는다",
                )
                step_ids = {s.get("id") for s in jobs["changes"].get("steps", [])}
                self.assertIn(
                    "detect",
                    step_ids,
                    f"{name}: changes 잡에 `id: detect` 스텝이 없다 — "
                    "출력이 빈 문자열이 되어 게이팅이 무력화된다",
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
                text = (WORKFLOWS / name).read_text(encoding="utf-8")
                self.assertIn(
                    "'scripts/ci-paths-changed.sh'",
                    text,
                    f"{name}: detect 대상 글롭에 스크립트 자신이 없다",
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
            text = (WORKFLOWS / name).read_text(encoding="utf-8")
            if "'codebase/**/package.json'" not in text:
                continue  # 그 워크플로는 매니페스트를 대상으로 하지 않는다
            with self.subTest(workflow=name):
                self.assertIn(
                    "'codebase/package.json'",
                    text,
                    f"{name}: 중간 `**` pathspec 만 있고 깊이 0(`codebase/package.json`)이 "
                    "빠졌다 — 그 파일이 생기는 순간 조용히 검사에서 빠진다",
                )


if __name__ == "__main__":
    unittest.main()
