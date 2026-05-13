"""Summary-agent runner.

A summary template contains `{placeholder}` tokens that are replaced from a
`substitutions` dict. The rendered prompt is sent to `claude -p` and the
response is written to `<output_dir>/<filename>` (default `SUMMARY.md`).
"""

import os
import subprocess


def render_template(template, substitutions):
    """Replace every `{key}` in `template` with `substitutions[key]`.

    Unknown placeholders are left as-is so callers can detect template/key drift
    instead of silently producing empty content.
    """
    rendered = template
    for key, value in substitutions.items():
        rendered = rendered.replace("{" + key + "}", value)
    return rendered


def run_summary(template_path, substitutions, model, output_dir, timeout,
                filename="SUMMARY.md", log=None):
    """Render a summary template and run it through `claude -p`.

    Returns the summary text (str) or None on failure. The output is also persisted
    to `<output_dir>/<filename>`.
    """
    def _log(msg):
        if log:
            log(msg)

    try:
        with open(template_path, "r", encoding="utf-8") as f:
            template = f.read()
    except Exception as e:
        _log(f"Failed to read summary template {template_path}: {e}")
        return None

    prompt = render_template(template, substitutions)
    _log(f"run_summary: prompt_size={len(prompt)}")

    try:
        result = subprocess.run(
            ["claude", "-p", "--model", model],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = result.stdout.strip()
    except Exception as e:
        _log(f"Summary agent error: {e}")
        return None

    summary_file = os.path.join(output_dir, filename)
    try:
        with open(summary_file, "w", encoding="utf-8") as f:
            f.write(output)
    except Exception as e:
        _log(f"Failed to write summary file {summary_file}: {e}")

    return output
