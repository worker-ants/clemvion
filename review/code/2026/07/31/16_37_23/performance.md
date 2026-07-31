# Performance Review

## 발견사항

- **[INFO]** `total_lines` 계산이 "지연 계산"에서 "즉시(eager) 계산"으로 바뀌어 대부분의 파일에서 쓰이지 않는 스캔이 추가됨
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:633-634` (`build_files_section`, `numbered = ...` / `total_lines = numbered.count("\n") + 1 if numbered else 0`)
  - 상세: 변경 전에는 줄 수(`.count("\n")`)가 2차 절단(프롬프트 전체 예산 초과로 다시 잘리는 경우)이 실제로 필요한 파일에 한해서만, 그것도 `for i in content_indices:` 루프가 `break` 로 즉시 끝나므로 **세션당 최대 1개 파일**에 대해서만 계산됐다(옛 코드: `else` 분기 안의 `line_count = file_parts[i]["full_content"].count("\n") + 1`). 변경 후에는 `total_lines` 이 `change_infos` 의 **모든 파일**에 대해 무조건, `max_file_size` 1차 절단보다도 앞서 원본 `numbered` 전체 위에서 계산되어 `file_parts[i]["total_lines"]`(662-663행)에 저장된다. 이 값을 실제로 읽는 곳은 756행(`total_lines = file_parts[i]["total_lines"]`) 단 한 곳, 즉 여전히 최대 1개 파일뿐이라 나머지 모든 파일에 대한 스캔은 버려진다.
    `.count("\n")` 자체는 C 레벨 선형 스캔이라 파일 1개당 비용은 작지만, `build_files_section` 은 `build_agent_prompt_body`(810행 이하, 호출부는 855행·943행)를 통해 **reviewer(agent)마다 한 번씩**(기본 13~14개 agent, `prepare_session` 1116행의 `for agent in config["agents"]:` 루프) 동일한 `change_infos` 를 놓고 처음부터 다시 호출된다 — 이 재실행 구조 자체는 이번 diff 이전부터 있던 것이지만, 그 위에서 새로 추가된 무조건 스캔은 "파일 수 × agent 수" 만큼 반복된다.
  - 제안: `total_lines` 를 파일 루프에서 미리 계산하지 말고, 실제 소비 지점인 756행 부근(2차 절단이 필요한 시점)에서 `file_parts[i]["source_lines"].count("\n") + 1` 로 그 자리에서 계산하도록 되돌리면, 버그 수정 취지(annotated 문자열이 아니라 원본 `source_lines` 기준으로 세기)는 그대로 유지하면서 나머지 파일에 대한 낭비성 스캔을 없앨 수 있다.

- **[INFO]** 파일별 "생략 안내문(notice)" 문자열이 인덱스마다 두 번씩 재조립됨 — 캐싱 여지
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:735-748` (`_notice_text` 정의 및 예산 예약·환불 계산)
  - 상세: `_notice_text(i)` 는 (1) 740-742행에서 `content_indices` 전체에 대한 예약분을 계산할 때 한 번, (2) 748행 `for i in content_indices:` 루프 안에서 `refund = len(_notice_text(i))` 로 같은 `i` 에 대해 또 한 번 — 총 2회 `_omitted_content_note(...)` 문자열을 동일하게 재생성한다. 이 이중 계산 자체는 리팩터 이전 `_notice_cost(idx)` 헬퍼에도 이미 있던 패턴이라 이번 diff 가 만든 회귀는 아니지만, 헬퍼를 이름 있는 함수(`_notice_text`)로 분리한 이번 변경이 결과를 캐싱하기 좋은 지점이었다.
  - 제안: `for i in content_indices:` 진입 전에 `notice_cache = {i: _notice_text(i) for i in content_indices}` 를 한 번만 만들고 양쪽에서 재사용하면 문자열 포맷팅 중복을 없앨 수 있다. 개별 문자열이 짧아(파일 경로 + 크기 정도) 체감 영향은 미미하다.

- **[INFO]** (이번 diff 범위 밖, 참고용) `prioritize_bundle_files` 의 tier 판정이 "파일 수 × plan 코퍼스 길이"에 비례하는 부분 문자열 검색을 수행
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:341-354` (`tier` 내부 함수, 특히 352행 `plan_text and (rel in plan_text or os.path.basename(rel) in plan_text)`)
  - 상세: 랭킹 대상 파일 하나마다 모든 in-progress plan 문서를 이어붙인 `plan_text` 전체에 대해 부분 문자열 검색을 수행한다 — O(파일 수 × plan 코퍼스 길이). 이번 diff 는 359행의 2차 정렬 키만 `p` → `_natural_key(p)` 로 바꿨을 뿐 `tier()` 자체의 로직은 건드리지 않았으므로 새로 생긴 문제는 아니다. 다만 같은 파일의 주석(628-632행: "`plan_in_progress` 는 자기 예산의 ~10배")과 281행 부근 주석("~230개 카탈로그 파일")이 이미 두 코퍼스가 상당히 커질 수 있음을 밝히고 있어, 향후 두 쪽 모두 계속 커지면 체감 지연이 생길 수 있는 잠재적 확장성 이슈로 참고만 남긴다.
  - 제안: (이번 diff 의 책임 범위는 아님) 필요해지면 `plan_text` 부분 문자열 검색을 플랜 문서별 파일명 집합에 대한 `set` 멤버십 검사로 대체하는 방안을 고려할 수 있다.

- **[INFO]** (이번 diff 범위 밖, 참고용) `truncate_file_bundle` 의 파일-드롭 반복문이 반복마다 O(k) 재계산을 수행 — 실사용 규모에서는 낮은 영향
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:746-754` (`while kept: ... dropped.insert(0, kept.pop())`)
  - 상세: 매 반복마다 `sum(len(c) for c in kept)` 로 남은 청크 전체 길이를 다시 합산하고, `dropped.insert(0, ...)` 로 리스트 맨 앞에 삽입(list 삽입은 O(k))한다 — 파일을 하나씩 뒤에서 잘라내는 시나리오에서는 전체적으로 O(k²) 형태가 된다. 이 반복문 자체는 이번 diff 가 건드리지 않았고(바뀐 건 분리 구분자를 `_BUNDLE_FILE_MARKER` → `_BUNDLE_FILE_SENTINEL` 로 교체한 것뿐, 735·739행), 오히려 이번 diff 덕분에 파일 본문의 레벨-4 헤딩이 더 이상 가짜 파일 경계로 오인되지 않아 청크 수(`k`)가 실제 파일 수에 더 가깝게(과거보다 작게) 유지되므로 실질 영향은 이전보다 줄었다. 코드에 언급된 실사용 코퍼스 규모(수십~약 230개 문서) 기준으로는 k² 가 여전히 작아 체감 지연은 낮다.
  - 제안: 우선순위는 낮음. 필요해지면 `kept` 의 누적 길이를 변수로 유지하며 pop 할 때마다 빼는 방식으로 합산 재계산을 없애고, `dropped` 를 `collections.deque` 로 바꿔 `appendleft` 를 O(1) 로 만들 수 있다.

## 요약

이번 변경은 두 orchestrator(`code_review_orchestrator.py`, `consistency_orchestrator.py`)의 프롬프트 예산·번들 조립 로직에 대한 **버그 수정 + 리팩터**로, 성능을 목표로 한 변경은 아니며 부작용도 크지 않다. N+1 형태의 반복 DB/API/서브프로세스 호출은 없다 — `git diff` 서브프로세스 호출(`_branch_changed_rels`, `_collect_code_diff`)은 `collect_context` 당 1회로 이미 고정되어 있고 이번 diff 는 이를 건드리지 않았다. 문자열 결합도 리스트 누적 + 단일 `join` 패턴을 유지해 새로운 O(n²) 문자열 누적은 없다. 신설된 `_charge_notice` 로의 예산 산술 통합은 수학적으로 기존 계산과 동일해 성능 특성 변화가 없는 순수 리팩터다. 유일하게 실질적인 관찰은 `build_files_section` 의 `total_lines` 사전 계산이 "최대 1개 파일에만 필요한 값을 전체 파일에 대해 미리 계산"하는 방향으로 바뀐 것인데, 파일당 단순 선형 스캔 1회 추가에 불과하고 그 앞뒤로 이미 훨씬 무거운 `number_source_lines`/절단 작업이 있어 세션 전체 지연에 미치는 영향은 미미하다(다만 reviewer 13~14개가 동일 `change_infos` 를 매번 재가공하는 기존 구조 위에서 그만큼 곱해진다는 점은 인지할 가치가 있음). `_notice_text` 이중 호출, `prioritize_bundle_files` 의 plan-corpus 부분 문자열 검색, `truncate_file_bundle` 의 O(k²) 형태 드롭 루프는 모두 이번 diff 가 만든 회귀가 아니라 기존 패턴이 그대로(혹은 오히려 개선되어) 유지된 것이라 참고 수준으로만 남긴다. 전반적으로 이 diff 로 인해 새로 생기는 성능 리스크는 낮다.

## 위험도

LOW
