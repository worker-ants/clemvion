# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건(둘 다 비차단: 테스트 커버리지 갭 1건 + plan 문서 감사추적 갭 1건), 나머지는 참고용 INFO. Forced reviewer 7명 전원 결과 확보됨(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `main()`의 `_push_targets` 예외 폴백 경로(`targets = [base_cwd]`)가 실제로는 어떤 테스트도 도달하지 못함 — `review/code/2026/07/23/17_28_02/RESOLUTION.md`가 이 경로를 "커버됨"이라 기재했으나, 실제로 테스트되는 것은 `_worktree_branches` 내부 fail-open(다른 예외 발생 지점)뿐. `targets = []`로 바꾸는 mutation이 있어도 어떤 테스트도 감지 못함 — 이 PR이 막으려는 것과 동일 클래스의 false-ALLOW 위험 | `.claude/hooks/guard_review_before_push.py:535-539` | `_push_targets`를 직접 monkeypatch해 `main()`이 실제 `except Exception` 분기를 타는 경로를 만들고, 폴백이 REVIEW/PLAN 게이트를 완전히 건너뛰지 않음을 단언하는 테스트 추가. 최소한 RESOLUTION.md의 커버리지 주장부터 정정 |
| 2 | Documentation | plan 문서에 "2차 리뷰(17_51_28) 반영" 서술 섹션이 없음 — 1차 리뷰 WARNING 7건은 표로 상세 기록됐지만, 2차 리뷰 WARNING 2건(per-target fail-open 미검증, `base_cwd` 죽은 파라미터)은 체크리스트 한 줄(88행) 외에 본문 서술이 전혀 없음. 코드 자체는 두 항목 모두 정확히 반영됨을 확인했으나 plan이 스스로 확립한 "라운드별 반영 내역 본문 기록" 관례가 2차에서만 깨져 감사 추적성이 비대칭 | `plan/in-progress/push-guard-worktree-scope.md` (64-88행) | 1차 섹션과 대칭되는 `## 2차 리뷰(17_51_28) 반영` 절 추가. 3차(이번) 라운드가 clean 이면 plan 종결 시점에 한 번에 정리해도 무방 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | `_GIT_PUSH`의 blind word-boundary 매칭이 이 PR이 만든 "push" 포함 파일명(`push-guard-worktree-scope.md` 등)과 상호작용해, 순수 `git log`/`git blame` 같은 비-push 명령까지 REVIEW 게이트가 오탐 차단하는 것을 실측으로 재현. 정규식 자체는 "DO NOT EDIT"로 frozen이며 이번 diff 범위 밖, 오탐 방향은 항상 안전한 쪽(false BLOCK)이라 false-ALLOW 회귀는 아님 | `guard_review_before_push.py:70-72` (정규식), 유발 대상은 `plan/in-progress/push-guard-worktree-scope.md` 등 이 PR 신설 경로 | 조치 불요(정규식 변경 범위 밖). 향후 "push"를 하이픈으로 포함하는 파일명 추가 시 `git log -- <path>` 류가 걸릴 수 있음을 참고 |
| 2 | Requirement / Documentation | 모듈 최상단 docstring이 cross-worktree 평가 계약(316행부터의 "Which worktree(s) does this push publish?" 설계)을 요약하지 않음 (1·2차부터 이월, 재확인) | `guard_review_before_push.py:1-24` vs `:316-348` | 급하지 않음 — 상단 docstring에 한 줄 요약 추가 고려 |
| 3 | Requirement / Documentation | `guard_review_before_stop.py`가 여전히 `evaluate_review()`/`evaluate_plan()` 무인자 호출 — 이 fix가 push 훅에만 적용되고 Stop 훅에는 적용되지 않는 이유(Stop은 "지목할 다른 branch"가 구조적으로 없음)가 코드·plan 어디에도 문장으로 없음 (1·2차부터 이월) | `guard_review_before_stop.py:247, 264` | 급하지 않음 — 316행 블록 또는 plan에 근거 한 줄 추가 시 향후 재조사 비용 절감 |
| 4 | Testing | legacy(unscoped) 폴백에서 렌더링되는 `worktree:` 값(`os.getcwd()`로 정정됐음)을 직접 assert하는 테스트가 없음 — 향후 회귀해도 기존 15건이 green으로 남음 | `guard_review_before_push.py:511-518`, `test_guard_review_before_push_main.py` 전체 | blocking 테스트 1건에 `assertIn(f"worktree:  {os.getcwd()}", r.stderr)` 류 단언 추가 |
| 5 | Testing | `_worktree_branches`의 detached-HEAD 워크트리 파싱(코드 리딩상 정상)이 실제 e2e 테스트로 고정되지 않음. 이 저장소는 워크트리 기반 워크플로라 드문 시나리오 아님 | `guard_review_before_push.py:372-383` | `git worktree add --detach` 워크트리를 setUp에 추가해 파싱이 안 깨짐을 확인하는 테스트 1건 |
| 6 | Testing | `_accepts_cwd`의 `except Exception: return False` 분기(signature 조회 실패)가 미검증. 실사용 경로 위험은 낮음 | `guard_review_before_push.py:427-428` | 선택 사항 — signature 없는 callable 케이스 1건 고려 |
| 7 | Testing | plan 체크리스트가 "테스트 18건 신설"로 표기돼 있으나 실제로는 19건(커밋 메시지는 정확) | `plan/in-progress/push-guard-worktree-scope.md:85` | 체크리스트를 "19건"으로 갱신 |
| 8 | Testing | 여러 target이 동시에 block될 때 cwd가 항상 먼저 보고되는지(순서 계약)를 직접 단언하는 테스트가 없음 | `_push_targets`(431-449행) + `_run_gate`(511행) | 선택 사항 — 결정론적 순서가 중요하면 최소 1건 추가 |
| 9 | Maintainability | 신규 테스트 스텁의 `raising` 경로 필터링이 바로 위 `blocked` 필터링과 동일한 패턴(4줄)을 그대로 반복. 테스트 픽스처라 허용 기준 낮음 | `test_push_guard_worktree_scope.py` (`_REVIEW_STUB` 내부) | 급하지 않음 — 세 번째 `STUB_*_PATHS` 축 추가 시 `_paths_from_env(name)` 헬퍼 추출 고려 |
| 10 | Documentation | 테스트 카탈로그(`README.md`)가 `AcceptsCwdContractTest`·PLAN 게이트 스코핑 테스트를 이름으로 언급하지 않음 (1·2차가 이미 "1:1 대응"으로 수용 가능 판정) | `.claude/tests/README.md:45` | 급하지 않음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 새 결함 없음. 1·2차 WARNING 반영(per-target fail-open 테스트, base_cwd 제거) 코드 레벨 재확인. 커맨드 인젝션·시크릿·bypass 우회 없음 |
| requirement | LOW | 핵심 기능(교차-worktree false-ALLOW 차단) 정상 구현, 1·2차 WARNING 9건 전부 반영 재확인. `_GIT_PUSH` blind 매칭 오탐 실측 재현(비차단, frozen 범위 밖) |
| scope | NONE | 스코프 이탈 없음. 핵심 코드 변경 + `_run_gate` 추출/파라미터 정리 모두 같은 fix의 정당한 후속조치. 부수 파일(테스트·README·plan·리뷰 산출물) 전부 관례 부합 |
| side_effect | LOW | 이번 라운드 실질 diff(base_cwd 제거, fail-open 회귀 테스트)는 behaviour-preserving. 전역변수/공개 시그니처 파손/예상 밖 파일쓰기/네트워크 호출 없음 |
| maintainability | LOW | 직전 라운드 WARNING 1건(base_cwd) + INFO 1건 모두 해소 확인. 테스트 스텁 내 패턴 반복만 경미하게 남음 |
| testing | LOW | `main()`의 `_push_targets` 예외 폴백 경로가 RESOLUTION.md 주장과 달리 실제 미검증(WARNING). detached-HEAD 파싱·순서 계약 등 저위험 커버리지 갭 다수(INFO). 대상 39건 + harness 전체 486건 green |
| documentation | LOW | plan 문서의 "라운드별 반영 내역 기록" 관례가 2차 리뷰분에서만 누락(WARNING, 코드는 정확). 나머지는 1·2차부터 이월된 비차단 INFO |

## 발견 없는 에이전트

- scope (위험도 NONE, 발견 0건)

## 권장 조치사항

1. `main()`의 `_push_targets` 예외 폴백 경로(535-539행)를 실제로 트리거하는 테스트를 추가하고, `RESOLUTION.md`의 "커버됨" 주장을 정정한다 — 이 PR이 막으려는 것과 동일한 false-ALLOW 클래스가 이 경로에 여전히 미검증 상태로 남아있다.
2. plan 문서에 `## 2차 리뷰(17_51_28) 반영` 절을 추가해 1차 섹션과 감사 추적 형식을 맞춘다.
3. (선택) legacy `worktree:` 렌더 값, detached-HEAD 파싱, target 보고 순서 등 testing INFO 항목들을 여유 있을 때 회귀 테스트로 고정한다.
4. (선택) 모듈 docstring에 cross-worktree 평가 계약 한 줄 요약, `guard_review_before_stop.py` 스코프 제외 근거 한 줄을 추가해 향후 재조사 비용을 줄인다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명, 전원 — forced whitelist 전원 결과 확보됨, 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |