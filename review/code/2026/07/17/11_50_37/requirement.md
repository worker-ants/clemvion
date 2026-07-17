# Requirement Review — harness-workflow-contract-fix (P0·P1·P2)

## 발견사항

### [CRITICAL] P0 fix가 3개 fan-out 파이프라인 중 2개에만 적용됨 — `merge-coordinate.js`가 동일한 BLOCK 거짓 음성 결함을 그대로 보유

- 위치: `.claude/workflows/merge-coordinate.js` (본 diff에 미포함, 미변경), `.claude/agents/integration-risk-summary.md` (미변경), `.claude/skills/merge-coordinator/SKILL.md:63` (미변경)
- 상세:
  plan(`plan/in-progress/harness-workflow-contract-fix.md`)의 P0 절은 근본원인을 "하네스가 sub-agent report file Write를 차단 → checker가 Write를 건너뛰고 텍스트만 반환 → 스크립트가 `parseStatus` 기본값 `'success'`로 오판 → summary가 `output_file`을 Read해 통합 → 파일 없으면 해당 agent의 `[CRITICAL]`이 BLOCK 계산에서 누락"이라는 **공통 결함 사슬**로 규정하고, "방향(사용자 결정)"에서 "`.claude/workflows/*.js` 만 고친다"고 명시한다. 그러나 실제로 고쳐진 파일은 `ai-review.js`·`consistency-check.js` 2개뿐이고, 동일 glob에 속하는 세 번째 파일 `merge-coordinate.js`는 이번 diff에 전혀 포함되지 않았다. 직접 읽어 확인한 결과 정확히 같은 결함이 모두 남아 있다:
  - `parseStatus`가 여전히 `return m ? m[1] : 'success'` (line 56) — STATUS 줄이 없으면 성공으로 오판하는, 이 PR이 다른 두 파일에서 명시적으로 제거한 바로 그 버그.
  - analyzer가 반환한 텍스트(`text`)를 그대로 버리고 `{name, status}`만 남긴다 (line 66) — inline 살리기(recovered) 로직 없음.
  - summary agent 프롬프트가 여전히 "success/fatal 인 각 analyzer 의 output_file 을 Read 해 통합하세요" (line 106) — 디스크 의존 제거 이전 상태.
  - Summary phase 주석(line 78-81)이 이 PR이 "정반대로 틀렸다"고 명시적으로 정정한 바로 그 "terminal-write guard" 서술("parallel analyzers — non-terminal — write fine, the terminal summary write is refused")을 그대로 갖고 있다. `ai-review.js`의 새 주석(line 79-81)은 "The comments below the Summary phase used to claim the opposite"라고 적어 이 오류를 인지하고 있으면서도 `merge-coordinate.js`는 손대지 않았다.
  - `has_report`/`recovered`/`forced_missing` 류의 필드도 `merge-coordinate.js`의 반환값(line 134-135, `analyzers: analyzers.map(a => ({ name: a.name, status: a.status }))`)에 없다.
  - `.claude/agents/integration-risk-summary.md:17,20`도 동일한 "terminal sub-agent라 Write가 차단될 수 있다" 서술 + "output_file Read해 통합" 절차를 그대로 갖고 있다 — `code-review-summary.md`/`consistency-summary.md`와 나란히 정정 대상이었어야 함(아래 WARNING 참조).
  - `.claude/skills/merge-coordinator/SKILL.md:63`도 같은 이유("workflow 의 terminal summary write 는 차단될 수 있고")를 그대로 인용한다.
- `/merge-coordinate`는 `.claude/worktrees/integrate-*/` 안에서 실제 branch 통합을 게이팅하는 명령이다 — `/ai-review`·`/consistency-check`와 동급이거나 그 이상으로 안전-critical하다. 이 결함 사슬이 그대로 남아 있다는 것은, analyzer가 harness의 "텍스트로 반환하라"는 지시를 따라 Write를 건너뛰면 `BLOCK: NO`가 나오면서 실제로는 미확인 Critical이 존재할 수 있다는 뜻이다 — 정확히 이 PR이 2026-07-10 실측 3회로 증명하고 고치려 한 바로 그 실패 모드가 merge 게이트에 방치된다.
- 근거로 사용된 `.claude/docs/orchestrator-workflow-migration.md`(미변경, 이 diff가 참조는 하지만 갱신하지 않음)는 한술 더 떠 **모순되는 구 진단**을 "현재 아키텍처"로 서술한다: "reviewers Write their outputs; summary **writes SUMMARY itself + returns a short status** (revised 2026-05-30 — see §CORRECTED diagnosis)"라며, 원인을 `worktree.bgIsolation` guard(파일명과 무관, position과 무관)로 지목한다. 이는 이번 PR의 새 실측(`subagent-call-contract.md §7`, probe `wf_61290a15-aec`/`wf_45d76e40-507` — 원인은 **정확히 파일명(SUMMARY.md) 기반**)과 정면으로 다른 주장이며, 현재 `ai-review.js`/`consistency-check.js`의 실제 설계("summary는 항상 전문을 반환", "STATUS만이 아니다")와도 이미 어긋나 있다. 두 문서가 같은 증상에 대해 서로 다른 "확정 진단"을 남긴 채 상호 참조 없이 공존한다 — 향후 편집자가 잘못된 쪽을 신뢰해 재발굴 사이클(2026-05-30 → 2026-07-10 3회 실측 → 2026-07-17 본 PR)을 반복할 위험.
- 제안: `merge-coordinate.js`에 동일 패턴(`parseAgentReturn`/no_status 기본값/ANALYZER_CONTRACT/inline 전문 전달/누락 파일 persist)을 적용하고, `integration-risk-summary.md`·`merge-coordinator/SKILL.md`·`orchestrator-workflow-migration.md`를 같은 트랙으로 갱신한다. 이번 PR 범위에서 의도적으로 제외한 것이라면 최소한 plan에 그 사실과 후속 추적을 명시해야 한다 — 현재는 아무 언급 없이 누락돼 있다.

### [WARNING] 요약 sub-agent 정의(`code-review-summary.md`/`consistency-summary.md`)가 이번 PR이 정정한 "terminal-write" 오진과 구 절차를 그대로 보유

- 위치: `.claude/agents/code-review-summary.md:17,20` (미변경), `.claude/agents/consistency-summary.md:25,28` (미변경)
- 상세: 두 sub-agent 정의(실질적으로 `mode=workflow` 호출 시 모델이 받는 system prompt)의 "수행 절차 B"는 여전히 "본인은 workflow 의 마지막(terminal) sub-agent 라 report-file Write 가 harness 에 의해 차단될 수 있고(병렬 reviewer의 non-terminal write는 통과하나 terminal summary write는 거부됨이 관측됨)"라고 서술한다. 이는 `subagent-call-contract.md §7`(본 diff에서 신설)이 명시적으로 "실제는 basename 정확 일치이며 terminal 여부와 무관"이라 정정한 바로 그 오진이다. 또한 두 파일의 절차 2단계는 "status가 success/fatal인 reviewer의 output_file을 Read해 통합"만 기술하며, `ai-review.js`/`consistency-check.js`가 새로 위임한 "누락 파일 영속화"(인라인 전문을 summary agent가 직접 Write) 책임이나 "전문이 있으면 status와 무관하게 정상 반영" 규칙이 전혀 언급되지 않는다.
- 실제 호출 시점엔 workflow 스크립트가 구성한 prompt 본문("반드시 이 순서, 정확히 이 형식" + `## 작업` 1-3단계)이 더 구체적이라 모델이 이를 우선할 가능성이 높지만(같은 저장소에 "prompt 규약이 prompt_file 지시보다 우선"이라는 선례가 있음), 정의 파일 자체는 지금 자기모순적이고 부정확한 "spec"으로 남는다. `merge-coordinate.js`가 통째로 미수정인 것과 합쳐, 이번 PR의 정정 대상 3개 요약 agent 정의 중 어느 것도 실제로 갱신되지 않았다.
- 제안: 두 파일의 "수행 절차 B" 문단을 `subagent-call-contract.md §7`의 정정된 basename 모델 + 신규 "누락 파일 영속화" 책임 + "전문 있으면 status 무관 반영" 규칙으로 갱신 (finding #1의 `integration-risk-summary.md`와 함께).

### [WARNING] `consistency-checker/SKILL.md`의 fallback 안내가 자기 스크립트가 아니라 `code-review-agents`의 스크립트를 가리킴

- 위치: `.claude/skills/consistency-checker/SKILL.md:93-95`
- 상세: 신규 `--sync-from-disk`/`--verify-coverage`는 `code_review_orchestrator.py`에만 추가됐고(`grep` 확인: `consistency_orchestrator.py`엔 해당 플래그·함수 없음), `consistency-checker/SKILL.md`의 fallback 절은 자신의 스크립트(`consistency_orchestrator.py`, 바로 위 line 90에서는 정확히 이걸 가리킴)가 아니라 `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py --sync-from-disk <session_dir>`를 지시한다. 같은 문서 안에서 90행은 자기 스크립트, 93-95행은 남의 스크립트를 가리키는 불일치.
- 실측 검증: consistency-checker 세션 형태(`subagent_invocations`/`agents_success`/`agents_pending`/`agents_fatal`, `agents_forced` 없음)의 `_retry_state.json`을 만들어 `code_review_orchestrator.py --sync-from-disk`를 직접 실행해본 결과 **정상 동작**했다(스키마 호환) — 즉 오늘 당장 깨지는 버그는 아니다. 그러나 이 저장소의 기존 관례(각 orchestrator가 `_load_state`/`_save_state`/`_apply_status_update`/`_emit_summary_state`를 각자 독립적으로 중복 구현)와 어긋나는, 설명 없는 cross-skill 결합이며, `code_review_orchestrator.py`의 `_sync_from_disk`가 향후 `agents_forced` 등 review-전용 가정을 갖게 되면 조용히 깨질 수 있다.
- 제안: `consistency_orchestrator.py`에도 동일 함수를 (기존 중복 관례에 맞춰) 추가하고 SKILL.md 경로를 고치거나, 의도된 재사용이라면 코드·문서 양쪽에 그 이유를 명시.

### [WARNING] `REVIEWER_CONTRACT`/`CHECKER_CONTRACT`가 STATUS 값 집합을 `<success|fatal>`로 좁히면서 그 사실을 문서화하지 않음

- 위치: `.claude/workflows/ai-review.js:111`, `.claude/workflows/consistency-check.js:86` vs `.claude/docs/subagent-call-contract.md:34` (`STATUS=<success|rate_limit|network|fatal>`)
- 상세: 이 두 workflow 스크립트가 prompt에 덧붙이는 "출력 규약"은 `STATUS=<success|fatal>`만 유효값으로 안내한다. §3의 기본 4값 enum(success/rate_limit/network/fatal)과 다르다. 파싱 자체(`/STATUS\s*[=:]\s*([A-Za-z_]+)/`)는 임의 토큰을 받아들이므로 기능적으로 깨지진 않지만, 실제로 rate_limit/network를 겪은 reviewer/checker가 이 좁혀진 안내를 따라 `fatal`로 자기보고하면 원인 정보가 뭉개진다. `subagent-call-contract.md §7`(본 diff 신설)도 이 의도적 축소를 언급하지 않는다.
- 제안: 좁힌 이유(Workflow 경로엔 cross-turn 재시도가 없어 rate_limit/network를 별도로 다룰 필요가 없다는 §2/§7의 기존 서술과 일치)를 §7에 한 줄 추가하거나, contract 문구에 4값을 그대로 노출.

### [INFO] plan 파일 자체의 P0 세부 체크박스 미체크 (실제 구현은 완료됨, 검증 완료)

- 위치: `plan/in-progress/harness-workflow-contract-fix.md` P0 절 (5개 중 4개 `[ ]`)
- 상세: `parseStatus` 기본값 변경, contract 주입, inline 전달, 76행 주석 정정 — 4개 항목 모두 실제 코드(`ai-review.js`/`consistency-check.js`)에서 구현을 직접 확인했고 관련 테스트도 통과했다(아래 요약 참조). 그런데 P0 세부 체크박스는 `[x]` 처리된 "작업 체크리스트"(파일 하단, 0-8단계 완료)와 달리 갱신되지 않아 문서 자기일관성이 부정확하다. 기능에는 영향 없음.

### [INFO] `_sync_from_disk`가 `agents_pending`과 `agents_fatal`에 동일 agent를 동시에 남길 수 있는 미검증 엣지 케이스

- 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:200-202`
- 상세: `agents_fatal = [n for n in state.get("agents_fatal", []) if n in missing]`이고 `agents_pending = missing`이므로, sync 이전에 `--update ... --status fatal`로 기록된 뒤 여전히 파일이 없는 agent는 sync 후 `agents_pending`과 `agents_fatal` 양쪽에 동시에 존재하게 된다. 신규 테스트 4건(`test_sync_from_disk_*`) 중 어느 것도 `agents_fatal`을 override로 시딩하지 않아 이 조합은 커버되지 않는다. 다만 이 함수가 겨냥하는 주 사용처(문서화된 "`--update`를 아예 호출하지 않는" fallback fan-out)에서는 `agents_fatal`이 prepare 시점부터 항상 `[]`라 실제로는 발생하지 않는다 — `--update`와 `--sync-from-disk`를 섞어 쓰는 비문서화 경로에서만 노출.
- 제안: sync 시 `agents_fatal`을 무조건 `[]`로 재설정(디스크에 없으면 균일하게 pending으로 취급)하거나, 이 조합에 대한 회귀 테스트 추가.

### [INFO] `_require_target`의 한국어 조사/공백 표기 오류 (기능에는 무관)

- 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:308`
- 상세: `f"\n  → 경로는 존재하지만 {kind} 가 아닙니다."` — `kind="파일"`일 때 "파일 가 아닙니다"(불필요한 공백 + 자음 종성 명사에 맞지 않는 조사, "파일이" 가 맞음)로 출력된다. 6개 신규 테스트는 `assertIn`(부분 문자열)만 확인하므로 통과에는 영향 없음.

### [INFO] spec fidelity — 해당 없음 확인

- `spec/**`는 이번 diff에서 전혀 변경되지 않았고, 변경된 10개 파일 모두 `.claude/**` 또는 `plan/**`이며 어떤 spec의 `code:` glob에도 매칭되지 않는다(`git diff --name-only origin/main...HEAD`로 실측). plan 3단계의 "해당 없음" 판단은 타당. 이 변경의 실질 "spec"은 `subagent-call-contract.md` + 2개 SKILL.md이며, 그 문서들과 `ai-review.js`/`consistency-check.js`의 반환값 필드(summary_output/summary_written/summary_markdown/reviewers·checkers[]/recovered[]/forced_missing[]/unfinished[])를 line-level로 대조한 결과 정확히 일치했다 — 위 WARNING 3건(인접 미갱신 문서)을 제외하면 문서-코드 정합성은 양호.

## 검증한 내용 (참고)

- `.claude/tests/test_consistency_target_validation.py`(6건) + `.claude/tests/test_orchestrator_state.py`(21건, 신규 sync-from-disk 4건·verify-coverage 4건 포함) 직접 실행 — 전부 PASS.
- `.claude/tests` 전체 스위트(`python3 -m unittest discover`) — 215건 PASS, plan의 "하네스 215 OK" 주장과 일치.
- `node --check`로 `ai-review.js`/`consistency-check.js` 구문 검증 — 이상 없음.
- `code_review_orchestrator.py`의 `compute_forced_agents`가 `available_agents`(=`config["agents"]`, 곧 `subagent_invocations`의 이름 집합)와 이미 교집합을 취하므로, `agents_forced`가 `subagent_invocations`에 없는 이름을 담아 `_verify_coverage`/`forcedMissing`이 오탐하는 경로는 없음을 소스 추적으로 확인.
- `_sync_from_disk`를 consistency-checker 형태의 `_retry_state.json`에 직접 실행해 실제로 정상 동작함을 실측(위 WARNING #3 근거).
- diff 범위가 정확히 리뷰 대상 10개 파일(`.claude/**` + `plan/**`)로 한정됨을 `git diff --stat`로 확인 — `codebase/**` 무변경이라는 plan의 e2e 면제 근거도 유효.

## 요약

P0(Workflow sub-agent 계약 충돌)·P1a(scope 무검증)·P1b(agents_forced 미강제)·P2(상태 동기화) 각각에 대해 코드·테스트가 실제로 존재하고 동작함을 직접 실행으로 확인했으며, `ai-review.js`/`consistency-check.js`와 두 SKILL.md·`subagent-call-contract.md` 사이의 반환값·절차 서술은 line-level로 정확히 일치한다 — **손댄 범위 안에서는 요구사항이 충실히 구현**됐다. 다만 이 PR 자신이 규정한 "P0 결함 사슬"이 세 번째 fan-out 파이프라인 `merge-coordinate.js`(및 그 요약 agent `integration-risk-summary.md`, SKILL.md, 그리고 참조 문서 `orchestrator-workflow-migration.md`)에는 전혀 적용되지 않아 완전히 동일한 BLOCK 거짓 음성 위험이 남아 있고, 이는 plan이 명시한 "`.claude/workflows/*.js` 만 고친다"는 선언 범위 안에 있었음에도 아무 설명 없이 누락됐다 — plan은 P1a에서 "해당 없음"을 명시적으로 정당화한 반면 이 누락은 어디에도 기록돼 있지 않다. `code-review-summary.md`/`consistency-summary.md`도 이번에 정정된 "terminal-write" 오진을 여전히 갖고 있어(실사용 시엔 prompt 우선으로 덮일 가능성이 높지만) 자기 정의로서는 부정확하다. 그 외 발견은 낮은 실질 영향의 문서/엣지케이스 수준이다.

## 위험도

HIGH
