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

## 이 가드가 잡는 회귀

1. 누군가 `paths:` 를 되살린다 → 데드락 복귀
2. 스텝을 추가하면서 `if:` 게이팅을 빠뜨린다 → **무관한 PR 에서 그 스텝이 실제로 실행**된다
   (조용한 오작동이라 로그를 안 보면 모른다)
3. `needs: changes` 를 빠뜨린다 → `needs.changes.outputs` 가 비어 게이팅이 무력화된다

3번이 특히 위험하다: `needs` 가 없으면 `needs.changes.outputs.relevant` 는 빈 문자열이라
`!= 'true'` 가 참이 되어 **모든 스텝이 no-op 으로 건너뛰어진다** — 체크는 초록인데 아무것도
검사하지 않는 상태다. 정확히 이 저장소가 반복해 데인 "게이트가 조용히 안 도는" 실패다.
"""

import pathlib
import unittest

import yaml

REPO = pathlib.Path(__file__).resolve().parents[2]
WORKFLOWS = REPO / ".github" / "workflows"

# skip-job 패턴을 적용한(= required check 후보) 워크플로.
# 새로 전환할 때마다 여기 추가한다 — 목록이 곧 계약이다.
CONVERTED = [
    "deps-security-checks.yml",
    "frontend-checks.yml",
]


def load(name):
    return yaml.safe_load((WORKFLOWS / name).read_text(encoding="utf-8"))


def triggers(doc):
    """YAML 이 `on:` 을 boolean True 로 파싱하므로 두 키를 모두 본다."""
    return doc.get(True) if True in doc else doc.get("on")


class RequiredCheckSkipJobContract(unittest.TestCase):
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
        for name in CONVERTED:
            with self.subTest(workflow=name):
                jobs = load(name).get("jobs", {})
                self.assertIn("changes", jobs, f"{name}: changes 잡이 없다")
                outputs = jobs["changes"].get("outputs") or {}
                self.assertIn(
                    "relevant", outputs, f"{name}: changes.outputs.relevant 가 없다"
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
                    "!= 'true'" in str(s.get("if", "")) for s in job.get("steps", [])
                )
                with self.subTest(workflow=name, job=jid):
                    self.assertTrue(
                        has_announce,
                        f"{name}:{jid} 에 no-op 안내 스텝이 없다 "
                        "(`if: needs.changes.outputs.relevant != 'true'`)",
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


if __name__ == "__main__":
    unittest.main()
