# 변경 범위(Scope) 리뷰 — harness-workflow-contract-fix

## 발견사항

- **[WARNING]** plan 세부 체크리스트가 실제 구현 상태와 불일치 (전부 미완료로 표기됐지만 diff 상 전부 구현됨)
  - 위치: `plan/in-progress/harness-workflow-contract-fix.md` — `## P0`·`## P1a`·`## P1b`·`## P2` 섹션의 세부 `- [ ]` 항목들 (예: `` `parseStatus` 기본값 `'success'` → `'no_status'` ``, `checker/reviewer 프롬프트에 **summary 와 동일한 출력 규약** 적용`, `summary agent 에 각 checker 전문을 **인라인 전달**`, `76행 주석의 **정반대로 틀린** 전제 정정`, `` `--verify-coverage <session_dir>` 신설 ``, `workflow 반환에 forced_missing[] 추가 + log 로 노출`, `SKILL 에 SUMMARY 작성 전 호출 의무화`, `` `--sync-from-disk <session_dir>` 신설 ``, `SKILL(...)·subagent-call-contract.md 에 명시`)
  - 상세: 위 항목들은 모두 `[ ]`(미체크) 상태로 커밋됐지만, 같은 diff 안에서 전부 실제로 구현·문서화가 완료된 상태다 — 예를 들어 `.claude/workflows/ai-review.js`/`consistency-check.js` 는 `parseStatus`→`parseAgentReturn`(기본값 `no_status`) 교체·`REVIEWER_CONTRACT`/`CHECKER_CONTRACT`·인라인 전달·구주석 정정을 모두 담고 있고, `code_review_orchestrator.py` 는 `--verify-coverage`/`--sync-from-disk` 를, `ai-review.js` 는 `forced_missing[]` 반환+log 를, 두 SKILL.md 는 관련 문서화를 모두 포함한다. 반면 하단 "작업 체크리스트"의 상위 단계(`5-7. 구현+테스트`, `8. TEST WORKFLOW`)만 `[x]` 로 표기돼 전체적으로는 완료로 읽히지만, P0~P2 세부 항목만 떼어 보면 "아직 안 한 일"처럼 보여 plan 문서 내부적으로 모순된 상태로 커밋됐다. 이 plan 은 `plan/in-progress/` 에 SoT 로 남아 향후 세션·감사(plan-coherence-checker 등)가 참조하므로, 세부 체크박스 미갱신은 "무엇이 끝났는지"에 대한 단일 진실을 흐린다.
  - 제안: 세부 `- [ ]` 항목들을 실제 구현 완료 상태(`- [x]`)로 갱신하거나, 세부 체크리스트를 상위 요약 체크리스트로 대체해 중복·불일치 가능성을 없앤다.

- **[INFO]** `--sync-from-disk`/`--verify-coverage` 가 code-review-agents 스크립트에만 구현되고 consistency-checker SKILL 이 그 경로를 그대로 참조 (cross-skill coupling)
  - 위치: `.claude/skills/consistency-checker/SKILL.md` 의 fallback 섹션 — `python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --sync-from-disk <session_dir>` (consistency-checker 세션 디렉토리에 대해 다른 skill 의 스크립트를 호출하도록 안내). 반면 신규 로직(`_sync_from_disk`/`_verify_coverage`)은 `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 에만 추가됐고 `consistency_orchestrator.py` 에는 대응 플래그가 없다.
  - 상세: `consistency_orchestrator.py` 파일 상단 주석은 기존에 "Mirror code_review_orchestrator so main never has to Read `_retry_state.json` into its context"(상태 헬퍼를 공유하지 않고 미러링/독립 구현 유지) 라는 설계 원칙을 명시하고 있는데, 이번 변경은 그 패턴을 깨고 한쪽(code-review-agents)에만 기능을 넣은 뒤 다른 skill(consistency-checker)이 그 스크립트를 cross-skill 로 호출하도록 문서화했다. plan 의 P2 체크리스트("`--sync-from-disk` 신설 — SKILL(consistency-checker·code-review-agents)에 명시")가 단수 신설을 명시적으로 의도했으므로 "요청 밖의 변경"은 아니지만, 두 orchestrator 가 지금까지 유지해 온 독립/미러링 원칙과의 불일치는 scope 경계상 눈에 띄는 지점이다. 상태 파일 스키마(`agents_pending`/`agents_success`/`agents_fatal`/`subagent_invocations`)가 우연히 동일해 현재는 동작하지만, 두 스크립트의 스키마가 향후 각자 진화하면 이 암묵적 결합이 깨질 수 있다.
  - 제안: 아키텍처 리뷰어 확인 권장 — 의도된 단일 구현이면 SKILL.md 에 "두 skill 이 이 스크립트를 공유한다"는 이유를 한 줄 명시하거나, 원칙을 지키려면 `consistency_orchestrator.py` 에도 동일 플래그를 추가하는 편이 향후 스키마 drift 리스크를 줄인다. (본 항목은 scope 위반이라기보다 관찰 사항이며 차단 대상 아님.)

## 요약

10개 변경 파일(`.claude/docs/subagent-call-contract.md`, 2개 SKILL.md, 2개 orchestrator `.py`, 2개 신규/기존 테스트 `.py`, 2개 Workflow `.js`, 신규 plan 파일)을 `plan/in-progress/harness-workflow-contract-fix.md` 의 P0(Workflow 계약 충돌)·P1a(scope 인자 미검증)·P1b(`agents_forced` 미강제)·P2(직접 fan-out 상태 미동기화) 체크리스트와 항목 단위로 대조한 결과, 코드 변경은 선언된 범위와 사실상 1:1로 매핑되며 무관한 리팩토링·포맷팅 잡음·불필요한 임포트·설정 파일 변경은 발견되지 않았다(`git diff --check` clean, import diff 는 신규 테스트 파일에만 존재, 변경 파일 목록도 plan 이 명시한 10개와 정확히 일치). 특히 plan 이 "P0 는 `.claude/workflows/*.js` 만, Python·agent 정의는 불변" 이라 명시했는데 실제 Python 변경(`_require_target`, `--verify-coverage`, `--sync-from-disk`)은 전부 P1a/P1b/P2 항목으로 분리 귀속되어 그 제약을 정확히 지켰고, 신규 테스트 14건(4+4+6)도 plan 이 예고한 수와 정확히 일치한다. 다만 (1) plan 문서 자체의 세부 체크리스트가 구현 완료 상태를 반영하지 못해 향후 진행상황 추적에 혼선을 줄 수 있고, (2) 신규 상태-동기화 CLI 가 code-review-agents 스크립트에만 구현되고 consistency-checker 가 이를 cross-skill 로 참조하는 결합이 생겼다 — 둘 다 기능적 위험이나 의도 밖 변경은 아니며, 전자는 plan 위생 차원의 개선점, 후자는 아키텍처 리뷰어에게 넘길 관찰 사항이다.

## 위험도
LOW
