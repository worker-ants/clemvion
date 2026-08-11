"""`pnpm install` 은 5곳 있고, 다섯 곳이 같은 두 플래그를 달아야 한다.

한 곳만 짚으면 나머지로 그대로 새 나간다. **실제로 그렇게 됐다** —
`--strict-peer-dependencies` 를 도입하며 composite action 만 고치고 "한 줄이 전부를
덮는다" 고 적었는데, `pnpm install` 이 `.claude/test-stages.sh` 와 Dockerfile 3개에도
있었고 그중 3곳은 CI(e2e 이미지 빌드·TEST WORKFLOW)에서 돈다
(`review/code/2026/08/10/15_11_16` requirement CRITICAL).

**왜 이 가드가 이 형태인가.** 그 사고를 즉시 잡은 것은 `test_pnpm_workspace_action.py` 의
`InstallCommandTest` 였다 — action 의 install 줄을 argv 로 고정하고 있어 바꾸는 순간 RED 가
났다. 나머지 4곳에는 그런 것이 없어 아무도 알려주지 않았다.

런타임 추출(공통 헬퍼로 합치기)은 채택하지 않았다: 매체가 셋(composite action / bash /
Dockerfile)이고 실행 시점도 격리 경계도 다르다. 대신 **정적 대조**로 "다섯 곳이 일치한다"
만 고정한다 — `test_e2e_exemption_paths_sync.py` 가 workflow ↔ PROJECT.md 를 묶는 것과 같은
형태다.

두 테스트가 갈라져 있는 이유: 앞의 것은 **아는 곳**이 플래그를 달았는지, 뒤의 것은 **모르는
곳이 생겼는지**를 본다. 앞의 것만 있으면 목록 밖에 새 install 지점이 조용히 생기고, 그게
정확히 이번 CRITICAL 이 난 형태다.
"""

from __future__ import annotations

import subprocess
import unittest

from _harness import REPO_ROOT

#: (경로, 그 파일 안에서 `pnpm install` 실행 줄의 최소 개수)
SITES = (
    (".github/actions/pnpm-workspace/action.yml", 1),
    (".claude/test-stages.sh", 1),
    ("codebase/backend/Dockerfile", 1),
    ("codebase/frontend/Dockerfile", 1),
    ("codebase/frontend/Dockerfile.playwright-e2e", 1),
)

FLAGS = ("--frozen-lockfile", "--strict-peer-dependencies")


def install_lines(text):
    """`pnpm install` 이 실제로 **실행되는** 줄만 — 주석은 뺀다.

    이 저장소는 주석에서도 `pnpm install` 을 여러 번 인용한다(그 자체가 설명이다).
    거르지 않으면 주석만 고쳐도 초록이 되어 가드가 헛돈다.
    """
    out = []
    for raw in text.split("\n"):
        line = raw.strip()
        if line.startswith("#") or line.startswith("//"):
            continue
        if "pnpm install" in line:
            out.append(line)
    return out


class KnownSitesCarryBothFlagsTest(unittest.TestCase):
    def test_every_known_install_site_carries_both_flags(self):
        for rel, minimum in SITES:
            with self.subTest(site=rel):
                lines = install_lines((REPO_ROOT / rel).read_text(encoding="utf-8"))
                self.assertGreaterEqual(
                    len(lines), minimum,
                    f"{rel}: `pnpm install` 실행 줄을 못 찾았다 — 경로가 바뀌었거나 이 "
                    "목록이 stale 하다",
                )
                for line in lines:
                    for flag in FLAGS:
                        self.assertIn(
                            flag, line,
                            f"{rel}: `{flag}` 가 빠졌다 — 미충족 peer(또는 lockfile 드리프트)"
                            "가 이 경로로 조용히 통과한다",
                        )

    def test_the_comment_filter_is_not_vacuous(self):
        """주석 필터가 실행 줄까지 먹으면 위 테스트가 헛통과한다 — 그 전제를 고정한다."""
        sample = "\n".join([
            "# pnpm install --frozen-lockfile  (이건 주석이다)",
            'RUN pnpm install --frozen-lockfile --strict-peer-dependencies --filter "x"',
            "  // pnpm install 주석 2",
        ])
        lines = install_lines(sample)
        self.assertEqual(len(lines), 1, f"주석이 걸러지지 않았다: {lines}")
        self.assertTrue(lines[0].startswith("RUN "))


class TheSiteListHasNotGoneStaleTest(unittest.TestCase):
    """등재되지 않은 `pnpm install` 실행 지점이 생기면 알린다."""

    #: 실행 지점이 아닌 것 — 문서·테스트·리뷰 산출물·파이썬 가드.
    #:
    #: `.py` 를 빼는 근거는 "파이썬은 실행 안 할 것" 이 아니라 **매치 형태**다: 이 저장소의
    #: 파이썬 가드들은 `pnpm install …` 를 사용자에게 보여 줄 **문자열로** 인용한다
    #: (`check-override-floors.py`, `check-backend-typecheck-ratchet.py` 실측). 반대로
    #: 파이썬이 실제로 그 명령을 돌린다면 `subprocess.run(["pnpm", "install", …])` 형태이고,
    #: 그건 `"pnpm install"` 연속 문자열과 애초에 매치되지 않는다. 즉 이 제외는 커버리지를
    #: 버리는 게 아니라 **이 검색이 원래 못 보는 형태**를 명시하는 것이다.
    @staticmethod
    def _is_execution_site(path):
        return not (
            path.endswith(".md")
            or path.endswith(".py")
            or "/tests/" in path
            or "/__tests__/" in path
            or path.startswith("review/")
        )

    def setUp(self):
        """실행 지점을 한 번 찾아 둔다 — 두 테스트가 같은 탐색을 쓴다.

        `setUp` 이라 테스트마다 새로 돈다(클래스 캐시가 아니다). 둘은 같은 집합에 **다른
        질문**을 던진다: 하나는 "등재 안 된 것이 있나", 다른 하나는 "찾은 것이 등재 목록과
        같나"(비-vacuity). 탐색만 공유하고 질문은 갈라 둔다.

        `--untracked`: 기본 `git grep` 은 **추적되지 않은 파일을 아예 못 본다.** 새
        `pnpm install` 지점을 만들고 아직 `git add` 하지 않은 상태 — 정확히 사람이 실수하는
        시점 — 에 이 가드가 침묵한다(격리 저장소 실험으로 실측,
        `review/code/2026/08/10/15_41_41` side_effect WARNING). `.gitignore` 대상은 여전히
        제외되므로 `node_modules` 는 들어오지 않는다.
        """
        proc = subprocess.run(
            ["git", "grep", "-l", "--untracked", "pnpm install", "--",
             ".github", ".claude", "codebase", "Makefile", "scripts"],
            capture_output=True, text=True, cwd=str(REPO_ROOT),
        )
        self.found = {
            p for p in proc.stdout.split("\n")
            if p and self._is_execution_site(p)
            and install_lines((REPO_ROOT / p).read_text(encoding="utf-8", errors="replace"))
        }

    def test_no_unregistered_install_site_exists(self):
        found = self.found
        known = {rel for rel, _ in SITES}
        self.assertEqual(
            found - known, set(),
            "등재되지 않은 `pnpm install` 지점이 있다 — `SITES` 에 추가하고 두 플래그를 "
            "달았는지 확인할 것",
        )

    def test_the_search_actually_finds_the_known_sites(self):
        """비-vacuity: grep 이 아무것도 못 찾으면 위 테스트는 무조건 초록이다."""
        found = self.found
        self.assertEqual(
            found, {rel for rel, _ in SITES},
            "grep 이 찾은 실행 지점 집합이 등재 목록과 다르다 — 한쪽이 stale 하다",
        )


if __name__ == "__main__":
    unittest.main()
