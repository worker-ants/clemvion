STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===

# Concurrency Review — harness-bundle-correctness

## 발견사항

해당 없음.

`git diff origin/main...HEAD` 로 실제 변경 범위를 직접 확인한 결과, 이번 변경은 다음으로 구성된다:

- `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`: 예산 차감 산술을 `_charge_notice()` 헬퍼 하나로 통합하는 리팩터(`build_files_section` 내부의 4곳 산술을 공통 호출로 치환).
- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`: 파일 정렬 키를 사전순에서 자연 정렬(`_natural_key`)로 교체, 번들 파일 경계 마커를 헤딩 기반(`\n#### \``)에서 사전(`_BUNDLE_FILE_SENTINEL = "\n<!-- @bundle-file -->\n"`) 기반으로 교체.
- `.claude/tests/test_consistency_bundle_priority.py`, `.claude/tests/test_consistency_context_budget.py`: 위 변경에 대응하는 테스트 갱신/추가.
- `plan/in-progress/harness-consistency-summary-downgrade-rule.md`: 체크리스트 상태 갱신(문서 전용).

모든 코드 변경은 지역 변수만 다루는 순수 함수(정렬 키 계산, 문자열 템플릿 조립, 정수 예산 차감)이며, 두 스크립트 어디에도 `threading`/`asyncio`/`multiprocessing`/`concurrent.futures`/`Lock`/`Semaphore`/`async def`/`await` 가 존재하지 않음을 grep 으로 확인했다(0건). 각 orchestrator 는 CLI 진입점에서 단일 프로세스·단일 스레드로 순차 실행되며, 이번 diff 가 건드리는 함수들은 공유 가변 상태나 외부 자원(파일 잠금, DB 커넥션, 스레드 풀)에 접근하지 않는다. 테스트 쪽도 `subprocess.run` 으로 각 케이스를 독립 서브프로세스에 격리해 실행하고(`unittest` 기본 순차 실행), 새 diff 가 건드린 `test_consistency_bundle_priority.py`/`test_consistency_context_budget.py` 의 헬퍼 호출부는 서로 상태를 공유하지 않는다.

참고(이번 diff 범위 밖, 발견사항 아님): 두 orchestrator 전체 파일에는 `_retry_state.json` 을 read-modify-write 하는 `_apply_status_update`/`_load_state`/`_save_state`/`_reconcile_state_with_disk` 계열 함수가 있고, 이는 파일 락 없이 "읽기→로컬 수정→쓰기" 패턴이라 여러 리뷰어/체커가 동시에 `--update` 를 호출하면 lost-update 가 이론상 가능한 구조다. 다만 이번 diff 는 그 함수들을 전혀 수정하지 않았고(모두 unchanged), diff 는 순수 정렬/예산 계산 로직에 한정되므로 이 관측은 채점에 반영하지 않았다.

## 요약

이번 변경분(파일 5개, +184/-33)은 리뷰/일관성 검토 하네스의 프롬프트 번들 조립 로직 — 파일 우선순위 정렬(자연 정렬 키), 파일 경계 마커(사전 기반), 예산 차감 산술 통합 — 에 한정되며, 스레드·프로세스·락·async/await·이벤트 루프·커넥션 풀 등 동시성 프리미티브를 도입하거나 수정하지 않는다. 모든 변경 함수는 단일 호출 스코프 안에서 지역 변수만 다루는 순수 계산이라 경쟁 조건·데드락·원자성 위반의 여지가 없다. 동시성 관점에서는 리뷰 대상이 아니다.

## 위험도

NONE
