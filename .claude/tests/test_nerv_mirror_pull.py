"""Tests for `.claude/tools/nerv-mirror/pull.py` — NERV 스펙의 저장소 미러.

네트워크 없이 돈다. `--all` 은 합성 export.zip(`--from-zip` 또는 가짜 클라이언트)으로, `--task` 는
가짜 NERV 클라이언트로, curl 경계는 PATH 앞에 둔 가짜 `curl` 로 돈다. 실제 NERV 응답 형태(ETag = md
바이트 sha256, frontmatter JSON 인용, 영역 문서의 `area` 는 부모 영역, 트리 배치 = 가장 가까운 area
조상-또는-자신, 클레임 `status: "active"`, scope 는 문서 id)는 2026-09-29 · 10-01 실측에서 왔다.
그 실측에서 트리로 계산한 경로와 export 배치가 169편 전부 일치했다.

고정하는 것(클래스별):
- `AllModeTest`: 결정성(두 번째 pull 은 diff 0), 배치(D1: 영역 문서는 자기 폴더, 영역 밖은
  `spec/<KEY>.md`), 카탈로그 영역 제외(D4, 계층 키 `--` 포함), 링크 재작성(모르는 키는 그대로),
  frontmatter 세 줄, CRLF · 끝 줄바꿈 정규화, 머리 인용 줄의 `원문:` 만 읽기, prune, README.
- `InputValidationTest`: 키 형식 · 배치 깊이 · 끝 개행, 빈 export, 절반 넘는 삭제, 크기 상한,
  심볼릭 링크(쓰기 · 경로 중간의 폴더 링크 · README · prune · 빈 폴더 정리 · 쓰기 전 전체 검사),
  렌더 오류는 쓰기 전에 멈춤, 트리 순환, 모드에 안 맞는 옵션 거절, CLI 오류는 한 줄
  (`test_cli_reports_errors_in_one_line`).
- `CheckTest`: 본문 · frontmatter · 본문 속 `mirror_sha256:` 줄 손편집, 파일 이동, 지문 없는 미러
  파일 추가, 미러 자리의 링크 · 다른 파일(하위 폴더 · 점 이름 `.md` · 키가 아닌 폴더 포함), `spec/`
  바로 아래의 미러가 아닌 파일 · 폴더(되살린 옛 트리, README 와 `.md` 가 아닌 점 파일은 제외), 읽을 수
  없는 파일과 이상한 frontmatter 값은 예외가 아니라 문제 줄(`test_odd_frontmatter_values_are_reported_not_raised`),
  빈 미러, CLI 종료 코드, 출력의 제어 문자 이스케이프. `test_limitation_*` 은 문서에 적은 한계(삭제 ·
  지문까지 맞춘 위조는 못 잡는다)를 고정한다. 한계를 없애는 변경은 이 테스트를 함께 바꾼다.
- `TaskModeTest`: 활성 클레임 scope(키든 문서 id 든), ETag 304 면 캐시 원문으로 다시 렌더(캐시는
  다시 쓰지 않는다), 캐시가 없거나 다른 버전 · 미러 etag 가 깨졌으면 조건부 요청 없음, 조건부 요청
  없이 받은 304 는 오류, 옮겨진 문서의 옛 파일 삭제와 받지 않은 문서의 어긋난 링크를 `--check` 가
  잡음, 오류 응답 · 모양이 틀린 응답에서 멈추고 아무것도 안 씀, 키를 검증하기 전에 캐시를 읽지 않음,
  scope 가 비면 멈춤.
- `AllNetworkTest`: `--all` 의 네트워크 경로(요청 경로 · 환경 변수 누락).
- `CurlBoundaryTest`: 토큰은 argv 에 없고 stdin 설정에만 있다, curl 인자(`-K -` · `-D -` · `-g` ·
  `--proto` · `-A` · URL 마지막), If-None-Match 인용, 1xx · CONNECT 블록 건너뜀, curl 실패 · curl
  없음은 `PullError`, 설정 줄 주입 문자 · 끝 개행 거부, 서버 경계(https 또는 loopback, 사용자 정보 ·
  쿼리 · 조각 · 잘못된 주소 거부), 프로젝트 이름.
- `CiWiringTest`: CI 잡이 `--check` 를 부르고, 잡이 받는 경로(sparse checkout)만으로 `--check` 가
  돌고, 커밋된 미러가 그 검사를 통과한다.
- `OrchestratorMirrorParityTest`: consistency 오케스트레이터가 이 도구와 같은 키 문법으로 같은 미러
  파일을 고르고 같은 `type` 을 읽는다. 두 파일 중 어느 것만 고쳐도 harness CI 가 돈다
  (`test_both_files_trigger_the_harness_workflow`).
"""

from __future__ import annotations

import contextlib
import hashlib
import io
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import threading
import unittest
import zipfile
from pathlib import Path, PurePosixPath
from unittest import mock

import _harness
from test_harness_checks_paths_coverage import filter_covers_file, parse_pathspecs_block

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
# NOTE(`원문:` 이 인용 줄이 아니거나 머리 밖에만 있음, CRLF, 끝 줄바꿈 없음) · C24 · MKS(카탈로그 영역).
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
        body="본문 첫 줄\n\n인용이 아닌 줄의 원문: `spec/x.md` 는 머리 인용이 아니다\n" * 3
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
VALID_ETAG = "sha256-" + "a" * 64


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
        self.spec.mkdir(parents=True)
        self.zip = self.root / "export.zip"
        self.zip.write_bytes(make_zip())

    def old_tree(self) -> Path:
        """미러 밖 `spec/` 파일(옛 트리 모양). 옛 트리는 전환 단계 5 에서 지웠고 `--check` 는 이런
        파일을 알린다. 그래서 공통 fixture 에 두지 않고 그 자리를 보는 테스트만 만든다."""
        folder = self.spec / "5-system"
        folder.mkdir(exist_ok=True)
        (folder / "1-auth.md").write_text("옛 트리\n", encoding="utf-8")
        return folder

    def pull_all(self, *extra):
        # `run` 은 `PullError` 를 그대로 올린다(`main` 은 한 줄로 바꾸고 1 을 돌려준다).
        return quiet(pull.run, ["--all", "--from-zip", str(self.zip), "--root", str(self.root),
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
        report = pull.apply(self.spec, docs, pull.paths_of(docs), prune=True)
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
        # 더한 세 줄의 순서: source_paths → mirror_sha256 → etag (frontmatter 끝)
        self.assertEqual([ln.split(":")[0] for ln in lines[-3:]],
                         ["source_paths", "mirror_sha256", "etag"])

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
        self.old_tree()
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
        self.assertIn("source_paths", readme)
        # 미러의 `status` 는 NERV 문서 상태라 옛 트리의 구현 상태와 다르다는 안내.
        self.assertIn("구현 상태:", readme)


class InputValidationTest(_Fixture):
    def test_empty_export_does_not_wipe_the_mirror(self):
        self.pull_all()
        self.zip.write_bytes(make_zip({}))
        with self.assertRaises(pull.PullError):
            self.pull_all()
        self.assertEqual(self.mirrored(), MIRRORED)

    def test_empty_export_stops_even_without_a_mirror(self):
        # 미러가 없으면 대량 삭제 방어가 발동하지 않는다. 빈 export 검사만 남는다.
        self.zip.write_bytes(make_zip({}))
        with self.assertRaisesRegex(pull.PullError, "빈 export"):
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
        with self.assertRaisesRegex(pull.PullError, "--allow-mass-prune"):
            self.pull_all()
        self.assertEqual(self.mirrored(), MIRRORED)
        self.pull_all("--allow-mass-prune")
        self.assertEqual(self.mirrored(), ["CLE-VISION.md"])

    def test_non_key_zip_entries_are_rejected(self):
        for name in ("specs/../CLAUDE.md", "specs/CLE-X/../../x.md", "specs/lower/CLE-X.md",
                     "specs/CLE-A/CLE-B/CLE-C.md", "specs/CLE-X\n.md"):
            with self.subTest(name=name):
                bad = dict(DOCS)
                bad[name] = md("CLE-X")
                self.zip.write_bytes(make_zip(bad))
                with self.assertRaises(pull.PullError):
                    self.pull_all()
                self.assertFalse((self.root / "CLAUDE.md").exists())
                # 쓰기 단계(mirror_relpath)도 키를 보지만, 거부는 읽는 단계에서 먼저 한다.
                with self.assertRaisesRegex(pull.PullError, "export"):
                    pull.docs_from_zip(make_zip(bad))

    def test_keys_with_a_trailing_newline_are_not_keys(self):
        # `re.match` 와 `$` 는 끝 개행을 받아들인다. 형식 검사는 fullmatch 여야 한다.
        for bad in ("CLE-X\n", "CLE-X\nCLE-Y"):
            with self.subTest(bad=bad), self.assertRaises(pull.PullError):
                pull.mirror_relpath(bad, None)

    def test_oversized_export_entries_stop(self):
        with mock.patch.object(pull, "MAX_ENTRY_BYTES", 64), \
                self.assertRaisesRegex(pull.PullError, "상한"):
            pull.docs_from_zip(make_zip())
        with mock.patch.object(pull, "MAX_EXPORT_BYTES", 600), \
                self.assertRaisesRegex(pull.PullError, "상한"):
            pull.docs_from_zip(make_zip())

    def test_non_key_tree_nodes_cannot_escape(self):
        with self.assertRaises(pull.PullError):
            pull.mirror_relpath("CLE-X", "../..")
        with self.assertRaises(pull.PullError):
            pull.mirror_relpath("../CLAUDE", None)

    def test_never_writes_through_a_symlink(self):
        (self.spec / "CLE-VISION.md").symlink_to(self.root / "outside.md")
        with self.assertRaises(pull.PullError):
            self.pull_all()
        self.assertFalse((self.root / "outside.md").exists())
        # 쓰기 전에 모든 대상을 먼저 검사하므로 키 순서상 앞선 문서도 쓰지 않았다.
        self.assertEqual(self.mirrored(), [])

    def test_never_writes_through_a_readme_symlink(self):
        # README 도 쓰기 전 검사에 든다. 빠지면 문서를 다 쓴 뒤에야 멈춘다.
        outside = self.root / "outside.md"
        outside.write_text("밖\n", encoding="utf-8")
        (self.spec / "README.md").symlink_to(outside)
        with self.assertRaises(pull.PullError):
            self.pull_all()
        self.assertEqual(outside.read_text(encoding="utf-8"), "밖\n")
        self.assertEqual(self.mirrored(), [])

    def test_never_writes_through_a_folder_symlink_inside_spec(self):
        # `spec/` 안을 가리키는 폴더 링크(예: 옛 트리)도 따라가 쓰지 않는다.
        (self.spec / "CLE-ACCT").symlink_to(self.old_tree(), target_is_directory=True)
        with self.assertRaises(pull.PullError):
            self.pull_all()
        self.assertEqual(sorted(p.name for p in (self.spec / "5-system").iterdir()), ["1-auth.md"])

    def test_write_if_changed_refuses_links_on_its_own(self):
        # 쓰기 전 검사와 별개로 쓰는 함수 자신도 링크를 거부한다. 검사 뒤 링크로 바뀐 자리
        # (`_write_target` 을 지난 뒤)도 `O_NOFOLLOW` 로 따라가지 않는다.
        outside = self.root / "outside.md"
        outside.write_text("밖\n", encoding="utf-8")
        (self.spec / "CLE-X.md").symlink_to(outside)
        with self.assertRaises(pull.PullError):
            pull.write_if_changed(self.spec, PurePosixPath("CLE-X.md"), "안\n")
        with mock.patch.object(pull, "_write_target", lambda root, rel: root / rel), \
                self.assertRaises(pull.PullError):
            pull.write_if_changed(self.spec, PurePosixPath("CLE-X.md"), "안\n")
        self.assertEqual(outside.read_text(encoding="utf-8"), "밖\n")
        # 경로 중간의 폴더 링크는 `O_NOFOLLOW`(마지막 조각만 본다)가 막지 못한다. 쓰는 함수가 직접 본다.
        (self.spec / "CLE-D").symlink_to(self.old_tree(), target_is_directory=True)
        with self.assertRaises(pull.PullError):
            pull.write_if_changed(self.spec, PurePosixPath("CLE-D/CLE-D.md"), "안\n")
        self.assertEqual(sorted(p.name for p in (self.spec / "5-system").iterdir()), ["1-auth.md"])

    def test_render_errors_stop_before_any_write(self):
        # 키 순서상 마지막 문서가 렌더되지 않아도 앞선 문서를 쓰지 않는다.
        for raw in (b"frontmatter \xec\x97\x86\xec\x9d\x8c\n", b"---\nid: \"CLE-ZZZ\"\n---\n\xff\xfe\n"):
            with self.subTest(raw=raw[:12]):
                docs = dict(DOCS)
                docs["specs/CLE-ZZZ.md"] = raw
                self.zip.write_bytes(make_zip(docs))
                with self.assertRaisesRegex(pull.PullError, "CLE-ZZZ"):
                    self.pull_all()
                self.assertEqual(self.mirrored(), [])

    def test_never_writes_through_a_symlink_inside_the_mirror(self):
        # 대상이 spec/ 안이어도 링크를 따라 쓰면 다른 미러 파일을 덮는다.
        self.pull_all()
        victim = self.spec / "CLE-ACCT" / "CLE-ACCT.md"
        before = victim.read_text(encoding="utf-8")
        (self.spec / "CLE-VISION.md").unlink()
        (self.spec / "CLE-VISION.md").symlink_to(victim)
        with self.assertRaises(pull.PullError):
            self.pull_all()
        self.assertEqual(victim.read_text(encoding="utf-8"), before)

    def test_prune_never_follows_a_directory_symlink(self):
        # 링크 폴더 안의 `CLE-*.md` 를 미러로 보면 prune 이 `spec/` 밖 파일을 지운다(2026-10-01 리뷰 재현).
        outside = self.root / "outside"
        outside.mkdir()
        (outside / "CLE-VICTIM.md").write_text("지우면 안 된다\n", encoding="utf-8")
        (self.spec / "CLE-EVIL").symlink_to(outside, target_is_directory=True)
        self.pull_all()
        self.assertTrue((outside / "CLE-VICTIM.md").exists())
        self.assertTrue((self.spec / "CLE-EVIL").is_symlink())
        self.assertTrue(any("CLE-EVIL" in p and "심볼릭" in p for p in pull.check(self.spec)))

    def test_only_empty_mirror_folders_are_removed(self):
        (self.spec / "CLE-lower").mkdir()
        empty = self.root / "empty"
        empty.mkdir()
        (self.spec / "CLE-EMPTY").symlink_to(empty, target_is_directory=True)
        self.pull_all()
        self.assertTrue((self.spec / "CLE-lower").is_dir())
        self.assertTrue((self.spec / "CLE-EMPTY").is_symlink())  # 빈 폴더를 가리키는 링크
        self.assertTrue(empty.is_dir())

    def test_tree_cycle_stops(self):
        # 방어가 빠지면 무한 루프라 같은 스레드에서는 실패 대신 테스트 전체가 멈춘다(뮤턴트로
        # 겪었다). 데몬 스레드에서 돌리고 제한 시간 안에 끝나는지 본다.
        tree = [{"id": "a", "key": "CLE-A", "type": "feature", "parent_id": "b"},
                {"id": "b", "key": "CLE-B", "type": "feature", "parent_id": "a"}]
        outcome = {}

        def run():
            try:
                pull.area_map(tree)
            except pull.PullError as exc:
                outcome["error"] = str(exc)

        worker = threading.Thread(target=run, daemon=True)
        worker.start()
        worker.join(10)
        self.assertFalse(worker.is_alive(), "순환 트리에서 area_map 이 끝나지 않는다")
        self.assertIn("순환", outcome.get("error", ""))

    def test_incompatible_flags_are_rejected(self):
        for argv in (["--check", "--spec", "CLE-X"], ["--check", "--allow-mass-prune"],
                     ["--task", "CLE-T-X", "--from-zip", "x.zip"]):
            with self.subTest(argv=argv), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as caught:
                    pull.run([*argv, "--root", str(self.root)])
                self.assertEqual(caught.exception.code, 2)  # argparse 가 거절했다

    def test_cli_reports_errors_in_one_line(self):
        not_zip = self.root / "not.zip"
        not_zip.write_text("<html>", encoding="utf-8")
        empty_zip = self.root / "empty.zip"
        empty_zip.write_bytes(make_zip({}))
        cases = {
            "빈 export": (["--all", "--from-zip", str(empty_zip)], {}),
            "zip 아님": (["--all", "--from-zip", str(not_zip)], {}),
            "없는 zip": (["--all", "--from-zip", str(self.root / "missing.zip")], {}),
            "잘못된 서버": (["--all"], {"NERV_SERVER": "https://[::1", "NERV_TOKEN": SECRET}),
        }
        for name, (argv, env) in cases.items():
            with self.subTest(name):
                r = subprocess.run([sys.executable, str(PULL_SRC), *argv, "--root", str(self.root)],
                                   capture_output=True, text=True, env={**os.environ, **env})
                self.assertEqual(r.returncode, 1, r.stderr)
                self.assertTrue(r.stderr.startswith("pull: "), r.stderr)
                self.assertEqual(r.stderr.count("\n"), 1, r.stderr)  # traceback 없이 한 줄
                self.assertNotIn(SECRET, r.stderr)
        # 같은 계약을 프로세스 안에서도: `main` 은 1 을 돌려주고 `run` 은 예외를 올린다.
        with contextlib.redirect_stderr(io.StringIO()) as err:
            self.assertEqual(pull.main(["--all", "--from-zip", str(not_zip),
                                        "--root", str(self.root)]), 1)
        self.assertTrue(err.getvalue().startswith("pull: "))


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

    def test_body_line_that_looks_like_the_fingerprint_is_still_covered(self):
        # 지문은 frontmatter 의 그 줄 하나만 뺀다. 본문의 같은 접두 줄을 고쳐도 잡는다.
        self.pull_all()
        path = self.spec / "CLE-VISION.md"
        path.write_text(path.read_text(encoding="utf-8") + "mirror_sha256: 본문에 끼운 줄\n",
                        encoding="utf-8")
        self.assertEqual(len(pull.check(self.spec)), 1)

    def test_moved_file_is_caught(self):
        self.pull_all()
        (self.spec / "CLE-IX" / "CLE-IX.md").rename(self.spec / "CLE-ACCT" / "CLE-IX.md")
        self.assertTrue(any("위치" in p for p in pull.check(self.spec)))

    def test_added_mirror_file_without_a_fingerprint_is_caught(self):
        self.pull_all()
        (self.spec / "CLE-ACCT" / "CLE-ACCT-NEW.md").write_bytes(
            md("CLE-ACCT-NEW", area="CLE-ACCT"))
        problems = pull.check(self.spec)
        self.assertTrue(any("CLE-ACCT-NEW" in p and "mirror_sha256" in p for p in problems))

    def test_other_files_in_the_mirror_place_are_caught(self):
        self.pull_all()
        (self.spec / "CLE-ACCT" / "notes.md").write_text("메모\n", encoding="utf-8")
        (self.spec / "CLE-lower.md").write_text("메모\n", encoding="utf-8")
        (self.spec / "CLE-lower").mkdir()                   # 키가 아닌 폴더
        (self.spec / "CLE-ACCT" / "sub").mkdir()            # 미러 폴더 안의 하위 폴더
        (self.spec / "CLE-ACCT" / "CLE-DIR.md").mkdir()     # 미러 이름인 폴더
        (self.spec / "CLE-ACCT" / ".hidden.md").write_text("메모\n", encoding="utf-8")
        (self.spec / "CLE-ACCT" / ".DS_Store").write_bytes(b"")  # `.md` 가 아닌 점 파일은 보지 않는다
        problems = pull.check(self.spec)
        stray = [p for p in problems if "미러가 아닌" in p]
        self.assertEqual(sorted(p.split(":")[0] for p in stray),
                         ["CLE-ACCT/.hidden.md", "CLE-ACCT/CLE-DIR.md", "CLE-ACCT/notes.md",
                          "CLE-ACCT/sub", "CLE-lower", "CLE-lower.md"])
        # 미러 이름인 폴더는 미러 파일로 세지 않는다(읽기 오류로 한 번 더 알리지 않는다).
        self.assertEqual(len([p for p in problems if p.startswith("CLE-ACCT/CLE-DIR.md:")]), 1, problems)

    def test_files_outside_the_mirror_place_are_caught(self):
        """`spec/` 에는 미러와 README 만 둔다. 옛 트리를 셸로 되살리면 `--check` 가 알린다."""
        self.pull_all()
        self.old_tree()
        (self.spec / "0-overview.md").write_text("옛 개요\n", encoding="utf-8")
        (self.spec / "notes.txt").write_text("메모\n", encoding="utf-8")
        (self.spec / ".hidden.md").write_text("메모\n", encoding="utf-8")
        (self.spec / ".DS_Store").write_bytes(b"")  # `.md` 가 아닌 점 파일은 보지 않는다
        (self.spec / "other-link").symlink_to(self.root / "export.zip")
        problems = pull.check(self.spec)
        stray = sorted(p.split(":")[0] for p in problems if "미러가 아닌" in p)
        self.assertEqual(stray, [".hidden.md", "0-overview.md", "5-system", "notes.txt", "other-link"])
        # README 는 이 도구가 쓰는 안내라 알리지 않는다(fixture 가 pull 로 썼다).
        self.assertTrue((self.spec / "README.md").is_file())
        self.assertFalse(any(p.startswith("README.md") for p in problems), problems)

    def test_dot_folders_are_caught_and_each_link_is_reported_once(self):
        """점 폴더도 미러가 아닌 것이다. 미러 자리의 링크는 링크 문제 한 줄로만 알린다."""
        self.pull_all()
        hidden = self.spec / ".old-tree"
        hidden.mkdir()
        (hidden / "1-auth.md").write_text("옛 트리\n", encoding="utf-8")
        (self.spec / "CLE-ACCT" / ".cache").mkdir()
        (self.spec / "CLE-LINKDIR").symlink_to(self.spec / "CLE-ACCT", target_is_directory=True)
        (self.spec / ".dot-link").symlink_to(self.root / "export.zip")
        problems = pull.check(self.spec)
        stray = sorted(p.split(":")[0] for p in problems if "미러가 아닌" in p)
        self.assertEqual(stray, [".dot-link", ".old-tree", "CLE-ACCT/.cache"])
        self.assertEqual([p for p in problems if p.startswith("CLE-LINKDIR")],
                         ["CLE-LINKDIR: 심볼릭 링크다 — 미러는 링크를 두지 않는다"])

    def test_symlink_in_the_mirror_place_is_caught(self):
        self.pull_all()
        (self.spec / "CLE-ACCT" / "CLE-ACCT-LINK.md").symlink_to(self.spec / "CLE-VISION.md")
        self.assertTrue(any("CLE-ACCT-LINK" in p and "심볼릭" in p for p in pull.check(self.spec)))

    def test_odd_frontmatter_values_are_reported_not_raised(self):
        self.pull_all()
        path = self.spec / "CLE-ACCT" / "CLE-ACCT-SESSION.md"
        text = path.read_text(encoding="utf-8")
        for old, new in (('id: "CLE-ACCT-SESSION"', "id: 5"), ('area: "CLE-ACCT"', "area: 5"),
                         ('id: "CLE-ACCT-SESSION"', 'id: ["CLE-ACCT-SESSION"]')):
            with self.subTest(new=new):
                path.write_text(text.replace(old, new), encoding="utf-8")
                self.assertTrue(any("위치" in p for p in pull.check(self.spec)))
        path.write_text(text, encoding="utf-8")

    def test_unreadable_mirror_files_are_reported_not_raised(self):
        self.pull_all()
        (self.spec / "CLE-VISION.md").write_bytes(b"---\nid: \"CLE-VISION\"\n---\n\xff\xfe\n")
        locked = self.spec / "CLE-IX" / "CLE-IX.md"
        locked.chmod(0)  # 권한 오류(OSError)
        self.addCleanup(locked.chmod, 0o644)
        problems = pull.check(self.spec)
        for rel in ("CLE-VISION.md", "CLE-IX/CLE-IX.md"):
            with self.subTest(rel=rel):
                self.assertTrue(any(p.startswith(rel + ":") and "읽지 못했다" in p for p in problems),
                                problems)

    def test_check_output_escapes_control_characters(self):
        # 파일 이름은 PR 이 정한다. 개행이 그대로 찍히면 CI 로그에 워크플로 명령 줄을 끼운다.
        self.pull_all()
        (self.spec / "CLE-ACCT" / "x\n::error::y.md").write_text("메모\n", encoding="utf-8")
        r = subprocess.run([sys.executable, str(PULL_SRC), "--check", "--root", str(self.root)],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 1)
        self.assertFalse([ln for ln in r.stdout.splitlines() if ln.startswith("::")], r.stdout)
        self.assertIn("x\\x0a::error::y.md", r.stdout)

    def test_file_without_frontmatter_is_reported(self):
        self.pull_all()
        (self.spec / "CLE-VISION.md").write_text("손으로 쓴 파일\n", encoding="utf-8")
        self.assertTrue(any("frontmatter" in p for p in pull.check(self.spec)))

    def test_empty_mirror_fails(self):
        self.assertEqual(len(pull.check(self.spec)), 1)

    def test_limitation_deleting_a_mirror_file_is_not_caught(self):
        # 문서에 적은 한계: 미러는 부분 스냅샷(결정 D3)이라 "없는 파일" 을 문제로 볼 기준이 없다.
        self.pull_all()
        (self.spec / "CLE-IX" / "CLE-IX.md").unlink()
        self.assertEqual(pull.check(self.spec), [])

    def test_limitation_a_forged_file_with_a_recomputed_fingerprint_passes(self):
        # 문서에 적은 한계: 지문은 같은 파일 안의 값이라 변조 방지가 아니다.
        self.pull_all()
        path = self.spec / "CLE-VISION.md"
        text = path.read_text(encoding="utf-8").replace("계정", "계좌")
        lines = text.split("\n")
        i = next(n for n, ln in enumerate(lines) if ln.startswith("mirror_sha256: "))
        del lines[i]
        lines.insert(i, f"mirror_sha256: {json.dumps(pull.fingerprint(text))}")
        path.write_text("\n".join(lines), encoding="utf-8")
        self.assertEqual(pull.check(self.spec), [])

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
    """`Nerv` 대역. 받은 경로 · If-None-Match 를 기록한다.

    `pull` 이 클라이언트에 기대는 것은 `project` 와 `get` 뿐이다(`ok_body` · `json_body` 는 `get`
    위의 모듈 함수다). ``statuses`` 는 경로 접두별 응답 코드, ``bodies`` 는 경로 접두별 200 본문을 바꾼다.
    """

    def __init__(self, tree, mds, claims=None, statuses=None, export=None, bodies=None):
        self.project = "clemvion"
        self.tree, self.mds, self.claims = tree, mds, claims or []
        self.statuses, self.export, self.bodies = statuses or {}, export, bodies or {}
        self.calls = []

    def get(self, path, etag=None):
        self.calls.append((path, etag))
        for prefix, status in self.statuses.items():
            if path.startswith(prefix):
                return status, b"error"
        for prefix, body in self.bodies.items():
            if path.startswith(prefix):
                return 200, body
        if path == "/api/v1/projects/clemvion/specs/tree":
            return 200, json.dumps(self.tree).encode()
        if path.startswith("/api/v1/projects/clemvion/tasks/"):
            return 200, json.dumps({"claims": self.claims}).encode()
        if path.startswith("/api/projects/clemvion/export.zip"):
            return 200, self.export
        assert path.startswith("/api/projects/clemvion/specs/"), path
        key = path.split("/specs/")[1].split(".md")[0]
        raw = self.mds[key]
        if etag == "sha256-" + hashlib.sha256(raw).hexdigest():
            return 304, b""
        return 200, raw


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

    def md_etags(self, fake):
        return [e for p, e in fake.calls if p.endswith(".md?task=CLE-T-TEST")]

    def test_area_map_matches_the_export_layout(self):
        paths = pull.paths_for(pull.area_map(tree_nodes()))
        zip_paths = pull.paths_of(pull.docs_from_zip(make_zip()))
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
        with self.assertRaisesRegex(pull.PullError, "scope"):
            self.run_task(fake)

    def test_same_etag_is_a_conditional_request_and_output_is_stable(self):
        fake = FakeNerv(tree_nodes(), raw_by_key())
        self.run_task(fake, "CLE-VISION")
        before = self.read("CLE-VISION.md")
        fake.calls.clear()
        self.run_task(fake, "CLE-VISION")
        self.assertEqual(self.md_etags(fake),
                         ["sha256-" + hashlib.sha256(DOCS["specs/CLE-VISION.md"]).hexdigest()])
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

    def test_304_keeps_the_cache_file(self):
        # 304 면 캐시 원문이 그대로 맞다. 다시 쓰면 공유 캐시를 읽는 다른 세션과 겹칠 뿐이다.
        fake = FakeNerv(tree_nodes(), raw_by_key())
        self.run_task(fake, "CLE-VISION")
        with mock.patch.object(pull, "_write_cache", wraps=pull._write_cache) as spy:
            self.run_task(fake, "CLE-VISION")
        self.assertEqual(self.md_etags(fake)[-1],
                         "sha256-" + hashlib.sha256(DOCS["specs/CLE-VISION.md"]).hexdigest())
        spy.assert_not_called()
        self.assertEqual(sorted(p.name for p in self.cache.iterdir()), ["CLE-VISION.md"])  # 임시 파일 없음

    def test_check_catches_links_left_behind_in_docs_not_pulled(self):
        # 옮겨진 문서만 받으면 그 문서를 가리키던 다른 문서의 링크는 옛 자리로 남는다(2026-10-01 리뷰 재현).
        full = FakeNerv(tree_nodes(), raw_by_key())
        self.run_task(full, "CLE-VISION", "CLE-ACCT", "CLE-ACCT-SESSION", "CLE-CHAT-ADAPTER")
        self.assertEqual(pull.check(self.spec), [])
        # NERV 에서 옮기면 트리와 문서 frontmatter `area` 가 함께 바뀐다.
        mds = raw_by_key()
        mds["CLE-ACCT-SESSION"] = mds["CLE-ACCT-SESSION"].replace(b'area: "CLE-ACCT"',
                                                                  b'area: "CLE-IX"')
        moved = FakeNerv(tree_nodes({"CLE-ACCT-SESSION": "CLE-IX"}), mds)
        self.run_task(moved, "CLE-ACCT-SESSION")
        stale = [p for p in pull.check(self.spec) if "대상이 없다" in p]
        self.assertEqual(sorted(p.split(":")[0] for p in stale),
                         ["CLE-CHAT/CLE-CHAT-ADAPTER.md", "CLE-VISION.md"])
        # 그 문서들도 받으면 풀린다.
        self.run_task(moved, "CLE-VISION", "CLE-CHAT-ADAPTER")
        self.assertEqual(pull.check(self.spec), [])

    def test_cache_of_another_version_means_no_conditional_request(self):
        # 캐시가 미러의 etag 와 다른 버전이면 304 를 받아도 렌더할 원문이 틀리다.
        fake = FakeNerv(tree_nodes(), raw_by_key())
        self.run_task(fake, "CLE-VISION")
        (self.cache / "CLE-VISION.md").write_bytes(b"---\nid: \"CLE-VISION\"\n---\nstale\n")
        fake.calls.clear()
        self.run_task(fake, "CLE-VISION")
        self.assertEqual(self.md_etags(fake), [None])

    def test_no_cache_means_no_conditional_request(self):
        fake = FakeNerv(tree_nodes(), raw_by_key())
        self.run_task(fake, "CLE-VISION")
        shutil.rmtree(self.cache)
        fake.calls.clear()
        self.run_task(fake, "CLE-VISION")
        self.assertEqual(self.md_etags(fake), [None])

    def test_malformed_mirror_etag_is_refetched_not_sent(self):
        # 미러 frontmatter 의 etag 는 설정 줄에 절대 실리지 않는다. 캐시 원문에서 계산한 값만 보낸다.
        for bad in ('"x\\"\\nurl = \\"https://evil.invalid\\""', "5"):
            with self.subTest(bad=bad):
                fake = FakeNerv(tree_nodes(), raw_by_key())
                self.run_task(fake, "CLE-VISION")
                path = self.spec / "CLE-VISION.md"
                text = path.read_text(encoding="utf-8")
                # 치환 문자열이면 `re.sub` 가 `\n` 을 개행으로 풀어 줄이 깨진다. 함수로 넘긴다.
                path.write_text(re.sub(r"(?m)^etag: .*$", lambda m: f"etag: {bad}", text),
                                encoding="utf-8")
                written = pull.fm_value(pull.split_frontmatter(path.read_text(encoding="utf-8"))[0],
                                        "etag")
                self.assertEqual(written, json.loads(bad), "fixture 가 의도한 값으로 들어가지 않았다")
                fake.calls.clear()
                self.run_task(fake, "CLE-VISION")
                self.assertEqual(self.md_etags(fake), [None])
                self.assertEqual(pull.check(self.spec), [])

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
        with self.assertRaisesRegex(pull.PullError, "없는 키"):
            self.run_task(FakeNerv(tree_nodes(), raw_by_key()), "CLE-NOPE")

    def test_error_responses_stop_and_write_nothing(self):
        # 304 도 조건부 요청을 하지 않았으면 오류다(재렌더할 캐시 원문이 없다).
        for prefix, status in (("/api/v1/projects/clemvion/specs/tree", 404),
                               ("/api/projects/clemvion/specs/CLE-VISION.md", 404),
                               ("/api/projects/clemvion/specs/CLE-VISION.md", 304)):
            with self.subTest(prefix=prefix, status=status):
                fake = FakeNerv(tree_nodes(), raw_by_key(), statuses={prefix: status})
                with self.assertRaisesRegex(pull.PullError, str(status)):
                    self.run_task(fake, "CLE-VISION")
                self.assertEqual(pull.mirror_files(self.spec), [])
                self.assertFalse((self.cache / "CLE-VISION.md").exists())

    def test_unrequested_304_stops_even_with_a_cache_of_another_version(self):
        # 조건부 요청을 하지 않았는데 304 가 오면, 캐시가 있어도 그 캐시는 미러와 다른 버전이다.
        # 그 원문으로 렌더하면 지문까지 맞는 틀린 미러가 생겨 `--check` 도 통과한다.
        fake = FakeNerv(tree_nodes(), raw_by_key())
        self.run_task(fake, "CLE-VISION")
        before = self.read("CLE-VISION.md")
        (self.cache / "CLE-VISION.md").write_bytes(md("CLE-VISION", type_="vision", body="stale\n"))
        fake.statuses = {"/api/projects/clemvion/specs/CLE-VISION.md": 304}
        fake.calls.clear()
        with self.assertRaisesRegex(pull.PullError, "304"):
            self.run_task(fake, "CLE-VISION")
        self.assertEqual(self.md_etags(fake), [None])
        self.assertEqual(self.read("CLE-VISION.md"), before)

    def test_malformed_tree_or_task_stops_with_a_reason(self):
        tree_path, task_path = "/api/v1/projects/clemvion/specs/tree", "/api/v1/projects/clemvion/tasks/"
        for name, bodies, keys in (
                ("트리가 JSON 아님", {tree_path: b"<html>"}, ["CLE-VISION"]),
                ("트리가 목록 아님", {tree_path: b'{"a": 1}'}, ["CLE-VISION"]),
                ("노드에 id 없음", {tree_path: b'[{"key": "CLE-VISION"}]'}, ["CLE-VISION"]),
                ("Task 가 객체 아님", {task_path: b"[]"}, [])):
            with self.subTest(name):
                fake = FakeNerv(tree_nodes(), raw_by_key(), bodies=bodies)
                with self.assertRaises(pull.PullError):
                    self.run_task(fake, *keys)
                self.assertEqual(pull.mirror_files(self.spec), [])

    def test_keys_are_checked_before_the_cache_is_read(self):
        # 트리에서 온 키로 캐시 경로를 만들기 전에 키 형식을 본다.
        tree = tree_nodes() + [{"id": "id-x", "key": "../victim", "type": "feature", "parent_id": None}]
        fake = FakeNerv(tree, raw_by_key())
        with mock.patch.object(pull, "_cached_raw", wraps=pull._cached_raw) as spy, \
                self.assertRaisesRegex(pull.PullError, "키 형식"):
            self.run_task(fake, "../victim")
        spy.assert_not_called()
        self.assertEqual(self.md_etags(fake), [])

    def test_bad_task_key_stops_before_any_request(self):
        fake = FakeNerv(tree_nodes(), raw_by_key())
        for task in ("../x", "CLE-T-X\n"):
            with self.subTest(task=task), self.assertRaisesRegex(pull.PullError, "Task"):
                quiet(pull.cmd_task, self.spec, task, [], nerv=fake, cache=self.cache)
        self.assertEqual(fake.calls, [])

    def test_corrupt_mirror_file_is_refetched(self):
        fake = FakeNerv(tree_nodes(), raw_by_key())
        self.run_task(fake, "CLE-VISION")
        (self.spec / "CLE-VISION.md").write_text("손상\n", encoding="utf-8")
        fake.calls.clear()
        self.run_task(fake, "CLE-VISION")
        self.assertEqual(self.md_etags(fake), [None])
        self.assertEqual(pull.check(self.spec), [])


class AllNetworkTest(_Fixture):
    def test_all_requests_the_approved_tree_export(self):
        fake = FakeNerv(tree_nodes(), raw_by_key(), export=make_zip())
        quiet(pull.cmd_all, self.spec, nerv=fake)
        self.assertEqual([p for p, _ in fake.calls],
                         ["/api/projects/clemvion/export.zip?basis=approved&layout=tree"])
        self.assertEqual(self.mirrored(), MIRRORED)

    def test_all_stops_on_an_error_response(self):
        fake = FakeNerv(tree_nodes(), raw_by_key(), statuses={"/api/projects/clemvion/export": 503})
        with self.assertRaisesRegex(pull.PullError, "503"):
            quiet(pull.cmd_all, self.spec, nerv=fake)

    def test_missing_environment_stops(self):
        with mock.patch.dict(os.environ, {"NERV_SERVER": "", "NERV_TOKEN": ""}), \
                self.assertRaisesRegex(pull.PullError, "NERV_SERVER"):
            quiet(pull.cmd_all, self.spec)


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
        patcher = mock.patch.dict(os.environ, {
            "PATH": f"{curl.parent}{os.pathsep}{os.environ['PATH']}",
            "FAKE_CURL_LOG": str(self.log),
            "FAKE_CURL_OUT": "HTTP/1.1 100 Continue\\r\\n\\r\\nHTTP/2 304\\r\\netag: x\\r\\n\\r\\n",
        })
        patcher.start()
        self.addCleanup(patcher.stop)

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def test_token_only_in_stdin_and_curl_reads_it_as_config(self):
        nerv = pull.Nerv("https://nerv.example.invalid", "clemvion", SECRET)
        url_path = "/api/projects/clemvion/specs/CLE-X.md?task=CLE-T-1"
        status, body = nerv.get(url_path, etag=VALID_ETAG)
        self.assertEqual((status, body), (304, b""))
        call = self.calls()[0]
        argv = call["argv"]
        self.assertNotIn(SECRET, " ".join(argv))
        self.assertIn(f'header = "Authorization: Bearer {SECRET}"', call["stdin"])
        self.assertIn(f'header = "If-None-Match: \\"{VALID_ETAG}\\""', call["stdin"])
        # stdin 에 토큰이 있어도 curl 이 그것을 설정으로 읽어야 헤더가 나간다(`-K -`).
        # 응답 헤더를 본문 앞에 받아야 status 를 읽는다(`-D -`).
        pairs = list(zip(argv, argv[1:]))
        self.assertIn(("-K", "-"), pairs)
        self.assertIn(("-D", "-"), pairs)
        self.assertIn(("--proto", "=https,http"), pairs)
        self.assertIn(("-A", pull.USER_AGENT), pairs)
        self.assertIn(("--max-time", pull.CURL_MAX_TIME), pairs)
        self.assertIn("-g", argv)  # URL 의 [] {} 를 글로브로 풀지 않는다
        self.assertEqual(argv[0], "-q")  # 첫 인자여야 ~/.curlrc 를 읽지 않는다(로그는 argv[1:])
        self.assertEqual(argv[-1], "https://nerv.example.invalid" + url_path)

    def test_max_time_is_configurable_and_validated(self):
        """push 리뷰 게이트(`review_guard`)가 이 클라이언트를 짧은 시간 제한으로 쓴다."""
        pull.Nerv("https://nerv.example.invalid", "clemvion", SECRET, max_time="15").get("/x")
        argv = self.calls()[0]["argv"]
        self.assertIn(("--max-time", "15"), list(zip(argv, argv[1:])))
        for bad in ("0", "-1", "1.5", "", "15\n", "١٥", 15.0):
            with self.subTest(bad=repr(bad)), self.assertRaises(pull.PullError):
                pull.Nerv("https://x.invalid", "clemvion", SECRET, max_time=bad)

    def test_curl_failure_raises(self):
        with mock.patch.dict(os.environ, {"FAKE_CURL_FAIL": "1"}), \
                self.assertRaisesRegex(pull.PullError, "curl 실패"):
            pull.Nerv("https://x.invalid", "clemvion", SECRET).get("/x")
        empty = self.tmp / "no-curl"
        empty.mkdir()
        with mock.patch.dict(os.environ, {"PATH": str(empty)}), \
                self.assertRaisesRegex(pull.PullError, "curl 을 실행하지 못했다"):
            pull.Nerv("https://x.invalid", "clemvion", SECRET).get("/x")

    def test_unparseable_responses_raise_pull_error(self):
        for raw in (b"no header end", b"HTTP/2\r\n\r\n", b"HTTP/2 abc\r\n\r\n"):
            with self.subTest(raw=raw), self.assertRaises(pull.PullError):
                pull.parse_response(raw)

    def test_config_injection_values_are_rejected(self):
        for ch in ('"', "\\", "\r", "\n", "\t", "\x00"):
            with self.subTest(ch=repr(ch)), self.assertRaises(pull.PullError):
                pull.Nerv("https://x.invalid", "clemvion", f"tok{ch}url")
        nerv = pull.Nerv("https://x.invalid", "clemvion", SECRET)
        for etag in ('sha256-x"\nurl = "https://evil.invalid', VALID_ETAG + "\n"):
            with self.subTest(etag=etag), self.assertRaises(pull.PullError):
                nerv.get("/x", etag=etag)
        self.assertFalse(self.log.exists(), "주입 값이 curl 에 닿았다")

    def test_server_must_be_https_or_loopback_http(self):
        for ok in ("https://nerv.example.invalid", "https://nerv.example.invalid:8443/base",
                   "http://127.0.0.1:8080", "http://localhost:3000", "http://[::1]:8000"):
            with self.subTest(ok=ok):
                self.assertTrue(pull.server_ok(ok))
                pull.Nerv(ok, "clemvion", SECRET)
        for bad in ("http://nerv.example.invalid", "http://localhost.evil.invalid",
                    "http://127.0.0.1.evil.invalid", "http://localhost@evil.invalid",
                    "http://127.0.0.1@evil.invalid", "http://localhostevil.invalid",
                    "https://user:pw@nerv.example.invalid", "https://nerv.example.invalid?x=1",
                    "https://:pw@nerv.example.invalid", "https://nerv.example.invalid#x",
                    "https://[::1", "https://nerv.example.invalid\n", "https://nerv .invalid",
                    "ftp://nerv.example.invalid", "nerv.example.invalid"):
            with self.subTest(bad=repr(bad)):
                self.assertFalse(pull.server_ok(bad))
                with self.assertRaises(pull.PullError):
                    pull.Nerv(bad, "clemvion", SECRET)

    def test_project_name_is_checked(self):
        for bad in ("clem vion", "../x", "[a]", "clemvion\n", ""):
            with self.subTest(bad=bad), self.assertRaises(pull.PullError):
                pull.Nerv("https://x.invalid", bad, SECRET)

    def test_parse_response_skips_informational_and_connect_blocks(self):
        raw = b"HTTP/1.1 100 Continue\r\n\r\nHTTP/2 200\r\ncontent-type: text/markdown\r\n\r\nbody\r\n\r\nmore"
        self.assertEqual(pull.parse_response(raw), (200, b"body\r\n\r\nmore"))
        proxied = b"HTTP/1.1 200 Connection established\r\n\r\nHTTP/2 404\r\n\r\nnope"
        self.assertEqual(pull.parse_response(proxied), (404, b"nope"))
        # `established` 가 없는 200 뒤의 `HTTP/` 는 본문이다.
        self.assertEqual(pull.parse_response(b"HTTP/2 200\r\n\r\nHTTP/ is body"),
                         (200, b"HTTP/ is body"))


class CiWiringTest(unittest.TestCase):
    """CI `spec-mirror-integrity` 가 이 도구의 `--check` 를 부른다. 잡이 빠지면 셸 편집을 못 잡는다."""

    WORKFLOW = _harness.REPO_ROOT / ".github" / "workflows" / "spec-link-checks.yml"

    def job(self):
        import yaml  # harness 테스트의 유일한 서드파티 예외(.claude/tests/README.md)

        return yaml.safe_load(self.WORKFLOW.read_text(encoding="utf-8"))["jobs"]["spec-mirror-integrity"]

    def sparse_paths(self):
        checkouts = [s for s in self.job()["steps"] if str(s.get("uses", "")).startswith("actions/checkout")]
        self.assertEqual(len(checkouts), 1, checkouts)
        return checkouts[0]["with"]["sparse-checkout"].split()

    def test_integrity_job_runs_the_check(self):
        job = self.job()
        runs = [s.get("run", "") for s in job["steps"]]
        self.assertIn("python3 .claude/tools/nerv-mirror/pull.py --check", runs)
        self.assertEqual(job.get("needs"), "changes")

    def test_the_check_runs_with_only_the_sparse_paths(self):
        # 잡은 저장소 일부만 받는다. `pull.py` 가 그 밖의 파일을 읽게 되면 CI 에서만 깨진다.
        self.assertEqual(sorted(self.sparse_paths()), [".claude/tools/nerv-mirror", "spec"])
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        for rel in self.sparse_paths():
            shutil.copytree(_harness.REPO_ROOT / rel, tmp / rel, symlinks=True,
                            ignore=shutil.ignore_patterns("__pycache__"))
        r = subprocess.run([sys.executable, str(tmp / ".claude/tools/nerv-mirror/pull.py"), "--check"],
                           capture_output=True, text=True, cwd=tmp)
        self.assertEqual(r.returncode, 0, r.stdout[-2000:] + r.stderr[-2000:])

    def test_the_repo_mirror_passes_its_own_check(self):
        # 커밋된 미러가 무결성 검사를 통과해야 CI 가 초록이다. `check` 는 미러 0편을 실패로 본다.
        self.assertEqual(pull.check(_harness.REPO_ROOT / "spec"), [])


class OrchestratorMirrorParityTest(unittest.TestCase):
    """consistency 오케스트레이터가 이 도구의 미러를 그대로 읽는지 본다(키 문법 · 미러 파일 · `type`).

    전환 단계 5(NERV Task `CLE-T-7M4C4X`)까지는 「미러 경로」 판정이 세 곳(이 도구 · 오케스트레이터 ·
    frontend `spec-links.ts`)에 있어 옛 트리와 미러를 가르는 판정의 동치도 여기서 봤다. 옛 트리를
    지우며 그 제외 판정(`is_nerv_mirror` · `inNervMirror`)과 동치 테스트를 걷었다. 남은 대조는 도구와
    오케스트레이터 사이의 것이다. 오케스트레이터는 서브프로세스에서 부른다. 같은 프로세스에서 읽으면
    그 모듈의 `_lib` 가 먼저 적재된 `.claude/hooks/_lib` 와 부딪혀 전체 실행에서만 ImportError 가
    난다(2026-10-01 실측).
    """

    ROOT = _harness.REPO_ROOT
    ORCH = ROOT / ".claude" / "skills" / "consistency-checker" / "scripts" / "consistency_orchestrator.py"

    def test_the_orchestrator_key_grammar_is_the_tool_grammar(self):
        """오케스트레이터는 미러 파일 이름과 본문 언급을 키 문법으로 가린다. 문법이 이 도구와 같아야 한다."""
        got = _harness.run_in_orchestrator(
            _harness.orchestrator_preamble(self.ORCH),
            "emit([orch._MIRROR_KEY_RE.pattern, orch._KEY_MENTION_RE.pattern])",
        )
        self.assertEqual(got[0], pull.KEY_RE.pattern)
        self.assertIn(pull.KEY_RE.pattern, got[1])

    def test_the_orchestrator_collects_the_tool_mirror_files(self):
        """대상 · 코퍼스로 읽는 미러 문서가 이 도구의 미러 파일과 같다(하위 폴더 · 경계 이름 포함)."""
        names = ["spec/CLE-A.md", "spec/CLE-A/CLE-A.md", "spec/CLE-A/CLE-A-B.md", "spec/CLE-A/CLE-A--C.md",
                 "spec/CLE-A/notes.md", "spec/CLE-A/.hidden.md", "spec/CLE-A/sub/CLE-Z.md",
                 "spec/CLE-A/cle-x.md", "spec/CLE-A-.md", "spec/CLE--A.md", "spec/CLE-B-/x.md",
                 "spec/README.md", "spec/0-overview.md", "spec/conventions/CLE-X.md"]
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        for rel in names:
            (tmp / rel).parent.mkdir(parents=True, exist_ok=True)
            (tmp / rel).write_text("x\n", encoding="utf-8")
        # 미러 이름의 심볼릭 링크는 도구가 쓰지 않는다(`--check` 가 알린다). 읽지도 않는다.
        (tmp / "outside.md").write_text("x\n", encoding="utf-8")
        (tmp / "spec" / "CLE-L.md").symlink_to(tmp / "outside.md")
        for root in (tmp, self.ROOT):
            with self.subTest(root=str(root)):
                tool = {p.relative_to(root).as_posix() for p in pull.mirror_files(root / "spec")}
                self.assertTrue(tool, "미러 파일이 없다 — 이 대조는 공허하다")
                got = _harness.run_in_orchestrator(
                    _harness.orchestrator_preamble(self.ORCH, imports="os"),
                    """
                    spec = os.path.join(ARG, "spec")
                    emit([os.path.relpath(p, ARG) for p in orch.collect_mirror_files(spec)])
                    """,
                    str(root),
                )
                self.assertEqual(set(got), tool)

    def test_the_orchestrator_reads_the_type_the_tool_wrote(self):
        """정식 규약 코퍼스는 frontmatter `type` 으로 가른다. 실제 미러에서 도구의 파서와 같은 값을 읽는다.

        fixture 작성기는 오케스트레이터 정규식이 읽는 모양으로 쓰므로 그 테스트만으로는 순환 검증이다."""
        spec = self.ROOT / "spec"
        files = pull.mirror_files(spec)
        expected = {}
        for p in files:
            lines, _ = pull.split_frontmatter(p.read_text(encoding="utf-8"))
            expected[p.relative_to(self.ROOT).as_posix()] = pull.fm_value(lines, "type") or ""
        self.assertIn("convention", expected.values(), "convention 문서가 없다 — 이 대조는 공허하다")
        got = _harness.run_in_orchestrator(
            _harness.orchestrator_preamble(self.ORCH, imports="os"),
            "emit({os.path.relpath(p, ARG['root']): orch.mirror_doc_type(p) for p in ARG['paths']})",
            {"root": str(self.ROOT), "paths": [str(p) for p in files]},
        )
        self.assertEqual(got, expected)

    def test_both_files_trigger_the_harness_workflow(self):
        # 경로 목록을 런타임과 같은 규칙으로 읽고(주석 줄 제외) 파일마다 걸리는 항목이 있는지 본다.
        # 단어로 쪼개 찾으면 주석에 적힌 경로도 통과한다.
        text = (self.ROOT / ".github" / "workflows" / "harness-checks.yml").read_text(encoding="utf-8")
        specs = parse_pathspecs_block(text)
        for path in (PULL_SRC, self.ORCH):
            rel = path.relative_to(self.ROOT).as_posix()
            with self.subTest(rel=rel):
                self.assertTrue(any(filter_covers_file(f, rel) for f in specs),
                                f"{rel} 만 고친 PR 에서 이 대조 테스트가 돌지 않는다")


if __name__ == "__main__":
    unittest.main()
