# Architecture Review — harness-review-gate-fixes-1bd6aa (세션 2026/07/31 13_35_34)

## 조사 방법

프롬프트에 전체 내용이 실리지 않은 4개 파일(`review_guard.py`, `_probe_main.py`,
`code_review_orchestrator.py`, `consistency_orchestrator.py`)은 워크트리에서 `Read`로 직접
확인했다. `git diff origin/main...HEAD`(10개 커밋)로 실제 변경분 전체를 확인하고, 직전 두 라운드
산출물(`review/code/2026/07/31/11_58_11/architecture.md`, `12_38_42/architecture.md`)을 읽어
그 라운드가 낸 WARNING/INFO(예외 처리 통일·브랜치 해석 4곳 중복·in_flight_ok 플래그·
`build_files_section` 예산 회계·하향 금지 backstop 부재)가 이번 diff 로 어떻게 처리됐는지
재확인했다 — 전부 이미 반영되었거나(예외 처리) 사용자 승인 하에 `plan/in-progress/*.md`에 defer
로 추적 중이라 재발견하지 않는다. 이번 라운드는 두 가지를 새로 검증했다: (1) 3R 커밋(`d19e01880`)이
고친 `build_files_section` 예산 재발 CRITICAL 의 실제 반영 상태, (2) `consistency_orchestrator.py`의
4-계층 정렬(`prioritize_bundle_files`)이 실제로 적용된 **모든** 번들 지점을 호출 그래프로 추적.

## 발견사항

- **[CRITICAL]** `prioritize_bundle_files` 4-계층 재배열이 `plan_in_progress` 번들에는 적용되지 않아, 이 PR 이 "8회 재발 종결"이라 서술하는 바로 그 결함 클래스가 `plan_coherence`/`naming_collision` 경로에 그대로 남아 있다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:575`(`plan_files = collect_markdown_files(plan_dir, exclude_paths=excluded)` — `_prioritized()` 미호출), `:586`(`plan_in_progress = format_file_bundle(plan_files, ...)` — 정렬 안 된 채 렌더). 대조: 형제 두 번들은 바로 위 `:581`-`582`에서 `other_spec_files = _prioritized(other_spec_files)` / `convention_files = _prioritized(convention_files)`로 처리된다. 소비 계약: `_corpus_keys`(`:696`-`699`)가 `plan_coherence`의 **유일한** 코퍼스로, `naming_collision`의 3개 중 하나로 `plan_in_progress`를 지정한다. 실제 절단: `budget_substitutions`(`:717`-`725`)가 이 키에도 다른 코퍼스와 동일하게 `truncate_file_bundle(context.get(key, ""), share)`을 적용하므로, 정렬되지 않은 채 알파벳순 tail-drop 절단을 그대로 받는다.
  - 상세: 이번 PR(구체적으로 `fd79c8dbb`/`a36e58766`, 3R 이전 라운드에서 이미 완료 처리됨)이 도입한 `prioritize_bundle_files`는 "브랜치 변경 → plan 언급 → 나머지 → 카탈로그 대량 문서" 4계층으로 번들을 재배열해, 알파벳순+tail-drop 조합이 실제 작업 대상 문서를 예산 밖으로 밀어내던 문제(동일 세션에서 8회 실측 재발, `plan/in-progress/harness-consistency-summary-downgrade-rule.md`)를 닫는다고 서술한다. 그런데 그 문서 자신이 기록한 "3회 재현" 표의 **4번째 사례**(`consistency/2026/07/27/09_16_22`, `--spec` 모드)는 정확히 `plan_in_progress` 번들에서 밀접한 sibling plan 2건이 예산 초과로 생략되고 **`plan_coherence` checker 자신이 그 사실을 직접 지적**한 사례였다. 이번 fix 의 커밋 로그·plan 문서 모두 "적용 지점: `--impl-prep`/`--impl-done` 의 scope 번들 + `related_specs` + `conventions`" 라고 스코프를 명시하는데, 이 목록에 `plan_in_progress` 는 없다 — 다른 세 지점(카탈로그 강등, tier 우선순위, 나머지 tier 배제 이유)은 각각 코드에 근거 주석이 달려 있는 반면 `plan_in_progress` 제외에는 어떤 설명도 없어, 의도된 스코프 축소가 아니라 누락으로 보인다. 이 갭은 이론적이지 않다: 실측(`ls plan/in-progress | wc -l` = 31개 파일, `du -sh` ≈ 1.0MB)이 `plan_coherence`의 예산 배분(`CONSISTENCY_MAX_CONTEXT_SIZE` 기본 262144 × `CHECKER_BUDGET_RATIO["corpus"]` 0.40 ÷ 1개 키 ≈ 104,857자)을 약 10배 초과한다 — 즉 이 저장소의 현재 상태에서 `plan_coherence`/`naming_collision`을 호출하는 모든 `--spec`/`--plan`/`--impl-prep`/`--impl-done` 실행에서 `plan_in_progress` 절단이 사실상 상시 발생하며, 그 절단은 여전히 알파벳순 tail-drop 기준이다. `truncate_file_bundle`이 생략된 파일을 이름으로 알리기는 하지만(침묵은 아님), 같은 plan 문서의 3회차 관측 자체가 "checker 가 알아서 우회한다는 완화책은 checker 마다 불균등하다"고 결론 내린 바 있어 이 안내만으로 안전하다고 보기 어렵다. `plan_coherence`의 임무(`spec/conventions/**` 미해결 결정·선행 plan 미해소·후속 항목 누락 검출)가 바로 "관련된 다른 plan 문서를 봤는가"에 의존하므로, 이 갭은 게이트가 대상을 실제로 본 적 없이 `BLOCK: NO`를 낼 수 있는 경로를 하나 남겨 둔 채 이번 라운드가 지나간다는 뜻이다. `test_consistency_bundle_priority.py`의 4개 `CollectContextUsesPriorityTest` 케이스(`impl_prep`/`impl_done`의 `target_doc`, `related_specs`, `conventions`)도 `plan_in_progress`는 검증하지 않아 이 누락을 테스트도 못 잡는다.
  - 제안: `collect_context`의 `plan_files = collect_markdown_files(plan_dir, exclude_paths=excluded)` 직후 `plan_files = _prioritized(plan_files)`(다른 두 지점과 동일한 한 줄 패턴)를 추가한다. `_rank_plan_text`가 이미 `plan_dir`전체를 읽어 두었으므로 추가 git 호출은 없다. `test_consistency_bundle_priority.py`에 `test_plan_in_progress_uses_the_ranked_order`(다른 4개 케이스와 동일한 sentinel-order 패턴)를 추가해 재발을 막는다.

- **[WARNING]** 원본 오케스트레이터의 참조되지 않는 1,304줄 드리프트 사본이 이번 diff 로 신규 커밋되어, 이 PR 자신이 고치고 있는 "프롬프트 예산 낭비" 문제를 스스로 재현한다.
  - 위치: `.claude/skills/code-review-agents/scripts/_probe_main.py` (전체 파일, 커밋 `d19e01880`에서 신규 추가 — `git diff origin/main...HEAD`로 확인)
  - 상세: 이 파일은 `code_review_orchestrator.py`의 거의 완전한 사본이다(diff 결과 두 파일의 실질 차이는 정확히 이번 라운드가 `code_review_orchestrator.py`에만 적용한 최신 수정분 — `_omitted_content_note`, `_default_branch_ref`, aggregate-omission 예산 회계 — 뿐이다). 즉 리팩터링된 헬퍼도, 새 진입점도 아니라 커밋 시점 이전의 **stale 스냅샷**이다. `grep -rn "_probe_main"`을 저장소 전체에 돌리면 이 세션 자신이 생성한 `_retry_state.json`/`meta.json`(리뷰 대상 파일 목록) 외에는 어떤 코드·테스트·문서도 이 파일을 참조하지 않는다 — 즉 완전히 죽은 코드다. 이름(`_probe_main.py`, 밑줄 접두사)과 실행 가능한 CLI 구조(동일한 `sys.path` 조작·`lib.line_anchors`/`lib.router_safety` 등 동일 임포트)로 미루어 보아 로컬 실험/프로빙 중 실제 프로젝트 디렉터리에 사본을 만들어 두고 정리하지 않은 채 커밋에 딸려 들어간 것으로 보인다(스크래치 공간이 아니라 production skill 스크립트 디렉터리에 위치). 아키텍처 관점에서 세 가지 비용이 있다: (1) DRY 위반이 함수 단위가 아니라 파일 전체(1,304줄) 규모다 — 이 저장소가 "실제 동일 보일러플레이트만 추출하고 발산은 defer 한다"는 원칙을 갖고 있는 대상과 정반대로, 발산한 두 버전을 모두 유지하는 형태가 됐다. (2) 미래의 유지보수자가 두 파일 중 무엇이 SoT 인지 이름만으로 판별할 신호가 없다(둘 다 "Code Review Agents Orchestrator" docstring 으로 시작). (3) 이 파일 자체가 55,309자로, 이번 리뷰 세션의 14개 reviewer prompt 각각에서 "내용이 실리지 않음" 안내 슬롯 하나씩을 소비했다 — 이번 PR 이 정확히 고치고 있는 "죽은/무관한 대용량 콘텐츠가 프롬프트 예산을 갉아먹는다"는 문제 클래스를 이 PR 자신의 리뷰 세션에서 재현한 것이다.
  - 제안: 삭제. 참조가 전혀 없으므로 되돌릴 코드 경로가 없다(단, 삭제 전 `git log -p`로 의도된 산출물이 아님을 재확인할 것 — 위 grep 결과상 그럴 가능성은 낮다). 향후 유사 실험은 스크래치 디렉터리(리포지토리 밖)에서 수행하고, `git status`/`git add` 전 diff 대상 파일 목록을 눈으로 확인하는 습관으로 재발을 막을 수 있다.

- **[INFO]** `build_files_section`이 이번 라운드의 CRITICAL 수정(집계형 생략 고지 폴백) 이후에도 여전히 서로 다른 3개 예산 전략(무예산/header+diff 초과/콘텐츠 예산 할당)을 한 함수(587-771줄, 약 185줄)에 누적하고 있다 — 이미 두 차례(`12_38_42/architecture.md` WARNING #1, `plan/in-progress/harness-review-gate-ci-backstop.md` 신규 후속 3번) 추적된 사안의 재확인.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:587`-`771`(`build_files_section` 전체), 특히 `:703`-`736`(`_notice_cost`/`refund`/`remaining_budget` 예산 회계), `:738`-`771`(이번 라운드가 추가한 `_render(per_file_notice)` + 집계 폴백)
  - 상세: 이번 라운드의 CRITICAL 수정 자체는 건전하다 — `_render(per_file_notice=False)`로 body 를 먼저 완성한 뒤 `max_total_size - len(body)`라는 **실측 잔여 공간**을 `_aggregate_omission_note`에 넘기는 방식이라, 직전 라운드가 겪은 "사전 예약치가 실제 필요량과 어긋난다"는 회귀 클래스를 이 지점에서는 구조적으로 재현하지 않는다(사전 예약이 아니라 사후 실측이므로). 다만 함수 자체는 이 수정으로 22줄(749→771) 더 길어졌고, `consistency_orchestrator.truncate_file_bundle`이 "매 반복마다 실제 크기를 재검증"하는 단일 알고리즘으로 동일 문제를 일반적으로 풀어 둔 것과 달리, 이 함수는 세 분기가 각자 다른 회계 방식(무조건 포함 / diff 트리밍 / reserve-refund)을 쓴다. 이미 defer 항목으로 등재돼 있고 이번 라운드는 그 구조를 악화시키지 않았으므로 새 조치를 요구하지는 않지만, 다음에 이 함수에 손을 댈 때 세 번째 유사 버그가 나올 표면이 여전히 넓다는 점은 재확인해 둔다.
  - 제안: 추가 조치 불요(이미 defer 확정, 테스트로 두텁게 방어됨 — `test_prompt_omission_notice.py` 8건 + 이번 라운드 3건 추가). 그 함수를 다시 수정할 계기가 생기면 `_render_unbounded`/`_render_diff_only_overflow`/`_allocate_content_budget` 분리를 함께 처리할 것을 권장(기존 제안 유지).

## 요약

이번 diff(브랜치 전체, 10개 커밋)는 review-gate 하네스의 3개 축 — `evaluate_review`의 in-flight 억제를 Stop 전용으로 스코프 축소, consistency/code-review 두 오케스트레이터의 프롬프트 번들링(우선순위 재배열 + 생략 고지 + 예산 회계), "Critical 하향 금지 + planner 인계" 거버넌스 — 를 다루며 이전 두 리뷰 라운드가 낸 CRITICAL/WARNING 은 실제로 반영되었거나(`_default_branch_ref` 예외 처리, `--staged` 면제, subprocess cwd 격리, 집계형 생략 고지 폴백) 근거와 함께 명시적으로 defer 되어 있다(브랜치 해석 4곳 중복, 하향 금지 backstop, `in_flight_ok` 불리언 플래그, `build_files_section` 3전략 혼재). `evaluate_review`의 키워드 전용 opt-in 확장과 양방향 seam 테스트, `prioritize_bundle_files`/`format_file_bundle`/`truncate_file_bundle`의 책임 분리, hooks(집행)↔skills(세션 준비)↔agents(prompt 정의) 3계층의 무순환 의존은 구조적으로 건전하다. 그러나 이번 라운드에서 새로 발견된 두 건은 그 자체로 이 PR 의 핵심 주장("대상을 못 본 채 게이트가 통과된다는 8회 재발 결함군을 닫았다")에 직접 반례가 된다 — `plan_in_progress` 번들은 동일한 4-계층 정렬 수정에서 빠져 있고, 이는 그 서술이 근거로 드는 "3회 재현" 표의 4번째 사례가 다루는 바로 그 번들이다(CRITICAL). 그리고 이번 커밋은 그와 별개로 참조되지 않는 1,304줄짜리 오케스트레이터 드리프트 사본(`_probe_main.py`)을 신규 도입해, 이 PR 이 고치는 "프롬프트 예산 낭비" 문제 클래스를 리뷰 세션 자체에서 재현했다(WARNING). 두 건 모두 수정 비용은 낮다 — 전자는 이미 세 곳에서 쓰인 것과 동일한 한 줄 패턴 적용, 후자는 단순 삭제다.

## 위험도

HIGH
