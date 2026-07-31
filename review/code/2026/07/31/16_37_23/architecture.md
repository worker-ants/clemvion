# Architecture Review

### 발견사항

- **[WARNING]** 내부 파싱 전용 sentinel 이 최종 checker 프롬프트에 미가공 노출 (추상화 경계 누출, 이전 라운드 지적 사항 — 아직 미해결)
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:362`(`format_file_bundle`), `:449`(`extract_rationale_sections`), `:698`(`_BUNDLE_FILE_SENTINEL` 정의), `:718`(`truncate_file_bundle`)
  - 상세: `_BUNDLE_FILE_SENTINEL = "\n<!-- @bundle-file -->\n"`는 `truncate_file_bundle`이 파일 경계를 복원하기 위한 내부 파싱 마커일 뿐인데, 이를 벗겨내는 코드가 어디에도 없다(직접 확인). `budget_substitutions`→`build_checker_prompt_body`를 거쳐 5개 checker sub-agent 프롬프트(`_prompts/<checker>.md`)에 문자 그대로 실린다 — "내부 표현" 레이어와 "외부(LLM)에 보여줄 콘텐츠" 레이어의 경계가 분리되지 않았다. 파일 1개당 23자가 순수 오버헤드로 추가되고(구 마커 `\n#### \``는 어차피 표시할 heading 자체였으므로 오버헤드가 없었다), `truncate_file_bundle`의 예산 계산에는 정확히 반영돼 overflow는 없지만, 예산 상한 자체는 — 같은 diff 의 sibling 파일(`code_review_orchestrator.py`)이 line-anchor gutter 오버헤드를 실측해 `_GUTTER_OVERHEAD = 1.08`로 보정한 것과 달리 — 실측·보정 없이 방치된다. `spec/conventions/cafe24-api-catalog/**` 처럼 파일이 많은(~230개) 번들 하나에서만 약 5,300자(예산의 약 2%)가 설명 없는 오버헤드로 소모된다.
  - 제안: `truncate_file_bundle`이 최종 문자열을 반환하기 직전(또는 `budget_substitutions` 진입 시)에 `text.replace(_BUNDLE_FILE_SENTINEL, "\n")`로 벗겨낸다. 유지하기로 한다면 최소한 `_GUTTER_OVERHEAD` 사례처럼 실측 기반 캡 보정을 추가한다.

- **[WARNING]** "본문은 경계를 위조할 수 없다"는 신규 불변식이 4개 진입점 중 2곳에만 적용됨 — `--spec`/`--plan`/`--impl-done`diff 구간은 여전히 무방비
  - 위치: `consistency_orchestrator.py:213`(`_neutralize_sentinel` 정의, `:368`·`:466`에서만 호출) vs `:554`·`:561`(`--spec`/`--plan`의 `target_doc = read_text_file(target_abs)` — 미호출) 및 `:584`-`:598`(`--impl-done`의 `diff_text = _collect_code_diff(...)`/`diff_section` — 미호출) → 전부 `:718`(`truncate_file_bundle`)로 합류
  - 상세: 이번 diff가 도입한 `_neutralize_sentinel`은 `format_file_bundle`/`extract_rationale_sections`(스펙·plan "번들" 경로)에만 적용된다. 그런데 `budget_substitutions`는 모드 구분 없이 `context["target_doc"]`을 그대로 `truncate_file_bundle`에 넘기고, `--spec`/`--plan`의 원본 단일 문서(`read_text_file` 직접 결과)와 `--impl-done`의 raw git diff 텍스트는 이 안전장치를 거치지 않은 채 같은 함수에 도달한다. `truncate_file_bundle`자체의 docstring(":730" 부근)은 "a single --spec/--plan document, or --impl-done's diff section"을 "text with no file markers"라고 서술하는데, 이는 강제되는 성질이 아니라 우연에 기댄 가정이다 — 정확히 이번 PR이 스펙 번들 쪽에서 "본문이 우연히 마커를 만들 수 있다"며 고친 것과 동일한 사각지대가 다른 두 진입점에는 문서화된 가정으로만 남는다. 실제로 이 plan 문서 자신이 sentinel 리터럴을 산문으로 인용하고 있어(`plan/in-progress/harness-consistency-summary-downgrade-rule.md:125`), 그 파일이 향후 `--plan` 검토 대상이 되거나 diff 에 포함되면 이 경로를 직접 자극한다.
  - 제안: 안전장치를 소비 지점(`truncate_file_bundle` 진입부 또는 `budget_substitutions`가 `target_doc`을 조립하는 지점)으로 옮겨 모든 생산자에 공통 적용하거나, 최소한 `--spec`/`--plan`의 `read_text_file` 결과와 `diff_text`에도 `_neutralize_sentinel`을 호출해 네 진입점 전부를 동일하게 보호한다.

- **[WARNING]** `build_files_section` 한 함수가 서로 다른 4가지 절단 알고리즘을 겸임 — 이번 diff의 `_charge_notice` 추출은 증상(예산 산술 이원화)만 봉합
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:607`-`807`(`build_files_section` 전체 스팬), 특히 overflow 경로 `:678`-`717`과 콘텐츠 예산배분 경로 `:719`-`772`
  - 상세: 이 함수는 (1) 무제한 예산 통과 경로, (2) 헤더+diff 만으로 이미 초과인 overflow 경로(diff 후단 트리밍), (3) 파일별 콘텐츠 예산 배분(중첩 `_render`/`_notice_text` 클로저 포함), (4) 전량 미포함 시 집계 생략 안내 — 4개의 독립적 절단 알고리즘을 한 함수·한 스코프에 담고 있다. 이번 diff가 추가한 `_charge_notice`(`:561`)는 "예산에서 안내문 길이를 차감"하는 산술이 서로 다른 두 분기에서 각각 다르게(그리고 다르게 틀리게) 구현됐던 문제를 하나의 이름 있는 호출로 통합한 좋은 리팩터다. 그러나 `_charge_notice` 자신의 docstring이 인정하듯 "두 실수가 서로 다른 분기에서 났기 때문에 연속된 리뷰 라운드에서 따로 발견됐다" — 근본 원인은 산술이 흩어진 것 자체가 아니라 **네 알고리즘이 한 함수에 섞여 있어 각 분기의 불변식을 독립적으로 추론·테스트하기 어렵다는 것**이며, 이번 수정은 그 증상만 봉합했다.
  - 제안: overflow 전용 경로(`:678`-`717`)와 콘텐츠 예산배분 경로(`:719`-`772`)를 이름 있는 별도 함수로 추출해, 각 분기가 자신의 예산 불변식을 독립적으로 테스트·추론할 수 있게 한다.

- **[INFO]** 두 orchestrator가 "문서 묶음 예산 관리"를 구조적으로 다른 방식으로 해결 — 이번 sentinel 결함 계열의 근본 원인
  - 위치: `code_review_orchestrator.py:607`(`build_files_section` — `file_parts` 구조화 리스트를 마지막에만 join) vs `consistency_orchestrator.py:362`(`format_file_bundle` — 즉시 단일 문자열로 직렬화) + `:718`(`truncate_file_bundle` — 그 문자열을 sentinel로 재분해)
  - 상세: `code_review_orchestrator`는 파일별 정보를 dict 리스트(`header`/`diff`/`full_content`/`rel_path`/`source_lines`/`total_lines`)로 예산 계산이 끝날 때까지 구조화된 채 유지하다 최종 렌더 시에만 문자열로 합친다 — "파일 경계"가 애초에 재파싱 대상이 될 일이 없다. 반면 `consistency_orchestrator`는 `format_file_bundle`에서 즉시 하나의 문자열로 합치고, `truncate_file_bundle`이 그 문자열을 다시 sentinel로 쪼개 경계를 복원해야 한다. 헤딩 마커 충돌 → sentinel 도입 → sentinel 자체의 본문 충돌 방어(이번 diff)로 이어진 결함 계열은 전부 이 "구조화 데이터의 조기 문자열화 + 재파싱" 설계에서 비롯됐다. 동일 저장소의 sibling 모듈이 같은 문제를 구조화 데이터 유지 방식으로 sentinel 없이 풀고 있다는 사실 자체가, 이 설계가 필수가 아님을 보여준다.
  - 제안: 지금 재설계가 급하지는 않다(현재 테스트로 충분히 고정됨). 다만 이 계열 결함이 다시 재발하면 sentinel을 더 정교화하는 대신 `format_file_bundle`/`extract_rationale_sections`도 `(rel_path, content)` 구조화 리스트를 반환하고 `truncate_file_bundle`이 그 리스트 위에서 동작하도록(형제 모듈이 이미 쓰는 패턴) 재설계할 것.

- **[INFO]** 신규 공용 유틸리티가 기존 공유 lib 대신 각 orchestrator 로컬로 계속 증식 — 두 orchestrator 간 상태관리 중복과 같은 패턴의 확장
  - 위치: `_natural_key` — `consistency_orchestrator.py:229`. `_charge_notice` — `code_review_orchestrator.py:561`. 대조군: 두 orchestrator가 이미 공유 중인 `.claude/skills/code-review-agents/lib/`(session, role_instructions) 및 `.claude/_shared/report_paths.py`.
  - 상세: 두 orchestrator는 `_load_state`/`_save_state`/`_reconcile_state_with_disk`/`_emit_summary_state`/`_apply_status_update`를 "Mirrors X — change both" 주석(예: `consistency_orchestrator.py:109`)으로 수동 동기화하며 중복 보유한다. 이번 diff가 추가한 `_natural_key`(정렬 키)와 `_charge_notice`(예산 차감)는 둘 다 도메인 무관 순수 함수인데, 상대편에 대응 구현 없이 각자 파일에 로컬로 추가되어 같은 확산 패턴을 반복한다. `report_paths.py`가 이미 "규칙 하나, 소비자 셋"으로 공유화에 성공한 선례가 있고 두 스크립트가 이미 `sys.path` 조작으로 서로의 `lib/`를 상호 참조 가능하다는 점(`consistency_orchestrator.py:34`의 `sys.path.insert(0, CODE_REVIEW_SKILL)`)에서, 상태관리 함수들의 중복은 기술적으로 못 옮길 이유가 없다.
  - 제안: 지금 조치는 불필요(사용처가 각 1곳). 세 번째 사용처가 생기거나 상태관리 함수 중 하나가 다시 drift하면 공유 `lib/retry_state.py`(가칭)로 승격을 검토.

- **[INFO]** `prioritize_bundle_files`의 tier 판정이 하드코딩된 if/elif 체인 — plan 이 이미 다음 신호(계층) 도입을 예고한 상태
  - 위치: `consistency_orchestrator.py:341`-`354`(`tier` 내부 함수, 4단계 반환)
  - 상세: 현재 계층 0(branch-changed)/1(plan-mention)/2(기타)/3(catalog bulk) 판정은 `tier()` 함수 안에 순서 의존적인 if/elif로 직접 기술돼 있다. 등록형 규칙 목록이 아니므로 새 신호를 추가하려면 이 함수 본문을 다시 읽고 기존 계층과의 상호작용(주석이 설명하는 "0 은 3 을 이긴다", "1 은 3 에 진다" 등)을 재검증하며 끼워 넣어야 한다. 동봉된 plan 문서(`plan/in-progress/harness-consistency-summary-downgrade-rule.md:104`)가 이미 다음 신호로 "plan frontmatter 의 `spec_impact` 목록을 folder dump 보다 우선 포함"을 미해결 항목으로 남겨두고 있어, 이 확장 지점은 가정이 아니라 이미 예정된 근접 미래 요구다.
  - 제안: 지금 재설계할 필요는 없다(신호가 4개뿐이고 각각 근거 주석이 충실하다). 다음 신호(`spec_impact`)를 추가할 때, `tier()`를 더 늘리기보다 "predicate → tier 번호" 순서 목록으로 옮겨 각 규칙의 우선순위 상호작용을 목록 순서 자체로 표현하는 편을 검토.

### 요약
이번 diff는 harness 리뷰/일관성 두 orchestrator에서 반복 재발(동봉 plan 기준 8회)한 "번들 예산·파일 경계" 결함 계열의 후속 수정이며, 이전 라운드(15:46)가 발견한 CRITICAL(2단계 truncation의 총 줄 수 오보고)은 `source_lines`/`total_lines` 필드를 통해 단일 진실 값을 dict 로 threading 하는 방식으로 올바르게 고쳐졌고, 같은 라운드가 지적한 중복 rationale 주석과 stale 주석("already alphabetical")도 확인 결과 이미 정리됐다. 순환 의존성은 발견되지 않았고(`consistency_orchestrator`→`code-review-agents/lib` 단방향), `_natural_key`/`_charge_notice` 자체는 각자 잘 응집된 순수 함수다. 다만 (1) `_BUNDLE_FILE_SENTINEL`이 내부 파싱 마커임에도 벗겨지지 않은 채 최종 LLM 프롬프트로 그대로 새어나가고(이전 라운드 지적, 아직 미해결), (2) 그 sentinel 을 방어하는 `_neutralize_sentinel`이 4개 target_doc 생산 경로 중 2곳(스펙 번들)에만 적용되어 나머지 2곳(`--spec`/`--plan` 원본 문서, `--impl-done`의 diff 구간)은 "본문이 우연히 마커를 만들지 않는다"는 문서화된 가정에만 의존하며, (3) 이번에 고친 예산 산술 버그의 진짜 근원인 `build_files_section`의 다중 알고리즘 겸임 구조는 그대로 남아있다. 이 세 가지는 모두 이번 diff가 만든 새로운 결함이 아니라 기존 설계의 잔존 표면이며, 두 orchestrator가 "문서 묶음 예산"을 구조화 데이터 대 조기-직렬화 문자열이라는 서로 다른 방식으로 표현한다는 근본 비대칭에서 파생된다(sibling 모듈은 sentinel 없이 이미 이 문제를 구조적으로 회피하고 있어 재설계 방향의 참고가 된다). 차단 사유는 없다.

### 위험도
LOW
