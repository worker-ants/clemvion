# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `pick_commit_fixture` 의 삭제-전용 커밋 가드가 최악의 경우 커밋당 파일 수만큼 `git show <sha>:<path>` 서브프로세스를 추가로 스폰한다
  - 위치: `.claude/tests/test_line_anchors.py:108-119` (특히 118행 `if any(_git("show", f"{sha}:{f}", cwd=cwd).strip() for f in sorted(files)):`)
  - 상세: `any()` 는 첫 non-empty 결과에서 단락 평가되므로 주석이 말하는 "보통 1회" 는 파일 목록 정렬 순서상 앞쪽에 살아있는 파일이 있는 흔한 경우엔 맞다. 하지만 이 술어가 도입된 이유 자체가 "커밋의 **모든** 파일이 그 sha 시점에 빈 내용(삭제-전용)"인 경우이므로, `changed >= MIN_FIXTURE_CHANGED_LINES`(80) 를 통과했는데 전부 삭제-전용/부재인 커밋을 만나면 `any()` 가 제너레이터를 끝까지 소진해 **그 커밋의 파일 수만큼** `git show` 를 호출한 뒤에야 다음 후보 커밋으로 넘어간다. 바깥 루프는 `FIXTURE_SEARCH_DEPTH=40` 커밋까지 순회하므로, 히스토리에 "큰 삭제 리팩터" 류 커밋이 연속으로 여러 개 있는 저장소(또는 그런 브랜치)에서는 추가 subprocess 호출 수가 (통과한 각 실패 후보의 파일 수) 만큼 누적되어, 이론상 수백~수천 회의 `git` 프로세스 스폰으로 이어질 수 있다. 다만 이는 (a) 테스트 전용 헬퍼로 프로덕션 경로에는 영향이 없고, (b) 순수 로컬 읽기(`git show <sha>:<path>`)라 파일시스템 쓰기·네트워크·전역 상태 변경이 전혀 없으며, (c) `FIXTURE_SEARCH_DEPTH` 로 커밋 수 자체는 상한이 있어 무한정 커지진 않는다.
  - 제안: 현재 형태(테스트 전용, read-only, bounded commit count)로는 실질적 위험이 낮아 그대로 두어도 무방하다. 만약 실측으로 CI 테스트 시간에 눈에 띄는 영향이 확인되면, `sorted(files)` 전체를 스캔하기 전에 이미 확보된 `numstat` 결과(예: added==0 인 행)로 삭제-전용 후보를 먼저 걸러 `git show` 호출 자체를 아예 생략하는 최적화를 고려할 수 있다(단, "0 added" 가 곧 "파일이 그 sha 에 부재"를 보장하진 않으므로 완전 대체는 아니라 폴백으로만).

- **[INFO]** 같은 가드의 실패 모드(부재 경로에 대한 `git show`) 는 예외를 던지지 않고 조용히 빈 문자열로 흡수된다 — 의도한 대로 동작
  - 위치: `.claude/tests/test_line_anchors.py:40-52` (`_git` 헬퍼, `capture_output=True`/`check=True` 미지정) 와 `:118` 의 소비부
  - 상세: `sorted(files)` 안의 경로 중 삭제된 파일은 `git show {sha}:{f}` 가 논제로 종료 코드와 `fatal: path '...' does not exist ...` stderr 를 내지만, `_git` 은 `check=True` 를 쓰지 않고 `errors="replace"` 로 텍스트 디코딩만 하므로 예외가 전파되지 않고 `.stdout` 이 빈 문자열로 반환된다. `any()` 의 `.strip()` 로 falsy 처리되어 다음 파일/커밋으로 자연스럽게 넘어간다 — 크래시나 테스트 스위트 중단 없이 의도한 "빈 내용 → skip" 의미론이 정확히 성립한다. 새로 추가된 파일시스템/프로세스 부작용은 없다(읽기 전용).
  - 제안: 없음 — 확인 목적의 기재.

- **[INFO]** `code_review_orchestrator.py::main()` 의 stdout 계약이 "배치당 한 줄" → "항상 정확히 한 줄" 로 바뀌었다 (batch-split 루프 제거) — 파일 4, 이 프롬프트에는 diff 가 생략되어 실제 저장소에서 직접 대조
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` `main()` 함수 (기존 `for batch_idx, batch in enumerate(batches, 1): ... print(session_dir)` 루프를 `prepare_session(change_infos, config)` 단일 호출 + `print(session_dir)` 한 번으로 교체)
  - 상세: 이는 이 diff 의 핵심 의도(문서·plan 이 함께 설명)이자 실제 결함 수정이지 부작용이 아니다. 다만 "함수/스크립트 인터페이스 변경" 관점에서 형식적으로 짚어두면: `--prepare` 의 stdout 계약을 소비하는 다른 호출부가 남아있는지 확인했다 — `grep -rl -- "--prepare"` 로 전체 저장소를 뒤진 결과 `.claude/commands/ai-review.md`(이번 diff 로 "단일 세션" 로 갱신됨), `.claude/hooks/_lib/review_guard.py`/`.claude/workflows/ai-review.js`(둘 다 `--prepare` 를 직접 실행하지 않고 문서적으로만 언급) 외에 stdout 다중 라인을 파싱하는 소비자는 없었다. 즉 시그니처/인터페이스 변경의 호출자 영향은 이미 전수 갱신·검증된 상태다.
  - 제안: 없음 — 이미 안전하게 반영됨을 확인.

- **[INFO]** `build_router_prompt_body` 가 매 `--prepare` 실행마다 새 git 서브프로세스 호출(`_source_files_missing_from_changeset` → `get_git_branch_diff_files`)을 하나 더 추가한다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` `build_router_prompt_body`/`_source_files_missing_from_changeset` (diff 는 이 프롬프트에서 생략됨, 함수명으로 특정)
  - 상세: 문서 전용 changeset 판정마다 브랜치 diff 를 다시 조회하는 로컬 `git` 호출이 하나 늘었다. broad `except Exception` 로 git 실패를 흡수하고 router 에게 "넓게 선택하라" 는 안내만 추가할 뿐 changeset 자체는 건드리지 않는다고 docstring 이 명시하며, 실제로도 반환값만 소비되고 어떤 전역 상태·파일도 바뀌지 않는다. 순수 읽기 전용, 네트워크 아님(로컬 git), 실패는 무해하게 삼켜짐.
  - 제안: 없음 — 설계상 의도된 defense-in-depth 이며 부작용 없음.

## 요약

이번 diff 에서 side-effect 관점의 핵심 변경은 (1) `test_line_anchors.py::pick_commit_fixture` 에 추가된 "삭제-전용 커밋 스킵" 가드와 (2) `code_review_orchestrator.py` 의 배치 세션 분할 제거 + `_source_files_missing_from_changeset` fail-closed 크로스체크다. 둘 다 전역 상태·환경 변수를 건드리지 않고, 새 파일을 쓰거나 기존 파일을 예기치 않게 수정하지 않으며, 네트워크 호출도 없다(전부 로컬 `git` 서브프로세스 호출). 특별히 지시받은 `pick_commit_fixture` 의 추가 `git show` 호출은 `any()` 단축 평가로 보통 1회에 그치지만, "모든 파일이 그 시점에 부재"인 커미 후보를 만나면 파일 수만큼 호출이 늘어날 수 있다 — 다만 테스트 전용·읽기 전용·상한 있는 커밋 탐색 범위(40) 안에서만 발생해 실질 위험은 낮다. 실패 모드(부재 경로에 대한 `git show`)도 `_git` 헬퍼가 예외 없이 빈 문자열로 흡수하도록 이미 설계되어 있어 크래시·거짓 성공 둘 다 관측되지 않았다. `code_review_orchestrator.py` 의 stdout 단일 세션 전환은 인터페이스 변경이지만 유일한 실제 소비자(`ai-review.md`)가 같은 diff 안에서 동반 갱신됐고 다른 호출부는 확인되지 않았다.

## 위험도

LOW
