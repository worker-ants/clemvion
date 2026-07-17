# 부작용(Side Effect) 리뷰

대상: `.claude/docs/subagent-call-contract.md`, `.claude/skills/code-review-agents/{SKILL.md,scripts/code_review_orchestrator.py}`, `.claude/skills/consistency-checker/{SKILL.md,scripts/consistency_orchestrator.py}`, `.claude/tests/{test_consistency_target_validation.py,test_orchestrator_state.py}`, `.claude/workflows/{ai-review.js,consistency-check.js}`, `plan/in-progress/harness-workflow-contract-fix.md` (commit range `12ceee587..6dac5f5e6`)

## 발견사항

- **[WARNING]** `--sync-from-disk` 크로스-스킬 호출 — 공유 계약이 코드가 아니라 산문(prose)에만 존재
  - 위치: `.claude/skills/consistency-checker/SKILL.md` (fallback 섹션, "⚠ 직접 fan-out 은 상태 기록 책임이 main 으로 넘어온다" 블록) → `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` `_sync_from_disk()` / `_verify_coverage()`
  - 상세: `consistency-checker/SKILL.md` 는 자기 세션 상태 동기화를 위해 **다른 스킬(code-review-agents)의 오케스트레이터 스크립트**를 직접 호출하도록 문서화한다:
    ```bash
    python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py \
      --sync-from-disk <session_dir>
    ```
    `--sync-from-disk`/`--verify-coverage` 는 `code_review_orchestrator.py` 에만 구현되어 있고 `consistency_orchestrator.py` 에는 해당 서브커맨드가 없다(grep 결과 0건). 현재는 두 오케스트레이터의 `_retry_state.json` 스키마(`agents_pending`/`agents_success`/`agents_fatal`/`subagent_invocations[].{name,output_file}`)가 우연히 호환되어 동작하지만, 이 재사용은 이미 존재하는 `lib/session.py` 류의 **python import 공유**(코드 레벨, 깨지면 `ImportError` 로 즉시 큰 소리로 실패)와 달리 **CLI 서브프로세스 호출을 prose 로만 규정**한 것이라 구조적 강제가 없다. `consistency_orchestrator.py`(`prepare_session`)의 상태 스키마가 향후 바뀌면 `--sync-from-disk` 는 (크래시 없이) `exit 0` 로 조용히 잘못된 동기화 결과를 낼 수 있고, 이를 잡아줄 테스트가 없다 — `.claude/tests/test_orchestrator_state.py` 의 `ORCH` 는 `code_review_orchestrator.py` 전용이며 consistency-checker 가 실제로 만드는 `_retry_state.json` 모양(예: `agents_forced` 부재, `summary_subagent_type`/`session_dir` 추가 키)을 기준으로 한 테스트는 없다.
  - 제안: `_sync_from_disk`/`_verify_coverage` 를 두 오케스트레이터가 이미 공유 중인 `lib/` 패키지로 승격하거나, `consistency_orchestrator.py` 에도 동일 서브커맨드를 얇게 구현/위임하고, consistency-checker 세션 모양을 기준으로 한 회귀 테스트를 추가할 것.

- **[WARNING]** 신규 테스트가 실제 저장소 `review/consistency/` 트리에 파일을 생성하며, cleanup 이 예외 안전(exception-safe)하지 않음
  - 위치: `.claude/tests/test_consistency_target_validation.py` — `_run()`(`cwd=str(REPO_ROOT)`) + `test_valid_target_still_prepares_a_session`
  - 상세: `_run()` 은 `cwd=str(REPO_ROOT)` 로 고정되어 있고, `test_valid_target_still_prepares_a_session` 은 `--spec` 모드로 실제 `prepare_session()` 경로를 그대로 태운다. `CONSISTENCY_OUTPUT_DIR` 를 오버라이드하지 않으므로 기본값 `./review/consistency` 가 `REPO_ROOT` 기준으로 적용된다 — 실제로 로컬에서 재현: 테스트 실행 시 워크트리의 `review/consistency/<Y>/<M>/<D>/<hh_mm_ss>/` 에 `_retry_state.json`·`meta.json`·`_prompts/*.md` 가 생성된다. `review/**/_prompts/` 만 gitignore 대상이고 `_retry_state.json`/`meta.json` 은 추적 대상이다. 정리 코드(`shutil.rmtree(session, ignore_errors=True)`)는 `self.assertEqual(r.returncode, 0, r.stderr)` 단언 **뒤**에 있고 `try/finally`(또는 `addCleanup`)로 감싸여 있지 않다 — 이 단언이 실패하면(향후 회귀 시) cleanup 이 전혀 실행되지 않아 생성된 파일이 실제 저장소에 추적 가능한 상태로 영구 잔류한다. 같은 스위트의 기존 관례(`test_consistency_impl_done.py` 는 격리된 fake git repo, `test_review_guard.py` 는 `tempfile.mkdtemp()`)는 모두 이 문제를 원천 차단하도록 cwd 를 격리하는데, 이 신규 테스트만 그 관례를 벗어나 `REPO_ROOT` 를 cwd 로 쓴다. (성공 경로 자체는 로컬 재현 결과 정상 정리됨 — 문제는 실패 경로.)
  - 제안: `env={"CONSISTENCY_OUTPUT_DIR": tmp, ...}` 로 세션 생성 위치를 임시 디렉토리로 돌리거나, 최소한 `shutil.rmtree` 호출을 `try/finally`/`addCleanup` 으로 감싸 단언 실패 시에도 정리가 보장되게 할 것.

- **[INFO]** Workflow 반환 계약(return shape) 변경 — 필드는 additive 이지만 `unfinished[]` 의미가 좁아짐
  - 위치: `.claude/workflows/ai-review.js`, `.claude/workflows/consistency-check.js` (반환 객체)
  - 상세: `reviewers[]`/`checkers[]` 항목에 `has_report` 서브필드가, 최상위에 `recovered[]`(공통)·`forced_missing[]`(ai-review 만) 이 새로 추가됐다 — 기존 필드 제거는 없어 순수 additive. 다만 `unfinished[]` 의 판정 기준이 바뀌었다: 이전엔 `status !== 'success'` 인 모든 항목이었으나 이제는 `!usable(r)`(파일도 본문도 전혀 없는 경우) 로 좁아진다. 즉 이전엔 "unfinished→재시도 대상"이던 `status=fatal` + 본문 있음 케이스가 이제는 `unfinished` 에서 빠지고 `recovered` 로만 나타난다. 두 SKILL.md(`§3`) 가 이 의미 변화를 명시적으로 문서화했고 실질 소비자가 main Claude(런타임 판단) 뿐이라 즉각적 breaking 위험은 낮다.
  - 제안: 별도 조치 불요 — 문서화 확인됨. 향후 이 반환값을 파싱하는 스크립트가 추가된다면 옛 "status 기준" 의미를 가정하지 않도록 주의.

- **[INFO]** summary sub-agent 가 자기 책임(SUMMARY 통합) 밖의 파일(다른 reviewer/checker 의 `output_file`)을 쓰도록 새로 위임됨
  - 위치: `.claude/workflows/ai-review.js` / `.claude/workflows/consistency-check.js` — `needPersist` 계산 + summary agent 프롬프트의 "1) 누락 파일 영속화" 지시
  - 상세: `needPersist = reviewers.filter(r => r.markdown)...` 는 **실제로 파일이 없는 reviewer 만이 아니라 markdown 을 반환한 모든 reviewer** 를 포함한다(스크립트는 FS 접근이 없어 "정말 없는지" 를 스스로 계산할 수 없음 — 주석에 명시된 제약). "없으면 Write" 라는 배타 조건은 summary sub-agent 의 자연어 지시 해석에만 의존하며 스크립트가 강제하지 않는다. 최악의 경우 summary agent 가 이미 정상적으로 자기 파일을 쓴 reviewer 에 대해서도 인라인 텍스트로 덮어쓸 수 있으나, 쓰는 내용이 같은 reviewer 자신의 반환 텍스트이므로(다른 reviewer 데이터의 교차 오염은 아님) 실질 blast radius 는 낮다. 이 설계는 plan 문서(`P0` 항목)에 의도된 것으로 기록되어 있다.
  - 제안: 별도 조치 불요(의도된 트레이드오프, 문서화됨) — 다만 향후 회귀 시 "정상적으로 쓰인 reviewer 파일이 실제로 덮어써지는지" 를 실측 확인해볼 가치는 있음.

- **[INFO]** 동일 결함 클래스가 `.claude/workflows/merge-coordinate.js` 에는 남아있음 (본 diff 범위 밖)
  - 위치: `.claude/workflows/merge-coordinate.js` (미변경)
  - 상세: `parseStatus` 기본값이 여전히 `'success'` 이고, summary agent 가 여전히 각 analyzer 의 `output_file` 을 디스크에서 Read 하는 옛 방식이다 — 이번 diff 가 고친 "STATUS 없음→가짜 success", "디스크 미기록 시 findings 유실" 결함 패턴이 merge-coordinate 경로엔 그대로 남아 있다. plan 은 스코프를 `ai-review`/`consistency-check` 로 명시했으므로 이번 PR 미포함은 합리적이나, 동일 계열 부작용(위험도 거짓 음성)이 잔존한다는 사실 자체는 side-effect 관점에서 기록해 둘 가치가 있다.
  - 제안: 후속 plan 항목으로 `merge-coordinate.js` 동일 fix 적용 검토 권장.

- **[INFO]** `.js` Workflow 스크립트의 신규 파싱/분류 로직(`parseAgentReturn`, `usable`, `forcedMissing`)에 대한 자동화 단위 테스트 부재
  - 위치: `.claude/workflows/ai-review.js`, `.claude/workflows/consistency-check.js`
  - 상세: Python 오케스트레이터 측은 이번 diff 로 14건의 신규 테스트를 얻었지만, 실제 STATUS/delimiter 파싱과 `unfinished`/`recovered`/`forced_missing` 분류가 일어나는 `.js` Workflow 스크립트 자체에는 단위 테스트가 없다(검증은 plan 문서에 기록된 수동 probe workflow 실행 2건뿐). 회귀 시 이번에 고친 "거짓 success" 부작용이 조용히 재도입될 수 있는 지점인데 CI 가 잡아줄 수 없다.
  - 제안: `DELIM` 파싱·`usable()`·`forcedMissing` 계산에 대한 순수 함수 단위 node 테스트 추가 검토(이번 diff 필수 요구사항은 아님).

## 요약

핵심 fix(STATUS 파싱 기본값 정정, findings 인라인 전달, `agents_forced` 강제 검증, 상태 파일 disk-sync, 대상 경로 검증)는 모두 명확한 목적을 가진 의도된 동작 변경이며, 함수/CLI 시그니처 변경은 새 옵션 플래그·인자 검증 추가로 기존 호출자에게 파괴적이지 않고(기존 플래그·동작 보존), Workflow 반환 계약도 필드 추가 위주로 하위 호환적이다. 예상치 못한 전역 상태·환경 변수·네트워크 호출은 발견되지 않았다. 다만 두 가지는 조치를 권장한다: (1) `consistency-checker` 가 `code-review-agents` 스크립트를 산문으로만 규정된 계약으로 직접 호출하는 크로스-스킬 결합이 테스트 없이 존재해 향후 스키마 drift 시 조용히 잘못된 결과를 낼 수 있고, (2) 신규 테스트 하나가 격리 관례를 벗어나 실제 저장소의 `review/consistency/` 트리에 파일을 생성하며 실패 경로에서 정리가 보장되지 않아 저장소에 추적 가능한 산출물을 남길 수 있다. 둘 다 현재 정상 동작 경로에서는 문제를 일으키지 않는 latent risk 다.

## 위험도

MEDIUM
