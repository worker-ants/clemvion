"""Tests for `.claude/tools/nerv-mirror/pull.py` — NERV 스펙의 저장소 미러.

네트워크 없이 돈다. `--all` 은 합성 export.zip(`--from-zip`)으로, `--task` 의 HTTP 는
`Nerv.get` 을 바꿔 끼운 가짜로 돈다. 실제 NERV 응답 형태(ETag = md 바이트 sha256,
frontmatter JSON 인용, 영역 문서의 `area` 는 부모 영역, 트리 배치 = 가장 가까운 area
조상-또는-자신)는 2026-09-29 실측에서 왔다. 그 실측에서 트리로 계산한 경로와 export 배치가
169편 전부 일치했다.

고정하는 것:
- 결정성: 같은 입력을 두 번 받으면 두 번째는 아무것도 쓰지 않는다(diff 0).
- 배치(D1): `spec/<영역>/<KEY>.md`, 영역 문서는 자기 폴더, 영역 밖은 `spec/<KEY>.md`.
- 카탈로그 영역(`CLE-C24` · `CLE-MKS`)은 미러하지 않는다(D4).
- 링크: `](CLE-X#a)` → 미러 상대 경로. 미러에 없는 키는 그대로.
- frontmatter 에 `source_paths` · `mirror_sha256` · `etag` 를 더한다. `etag` 는 md 바이트 sha256.
- `--check`: 본문을 한 글자 고치면 실패, 파일을 다른 폴더로 옮겨도 실패.
- `--all` 은 export 에 없는 미러 파일을 지우고, 옛 트리와 README 밖은 건드리지 않는다.
- `--task` 는 ETag 가 같으면(304) 건너뛰고, 영역이 바뀐 문서의 옛 파일을 지운다.
"""

from __future__ import annotations

import contextlib
import hashlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

import _harness

PULL_SRC = _harness.REPO_ROOT / ".claude" / "tools" / "nerv-mirror" / "pull.py"
pull = _harness.load_module_by_path("nerv_mirror_pull_under_test", PULL_SRC)


def md(key, *, type_="feature", area=None, parent=None, body="본문\n"):
    fm = {
        "id": key, "title": f"{key} 제목", "type": type_, "version": 1, "status": "draft",
        "requirements": [], "basis_superseded": False, "parent": parent,
        "ancestors": [], "area": area, "content_hash": "x", "read_as": "approved", "task": None,
    }
    lines = [f"{k}: {json.dumps(v, ensure_ascii=False)}" for k, v in fm.items()]
    return ("---\n" + "\n".join(lines) + "\n---\n" + body).encode("utf-8")


# 트리: VISION(영역 밖) · ACCT(영역) ⊃ ACCT-SESSION(feature) · IX(영역) ⊃ CHAT(중첩 영역) ⊃
# CHAT-ADAPTER · C24(카탈로그 영역) ⊃ C24-META.
DOCS = {
    "specs/CLE-VISION.md": md("CLE-VISION", type_="vision",
                              body="> 원문: `spec/0-overview.md` (§1)\n\n[계정](CLE-ACCT) · [세션](CLE-ACCT-SESSION#토큰)\n"),
    "specs/CLE-ACCT/CLE-ACCT.md": md("CLE-ACCT", type_="area", parent="CLE-VISION",
                                     body="[어댑터](CLE-CHAT-ADAPTER) [메타](CLE-C24-META)\n"),
    "specs/CLE-ACCT/CLE-ACCT-SESSION.md": md(
        "CLE-ACCT-SESSION", area="CLE-ACCT", parent="CLE-ACCT",
        body="> 구현 상태: 부분 · 원문: `spec/5-system/1-auth.md` (§2), `spec/data-flow/2-auth.md`\n\n"
             "## 토큰\n\n[개요](CLE-VISION) [없는 키](CLE-NOPE)\n"),
    "specs/CLE-IX/CLE-IX.md": md("CLE-IX", type_="area", parent="CLE-VISION"),
    "specs/CLE-CHAT/CLE-CHAT.md": md("CLE-CHAT", type_="area", area="CLE-IX", parent="CLE-IX"),
    "specs/CLE-CHAT/CLE-CHAT-ADAPTER.md": md("CLE-CHAT-ADAPTER", type_="convention",
                                            area="CLE-CHAT", parent="CLE-CHAT",
                                            body="[세션](CLE-ACCT-SESSION)\n"),
    "specs/CLE-C24/CLE-C24.md": md("CLE-C24", type_="area", parent="CLE-VISION"),
    "specs/CLE-C24/CLE-C24-META.md": md("CLE-C24-META", type_="convention", area="CLE-C24"),
}


def make_zip(docs=DOCS) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, data in sorted(docs.items()):
            zf.writestr(name, data)
        zf.writestr("manifest.json", "{}")
        zf.writestr("llms.txt", "")
    return buf.getvalue()


class _Fixture(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        self.root = Path(tmp)
        self.spec = self.root / "spec"
        (self.spec / "5-system").mkdir(parents=True)
        (self.spec / "5-system" / "1-auth.md").write_text("옛 트리\n", encoding="utf-8")
        self.zip = self.root / "export.zip"
        self.zip.write_bytes(make_zip())

    def pull_all(self, *extra):
        with contextlib.redirect_stdout(io.StringIO()):
            return pull.main(["--all", "--from-zip", str(self.zip), "--root", str(self.root),
                              *extra])

    def check(self):
        return pull.check(self.spec)

    def read(self, rel):
        return (self.spec / rel).read_text(encoding="utf-8")


class AllModeTest(_Fixture):
    def test_layout_follows_the_export_tree(self):
        self.pull_all()
        mirrored = sorted(p.relative_to(self.spec).as_posix() for p in pull.mirror_files(self.spec))
        self.assertEqual(mirrored, [
            "CLE-ACCT/CLE-ACCT-SESSION.md", "CLE-ACCT/CLE-ACCT.md",
            "CLE-CHAT/CLE-CHAT-ADAPTER.md", "CLE-CHAT/CLE-CHAT.md",
            "CLE-IX/CLE-IX.md", "CLE-VISION.md",
        ])

    def test_catalog_areas_are_not_mirrored(self):
        self.pull_all()
        self.assertFalse((self.spec / "CLE-C24").exists())

    def test_second_pull_writes_nothing(self):
        self.pull_all()
        before = {p: p.read_bytes() for p in self.spec.rglob("*.md")}
        report = pull.apply(self.spec, pull.docs_from_zip(self.zip.read_bytes()),
                            {d.key: d.relpath for d in pull.docs_from_zip(self.zip.read_bytes())},
                            prune=True)
        self.assertEqual(report["written"], [])
        self.assertEqual(report["removed"], [])
        self.assertEqual({p: p.read_bytes() for p in self.spec.rglob("*.md")}, before)

    def test_links_become_relative_mirror_paths(self):
        self.pull_all()
        vision = self.read("CLE-VISION.md")
        self.assertIn("[계정](CLE-ACCT/CLE-ACCT.md)", vision)
        self.assertIn("[세션](CLE-ACCT/CLE-ACCT-SESSION.md#토큰)", vision)
        adapter = self.read("CLE-CHAT/CLE-CHAT-ADAPTER.md")
        self.assertIn("[세션](../CLE-ACCT/CLE-ACCT-SESSION.md)", adapter)
        session = self.read("CLE-ACCT/CLE-ACCT-SESSION.md")
        self.assertIn("[개요](../CLE-VISION.md)", session)
        # 미러에 없는 키(카탈로그 · 모르는 키)는 그대로 둔다.
        self.assertIn("[없는 키](CLE-NOPE)", session)
        self.assertIn("[메타](CLE-C24-META)", self.read("CLE-ACCT/CLE-ACCT.md"))

    def test_mirror_frontmatter_fields(self):
        self.pull_all()
        lines, body = pull.split_frontmatter(self.read("CLE-ACCT/CLE-ACCT-SESSION.md"))
        self.assertEqual(pull.fm_value(lines, "source_paths"),
                         ["spec/5-system/1-auth.md", "spec/data-flow/2-auth.md"])
        self.assertEqual(pull.fm_value(lines, "mirror_sha256"),
                         hashlib.sha256(body.encode("utf-8")).hexdigest())
        raw = DOCS["specs/CLE-ACCT/CLE-ACCT-SESSION.md"]
        self.assertEqual(pull.fm_value(lines, "etag"), "sha256-" + hashlib.sha256(raw).hexdigest())
        # NERV 가 준 줄은 그대로 남는다.
        self.assertEqual(pull.fm_value(lines, "id"), "CLE-ACCT-SESSION")

    def test_prune_removes_docs_missing_from_the_export(self):
        self.pull_all()
        docs = dict(DOCS)
        del docs["specs/CLE-IX/CLE-IX.md"]
        self.zip.write_bytes(make_zip(docs))
        self.pull_all()
        self.assertFalse((self.spec / "CLE-IX").exists())

    def test_old_tree_and_other_files_are_untouched(self):
        self.pull_all()
        self.assertEqual(self.read("5-system/1-auth.md"), "옛 트리\n")

    def test_readme_lists_areas(self):
        self.pull_all()
        readme = self.read("README.md")
        for area in ("CLE-ACCT", "CLE-CHAT", "CLE-IX"):
            self.assertIn(f"[{area}]({area}/{area}.md)", readme)
        self.assertIn("[CLE-VISION](CLE-VISION.md)", readme)
        self.assertNotIn("CLE-C24]", readme)


class CheckTest(_Fixture):
    def test_fresh_mirror_passes(self):
        self.pull_all()
        self.assertEqual(self.check(), [])

    def test_hand_edit_is_caught(self):
        self.pull_all()
        path = self.spec / "CLE-VISION.md"
        path.write_text(path.read_text(encoding="utf-8").replace("계정", "계좌"), encoding="utf-8")
        problems = self.check()
        self.assertEqual(len(problems), 1)
        self.assertIn("mirror_sha256", problems[0])

    def test_moved_file_is_caught(self):
        self.pull_all()
        (self.spec / "CLE-IX" / "CLE-IX.md").rename(self.spec / "CLE-ACCT" / "CLE-IX.md")
        self.assertTrue(any("위치" in p for p in self.check()))

    def test_cli_exit_code(self):
        self.pull_all()
        ok = subprocess.run([sys.executable, str(PULL_SRC), "--check", "--root", str(self.root)],
                            capture_output=True, text=True)
        self.assertEqual(ok.returncode, 0, ok.stdout + ok.stderr)
        (self.spec / "CLE-VISION.md").write_text("---\nid: \"CLE-VISION\"\n---\n손편집\n",
                                               encoding="utf-8")
        bad = subprocess.run([sys.executable, str(PULL_SRC), "--check", "--root", str(self.root)],
                             capture_output=True, text=True)
        self.assertEqual(bad.returncode, 1)


class FakeNerv:
    """`Nerv.get` 대역. 경로 → (status, body) 와 받은 If-None-Match 를 기록한다."""

    def __init__(self, tree, mds, claims=None):
        self.project = "clemvion"
        self.tree, self.mds, self.claims = tree, mds, claims or []
        self.calls = []

    def get(self, path, etag=None):
        self.calls.append((path, etag))
        if path.endswith("/specs/tree"):
            return 200, json.dumps(self.tree).encode(), {}
        if "/tasks/" in path:
            return 200, json.dumps({"claims": self.claims}).encode(), {}
        key = path.split("/specs/")[1].split(".md")[0]
        raw = self.mds[key]
        if etag == "sha256-" + hashlib.sha256(raw).hexdigest():
            return 304, b"", {}
        return 200, raw, {}


def tree_nodes():
    ids = {}
    def node(key, type_, parent):
        ids[key] = f"id-{key}"
        return {"id": ids[key], "key": key, "type": type_,
                "parent_id": f"id-{parent}" if parent else None}
    return [
        node("CLE-VISION", "vision", None),
        node("CLE-ACCT", "area", "CLE-VISION"),
        node("CLE-ACCT-SESSION", "feature", "CLE-ACCT"),
        node("CLE-IX", "area", "CLE-VISION"),
        node("CLE-CHAT", "area", "CLE-IX"),
        node("CLE-CHAT-ADAPTER", "convention", "CLE-CHAT"),
        node("CLE-C24", "area", "CLE-VISION"),
        node("CLE-C24-META", "convention", "CLE-C24"),
    ]


class TaskModeTest(_Fixture):
    def _mds(self):
        return {Path(name).stem: raw for name, raw in DOCS.items()}

    def _run(self, fake, *keys):
        orig = pull.load_env
        pull.load_env = lambda: fake
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                return pull.cmd_task(self.spec, "CLE-T-TEST", list(keys))
        finally:
            pull.load_env = orig

    def test_area_map_matches_the_export_layout(self):
        paths = pull.paths_for(pull.area_map(tree_nodes()))
        zip_paths = {d.key: d.relpath for d in pull.docs_from_zip(make_zip())}
        self.assertEqual(paths, zip_paths)

    def test_pulls_scope_specs_from_the_active_claim(self):
        fake = FakeNerv(tree_nodes(), self._mds(), claims=[
            {"status": "active", "scope_spec_ids": ["CLE-ACCT-SESSION"]},
            {"status": "released", "scope_spec_ids": ["CLE-IX"]},
        ])
        self._run(fake)
        self.assertTrue((self.spec / "CLE-ACCT" / "CLE-ACCT-SESSION.md").exists())
        self.assertFalse((self.spec / "CLE-IX").exists())
        md_calls = [c for c in fake.calls if c[0].endswith(".md?task=CLE-T-TEST")]
        self.assertEqual(len(md_calls), 1)

    def test_same_etag_is_skipped(self):
        fake = FakeNerv(tree_nodes(), self._mds())
        self._run(fake, "CLE-VISION")
        before = self.read("CLE-VISION.md")
        fake.calls.clear()
        self._run(fake, "CLE-VISION")
        sent = [etag for path, etag in fake.calls if path.endswith(".md?task=CLE-T-TEST")]
        self.assertEqual(sent, ["sha256-" + hashlib.sha256(DOCS["specs/CLE-VISION.md"]).hexdigest()])
        self.assertEqual(self.read("CLE-VISION.md"), before)

    def test_moved_doc_leaves_no_old_file(self):
        # 웹에서 부모를 바꾸면 다음 pull 이 옛 자리 파일을 지우고 새 자리에 쓴다.
        fake = FakeNerv(tree_nodes(), self._mds())
        self._run(fake, "CLE-CHAT-ADAPTER")
        moved = [n if n["key"] != "CLE-CHAT-ADAPTER" else {**n, "parent_id": "id-CLE-ACCT"}
                 for n in tree_nodes()]
        self._run(FakeNerv(moved, self._mds()), "CLE-CHAT-ADAPTER")
        self.assertTrue((self.spec / "CLE-ACCT" / "CLE-CHAT-ADAPTER.md").exists())
        self.assertFalse((self.spec / "CLE-CHAT" / "CLE-CHAT-ADAPTER.md").exists())

    def test_catalog_key_is_skipped(self):
        fake = FakeNerv(tree_nodes(), self._mds())
        self._run(fake, "CLE-C24-META")
        self.assertFalse((self.spec / "CLE-C24").exists())

    def test_task_links_resolve_against_the_whole_tree(self):
        # 부분 스냅샷이라도 링크는 트리 전체 경로로 고친다(대상 파일이 아직 없어도 경로는 맞다).
        fake = FakeNerv(tree_nodes(), self._mds())
        self._run(fake, "CLE-CHAT-ADAPTER")
        self.assertIn("[세션](../CLE-ACCT/CLE-ACCT-SESSION.md)",
                      self.read("CLE-CHAT/CLE-CHAT-ADAPTER.md"))


class CiWiringTest(unittest.TestCase):
    """CI `spec-mirror-integrity` 가 이 도구의 `--check` 를 부른다 — 잡이 빠지면 셸 편집을 못 잡는다."""

    WORKFLOW = _harness.REPO_ROOT / ".github" / "workflows" / "spec-link-checks.yml"

    def test_integrity_job_runs_the_check(self):
        import yaml  # harness 테스트의 유일한 서드파티 예외(.claude/tests/README.md)

        doc = yaml.safe_load(self.WORKFLOW.read_text(encoding="utf-8"))
        job = doc["jobs"]["spec-mirror-integrity"]
        runs = [s.get("run", "") for s in job["steps"]]
        self.assertIn("python3 .claude/tools/nerv-mirror/pull.py --check", runs)
        self.assertEqual(job.get("needs"), "changes")

    def test_the_repo_mirror_passes_its_own_check(self):
        # 커밋된 미러가 무결성 검사를 통과해야 CI 가 초록이다. 미러가 없으면 공허하므로 먼저 본다.
        spec = _harness.REPO_ROOT / "spec"
        self.assertTrue(pull.mirror_files(spec), "미러가 없다 — 이 단언은 공허하다")
        self.assertEqual(pull.check(spec), [])


if __name__ == "__main__":
    unittest.main()
