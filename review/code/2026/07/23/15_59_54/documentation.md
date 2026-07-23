# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 새로 추가된 두 독스트링이 자신들이 근거로 드는 "측정된 사고" 의 파일 구성 수치를 잘못 기재
  - 위치: `.claude/skills/code-review-agents/lib/router_safety.py:319-320` (신규 `source_files()` 독스트링), `.claude/tests/test_router_decision_trust.py:9` (신규 모듈 독스트링)
  - 상세: 두 곳 모두 "2026-07-23, session `review/code/2026/07/23/14_47_40`" 사고를 근거로 인용하며 "19 files — 15 docs and 4 code files"(`router_safety.py`) / "15:4 doc-to-code majority"(`test_router_decision_trust.py`) 라고 적었다. 그러나 해당 세션의 실제 산출물(`review/code/2026/07/23/14_47_40/meta.json`)을 직접 열어 파일 확장자를 세어보면 `md` 16개 + `py` 3개 = 19개다(`.claude/agents/*-reviewer.md` 13개 + `code-review-agents/README.md` + `SKILL.md` + `tests/README.md` = 16 md, `lib/line_anchors.py` + `scripts/code_review_orchestrator.py` + `tests/test_line_anchors.py` = 3 py). 즉 실제 분할은 **16:3** 이지 15:4 가 아니다. `test_router_decision_trust.py:7`("brand-new Python module plus two more `.py` files") 자체는 3개 py 를 정확히 암시하면서, 같은 파일 9행에서 "15:4" 라고 자기모순적으로 반복한다.
  - 제안: "16 docs and 4 code" 가 아니라 실측값인 "16 docs and 3 code"(또는 "16:3")로 두 파일 모두 정정. 이 안전장치 자체가 "라우터가 파일 구성을 잘못 세지 않도록 사실을 명시한다"는 목적으로 추가된 것이라, 그 근거로 인용한 수치 자체가 틀리면 후속 유지보수자가 "측정된 사고"의 신뢰도를 의심하게 된다.

- **[WARNING]** `SKILL.md` 의 Route 단계 서술이 이번 diff 가 추가한 신뢰 검증(distrust) 분기를 반영하지 못해 stale
  - 위치: `.claude/skills/code-review-agents/SKILL.md:64`, `.claude/skills/code-review-agents/SKILL.md:93` (Read 로 직접 확인한 실제 줄 번호 — 이 파일은 이번 리뷰 대상 7개 파일에 포함되지 않음)
  - 상세: 64행은 "`selected = agents_forced ∪ {selected:true}`" 를 Route 단계의 유일한 공식으로, 93행은 "Workflow 의 Route 보정(`selected = agents_forced ∪ picked`)" 을 fallback 경로 대비 유일한 이점으로 서술한다. 그러나 이번 diff 가 `code_review_orchestrator.py`(`_routing_distrust_reason`)와 `.claude/workflows/ai-review.js`(`routingDistrustReason`) 양쪽에 새로 추가한 분기는, forced reviewer 가 `selected=false` 로 반환되거나 decisions 에서 아예 누락되면 이 공식 자체를 적용하지 않고 **결정 전체를 폐기해 등록된 전 reviewer 를 실행**한다. `SKILL.md` 는 이 새 분기의 존재도, 그로 인해 `routing_status` 가 "skipped" 로 바뀌고 `routing_skip_reason` 에 위반 사유가 기록되는 것도 언급하지 않는다. 라우팅 상태기계의 SoT 격인 문서가 이번 PR 이 하드닝한 정확히 그 안전장치를 설명하지 못하는 셈이다.
  - 제안: 64행/93행에 "forced reviewer 를 false 로 반환하거나 누락하면 결정이 통째로 폐기되고 전 reviewer 실행" 분기를 추가.

- **[INFO]** `_apply_routing()` 독스트링이 이번에 추가된 세 번째 분기(신뢰 불가 결정)를 설명하지 않음
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:440-446`(Read 로 확인한 실제 줄 번호 — 이 함수 선언부는 diff 헐크에 포함되지 않은 문맥이라 프롬프트 게이트가 없음)
  - 상세: 독스트링은 "Without --fallback: ... move selected=false agents from pending to skipped. Echo 'applied=<selected_count> skipped=<skipped_count>'." 와 "With --fallback: ..." 두 경로만 설명한다. 이번 diff 로 추가된 `_routing_distrust_reason()` 분기는 셋째 경로로, `routing_status='skipped'`(단, `--fallback` 인자와 무관), **모든 에이전트를 pending 에 그대로 유지**(누구도 skipped 로 옮기지 않음), 그리고 문서화된 포맷과 다른 `applied=<n> skipped=0 fallback=distrusted-decision` 을 출력한다. 독스트링만 읽으면 이 분기의 존재를 알 수 없다.
  - 제안: 독스트링에 세 번째 분기(신뢰 불가 판정 시 전원 pending 유지 + `fallback=distrusted-decision`)를 한 문단 추가.

- **[INFO]** `README.md` 의 `_retry_state.json` 스키마 예시가 새 `routing_skip_reason` 값을 반영하지 않음
  - 위치: `.claude/skills/code-review-agents/README.md:139`(Read 로 확인한 실제 줄 번호 — 이번 리뷰 대상 7개 파일에 포함되지 않음)
  - 상세: 주석이 예시 값으로 `"REVIEW_AGENTS explicitly set"` / `"--route=all"` / `"router fatal: ..."` 만 나열한다. 이번 diff 가 추가한 신뢰-불가 분기는 `f"{distrust} — decision discarded, running all"` (예: `"router marked forced reviewer(s) selected=false: ... — decision discarded, running all"`) 형태의 새 사유 문자열을 이 필드에 채운다. 위 SKILL.md 항목과 같은 근본 원인(신규 분기가 기존 문서 3곳에 전파되지 않음)의 일부.
  - 제안: 예시 목록에 신뢰-불가 사유 패턴 한 줄 추가.

## 긍정적으로 확인된 점

- `router_safety.py` 신규 `source_files()`, `code_review_orchestrator.py` 신규 `_routing_distrust_reason()`/트러스트-체크 주석, `ai-review.js` 신규 `routingDistrustReason()`, `test_router_decision_trust.py` 모듈 독스트링이 모두 같은 2026-07-23 사고를 인용하며 서로 수치(예: forced 7개, "6cd7376fc (#244)" 커밋 해시)가 일치한다. `6cd7376fc` 커밋 해시와 PR #244 는 `git show` 로 실존·서술 내용과 일치함을 확인했다 — 근거 날조가 아니다(다만 위 파일 구성 수치 15:4 만 예외).
- `_apply_routing` 의 새 분기 자체(코드)는 함수 본문 내 인라인 주석으로 충분히 설명되어 있고, `test_orchestrator_state.py` 의 갱신된 주석("A decision that drops or omits a forced reviewer is no longer silently patched up...")도 정확히 새 동작과 일치한다.
- `.claude/tests/README.md` 에 추가된 `test_router_decision_trust.py` 행은 실제 테스트 파일의 커버리지(양쪽 경로 differential test, prompt composition 검증)를 정확히 요약한다.
- `router_safety.py` 안의 로컬 변수 rename(`source_files` → `changed_source`)에 "왜 이름을 바꿨는지"(모듈 레벨 함수와의 shadowing 회피) 설명이 인라인 주석으로 명시되어 있어 리뷰어가 혼동할 여지가 없다.
- 이번 변경은 `codebase/` 가 아닌 `.claude/` 하네스 전용이라 product `CHANGELOG.md` 갱신 대상이 아니다(관례상 CHANGELOG 는 제품 변경만 기록).

## 요약

핵심 안전 로직(라우터가 강제 reviewer 화이트리스트를 어기면 결정 전체를 폐기하고 전원 실행)의 구현·테스트 자체는 튼튼하고 인라인 근거도 충실하지만, 그 로직을 소개하는 1차 개발자 문서(`SKILL.md` Route 단계 서술, `README.md` 스키마 주석, `_apply_routing` 독스트링)가 갱신되지 않아 "무엇이 언제 전원 실행으로 전환되는지"를 문서만으로는 알 수 없다. 또한 이 변경이 근거로 삼는 실측 사고의 파일 구성 수치(15 docs/4 code)가 그 사고의 실제 세션 산출물과 대조했을 때 틀렸다(실제 16 docs/3 code) — 안전장치가 "라우터의 계수 오류"를 막으려는 취지인 만큼 아이러니하다. 코드 동작 자체에는 영향 없는 문서 정합성 문제들이다.

## 위험도

LOW
