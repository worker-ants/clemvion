# Side Effect Review — round 8

검증 방법: 코드 검사뿐 아니라 실측(벤치마크·전체 테스트 스위트 실행·AST 조회·`git status`
스냅샷 대조)으로 교차 확인했다. 잘린 4개 파일(`review_guard.py`,
`guard_review_before_push.py`, `code_review_orchestrator.py`,
`consistency_orchestrator.py`)은 `Read` 로 전문을 직접 열어 검토했다.

## 발견사항

- **[INFO]** (검증 완료, 회귀 아님) 7R 이 지적한 두 결함 모두 실측으로 재확인 — 수정이 실제로
  유효하다.
  - 위치: `.claude/_shared/block_integrity.py:79-84` (정규식), `.claude/hooks/guard_review_before_push.py:809-883` (`_evaluate_over_targets`)
  - 상세:
    1. **O(n²) verdict 정규식** — `_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END` 를 직접
       벤치마크했다(`("> "*3+"\n")*n`, 코드 검사가 아니라 실행): n=1000→32000 까지 시간이
       0.0001s→0.0030s 로 **선형** 증가(2× 입력 → 2× 시간). 7R 이전 버전(`[\s…]`)이 보였던
       ×4 배증(2배 입력 시)은 재현되지 않는다.
    2. **`_evaluate_over_targets` 의 이른 `return` 이 이후 target 의 advisory 를 버리던 결함**
       — 현재 코드는 블록 여부와 무관하게 루프를 끝까지 돌며 모든 target 의 `notes` 를
       수집하고(`for note in getattr(result, "notes", ())`), 첫 블로킹 target 만 메시지를
       결정한다(`blocked is None` 가드). `.claude/tests/test_block_integrity.py::
       NotesFromLaterTargetsSurviveAnEarlierBlockTest` 가 정확히 양방향(이전 블록 뒤 이후
       target 의 note 보존 / 첫 블로커가 메시지 소유)을 고정한다.
    - 하네스 전체 테스트(`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`)
      753건 전부 통과(회귀 테스트 포함) — 결과를 직접 실행해 확인했으며 실행 전/후
      `git status --porcelain` 대조 결과 테스트 스위트 자체가 실제 저장소에 남기는 부작용도
      없었다(`.claude/state/` 는 gitignored 로 확인, `SuiteLeavesNoRealStateTest` 도 통과).
  - 제안: (조치 불필요 — 확인 목적의 기록)

- **[INFO]** `evaluate_review()` 의 Gate 1 조기 `return` 2곳은 `notes` 를 캐리하지 않는다 —
  현재는 무해하지만, 7R 이 고친 것과 **같은 결함 클래스**가 재발할 수 있는 자리다.
  - 위치: `.claude/hooks/_lib/review_guard.py:958-963`, `:965-970` (Gate 1 의 두 `return
    ReviewDecision(True, ...)` — 3번째 위치 인자 `notes` 없음) vs `:975`(`notes: list[str] = []`
    는 이 두 return 이후에야 초기화됨) 그리고 `:980-990`, `:991-1003`, `:1005-1016`(Gate 2·최종
    return 은 전부 `tuple(notes)` 전달).
  - 상세: Gate 1 이 먼저 block 하면 Gate 2(`_newest_resolved_impl_done_mtime` 호출, `notes`
    수집)는 **아예 실행되지 않는다.** 즉 코드 리뷰가 없어 Gate 1 이 막는 동시에 기존
    `--impl-done` 세션에 하향(downgrade) 모순이 있어도, 그 사실은 이번 판정에서 표면화되지
    않는다(Gate 1 이 풀리는 다음 호출에서야 Gate 2 가 돌아 드러난다 — 영구 유실은 아니고
    지연일 뿐이라 심각하지 않다). `test_block_integrity.py::NotesSurviveBlockingTest::
    test_blocking_returns_carry_notes` 는 AST 로 "Gate 2 라인 이전의 return 은 advisory 를
    나를 수 없다" 며 **이 두 return 을 명시적으로 검사 대상에서 제외**한다
    (`if node.lineno < gate2_line: continue`). 이 예외 사유("이 return 들은 advisory 보다
    앞서 존재해 나를 게 없다")는 **현재는** 사실이지만, Gate 1 에 advisory 소스가 생기는
    순간(예: 코드 리뷰 SUMMARY 쪽에도 하향 백스톱을 붙이는 후속 작업) 조용히 거짓이 되고,
    이 테스트는 line-number 컷오프 때문에 그 회귀를 못 잡는다 — 정확히 라운드 8 이 짚은
    "코멘트가 모든 배치를 커버하는지 확인" 패턴의 잠재적 재발 지점.
  - 제안: 현재 동작 변경은 불요. 다만 Gate 1 에 advisory 소스가 추가되는 시점에는
    `test_blocking_returns_carry_notes` 의 `gate2_line` 컷오프 가정도 함께 재검토해야 한다는
    점을 어딘가(코드 주석 또는 후속 plan)에 남겨두면 재발을 막을 수 있다.

- **[WARNING]** `--branch` 가 `--files`(positional)를 조용히 덮어쓴다 — 이미 추적된 결함,
  실측으로 현재도 존재함을 재확인.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1229-1297`
    (`collect_change_infos`) — `elif args.branch:` (1248행)가 `elif args.files:` (1254행)보다
    앞선 `if/elif` 체인.
  - 상세: 두 인자가 함께 오면 `args.branch` 분기가 먼저 걸려 `args.files` 분기는 **도달
    불가능한 죽은 코드**가 된다 — 호출자가 명시한 파일 목록이 경고 없이 폐기되고 대신 전체
    branch diff 가 리뷰 대상이 된다. AST 로 직접 확인(`ast.walk` 로 `collect_change_infos`
    의 `if`/`elif` 체인 순서 추출) — `args.commit → args.range → args.branch → args.files
    → else` 순서를 재확인했다. `plan/in-progress/harness-review-gate-ci-backstop.md` 항목
    11 이 2026-08-01 자로 이미 이 정확한 결함(재현 표: `--prepare --files A B` → 2개 유지,
    `--prepare --branch origin/main --files A B` → 44개로 전부 대체)을 기록·추적 중이며 이번
    라운드에서는 손대지 않은 상태다. **새 발견 아님** — 이번 리뷰에서 코드를 직접 읽어
    현재도 그대로임만 재확인.
  - 제안: 플랜 문서가 이미 제시한 최소 조치(두 옵션 동시 사용 시 `--files` 우선 + 무시되는
    쪽 stderr 경고)를 해당 백로그 항목에서 그대로 집행 권고. 부작용 관점에서는 "호출자
    입력이 침묵 속에 폐기된다"는 성질이 핵심이라 별도 재등재.

- **[INFO]** `merge_coordinator_orchestrator.py` 는 세 orchestrator 중 유일하게
  `reconcile_state_with_disk` 자기치유가 없다 — 이미 추적된 결함, 재확인.
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:113-125`
    (`_emit_summary_state` 가 `_load_state` 만 호출하고 reconcile 없이 바로 카운트),
    `:535-544`(`--resume` 처리에도 reconcile 호출 없음), `:88-100`(이 갭을 스스로 인정하는
    주석).
  - 상세: `code_review_orchestrator.py`/`consistency_orchestrator.py` 는 `_load_state`/
    `_save_state`/`_apply_status_update` 세 헬퍼만 `_shared/retry_state.py` 에 위임하고
    `reconcile_state_with_disk` 위임은 없다 — 두 곳 모두 확인. 즉 Agent tool 로 직접
    fan-out 된 merge-coordinator 세션은 `_retry_state.json` 이 prepare 시점 스냅샷에 멈춘
    채 커밋될 수 있다(다른 두 orchestrator 가 이미 고친 것과 같은 모순 클래스). 파일 자체
    주석(96-100행)이 "별도 skill 의 동작 변경이라 별도 PR 로 분리" 라고 명시적으로 defer
    하고 있고, `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 9 도 동일하게
    기록돼 있다. **새 발견 아님.**
  - 제안: 추적 문서의 항목대로 별도 PR 에서 처리. 현재 PR 범위에서는 조치 불필요.

- **[INFO]** `.claude/state/review_stop_nudged/` 마커 파일이 만료·정리 메커니즘 없이
  무한 누적된다.
  - 위치: `.claude/hooks/guard_review_before_stop.py:193-195`(`_state_dir`), `:198-211`
    (`_marker_path`), `:218-224`(`_mark_nudged`), `:380-386`(note 별 `note{digest}` 마커 생성 루프).
  - 상세: (세션, 브랜치/토큰, kind) 조합마다 빈 마커 파일을 하나씩 만들고, 하향-경고 문구별로도
    `note{digest}` 마커를 별도로 남긴다. 두 종류 모두 삭제·TTL 로직이 없다(같은 파일의
    fail-open 스트릭 카운터는 "모든 게이트가 정상 응답"하면 `os.remove` 로 자가 정리되는 것과
    대조적). 이 디렉터리는 `CLAUDE_PROJECT_DIR`(메인 프로젝트, worktree 별이 아님) 아래 있으므로
    worktree 가 reap 되어도 남는다. `.gitignore` 로 커밋은 안 되지만, 장기적으로 디스크에
    작은 파일이 무한정 쌓인다 — 기능 결함은 아니고(각 마커는 독립적으로 무해) 운영상 사소한
    누적 리소스 부작용.
  - 제안: 심각하지 않아 즉시 조치는 불요. 장기적으로 `.claude/state/` 정리 스크립트나 reaper
    범위에 이 디렉터리를 포함하는 것을 고려할 수 있음(현재 결정 필요 사항 아님, 정보성 기록).

- **[INFO]** `consistency-summary.md` 의 workflow 모드는 자신의 산출물(`SUMMARY.md`)뿐 아니라
  **다른 checker 의 산출물 파일**도 Write 할 수 있다 — 의도된 설계, 위험 낮음.
  - 위치: `.claude/agents/consistency-summary.md:33`(§수행 절차 B 2번 — "누락 파일 영속화").
  - 상세: prompt 가 지목한 각 checker 의 `output_file` 이 **없을 때만** 그 checker 의 인라인
    전문을 그 경로에 그대로 Write — 기존 파일을 덮어쓰지 않고, 임의 내용을 지어내지도 않는다
    (harness 가 terminal 이 아닌 sub-agent 의 Write 도 basename 으로 차단하는 것에 대한 보정
    장치). 사이드이펙트 관점에서 "한 sub-agent 가 자기 몫이 아닌 파일에 쓴다"는 표면이 늘어난
    것은 사실이지만, 조건(부재 시에만)과 내용(인라인 전문 그대로)이 좁게 제한돼 있어 위험은
    낮다.
  - 제안: 조치 불필요. 문서화된 근거가 충분함.

- **[INFO]** 확인된 "부작용 없음" 항목 — 명시적으로 실측/코드로 배제.
  - `git commit`/`push`/`reset`/`checkout`/`merge`/`rebase` 등 뮤테이팅 git 호출: 9개 리뷰
    대상 파일 전체를 grep 했으나 0건 (모두 `diff`/`status`/`log`/`rev-parse`/`merge-base`/
    `worktree list`/`symbolic-ref`/`show` 등 읽기 전용).
  - `os.environ[...] = ...` 류 환경변수 쓰기: 9개 파일 전체 grep 0건 — env 는 전부 읽기만.
  - 전역 가변 상태(모듈 레벨 mutable global) 도입: 없음 — 전 파일이 상수 또는 "import 시
    1회 fallback 설정" 패턴만 사용, 프로세스당 1회 실행되는 훅/스크립트 구조라 크로스-호출
    누적 위험도 없음.
  - `.claude/state/*.json` 쓰기(fail-open streak, resolution marker 등)는 전부 `.gitignore:19`
    의 `.claude/state/` 로 확인되어 git 추적 오염 위험 없음.

## 요약

7R 이 지적한 두 결함(quadratic verdict 정규식, `_evaluate_over_targets` 조기 return 의
advisory 유실)은 실측(벤치마크 + 전체 하네스 테스트 753건 실행 + 전용 회귀 테스트)으로
**모두 유효하게 수정되어 있음을 직접 확인**했다. 새로 발견한 항목 중 코드 실행에 영향을 주는
CRITICAL 급 부작용은 없다 — `--branch`/`--files` 침묵 대체와 `merge_coordinator_orchestrator`
의 reconcile 부재는 둘 다 실제로 확인되지만 이미 `plan/in-progress/
harness-review-gate-ci-backstop.md`(항목 11, 9)에 기록·추적 중인 기존 결함이라 이번 라운드의
신규 회귀가 아니다. `evaluate_review()` Gate 1 의 조기 return 이 advisory 를 나르지 않는
점과 그 사각지대를 회귀 테스트가 line-number 컷오프로 명시적으로 면제해 둔 점은, 이번
라운드가 고친 것과 같은 결함 클래스가 향후 재발할 수 있는 자리라 정보성으로 기록해 둔다.
그 외 뮤테이팅 git 호출·환경변수 쓰기·전역 가변 상태 도입은 9개 파일 전체에서 0건으로
확인했고, 모든 디스크 쓰기(`_retry_state.json` 원자적 교체, fail-open/nudge 마커)는 문서화된
의도와 일치하며 `.claude/state/` 는 gitignore 로 보호된다.

## 위험도

LOW
