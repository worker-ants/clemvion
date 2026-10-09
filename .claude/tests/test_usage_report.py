"""`.claude/tools/usage_report.py` — 세션 기록으로 하네스 비용을 재는 도구(NERV Task `CLE-T-ZTTHXD`).

개선 전후를 같은 잣대로 비교하려고 둔 도구라 숫자가 조용히 틀리면 비교가 무의미해진다. 그래서 실제
기록 모양을 흉내 낸 가짜 `~/.claude/projects` 트리로 다음을 고정한다.

  - 같은 세션이 두 폴더에 있으면 큰 파일 하나만 센다(워크트리를 옮긴 세션).
  - 한 API 응답이 내용 블록마다 여러 줄로 기록돼도 `message.id` 로 한 번만 센다.
  - 비용 가중치(캐시 읽기 0.1 · 1시간 캐시 쓰기 2 · 출력 5)와 모델 배수(Sonnet 0.6).
  - 서브에이전트 분류: `agentType` 과 Workflow 실행 기록의 `workflowName`.
  - 메인이 NERV 리뷰 기록 도구(제출 · 처분 · 발견 목록)를 부른 호출 수와 그 비용 비중.
  - 워크트리당 Workflow 호출 수와 `--since` 필터, 다른 저장소 폴더(접두만 같은 이름) 제외.
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
        self.assertEqual(s["main"]["share_calls_high_context"], 50.0)

    def test_weights_and_model_factor(self):
        s = self.summary(since=tool.to_epoch("2026-09-15"))
        # 메인: (100k + 700k) × 0.1 + 10 × 5 = 80,050
        self.assertEqual(s["cost"]["main"], 80_050)
        # Sonnet 리뷰어: (1000 × 1 + 1000 × 2.0) × 0.6 = 1,800
        self.assertEqual(s["cost"]["code_review"], 1_800)
        # Workflow 에이전트는 실행 기록 이름으로 일관성: 100 × 5 × 0.6 = 300
        self.assertEqual(s["cost"]["consistency"], 300)
        self.assertEqual(s["agents"], {"code_review": 1, "consistency": 1, "resolution": 0,
                                       "recording": 0, "explore": 0, "other": 0})

    def test_unknown_cache_split_counts_as_5m(self):
        usage = {"cache_creation_input_tokens": 400}
        self.assertEqual(tool.weighted_cost(usage, "claude-haiku-4-5"), 400 * 1.25 * 0.2)

    def test_runs_per_worktree_and_durations(self):
        s = self.summary()
        self.assertEqual(s["runs_per_worktree"]["code_review"],
                         {"worktrees": 1, "mean": 2.0, "median": 2, "max": 2})
        self.assertEqual(s["runs_per_worktree"]["consistency"]["mean"], 1.0)
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



def tool_use(mid, name, ts="2026-10-01T00:00:20Z", **usage):
    """도구를 부른 응답의 한 줄. 실제 기록은 내용 블록마다 줄이 나뉘고 같은 `message.id` 를 쓴다."""
    rec = assistant(mid, ts=ts, **usage)
    rec["message"]["content"] = [{"type": "tool_use", "id": "t-" + mid, "name": name, "input": {}}]
    return rec


class RecordingCallsTest(unittest.TestCase):
    """메인이 NERV 리뷰 기록 도구를 부른 호출(NERV Task `CLE-T-CD9131`, 개선안 R8 의 측정)."""

    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="usage-report-rec-")
        self.addCleanup(shutil.rmtree, self.root)
        self.d = os.path.join(self.root, PREFIX)

    def test_main_calls_that_use_nerv_review_tools_are_counted(self):
        text_then_tool = assistant("m2", cache_read_input_tokens=1000)
        text_then_tool["message"]["content"] = [{"type": "text", "text": "제출한다"}]
        write_jsonl(os.path.join(self.d, "s1.jsonl"), [
            user("x"),
            assistant("m1", input_tokens=100),
            # 첫 줄은 글, 같은 응답의 둘째 줄이 도구 호출이다. 비용은 첫 줄에서 한 번만 센다.
            text_then_tool, tool_use("m2", "mcp__nerv__nerv_review_submit", cache_read_input_tokens=1000),
            tool_use("m3", "mcp__plugin_nerv_nerv__nerv_finding_resolve", input_tokens=200),
            tool_use("m4", "mcp__nerv__nerv_finding_list", input_tokens=300),
            # 기록이 아닌 NERV 도구 · 이름만 비슷한 도구는 세지 않는다.
            tool_use("m5", "mcp__nerv__nerv_task_heartbeat", input_tokens=400),
            tool_use("m6", "Bash", input_tokens=500),
            tool_use("m7", "mcp__other__nerv_review_submit_draft", input_tokens=600),
        ])
        s = tool.summarize(tool.collect(self.root, PREFIX))
        self.assertEqual(s["main"]["calls"], 7)
        self.assertEqual(s["main"]["nerv_recording_calls"], 3)
        # 메인 비용 100 + 100 + 200 + 300 + 400 + 500 + 600 = 2,200 중 기록 호출 100 + 200 + 300 = 600
        self.assertEqual(s["main"]["nerv_recording_cost_share"], 27.3)

    def test_recorder_agent_calls_are_not_main_calls(self):
        write_jsonl(os.path.join(self.d, "s1.jsonl"), [user("x"), assistant("m1", input_tokens=10)])
        path = os.path.join(self.d, "s1", "subagents", "agent-r1.jsonl")
        write_jsonl(path, [user("x"), tool_use("r1", "mcp__nerv__nerv_review_submit", input_tokens=10)])
        with open(path[:-6] + ".meta.json", "w") as fh:
            json.dump({"agentType": "nerv-recorder"}, fh)
        s = tool.summarize(tool.collect(self.root, PREFIX))
        self.assertEqual(s["main"]["nerv_recording_calls"], 0)
        self.assertEqual(s["agents"]["recording"], 1)
        buf = io.StringIO()
        with redirect_stdout(buf):
            tool.main(["--projects-dir", self.root, "--prefix=" + PREFIX])
        self.assertIn("NERV 기록 호출 0번", buf.getvalue())
        self.assertIn("nerv-recorder", buf.getvalue())


class ClassificationAndBoundaryTest(unittest.TestCase):
    """분류 갈래 · 필터 · 경계값(코드 리뷰 발견 `01a11ffb-715c-726a-b31c-714d25a57809`)."""

    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="usage-report-cls-")
        self.addCleanup(shutil.rmtree, self.root)
        self.d = os.path.join(self.root, PREFIX)

    def agent(self, sid, name, agent_type, ts="2026-10-01T00:00:10Z", **usage):
        path = os.path.join(self.d, sid, "subagents", name + ".jsonl")
        write_jsonl(path, [user("x", ts=ts), assistant(name, ts=ts, model="claude-opus-5-5", **usage)])
        if agent_type is not None:
            with open(path[:-6] + ".meta.json", "w") as fh:
                json.dump({"agentType": agent_type}, fh)

    def test_every_agent_type_branch(self):
        write_jsonl(os.path.join(self.d, "s1.jsonl"), [user("x"), assistant("m", input_tokens=1)])
        for name, kind in (("a1", "resolution-applier"), ("a2", "Explore"), ("a3", "general-purpose"),
                           ("a4", "cross-spec-checker"), ("a5", "consistency-summary"),
                           ("a6", "review-router"), ("a7", "mystery-agent"), ("a8", None),
                           ("a9", "nerv-recorder")):
            self.agent("s1", name, kind, input_tokens=10)
        s = tool.summarize(tool.collect(self.root, PREFIX))
        self.assertEqual(s["agents"], {"code_review": 1, "consistency": 2, "resolution": 1,
                                       "recording": 1, "explore": 2, "other": 2})
        self.assertEqual(s["cost"]["explore"], 20)

    def test_filtered_session_drops_its_workflow_agents_too(self):
        write_jsonl(os.path.join(self.d, "old.jsonl"),
                    [user("x", ts="2026-09-01T00:00:00Z"), assistant("o", ts="2026-09-01T00:00:01Z", input_tokens=1)])
        write_jsonl(os.path.join(self.d, "old", "subagents", "workflows", "wf_9", "agent-c.jsonl"),
                    [user("x"), assistant("c", model="claude-opus-5-5", output_tokens=100)])
        os.makedirs(os.path.join(self.d, "old", "workflows"))
        with open(os.path.join(self.d, "old", "workflows", "wf_9.json"), "w") as fh:
            json.dump({"runId": "wf_9", "workflowName": "consistency-check", "timestamp": "2026-09-01T00:00:02Z"}, fh)
        self.assertEqual(tool.summarize(tool.collect(self.root, PREFIX))["cost"]["consistency"], 500)
        newer = tool.summarize(tool.collect(self.root, PREFIX, since=tool.to_epoch("2026-09-15")))
        self.assertEqual(newer["cost"]["consistency"], 0)

    def test_bucket_and_window_boundaries(self):
        self.assertEqual(tool.bucket_of(199_999), "<200k")
        self.assertEqual(tool.bucket_of(200_000), "200-400k")
        self.assertEqual(tool.bucket_of(10**7), ">=800k")
        day = tool.to_epoch("2026-10-01")
        self.assertTrue(tool.in_window(day, day, None))
        self.assertFalse(tool.in_window(day, None, day))
        self.assertFalse(tool.in_window(None, day, None))
        self.assertTrue(tool.in_window(None, None, None))

    def test_long_sessions_and_high_context_share(self):
        many = [user("x")] + [assistant(f"m{i}", cache_read_input_tokens=tool.HIGH_CONTEXT_TOKENS)
                              for i in range(tool.LONG_SESSION_CALLS + 1)]
        write_jsonl(os.path.join(self.d, "long.jsonl"), many)
        write_jsonl(os.path.join(self.d, "short.jsonl"),
                    [user("x"), assistant("z", cache_read_input_tokens=tool.HIGH_CONTEXT_TOKENS - 1)])
        main = tool.summarize(tool.collect(self.root, PREFIX))["main"]
        self.assertEqual(main["long_sessions"], 1)
        self.assertGreater(main["cost_share_of_long_sessions"], 99.0)
        self.assertLess(main["cost_share_of_long_sessions"], 100.0)
        self.assertEqual(main["share_calls_high_context"],
                         round(100 * (tool.LONG_SESSION_CALLS + 1) / (tool.LONG_SESSION_CALLS + 2), 1))

    def test_session_without_api_calls_is_not_counted(self):
        write_jsonl(os.path.join(self.d, "busy.jsonl"), [user("x"), assistant("b", input_tokens=1)])
        write_jsonl(os.path.join(self.d, "idle.jsonl"), [user("only a prompt")])
        self.assertEqual(tool.summarize(tool.collect(self.root, PREFIX))["sessions"], 1)

    def test_unknown_model_and_non_object_lines(self):
        self.assertEqual(tool.model_factor("some-new-model"), 1.0)
        path = os.path.join(self.d, "odd.jsonl")
        os.makedirs(self.d, exist_ok=True)
        with open(path, "w") as fh:
            fh.write("[]\n\"text\"\nnot json\n" + json.dumps(assistant("q", input_tokens=7)) + "\n")
        self.assertEqual(tool.scan_transcript(path)["calls"], 1)


if __name__ == "__main__":
    unittest.main()
