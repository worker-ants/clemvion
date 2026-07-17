# Testing Review — harness-workflow-contract (P0/P1a/P1b/P2)

## 발견사항

- **[CRITICAL]** `.claude/workflows/ai-review.js` · `.claude/workflows/consistency-check.js` 의 신규 파싱/집계 로직이 자동 테스트 0건 + CI 미연결
  - 위치: `.claude/workflows/ai-review.js:89-105`(`parseAgentReturn`), `:164-174`(`usable`/`recovered`/`unfinished`/`forcedMissing`) / `.claude/workflows/consistency-check.js:62-78`, `:113-121` (거의 동일 로직 중복)
  - 상세:
    1. 이 diff 의 P0(가장 핵심) 결함 — "BLOCK/위험도 판정이 거짓 음성이 되는" 버그 — 의 실제 수정 코드는 전부 이 두 JS 파일에 있다. 그런데 `.claude/tests/` 는 전량 Python(`unittest`)이고 리포에 JS 테스트 러너/설정이 전혀 없다(`find .claude -iname "*.test.js" -o -iname "*.spec.js"` → 0건, `package.json` 에 test 스크립트 없음). `.claude/docs/orchestrator-workflow-migration.md` 도 이 파일들을 "Smoke-tested end-to-end"/"smoke-tested live" 로만 기록 — 즉 검증 수단이 probe workflow 1회성 라이브 실행(`wf_61290a15-aec`, `wf_45d76e40-507`)뿐이고 재실행 가능한 회귀 테스트가 아니다.
    2. CI 도 연결돼 있지 않다: `.github/workflows/harness-checks.yml` 의 `paths:` 트리거에 `.claude/skills/**` 는 있지만 `.claude/workflows/**` 는 없다(직접 확인). 즉 이 두 파일만 단독으로 다시 깨져도 어떤 CI job 도 반응하지 않는다.
    3. 실측: 이 파일들은 독립 Node 스크립트로 실행 불가능하다 — 직접 확인:
       ```
       $ node .claude/workflows/ai-review.js
       SyntaxError: Illegal return statement
       ```
       (`export const meta` 때문에 ESM 으로 파싱되는데 top-level `return`/암묵 전역 `args`/`agent`/`parallel`/`phase`/`log` 는 하네스의 Workflow VM 내부에서만 유효하다.) 따라서 지금 구조 그대로는 `node --test` 로도 즉시 단위테스트할 수 없다 — 순수 로직(`parseAgentReturn` 등)을 별도 모듈로 뽑아내야 테스트 가능해진다.
    4. `parseAgentReturn` 은 두 파일에 **바이트 단위로 동일하게 복붙**돼 있다(주석만 다름). 테스트가 없으니 한쪽만 고치고 다른 쪽을 안 고쳐도 아무것도 잡아내지 못한다 — 정확히 이 PR 이 고치는 "BLOCK 거짓 음성" 버그와 같은 계열의 drift 위험을 스스로 재생산하는 구조.
    5. 이 함수는 실제로 여러 분기를 갖는 순수 함수라 유닛테스트 대상으로 적합하다: DELIM 유/무 × STATUS 유/무 × body 공백 4 조합, `STATUS=x` vs `STATUS: x`, salvage(`markdown = body || (m ? '' : raw.trim())`) 분기 등. 지금은 이 중 어느 것도 결정적으로 고정돼 있지 않다.
  - 제안: `parseAgentReturn` + `usable`/`recovered`/`unfinished`/`forcedMissing` 계산 로직을 `.claude/workflows/_lib/agent-return.mjs` 같은 `export function` 모듈로 추출해 두 워크플로가 import하도록 통합(중복 제거 겸 테스트 가능화)하고, Node 24(리포 `engines.node: ">=24"`)에 내장된 `node:test`(`node --test`) 로 `.claude/tests/` 와 대칭되는 위치에 의존성 0개짜리 단위테스트를 추가할 것을 권장. `harness-checks.yml` 의 `paths:` 에도 `.claude/workflows/**` 추가가 필요.

- **[WARNING]** `_sync_from_disk` 의 `agents_fatal` 재조정 로직이 테스트되지 않았고, 실측 결과 상호배타 불변식을 깬다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:202` (`state["agents_fatal"] = [n for n in state.get("agents_fatal", []) if n in missing]`) vs `:250-260`(`_apply_status_update` — "Move agent between pending/success/fatal buckets", 갱신 전 3버킷 모두에서 제거 후 정확히 하나에만 추가)
  - 상세: 신규 테스트 4건(`test_sync_from_disk_*`, `.claude/tests/test_orchestrator_state.py:1486-1538`) 은 전부 `_write_invocations` 헬퍼로 상태를 만드는데 이 헬퍼는 `"agents_fatal": []` 고정이라, **이전에 이미 `agents_fatal` 에 들어있던 agent 가 sync 이후에도 여전히 파일이 없는 경우**가 한 번도 실행되지 않는다. 직접 재현:
    ```python
    state = {"agents_fatal": ["security"], "subagent_invocations": [{"name": "security", ...}, {"name": "testing", "output_file": "<dir>/testing.md"}]}
    # testing.md 만 존재
    → --sync-from-disk 실행 후:
      agents_pending = ['security']
      agents_fatal   = ['security']   # 동일 agent 가 두 버킷에 동시 소속
    ```
    `_apply_status_update` 는 명시적으로 3버킷을 상호배타로 유지하는데(라인 253: `for bucket in (...): state[bucket].remove(agent)`), `_sync_from_disk` 는 `agents_pending`/`agents_success` 만 전체 재작성하고 `agents_fatal` 은 "missing 이면 유지"로 부분 필터링만 해서 겹침이 생긴다. `_emit_summary_state`(`--summary-state`, `/loop --resume` 이 참조하는 SoT)는 각 버킷 길이를 단순 합산·출력하므로 이 상태에서 pending/fatal 카운트가 중복 집계된다. 의도된 동작인지(예: "fatal 이었지만 sync 로 재시도 후보가 됨")인지 실수인지가 테스트로 문서화돼 있지 않다.
  - 제안: `agents_fatal` 이 미리 채워진 상태에서 sync 하는 케이스를 최소 1건 추가하고, 원하는 동작(예: sync 후 `agents_fatal` 은 항상 비우거나, `missing` 계산에서 기존 `agents_fatal` 멤버를 제외)을 코드와 테스트 양쪽에 확정할 것.

- **[WARNING]** `test_valid_target_still_prepares_a_session` 이 실제 리포 디렉토리에 세션을 만들고 cleanup 을 assertion 뒤에 배치 — 실패 시 잔여물 유출
  - 위치: `.claude/tests/test_consistency_target_validation.py:75-93`
  - 상세: `_run()` 이 `cwd=str(REPO_ROOT)` 로 실행되고 `CONSISTENCY_OUTPUT_DIR` 를 override 하지 않으므로, 이 테스트는 실제 `<repo>/review/consistency/<날짜>/<시간>/` 밑에 진짜 세션을 만든다. cleanup(`shutil.rmtree(session, ignore_errors=True)`, 89행)이 **두 개의 assertion 이후**(`assertEqual(returncode, 0, ...)`, `assertTrue(Path(session).is_dir(), ...)`)에 위치해, 둘 중 하나라도 실패하면 세션 디렉토리가 정리되지 않고 워킹트리에 남는다. 같은 파일이 다루는 `--impl-done` 회귀 테스트(`test_consistency_impl_done.py`)는 이미 `cwd=str(self.repo)`(임시 git repo) + `tearDown` 의 `self._tmp.cleanup()` 으로 완전 격리하는 선례가 있는데, 이 새 테스트만 그 패턴을 따르지 않았다. 현재는 두 assertion 이 항상 통과하므로 실사용 위험은 낮지만(git status 로 확인: 잔여물 없음), 이후 회귀(예: `--spec` 모드가 exit code 를 바꾸는 변경)가 생기면 조용히 리포를 오염시킬 수 있다.
  - 제안: `self.addCleanup(lambda: shutil.rmtree(..., ignore_errors=True))` 를 세션 경로 확보 직후(assertion 이전)에 등록하거나, `_run` 에 `env` 파라미터를 추가해 `CONSISTENCY_OUTPUT_DIR` 를 tempdir 로 돌리는 편이 기존 격리 컨벤션과 일관된다.

- **[INFO]** `parseAgentReturn` 의 STATUS 정규식이 라인 앵커 없이 첫 매치를 그대로 채택 — LLM 서두 문장 오탐 가능성이 테스트 부재로 미확인 상태
  - 위치: `.claude/workflows/ai-review.js:96` / `.claude/workflows/consistency-check.js:69` — `/STATUS\s*[=:]\s*([A-Za-z_]+)/.exec(header)` (`^`/`m` 플래그 없음)
  - 상세: 계약은 "첫 줄에 STATUS 헤더" 지만 정규식은 delimiter 이전 텍스트 어디서든 첫 매치를 잡는다. 만약 reviewer/checker 가 계약을 지키면서도 STATUS 줄 앞에 서두를 덧붙이고 그 서두에 우연히 `status:`/`STATUS=` 형태의 부분 문자열이 섞이면(LLM 산출물에서 드물지 않음), 실제 값과 다른 문자열을 `status` 로 채택해 `recovered[]`(계약 위반으로 오분류)·로그 메시지가 부정확해질 수 있다 — `markdown` 은 delimiter 기준으로 별도 추출되므로 finding 유실까지는 아니지만 진단/집계가 흐트러진다. CRITICAL 항목의 테스트 부재와 동일 원인이라 별도 항목으로만 기록.

- **[INFO]** `output_file` 누락 시 폴백 경로(`i.get("output_file") or os.path.join(sd, f"{i['name']}.md")`)가 `_sync_from_disk`/`_verify_coverage` 양쪽 모두 테스트되지 않음
  - 위치: `code_review_orchestrator.py:192`, `:232`
  - 상세: `test_orchestrator_state.py` 의 `_write_invocations` 헬퍼는 모든 invocation 에 `output_file` 을 항상 명시적으로 채운다. 실제 `--prepare` 산출물도 항상 `output_file` 을 채우므로(`:721`) 실사용 위험은 낮지만, 이 방어 코드 자체를 검증하는 테스트는 0건.

- **[INFO]** `agents_forced` 에 `subagent_invocations` 에 없는 이름(오타/stale 데이터)이 섞인 경우가 Python(`_verify_coverage`)·JS(`forcedMissing`) 양쪽 모두 미검증
  - 위치: `code_review_orchestrator.py:227-235`, `.claude/workflows/ai-review.js:170`
  - 상세: 현재 구현은 이런 이름을 "파일 없음 → missing" 으로 안전하게(fail-closed) 처리하는 것으로 보이나, 이 동작이 의도된 것인지 테스트로 고정돼 있지 않다. 우선순위는 낮음(안전한 방향의 기본값).

## 회귀/기존 테스트 확인 (실측)

- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` → **215 tests, OK** (plan 의 "하네스 215 OK" 주장과 일치, 회귀 없음).
- 신규 14건(`test_consistency_target_validation.py` 6건, `test_orchestrator_state.py` 신규 8건: sync-from-disk 4 + verify-coverage 4) 개별 실행도 전부 통과.
- 신규 Python 테스트는 실제 CLI 를 subprocess 로 구동(`test_orchestrator_state.py` 기존 컨벤션과 동일) — mock 없이 실 파일시스템/실 프로세스로 검증하는 방식은 이 하네스의 "git 관련 동작은 실제로 돌려서 검증" 컨벤션(README)과 부합하며 과도한 mocking 은 없음. `_require_target` 검증 실패 경로(`sys.exit(2)`)가 `collect_context()`(세션 디렉토리 생성 전)에서 발생함을 소스 순서로 확인 — 실패 케이스 테스트들은 부산물을 남기지 않는다(성공 케이스 1건만 예외, 위 WARNING 참조).
- CI 트리거(`.github/workflows/harness-checks.yml`) 확인: `.claude/skills/**`(Python 변경분 포함) 는 트리거되지만 `.claude/workflows/**`(JS 변경분) 는 트리거 경로에 없음 — 위 CRITICAL 항목의 근거.

## 요약

Python 쪽(`code_review_orchestrator.py`/`consistency_orchestrator.py` 의 `_sync_from_disk`/`_verify_coverage`/`_require_target`)은 신규 로직 각각에 대응하는 14건의 테스트가 실제 CLI 를 subprocess 로 구동하는 방식으로 추가됐고, 명명·격리·회귀(215 tests OK) 모두 양호하다 — 다만 edge-case 하나(`agents_fatal` 이 이미 채워진 상태에서 sync)는 커버되지 않았고, 직접 재현한 결과 pending/fatal 버킷이 동시에 채워지는 상호배타 위반이 실제로 발생한다. 반면 이 PR 의 실질적 핵심 수정(P0 — BLOCK 거짓 음성의 근본원인이던 STATUS/딜리미터 파싱과 `usable`/`recovered`/`forcedMissing` 집계 로직)은 `.claude/workflows/ai-review.js`·`consistency-check.js` 에 있는데, 이 두 파일은 자동 테스트가 전무하고 CI 트리거 경로에도 빠져 있으며, 직접 실행해보면 하네스의 Workflow VM 밖에서는 애초에 구동 자체가 안 되는 구조(top-level `return`)라 순수 로직을 추출하지 않는 한 지금 형태로는 유닛테스트가 불가능하다. 결과적으로 이번 PR 은 "안전 게이트가 조용히 약해지는" 바로 그 문제를 고치면서도, 고친 코드 자체에 대해서는 예전과 동일한 수준(라이브 probe 1회성 확인)의 회귀 방어만 남겨뒀다는 비대칭이 존재한다.

## 위험도

HIGH
