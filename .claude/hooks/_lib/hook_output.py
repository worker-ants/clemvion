"""PreToolUse hook → model: the one stdout shape Claude Code delivers on exit 0.

A PreToolUse hook that ALLOWS the call (exit 0) cannot reach the model with
plain stdout. The hooks reference (https://code.claude.com/docs/en/hooks, "Exit
code 0") says that for most events Claude Code writes stdout to the debug log;
only UserPromptSubmit, UserPromptExpansion, SessionStart and PostModelSwitch add
plain-text stdout as context. PreToolUse is not among them. The supported route
is `hookSpecificOutput.additionalContext`, which Claude Code wraps in a system
reminder and puts next to the tool result.

Measured on Claude Code 2.1.296 with a throwaway `claude -p` session that loaded
only probe hooks (NERV Task `CLE-T-QBNJ81`). Each hook printed a random token:

  - plain stdout, exit 0                     → not seen; debug log only
  - this envelope, from two separate hooks   → both seen
  - two envelopes from ONE process           → neither seen ("looks like a JSON
                                               object but is not valid JSON")
  - `systemMessage`                          → shown to the user, not the model
  - this envelope on a command that needs
    approval                                 → still denied; context still seen

Three rules follow, and every caller depends on them:

  1. **One object per process.** A hook with several things to say joins them
     and calls `emit_context` once. Separate hooks need no coordination:
     Claude Code delivers every hook's `additionalContext`.
  2. **No `permissionDecision`.** `"allow"` would skip the permission prompt,
     which turns a guard into an approver. Leaving the decision out keeps the
     normal permission flow (the last row above).
  3. **Exit 2 is unchanged.** A blocking hook still writes its reason to stderr,
     which Claude reads as the refusal. This module is for the allow path only.

The text should state facts, not issue out-of-band commands. The docs warn that
text framed as system instructions can trip Claude's prompt-injection defenses,
and Claude Code adds the `<system-reminder>` wrapper itself, so callers do not.

UserPromptSubmit hooks (`guard_default_branch_prompt.py`) keep plain stdout:
that event is one of the four that inject it. That part comes from the docs
alone; the probe above did not run a UserPromptSubmit hook.

To repeat the measurement (after a Claude Code upgrade that touches hooks, or
when a test here disagrees with what the model sees): point a throwaway
`claude -p` session at a settings file whose only PreToolUse hooks print a
random token in each shape above, ask it to run one Bash command, and ask it to
quote every token it can see. The Task body keeps the script and the results.
"""

from __future__ import annotations

import json
import sys

PRE_TOOL_USE = "PreToolUse"


def context_json(text: str, *, event: str = PRE_TOOL_USE, ascii_only: bool = False) -> str:
    """The envelope that delivers `text` to the model. No decision.

    `event` is the hook event name. Only PreToolUse has been measured.

    By default `ensure_ascii=False` keeps Korean and emoji readable in the debug
    log. `ascii_only=True` escapes every non-ASCII character; `emit_context`
    uses it when the stream cannot encode the readable form.

    `json.dumps` escapes `\n` and `\r`, so the result holds neither and starts
    with `{` and ends with `}`, which is what Claude Code parses as JSON.
    Without `ascii_only`, U+2028 and U+2029 stay raw: `str.splitlines()` splits
    on them, a byte-level line reader does not.
    """
    return json.dumps(
        {"hookSpecificOutput": {"hookEventName": event, "additionalContext": text}},
        ensure_ascii=ascii_only,
    )


def emit_context(text: str, *, event: str = PRE_TOOL_USE, stream=None) -> bool:
    """Print the envelope for `text` unless it is blank. Returns whether it printed.

    Call at most once per process (rule 1 above). Blank text prints nothing, so
    a silent hook stays byte-for-byte silent. `stream` defaults to `sys.stdout`.

    A stream that cannot encode the text gets the ASCII-escaped envelope
    instead: a stdout whose encoding is not UTF-8, or a lone surrogate that
    reached the text from a `surrogateescape`-decoded git message. Without that
    retry the encode error would drop the only route to the model. The encode
    fails before anything is written, so the retry still prints one object.
    """
    text = text.strip("\n")
    if not text.strip():
        return False
    out = stream if stream is not None else sys.stdout
    try:
        print(context_json(text, event=event), file=out)
    except UnicodeEncodeError:
        print(context_json(text, event=event, ascii_only=True), file=out)
    return True
