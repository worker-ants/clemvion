# 아키텍처(Architecture) Review

## 발견사항

- **[CRITICAL]** 동일 하네스 write-block 메커니즘에 대해 상충하는 진단 문서 3종이 조정 없이 공존
  - 위치: `.claude/docs/subagent-call-contract.md` §7 (신설) vs `.claude/docs/orchestrator-workflow-migration.md` §"Constraint the pilot uncovered — CORRECTED diagnosis (2026-05-30)" vs `.claude/skills/code-review-agents/SKILL.md` §0 "사전 점검" (미변경)
  - 상세: 이번 diff 가 신설한 `subagent-call-contract.md §7` 은 "차단은 **basename 정확 일치** 규칙이며 terminal 여부와 무관하다"고 2026-07-17 실측(probe `wf_61290a15-aec`·`wf_45d76e40-507`)으로 단정한다. 그러나 `orchestrator-workflow-migration.md` 는 2026-05-30 자로 **바로 그 "report-file basename 규칙" 가설을 이미 한 번 반증**하고, 실제 원인은 `worktree.bgIsolation` 가드(부모 bg 세션이 `EnterWorktree` *툴*로 격리 안 되면 모든 sub-agent write 가 파일명·terminal 위치 무관하게 차단)라고 결론지었다 — 그리고 이번 diff 와 정반대로 "summary agent 가 SUMMARY.md 를 직접 쓰고 짧은 STATUS 만 반환" 하는 설계로 되돌렸던 이력이 있다("풀 리포트가 매 리뷰마다 caller 컨텍스트를 왕복하는 것은 legacy Agent-tool 경로엔 없던 컨텍스트 회귀"라고 명시). `code-review-agents/SKILL.md` §0(이번 diff 로 변경 안 됨)은 지금도 bgIsolation 설명과 그 migration 문서를 인용한 안내를 그대로 유지한다.
    이번 diff 는 이 세 문서 중 어느 것도 상호 참조하지 않고, §7 의 새 실측이 (a) `EnterWorktree` 로 제대로 격리된 세션에서 수행됐는지(즉 bgIsolation 오탐 가능성을 통제했는지) 기록하지 않는다. 5월에 "관찰 차이가 사실은 세션 격리 상태 차이였다" 는 동일 오진단 패턴을 문서가 스스로 경고했음에도, 7월 실측 방법론에 그 통제 변수가 빠져 있어 같은 오류를 반복했을 가능성을 배제할 수 없다. 이 미검증 이론 위에 **이전에 명시적으로 기각됐던 설계(리포트 전문을 summary sub-agent 프롬프트에 인라인 전달)** 를 되살리는 실질적 되돌림이 올라가 있다.
  - 제안: (1) `orchestrator-workflow-migration.md` 의 "CORRECTED diagnosis" 절을 갱신하거나 최소한 §7 로의 상호 링크를 추가해 두 진단의 관계(대체/병존/재현) 를 명시. (2) §7 재실측 시 probe 세션이 `EnterWorktree` 로 격리됐는지 여부를 기록해 bgIsolation 오탐 가능성을 배제. (3) `code-review-agents/SKILL.md` §0 의 bgIsolation 안내 문구를 §7 관점과 합치되게 갱신(두 가드가 독립적으로 공존하는 것이면 그렇게 명시).

- **[WARNING]** 동일 결함 클래스의 fix 가 구조적으로 동일한 3번째 Workflow 스크립트(`merge-coordinate.js`)에는 적용되지 않음
  - 위치: `.claude/workflows/merge-coordinate.js:54-67` (미변경) vs `.claude/workflows/ai-review.js`, `.claude/workflows/consistency-check.js` (이번 diff)
  - 상세: `merge-coordinate.js` 는 `ai-review.js`/`consistency-check.js` 와 구조적으로 동형(analyzer fan-out → summary 통합)이며, 이번 diff 가 고친 정확히 그 버그 — `parseStatus` 가 STATUS 줄이 없으면 `'success'` 로 간주(`const m = /STATUS=([a-z_]+)/.exec(text || ''); return m ? m[1] : 'success'`)하고, summary 가 `output_file` 을 디스크에서 Read 하는 전제로만 통합 — 를 그대로 갖고 있다. 하네스가 report-file Write 를 자주 건너뛰게 만든다는 것(§7)이 workflow 공통 제약이라면, `merge-coordinate` 의 BLOCK 판정도 동일한 거짓 음성 위험에 노출돼 있는데 plan 문서·두 SKILL·`subagent-call-contract.md` 어디에도 `merge-coordinate` 언급이 없다(grep 결과 0건). 이 PR 이 다루는 "안전 게이트가 조용히 약해지는데 아무도 모른다" 는 문제의식이 정확히 이 파일에 재현돼 있다.
    또한 `ai-review.js` 와 `consistency-check.js` 사이에서도 `DELIM`/`parseAgentReturn`/`*_CONTRACT` 블록/`usable`·`recovered`·`unfinished` 파생 로직이 거의 글자 그대로(리뷰어→체커 용어 치환만) 중복돼 있다. 두 파일 다 워크플로 스크립트 특성상 `require`/`import` 를 쓰지 않는 것으로 보이므로(`.claude/workflows/*.js` grep 결과 0건) 완전한 추출이 플랫폼 제약일 수 있으나, 그렇다면 최소한 "이 파싱 규약은 N개 워크플로에 동일하게 있어야 한다"는 불변식을 강제하는 테스트나 문서화된 체크리스트가 없다 — 그 결과가 바로 `merge-coordinate.js` 의 누락이다.
  - 제안: `merge-coordinate.js` 도 동일 패턴(no_status 기본값, STATUS+delimiter+전문 계약, inline 전달)으로 갱신하거나, 최소한 plan 문서에 "의도적으로 이번 스코프에서 제외" 사유를 남긴다. 중복 로직은 워크플로 스크립트가 모듈 임포트를 지원하는지 확인 후 공용 스니펫/코드젠 또는 최소한 3개 파일 동기화를 검증하는 테스트를 추가.

- **[WARNING]** 신규 상태-동기화 유틸이 code-review-agents 전용으로만 구현되고, consistency-checker 는 문서(prose)만으로 그 스크립트를 참조 — 코드 수준 계약 없는 cross-skill 결합
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:174-247` (`_sync_from_disk`, `_verify_coverage` 신설) / `.claude/skills/consistency-checker/SKILL.md` (fallback 절, "python3 .claude/skills/**code-review-agents**/scripts/code_review_orchestrator.py --sync-from-disk ..." 인용)
  - 상세: `_sync_from_disk`/`_verify_coverage` 는 `code_review_orchestrator.py` 에만 추가됐다. 그런데 `consistency-checker/SKILL.md` 의 fallback 절은 **자기 스킬의 `consistency_orchestrator.py` 가 아니라 이웃 스킬의 스크립트 경로**를 그대로 호출하라고 지시한다(`consistency_orchestrator.py` 에는 `--sync-from-disk`/`--verify-coverage` 가 아예 없음, grep 확인). 이 프로젝트엔 이미 두 orchestrator 가 공유하는 위치(`.claude/skills/_lib/project_config.py`)가 있고, `_load_state`/`_save_state`/`_apply_status_update`/`_emit_summary_state` 는 (기존 관행대로) 두 파일에 이미 각각 복제돼 있다 — 즉 기존 컨벤션은 "완전 복제" 인데, 이번 신규 기능만 그 컨벤션을 깨고 "한쪽에만 구현 + 문서에서 경로로 링크" 라는 제3의(더 약한) 결합 방식을 택했다. 우연히 두 스킬의 `_retry_state.json` 스키마(`subagent_invocations`/`agents_pending`/`agents_success`/`agents_fatal`/`agents_skipped`)가 지금은 호환되어 동작은 하지만, 이를 보장하는 import·타입·테스트가 전혀 없다 — `test_orchestrator_state.py` 의 `ORCH` 상수는 `code_review_orchestrator.py` 만 가리키며, consistency-checker 세션 디렉토리 모양으로 `--sync-from-disk` 를 구동하는 테스트는 0건이다. 한쪽 스키마가 독립적으로 진화하면(예: reviewer 전용 필드를 `subagent_invocations` 항목에 요구) consistency-checker 의 fallback 복구 절차가 조용히 깨지고, 이는 이 plan 문서가 막으려는 바로 그 "아무도 모르게 안전장치가 약해지는" 패턴의 재현이다.
  - 제안: `_load_state`/`_save_state`/`_sync_from_disk`/`_verify_coverage`(스키마에 무관한 순수 부분)를 `.claude/skills/_lib/` 로 추출해 두 orchestrator 가 import 하게 하거나, 최소한 기존 컨벤션대로 `consistency_orchestrator.py` 에도 동일 기능을 구현하고 SKILL.md 의 참조 경로를 자기 스킬로 고친다. cross-skill 참조를 유지할 경우 최소한 consistency-checker 세션 모양을 입력으로 한 회귀 테스트를 추가.

- **[WARNING]** 신규 안전장치(`--verify-coverage`, `--sync-from-disk`)가 hook 강제가 아니라 SKILL.md 서술에만 의존 — 프로젝트가 이미 진단한 "enforcement asymmetry" 패턴 재발
  - 위치: `.claude/skills/code-review-agents/SKILL.md` "(fallback) 수동 Agent 경로" 절 / `.claude/hooks/**` (grep 결과 `verify-coverage`·`sync-from-disk`·`forced_missing` 참조 0건)
  - 상세: `agents_forced` 화이트리스트 미이행(P1b)과 상태 파일 stale(P2) 을 막기 위한 `--verify-coverage`/`--sync-from-disk` 는 순수 CLI 도구이며, 호출 의무는 오직 SKILL.md 산문("SUMMARY 확정 전 반드시 …", "fan-out 이 끝나면 …")으로만 부과된다. `Workflow` 경로에서는 `ai-review.js` 가 `forced_missing[]` 을 자동 계산해 반환값에 싣는 구조적 개선이 있지만, 그 반환값을 보고 "먼저 그 reviewer 를 실행하고 SUMMARY 를 확정한다"는 것 역시 §3 의 산문(`3. forced_missing[] 가 있으면 …`)일 뿐, hook 이 차단하지 않는다. Fallback(수동 Agent) 경로는 아예 자동 계산조차 없이 전적으로 main 이 CLI 를 기억해서 호출해야 한다.
    이는 이 프로젝트의 `orchestrator-workflow-migration.md` §"Post-migration regression" 이 이미 별도 사안(review/fix 후속)에 대해 정확히 진단한 패턴 — "worktree 는 hook 강제, review/fix 는 SKILL 산문뿐이라 압력이 커지면 산문 의무가 먼저 무너진다" — 과 동형이다. 이번 plan 자체의 동기("안전 게이트가 조용히 약해지는데 아무도 모른다")를 감안하면, 탐지 도구(disk 가 심판)는 잘 만들었지만 **호출 강제**는 여전히 없다.
  - 제안: 적어도 fallback 경로에 한해 review_guard 류의 훅에 `--verify-coverage`/`--sync-from-disk` 실행 여부(또는 그 결과)를 검사하는 게이트를 추가하거나, `resolution-applier` 호출 전 단계에서 `forced_missing`/상태-디스크 불일치를 기계적으로 재확인하는 절차를 넣는다.

- **[WARNING]** `_sync_from_disk` 가 상태 객체의 일부 필드만 갱신해 내부 불변식이 깨질 수 있고, `subagent_invocations` 부재 시 방어 없이 기존 성공 기록을 조용히 0 으로 덮어씀
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:174-208` (`_sync_from_disk`)
  - 상세: 이 함수는 `agents_success`/`agents_pending`/`agents_fatal` 세 버킷만 디스크 기준으로 덮어쓰고, 같은 상태 객체의 `agent_history`(`_apply_status_update` 가 기록하며 `test_history_records_each_transition` 로 검증되는 필드)는 건드리지 않는다. 그 결과 sync 이후 `agents_success` 에는 있지만 `agent_history[name]` 에는 success 전이가 없는 agent 가 생길 수 있다 — 같은 `_retry_state.json` 내부에서 두 필드가 서로 모순되는, 이 plan 문서가 없애려는 "두 산출물이 서로 모순" 문제의 축소판이 상태 파일 **내부에** 재현된다. 또한 `known = [i["name"] for i in state.get("subagent_invocations", [])]` 는 그 키가 비어있거나 없으면 조용히 `known=[]` 가 되어, 기존에 `--update` 로 정상 기록된 `agents_success` 를 검증 없이 빈 배열로 덮어쓴다(현재 `prepare_session` 은 항상 이 키를 채우므로 오늘 당장은 발생하지 않지만, "디스크가 심판" 이라는 이 함수의 존재 이유상 스스로도 이런 조용한 데이터 손실 가능성에 대해 방어적이어야 한다). 신규 테스트 4건(`test_sync_from_disk_*`) 도 `agent_history` 일관성이나 이 엣지 케이스를 검증하지 않는다.
  - 제안: sync 후 `agent_history` 에 각 전이를 기록하거나, 최소한 `agent_history` 를 그대로 두는 것이 의도적임을 docstring 에 명시. `subagent_invocations` 가 비어 있으면(즉 세션이 이 필드를 가진 세대 이전이면) 에러로 종료하도록 방어.

- **[INFO]** 리뷰어/체커 보고서 전문의 인라인 전달에 크기 상한이 없어, 이전에 명시적으로 회귀로 지목됐던 "풀 리포트가 프롬프트를 왕복" 패턴이 한 단계 옮겨 재현됨
  - 위치: `.claude/workflows/ai-review.js` (`inlined`/`needPersist` 구성부), `.claude/workflows/consistency-check.js` (동일 패턴)
  - 상세: 각 reviewer/checker 의 반환 markdown 전문을 `REVIEW_MAX_PROMPT_SIZE`(개별 reviewer 입력 프롬프트 상한) 와 무관하게 **출력** 크기 제한 없이 그대로 이어붙여 summary sub-agent 프롬프트에 인라인한다. reviewer 최대 14개(설정으로 확장 가능) 기준, 개별 보고서가 커지면 summary 프롬프트가 선형으로 누적 팽창한다 — `orchestrator-workflow-migration.md` 가 "풀 리포트가 매 리뷰마다 컨텍스트를 왕복하는 것은 legacy 경로엔 없던 회귀" 라고 명시적으로 경계했던 것과 같은 종류의 비용이, main 컨텍스트 대신 summary sub-agent 프롬프트 쪽에서 무제한으로 재발할 수 있다. 정확성(거짓 음성 제거)을 위한 의도된 트레이드오프로 보이나 상한이 전혀 없다는 점은 "확장성" 관점에서 기록해 둘 가치가 있다.
  - 제안: reviewer 당 인라인 markdown 에도 상한(초과 시 상위 N KB + "전문은 output_file 참고" 안내)을 두는 것을 고려.

- **[INFO]** `_require_target` 검증 헬퍼가 `collect_context` 내부의 익명 클로저로 배치되어 재사용·단위 테스트 대상에서 배제
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:290` 부근(`collect_context` 함수, 총 ~150줄) 내부의 `_require_target` 정의
  - 상세: 형제 함수인 `_load_state`/`_save_state`/`_apply_status_update` 는 모두 모듈 최상위에 정의돼 있는데, 이번에 추가된 ~35줄짜리 `_require_target` 은 `collect_context` 안의 nested function 이다. 기능은 4개 모드(`--spec`/`--plan`/`--impl-prep`/`--impl-done`) 모두에 재사용되므로 module-level 로 두는 편이 기존 스타일과 일관되고, 향후 다른 경로 인자(예: `--diff-base`)에도 재사용하기 쉽다. 현재 테스트(`test_consistency_target_validation.py`)는 subprocess 로 CLI 전체를 구동하는 블랙박스 방식이라 동작 자체는 잘 검증되지만, 함수가 nested 라 단위 수준 재사용은 막혀 있다.
  - 제안: 모듈 최상위로 hoist. 동작 변경 없는 순수 리팩터라 위험은 낮음.

## 요약

이번 변경은 하네스가 sub-agent 의 report-file Write 를 은밀히 차단해 발생한 "BLOCK/위험도 거짓 음성" 이라는 실측된 P0 결함을 인라인 전달 방식으로 구조적으로 제거하고, `agents_forced` 화이트리스트 미이행(P1b)과 fallback fan-out 후 상태 파일 stale(P2)을 감지하는 CLI 도구·테스트 14건을 추가한 점에서 방향은 타당하고 근거(journal 실측)도 충실하다. 다만 아키텍처 관점에서 세 가지가 걸린다: (1) 이번 fix 의 핵심 전제인 "basename 정확 일치 차단" 진단이 같은 저장소의 다른 문서가 2026-05-30 에 이미 반증했던 이론과 조정 없이 공존하고, 그 위에 한 번 명시적으로 기각됐던 설계(리포트 전문 인라인)를 되살렸다 — 근거 문서 간 SoT 충돌. (2) 동일 결함 클래스를 고치면서 구조적으로 동형인 세 번째 워크플로(`merge-coordinate.js`)를 빠뜨려, "고쳤다고 믿지만 실은 부분적으로만 고쳐진" 바로 그 문제 패턴을 이 PR 스스로 재현했다. (3) 신규 안전장치 2종이 code-review-agents 스킬에만 구현되고 consistency-checker 는 문서상의 경로 참조로만 연결돼, 기존 완전-복제 컨벤션에서 벗어난 검증되지 않은 cross-skill 결합을 만들었고, 두 안전장치 모두 hook 이 아닌 SKILL 산문에 의존해 이 프로젝트가 이미 한 번 겪은 "toothless mandate" 패턴을 반복할 위험이 있다.

## 위험도

HIGH
