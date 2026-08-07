# API 계약(API Contract) 리뷰

## 개요

이번 변경(`.claude/_shared/git_probe.py`, `.claude/_shared/retry_state.py`, 두 orchestrator 의
`branch_diff_files` 위임, `merge_coordinator_orchestrator.py` 의 self-heal 도입, 관련 테스트·문서·plan)은
전부 **저장소 내부 harness/CLI 도구**(코드 리뷰·일관성 검토·머지 조율 orchestrator, git 서브프로세스 래퍼,
`_retry_state.json` 상태 파일)에 한정된다. HTTP 라우트, REST 엔드포인트, OpenAPI/스키마, 외부에 노출되는
버전 관리 대상 API 는 diff 어디에도 없다. 따라서 "URL/경로 설계", "페이지네이션", "엔드포인트 인증/인가"
관점은 원천적으로 해당 사항이 없다.

다만 이 저장소의 관행상 CLI 인자(`--update`/`--summary-state`/`--resume`)·stdout 한 줄 포맷·
`_retry_state.json` JSON 스키마·`sub-agent return contract`(`STATUS=... ISSUES=... PATH=... RESET_HINT=...`)는
내부 컴포넌트 간 사실상의 "계약"으로 기능하고, 실제로 커밋 메시지·테스트·문서가 이를 "CLI 계약"이라고
명시적으로 부른다. 그래서 이 좁은 의미의 계약(하위 호환성 / 응답 형식 일관성 / 에러 처리 / 입력 검증)만
아래에서 짚었고, 나머지 REST 전용 관점은 "해당 없음"으로 처리했다.

## 발견사항

이번 변경 범위에서 CRITICAL/WARNING 급 계약 위반은 발견하지 못했다. 아래는 참고용 INFO 두 건이다.

- **[INFO]** `_retry_state.json` 에 스키마 버전 필드가 없다
  - 위치: `.claude/_shared/retry_state.py` — `save_state`, `load_state` (전체 파일 컨텍스트 44, 91행대)
  - 상세: 이번 변경으로 세션 디렉토리에 `_fatal/<name>` sentinel 파일이라는 새 저장 형식이 추가되고
    (README, `.claude/skills/code-review-agents/README.md` 게이트 117~119행 참고), `agents_fatal` 의 의미가
    "메모리 값 그대로"에서 "JSON ∪ sentinel 재도출"로 바뀌었다. 하위 호환성 자체는 잘 지켰다 —
    `test_a_committed_session_with_no_sentinel_keeps_its_fatal` 이 sentinel 없는 과거 세션도 그대로
    동작함을 고정한다. 다만 `_retry_state.json` 자체에는 이 구조 변화를 알리는 `schema_version` 류
    필드가 없어서, 향후 또 다른 필드가 "디스크에서 재도출" 방식으로 바뀔 때 이 파일만 보고는
    구버전 세션인지 신버전 세션인지 판별할 근거가 없다. 지금 당장 문제는 아니지만(Union 로직이
    두 경우 모두 안전하게 처리) 다음 스키마 변경 때 같은 종류의 판별이 또 필요해질 가능성이 있다.
  - 제안: 급하지 않음. 다음에 `_retry_state.json` 구조를 변경할 때 `schema_version` 필드 도입을
    검토할 것을 백로그에 남겨두는 정도로 충분.

- **[INFO]** `merge_coordinator_orchestrator.py --resume` 가 새로 파일을 쓸 수 있게 됨 (부작용 확장이지 계약 위반은 아님)
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py` — `main()` 의 `--resume` 분기 (게이트 543~549행)
  - 상세: 기존에는 `--resume` 이 세션 디렉토리 경로를 읽어 반환하는 순수 조회였다. 이번 변경으로
    `_reconcile_state_with_disk` 를 먼저 호출해 buckets 를 디스크와 동기화하고, 변경이 있으면
    `_retry_state.json` 을 다시 쓴다. 이는 형제 orchestrator 둘(code-review, consistency)이 이미
    갖고 있던 self-heal 을 세 번째로 확장한 것이고, `emit_summary_state` 의 docstring 이 이 트레이드오프
    ("오래된 커밋된 세션을 감사(audit)하면 워크트리가 dirty 해질 수 있다")를 이미 명시하고 있어
    의도된 설계다. 다만 `--resume` 의 stdout 계약(세션 디렉토리 경로 한 줄)은 변경되지 않았고, stderr 에
    "(reconciled …)" 안내가 조건부로 추가되는 정도라 하위 호환성 문제로 보지 않는다. CLI 를 스크립트로
    감싸 stdout 만 파싱하는 기존 자동화가 있다면 영향 없음을 재확인.
  - 제안: 조치 불필요. 다른 두 orchestrator 와 대칭을 맞춘 의도된 변경이며 테스트
    (`test_resume_reconciles_before_handing_the_session_back`)로 고정되어 있다.

## 하위 호환성 관점 노트 (근거)

- `_run_git` 의 외부 계약(반환 튜플, trimming 정책)은 `_run_git_raw` 로 내부 분리된 뒤에도 동일하게
  유지된다 (`_run_git` 은 여전히 `_run_git_raw` 호출 후 `rstrip()`/`strip()` 적용) — 기존 3개 훅
  (`review_guard`/`plan_guard`/`branch_guard`)의 스칼라 프로브 호출부는 영향 없음. 테스트
  `test_run_git_still_trims_for_the_scalar_callers` 로 고정.
- `apply_status_update(session_dir, agent, status, reset_hint)` 시그니처는 변경되지 않았다. 내부에서
  `_record_fatal` 호출이 추가됐을 뿐 호출자 계약은 그대로.
- `emit_summary_state` 의 stdout 한 줄 포맷(`pending=… success=… fatal=… branches=… base=… last_reset=…`)은
  merge-coordinator 로 위임된 뒤에도 필드 순서·이름이 동일하게 유지되며, 테스트가 `assertIn` 대신
  전체 라인 비교로 바뀌어 순서 회귀까지 잡도록 강화됐다(`test_summary_state_cli_reads_through_the_shared_helper`).
- `fatal_sentinel_path` 가 `name` 파라미터를 `os.path.basename(name) == name` 조건으로 검증해 경로
  분리자·`.`/`..` 를 거부한다 — 파일시스템 경로에 쓰이는 입력에 대한 적절한 유효성 검증이며, 실패 시
  예외 대신 `None` 을 반환해 상위 호출부가 조용히 스킵하도록 설계됐다(요청 검증 관점에서 양호).

## 요약

이번 diff 는 내부 harness CLI/상태 파일 도구에 한정되고, 외부에 노출되는 REST API·OpenAPI 계약 변경은
없다. URL 설계·페이지네이션·엔드포인트 인증/인가는 해당 사항이 없다. 내부 CLI/JSON 계약(상태 스키마,
`_run_git` 트리밍 정책, `emit_summary_state` 출력 포맷)은 모두 하위 호환을 유지하면서 확장됐고, 각
변경 지점이 전용 테스트(뮤테이션 검증 포함)로 고정되어 있어 계약 위반 위험은 낮다. CRITICAL/WARNING
없음, 참고용 INFO 2건만 기록한다.

## 위험도

NONE

---

STATUS=success ISSUES=0
