"""Tests for `.claude/tools/nerv-mirror/pull.py` — NERV 스펙의 저장소 미러.

네트워크 없이 돈다. `--all` 은 합성 export.zip(`--from-zip`)으로, `--task` 는 가짜 NERV
클라이언트로, curl 경계는 PATH 앞에 둔 가짜 `curl` 로 돈다. 실제 NERV 응답 형태(ETag = md 바이트
sha256, frontmatter JSON 인용, 영역 문서의 `area` 는 부모 영역, 트리 배치 = 가장 가까운 area
조상-또는-자신, 클레임 `status: "active"`)는 2026-09-29 실측에서 왔다. 그 실측에서 트리로 계산한
경로와 export 배치가 169편 전부 일치했다.

고정하는 것:
- 결정성: 같은 입력을 두 번 받으면 두 번째는 아무것도 쓰지 않는다(diff 0).
- 배치(D1): `spec/<영역>/<KEY>.md`, 영역 문서는 자기 폴더, 영역 밖은 `spec/<KEY>.md`.
- 카탈로그 영역(`CLE-C24` · `CLE-MKS`)은 미러하지 않는다(D4). 카탈로그 계층 키(`--`)도.
- 링크: `](CLE-X#a)` → 미러 상대 경로. 미러에 없는 키는 그대로.
- frontmatter 에 `source_paths` · `mirror_sha256` · `etag` 를 더한다. CRLF · 끝 줄바꿈 정규화.
- `--check`: 본문 한 글자 · frontmatter 한 값 손편집, 파일 이동, 빈 미러를 잡는다.
- 입력 검증: 키 형식이 아닌 zip 항목(`..` 포함)과 배치 깊이 이상을 거부한다. 빈 export 와
  절반 넘는 삭제는 멈춘다. 미러 밖 경로와 심볼릭 링크에는 쓰지 않는다. 트리 순환에서 멈춘다.
- `--task`: 활성 클레임 scope(키든 문서 id 든), ETag 304 면 캐시 원문으로 **다시 렌더**(다른 문서가
  옮겨졌으면 링크가 따라간다), 캐시가 미러와 다른 버전이면 조건부 요청을 하지 않음, 영역이 바뀐
  문서의 옛 파일 삭제, scope 가 비면 멈춤.
- curl 경계: 토큰은 argv 에 없고 stdin 설정에만 있다, If-None-Match 인용, 1xx 블록 건너뜀,
  curl 실패는 예외, 설정 줄 주입 문자 거부.
"""

from __future__ import annotations

import contextlib
import hashlib
import io
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import threading
import unittest
import zipfile
from pathlib import Path

import _harness

PULL_SRC = _harness.REPO_ROOT / ".claude" / "tools" / "nerv-mirror" / "pull.py"
pull = _harness.load_module_by_path("nerv_mirror_pull_under_test", PULL_SRC)

SECRET = "nerv_pat_TESTSECRET_0123456789abcdef"


def md(key, *, type_="feature", area=None, parent=None, body="본문\n", crlf=False):
    fm = {
        "id": key, "title": f"{key} 제목", "type": type_, "version": 1, "status": "draft",
        "requirements": [], "basis_superseded": False, "parent": parent,
        "ancestors": [], "area": area, "content_hash": "x", "read_as": "approved", "task": None,
    }
    lines = [f"{k}: {json.dumps(v, ensure_ascii=False)}" for k, v in fm.items()]
    text = "---\n" + "\n".join(lines) + "\n---\n" + body
    if crlf:
        text = text.replace("\n", "\r\n")
    return text.encode("utf-8")


# 트리: VISION(영역 밖) · ACCT(영역) ⊃ ACCT-SESSION · IX(영역) ⊃ CHAT(중첩 영역) ⊃ CHAT-ADAPTER ·
# NOTE(원문 없음, CRLF, 끝 줄바꿈 없음) · C24 · MKS(카탈로그 영역).
DOCS = {
    "specs/CLE-VISION.md": md("CLE-VISION", type_="vision",
                              body="> 원문: `spec/0-overview.md` (§1)\n\n[계정](CLE-ACCT) · [세션](CLE-ACCT-SESSION#토큰)\n"),
    "specs/CLE-ACCT/CLE-ACCT.md": md("CLE-ACCT", type_="area", parent="CLE-VISION",
                                     body="[어댑터](CLE-CHAT-ADAPTER) [메타](CLE-C24-META)\n"),
    "specs/CLE-ACCT/CLE-ACCT-SESSION.md": md(
        "CLE-ACCT-SESSION", area="CLE-ACCT", parent="CLE-ACCT",
        body="> 구현 상태: 부분 · 원문: `spec/5-system/1-auth.md` (§2), `spec/data-flow/2-auth.md`\n\n"
             "## 토큰\n\n[개요](CLE-VISION) [없는 키](CLE-NOPE)\n"),
    "specs/CLE-ACCT/CLE-ACCT-NOTE.md": md(
        "CLE-ACCT-NOTE", area="CLE-ACCT", parent="CLE-ACCT", crlf=True,
        body="본문 첫 줄\n\n여섯째 줄 뒤에 나오는 원문: `spec/x.md` 는 머리 인용이 아니다\n" * 3
             + "> 원문: `spec/late.md` — 인용 줄이지만 머리(앞 5줄) 밖이다\n끝"),
    "specs/CLE-IX/CLE-IX.md": md("CLE-IX", type_="area", parent="CLE-VISION"),
    "specs/CLE-CHAT/CLE-CHAT.md": md("CLE-CHAT", type_="area", area="CLE-IX", parent="CLE-IX"),
    "specs/CLE-CHAT/CLE-CHAT-ADAPTER.md": md("CLE-CHAT-ADAPTER", type_="convention",
                                            area="CLE-CHAT", parent="CLE-CHAT",
                                            body="[세션](CLE-ACCT-SESSION)\n"),
    "specs/CLE-C24/CLE-C24.md": md("CLE-C24", type_="area", parent="CLE-VISION"),
    "specs/CLE-C24/CLE-C24-META.md": md("CLE-C24-META", type_="convention", area="CLE-C24"),
    "specs/CLE-MKS/CLE-MKS.md": md("CLE-MKS", type_="area", parent="CLE-VISION"),
    "specs/CLE-MKS/CLE-MKS-ORDER--ITEMS.md": md("CLE-MKS-ORDER--ITEMS", type_="convention",
                                                area="CLE-MKS"),
}
MIRRORED = [
    "CLE-ACCT/CLE-ACCT-NOTE.md", "CLE-ACCT/CLE-ACCT-SESSION.md", "CLE-ACCT/CLE-ACCT.md",
    "CLE-CHAT/CLE-CHAT-ADAPTER.md", "CLE-CHAT/CLE-CHAT.md", "CLE-IX/CLE-IX.md", "CLE-VISION.md",
]


def make_zip(docs=DOCS) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, data in sorted(docs.items()):
            zf.writestr(name, data)
        zf.writestr("manifest.json", "{}")
        zf.writestr("llms.txt", "")
    return buf.getvalue()


def quiet(fn, *args, **kwargs):
    with contextlib.redirect_stdout(io.StringIO()):
        return fn(*args, **kwargs)


class _Fixture(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        self.root = Path(os.path.realpath(tmp))
        self.spec = self.root / "spec"
        (self.spec / "5-system").mkdir(parents=True)
        (self.spec / "5-system" / "1-auth.md").write_text("옛 트리\n", encoding="utf-8")
        self.zip = self.root / "export.zip"
        self.zip.write_bytes(make_zip())

    def pull_all(self, *extra):
        return quiet(pull.main, ["--all", "--from-zip", str(self.zip), "--root", str(self.root),
                                 *extra])

    def read(self, rel):
        return (self.spec / rel).read_text(encoding="utf-8")

    def mirrored(self):
        return sorted(p.relative_to(self.spec).as_posix() for p in pull.mirror_files(self.spec))


class AllModeTest(_Fixture):
    def test_layout_follows_the_export_tree(self):
        self.pull_all()
        self.assertEqual(self.mirrored(), MIRRORED)

    def test_catalog_areas_are_not_mirrored(self):
        self.pull_all()
        for area in ("CLE-C24", "CLE-MKS"):
            self.assertFalse((self.spec / area).exists(), area)

    def test_second_pull_writes_nothing(self):
        self.pull_all()
        before = {p: p.read_bytes() for p in self.spec.rglob("*.md")}
        docs = pull.docs_from_zip(self.zip.read_bytes())
        report = pull.apply(self.spec, docs, {d.key: d.relpath for d in docs}, prune=True)
        self.assertEqual((report["written"], report["removed"]), ([], []))
        self.assertEqual({p: p.read_bytes() for p in self.spec.rglob("*.md")}, before)

    def test_links_become_relative_mirror_paths(self):
        self.pull_all()
        vision = self.read("CLE-VISION.md")
        self.assertIn("[계정](CLE-ACCT/CLE-ACCT.md)", vision)
        self.assertIn("[세션](CLE-ACCT/CLE-ACCT-SESSION.md#토큰)", vision)
        self.assertIn("[세션](../CLE-ACCT/CLE-ACCT-SESSION.md)", self.read("CLE-CHAT/CLE-CHAT-ADAPTER.md"))
        session = self.read("CLE-ACCT/CLE-ACCT-SESSION.md")
        self.assertIn("[개요](../CLE-VISION.md)", session)
        self.assertIn("[없는 키](CLE-NOPE)", session)
        self.assertIn("[메타](CLE-C24-META)", self.read("CLE-ACCT/CLE-ACCT.md"))

    def test_mirror_frontmatter_fields(self):
        self.pull_all()
        text = self.read("CLE-ACCT/CLE-ACCT-SESSION.md")
        lines, _ = pull.split_frontmatter(text)
        self.assertEqual(pull.fm_value(lines, "source_paths"),
                         ["spec/5-system/1-auth.md", "spec/data-flow/2-auth.md"])
        self.assertEqual(pull.fm_value(lines, "mirror_sha256"), pull.fingerprint(text))
        raw = DOCS["specs/CLE-ACCT/CLE-ACCT-SESSION.md"]
        self.assertEqual(pull.fm_value(lines, "etag"), "sha256-" + hashlib.sha256(raw).hexdigest())
        self.assertEqual(pull.fm_value(lines, "id"), "CLE-ACCT-SESSION")

    def test_crlf_and_missing_final_newline_are_normalised(self):
        self.pull_all()
        raw = (self.spec / "CLE-ACCT" / "CLE-ACCT-NOTE.md").read_bytes()
        self.assertNotIn(b"\r", raw)
        self.assertTrue(raw.endswith(b"\n"))

    def test_source_paths_only_from_the_head_quote(self):
        self.pull_all()
        lines, _ = pull.split_frontmatter(self.read("CLE-ACCT/CLE-ACCT-NOTE.md"))
        self.assertEqual(pull.fm_value(lines, "source_paths"), [])

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

    def test_readme_lists_areas_and_the_old_tree_status(self):
        self.pull_all()
        readme = self.read("README.md")
        for area in ("CLE-ACCT", "CLE-CHAT", "CLE-IX"):
            self.assertIn(f"[{area}]({area}/{area}.md)", readme)
        self.assertIn("[CLE-VISION](CLE-VISION.md)", readme)
        self.assertNotIn("CLE-C24]", readme)
        self.assertIn("옛 트리", readme)


class InputValidationTest(_Fixture):
    def test_empty_export_does_not_wipe_the_mirror(self):
        self.pull_all()
        self.zip.write_bytes(make_zip({}))
        with self.assertRaises(SystemExit):
            self.pull_all()
        self.assertEqual(self.mirrored(), MIRRORED)

    def test_empty_export_stops_even_without_a_mirror(self):
        # 미러가 없으면 대량 삭제 방어가 발동하지 않는다. 빈 export 검사만 남는다.
        self.zip.write_bytes(make_zip({}))
        with self.assertRaisesRegex(SystemExit, "빈 export"):
            self.pull_all()
        self.assertFalse((self.spec / "README.md").exists())

    def test_catalog_key_outside_its_area_is_still_skipped(self):
        # 카탈로그 문서가 영역 폴더 밖(영역 없음)에 와도 키 접두로 뺀다.
        docs = dict(DOCS)
        docs["specs/CLE-C24-STRAY.md"] = md("CLE-C24-STRAY", type_="convention")
        docs["specs/CLE-MKS-STRAY.md"] = md("CLE-MKS-STRAY", type_="convention")
        self.zip.write_bytes(make_zip(docs))
        self.pull_all()
        self.assertEqual(self.mirrored(), MIRRORED)

    def test_mass_prune_needs_an_explicit_flag(self):
        self.pull_all()
        self.zip.write_bytes(make_zip({"specs/CLE-VISION.md": DOCS["specs/CLE-VISION.md"]}))
        with self.assertRaises(SystemExit):
            self.pull_all()
        self.assertEqual(self.mirrored(), MIRRORED)
        self.pull_all("--allow-mass-prune")
        self.assertEqual(self.mirrored(), ["CLE-VISION.md"])

    def test_non_key_zip_entries_are_rejected(self):
        for name in ("specs/../CLAUDE.md", "specs/CLE-X/../../x.md", "specs/lower/CLE-X.md",
                     "specs/CLE-A/CLE-B/CLE-C.md"):
            with self.subTest(name=name):
                bad = dict(DOCS)
                bad[name] = md("CLE-X")
                self.zip.write_bytes(make_zip(bad))
                with self.assertRaises(SystemExit):
                    self.pull_all()
                self.assertFalse((self.root / "CLAUDE.md").exists())
                # 쓰기 단계(mirror_relpath)도 키를 보지만, 거부는 읽는 단계에서 먼저 한다.
                with self.assertRaisesRegex(SystemExit, "export"):
                    pull.docs_from_zip(make_zip(bad))

    def test_non_key_tree_nodes_cannot_escape(self):
        with self.assertRaises(SystemExit):
            pull.mirror_relpath("CLE-X", "../..")
        with self.assertRaises(SystemExit):
            pull.mirror_relpath("../CLAUDE", None)

    def test_never_writes_through_a_symlink(self):
        (self.spec / "CLE-VISION.md").symlink_to(self.root / "outside.md")
        with self.assertRaises(SystemExit):
            self.pull_all()
        self.assertFalse((self.root / "outside.md").exists())

    def test_never_writes_through_a_symlink_inside_the_mirror(self):
        # 대상이 spec/ 안이어도 링크를 따라 쓰면 다른 미러 파일을 덮는다.
        self.pull_all()
        victim = self.spec / "CLE-ACCT" / "CLE-ACCT.md"
        before = victim.read_text(encoding="utf-8")
        (self.spec / "CLE-VISION.md").unlink()
        (self.spec / "CLE-VISION.md").symlink_to(victim)
        with self.assertRaises(SystemExit):
            self.pull_all()
        self.assertEqual(victim.read_text(encoding="utf-8"), before)

    def test_tree_cycle_stops(self):
        # 방어가 빠지면 무한 루프라 같은 스레드에서는 실패 대신 테스트 전체가 멈춘다(뮤턴트로
        # 겪었다). 데몬 스레드에서 돌리고 제한 시간 안에 끝나는지 본다.
        tree = [{"id": "a", "key": "CLE-A", "type": "feature", "parent_id": "b"},
                {"id": "b", "key": "CLE-B", "type": "feature", "parent_id": "a"}]
        outcome = {}

        def run():
            try:
                pull.area_map(tree)
            except SystemExit as exc:
                outcome["exit"] = str(exc)

        worker = threading.Thread(target=run, daemon=True)
        worker.start()
        worker.join(10)
        self.assertFalse(worker.is_alive(), "순환 트리에서 area_map 이 끝나지 않는다")
        self.assertIn("순환", outcome.get("exit", ""))

    def test_incompatible_flags_are_rejected(self):
        for argv in (["--check", "--spec", "CLE-X"], ["--check", "--allow-mass-prune"],
                     ["--task", "CLE-T-X", "--from-zip", "x.zip"]):
            with self.subTest(argv=argv), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit):
                    pull.main([*argv, "--root", str(self.root)])


class CheckTest(_Fixture):
    def test_fresh_mirror_passes(self):
        self.pull_all()
        self.assertEqual(pull.check(self.spec), [])

    def test_body_edit_is_caught(self):
        self.pull_all()
        path = self.spec / "CLE-VISION.md"
        path.write_text(path.read_text(encoding="utf-8").replace("계정", "계좌"), encoding="utf-8")
        problems = pull.check(self.spec)
        self.assertEqual(len(problems), 1)
        self.assertIn("mirror_sha256", problems[0])

    def test_frontmatter_edit_is_caught(self):
        self.pull_all()
        path = self.spec / "CLE-VISION.md"
        path.write_text(path.read_text(encoding="utf-8").replace('status: "draft"',
                                                                 'status: "approved"'),
                        encoding="utf-8")
        self.assertEqual(len(pull.check(self.spec)), 1)

    def test_moved_file_is_caught(self):
        self.pull_all()
        (self.spec / "CLE-IX" / "CLE-IX.md").rename(self.spec / "CLE-ACCT" / "CLE-IX.md")
        self.assertTrue(any("위치" in p for p in pull.check(self.spec)))

    def test_file_without_frontmatter_is_reported(self):
        self.pull_all()
        (self.spec / "CLE-VISION.md").write_text("손으로 쓴 파일\n", encoding="utf-8")
        self.assertTrue(any("frontmatter" in p for p in pull.check(self.spec)))

    def test_empty_mirror_fails(self):
        self.assertEqual(len(pull.check(self.spec)), 1)

    def test_cli_exit_code(self):
        self.pull_all()
        ok = subprocess.run([sys.executable, str(PULL_SRC), "--check", "--root", str(self.root)],
                            capture_output=True, text=True)
        self.assertEqual(ok.returncode, 0, ok.stdout + ok.stderr)
        (self.spec / "CLE-VISION.md").write_text('---\nid: "CLE-VISION"\n---\n손편집\n',
                                               encoding="utf-8")
        bad = subprocess.run([sys.executable, str(PULL_SRC), "--check", "--root", str(self.root)],
                             capture_output=True, text=True)
        self.assertEqual(bad.returncode, 1)


class FakeNerv:
    """`Nerv` 대역. 받은 경로 · If-None-Match 를 기록한다."""

    def __init__(self, tree, mds, claims=None):
        self.project = "clemvion"
        self.tree, self.mds, self.claims = tree, mds, claims or []
        self.calls = []

    def get(self, path, etag=None):
        self.calls.append((path, etag))
        if path == "/api/v1/projects/clemvion/specs/tree":
            return 200, json.dumps(self.tree).encode()
        if path.startswith("/api/v1/projects/clemvion/tasks/"):
            return 200, json.dumps({"claims": self.claims}).encode()
        assert path.startswith("/api/projects/clemvion/specs/"), path
        key = path.split("/specs/")[1].split(".md")[0]
        raw = self.mds[key]
        if etag == "sha256-" + hashlib.sha256(raw).hexdigest():
            return 304, b""
        return 200, raw

    def get_ok(self, path):
        status, body = self.get(path)
        assert status == 200
        return body


def tree_nodes(moves=None):
    moves = moves or {}
    parents = {
        "CLE-VISION": None, "CLE-ACCT": "CLE-VISION", "CLE-ACCT-SESSION": "CLE-ACCT",
        "CLE-ACCT-NOTE": "CLE-ACCT", "CLE-IX": "CLE-VISION", "CLE-CHAT": "CLE-IX",
        "CLE-CHAT-ADAPTER": "CLE-CHAT", "CLE-C24": "CLE-VISION", "CLE-C24-META": "CLE-C24",
        "CLE-MKS": "CLE-VISION", "CLE-MKS-ORDER--ITEMS": "CLE-MKS",
    }
    parents.update(moves)
    types = {"CLE-VISION": "vision", "CLE-ACCT": "area", "CLE-IX": "area", "CLE-CHAT": "area",
             "CLE-C24": "area", "CLE-MKS": "area"}
    return [{"id": f"id-{k}", "key": k, "type": types.get(k, "feature"),
             "parent_id": f"id-{p}" if p else None} for k, p in parents.items()]


def raw_by_key():
    return {Path(name).stem: raw for name, raw in DOCS.items()}


class TaskModeTest(_Fixture):
    def setUp(self):
        super().setUp()
        self.cache = self.root / ".nerv" / "cache" / "mirror"

    def run_task(self, fake, *keys):
        return quiet(pull.cmd_task, self.spec, "CLE-T-TEST", list(keys), nerv=fake,
                     cache=self.cache)

    def test_area_map_matches_the_export_layout(self):
        paths = pull.paths_for(pull.area_map(tree_nodes()))
        zip_paths = {d.key: d.relpath for d in pull.docs_from_zip(make_zip())}
        self.assertEqual(paths, zip_paths)

    def test_pulls_scope_specs_from_the_active_claim_by_key_or_id(self):
        fake = FakeNerv(tree_nodes(), raw_by_key(), claims=[
            {"status": "active", "scope_spec_ids": ["CLE-ACCT-SESSION", "id-CLE-VISION"]},
            {"status": "released", "scope_spec_ids": ["CLE-IX"]},
        ])
        self.run_task(fake)
        self.assertTrue((self.spec / "CLE-ACCT" / "CLE-ACCT-SESSION.md").exists())
        self.assertTrue((self.spec / "CLE-VISION.md").exists())
        self.assertFalse((self.spec / "CLE-IX").exists())

    def test_empty_scope_stops(self):
        fake = FakeNerv(tree_nodes(), raw_by_key(), claims=[{"status": "active",
                                                             "scope_spec_ids": []}])
        with self.assertRaises(SystemExit):
            self.run_task(fake)

    def test_same_etag_is_a_conditional_request_and_output_is_stable(self):
        fake = FakeNerv(tree_nodes(), raw_by_key())
        self.run_task(fake, "CLE-VISION")
        before = self.read("CLE-VISION.md")
        fake.calls.clear()
        self.run_task(fake, "CLE-VISION")
        sent = [etag for path, etag in fake.calls if path.endswith(".md?task=CLE-T-TEST")]
        self.assertEqual(sent, ["sha256-" + hashlib.sha256(DOCS["specs/CLE-VISION.md"]).hexdigest()])
        self.assertEqual(self.read("CLE-VISION.md"), before)

    def test_304_re_renders_links_when_a_target_moved(self):
        # 원문(ETag)이 같아도 링크 대상 문서가 다른 영역으로 옮겨졌으면 링크가 따라가야 한다.
        self.run_task(FakeNerv(tree_nodes(), raw_by_key()), "CLE-CHAT-ADAPTER")
        moved = FakeNerv(tree_nodes({"CLE-ACCT-SESSION": "CLE-IX"}), raw_by_key())
        self.run_task(moved, "CLE-CHAT-ADAPTER")
        self.assertIn(("/api/projects/clemvion/specs/CLE-CHAT-ADAPTER.md?task=CLE-T-TEST",
                       "sha256-" + hashlib.sha256(DOCS["specs/CLE-CHAT/CLE-CHAT-ADAPTER.md"]).hexdigest()),
                      moved.calls)
        self.assertIn("[세션](../CLE-IX/CLE-ACCT-SESSION.md)",
                      self.read("CLE-CHAT/CLE-CHAT-ADAPTER.md"))

    def test_cache_of_another_version_means_no_conditional_request(self):
        # 캐시가 미러의 etag 와 다른 버전이면 304 를 받아도 렌더할 원문이 틀리다.
        fake = FakeNerv(tree_nodes(), raw_by_key())
        self.run_task(fake, "CLE-VISION")
        (self.cache / "CLE-VISION.md").write_bytes(b"---\nid: \"CLE-VISION\"\n---\nstale\n")
        fake.calls.clear()
        self.run_task(fake, "CLE-VISION")
        self.assertEqual([e for p, e in fake.calls if p.endswith("CLE-T-TEST")], [None])

    def test_no_cache_means_no_conditional_request(self):
        fake = FakeNerv(tree_nodes(), raw_by_key())
        self.run_task(fake, "CLE-VISION")
        shutil.rmtree(self.cache)
        fake.calls.clear()
        self.run_task(fake, "CLE-VISION")
        self.assertEqual([e for p, e in fake.calls if p.endswith("CLE-T-TEST")], [None])

    def test_moved_doc_leaves_no_old_file(self):
        self.run_task(FakeNerv(tree_nodes(), raw_by_key()), "CLE-CHAT-ADAPTER")
        self.run_task(FakeNerv(tree_nodes({"CLE-CHAT-ADAPTER": "CLE-ACCT"}), raw_by_key()),
                      "CLE-CHAT-ADAPTER")
        self.assertTrue((self.spec / "CLE-ACCT" / "CLE-CHAT-ADAPTER.md").exists())
        self.assertFalse((self.spec / "CLE-CHAT" / "CLE-CHAT-ADAPTER.md").exists())

    def test_catalog_keys_are_skipped(self):
        self.run_task(FakeNerv(tree_nodes(), raw_by_key()), "CLE-C24-META", "CLE-MKS-ORDER--ITEMS")
        self.assertEqual(pull.mirror_files(self.spec), [])

    def test_unknown_key_stops(self):
        with self.assertRaises(SystemExit):
            self.run_task(FakeNerv(tree_nodes(), raw_by_key()), "CLE-NOPE")

    def test_bad_task_key_stops_before_any_request(self):
        fake = FakeNerv(tree_nodes(), raw_by_key())
        with self.assertRaises(SystemExit):
            quiet(pull.cmd_task, self.spec, "../x", [], nerv=fake, cache=self.cache)
        self.assertEqual(fake.calls, [])

    def test_corrupt_mirror_file_is_refetched(self):
        fake = FakeNerv(tree_nodes(), raw_by_key())
        self.run_task(fake, "CLE-VISION")
        (self.spec / "CLE-VISION.md").write_text("손상\n", encoding="utf-8")
        fake.calls.clear()
        self.run_task(fake, "CLE-VISION")
        self.assertEqual([e for p, e in fake.calls if p.endswith("CLE-T-TEST")], [None])
        self.assertEqual(pull.check(self.spec), [])


FAKE_CURL = r"""#!/usr/bin/env python3
import json, os, sys
stdin = sys.stdin.read()
with open(os.environ["FAKE_CURL_LOG"], "a") as fh:
    fh.write(json.dumps({"argv": sys.argv[1:], "stdin": stdin}) + "\n")
sys.stdout.buffer.write(os.environ["FAKE_CURL_OUT"].encode().decode("unicode_escape").encode("latin-1"))
if os.environ.get("FAKE_CURL_FAIL"):
    sys.exit(28)  # 타임아웃: 헤더까지 받고 끊긴 모양. 출력이 해석돼도 실패는 실패다.
"""


class CurlBoundaryTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        self.tmp = Path(tmp)
        curl = self.tmp / "bin" / "curl"
        curl.parent.mkdir()
        curl.write_text(FAKE_CURL, encoding="utf-8")
        curl.chmod(curl.stat().st_mode | stat.S_IEXEC)
        self.log = self.tmp / "curl.log"
        self.env = mock_env = {
            "PATH": f"{curl.parent}{os.pathsep}{os.environ['PATH']}",
            "FAKE_CURL_LOG": str(self.log),
            "FAKE_CURL_OUT": "HTTP/1.1 100 Continue\\r\\n\\r\\nHTTP/2 304\\r\\netag: x\\r\\n\\r\\n",
        }
        self._saved = {k: os.environ.get(k) for k in mock_env}
        os.environ.update(mock_env)
        self.addCleanup(self._restore)

    def _restore(self):
        for k, v in self._saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def test_token_only_in_stdin_and_etag_quoted(self):
        nerv = pull.Nerv("https://nerv.example.invalid", "clemvion", SECRET)
        etag = "sha256-" + "a" * 64
        status, body = nerv.get("/api/projects/clemvion/specs/CLE-X.md?task=CLE-T-1", etag=etag)
        self.assertEqual((status, body), (304, b""))
        call = self.calls()[0]
        self.assertNotIn(SECRET, " ".join(call["argv"]))
        self.assertIn(f'header = "Authorization: Bearer {SECRET}"', call["stdin"])
        self.assertIn(f'header = "If-None-Match: \\"{etag}\\""', call["stdin"])

    def test_curl_failure_raises(self):
        os.environ["FAKE_CURL_FAIL"] = "1"
        self.addCleanup(os.environ.pop, "FAKE_CURL_FAIL", None)
        with self.assertRaisesRegex(RuntimeError, "curl 실패"):
            pull.Nerv("https://x.invalid", "clemvion", SECRET).get("/x")

    def test_config_injection_values_are_rejected(self):
        with self.assertRaises(SystemExit):
            pull.Nerv("https://x.invalid", "clemvion", 'tok"\nurl = "https://evil.invalid"')
        nerv = pull.Nerv("https://x.invalid", "clemvion", SECRET)
        with self.assertRaises(SystemExit):
            nerv.get("/x", etag='sha256-x"\nurl = "https://evil.invalid')
        self.assertFalse(self.log.exists(), "주입 값이 curl 에 닿았다")

    def test_plain_http_is_rejected(self):
        with self.assertRaises(SystemExit):
            pull.Nerv("http://nerv.example.invalid", "clemvion", SECRET)

    def test_parse_response_skips_informational_blocks(self):
        raw = b"HTTP/1.1 100 Continue\r\n\r\nHTTP/2 200\r\ncontent-type: text/markdown\r\n\r\nbody\r\n\r\nmore"
        self.assertEqual(pull.parse_response(raw), (200, b"body\r\n\r\nmore"))


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
        # 커밋된 미러가 무결성 검사를 통과해야 CI 가 초록이다. `check` 는 미러 0편을 실패로 본다.
        self.assertEqual(pull.check(_harness.REPO_ROOT / "spec"), [])


class MirrorPredicateParityTest(unittest.TestCase):
    """「미러 경로」 판정이 세 곳(이 도구 · consistency 오케스트레이터 · frontend 가드)에 있다.

    실제 `spec/` 을 훑어 세 판정이 같은 집합을 고르는지 본다. 키 형식이 바뀌면 각 스위트가
    초록인 채 갈라지는 것을 막는다. frontend 정규식은 `spec-links.ts` 의 `NERV_MIRROR` 리터럴을
    읽어 쓴다. 오케스트레이터는 서브프로세스에서 부른다. 같은 프로세스에서 읽으면 그 모듈의
    `_lib` 가 먼저 적재된 `.claude/hooks/_lib` 와 부딪혀 전체 실행에서만 ImportError 가 난다
    (2026-10-01 실측).
    """

    ROOT = _harness.REPO_ROOT
    TS = ROOT / "codebase" / "frontend" / "src" / "lib" / "docs" / "__tests__" / "spec-links.ts"
    ORCH = ROOT / ".claude" / "skills" / "consistency-checker" / "scripts" / "consistency_orchestrator.py"

    def test_three_predicates_agree_on_the_real_tree(self):
        import re

        literal = re.search(r"const NERV_MIRROR = /(.+)/;", self.TS.read_text(encoding="utf-8"))
        self.assertIsNotNone(literal, "spec-links.ts 에서 NERV_MIRROR 를 찾지 못했다")
        ts_re = re.compile(literal.group(1).replace("\\/", "/"))
        spec = self.ROOT / "spec"
        rels = sorted(p.relative_to(self.ROOT).as_posix() for p in spec.rglob("*.md"))
        tool = {p.relative_to(self.ROOT).as_posix() for p in pull.mirror_files(spec)}
        tool.add("spec/README.md")
        by_orch = set(_harness.run_in_orchestrator(
            _harness.orchestrator_preamble(self.ORCH, imports="os"),
            """
            spec = os.path.join(ROOT, "spec")
            emit([r for r in ARG if orch.is_nerv_mirror(os.path.join(ROOT, r), spec)])
            """,
            rels,
        ))
        by_ts = {r for r in rels if ts_re.match(r)}
        self.assertGreater(len(tool), 100, "미러가 없다 — 이 대조는 공허하다")
        self.assertEqual(by_orch, tool)
        self.assertEqual(by_ts, tool)


if __name__ == "__main__":
    unittest.main()
