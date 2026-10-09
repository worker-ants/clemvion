#!/usr/bin/env python3
"""PreToolUse:Bash 디스패처 — Bash 훅 셋을 한 Python 프로세스에서 차례로 돌린다(NERV Task `CLE-T-ZTTHXD`).

예전에는 `.claude/settings.json` 이 훅 셋을 따로 등록해 Bash 를 부를 때마다 Python 이 세 번 떴다.
2026-10-09 실측으로 따로 돌리면 약 119ms, 이 디스패처로는 약 66ms 다. 세션 기록상 3개월 동안 Bash 를
약 2만 5천 번 불렀다.

훅 파일은 그대로 두고 각 훅의 `main()` 을 부른다. 그래서 훅 하나를 따로 실행해도 지금처럼 동작한다.

  - 입력: Claude Code 가 준 stdin 을 한 번 읽어 훅마다 같은 내용을 `sys.stdin` 으로 다시 준다.
  - 순서: `HOOKS` 순서. 앞 훅의 결과와 상관없이 셋 다 돈다(따로 등록했을 때도 셋 다 돌았다).
  - 종료 코드: 어느 훅이든 2(차단)를 내면 2. 아니면 처음 나온 0 아닌 코드(차단하지 않는 오류).
    모두 0 이면 0.
  - 실패: 훅을 불러오거나 실행하다 예외가 나면 그 훅만 실패(코드 1)로 치고 stderr 에 남긴 뒤 다음
    훅으로 간다. 각 훅이 스스로 정한 fail-open 과 같은 방향이다. 훅이 모듈 수준에서 `sys.exit(n)` 을
    부르면(가져오기 실패를 흡수하는 훅이 있다) 그 n 을 결과로 쓴다.

등록(`.claude/settings.json`)은 이 파일이 `$CLAUDE_PROJECT_DIR` 에 없으면 예전처럼 훅 셋을 따로 돈다.
설정은 워크트리에서 읽고 훅 파일은 main 체크아웃에서 찾기 때문에, 이 파일이 main 에 머지되기 전의
세션에서도 push 게이트가 꺼지지 않게 하려는 것이다. 대비 경로의 훅 목록과 `HOOKS` 가 같은지는
`test_pretooluse_bash_dispatcher.py` 가 확인한다.
"""

from __future__ import annotations

import importlib.util
import io
import sys
import traceback
from pathlib import Path

HOOKS = ("guard_default_branch_bash", "normalize_worktree_branch", "guard_review_before_push")


def run_hook(path: Path, raw: str) -> int:
    saved_stdin = sys.stdin
    sys.stdin = io.StringIO(raw)
    try:
        spec = importlib.util.spec_from_file_location(f"_pretooluse_bash_{path.stem}", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        code = module.main()
        return code if isinstance(code, int) else 0
    except SystemExit as exc:
        return exc.code if isinstance(exc.code, int) else (0 if exc.code is None else 1)
    except Exception:
        print(f"[pretooluse_bash] {path.name} 실행 실패 — 이 훅만 건너뛴다", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return 1
    finally:
        sys.stdin = saved_stdin


def dispatch(raw: str, hooks_dir: Path, names=HOOKS) -> int:
    codes = [run_hook(hooks_dir / f"{name}.py", raw) for name in names]
    if 2 in codes:
        return 2
    return next((c for c in codes if c), 0)


def main() -> int:
    return dispatch(sys.stdin.read(), Path(__file__).resolve().parent)


if __name__ == "__main__":
    sys.exit(main())
