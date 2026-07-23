# RESOLUTION — review/code/2026/07/24/00_34_09

대상: branch `claude/push-guard-worktree-scope-20044c`, 커밋 `feda5b219`(origin/main 병합).
판정: **RISK=MEDIUM / CRITICAL=0 / WARNING=7 / INFO=12**. forced 7/7 확보, 누락 0.

## WARNING 7건 — 전량 반영

| # | 조치 |
|---|---|
| **1** bare push false-ALLOW 잔여 갭 (security+requirement 공통) | **반영** — `cd <worktree> && <push>`(upstream tracking, refspec 없음)는 branch 이름이 텍스트에 없어 미커버였다. **worktree 경로도 매칭**하도록 `_push_targets` 확장 + `test_bare_push_from_another_worktree_is_scoped_by_path` 추가(M10 이 이 테스트만 kill). 남은 케이스(둘 다 안 나타나는 완전 bare push, 심볼릭 링크 별칭 경로)는 설계 주석에 **RESIDUAL GAP 으로 명시** — 둘 다 cwd-only 로 degrade 하며 수정 전보다 약해지지 않는다 |
| **2** `_push_targets` 실패가 §E 관측에 미기록 | **반영** — `outcome.degraded` 에 `TARGET_SELECTION` 기록. 축소 폴백이 침묵하면 게이트가 실제 push 범위보다 좁은 스코프에서 답하는데도 "완전 건강" 으로 보인다. `test_target_selection_failure_is_counted_not_silent`(streak 파일로 단언, M11 이 kill) |
| **3** `_run_gates` REVIEW/PLAN 골격 중복 재발 | **미조치 (근거 있음)** — 그 골격은 **origin/main(#999)이 소유한 코드**다. 내 병합은 그 안에 `_evaluate_over_targets` 호출만 끼워 넣었고, 두 블록을 다시 추출하면 #999 가 방금 세운 구조를 이 PR 이 되돌리는 셈이라 병합 충돌 표면을 키운다. 별건으로 남기는 게 맞다 |
| **4** `_run_gate` 이름 drift (README + 테스트 docstring) | **반영** — 병합으로 사라진 이름을 `_evaluate_over_targets` 로 정정 2곳. 리뷰 라운드 인용은 감사 이력이라 유지 |
| **5** 모듈 docstring 요약 유실 | **반영** — 4라운드 걸려 넣었던 cross-worktree 요약 한 줄이 **내 병합에서 origin 쪽 docstring 을 base 로 채택하며 소리 없이 사라졌다**(실측: 병합 전 1건 → 후 0건). 복원하며 "by branch or by path" 로 갱신 |
| **6** `result is None` 분기 미검증 | **반영(문서화)** — 두 게이트 모두 None 반환 경로가 없어 오늘은 도달 불가. 분기를 지우는 대신 **의도를 주석으로 명문화**했다: `answered` 를 세우지 않는 이유(아무것도 결정하지 않은 게이트가 §E streak 를 리셋하면 안 됨) + 장차 None 을 의도적으로 쓰면 그 침묵에 자체 `degraded` 사유가 필요하다는 조건 |
| **7** 테스트 `sys.path` 무가드 반복 삽입 | **반영** — `_ensure_on_path()` 헬퍼로 멱등화. `_harness.py` 가 경고하는 네임스페이스 충돌 표면(`_lib` 의 최상위 `review_guard`/`plan_guard`)을 주석에 명시 |

## INFO 8 은 오판이었다 — 실제로 내 branch 가 가드를 깨뜨렸다

리뷰어는 `test_line_anchors.py` 실패를 *"이 diff 대상 파일 아님, 리뷰 산출물 크기로 인한 우연"* 으로
분류했다. **틀렸다.** 실측:

| 확인 | 결과 |
|---|---|
| 깨끗한 `origin/main` 에서 그 테스트 | **34 passed** |
| 내 branch 에서 | **1 failed** (`checked == 0`) |

원인도 리뷰어 가설(산출물 크기)과 다르다. 그 테스트는 `--commit HEAD` 로 **마지막 커밋만** 준비하는데
당시 HEAD 가 **2-parent 머지 커밋**(`feda5b219`)이라 diff 가 비었던 것이다. 본 WARNING 반영분을
일반 커밋으로 올리면 HEAD 가 non-merge 가 되어 해소된다 — 커밋 후 재실행으로 확인했다(§검증).

## 검증

- 신규 테스트 **21 → 23건**. harness 전체 **540 passed / 253 subtests**(`test_line_anchors.py` 포함).
- mutation **11건** 전수(M1·M2·M4~M11): 전부 의도한 테스트만 red, 원복 후 base 와 byte-identical.
  M10(경로 매칭 제거)·M11(TARGET_SELECTION 미기록)이 이번 신설.
- 러너는 앵커 불일치를 `ANCHOR-FAIL` 로 보고한다 — 이번에도 M7 앵커가 내 수정으로 바뀌어 정확히
  검출됐고(거짓 "생존" 아님) 갱신 후 재실행했다.

## 수렴 판정

CRITICAL 0, WARNING 7 중 6건 반영 + 1건(#3) 근거 있는 미조치. 다음 라운드는 코드가 실질 변경됐으므로
fresh 리뷰 1회.
