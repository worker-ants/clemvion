# 동시성(Concurrency) 리뷰 결과

## 검토 범위 확인

프롬프트에 제시된 5개 파일 모두 "전체 파일 컨텍스트"로만 제공되어 실제 diff 를
`git diff origin/main...HEAD` 로 직접 대조했다 (해당 브랜치는
`harness-bundle-correctness-0a4694`).

- `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`
- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
- `.claude/tests/test_consistency_bundle_priority.py`
- `.claude/tests/test_consistency_context_budget.py`
- `plan/in-progress/harness-consistency-summary-downgrade-rule.md`

실제 diff 내용은 다음으로 요약된다:

1. `_charge_notice` 신설 — 프롬프트 예산에서 안내문 길이를 한 곳에서 빼는 순수 산술 헬퍼.
2. `build_files_section` 의 2단계 절단(파일 크기 cap → 프롬프트 전체 cap) 시 원본 총 줄
   수(`total_lines`)를 별도로 보존해 두 번째 절단이 첫 절단의 안내문까지 포함해
   잘못 재계산하던 결함 수정.
3. `_natural_key` 신설 + `collect_markdown_files`/`prioritize_bundle_files` 정렬 키를
   사전순 → natural sort 로 교체.
4. `_BUNDLE_FILE_MARKER`(`"\n#### \`"`) → `_BUNDLE_FILE_SENTINEL`(`"\n<!-- @bundle-file -->\n"`)
   로 파일 경계 마커 교체 + `_neutralize_sentinel` 로 본문이 그 sentinel 을 그대로
   포함할 때 무력화.
5. 위 변경에 대응하는 테스트 추가/개정, `subprocess.run` 호출에 `timeout=30.0` 추가.

## 동시성 관점 분석

모든 변경은 **단일 프로세스·단일 스레드 내에서 순차 실행되는 순수 함수형 텍스트/산술
처리**다 (문자열 슬라이싱, 정렬 키 계산, 예산 차감 산술, sentinel 치환). 다음을 확인했다:

- 스레드·`threading`/`concurrent.futures`/`multiprocessing` 사용 없음.
- `async`/`await`/이벤트 루프 없음 — 스크립트는 동기 CLI(`argparse` → `main()` → `sys.exit`)다.
- lock/mutex/semaphore 없음. 공유 가변 상태(class-level·module-level 캐시, 전역
  dict 등)에 대한 신설 없음 — 모든 신규 함수(`_charge_notice`, `_natural_key`,
  `_neutralize_sentinel`)는 인자만 소비하고 부작용이 없다.
- diff 가 손댄 두 orchestrator 파일에는 `_retry_state.json` 을 read-modify-write 하는
  기존 함수들(`_load_state`/`_save_state`/`_apply_status_update`/
  `_reconcile_state_with_disk` 등, 여러 sub-agent 가 fan-out 으로 병렬 호출할 수 있는
  상태 파일)이 있지만, 이번 diff 는 그 함수들을 전혀 건드리지 않는다 — 모두 프롬프트
  본문 조립(`build_files_section`/`collect_markdown_files`/`prioritize_bundle_files`/
  `format_file_bundle`/`extract_rationale_sections`/`truncate_file_bundle`) 쪽 변경이다.
  따라서 기존에 이론상 존재할 수 있는 파일 기반 상태의 TOCTOU 소지는 이번 변경의
  범위 밖이며 회귀도 없다.
- 테스트 파일의 `subprocess.run` 호출은 각 테스트가 "fresh interpreter" 를 그때그때
  spawn 하는 동기·차단(blocking) 호출이며 테스트 간 공유 자원이 없다(각자
  `tempfile.mkdtemp()` 로 격리된 디렉터리 사용, `addCleanup` 으로 정리). 신설된
  `timeout=30.0` 은 대상 코드가 hang 할 경우 테스트 러너 전체가 멈추는 것을 막는
  안전장치이며 동시성 결함이 아니라 오히려 방어적 개선이다.
- 모듈 최상위에서 실행되는 `_SENTINEL = run_in_orchestrator(...)` (test_consistency_
  context_budget.py) 는 import 시점에 subprocess 1회를 동기 spawn 하지만 공유
  가변 상태를 만들지 않으므로 병렬 테스트 실행기에서 각 워커가 독립적으로
  재실행해도 경쟁 조건이 없다.

## 발견사항

없음.

## 요약

이번 diff 는 리뷰/일관성 검사 orchestrator 의 프롬프트 번들 조립 로직(예산 산술 버그
수정, natural sort 도입, 파일 경계 sentinel 교체)에 한정된 순수 동기 텍스트 처리
변경으로, 스레드·비동기·락·공유 가변 상태 등 동시성 관련 요소를 전혀 도입하지 않는다.
diff 가 손대지 않은 `_retry_state.json` 기반 상태 관리 코드(fan-out 시 이론상 race 소지가
있는 영역)도 이번 변경 범위 밖이라 회귀 위험이 없다. 동시성 관점에서는 검토할 대상이
없다.

## 위험도

NONE
