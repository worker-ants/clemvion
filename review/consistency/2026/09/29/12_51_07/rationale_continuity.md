# Rationale 연속성 검토 (--impl-done, scope=.claude/docs, NERV 전환 단계 1)

대상은 하네스 구현 diff(`pull.py` · `guard_nerv_owned_paths.py` · CI 잡 · walker 가드 제외 규칙 · orchestrator 코퍼스 필터)와, 먼저 머지될 짝 planner PR 의 거버넌스 문서 diff 다. scope(`.claude/docs`) 자체의 델타는 0 이라 그 사실로는 아무것도 판정하지 않았다. 코드 확인은 전부 HEAD 워킹트리 절대경로로 했다.

### 발견사항

- **[WARNING]** 편집 가드가 스스로 세운 도입 원칙("문서가 그 쓰기를 안내하는 동안은 막지 않는다")을 옛 트리에 대해 어긴다
  - target 위치: `.claude/hooks/guard_nerv_owned_paths.py` 모듈 docstring(막는 경로는 거버넌스 문서가 그 쓰기를 더는 안내하지 않을 때 더한다) 과 `OWNED_ROOTS = {"spec": ...}`. 짝 planner PR 은 CLAUDE.md · SKILL 만 고치고 아래 잔존 지시는 그대로 뒀다.
  - 과거 결정 출처: 같은 docstring 의 "먼저 막으면 문서가 시키는 일을 훅이 막는다". `spec/conventions/spec-impl-evidence.md` §3(partial → implemented 승격 의무)·§4.2·R-8, `.claude/docs/plan-lifecycle.md` §3 "인입 참조: spec/ 등 살아있는 문서의 plan 링크는 이동과 동시에 갱신".
  - 상세: 훅은 `spec/` 아래 옛 트리(`spec/5-system/**` 등)까지 통째로 막는데, 옛 트리를 고치라고 시키는 지시와 빌드 가드가 남아 있다. 실측(HEAD 워킹트리):
    - `PROJECT.md` L170·L173·L175·L177·L181·L223 의 동반 갱신 매트릭스가 `spec/5-system/16-system-status-api.md` · `spec/1-data-model.md §2.17` · `spec/conventions/*` 와 frontmatter `status:`/`pending_plans:`/`code:` 갱신을 의무로 적는다. 짝 PR 이 그대로 둔 `developer/SKILL.md` 4단계도 "spec frontmatter `status: partial` + `pending_plans:` 등록 의무"를 적는다.
    - 옛 트리에서 `status: partial` + `pending_plans` 가 살아 있는 spec 이 18개다. `spec-status-lifecycle.test.ts` (c) 는 pending plan 이 전부 complete 로 가면 `implemented` 승격을 강제한다. 단일 plan 을 가진 spec(`1-auth`, `9-rag-search`, `14-external-interaction-api`, `2-trigger-list` 등)은 그 plan 이 끝나는 순간 빌드가 승격을 요구하는데 훅이 그 편집을 막는다.
    - 옛 트리 본문이 `plan/in-progress/` 를 링크하는 파일이 12개다. `spec-link-integrity` 범위 1 은 옛 트리를 계속 스캔하므로(`inNervMirror` 는 미러만 뺀다) plan 을 complete 로 옮기면 링크 갱신이 필요한데, 그 편집도 막힌다.
    - 남는 길은 `BYPASS_NERV_OWNED_PATHS=1` 뿐이고 어느 문서도 이 용도를 안내하지 않는다. 게다가 "셸 편집 구멍은 CI 가 막는다"는 docstring 문장은 미러에만 참이다. `pull.py` 의 `mirror_files()` 는 `CLE-*` 만 보므로 옛 트리 셸 편집은 CI 도 못 잡는다. "옛 트리 동결"이라는 보장이 훅 하나에만 기대고, 그 훅은 위 이유로 우회가 정상 경로가 된다(문서한 보장이 구현보다 넓은 형태).
  - 제안: (a) 옛 트리 유지보수 쓰기를 어떻게 처리할지 한 곳에 정한다. 예: 전환 기간 한정으로 `spec-status-lifecycle` (c) · plan 링크 검사에서 옛 트리를 면제하거나, 훅에 frontmatter · plan 링크 유지보수용 명시적 통로(문서화된 BYPASS)를 둔다. (b) `PROJECT.md` 매트릭스와 `developer/SKILL.md` 4단계의 spec 갱신 지시를 NERV 초안 기준으로 바꾸는 후속을 명시한다. 그 전까지 "옛 트리는 동결"이 아니라 "동결하되 이 예외로만 고친다"로 적는다.

- **[WARNING]** 링크 · area-index 가드의 적용 범위를 좁히는 결정 번복이 SoT 의 Rationale 없이 코드 주석과 CHANGELOG 에만 있다
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (`NERV_MIRROR` · `inNervMirror` · `collectSpecMarkdown`), `spec-link-integrity.test.ts`, `CHANGELOG.md` Unreleased 4번째 항목.
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md` L50("단 §4.2 의 링크 무결성·area-index 가드는 `spec/data-flow/` 에도 그대로 적용된다 — 제외는 어디까지나 frontmatter-evidence family 한정"), §4.2 표의 예외 열(생성형 `*-api-catalog/` 만), R-7(제외는 카탈로그 중첩 경로로 한정), R-9. `PROJECT.md` L305·L390-394 도 범위 1 을 "`spec/**.md` … (생성형 `*-api-catalog/` 제외)"로만 적는다.
  - 상세: 두 가드는 지금까지 `spec/**` 전체가 대상이고 예외는 생성물뿐이라는 원칙이었다. 이번 변경은 `spec/CLE-*` · `spec/README.md` 를 새 예외로 더한다. 의도와 근거(실측 49건 RED, 카탈로그 키 링크 125개, 앵커 1,372개, 폴더마다 README 를 요구하는 area-index 규칙이 D3 "중앙 매니페스트 없음"과 충돌)는 타당하지만 SoT(`spec-impl-evidence.md`)에는 반영되지 않았다. 그 문서는 이제 동결이라 고칠 수도 없다. 정본이 된 NERV `CLE-ENG-SPECEVIDENCE`(미러 `spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md`)의 가드 표와 "링크 무결성 가드 범위" 절에도 미러 예외가 없다. 또 기각한 대안("미러를 옛 가드에 그대로 통과시킴")의 근거 수치가 저장소 문서에는 CHANGELOG 의 두 수치(49건, 번들 순서 RED)뿐이다. 미러의 링크는 부분 스냅샷 설계상 대상 파일이 없는 경우가 정상이고(`test_task_links_resolve_against_the_whole_tree`), `pull.py --check` 는 본문 해시와 위치만 보므로 미러 링크 무결성은 어떤 가드도 보지 않는다. 이 점이 명시되지 않았다.
  - 제안: NERV `CLE-ENG-SPECEVIDENCE` 초안에 Rationale 항("NERV 미러는 §4.2 링크 · area-index 가드 대상이 아니다. 대신 `pull.py --check`")을 추가하고 기각 대안의 실측(카탈로그 키 125, 앵커 1,372, README 요구)을 옮겨 적는다. 미러 링크는 "대상이 미러에 없을 수 있음이 정상, 무결성은 NERV 가 본다"고 한 줄 남긴다. `PROJECT.md` L305·L390-394 의 범위 서술에 미러 제외를 반영한다.

- **[WARNING]** SPEC-DRIFT "정식 역류 경로"가 승인 대기 동안 `--impl-done` push 게이트를 닫는 방법이 없다 (추론, 확인 필요)
  - target 위치: 짝 planner PR 의 `code-review-agents/SKILL.md` ESCALATE `spec` 행, `developer/SKILL.md` SPEC-DRIFT 처리 항목, `consistency-checker/SKILL.md` "근본 원인이 스펙이면" 항목.
  - 과거 결정 출처: `code-review-agents/SKILL.md` "SPEC-DRIFT 는 코드를 되돌리지 않고 spec 만 갱신하는 정식 역류 경로". `developer/SKILL.md` 4단계 "spec 연결 코드 변경이면 `--impl-done` BLOCK:NO 산출물이 없을 때 push · 턴종료 차단(SPEC-CONSISTENCY 게이트)". 그리고 "BLOCK:YES 는 우회 말고 planner 턴으로 닫는다"는 기존 운영 결정.
  - 상세: 옛 흐름은 같은 PR 에서 `spec/` 을 고쳐 다음 `--impl-done` 이 BLOCK:NO 가 됐다. 새 흐름은 NERV 초안을 저장하고 검토를 요청한 뒤 `resolution-applier` 를 재호출한다. 그런데 `--impl-done` 이 비교하는 것은 저장소의 옛 트리 또는 미러다. 옛 트리는 동결이고 미러는 "승인 뒤 구현 PR 이 pull" 하므로(planner SKILL 8단계, developer SKILL SPEC-DRIFT 항목), 승인 전에는 같은 drift 가 다시 BLOCK:YES 로 나올 가능성이 크다. `pull.py --task` 가 받는 "작업 기준 버전"에 개발자 자신의 미승인 초안이 들어가는지는 diff 에서 확인되지 않는다(들어간다면 문제없다).
  - 제안: 승인 대기 중 drift 를 게이트가 어떻게 다루는지 한 줄 적는다. 예: 초안 승인 후 `pull.py --task` 재실행 → `--impl-done` 재실행, 그 사이 push 보류. 또는 `--task` 가 초안을 받는 경우 그 사실을 명시한다.

- **[INFO]** SPEC-CONSISTENCY 게이트(`review_guard._spec_code_patterns`)는 `code:` frontmatter 만 읽는데 미러 169편에는 `code:` 가 0개다
  - target 위치: `.claude/hooks/_lib/review_guard.py` `_spec_code_patterns` / `_parse_frontmatter_code`, `developer/SKILL.md` 4단계 "강제" 문구.
  - 과거 결정 출처: `spec-impl-evidence.md` R-10("`code:` 는 약속 vs 구현 정합의 핵심 invariant"). NERV `CLE-ENG-SPECEVIDENCE`("`code:` 는 본문의 `## 구현 위치` 절로 옮겼다").
  - 상세: 옛 트리가 동결로 남아 있는 동안은 기존 글로브가 계속 작동한다. 그러나 NERV 에서만 생긴 스펙 표면을 구현하는 코드는 어떤 `code:` 에도 걸리지 않아 `--impl-done` 강제 밖이 된다. 옛 트리를 지우는 단계 5 에서는 게이트가 통째로 비활성이 된다. `developer/SKILL.md` 의 "강제" 서술은 옛 글로브 범위에 한해서만 참이다.
  - 제안: 4단계 문구에 범위를 적고, `review_guard` 가 `## 구현 위치`(또는 Task scope)를 읽도록 바꾸는 일이 단계 5 의 선행 조건임을 계획에 명시한다.

- **[INFO]** 로컬 consistency 코퍼스(`related_specs` · `conventions` · `rationale_excerpts`)가 옛 트리로 고정돼 Rationale 연속성 검사가 동결 시점 기준이다
  - target 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` `is_nerv_mirror` 와 `collect_context` 의 `all_spec_files` 필터.
  - 상세: 미러는 코퍼스에서 빠지므로 `extract_rationale_sections(other_spec_files)` 는 옛 트리만 본다. 동결 이후 NERV 에서 바뀐 결정과 NERV 에서 새로 쓴 스펙의 Rationale 은 로컬 `--spec` · `--impl-*` 검사가 못 본다. 반대로 NERV 가 이미 뒤집은 옛 결정을 "기각된 대안"으로 잘못 주장할 수도 있다. 코드 주석은 "코퍼스를 미러로 옮기는 일은 단계 4e"라고 적지만 그 사이의 결과는 적지 않았다. 서버 쪽 `nerv_spec_check` 가 rationale-continuity 검사기를 갖고 있어 완전히 비는 것은 아니다. 스코프 디렉터리 자체는 필터 없이 수집되므로 `--impl-done spec/CLE-…/` 는 정상 동작한다(확인함).
  - 제안: `consistency-checker/SKILL.md` 나 CHANGELOG 에 "4e 전까지 로컬 검사는 동결 시점 옛 트리 기준, 이후 결정은 `nerv_spec_check` 가 담당"이라고 한 줄 적는다.

- **[INFO]** 훅의 fail-open 이 조용하고, 두 PR 의 머지 순서에 문서-구현 어긋남 창이 있다
  - target 위치: `guard_nerv_owned_paths.py` 의 `except Exception` → `sys.exit(0)`, docstring 문장 "막는 경로는 전환 단계를 따라 는다"(단어 누락).
  - 과거 결정 출처: `_lib/failopen_state.py` 헤더(`harness-guard-followups §E`, PR #999) — fail-open 은 침묵하지 않고 연속 발생을 보고한다는 방침. `.claude/docs/worktree-policy.md` §5 의 4-layer 가 fail 시 동작을 명시하는 관례.
  - 상세: 새 훅은 예외를 stderr traceback 으로만 내고 exit 0 이다. exit 0 의 stderr 는 모델에게 보이지 않으므로 훅이 깨져도 `spec/` 편집이 조용히 통과한다(미러는 CI `--check` 가 받지만 옛 트리는 아무것도 없다). 또 planner PR 을 먼저 머지하면 CLAUDE.md 가 아직 없는 훅과 CI 잡을 인용하는 창이 생기고, 역순이면 훅이 문서가 시키는 쓰기를 막는 상태(위 첫 발견)가 된다.
  - 제안: 훅 예외 경로가 `failopen_state` 를 쓰거나 최소한 stdout 으로 한 줄 알리게 한다. 두 PR 을 같은 시점에 머지하거나(`/merge-coordinate`) 머지 순서를 PR 본문에 고정한다. docstring 오타도 함께 고친다.

### 문제없음으로 확인한 것

- 자기-반증형 소정정 삭제(CLAUDE.md)는 새 근거를 함께 적었다("반증한 사람이 곧 초안을 쓸 수 있으므로 예외가 필요 없다", 결정 D8 안 A). 이 조항을 가리키던 앵커 링크는 짝 PR 이 CLAUDE.md 표와 developer SKILL 에서 함께 걷어내고, 남은 언급은 `plan/complete/**` 와 `CHANGELOG.md` 의 역사 기록뿐이다.
- draft 보존 계약(`#1242`·`#1243`)은 유지된다. `--spec` 은 절대경로를 받고(`_require_target` 은 `isfile` 만 본다), 본문은 `_target/` 스냅샷으로 남는다. planner PR 은 "옛 흐름에서"로 근거 서술만 과거형으로 바꿨다.
- 외부 LLM 호출 정책과 충돌하지 않는다. `pull.py` 는 curl 로 NERV REST 를 읽기만 하고 토큰은 `-K -` 로 넘겨 argv 와 출력에 남기지 않는다(worktree-policy §8 의 "토큰 값을 출력하지 않는다"와 같은 방향).
- 신설 CI 잡은 `spec-link-checks.yml` 헤더가 기록한 "가드 목록이 좁아 생긴 갭" 교훈(디렉터리째 · `!cancelled()` · no-op 통과)을 따르고 `test_workflow_yaml_structure` 에 등재됐다. CHANGELOG 항목도 있다.
- D1·D3·D4·D8 은 사용자 확정 결정이라 번복 여부를 따지지 않았다.

### 요약

이 변경의 핵심 결정(스펙 정본의 NERV 이전, 미러 도입, 소정정 폐지)은 새 근거와 함께 기록돼 있어 기각된 대안의 재도입이나 무근거 번복은 없다. 다만 전환 기간에 옛 트리와 새 구조가 겹치는 자리에서 세 가지 어긋남이 남는다. 첫째, 편집 가드가 자기 도입 원칙을 어기고 옛 트리를 통째로 막아 plan 완료 시 빌드 가드(승격 · plan 링크)와 교착한다(실측: 18개 spec, 12개 링크 파일). 둘째, 링크 · area-index 가드 범위를 좁힌 결정이 SoT 에 남지 않았다. 셋째, SPEC-DRIFT 역류 경로가 승인 대기 동안 push 게이트를 닫지 못할 수 있다. 나머지는 단계 4e · 5 에서 닫힐 전환기 갭을 문서에 명시하라는 보완이다.

### 위험도

MEDIUM
