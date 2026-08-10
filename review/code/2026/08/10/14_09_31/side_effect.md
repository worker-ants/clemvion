# 부작용(Side Effect) 리뷰

## 조사 방법

프롬프트의 파일 4(`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`)·5(`.claude/tests/README.md`)·6(`.claude/tests/test_review_prepare_single_session.py`)는 크기 제한으로 diff/컨텍스트가 생략되어 있어, 실제 저장소에서 `git diff 193d43fc5^..50d877bd9 -- <해당 파일>` 로 원본 diff를 직접 확인하고 `Read`/`Grep`으로 현재 소스를 대조했다. 지시받은 핵심 질문 — "`--prepare` 가 더 이상 세션을 분할하지 않는" 계약 변경이 `_verify_coverage`·`--resume`·`--sync-from-disk`·`Workflow(ai-review.js)` 등 세션 경로 소비자에 미치는 영향 — 을 전수로 추적했다.

## 발견사항

- **[INFO]** `--resume`/`--sync-from-disk`/`--verify-coverage`/`--update`/`--apply-routing` 는 세션 분할 제거의 영향권 밖임을 코드로 확인
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1614`(`--resume`), `:1657`(`--sync-from-disk`), `:1661`(`--verify-coverage`), `:1642`(`--update`), `:1652`(`--apply-routing`)
  - 상세: 이 다섯 모드는 모두 `main()` 안에서 `args.<mode>` 분기 진입 즉시 명시적으로 전달받은 **단일** `session_dir`(또는 그 하위 파일 경로)만 다루고 `sys.exit(0)`/`sys.exit(1)`로 반환한다 — `config = load_config(...)` 나 `change_infos = collect_change_infos(...)`, 그리고 이번에 바뀐 `_warn_large_changeset`/`prepare_session` 호출부(`:1666`~`:1679`)에는 아예 도달하지 않는다. 즉 이 네 모드는 "`--prepare` 가 한 번에 몇 개의 세션을 만드는가"라는 사실 자체에 의존한 적이 없다 — 항상 호출자가 이미 알고 있는 특정 세션 하나를 다뤘다. 배치 분할이 있던 시절에도 이 모드들은 N개 세션 중 하나를 골라 넘겨받는 방식이었으므로, 분할을 없애 세션이 정확히 하나가 되는 지금도 시그니처·호출 계약·동작이 전혀 바뀌지 않는다. `Workflow(name="ai-review", ...)`(`.claude/workflows/ai-review.js`)도 마찬가지로 `invocations`/`router`/`summary` 를 **단일** 세션의 `_retry_state.json` 에서 읽어 구성한 args 를 받는 구조였다(`.claude/commands/ai-review.md:15` "`<session_dir>/_retry_state.json` Read (경로뿐)") — 여러 줄을 파싱해 여러 세션에 팬아웃하는 코드는 `ai-review.js` 어디에도 없다(확인: `grep -n "session_dir\|splitlines" .claude/workflows/ai-review.js` 무결과). 오히려 과거엔 `SKILL.md` 가 "마지막 줄"만 읽으라 적어 두고도 코드는 배치마다 한 줄씩 찍었던 쪽이 실제 결함(앞 배치 미리뷰)이었고, 이번 변경은 코드를 그 기존 소비자 계약(단일 줄)에 맞춘 것이라 회귀가 아니라 정합화다.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** `prepare_session` 이 문서-전용 changeset 에서 새 git subprocess 2회를 유발 — `--branch`/`--range`/`--commit`/`--files` 모드까지 포함해 범위가 넓어짐
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:934`(`build_router_prompt_body` 안의 `unseen = _source_files_missing_from_changeset(all_paths)` 호출), `:1327`(`_source_files_missing_from_changeset` 정의, 내부에서 `:1303` `_default_branch_ref()` + `:1063` `get_git_branch_diff_files(base)` 호출)
  - 상세: `build_router_prompt_body` 는 `prepare_session`(`:1238` 부근)에서 세션당 정확히 1회 호출되는데, changeset 에 소스 파일이 0개(문서/설정 전용)로 판정되면 새로 추가된 `_source_files_missing_from_changeset` 가 로컬 git 서브프로세스를 두 번(`_default_branch_ref` 의 원격 심볼릭 ref 조회 + `get_git_branch_diff_files` 의 `git diff --name-only`) 실행한다. 기존에 유사한 프로브(`warn_if_committed_work_is_missing`, `:1360`)는 **인자 없는 기본 changeset 모드에서만**(`:1508`, `args.staged` 가 아닐 때만) 실행됐지만, 이번 신규 호출은 `--branch`/`--range`/`--commit`/`--files` 등 명시적 스코프 모드를 포함해 **문서-전용으로 판정되는 모든 `--prepare` 호출**에서 실행된다 — 즉 이전에는 없던 경로(예: `--branch` 모드에서 문서만 바뀐 changeset)에 새 로컬 subprocess 호출이 생겼다. 네트워크 호출은 아니며(로컬 `git`, fetch 트리거 없음), `except Exception: return []` 로 실패를 완전히 흡수해 리뷰 자체를 막지 않도록 설계·테스트(`test_git_failure_is_absorbed_not_propagated`)돼 있어 위험도는 낮다. `warn_if_committed_work_is_missing` 이 이미 쓰는 동일 프로브 함수를 재사용한다는 plan 상의 "새 표면을 늘리지 않는다"는 서술(`plan/in-progress/harness-review-gate-followups.md`)은 **헬퍼 재사용**은 맞지만 **호출 지점·트리거 조건**은 이전에 없던 것이 하나 늘었다는 점에서 다소 낙관적이다.
  - 제안: 의도된 fail-closed 방어이고 실패를 흡수하도록 테스트로 고정돼 있어 수정은 불필요. 다만 plan/커밋 메시지가 "새 표면을 늘리지 않는다"고 단정한 부분은 "헬퍼는 재사용하되 호출 지점은 하나 늘었다"로 다음 기회에 정정해 둘 만하다.

- **[INFO]** `main()` 의 `--prepare` 경로에서 stderr 출력 형태가 바뀜(`--- Batch X/Y (N files) ---` 헤더 소실) — 소비자 없음 확인
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1672-1679`
  - 상세: 이전에는 배치마다 `--- Batch {idx}/{len(batches)} ({len(batch)} files) ---` 헤더 한 줄 뒤에 파일 목록을 stderr 에 찍었다. 새 코드(`:1675-1677`)는 `_warn_large_changeset` 경고(임계값 초과 시에만) 다음, 배치 헤더 없이 전체 파일 목록을 stderr 에 찍는다. `grep -rn "Batch \|--- Batch"` 로 `.claude/tests/`·`.claude/hooks` 전수 확인 결과 이 헤더 문자열을 파싱·단언하는 코드는 없고(`test_review_session_dir_collision.py:9` 의 언급은 과거 결함을 설명하는 docstring일 뿐 assertion 아님), CI(`.github/**`)에도 `REVIEW_BATCH_SIZE`/`Batch` 참조가 없다. 순수 진단 로그 형태 변경으로 실질 영향 없음.
  - 제안: 없음.

- **[INFO]** `REVIEW_BATCH_SIZE` 환경변수의 의미가 "세션 분할 크기"에서 "stderr 경고 임계값"으로 재정의됨
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1146`(`_warn_large_changeset` 정의), `:1675`(호출), 환경변수 읽기 자체는 `load_config`(파일 상단 `config["batch_size"] = int(os.environ.get("REVIEW_BATCH_SIZE", "50"))`, 변경되지 않음)
  - 상세: 환경변수 이름·기본값(`50`)·읽는 코드는 그대로지만, 그 값이 소비되는 의미는 "이 크기로 세션을 쪼갠다" → "이 크기를 넘으면 stderr 로만 알린다(세션은 절대 안 쪼갠다)"로 조용히 바뀌었다. `README.md:231`, `SKILL.md:199` 두 표가 같은 커밋에서 갱신돼 문서 드리프트는 없고, `grep -rn "REVIEW_BATCH_SIZE" .github` 결과 CI/외부 스크립트에서 이 변수를 참조하는 곳도 없어 실질 파급은 없다고 확인했다. 다만 "환경 변수의 예상치 못한 읽기/쓰기" 관점에서, 기존에 `REVIEW_BATCH_SIZE=1` 등으로 세션을 잘게 쪼개길 기대하고 값을 낮게 설정해 둔 로컬 운영자가 있었다면 그 기대와 정반대로 동작한다(여전히 세션 하나에 전부 담고 경고만 더 자주 뜬다) — 새 변수를 도입한 것이 아니라 기존 변수를 재정의(repurpose)한 것이므로 grep 한 번으로는 걸러지지 않는 로컬 dotfile/셸 프로파일의 잔존 설정까지는 확인 대상 밖이다.
  - 제안: 정정 완료된 문서로 충분하다고 판단하나, 필요하다면 값이 배치 크기가 아니라 "경고 임계값"임을 변수명에도 반영(`REVIEW_LARGE_CHANGESET_WARN_THRESHOLD` 류로 별도 변수 도입 + 구 변수 deprecation)하는 안을 백로그에 남겨둘 만하다 — 지금 당장 필요한 조치는 아니다.

- **[INFO]** `--prepare` 단일 호출당 파일시스템 부작용이 오히려 **감소**함(다중 세션 디렉터리 생성 제거)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1183`(`prepare_session`, 세션 디렉터리·`_prompts/*.md`·`meta.json`·`_retry_state.json` 등을 디스크에 쓰는 함수), 호출부 `:1678`
  - 상세: 개정 전에는 `REVIEW_BATCH_SIZE` 를 넘는 changeset 한 번의 `--prepare` 호출이 `prepare_session()` 을 배치 수만큼 반복 호출해 그만큼의 세션 디렉터리·`meta.json`·프롬프트 파일 세트를 디스크에 남겼다(그중 마지막 것만 사용됨). 지금은 changeset 크기와 무관하게 항상 정확히 1회만 호출된다 — 의도치 않은 파일시스템 부작용의 개수가 줄어드는 방향이며, `.claude/tests/test_review_prepare_single_session.py::PrepareEmitsExactlyOneSessionTest.test_the_single_session_receives_every_file` 가 `prepare_session` 이 changeset 전체를 담아 정확히 한 번만 호출됨을 고정한다.
  - 제안: 없음 — 긍정적 변화로 기록.

## 요약

이번 diff의 핵심(코드 변경은 사실상 `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 한 파일)은 "`--prepare` 가 배치별로 여러 세션 줄을 찍던 것을 없애고 항상 하나만 찍는다"는 계약 변경이다. `_verify_coverage`·`--resume`·`--sync-from-disk`·`--update`·`--apply-routing`·`Workflow(ai-review.js)` 를 전수 추적한 결과, 이 다섯 CLI 모드와 Workflow 는 애초부터 호출자가 넘겨준 **단일** session_dir 만 다루도록 짜여 있어 세션이 몇 개 만들어지는지에 의존한 적이 없었고, 시그니처·호출 계약 모두 변경 없이 그대로다 — 오히려 기존에 문서(`SKILL.md`)가 "마지막 줄"만 읽으라 잘못 적어 두고도 코드는 배치마다 찍던 불일치가 실제 결함(앞 배치 미리뷰 + `agents_forced` 축소로 인한 거짓 PASS)이었고, 이번 수정은 코드를 그 기존 소비자 계약에 맞춘 정합화에 해당한다. 부수적으로 새로 추가된 `_source_files_missing_from_changeset` 가 문서-전용 changeset 판정 시 로컬 git subprocess 를 추가로 실행하는 지점이 하나 늘었지만(범위: `--branch`/`--range`/`--commit`/`--files` 모드까지 확장, 이전엔 기본 모드에만 유사 프로브 존재), fail-silent 설계와 전용 테스트로 리뷰 파이프라인 실패로 전파되지 않도록 봉쇄돼 있다. `REVIEW_BATCH_SIZE` 환경변수는 이름·기본값을 유지한 채 의미만 "분할 크기"에서 "경고 임계값"으로 재정의됐는데, 문서 두 곳(`README.md`/`SKILL.md`)이 같은 커밋에서 동기화됐고 CI/외부 스크립트의 참조도 없어 실질 파급은 확인되지 않았다. 전반적으로 세션 파일시스템 부작용은 줄었고(다중 세션 생성 제거), 공개 인터페이스(argparse 플래그·Workflow args 형태)는 하나도 바뀌지 않았다.

## 위험도

LOW
