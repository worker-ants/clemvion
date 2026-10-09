"""`--out` 문서를 쓰는 규칙 하나 — `nerv_review_payload.py` 와 `nerv_review_handoff.py pending` 이 같이 쓴다.

두 도구의 `--out` 문서는 기록 서브에이전트 `nerv-recorder` 의 입력이다. 그 에이전트는 파일의 `ok` 만 믿고
값을 고치지 않고 그대로 낸다(`nerv-recorder.md` 규칙 3 · 4). 그래서 이 파일이 낡으면 안 된다. 앞 실행이 남긴
`ok: true` 문서가 이번 실행이 실패한 뒤에도 그대로 있으면 기록 에이전트가 그 문서를 읽는다.

규칙은 하나다. **`--out` 을 받은 실행은 어떻게 끝나든 그 경로에 이번 실행의 결과만 남긴다.**

  - 시작할 때 앞 실행의 파일을 지운다(`clear`). 도구가 중간에 죽어도 낡은 문서가 남지 않는다.
  - 문서를 만들 수 없는 실패(NERV 읽기 실패 · 설정 누락 · 세션 없음 · kind 미정)도 `ok: false` 문서로 쓴다
    (`failure`). 기록 에이전트가 `ok` 를 보고 아무것도 부르지 않는다.
  - 파일은 임시 파일에 쓴 뒤 바꿔 넣는다(`write`). 쓰는 도중 끊겨도 반쯤 쓴 JSON 이 남지 않는다.
  - 인자 오류(argparse, exit 2)는 문서를 쓰지 않는다. 종료 코드가 0 이 아니면 기록 에이전트를 부르지 않는다
    (`code-review-agents` SKILL §4 · §6).
"""

from __future__ import annotations

import json
import os


def clear(path: str) -> None:
    """앞 실행이 남긴 `--out` 파일을 지운다. 없으면 그대로 둔다. 못 지우면(권한 등) 다음 `write` 가 덮는다."""
    try:
        os.unlink(path)
    except OSError:  # 없거나(FileNotFoundError) 지울 수 없다
        pass


def failure(errors: list[str], **fields) -> dict:
    """문서를 만들 수 없을 때 쓰는 `ok: false` 문서. `fields` 로 도구별 필수 키(빈 목록 등)를 채운다."""
    return {"version": 1, "ok": False, **fields, "errors": list(errors)}


def write(path: str, doc: dict) -> None:
    """`doc` 을 `path` 에 쓴다. 임시 파일에 쓴 뒤 바꿔 넣으므로 반쯤 쓴 문서가 남지 않는다. 실패하면 OSError."""
    tmp = f"{path}.tmp.{os.getpid()}"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=1)
            f.write("\n")
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
