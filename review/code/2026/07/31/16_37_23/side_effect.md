### 발견사항

- **[CRITICAL]** `--spec`/`--plan` 원시 `target_doc` 은 신설된 sentinel 위조 방지(`_neutralize_sentinel`)를 거치지 않아, 검토 대상 문서가 sentinel 리터럴을 포함하면 `truncate_file_bundle` 이 이를 파일 경계로 오인 — 실제 본문 뒷부분을 조용히 버리고 존재하지 않는 파일명을 "생략된 파일"로 날조한다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` — `collect_context`의 `--spec`/`--plan` 분기(550-562행, 특히 554·561행 `target_doc = read_text_file(target_abs)`). 대조: 213-226행 `_neutralize_sentinel`, 698행 `_BUNDLE_FILE_SENTINEL` 정의, 718-759행 `truncate_file_bundle`.
  - 상세: 이번 diff는 "본문이 만들 수 없는 sentinel(`<!-- @bundle-file -->`)로 경계 이전"을 도입해, `format_file_bundle`/`extract_rationale_sections`가 만드는 다중 파일 번들(스코프 bundle·related_specs·conventions·plan_in_progress·rationale)에서는 파일 본문이 그 sentinel을 우연히 포함해도 `_neutralize_sentinel`로 무해화한다. 그런데 `--spec`/`--plan` 모드의 `target_doc`은 `read_text_file(target_abs)`로 직접 대입될 뿐 `_neutralize_sentinel`을 거치지 않고, 이후 `budget_substitutions`에서 그대로 `truncate_file_bundle`에 전달된다(`--impl-done`의 `diff_section`(575-598행, `_collect_code_diff`의 git diff 원문을 그대로 삽입)도 동일하게 무해화 없이 같은 `target_doc`에 합류한다). `truncate_file_bundle`은 "sentinel이 없으면 단일 문서"로 간주해 `session.truncate_to_budget`로 안전하게 폴백하는데(`test_text_without_file_markers_falls_back_to_plain_truncation`이 이 폴백을 전제로 통과), 검토 대상 문서 자체가 sentinel 문자열을 자기 줄에 리터럴로 포함하면 이 전제가 깨진다.
    실제로 재현을 확인했다: `orch.truncate_file_bundle`에, 앞부분은 평범한 spec 서술이고 중간에 `_BUNDLE_FILE_SENTINEL`이 한 번(스스로의 줄에) 등장한 뒤 다시 spec 본문이 이어지는 단일 문서를 budget-초과 상태로 넣으면, sentinel 이후 전체가 "다른 파일"로 분류되어 통째로 버려지고, 출력에는 다음이 나타난다:
    ```
    ### ⚠️ 컨텍스트 예산 초과로 생략된 파일 1개
    ...
    - `가짜파일.md`
    ```
    `가짜파일.md`는 sentinel 직후 첫 backtick 쌍에서 뽑아낸, 실재하지 않는 파일명이다 — 즉 실제 target 문서의 뒷부분이 checker 프롬프트에서 조용히 사라지고, checker는 존재하지 않는 파일을 `Read`하라는 안내를 받는다. 이 프로젝트 자신이 "이 저장소가 이미 한 번 그 경계 문자열을 인용할 뻔했다"고 명시할 만큼(`_BUNDLE_FILE_SENTINEL`/`_neutralize_sentinel` 독스트링), 이 기능을 설명하는 spec/plan 문서가 `--spec`/`--plan` 검토 대상이 되는 것은 이 저장소의 SDD 자기-문서화 관행상 실제로 부딪힐 수 있는 경로다. 결과적으로 "생략은 반드시 명시돼야 하고, 파일은 통째로 보존되거나 통째로 생략목록에 올라야 한다"는 이번 PR 자체의 목표가 정확히 이 네 번째 경로(`--spec`/`--plan` 원시 문서)에서 깨진다 — `BLOCK: NO`가 "검토했지만 문제 없음"이 아니라 "검토 대상 뒷부분이 안 보였음"일 수 있는, 이 plan 문서(`harness-consistency-summary-downgrade-rule.md`)가 8회 넘게 추적해 온 바로 그 실패 유형이 새 sentinel 메커니즘에서 재발한다.
  - 제안: `_neutralize_sentinel`을 `format_file_bundle`/`extract_rationale_sections`뿐 아니라 `target_doc`이 될 수 있는 모든 원천(554·561행 `read_text_file` 결과, `_collect_code_diff`의 git diff 원문)에도 적용하거나, `truncate_file_bundle` 진입 직전에 `budget_substitutions`/`collect_context` 레벨에서 일괄 무해화할 것. 최소한 `test_a_document_that_writes_the_sentinel_cannot_forge_a_boundary`에 대응하는 `--spec`/`--plan` 경로용 회귀 테스트를 추가해 이 갭을 고정해야 한다.

- **[WARNING]** 신설 테스트가 서브프로세스 안에서 `tempfile.mkdtemp()`로 만든 디렉터리를 정리하지 않아, 테스트를 실행할 때마다 고아 임시 디렉터리(+`real.md`)가 디스크에 남는다.
  - 위치: `.claude/tests/test_consistency_context_budget.py:163-190` (`ContentCannotForgeAFileBoundaryTest.test_a_document_that_writes_the_sentinel_cannot_forge_a_boundary`), 특히 176-177행 `d = tempfile.mkdtemp()`.
  - 상세: 이 코드는 문자열로 작성돼 `run_in_orchestrator`를 통해 완전히 별도의 서브프로세스(`subprocess.run([sys.executable, "-c", ...])`)에서 실행되므로, 부모 테스트 프로세스의 `self.addCleanup`이 이 디렉터리를 잡을 수 없고, 스니펫 자신도 `shutil.rmtree`를 호출하지 않는다. 실제로 이 테스트를 단독 실행해 확인함 — 실행 직후 OS 임시 디렉터리(`$TMPDIR`)에 `real.md`를 담은 새 `tmp*` 디렉터리가 생성돼 남았고, 테스트를 반복 실행할 때마다 하나씩 누적된다(확인 후 직접 정리함). 같은 diff의 형제 테스트인 `test_consistency_bundle_priority.py::BranchChangedRelsAgainstRealGitTest._repo`는 동일한 `tempfile.mkdtemp()` 패턴에 `self.addCleanup(shutil.rmtree, d, ignore_errors=True)`를 붙여 정리하므로, 이번 신설 테스트만 그 관례를 놓쳤다.
  - 제안: 스니펫 내부에서 `try/finally`로 `shutil.rmtree(d, ignore_errors=True)`를 호출하거나 `tempfile.TemporaryDirectory()` 컨텍스트 매니저로 교체할 것.

### 요약

이번 diff의 핵심 목적 — 번들 우선순위 natural sort(`_natural_key`), 예산 계상 통합(`_charge_notice`), sentinel 기반 파일 경계 위조 방지(`_BUNDLE_FILE_SENTINEL`/`_neutralize_sentinel`) — 는 각각 잘 구현·테스트돼 있고, `code_review_orchestrator.py`의 2단계 절단 총 줄 수 버그 수정(`total_lines`/`source_lines` 분리)도 순수 함수적 리팩터로 부작용이 없다. `collect_markdown_files`/`format_file_bundle`/`prioritize_bundle_files`는 모두 `consistency_orchestrator.py` 내부와 그 테스트에서만 소비되므로 시그니처·인터페이스 관점에서 외부 호출자 영향도 없다. 다만 sentinel 위조-방지가 `format_file_bundle`/`extract_rationale_sections`로 만들어지는 다중 파일 번들에만 적용되고 `--spec`/`--plan`의 원시 `target_doc`(및 `--impl-done`의 diff 원문)에는 적용되지 않아, 검토 대상 문서가 sentinel 리터럴을 포함하면 실제 본문 뒷부분이 조용히 잘리고 존재하지 않는 파일이 "생략됨"으로 날조되는 것을 재현으로 확인했다 — 이 PR이 막으려던 바로 그 부류의 게이트 신뢰도 결함이 네 번째 경로에서 재발한다. 그 외 전역 상태·환경변수·네트워크·이벤트 관련 부작용은 없으며, 유일한 부수 발견은 신설 테스트가 서브프로세스에서 만든 임시 디렉터리를 정리하지 않는 테스트 위생 문제다.

### 위험도
HIGH
