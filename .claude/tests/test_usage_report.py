"""`.claude/tools/usage_report.py` — 세션 기록으로 하네스 비용을 재는 도구(NERV Task `CLE-T-ZTTHXD`).

개선 전후를 같은 잣대로 비교하려고 둔 도구라 숫자가 조용히 틀리면 비교가 무의미해진다. 그래서 실제
기록 모양을 흉내 낸 가짜 `~/.claude/projects` 트리로 다음을 고정한다.

  - 같은 세션이 두 폴더에 있으면 큰 파일 하나만 센다(워크트리를 옮긴 세션).
  - 한 API 응답이 내용 블록마다 여러 줄로 기록돼도 `message.id` 로 한 번만 센다.
  - 비용 가중치(캐시 읽기 0.1 · 1시간 캐시 쓰기 2 · 출력 5)와 모델 배수(Sonnet 0.6).
  - 서브에이전트 분류: `agentType` 과 Workflow 실행 기록의 `workflowName`.
  - 워크트리당 라운드 수와 `--since` 필터, 다른 저장소 폴더(접두만 같은 이름) 제외.
"""

from __future__ import annotations

import io
import json
import os
import shutil
import tempfile
import unittest
from contextlib import redirect_stdout

import _harness

TOOL_PATH = _harness.CLAUDE_DIR / "tools" / "usage_report.py"
tool = _harness.load_module_by_path("usage_report_under_test", TOOL_PATH)

PREFIX = "-repo-x"


def assistant(mid, model="claude-opus-5-5", ts="2026-10-01T00:00:10Z", **usage):
    base = {"input_tokens": 0, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
            "output_tokens": 0}
    base.update(usage)
    return {"type": "assistant", "timestamp": ts,
            "message": {"id": mid, "model": model, "usage": base, "content": []}}


def user(text, ts="2026-10-01T00:00:00Z"):
    return {"type": "user", "timestamp": ts, "message": {"role": "user", "content": text}}


def write_jsonl(path, records):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        for r in records:
            fh.write(json.dumps(r) + "\n")


class UsageReportTest(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="usage-report-")
        self.addCleanup(shutil.rmtree, self.root)
        main_dir = os.path.join(self.root, PREFIX)
        wt_dir = os.path.join(self.root, PREFIX + "--claude-worktrees-task-a")
        # 세션 s1: main 폴더에는 앞부분만, 워크트리 폴더에는 전체가 남았다.
        short = [user("hi"), assistant("m1", cache_read_input_tokens=100_000)]
        full = short + [
            # 같은 응답이 블록마다 두 줄로 기록된다.
            assistant("m2", cache_read_input_tokens=700_000, output_tokens=10, ts="2026-10-01T00:01:00Z"),
            assistant("m2", cache_read_input_tokens=700_000, output_tokens=10, ts="2026-10-01T00:01:00Z"),
            {"type": "system", "subtype": "compact_boundary", "timestamp": "2026-10-01T00:02:00Z"},
        ]
        write_jsonl(os.path.join(main_dir, "s1.jsonl"), short)
        write_jsonl(os.path.join(wt_dir, "s1.jsonl"), full)
        # Agent 서브에이전트(Sonnet, testing-reviewer)
        sub = os.path.join(wt_dir, "s1", "subagents", "agent-a1.jsonl")
        write_jsonl(sub, [user("review"), assistant(
            "a1", model="claude-sonnet-5", input_tokens=1000,
            cache_creation_input_tokens=1000,
            cache_creation={"ephemeral_1h_input_tokens": 1000, "ephemeral_5m_input_tokens": 0})])
        with open(sub[:-6] + ".meta.json", "w") as fh:
            json.dump({"agentType": "testing-reviewer"}, fh)
        # Workflow 서브에이전트 + 실행 기록
        write_jsonl(os.path.join(wt_dir, "s1", "subagents", "workflows", "wf_1", "agent-b1.jsonl"),
                    [user("prompt_file=x"), assistant("b1", model="claude-sonnet-5", output_tokens=100)])
        os.makedirs(os.path.join(wt_dir, "s1", "workflows"))
        for run, name, minutes, ts in (("wf_1", "consistency-check", 6, "2026-10-01T00:03:00Z"),
                                       ("wf_2", "ai-review", 10, "2026-10-01T00:04:00Z"),
                                       ("wf_3", "ai-review", 12, "2026-10-01T00:05:00Z")):
            with open(os.path.join(wt_dir, "s1", "workflows", run + ".json"), "w") as fh:
                json.dump({"runId": run, "workflowName": name, "durationMs": minutes * 60000,
                           "timestamp": ts,
                           "args": {"out": "/r/.claude/worktrees/task-a/.review/code/x"}}, fh)
        # 이전 날짜 세션과, 접두만 같은 다른 저장소 폴더
        write_jsonl(os.path.join(main_dir, "s0.jsonl"),
                    [user("old", ts="2026-09-01T00:00:00Z"),
                     assistant("o1", ts="2026-09-01T00:00:05Z", input_tokens=50)])
        write_jsonl(os.path.join(self.root, PREFIX + "other", "z.jsonl"),
                    [user("x"), assistant("z1", input_tokens=999_999)])

    def summary(self, **kw):
        return tool.summarize(tool.collect(self.root, PREFIX, **kw))

    def test_dedupes_sessions_and_messages(self):
        s = self.summary(since=tool.to_epoch("2026-09-15"))
        self.assertEqual(s["sessions"], 1)
        self.assertEqual(s["main"]["calls"], 2)
        self.assertEqual(s["main"]["max_context"], 700_000)
        self.assertEqual(s["main"]["avg_context"], 400_000)
        self.assertEqual(s["main"]["compactions"], 1)
        self.assertEqual(s["main"]["share_calls_ge_600k"], 50.0)

    def test_weights_and_model_factor(self):
        s = self.summary(since=tool.to_epoch("2026-09-15"))
        # 메인: (100k + 700k) × 0.1 + 10 × 5 = 80,050
        self.assertEqual(s["cost"]["main"], 80_050)
        # Sonnet 리뷰어: (1000 × 1 + 1000 × 2.0) × 0.6 = 1,800
        self.assertEqual(s["cost"]["code_review"], 1_800)
        # Workflow 에이전트는 실행 기록 이름으로 일관성: 100 × 5 × 0.6 = 300
        self.assertEqual(s["cost"]["consistency"], 300)
        self.assertEqual(s["agents"], {"code_review": 1, "consistency": 1, "resolution": 0,
                                       "explore": 0, "other": 0})

    def test_unknown_cache_split_counts_as_5m(self):
        usage = {"cache_creation_input_tokens": 400}
        self.assertEqual(tool.weighted_cost(usage, "claude-haiku-4-5"), 400 * 1.25 * 0.2)

    def test_rounds_per_worktree_and_durations(self):
        s = self.summary()
        self.assertEqual(s["rounds_per_worktree"]["code_review"],
                         {"worktrees": 1, "mean": 2.0, "median": 2, "max": 2})
        self.assertEqual(s["rounds_per_worktree"]["consistency"]["mean"], 1.0)
        self.assertEqual(s["workflows"]["code_review"]["median"], 11.0)

    def test_since_filter_and_prefix_boundary(self):
        everything = self.summary()
        self.assertEqual(everything["sessions"], 2)   # s0 + s1, 접두만 같은 폴더는 빠진다
        self.assertNotIn(999_999, [everything["main"]["max_context"]])
        only_old = self.summary(until=tool.to_epoch("2026-09-15"))
        self.assertEqual(only_old["sessions"], 1)
        self.assertEqual(only_old["cost"]["code_review"], 0)   # 걸러진 세션의 에이전트는 세지 않는다

    def test_cli_text_and_json(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = tool.main(["--projects-dir", self.root, "--prefix=" + PREFIX, "--json"])
        self.assertEqual(rc, 0)
        self.assertEqual(json.loads(buf.getvalue())["sessions"], 2)
        buf = io.StringIO()
        with redirect_stdout(buf):
            tool.main(["--projects-dir", self.root, "--prefix=" + PREFIX])
        self.assertIn("메인 세션 호출", buf.getvalue())
        self.assertEqual(tool.main(["--projects-dir", self.root, "--prefix=" + PREFIX,
                                    "--since", "10/01"]), 2)


if __name__ == "__main__":
    unittest.main()
