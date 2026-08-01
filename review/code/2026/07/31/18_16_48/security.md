# Security Review — retry_state/block_integrity 추출 + review_guard 강화

## 발견사항

- **[WARNING]** `BLOCK:` 판정 추출이 "첫 매치" 방식이라, 이 diff 가 새로 도입하는 다운그레이드 백스톱 자체가 실문서에서 뒤집힐 수 있다
  - 위치: `.claude/_shared/block_integrity.py:42`(모듈 레벨 `_BLOCK_LINE`), `:66-69`(`summary_block_verdict`) / `.claude/hooks/_lib/review_guard.py:141`(모듈 레벨 `_BLOCK_LINE`), `:693-704`(`_summary_block_is_no`)
  - 상세: 두 곳 모두 `_BLOCK_LINE.search(text)` — 문서 전체에서 **가장 먼저 나오는** `BLOCK:\s*(YES|NO)` 매치를 그 문서의 "판정"으로 취급한다(구조적 앵커 없음). 그런데 이 SUMMARY.md 는 LLM 이 자유 서술로 쓰는 문서이고, 실제로 이 리포에는 "직전 라운드는 BLOCK: X 였으나 재검증 후 BLOCK: Y 로 정정한다"는 서술을 관행적으로 쓴다 — 즉 자기 문서의 진짜 판정과 다른 BLOCK 토큰이 본문 앞쪽에 등장하는 경우가 실재한다.
    실측(`review/consistency/**/SUMMARY.md`, 이 저장소 자체): `BLOCK:` 토큰이 2개 이상인 파일 242개, 그중 값이 섞여 있는(YES 와 NO 가 공존) 파일 34개, `--impl-done` 세션만 좁혀도 11개. 그리고 **이미 어긋난 실제 사례를 확인**했다 — `review/consistency/2026/07/05/19_27_28/SUMMARY.md`: 문서 자신의 선언된 판정은 5번째 줄 `## BLOCK: NO` 인데, 그보다 앞선 3번째 줄에 "직전 19_19_53 BLOCK: YES 정정 후" 라는 서술이 있어 `_BLOCK_LINE.search()` 를 그대로 이 문서에 돌리면 **YES 가 추출된다 — 문서의 실제 판정과 정반대**. (이 특정 파일은 `--spec` 모드라 `_summary_block_is_no`/`block_integrity` 경로 자체를 타지는 않지만, 같은 summarizing 에이전트가 `--impl-done` 세션에도 동일한 "직전 판정 회고" 문장 패턴을 상시 사용하므로 — 실제로 mixed-value `--impl-done` 세션 11개가 이를 증명한다 — 순서가 뒤집히는 문서가 `--impl-done` 에서도 나오는 것은 시간 문제다.)
    이 파싱이 바로 이 diff 의 핵심 신규 로직(`block_integrity.contradiction_note`)과 기존 Gate 2(`_newest_resolved_impl_done_mtime`)가 "BLOCK: NO 인데 checker 가 CRITICAL 을 냈다"를 판정하는 데 쓰는 그 함수다. 오추출은 양방향으로 이 방어를 무력화한다: 실제로 막아야 할 BLOCK:YES 세션이 앞쪽의 우연한 "BLOCK: NO" 언급 때문에 통과된 것으로 읽히거나(방향상 더 위험), 정상적으로 통과해야 할 BLOCK:NO 세션이 과거 판정 회고 때문에 막힌 것으로 오판될 수 있다. 이 모듈 docstring 이 근거로 드는 "732개 세션 중 24개가 다운그레이드" 라는 실측치 자체도 동일한 `_BLOCK_LINE` 로 산출됐다면, 그 계수 일부가 이 순서 의존성의 영향을 받았을 가능성도 배제할 수 없다.
  - 제안: 문서 전체에 대한 bare `.search()` 대신, 같은 파일의 `_summary_is_resolved`(risk-level 추출)가 이미 하듯 구조적으로 앵커된 추출로 바꿀 것 — 예: 첫 markdown heading 이전(또는 지정된 "## 최종 결론/판정" 헤딩 아래)의 첫 `BLOCK:` 줄만 인정하거나, 재확정 서술 관행을 고려해 "최종/확정" 표식이 붙은 마지막 occurrence를 우선하는 규칙을 명시.

- **[WARNING]** 리뷰/체커 프롬프트에 원문 파일·diff 내용을 감싸는 단일 ``` 펜스가, 그 내용 자체에 포함된 백틱 3연속 시퀀스에 대해 보호되지 않음 (마크다운 펜스 breakout → LLM 에 전달되는 문서 구조 위조 가능성)
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:282`(`format_file_bundle`) 및 `:507`(`--impl-done` diff 섹션) / `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:503`(`build_files_section` 의 `old_code` 임베드)
  - 상세: `format_file_bundle`(consistency 쪽)은 `_neutralize_sentinel()`로 자체 경계 sentinel(`<!-- @bundle-file -->`)만 무력화할 뿐, 파일 본문이 자체적으로 품고 있는 ` ``` ` 시퀀스는 전혀 처리하지 않고 그대로 ` ```\n{content}\n``` ` 에 끼워 넣는다. 실측: 이 저장소의 `spec/` 아래 338개 파일, `plan/in-progress/` 아래 39개 파일이 실제로 줄 시작 위치의 bare ` ``` ` 펜스를 포함한다 — 즉 이들 중 하나라도 번들에 포함되면 오늘 당장 바깥 펜스가 조기 종료되어, 파일 자신의 내용 이후 부분이 "인용된 코드"가 아니라 프롬프트 최상위 구조(가짜 헤딩/지시문 등)로 렌더링될 수 있다. `--impl-done` 의 diff 섹션도 `_neutralize_sentinel`만 적용하고 동일한 결함을 공유한다.
    대조: `code_review_orchestrator.py`의 형제 경로(diff/`full_content`)는 `line_anchors.number_source_lines`/`annotate_unified_diff` 가 모든 줄에 숫자+`|` 게이트를 강제로 붙이기 때문에, 내용 중 bare ` ``` ` 줄이 있어도 그 줄은 더 이상 "줄 시작이 backtick"이 아니게 되어(CommonMark 상 닫는 펜스는 최대 3칸 공백만 허용) 우연히 펜스 breakout 을 막아준다. 그런데 바로 옆의 `old_code` 필드(`OLD_CODE_HEADING` 섹션)만 이 게이트링을 거치지 않고 원문 그대로 삽입된다 — 현재 이 스크립트의 CLI 경로는 `old_code`를 항상 `""`로 채워 실제로는 트리거되지 않지만(`build_cli_change_info`), `build_files_section`/`build_agent_prompt_body` 는 다른 caller 도 값을 채울 수 있는 공유 라이브러리 함수라 동일한 보호가 없는 채로 노출돼 있다.
  - 제안: `_BUNDLE_FILE_SENTINEL` 을 무력화하는 것과 같은 원칙으로, 임베드되는 원문의 최장 backtick 연속 길이보다 긴 펜스를 선택하거나(표준 마크다운 기법), consistency 쪽에도 `line_anchors` 류의 줄-프리픽스 처리를 적용해 code-review 쪽과 동일한 보호를 주고, `old_code` 경로도 같은 처리로 통일할 것.

- **[INFO]** 리뷰 게이트의 "커버리지/해결됨" 판정은 전적으로 산출물(파일 존재 여부·비어있지 않음·SUMMARY 텍스트 패턴) 기반이며, 실제 reviewer `Agent` 가 실행됐다는 암호학적/프로세스적 증거는 없음
  - 위치: `.claude/hooks/_lib/review_guard.py:400`(`_forced_coverage_missing`), `:438`(`_summary_is_resolved`) — 참고로 이 둘이 의존하는 `has_report()`는 이번 리뷰 대상 파일 목록 밖인 `.claude/_shared/report_paths.py:80`
  - 상세: 세션에 `_retry_state.json` 자체가 없으면 forced-reviewer 검사는 통째로 스킵되고(fail-open, 코드 자신의 주석이 "세션은 매니페스트를 없앰으로써 이 검사를 피해갈 수 있다"고 명시), `has_report()`는 1바이트 이상이면 통과시킨다. 즉 수기로 `SUMMARY.md`(+ 최소한의 placeholder 리포트)만 작성해도 `evaluate_review()`의 Gate 1(코드 리뷰 커버리지)을 만족시킬 수 있다 — 리뷰 에이전트가 한 번도 실행되지 않았어도.
    다만 이는 이 diff 가 새로 만든 결함이 아니라 모듈 자신이 "a strong nudge, not a precise oracle"라고 명시적으로 선언한 기존의 의식적 트레이드오프이며 `BYPASS_REVIEW_GUARD=1` 과 같은 결의 설계다. 인증/인가 관점 완결성을 위해 기록만 해 둔다.

- **[INFO]** `review_guard.py` 전반의 fail-open 설계 — 내부 오류 시 기본값이 "차단 안 함"
  - 위치: `.claude/hooks/_lib/review_guard.py` 모듈 docstring(1-89번 줄) 및 `_run_git`(181-192번 줄) 등
  - 상세: git 서브프로세스 실패, JSON 파싱 실패, import 실패 등 내부 오류가 발생하면 게이트는 일관되게 "허용"으로 fallback 한다. 이는 문서화된 의도적 설계("a guard must never wedge the session")이며 신규 결함이 아니다. 인증/인가 우회 가능성이라는 리뷰 관점상 존재를 명시해 둔다.

- **[INFO]** `code_review_orchestrator.py`의 `--files`/디렉토리 CLI 경로가 저장소 루트로 경로를 제한하지 않음
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:941`(`get_directory_files`), `:1227`(`collect_change_infos` 의 `elif args.files:` 분기), `:951`(`build_cli_change_info`)
  - 상세: CLI 인자로 저장소 밖의 경로(예: 자격증명 파일)를 넘기면 그 내용이 그대로 읽혀 reviewer 프롬프트에 임베드되고, 이후 `Agent` tool 을 통해 외부 LLM 에 전달된다. 다만 이를 호출하는 주체(로컬 오퍼레이터 또는 이를 조율하는 메인 세션)는 이미 Bash/Read 로 동일한 데이터를 어디로든 보낼 수 있는 권한을 갖고 있어 실질적으로 새로운 권한 상승은 아니다 — 심층방어 차원에서만 저장소 루트 하위로 경로를 제한하는 검증을 권장.

## 요약

이번 diff 가 새로 추가한 두 모듈(`block_integrity.py`, `retry_state.py`) 자체의 코드는 안전하다 — `subprocess` 는 전부 리스트 형태로 호출돼 셸 인젝션 경로가 없고, `eval`/`exec`/`pickle`/불안전한 YAML 로딩이 없으며, 하드코딩된 시크릿도 없다. 다만 리뷰 대상으로 전체 맥락이 제공된 기존 파일들을 함께 읽으며, 이 diff 가 강화하려는 바로 그 안전장치를 무력화할 수 있는 두 가지 실질적 약점을 실측 증거와 함께 찾았다: (1) `BLOCK:` 판정을 문서 전체에서 "첫 매치"로 추출하는 방식이 이 저장소의 실제 SUMMARY.md 관행(직전 판정을 회고하는 서술)과 충돌해 이미 최소 1건에서 뒤집힌 결과를 냈고, 이 함수가 바로 이번 diff 의 다운그레이드 백스톱과 Gate 2 판정에 쓰이며, (2) 스펙/플랜 원문이나 `old_code` 필드가 백틱 펜스 보호 없이 임베드돼, 흔한 코드 예제가 포함된 문서(338+39개 확인) 만으로도 오늘 당장 프롬프트의 펜스 구조가 깨진다. 두 건 모두 즉각적 원격 공격이라기보다 AI 리뷰/컨시스턴시 파이프라인 자체의 무결성에 대한 견고성 결함이며, 나머지는 이미 문서화되고 의식적으로 받아들여진 fail-open/아티팩트-신뢰 설계에 대한 완결성 차원의 기록이다.

## 위험도

MEDIUM
