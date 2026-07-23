# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `REVIEW_MAX_FILE_SIZE`/`REVIEW_MAX_PROMPT_SIZE` 미설정 시 기본값이 조용히 상향됨
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:73-74` (상수 정의), `:163-168` (`load_config` 의 env 기본값 적용부)
  - 상세: `DEFAULT_MAX_FILE_SIZE`/`DEFAULT_MAX_PROMPT_SIZE` 가 `51200`/`131072` 하드코드 리터럴에서 `int(51200 * 1.08)=55296`, `int(131072 * 1.08)=141557` 로 바뀌었다. 환경변수(`REVIEW_MAX_FILE_SIZE`/`REVIEW_MAX_PROMPT_SIZE`)를 명시적으로 세팅하지 않는 모든 호출자는 prompt 상한이 자동으로 커진다 — 이는 gutter 오버헤드(+8%)를 상쇄하기 위한 **의도된 변경**이며 코드 주석(51-74행)·`README.md:206-207`·`SKILL.md:188-189` 세 곳에 근거와 함께 문서화돼 있어 은닉된 부작용은 아니다. 다만 이 값에 의존해 예산을 역산하는 외부 스크립트나 모니터링(있다면)이 있다면 영향을 받는다.
  - 제안: 문서화가 충분하므로 추가 조치 불요. 다만 향후 이 상수를 또 조정할 경우 세 파일(코드 주석·README.md·SKILL.md) 동기화를 놓치지 않도록 유지.

- **[INFO]** 잘림(truncation) 안내 문구가 영어 고정 문자열에서 한국어 동적 문자열로 교체
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:457-463`(`_truncated_note` 신설) 및 그 호출부(`build_files_section` 내 3개 잘림 지점, `annotate_unified_diff`/`truncate_to_line_boundary` 적용부)
  - 상세: 기존 `"... (truncated due to size limit) ..."` / `"... (truncated due to prompt size limit) ..."` / `"... (diff omitted due to prompt size limit) ..."` 리터럴이 `_truncated_note(kept, total, reason)` 기반의 `"... (<reason>으로 {kept}/{total} 줄만 표시 — 나머지는 원본 파일 참조) ..."` 로 바뀜. `.claude/skills/code-review-agents/lib/session.py:58` 의 `truncate_to_budget()` 는 여전히 옛 영어 문구(`"\n\n... (truncated due to size limit) ..."`)를 기본값으로 갖고 있어, 같은 스킬 디렉토리 안에 두 가지 잘림 표기 관례가 공존하게 됐다. 다만 두 함수의 소비자(reviewer/router 프롬프트 vs 그 외)가 겹치지 않고, 이 문자열을 정규식으로 파싱하는 다른 코드는 grep 상 발견되지 않아 실질적 충돌은 없다.
  - 제안: side-effect 관점에서는 조치 불요(참고용 기록). 문구 통일은 maintainability 영역.

- **[INFO]** 새 pure 모듈 `line_anchors.py` — 부작용 없음 확인
  - 위치: `.claude/skills/code-review-agents/lib/line_anchors.py:1-254` (전체 신규 파일)
  - 상세: 전역 상수(`GUTTER_SEP`, `MIN_GUTTER_WIDTH`, `_HUNK_RE`, `_FILE_HEADER_PREFIXES`)는 모두 불변(문자열/컴파일드 정규식/튜플)이고, 노출 함수(`gutter_width`, `number_source_lines`, `annotate_unified_diff`, `truncate_to_line_boundary`)는 입력 문자열을 변경하지 않고 새 문자열을 반환하는 순수 함수다. 파일시스템·네트워크·전역 mutable 상태 접근 없음. `code_review_orchestrator.py` 의 `sys.path.insert` 뒤 `from lib import line_anchors` 임포트(37행)도 부작용 없는 순수 임포트.
  - 제안: 없음(정보성 확인).

- **[INFO]** 신규 테스트가 실제 orchestrator `--prepare` CLI 를 서브프로세스로 반복 실행 — 기존 관례와 동일
  - 위치: `.claude/tests/test_line_anchors.py:293-316`(`PromptPayloadIntegrationTest._prepare`), 그리고 이를 호출하는 4개 테스트 메서드(342행대 `test_every_reviewer_prompt_carries_the_legend`, 354행대 `test_diff_blocks_are_annotated_and_correct`, 375행대 `test_whole_file_blocks_are_numbered_and_correct`, 394행대 `test_prompt_stays_within_the_size_cap`)
  - 상세: 각 테스트가 실제 `code_review_orchestrator.py --prepare --commit <HEAD>` 를 리포지토리 루트(cwd=REPO_ROOT)에서 서브프로세스로 실행한다. 세션 산출물은 `REVIEW_OUTPUT_DIR=tmp`(임시 디렉토리)로 격리되고 `finally` 블록에서 `shutil.rmtree` 로 정리되어 리포 트리를 오염시키지 않는다. 다만 orchestrator 내부의 `debug_log`(`DEBUG_LOG_FILE = "/tmp/code-review-agents-log.txt"`, `code_review_orchestrator.py:48-49`)는 이 격리 대상이 아니므로, 테스트 실행마다 리포/세션과 무관한 전역 `/tmp` 로그 파일에 append 된다 — 다만 이 패턴(실제 CLI를 subprocess 로 호출)은 `test_orchestrator_state.py` 등 기존 테스트에서도 이미 사용 중이므로 이 diff 가 새로 도입한 위험은 아니다.
  - `test_prompt_stays_within_the_size_cap`(394행대)는 `runpy.run_path(ORCH)` 로 orchestrator 모듈 전체를 재실행해 `DEFAULT_MAX_PROMPT_SIZE` 를 읽는다(`sys.argv=['x']` 로 방어). `runpy.run_path` 의 기본 `run_name` 은 `"__main__"` 이 아니라 `"<run_path>"` 이므로 파일 하단의 `if __name__ == "__main__": main()`(orchestrator 끝부분)은 트리거되지 않아 CLI 의 실제 부작용(파일 쓰기 등)은 발생하지 않는다 — 의도대로 안전.
  - 제안: 없음(확인 완료, 조치 불요).

- **[INFO]** `.claude/agents/*-reviewer.md` 13개 파일 + `README.md`/`SKILL.md` 프롬프트 문구 변경은 순수 문서·프롬프트 텍스트 변경
  - 위치: 13개 reviewer 정의 파일의 `- 위치:` 블록(각 파일 diff 상 게이트 29-31행대), `.claude/skills/code-review-agents/README.md:206-207`, `SKILL.md:188-189`
  - 상세: 런타임 상태·전역 변수·파일/네트워크 부작용을 일으키는 실행 코드가 아니라, sub-agent 에게 전달되는 system prompt 본문과 그 설명 문서다. 이 프롬프트가 sub-agent 의 "위치" 표기 행동을 바꾸긴 하지만(의도된 목적), 이는 `code-review-agents` 스킬의 **의도된 인터페이스 변경**이지 부작용이 아니다. 13개 파일이 규약상 byte-identical 해야 하는 블록이며, 새 테스트 `test_line_anchors.py::ReviewerDefinitionContractTest.test_the_location_block_is_byte_identical_across_all_reviewers`(462행대)가 drift 를 가드한다.
  - 제안: 없음.

## 요약

이번 변경 세트는 코드 리뷰 하네스(`code-review-agents` 스킬) 내부에서 reviewer 프롬프트에 실제 소스 라인 번호 게이트를 붙이는 기능 추가로, 대부분이 (1) 13개 reviewer 정의 `.md` 파일에 동일한 안내 문구를 추가하는 순수 프롬프트/문서 변경, (2) 부작용 없는 신규 pure 모듈 `line_anchors.py`, (3) orchestrator 내 게이트 삽입 로직과 이에 맞춘 크기 상한 상수 조정(문서화된 +8% 보정), (4) 이를 검증하는 신규 테스트로 구성된다. 함수 시그니처·공개 인터페이스는 그대로 유지되고, 전역 변수 도입은 새 모듈 상수(모두 불변값)에 그친다. 유일하게 주목할 지점은 `REVIEW_MAX_FILE_SIZE`/`REVIEW_MAX_PROMPT_SIZE` 미설정 시 기본 상한이 조용히 8% 상향되는 점과 잘림 안내 문구가 영어→한국어로 바뀌는 점인데, 둘 다 코드 주석·README·SKILL.md 에 근거와 함께 명시적으로 문서화돼 있고 이를 파싱하는 다른 소비자가 발견되지 않아 실질적 회귀 위험은 낮다. `codebase/`(제품 코드)에 대한 영향은 없다(변경 범위가 `.claude/` 하네스 내부로 한정).

## 위험도
LOW
