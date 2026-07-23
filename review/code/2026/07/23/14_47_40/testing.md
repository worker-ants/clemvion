# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `build_files_section` 의 3개 truncation 분기가 통합 테스트로만 간접 커버됨
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:496`(전체 파일 truncate) / `:533`(prompt 예산 diff truncate) / `:543`(diff 생략 else 분기) / `:563`(multi-file 추가 포함 예산 분기) — 게이트 숫자는 프롬프트 파일 17 diff 블록 그대로 인용.
  - 상세: 이번 diff 는 세 truncation 호출부를 원시 char-slice(`text[:n]`)에서 `line_anchors.truncate_to_line_boundary` 로 교체했다(게이트 번호가 줄 중간에서 잘리지 않도록 하는 것이 이 모듈의 존재 이유). 그런데 이 세 분기를 직접 겨냥해 작은 `max_file_size`/`max_prompt_size` 로 `build_files_section` 을 호출하는 단위 테스트가 없다. `test_line_anchors.py::PromptPayloadIntegrationTest.test_prompt_stays_within_the_size_cap` 는 실제 `--prepare` 실행 결과가 "cap+2048 이내" 인지만 확인할 뿐, 어떤 분기가 실제로 발동했는지·발동 시 `kept/total` 표기가 정확한지·"diff 생략" else 분기(신규 truncate 결과 `new_len<=0`)가 여전히 도달 가능한지를 강제하지 않는다. 오버헤드 계수 검증(`_GUTTER_OVERHEAD=1.08`, "commit 860aad982, 17 files" 근거)도 코드 주석에 적힌 1회성 수작업 측정이며 회귀 방지 테스트로 고정돼 있지 않다 — 향후 게이트 폭 계산이나 오버헤드 계수가 바뀌어도 이 특정 분기(특히 `new_len<=0` diff 완전 생략 케이스)가 깨지는 것을 잡아낼 결정적 테스트가 없다.
  - 제안: `build_files_section` 을 합성 `change_infos` + 의도적으로 작은 `max_file_size`/`max_total_size` 로 직접 호출하는 단위 테스트를 `test_line_anchors.py` 또는 `test_orchestrator_state.py` 에 추가해 (1) 전체 파일 truncate 분기, (2) prompt 예산 diff truncate 분기, (3) `new_len<=0`("diff 생략") 분기, (4) multi-file 추가 포함 예산 분기를 각각 결정적으로 발동시키고 `_truncated_note` 의 `kept/total` 값과 게이트 정합성(줄 중간 절단 없음)을 단언한다.

- **[WARNING]** README/SKILL.md 문서 표의 하드코딩 상수(`55296`/`141557`) ↔ 실제 코드 상수(`DEFAULT_MAX_FILE_SIZE`/`DEFAULT_MAX_PROMPT_SIZE`) 사이 drift 가드 부재
  - 위치: `.claude/skills/code-review-agents/README.md:206-207`, `.claude/skills/code-review-agents/SKILL.md:188-189` (문서 표) vs `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:73-74` (실제 계산식).
  - 상세: 변경 전에는 두 값이 코드·문서 양쪽에 동일한 리터럴(`51200`/`131072`)로 하드코딩돼 있어 drift 위험이 낮았다. 이번 diff 는 코드 쪽을 `int(51200 * _GUTTER_OVERHEAD)` 계산식으로 바꿨는데, README/SKILL.md 는 그 결과값(`55296`/`141557`)을 여전히 손으로 적은 리터럴로 미러링한다. `test_line_anchors.py::test_prompt_stays_within_the_size_cap` 는 `DEFAULT_MAX_PROMPT_SIZE` 를 orchestrator 자체에서 읽어 검증하므로 코드-내부 drift 는 막지만, 문서 표의 두 숫자가 실제 상수와 동일한지 검증하는 테스트는 없다. 이 프로젝트는 `test_doc_sync_matrix.py`/`test_agent_consistency.py`/`test_mermaid_lint_ready.py` 등 "문서 ↔ 코드 SoT" drift 를 테스트로 강제하는 확립된 관례가 있는데, 이번 신규 drift 표면(계수 기반 상수의 문서 미러)은 그 관례에서 빠졌다. `_GUTTER_OVERHEAD` 값이 나중에 조정되면 README/SKILL.md 숫자는 조용히 stale 해질 수 있다.
  - 제안: README.md·SKILL.md 를 파싱해 표에 적힌 두 숫자를 `code_review_orchestrator.DEFAULT_MAX_FILE_SIZE`/`DEFAULT_MAX_PROMPT_SIZE` 와 비교하는 작은 drift 테스트를 추가(예: `test_line_anchors.py` 또는 신규 `test_review_config_docs_sync.py`).

- **[INFO]** 실제 git 히스토리에 의존하는 통합 테스트의 환경 결합
  - 위치: `.claude/tests/test_line_anchors.py:224`(`GutterCorrectnessAgainstRealGitTest`), `:283`(`PromptPayloadIntegrationTest`).
  - 상세: 두 테스트 클래스는 (의도적으로, README 컨벤션 예외로 문서화된 대로) mock 없이 실제 저장소의 최근 12개 커밋과 실제 `--prepare` 실행 결과를 검증한다. 이는 "우리가 만든 unified diff 모델이 아니라 git 의 실제 포맷"을 검증한다는 점에서 정당한 설계 선택이지만, `assertGreater(annotated_files, 0, ...)`/`assertGreater(checked, 100, ...)` 는 저장소 히스토리의 구체적 모양(최근 12개 커밋이 실질 코드 diff 를 충분히 포함하는지)에 암묵적으로 의존한다. shallow clone(`--depth`)이나 rebase/squash 로 히스토리가 얕아지는 CI 환경에서는 이 가정이 깨져 "회귀 없음"이 아니라 "테스트 전제 붕괴"로 실패할 수 있다. 현재 monorepo 는 이런 얕은 clone 을 쓰지 않는 것으로 보이나, 이식성 관점에서 문서화해 둘 가치가 있다.
  - 제안: 별도 수정 불요(현행 컨벤션 내 정당한 예외). CI 파이프라인이 shallow clone 을 도입할 경우를 대비해 `test_line_anchors.py` 상단 주석 또는 `.claude/tests/README.md` 에 "전체 히스토리(비-shallow) 전제" 를 명시해 두는 정도로 충분.

- **[INFO]** 잘 설계된 회귀 가드: 13개 reviewer 파일의 손-복제 `위치` 블록에 대한 byte-identical 테스트
  - 위치: `.claude/tests/test_line_anchors.py:462` (`ReviewerDefinitionContractTest.test_the_location_block_is_byte_identical_across_all_reviewers`).
  - 상세: 이번 diff 는 정확히 13개 `-reviewer.md` 파일에 동일한 `- 위치:` 안내 블록을 손으로 복제해 넣었다. 이 테스트는 "부분 문자열 포함" 단언(잘못된 카피 상태에서도 통과 가능)에서 한 걸음 더 나아가 13개 블록이 byte-identical 한지 직접 비교한다 — 향후 한 파일만 수정되고 나머지가 stale 해지는 drift 를 정확히 차단한다. 이 diff 가 다루는 변경 자체를 그대로 겨냥한 좋은 회귀 테스트다. 추가 조치 불필요.

## 요약

이번 변경의 핵심(신규 `lib/line_anchors.py` 모듈과 orchestrator 배선)은 신규 테스트 파일 `test_line_anchors.py` 로 이례적으로 두텁게 커버된다 — 순수 함수 단위 테스트, fail-open 경로별 테스트, 실제 git 히스토리 재생 테스트, `--prepare` 실행 결과에 대한 통합 테스트, 그리고 13개 reviewer 정의 파일의 손-복제 블록이 byte-identical 한지 확인하는 회귀 가드까지 갖췄다. 다만 `build_files_section` 내부의 세 truncation 호출부(특히 diff 완전 생략으로 빠지는 `new_len<=0` 분기와 multi-file 추가-포함 예산 분기)는 실제 `--prepare` 통합 테스트로만 간접 커버되고 분기별 결정적 단위 테스트는 없으며, README/SKILL.md 문서 표의 새 하드코딩 상수(`55296`/`141557`)는 코드의 계수 기반 상수와 동기화를 보장하는 drift 테스트가 없다. 둘 다 이 프로젝트가 다른 곳에서 이미 확립한 "SoT + drift 가드" 패턴을 이번 신규 표면에 적용하지 않은 사각지대로, 코드를 되돌릴 필요는 없지만 후속 테스트 보강을 권한다.

## 위험도

LOW
