# Architecture Review

### 발견사항

- **[WARNING]** 리팩터 도중 남은 중복 rationale 주석 — 이번 PR 이 세우려는 "예산 산술 단일 출처" 원칙과 상충
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:739-745` (`build_files_section` 내부, `_charge_notice` 호출 직전)
  - 상세: `_notice_cost()` → `_notice_text()` + `_charge_notice()` 로 바꾸면서 "Budget for the widest form of the note (kept == total gives the most digits)" 라는 동일 설명이 739-742줄(기존 문구)과 743-745줄(이번 diff 가 새로 추가한 문구)에 **두 벌** 남았다. 옛 문구를 지우지 않고 새 문구를 그 아래 이어붙인 형태로, 다음 편집자가 한쪽만 고치면 다시 두 설명이 어긋날 수 있다. `_charge_notice` 자체는 "예산 차감 산술이 두 번 갈라져 버그가 났다"는 문제를 한 곳으로 모아 해결한 좋은 리팩터인데, 그 근거 주석은 오히려 두 벌로 갈라진 채 남았다는 점이 아이러니하다.
  - 제안: 739-742줄(구 문구)을 삭제하고 743-745줄만 남긴다.

- **[WARNING]** 내부 전용 split sentinel 이 최종 checker 프롬프트로 그대로 유출 — 추상화 누출 + 무보정 예산 비용
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:679` (`_BUNDLE_FILE_SENTINEL` 정의), 생성처 `:351`(`format_file_bundle`)·`:447`(`extract_rationale_sections`), 소비처 `:699-741`(`truncate_file_bundle`)
  - 상세: `_BUNDLE_FILE_SENTINEL = "\n<!-- @bundle-file -->\n"` 는 `truncate_file_bundle` 이 파일 경계를 되찾기 위한 내부 파싱 마커일 뿐인데, 이를 벗겨내는 코드가 어디에도 없다. `budget_substitutions`/`build_checker_prompt_body` 를 거쳐 실제 checker 프롬프트(`_prompts/<checker>.md`)에 **문자 그대로** 실린다. checker sub-agent 는 마크다운을 렌더링해서 읽는 게 아니라 원문 토큰을 그대로 읽으므로, 679줄 docstring 의 "renders as nothing in markdown" 전제는 이 프롬프트의 실제 소비자에게는 적용되지 않는다 — 파일마다 의미를 설명받지 못한 `<!-- @bundle-file -->` 줄을 그대로 보게 된다.
    비용 측면도 있다: 파일 1개당 23자(`\n<!-- @bundle-file -->\n`)가 **순수 추가 비용**으로 발생한다(구 마커 `\n#### \`` 는 어차피 표시해야 할 heading 자체였으므로 추가 비용이 없었다). 이 23자는 `truncate_file_bundle` 의 예산 계산에는 정확히 포함되어 overflow 는 나지 않지만, 예산 상한 자체가 이를 보정해 올라가지는 않는다 — 바로 이 diff 의 sibling 파일(code_review_orchestrator.py)이 line-number gutter 오버헤드를 실측해 `_GUTTER_OVERHEAD = 1.08` 로 캡을 보정한 것과 대비된다. `spec/conventions/cafe24-api-catalog/**` 처럼 파일이 많은(~230개) 번들 하나에서만 약 5,300자(예산의 약 2%)가 순수 오버헤드로 소모된다.
  - 제안: `truncate_file_bundle` 이 최종 문자열을 반환하기 직전(또는 `budget_substitutions`/`build_checker_prompt_body` 진입 시)에 `text.replace(_BUNDLE_FILE_SENTINEL, "\n")` 한 줄로 벗겨내면 파싱 목적은 그대로 달성하면서 최종 산출물의 누출은 없앨 수 있다. 유지하기로 한다면 최소한 `_GUTTER_OVERHEAD` 사례처럼 실측 후 캡 보정이 필요하다.

- **[INFO]** 두 orchestrator 가 "파일 묶음 예산 관리"를 구조적으로 다른 방식으로 해결한다 — 이번 sentinel 결함의 근본 원인이 남아있음
  - 위치: `code_review_orchestrator.py:607`(`build_files_section`) vs `consistency_orchestrator.py:344`(`format_file_bundle`)+`:699`(`truncate_file_bundle`)
  - 상세: `code_review_orchestrator.build_files_section` 은 각 파일을 `file_parts`(header/diff/full_content 필드를 가진 dict 리스트)로 예산 계산이 끝날 때까지 구조화된 채로 들고 있다가 맨 마지막에만 문자열로 join 한다 — "파일 경계"가 애초에 재파싱 대상이 될 일이 없다. 반면 `consistency_orchestrator` 는 `format_file_bundle`에서 즉시 하나의 문자열로 합친 뒤 `truncate_file_bundle`이 그 문자열을 다시 쪼개 경계를 복원해야 한다. 이번에 고친 "본문의 레벨-4 헤딩을 파일 경계로 오인"하는 결함(동봉 plan 문서에 8회 재발로 기록)은 정확히 이 "구조화 데이터의 조기 문자열 직렬화 + 재파싱" 설계에서 비롯됐다. sentinel 도입은 증상(마커·본문 충돌)을 정확하고 테스트로 뒷받침되게 막은 실용적 패치지만, 원인(stringly-typed 중간 표현)은 그대로 남아 — 이론상 실제 문서가 우연히 `<!-- @bundle-file -->` 자체를 인용하는 극단적 경우 등 — 같은 클래스의 문제가 다른 모양으로 재발할 여지가 구조적으로 남는다.
  - 제안: 지금 당장 재설계할 필요는 없다(현재 테스트로 충분히 고정됨). 다만 이 영역에서 결함이 또 재발하면, sentinel 을 더 정교화하기보다 `format_file_bundle`/`extract_rationale_sections`도 `file_parts` 류의 구조화 리스트를 반환하고 `truncate_file_bundle`이 리스트 위에서 동작하도록(sibling 모듈이 이미 쓰는 패턴으로) 재설계하는 편이 근본적이다.

- **[INFO]** 새로 추가된 범용 유틸리티가 기존 공유 `lib/` 패키지 대신 각 orchestrator 파일에 로컬로 들어감
  - 위치: `_natural_key` — `consistency_orchestrator.py:213`. `_charge_notice` — `code_review_orchestrator.py:561`.
  - 상세: 두 orchestrator 는 이미 `.claude/skills/code-review-agents/lib/`(session, role_instructions 등)를 공유 라이브러리로 쓰고 있다. 이번에 추가된 `_natural_key`(정렬 키)와 `_charge_notice`(예산 차감)는 둘 다 도메인 무관 순수 함수인데 각자 파일에 로컬로 추가됐다. 현재는 사용처가 하나씩뿐이라 YAGNI 상 문제는 아니지만, `consistency_orchestrator.truncate_file_bundle`의 while-loop 노티스 재계산도 개념적으로 `_charge_notice`와 동일한 문제(추가되는 안내문 길이를 예산에 반영)를 다른 알고리즘(매 반복 재검증)으로 풀고 있어 — 세 번째 사용처가 생기면 공유 lib 승격을 검토할 만하다.
  - 제안: 지금 조치 불필요. 향후 세 번째 필요 지점이 생기면 `lib/` 이동 검토.

- **[INFO]** 스테일해진 인접 주석 — "input is already alphabetical"
  - 위치: `consistency_orchestrator.py:339-340` (`prioritize_bundle_files` 내부, `return sorted(...)` 바로 위)
  - 상세: `collect_markdown_files`(`:247` 부근)가 이번 diff 로 `files.sort()` → `files.sort(key=_natural_key)` 로 바뀌어 더 이상 순수 알파벳순이 아니라 natural-sort 순서를 넘긴다. 그런데 `prioritize_bundle_files` 안의 "`sorted` is stable and the input is already alphabetical" 주석은 그대로 남아 이제는 사실과 다른 전제를 서술한다. 결론(2차 키를 명시적으로 적어야 한다)은 여전히 유효하지만 전제 문구가 stale.
  - 제안: "already alphabetical" → "already naturally sorted" 정도로 갱신.

### 요약
이번 diff 는 리뷰/일관성 harness 의 두 orchestrator 스크립트에서 반복 재발(동봉 plan 문서 기준 8회)한 "번들 예산·파일 경계" 결함 계열을 다듬는 유지보수성 개선이며, 제품 코드베이스(backend/frontend)에는 영향이 없는 내부 tooling 변경이다. `_charge_notice` 추출(예산 차감 산술의 단일 출처화), `_BUNDLE_FILE_SENTINEL`(콘텐츠와 충돌 불가능한 파싱 경계로 교체), `_natural_key`(자연 정렬)는 각자의 목표를 정확하고 테스트로 뒷받침되게 달성했고, 대조한 diff 범위 안에서 SOLID 위반·순환 의존성·새로운 모듈 경계 침해는 발견되지 않았다. 다만 (1) 리팩터 도중 남은 중복 rationale 주석, (2) 내부 전용 sentinel 이 최종 LLM 프롬프트로 그대로 새어나가 추상화가 누출되고 그 비용이 — 이 코드베이스가 다른 곳(line-anchor gutter)에서는 실측·보정하는 관행과 달리 — 측정·보정 없이 방치된 점, (3) 두 orchestrator 가 "파일 묶음"을 구조화 데이터 대 조기-직렬화 문자열이라는 서로 다른 방식으로 표현해 이번 버그 계열의 구조적 뿌리가 여전히 남아있는 점이 눈에 띈다. 모두 차단 사유는 아니며, 향후 재발 시 참고할 개선 방향으로 남긴다.

### 위험도
LOW
