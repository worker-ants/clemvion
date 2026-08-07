# 부작용(Side Effect) 리뷰 — `.claude/_shared/git_probe.py` 예외 catch 재조정 외

## 핵심 판정 (요청받은 항목)

**재조정은 지적된 부작용을 실제로 제거했고, 새로운 부작용을 만들지 않았다.**

커밋 이력으로 재구성한 3단계:

1. `a3a6f5454` — `branch_diff_files` 신설. `_run_git_raw` 는 좁은 catch
   `(TimeoutExpired, FileNotFoundError, OSError)`, `branch_diff_files` 는 try/except 없이
   `_run_git_raw` 를 직접 호출.
2. `64c71ae14` — `errors="surrogateescape"` 추가와 **동시에** `_run_git_raw` 의 catch 를
   `except Exception` 으로 넓힘. 이 시점에 `_run_git_raw` 는 push-gate 훅 3개
   (`review_guard`/`plan_guard`/`branch_guard`)가 공유하는 `_current_branch`/`_repo_root`/
   `_default_branch`/`_merge_base` 의 공통 하위 프리미티브이기도 하므로, `TypeError` 등
   프로그래밍 오류가 "git 실패"로 삼켜져 `review_guard` 는 fail-open, `plan_guard` 는 거짓
   BLOCK 이 되는 경로가 열렸다 — 직전 라운드에서 지적된 바로 그 문제.
3. `7d3cf7721` (현재 HEAD) — `_run_git_raw` 를 `(TimeoutExpired, FileNotFoundError, OSError)`
   로 되돌리고, `branch_diff_files` 내부에 `_run_git_raw` 호출을 감싸는 자체
   `except Exception` 을 새로 추가.

검증:

- `.claude/_shared/git_probe.py:131-179`(`_run_git_raw`) — catch 가
  `(subprocess.TimeoutExpired, FileNotFoundError, OSError)` 로 좁혀져 있음을 `Read` 로 직접 확인.
- `.claude/_shared/git_probe.py:246-260`(`branch_diff_files`) — `_run_git_raw` 호출부를
  감싸는 `except Exception as exc` 가 이 함수 안에만 존재.
- 훅 3개(`review_guard.py`/`plan_guard.py`/`branch_guard.py`)는 `branch_diff_files` 를 전혀
  참조하지 않는다 (`grep` 결과 0건) — 넓은 catch 가 훅 레이어에 도달할 경로가 구조적으로 없다.
- `.claude/tests/test_branch_diff_shared.py::UndecodableGitOutputTest.
  test_an_unexpected_exception_is_empty_for_the_list_caller_only` (라인 346-372) 가 이 경계를
  직접 고정한다: `subprocess.run` 이 `ValueError` 를 던지도록 mock 하면 `_run_git_raw`/
  `_run_git` 은 **그대로 raise**(`assertRaises(ValueError)`)해야 하고, `branch_diff_files` 만
  `[]` 를 반환하며 `on_error` 로 한 번 로깅해야 한다. 같은 파일의
  `test_the_narrow_failures_are_still_absorbed_by_the_probe`(374-385)는 `FileNotFoundError`/
  `TimeoutExpired`/`OSError` 세 가지는 `_run_git_raw`/`_run_git` 양쪽에서 여전히
  `(1, "", "")` 로 흡수됨을 확인한다.
- 실행 확인: `pytest .claude/tests/test_branch_diff_shared.py -q` → 14 passed, 7 subtests.
  `pytest .claude/tests -k "guard or git_probe or retry_state"` → 371 passed. 회귀 없음.
- `code_review_orchestrator.get_git_branch_diff_files`(`.claude/skills/code-review-agents/
  scripts/code_review_orchestrator.py:1047-1064`)와 `consistency_orchestrator.
  _branch_changed_rels`(`.claude/skills/consistency-checker/scripts/
  consistency_orchestrator.py:243-257`) 둘 다 이제 자체 try/except 없이 `_git_probe.
  branch_diff_files(...)` 에 위임한다 — 넓은 catch 의 소재가 이 두 orchestrator 전용 함수
  하나로 정확히 수렴했고, 중복 catch(이중으로 `on_error` 가 두 번 불리는 경로)는 없다:
  `rc != 0` 분기와 `except Exception` 분기는 상호 배타적이다.

결론적으로 "좁은 catch 를 primitive 로, 넓은 catch 를 두 orchestrator 전용 소비 지점으로"
라는 재조정 의도가 코드·테스트·구조 세 층위 모두에서 일치한다. `errors="surrogateescape"`
는 여전히 `_run_git_raw` 레벨에서 전원(훅 포함)에 적용되지만, 이는 "삼키는 예외 범위"가
아니라 "디코딩 방식" 변경이라 훅의 실패 시맨틱(좁은 catch)에 영향을 주지 않는다 — 애초에
surrogateescape 자체가 `UnicodeDecodeError` 발생을 막는 것이므로 좁은 catch 범위와 상충하지
않는다.

## 부수 관찰 (이번 재조정 범위 밖, 참고용)

- **[INFO]** `_default_branch` 는 여전히 자체 `except Exception` 두 곳을 갖는다.
  - 위치: `.claude/_shared/git_probe.py` `_default_branch` 함수 (약 271, 275, 300, 302행 부근 —
    `try: d = _origin_default_branch(cwd)` 와 `except Exception:  # noqa: BLE001` 두 블록).
  - 상세: `git show a3a6f5454~1:.claude/_shared/git_probe.py` 로 확인한 결과 이 두 broad catch
    는 이번 재조정 이전(브랜치-diff 통합 라운드 이전)부터 이미 존재했다. 즉 이번 커밋
    (`64c71ae14`→`7d3cf7721`)이 만든 부작용이 아니라 기존 설계다. 다만 방금 문서화된
    "훅 레이어는 좁은 catch, 넓은 catch 는 orchestrator 전용" 원칙과 표면적으로는 계속
    긴장 관계에 있다 — `_default_branch` 도 훅 3개가 공유하는 프리미티브이기 때문이다.
    (다른 점: 이쪽은 삼킨 뒤 명시적 fallback 체인으로 이어지고 최종 실패는 `None` 이라 "git
    실패"를 다른 진단으로 오분류하지는 않는다 — `branch_diff_files` 도입 이전부터 있던
    별도의 설계 판단으로 보인다.)
  - 제안: 이번 PR 의 스코프는 아니므로 조치 불필요. 다만 "훅 프리미티브는 좁은 catch" 원칙을
    문서화하는 김에, 이 기존 예외가 그 원칙의 의도된 예외인지 각주로 남겨두면 다음 라운드의
    재지적(round-3 반복)을 예방할 수 있다.

- **[INFO]** `merge_coordinator_orchestrator.py` 의 `main()` — `--resume` 경로에 새로
  `_reconcile_state_with_disk(sd)` 호출이 추가되어, resume 시 `_retry_state.json` 을 디스크
  상태와 대조해 **파일에 쓸 수 있게** 됐다(변경분이 있으면 `changed=True` → 이미
  `reconcile_state_with_disk` 내부에서 저장까지 수행하는 것으로 보임).
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py`
    `main()` 함수의 `--resume` 분기 (diff 상 542-550행 부근, `# Reconcile before handing the
    session back` 주석 아래).
  - 상세: 이는 자매 orchestrator 두 개(`code_review_orchestrator`/`consistency_orchestrator`)
    가 이미 갖고 있던 self-healing 을 세 번째에도 맞춘 것으로, 커밋 메시지·주석 모두 의도를
    분명히 밝히고 있어 "의도치 않은" 부작용은 아니다. 다만 "resume 호출이 세션 디렉토리의
    `_retry_state.json` 을 조용히 갱신할 수 있다"는 것 자체는 호출자 입장에서 새로 생긴
    파일시스템 부작용이므로, side-effect 관점에서 기록해 둔다 (기능적으로는 올바른 방향).
  - 제안: 조치 불필요 — 의도된 동작 일치화. 다만 `--resume` 를 read-only 로 기대하는 외부
    스크립트가 있다면(현재 저장소 안에서는 확인되지 않음) 이번 변경으로 그 가정이 깨진다는
    점만 인지.

## 요약

이번 라운드가 좁힌 것은 정확히 지적받은 대상(`_run_git_raw`/`_run_git`)이고, 넓힌 채로 남긴
것도 정확히 원래 그 계약을 갖고 있던 두 orchestrator 전용 소비 지점(`branch_diff_files`)
하나로 수렴했다. 훅 3개는 `branch_diff_files` 를 참조하지 않으므로 넓은 catch 가 훅 레이어로
새어 들어갈 구조적 경로가 없고, 이 경계는 mock 기반 테스트로 명시적으로 고정되어 있다
(`ValueError` 는 primitive 에서 raise, `branch_diff_files` 에서만 흡수). 이번 diff 범위 안에서
새로운 전역 상태·시그니처 파괴·인터페이스 변경·의도치 않은 네트워크/파일시스템 부작용은
발견되지 않았다. 부수적으로 발견한 두 건(`_default_branch` 의 기존 broad catch,
merge-coordinator `--resume` 의 신규 disk-write)은 모두 이번 재조정 이전부터 있었거나
문서화된 의도적 변경이라 조치 대상이 아니다.

## 위험도

NONE
