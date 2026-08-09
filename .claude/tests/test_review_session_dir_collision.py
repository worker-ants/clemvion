"""두 세션이 같은 초에 생기면 뒤가 앞을 덮어썼다.

세션 디렉터리 이름은 `<hh>_<mm>_<ss>` 초 해상도인데 `create_session_dir` 이
`exist_ok=True` 로 만들었다. 그래서 같은 초에 두 번 부르면 **같은 디렉터리**가
돌아오고, 두 번째 호출자가 첫 번째의 `meta.json`·프롬프트를 조용히 덮었다.

이건 가정이 아니다. 실측 2026-08-09, 74파일 changeset 의 `--prepare`:

- stderr 에 `--- Batch 1/2 (50 files) ---` / `--- Batch 2/2 (24 files) ---`
- stdout 은 **같은 세션 경로를 2번** 출력
- 새로 생긴 디렉터리는 **1개**, 그 `meta.json` 의 files 는 **24** (배치 2의 크기)
- 그 세션 프롬프트에 배치 1 파일은 **0회** 등장

배치 1의 50파일이 디스크에 흔적을 안 남겼고, 그래서 증상이 "한 커밋의 형제 파일이
일부만 리뷰된다" 로 보였다. 병렬 Claude 세션 두 개도 같은 방식으로 충돌한다.

`_harness` 의 fresh-interpreter 규약을 따르지 않는다 — 여기서 쓰는 것은
orchestrator 가 아니라 `lib/session.py` 이고, 그 모듈은 `_lib` 이름 충돌과 무관하다.
"""

from __future__ import annotations

import importlib.util
import os
import shutil
import tempfile
import unittest
from datetime import datetime
from unittest import mock

import _harness
from _harness import REPO_ROOT

SESSION_PY = (
    REPO_ROOT / ".claude" / "skills" / "code-review-agents" / "lib" / "session.py"
)


def _load_session_module():
    spec = importlib.util.spec_from_file_location("_cr_session", SESSION_PY)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SameSecondSessionsGetDistinctDirectoriesTest(unittest.TestCase):
    def setUp(self):
        self.session = _load_session_module()
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def _frozen(self, dt):
        """`datetime.now()` 를 고정한다 — 같은 초를 재현하려면 시계를 멈춰야 한다.

        실제 시계로 두 번 부르면 초가 넘어가 통과할 수 있고, 그러면 이 테스트는
        결함이 살아 있어도 초록이다.
        """
        clock = mock.MagicMock(wraps=datetime)
        clock.now.return_value = dt
        return mock.patch.object(self.session, "datetime", clock)

    def test_two_sessions_in_the_same_second_do_not_share_a_directory(self):
        with self._frozen(datetime(2026, 8, 9, 14, 3, 7)):
            first = self.session.create_session_dir(self.tmp)
            second = self.session.create_session_dir(self.tmp)
        self.assertNotEqual(first, second, "같은 초 두 세션이 한 디렉터리를 공유한다")
        self.assertTrue(os.path.isdir(first))
        self.assertTrue(os.path.isdir(second))

    def test_the_first_sessions_files_survive_the_second(self):
        """디렉터리 이름이 갈리는 것만으로는 부족하다 — 실제로 파일이 살아남아야 한다.

        원래 증상은 이름이 아니라 `meta.json` 이 덮인 것이었다.
        """
        with self._frozen(datetime(2026, 8, 9, 14, 3, 7)):
            first = self.session.create_session_dir(self.tmp)
            self.session.save_metadata(first, {"files": ["batch1.ts"] * 50})
            second = self.session.create_session_dir(self.tmp)
            self.session.save_metadata(second, {"files": ["batch2.ts"] * 24})

        import json
        with open(os.path.join(first, "meta.json"), encoding="utf-8") as fh:
            kept = json.load(fh)
        self.assertEqual(len(kept["files"]), 50, "배치 1의 meta.json 이 덮였다")

    def test_the_first_name_stays_plain(self):
        """접미사는 충돌한 쪽에만 붙는다 — 평소 경로 모양이 바뀌면 안 된다."""
        with self._frozen(datetime(2026, 8, 9, 14, 3, 7)):
            first = self.session.create_session_dir(self.tmp)
        self.assertTrue(
            first.endswith(os.path.join("2026", "08", "09", "14_03_07")), first
        )

    def test_a_third_session_gets_its_own_directory_too(self):
        """2개까지만 갈라지면 배치 3개짜리 changeset 에서 같은 결함이 재현된다."""
        with self._frozen(datetime(2026, 8, 9, 14, 3, 7)):
            dirs = [self.session.create_session_dir(self.tmp) for _ in range(3)]
        self.assertEqual(len(set(dirs)), 3, dirs)

    def test_the_subdir_form_collides_the_same_way(self):
        """consistency·merge orchestrator 는 `subdir` 를 넘긴다 — 그 경로도 같은 보장."""
        with self._frozen(datetime(2026, 8, 9, 14, 3, 7)):
            a = self.session.create_session_dir(self.tmp, subdir="consistency")
            b = self.session.create_session_dir(self.tmp, subdir="consistency")
        self.assertNotEqual(a, b)
        self.assertIn("consistency", a)


if __name__ == "__main__":
    unittest.main()
