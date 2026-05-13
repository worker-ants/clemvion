"""Parallel agent execution via `claude -p`.

Generic over the kind of review being performed: callers supply
  - a list of agent names
  - a `prompt_for_agent(name) -> str | None` callable
  - a model + output_dir + timeout
and receive a list of result dicts. The runner has no knowledge of code review,
spec consistency, or any other domain — it just shells out to `claude -p` in parallel
and persists each agent's stdout to `<output_dir>/<agent>/review.md`.
"""

import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed


def run_single_agent(agent_name, prompt, model, output_dir, timeout, log=None):
    """Run a single agent via `claude -p` and save stdout to `<output_dir>/<agent>/review.md`.

    Returns a dict: {agent, status, elapsed, output}. status is one of
    "success" / "timeout" / "error".
    """
    start_time = time.time()
    agent_dir = os.path.join(output_dir, agent_name)
    os.makedirs(agent_dir, exist_ok=True)
    output_file = os.path.join(agent_dir, "review.md")

    def _log(msg):
        if log:
            log(msg)

    try:
        result = subprocess.run(
            ["claude", "-p", "--model", model],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        elapsed = time.time() - start_time
        output = result.stdout.strip()

        if result.returncode != 0:
            _log(f"Agent {agent_name} exited with code {result.returncode}: {result.stderr}")
            output = output or f"Error: agent exited with code {result.returncode}\n{result.stderr}"

        with open(output_file, "w", encoding="utf-8") as f:
            f.write(output)

        _log(f"Agent {agent_name} completed in {elapsed:.1f}s")
        return {"agent": agent_name, "status": "success", "elapsed": round(elapsed, 2), "output": output}

    except subprocess.TimeoutExpired:
        elapsed = time.time() - start_time
        _log(f"Agent {agent_name} timed out after {timeout}s")
        timeout_msg = f"Review timed out after {timeout} seconds."
        try:
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(timeout_msg)
        except Exception:
            pass
        return {"agent": agent_name, "status": "timeout", "elapsed": round(elapsed, 2), "output": timeout_msg}

    except Exception as e:
        elapsed = time.time() - start_time
        _log(f"Agent {agent_name} error: {e}")
        error_msg = f"Error: {e}"
        try:
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(error_msg)
        except Exception:
            pass
        return {"agent": agent_name, "status": "error", "elapsed": round(elapsed, 2), "output": error_msg}


def run_agents_parallel(agents, prompt_for_agent, model, output_dir, timeout, log=None):
    """Run `agents` in parallel via ThreadPoolExecutor.

    `prompt_for_agent(name)` must return the prompt string for an agent, or None
    to skip (which is recorded as an "error" status).
    """
    results = []
    if not agents:
        return results

    with ThreadPoolExecutor(max_workers=len(agents)) as executor:
        futures = {}
        for agent_name in agents:
            prompt = prompt_for_agent(agent_name)
            if prompt is None:
                results.append({
                    "agent": agent_name,
                    "status": "error",
                    "elapsed": 0,
                    "output": "Failed to load prompt template.",
                })
                continue

            future = executor.submit(
                run_single_agent, agent_name, prompt, model, output_dir, timeout, log,
            )
            futures[future] = agent_name

        for future in as_completed(futures):
            try:
                results.append(future.result())
            except Exception as e:
                agent_name = futures[future]
                if log:
                    log(f"Future error for {agent_name}: {e}")
                results.append({
                    "agent": agent_name,
                    "status": "error",
                    "elapsed": 0,
                    "output": f"Error: {e}",
                })

    return results
