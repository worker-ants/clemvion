"""`--out` 문서를 쓰는 규칙 하나 — `nerv_review_payload.py` 와 `nerv_review_handoff.py pending` 이 같이 쓴다.

두 도구의 `--out` 문서는 기록 서브에이전트 `nerv-recorder` 의 입력이다. 그 에이전트는 파일의 `ok` 만 믿고
값을 고치지 않고 그대로 낸다(`nerv-recorder.md` 규칙 3 · 4). 그래서 이 파일이 낡으면 안 된다. 앞 실행이 남긴
`ok: true` 문서가 이번 실행이 실패한 뒤에도 그대로 있으면 기록 에이전트가 그 문서를 읽는다.

규칙은 하나다. **exit 2(인자 오류 · `begin` 의 거절)를 뺀 모든 종료에서 `--out` 경로에는 이번 실행의 결과만 남는다.**
이 규칙의 정본은 이 docstring 이다. 도구 docstring 과 SKILL 은 이 규칙을 되풀이하지 않고 여기를 가리킨다.

  - 인자를 검사한 뒤 시작할 때 앞 실행의 파일을 지운다(`begin`). 도구가 중간에 죽어도 낡은 문서가 남지 않는다.
    단 그 경로에 이미 있는 파일이 이 도구가 쓴 `--out` 문서(`version` 과 `ok` 가 있는 JSON 객체)가 아니면 지우지
    않고 거절한다. `--out` 을 입력 파일(`_dispositions.json` · 역할 리포트 등)이나 사용자 파일로 잘못 줘도 그 파일이
    실패한 실행에 사라지지 않는다. 이 도구의 문서인데 지우지 못하면(디렉터리 권한 등) 그것도 거절한다. 지우지 못하는
    디렉터리에는 `write` 도 못 쓰므로 그대로 두면 앞 실행의 `ok: true` 문서가 남는다.
  - 문서를 만들 수 없는 실패(NERV 읽기 실패 · 설정 누락 · 세션 없음 · kind 미정)도 `ok: false` 문서로 쓴다
    (`failure`). 기록 에이전트가 `ok` 를 보고 아무것도 부르지 않는다.
  - 파일은 임시 파일에 쓴 뒤 바꿔 넣는다(`write`). 쓰는 도중 끊겨도 반쯤 쓴 JSON 이 남지 않는다. `begin` 이 앞 파일을
    치운 뒤이므로 쓰기에 실패해도(`write_or_note`) 경로에는 아무것도 없다.
  - **exit 2 는 예외다.** 문서를 쓰지도 지우지도 않으므로 앞 실행의 파일이 그대로 남는다. 인자 오류는 `begin` 보다 먼저
    일어나고(`--out` 이 어느 파일인지 알려면 인자를 읽어야 한다) `begin` 의 거절도 파일을 건드리지 않는다
    (`begin_or_exit` 이 `ap.error` 로 끝낸다). 그래서 이 규칙이 지키는 것은 파일 하나가 아니라 **호출자 규칙과의 짝**이다.
    exit 가 0 일 때만 파일을 기록 에이전트에 넘기고, 0 이 아니면 부르지 않는다(`code-review-agents` SKILL §4 · §6).
    핸드오프 도구는 세션 디렉터리가 없을 때도 인자 오류로 끝난다.
"""

from __future__ import annotations

import json
import os

# `--out` 문서의 `version`. 수신 쪽(`nerv-recorder` 규칙 4)이 이 값을 검사한다. 두 도구의 입력 파일
# (`_nerv_findings.json` · `_dispositions.json`)은 따로 버전을 갖고 이 값과 상관이 없다.
VERSION = 1


def _is_out_document(path: str) -> bool:
    """`path` 의 파일이 이 도구가 쓴 `--out` 문서인가. 읽지 못하거나 JSON 객체가 아니거나 `version` · `ok` 가 없으면 아니다."""
    try:
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
    except (OSError, ValueError):  # 읽지 못한다 · JSON 이 아니다(UnicodeDecodeError 는 ValueError)
        return False
    return isinstance(doc, dict) and doc.get("version") == VERSION and isinstance(doc.get("ok"), bool)


def begin(path: str) -> str | None:
    """`--out` 을 쓰기 전에 앞 실행의 파일을 치운다. 거절할 이유가 있으면 지우지 않고 그 문장을 돌려준다(없으면 None).

    없는 경로는 그대로 둔다. 있는 경로가 이 도구의 `--out` 문서이면 지운다. 지우지 못하면(권한 등) 그 사유를 돌려준다.
    같은 이유로 `write` 도 실패하므로 모르는 척하면 앞 실행의 `ok: true` 문서가 남기 때문이다. 그 밖의 것(디렉터리 ·
    입력 파일 · 사용자 파일)은 건드리지 않는다. 호출자는 돌려받은 문장으로 `ap.error` 를 낸다(`begin_or_exit`).
    """
    if not os.path.lexists(path):
        return None
    if os.path.isdir(path) or not _is_out_document(path):
        return (f"--out {path} 에 이미 있는 것이 이 도구가 쓴 --out 문서가 아니다 — 지우지 않는다. "
                "다른 경로를 주거나 그 파일을 직접 치운다")
    try:
        os.unlink(path)
    except FileNotFoundError:  # 그 사이 누가 지웠다. 치우려던 일은 된 것이다
        pass
    except OSError as exc:
        return (f"--out {path} 의 앞 실행 파일을 지우지 못했다 — {exc.strerror or exc}. "
                "그대로 두면 기록 에이전트가 낡은 문서를 읽을 수 있어 실행하지 않는다. 권한을 고치거나 다른 경로를 준다")
    return None


def begin_or_exit(ap, path: str) -> None:
    """`begin` 하고 거절이면 `ap.error`(exit 2)로 끝낸다. 두 도구의 `main` 이 같은 두 줄을 쓰던 자리다."""
    refusal = begin(path)
    if refusal:
        ap.error(refusal)


def failure(errors: list[str], **fields) -> dict:
    """문서를 만들 수 없을 때 쓰는 `ok: false` 문서. `fields` 로 도구별 필수 키(빈 목록 등)를 채운다."""
    return {"version": VERSION, "ok": False, **fields, "errors": list(errors)}


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


def write_or_note(path: str, doc: dict) -> str | None:
    """`write` 하되 OSError 는 던지지 않고 알릴 문장으로 돌려준다(성공하면 None).

    문서를 못 썼으면 호출자는 그 문장을 요약의 `errors` 에 덧붙이고 `ok` 를 false 로 바꾸어 exit 1 로 끝낸다(`write_with_summary`).
    `begin` 이 앞 실행의 파일을 치운 다음에 부른다는 전제에서 경로에는 아무것도 남지 않는다. `begin` 은 못 지우면 거절해
    이 함수까지 오지 않는다. `begin` 없이 부르면 앞 파일이 남을 수 있다.
    """
    try:
        write(path, doc)
    except OSError as exc:
        return f"--out 을 쓰지 못했다 — {exc.strerror or exc}"
    return None


def write_with_summary(path: str, doc: dict, summary: dict) -> dict:
    """`write_or_note` 하고 stdout 에 낼 `summary` 를 돌려준다. 못 썼으면 `ok` 를 false 로 바꾸고 `errors` 끝에 사유를 덧붙인다.

    두 도구의 `--out` 이 요약과 문서를 함께 내는 절차다. `summary` 는 호출자가 문서에서 만든다(`errors` 키가 없어도 된다)."""
    note = write_or_note(path, doc)
    if not note:
        return summary
    return {**summary, "ok": False, "errors": [*summary.get("errors", []), note]}
