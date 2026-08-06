"""Harness unit tests for scripts/check-e2e-playwright-config.py.

Exercises the e2e playwright/config drift guard's logic on synthetic repo
fixtures (stdlib-only, no install), plus a smoke assertion that the *real* repo
currently satisfies the invariant. The guard itself is wired into
`.github/workflows/e2e.yml` (config-guard job) as the primary enforcement.
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from _harness import REPO_ROOT, load_module_by_path

guard = load_module_by_path(
    "check_e2e_playwright_config",
    REPO_ROOT / "scripts" / "check-e2e-playwright-config.py",
)

# 유효(정합) fixture 기본값 — 각 테스트가 필요한 부분만 override 한다.
DEFAULT_PW_VERSION = "1.61.0"
DEFAULT_BASE_TAG = "v1.61.0-jammy"
DEFAULT_PKGS = ["expression-engine", "node-summary"]


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def make_repo(
    root: Path,
    *,
    pw_version: str = DEFAULT_PW_VERSION,
    base_tag: str = DEFAULT_BASE_TAG,
    frontend_workflow_pkgs=DEFAULT_PKGS,
    dockerfile_copy_pkgs=None,
    compose_mounts=None,
    packages_on_disk=None,
) -> None:
    """정합 fixture repo 를 만든다. *_pkgs 를 달리 주면 drift 를 주입한다."""
    dockerfile_copy_pkgs = (
        DEFAULT_PKGS if dockerfile_copy_pkgs is None else dockerfile_copy_pkgs
    )
    compose_mounts = (
        ["./codebase/frontend:/app/codebase/frontend"]
        if compose_mounts is None
        else compose_mounts
    )
    packages_on_disk = (
        DEFAULT_PKGS if packages_on_disk is None else packages_on_disk
    )

    # codebase/packages/<pkg>/package.json — name(@workflow/<pkg>) → dir 맵.
    for pkg in packages_on_disk:
        _write(
            root / "codebase" / "packages" / pkg / "package.json",
            json.dumps({"name": f"@workflow/{pkg}", "version": "0.1.0"}),
        )

    # codebase/frontend/package.json — @workflow/* 직접 의존.
    _write(
        root / "codebase" / "frontend" / "package.json",
        json.dumps(
            {
                "name": "frontend",
                "dependencies": {f"@workflow/{p}": "workspace:*" for p in frontend_workflow_pkgs},
                "devDependencies": {"@playwright/test": "^1.59.1"},
            }
        ),
    )

    # pnpm-lock.yaml — frontend importer 블록에 @playwright/test 해소 버전.
    other_importer = (
        "  codebase/backend:\n"
        "    dependencies:\n"
        "      '@playwright/test':\n"
        "        specifier: ^9.9.9\n"
        "        version: 9.9.9\n"  # frontend 블록 밖 값 — 오파싱 방지 검증용.
    )
    frontend_importer = (
        "  codebase/frontend:\n"
        "    devDependencies:\n"
        "      '@playwright/test':\n"
        "        specifier: ^1.59.1\n"
        f"        version: {pw_version}\n"
    )
    _write(
        root / "pnpm-lock.yaml",
        "lockfileVersion: '9.0'\n\nimporters:\n\n" + other_importer + frontend_importer,
    )

    # Dockerfile.playwright-e2e — base 태그 + COPY 소스.
    copy_lines = "\n".join(
        f"COPY codebase/packages/{p} ./codebase/packages/{p}" for p in dockerfile_copy_pkgs
    )
    manifest_lines = "\n".join(
        f"COPY codebase/packages/{p}/package.json ./codebase/packages/{p}/"
        for p in dockerfile_copy_pkgs
    )
    _write(
        root / "codebase" / "frontend" / "Dockerfile.playwright-e2e",
        f"FROM mcr.microsoft.com/playwright:{base_tag}\n"
        "WORKDIR /app\n"
        f"{manifest_lines}\n"
        f"{copy_lines}\n"
        'RUN pnpm install --frozen-lockfile --filter "frontend..."\n',
    )

    # docker-compose.e2e.yml — playwright-runner 의 bind-mount 입도.
    # 형제 서비스를 **뒤에** 둔다: 블록 추출이 EOF 까지 흘러가면 그 서비스의 마운트를
    # playwright-runner 것으로 오인하므로, 경계가 매 fixture 에서 실제로 행사된다.
    mount_lines = "\n".join(f"      - {m}" for m in compose_mounts)
    _write(
        root / "docker-compose.e2e.yml",
        "services:\n"
        "  playwright-runner:\n"
        "    volumes:\n"
        f"{mount_lines}\n"
        "      - /app/node_modules\n"
        "      - /app/codebase/frontend/node_modules\n"
        "  backend-e2e-runner:\n"
        "    volumes:\n"
        "      - ./codebase/backend:/app/codebase/backend\n",
    )


class RealRepoSmokeTest(unittest.TestCase):
    def test_real_repo_is_consistent(self):
        # 실제 repo 가 현재 정합인지 — 가드가 살아있는 invariant 임을 확인.
        self.assertEqual(guard.check(REPO_ROOT), [])


class ParserTest(unittest.TestCase):
    def test_frontend_playwright_version_reads_frontend_block_only(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root, pw_version="1.61.0")
            # backend importer 의 9.9.9 가 아니라 frontend 의 1.61.0 을 읽어야 한다.
            self.assertEqual(guard.frontend_playwright_version(root), "1.61.0")

    def test_base_tag_major_minor(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root, base_tag="v1.61.0-jammy")
            self.assertEqual(guard.base_tag_major_minor(root), (1, 61))

    def test_copy_dirs_excludes_manifest_only_copies(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root, dockerfile_copy_pkgs=["expression-engine", "node-summary"])
            # manifest(`.../package.json`) COPY 는 제외, 소스 COPY 만.
            self.assertEqual(
                guard.dockerfile_copy_dirs(root), {"expression-engine", "node-summary"}
            )

    def test_workflow_closure_maps_name_to_dir(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root, frontend_workflow_pkgs=["expression-engine", "node-summary"])
            closure, unmapped = guard.frontend_workflow_closure_dirs(root)
            self.assertEqual(closure, {"expression-engine", "node-summary"})
            self.assertEqual(unmapped, [])


class CheckTest(unittest.TestCase):
    def test_consistent_fixture_passes(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root)
            self.assertEqual(guard.check(root), [])

    def test_base_tag_mismatch_fails(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root, pw_version="1.61.0", base_tag="v1.60.0-jammy")
            failures = guard.check(root)
            self.assertTrue(any("base image tag mismatch" in f for f in failures))

    def test_patch_level_difference_still_passes(self):
        # major.minor 만 비교 — patch 차이는 통과해야 한다.
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root, pw_version="1.61.2", base_tag="v1.61.0-jammy")
            self.assertEqual(guard.check(root), [])

    def test_wholesale_codebase_mount_fails(self):
        """2026-08-06 회귀 그 자체 — `./codebase` 통마운트.

        이 형태가 CI 첫 실행에서 `Module not found: Can't resolve '@workflow/*'` 를 냈다.
        종전 가드는 패키지별 `node_modules` 마스킹 목록만 대조해서 이걸 **통과시켰다**.
        """
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root, compose_mounts=["./codebase:/app/codebase"])
            failures = guard.check(root)
            self.assertTrue(
                any("/app/codebase/packages" in f and "덮는다" in f for f in failures),
                f"통마운트는 반드시 잡혀야 한다; got {failures}",
            )

    def test_mounting_the_packages_dir_itself_fails(self):
        # 조상뿐 아니라 정확히 그 경로를 mount 해도 dist 는 똑같이 사라진다.
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(
                root,
                compose_mounts=[
                    "./codebase/frontend:/app/codebase/frontend",
                    "./codebase/packages:/app/codebase/packages",
                ],
            )
            self.assertTrue(
                any("/app/codebase/packages" in f for f in guard.check(root))
            )

    def test_frontend_subtree_mount_passes(self):
        # 올바른 입도(현행 저장소의 형태)는 통과해야 한다 — 가드가 vacuous 하지 않도록
        # 위 두 FAIL 케이스와 짝으로 고정한다.
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root)
            self.assertEqual(guard.check(root), [])

    def test_sibling_service_wholesale_mount_is_not_attributed(self):
        """다른 서비스의 통마운트는 playwright-runner 의 위반이 아니다.

        `backend-e2e-runner` 는 자기 subtree 를 정당하게 bind-mount 한다. 블록 스코프가
        없으면 문서 전체를 훑어 남의 줄을 위반으로 오인한다.
        """
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root)
            compose = root / "docker-compose.e2e.yml"
            compose.write_text(
                compose.read_text(encoding="utf-8")
                + "  legacy-runner:\n"
                "    volumes:\n"
                "      - ./codebase:/app/codebase\n",
                encoding="utf-8",
            )
            self.assertEqual(guard.check(root), [])

    def test_anonymous_volume_over_packages_is_not_flagged(self):
        """익명 볼륨은 이미지 내용으로 초기화되므로 dist 를 지우지 않는다.

        `- /app/...`(콜론 없음)은 호스트를 들여오지 않는다 — 이 구분을 못 하면 가드가
        정상 설정을 막는다(`/app/codebase/frontend/node_modules` 가 바로 그 형태다).
        """
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root)
            compose = root / "docker-compose.e2e.yml"
            compose.write_text(
                compose.read_text(encoding="utf-8").replace(
                    "      - /app/node_modules\n",
                    "      - /app/node_modules\n      - /app/codebase/packages\n",
                    1,
                ),
                encoding="utf-8",
            )
            self.assertEqual(guard.check(root), [])

    def test_missing_playwright_runner_block_fails(self):
        # 서비스명이 바뀌면 가드는 조용히 통과하는 게 아니라 실패해야 한다 —
        # "찾지 못함 = 검사할 것 없음 = OK" 는 fail-open 이다.
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root)
            compose = root / "docker-compose.e2e.yml"
            compose.write_text(
                compose.read_text(encoding="utf-8").replace(
                    "playwright-runner:", "pw-runner:", 1
                ),
                encoding="utf-8",
            )
            self.assertTrue(
                any("playwright-runner" in f for f in guard.check(root))
            )

    def test_dockerfile_copy_extra_pkg_fails(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(
                root,
                frontend_workflow_pkgs=["expression-engine"],
                dockerfile_copy_pkgs=["expression-engine", "node-summary"],  # 여분.
                packages_on_disk=["expression-engine", "node-summary"],
            )
            failures = guard.check(root)
            self.assertTrue(any("Dockerfile COPY set" in f for f in failures))

    def test_unmapped_workflow_dep_fails(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            # frontend 이 @workflow/ghost 를 의존하는데 codebase/packages 에 없음.
            make_repo(
                root,
                frontend_workflow_pkgs=["expression-engine", "ghost"],
                dockerfile_copy_pkgs=["expression-engine"],
                packages_on_disk=["expression-engine", "node-summary"],
            )
            failures = guard.check(root)
            self.assertTrue(any("not resolvable" in f and "ghost" in f for f in failures))


class AnchoringRegressionTest(unittest.TestCase):
    """정규식이 실제 지시문/리스트 항목에만 매치하고 주석 잔재는 무시하는지 (false-match 방지)."""

    def test_bind_mount_in_comment_is_not_counted(self):
        # 주석에 남은 통마운트 경로는 실제 마운트가 아니다 — 주석을 마운트로 오판하면
        # 정상 설정이 막힌다(false-positive).
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root)
            compose = root / "docker-compose.e2e.yml"
            compose.write_text(
                compose.read_text(encoding="utf-8").replace(
                    "  backend-e2e-runner:\n",
                    "      # was: - ./codebase:/app/codebase\n  backend-e2e-runner:\n",
                    1,
                ),
                encoding="utf-8",
            )
            self.assertEqual(guard.check(root), [])

    def test_bind_mount_with_inline_comment_still_counts(self):
        # 실제 리스트 항목 뒤 인라인 주석이 붙어도 위반은 위반이다 — 뒤 주석 때문에
        # 매치를 놓치면 오늘의 결함이 주석 한 줄로 되살아난다(false-negative).
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(
                root,
                compose_mounts=["./codebase:/app/codebase  # workspace 전체"],
            )
            self.assertTrue(
                any("/app/codebase/packages" in f for f in guard.check(root))
            )

    def test_read_only_flag_on_a_covering_mount_still_counts(self):
        # `:ro` 가 붙어도 이미지의 dist 는 똑같이 가려진다 — 옵션 접미사가 매치를 깨면 안 된다.
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root, compose_mounts=["./codebase:/app/codebase:ro"])
            self.assertTrue(
                any("/app/codebase/packages" in f for f in guard.check(root))
            )

    def test_base_tag_in_comment_before_from_is_ignored(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root, base_tag="v1.61.0-jammy")
            dockerfile = root / "codebase" / "frontend" / "Dockerfile.playwright-e2e"
            dockerfile.write_text(
                "# changelog: was FROM mcr.microsoft.com/playwright:v1.55.0-jammy, bumped later\n"
                + dockerfile.read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            # 실제 FROM(v1.61) 을 읽어야 하며 주석의 v1.55 가 아니다.
            self.assertEqual(guard.base_tag_major_minor(root), (1, 61))
            self.assertEqual(guard.check(root), [])

    def test_name_differs_from_dir_resolves_via_manifest_name(self):
        # dir 'legacy-dir' 의 package.json name 이 dir 슬러그와 다른 '@workflow/renamed' 여도
        # frontend 의존을 dir 로 정확히 해소해야 한다(pkgname_to_dir 존재 이유).
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root)
            _write(
                root / "codebase" / "packages" / "legacy-dir" / "package.json",
                json.dumps({"name": "@workflow/renamed", "version": "0.1.0"}),
            )
            _write(
                root / "codebase" / "frontend" / "package.json",
                json.dumps(
                    {
                        "name": "frontend",
                        "dependencies": {"@workflow/renamed": "workspace:*"},
                        "devDependencies": {"@playwright/test": "^1.59.1"},
                    }
                ),
            )
            closure, unmapped = guard.frontend_workflow_closure_dirs(root)
            self.assertEqual(closure, {"legacy-dir"})
            self.assertEqual(unmapped, [])


class DirectionalAndDefensiveTest(unittest.TestCase):
    def test_dockerfile_copy_missing_pkg_fails(self):
        # closure 에는 있는데 Dockerfile COPY 가 빠진 방향.
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(
                root,
                frontend_workflow_pkgs=["expression-engine", "node-summary"],
                dockerfile_copy_pkgs=["expression-engine"],  # node-summary COPY 누락.
            )
            failures = guard.check(root)
            self.assertTrue(
                any("Dockerfile COPY set" in f and "node-summary" in f for f in failures)
            )

    def test_missing_lockfile_reports_failure(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root)
            (root / "pnpm-lock.yaml").unlink()
            failures = guard.check(root)
            self.assertTrue(
                any("resolved version" in f for f in failures),
                f"missing lockfile must surface a failure; got {failures}",
            )

    def test_missing_dockerfile_reports_failure(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_repo(root)
            (root / "codebase" / "frontend" / "Dockerfile.playwright-e2e").unlink()
            failures = guard.check(root)
            self.assertTrue(
                any("base image tag" in f for f in failures),
                f"missing Dockerfile must surface a failure; got {failures}",
            )


if __name__ == "__main__":
    unittest.main()
